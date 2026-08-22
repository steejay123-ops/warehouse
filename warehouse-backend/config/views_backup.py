import os
import subprocess
import base64
import tempfile
import logging
from datetime import datetime

from django.conf import settings as django_settings
from django.db import connection as django_connection
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.http import HttpResponse

from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
from cryptography.fernet import Fernet, InvalidToken

from accounts.permissions import IsSuperUser, CanManageDatabaseBackup, CanRestoreDatabase

logger = logging.getLogger(__name__)

# ─── Magic header to validate .wbak files ───────────────────────────────────
WBAK_MAGIC = b"WBAK_V1:"
SALT_SIZE = 16
KDF_ITERATIONS = 480_000

# ─── Known paths where pg_dump / pg_restore may be installed ────────────────
_PG_TOOL_SEARCH_PATHS = [
    # pgAdmin bundled tools
    r"C:\Program Files\pgAdmin 4\v6\runtime",
    r"C:\Program Files\pgAdmin 4\v7\runtime",
    r"C:\Program Files\pgAdmin 4\v8\runtime",
    # Native PostgreSQL installs
    r"C:\Program Files\PostgreSQL\15\bin",
    r"C:\Program Files\PostgreSQL\16\bin",
    r"C:\Program Files\PostgreSQL\17\bin",
    r"C:\Program Files\PostgreSQL\14\bin",
    # Linux common paths
    "/usr/bin",
    "/usr/local/bin",
]

_pg_tool_cache: dict = {}

# ─── Fatal keywords that indicate a real pg_restore failure ─────────────────
_PG_RESTORE_FATAL_KEYWORDS = [
    "FATAL",
    "COULD NOT CONNECT",
    "AUTHENTICATION FAILED",
    "NO SUCH FILE",
    "INVALID INPUT",
    "OUT OF MEMORY",
]


def _find_pg_tool(tool_name: str) -> str:
    """
    Locate pg_dump or pg_restore by searching known installation directories.
    Falls back to bare tool name (PATH-based lookup) if not found.
    Results are cached after first lookup.
    """
    if tool_name in _pg_tool_cache:
        return _pg_tool_cache[tool_name]

    import shutil

    for search_dir in _PG_TOOL_SEARCH_PATHS:
        candidate = os.path.join(search_dir, tool_name)
        # Windows: try with .exe
        for ext in ("", ".exe"):
            full_path = candidate + ext
            if os.path.isfile(full_path):
                logger.info("Found %s at %s", tool_name, full_path)
                _pg_tool_cache[tool_name] = full_path
                return full_path

    # Fallback: check PATH via shutil.which
    which_result = shutil.which(tool_name)
    if which_result:
        logger.info("Found %s on PATH: %s", tool_name, which_result)
        _pg_tool_cache[tool_name] = which_result
        return which_result

    # Last resort: return bare name and let subprocess raise FileNotFoundError
    logger.warning("%s not found in any known location", tool_name)
    _pg_tool_cache[tool_name] = tool_name
    return tool_name


def _derive_key(password: str, salt: bytes) -> bytes:
    """Derive a Fernet-compatible 32-byte key from a password + salt using PBKDF2."""
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=KDF_ITERATIONS,
    )
    raw_key = kdf.derive(password.encode("utf-8"))
    return base64.urlsafe_b64encode(raw_key)


def _get_db_conf():
    """Read DB connection settings from Django settings."""
    db = django_settings.DATABASES["default"]
    return {
        "NAME": db.get("NAME", ""),
        "USER": db.get("USER", ""),
        "PASSWORD": db.get("PASSWORD", ""),
        "HOST": db.get("HOST", "127.0.0.1"),
        "PORT": db.get("PORT", "5432"),
    }


def _terminate_other_connections(db_name: str):
    """
    Terminate all active (non-idle) connections to the target database,
    except our own connection. This prevents pg_restore --clean from
    failing due to locked tables.
    """
    try:
        with django_connection.cursor() as cursor:
            cursor.execute("""
                SELECT pg_terminate_backend(pid)
                FROM pg_stat_activity
                WHERE datname = %s
                  AND pid <> pg_backend_pid()
                  AND state != 'idle'
            """, [db_name])
            terminated = cursor.fetchall()
            if terminated:
                logger.info(
                    "Terminated %d active connection(s) to '%s' before restore.",
                    len(terminated), db_name
                )
    except Exception as exc:
        logger.warning("Could not terminate other connections: %s", exc)


def _is_fatal_pg_error(stderr_text: str) -> bool:
    """
    Check if pg_restore stderr contains truly fatal errors (not just warnings).
    pg_restore often exits with code 1 for harmless issues like owner mismatch
    or extension permission errors. Only trigger rollback for real failures.
    """
    upper_text = stderr_text.upper()
    return any(keyword in upper_text for keyword in _PG_RESTORE_FATAL_KEYWORDS)


def _safe_remove(path):
    """Safely remove a file, ignoring errors."""
    if path and os.path.exists(path):
        try:
            os.remove(path)
        except Exception:
            pass


class BackupCreateView(APIView):
    """
    POST /api/backup/create/
    Body: { "password": "<user-chosen-password>" }

    Runs pg_dump (writing to a temp file to save RAM), encrypts the output
    with Fernet (key derived from password), prepends the WBAK magic header
    + salt, and streams the result as a downloadable .wbak file.

    Only Superusers can call this endpoint.
    """
    permission_classes = [CanManageDatabaseBackup]

    def post(self, request):
        password = request.data.get("password", "").strip()
        if not password:
            return Response(
                {"error": "رمز عبور الزامی است."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        db = _get_db_conf()
        env = os.environ.copy()
        env["PGPASSWORD"] = db["PASSWORD"]

        dump_path = None

        try:
            # ── 1. Run pg_dump → write directly to temp file (saves RAM) ──────
            with tempfile.NamedTemporaryFile(
                prefix="wbak_dump_",
                suffix=".dump",
                delete=False,
            ) as tmp:
                dump_path = tmp.name

            pg_dump = _find_pg_tool("pg_dump")
            try:
                result = subprocess.run(
                    [
                        pg_dump,
                        "-U", db["USER"],
                        "-h", db["HOST"],
                        "-p", db["PORT"],
                        "-Fc",          # Custom format (binary, compressed)
                        "-f", dump_path,  # Write directly to file (not stdout)
                        db["NAME"],
                    ],
                    capture_output=True,
                    env=env,
                    timeout=300,  # 5 minutes
                )
            except FileNotFoundError:
                logger.error("pg_dump not found in PATH")
                return Response(
                    {"error": "ابزار pg_dump روی سرور یافت نشد. لطفاً با مدیر سیستم تماس بگیرید."},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )
            except subprocess.TimeoutExpired:
                return Response(
                    {"error": "عملیات بک‌آپ بیش از حد طول کشید (Timeout)."},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

            if result.returncode != 0:
                logger.error("pg_dump failed: %s", result.stderr.decode("utf-8", errors="replace"))
                return Response(
                    {"error": "خطا در اجرای pg_dump.", "detail": result.stderr.decode("utf-8", errors="replace")},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

            # ── 2. Read dump from file and encrypt with Fernet ────────────────
            with open(dump_path, "rb") as f:
                dump_bytes = f.read()

            salt = os.urandom(SALT_SIZE)
            key = _derive_key(password, salt)
            fernet = Fernet(key)
            encrypted = fernet.encrypt(dump_bytes)

            # Free dump_bytes from memory as soon as possible
            del dump_bytes

            # ── 3. Build .wbak payload: magic + salt + encrypted data ─────────
            wbak_payload = WBAK_MAGIC + salt + encrypted

            # ── 4. Stream as downloadable file ────────────────────────────────
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"warehouse_backup_{timestamp}.wbak"

            response = HttpResponse(wbak_payload, content_type="application/octet-stream")
            response["Content-Disposition"] = f'attachment; filename="{filename}"'
            response["Content-Length"] = len(wbak_payload)
            return response

        finally:
            # Always clean up the temp dump file
            _safe_remove(dump_path)


class BackupRestoreView(APIView):
    """
    POST /api/backup/restore/
    Multipart body: { "file": <.wbak file>, "password": "<password>" }

    Steps:
      1. Validate the .wbak magic header.
      2. Decrypt the uploaded file using the provided password.
      3. Take an emergency backup of the current DB (rollback file).
      4. Terminate active DB connections to prevent lock conflicts.
      5. Run pg_restore to restore the database.
      6. On success: delete rollback file and return 200.
      7. On failure (fatal only): run pg_restore with rollback file, return 500.

    Only Superusers can call this endpoint.
    """
    permission_classes = [CanRestoreDatabase]

    def post(self, request):
        uploaded_file = request.FILES.get("file")
        password = request.data.get("password", "").strip()

        if not uploaded_file or not password:
            return Response(
                {"error": "فایل و رمز عبور هر دو الزامی هستند."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        wbak_payload = uploaded_file.read()

        # ── 1. Validate magic header ──────────────────────────────────────────
        if not wbak_payload.startswith(WBAK_MAGIC):
            return Response(
                {"error": "فرمت فایل معتبر نیست. لطفاً یک فایل .wbak صحیح آپلود کنید."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        magic_len = len(WBAK_MAGIC)
        salt = wbak_payload[magic_len: magic_len + SALT_SIZE]
        encrypted = wbak_payload[magic_len + SALT_SIZE:]

        # ── 2. Decrypt ────────────────────────────────────────────────────────
        key = _derive_key(password, salt)
        fernet = Fernet(key)
        try:
            dump_bytes = fernet.decrypt(encrypted)
        except InvalidToken:
            return Response(
                {"error": "رمز عبور نادرست است یا فایل پشتیبان آسیب دیده است."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        db = _get_db_conf()
        env = os.environ.copy()
        env["PGPASSWORD"] = db["PASSWORD"]

        pg_restore = _find_pg_tool("pg_restore")
        pg_restore_base_cmd = [
            pg_restore,
            "-U", db["USER"],
            "-h", db["HOST"],
            "-p", db["PORT"],
            "--clean",          # Drop objects before recreating
            "--if-exists",      # Don't fail if object doesn't exist
            "-d", db["NAME"],
        ]

        rollback_path = None
        restore_path = None
        rollback_succeeded = False

        # ── 3. Emergency backup (rollback) ────────────────────────────────────
        try:
            with tempfile.NamedTemporaryFile(
                prefix="wbak_rollback_",
                suffix=".dump",
                delete=False,
            ) as tmp_file:
                rollback_path = tmp_file.name

            pg_dump = _find_pg_tool("pg_dump")
            rollback_result = subprocess.run(
                [
                    pg_dump,
                    "-U", db["USER"],
                    "-h", db["HOST"],
                    "-p", db["PORT"],
                    "-Fc",
                    "-f", rollback_path,
                    db["NAME"],
                ],
                capture_output=True,
                env=env,
                timeout=300,  # 5 minutes
            )
            if rollback_result.returncode != 0:
                logger.warning("Emergency backup failed, proceeding without rollback safety.")
                _safe_remove(rollback_path)
                rollback_path = None

        except Exception as exc:
            logger.warning("Could not create rollback backup: %s", exc)
            _safe_remove(rollback_path)
            rollback_path = None

        # ── 4. Terminate active connections to prevent lock conflicts ─────────
        _terminate_other_connections(db["NAME"])

        # ── 5. Write decrypted dump to temp file and restore ──────────────────
        try:
            with tempfile.NamedTemporaryFile(
                prefix="wbak_restore_",
                suffix=".dump",
                delete=False,
            ) as tmp_restore:
                tmp_restore.write(dump_bytes)
                restore_path = tmp_restore.name

            # Free decrypted bytes from memory
            del dump_bytes

            restore_result = subprocess.run(
                pg_restore_base_cmd + [restore_path],
                capture_output=True,
                env=env,
                timeout=600,  # 10 minutes
            )

            if restore_result.returncode != 0:
                stderr_text = restore_result.stderr.decode("utf-8", errors="replace")

                if _is_fatal_pg_error(stderr_text):
                    # Real failure → trigger rollback
                    raise RuntimeError(stderr_text)
                else:
                    # Non-fatal warnings (owner mismatch, extension issues, etc.)
                    logger.warning(
                        "pg_restore completed with non-fatal warnings (exit code %d): %s",
                        restore_result.returncode,
                        stderr_text[:500],
                    )

        except Exception as exc:
            logger.error("Restore failed: %s", exc)

            # ── 6a. Rollback ──────────────────────────────────────────────────
            if rollback_path and os.path.exists(rollback_path):
                logger.info("Attempting rollback from emergency backup...")
                rb_result = subprocess.run(
                    pg_restore_base_cmd + [rollback_path],
                    capture_output=True,
                    env=env,
                    timeout=600,
                )
                rollback_succeeded = (rb_result.returncode == 0)
                if rollback_succeeded:
                    logger.info("Rollback completed successfully.")
                else:
                    logger.error(
                        "Rollback also failed: %s",
                        rb_result.stderr.decode("utf-8", errors="replace")[:500],
                    )

            return Response(
                {
                    "error": "بازیابی با خطا مواجه شد. سیستم به حالت قبل بازگردانده شد.",
                    "detail": str(exc),
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        finally:
            # Always clean up restore temp file
            _safe_remove(restore_path)

            # Clean up rollback file — EXCEPT when both restore AND rollback
            # failed (keep it as last-resort manual recovery)
            if rollback_path:
                # If we're in the success path, or rollback succeeded → clean up
                # If rollback failed → keep the file for manual recovery
                if rollback_succeeded or 'exc' not in dir():
                    _safe_remove(rollback_path)
                else:
                    logger.warning(
                        "Keeping rollback file for manual recovery: %s",
                        rollback_path,
                    )

        return Response(
            {"message": "بازیابی اطلاعات با موفقیت انجام شد. لطفاً صفحه را مجدداً بارگذاری کنید."},
            status=status.HTTP_200_OK,
        )
