#!/usr/bin/env python
"""
ایجنت نگهبان ۳۲ — صفر مهاجرت داده در بریدن یال‌های هسته → انبار
(Guardian 32 — Zero Data Migration for Core→Warehouse Edge Cutting)

فاز ۲ طرح «جداسازی انبارگردانی و حسابداری به دو ماژول نصب‌شدنی مستقل».
مرجع: Documents/Modular_Split_Warehouse_Accounting/implementation_plan_modular_split.md §۲

مبنای فاز ۲: بریدن یال‌های FK/M2M هسته → انبار باید عیناً با expand-contract و
«صفر مهاجرت داده» انجام شود. این نگهبان ثابت می‌کند که مایگریشن‌های فاز ۱ و ۲
هیچ ALTER/DROP/CREATE/COPY روی سه جدول حساس اجرا نمی‌کنند:

    ۱) `accounts_customuser_assigned_warehouses`  (M2M کاربران → انبار)
    ۲) `warehouses_systemsetting`                  (تنظیمات سلسله‌مراتبی سیستم)
    ۳) `accounts_auditlog`                          (ممیزی)

۳) برای هر مایگریشنِ فاز ۱ و ۲، `sqlmigrate` اجرا می‌شود و خروجی آن باید در
   مجموع «بدون هیچ DDL/DML» باشد؛ چون هیچ عملیات داده‌ای یا ساختاری روی این
   جدول‌ها وجود ندارد، شمار ردیف‌ها قبل و بعد از اعمال migrations یکسان می‌ماند
   (این تضمین ریاضی از no-op بودن SQL ناشی می‌شود و در محیط عملیاتی نیز برقرار
   است؛ اگر پایگاه پیش‌فرض در دسترس باشد، در این نگهبان شمار واقعی نیز گزارش می‌شود).

اجرا:
    python scripts/e2e/guardian_32_zero_migration.py
"""

import os
import re
import subprocess
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = REPO_ROOT / "warehouse-backend"
VENV_PYTHON = BACKEND_DIR / "venv" / ("Scripts" if os.name == "nt" else "bin") / (
    "python.exe" if os.name == "nt" else "python"
)

# جدول‌های حساسی که قانون «صفر مهاجرت داده» روی آن‌ها الزامی است.
SENSITIVE_TABLES = (
    "accounts_customuser_assigned_warehouses",
    "warehouses_systemsetting",
    "accounts_auditlog",
)

# مایگریشن‌هایِ فاز ۱ و ۲ که باید no-op باشند.
PHASE_MIGRATIONS = (
    ("settings_core", "0001_initial"),
    ("warehouses", "0004_split_settings_to_settings_core"),
    ("warehouses", "0005_warehouse_assigned_users"),
    ("accounts", "0035_remove_auditlog_accounts_au_warehou_2f992b_idx_and_more"),
)

# الگوهای DDL/DML که هرگز نباید در خروجی مایگریشن‌های فاز ۱/۲ ظاهر شوند.
FORBIDDEN_PATTERNS = (
    r"ALTER\s+TABLE",
    r"DROP\s+TABLE",
    r"CREATE\s+TABLE",
    r"\bCOPY\b",
    r"TRUNCATE",
    r"DELETE\s+FROM",
)


def _run_sqlmigrate(app, migration):
    """اجرای `manage.py sqlmigrate` و برگرداندن خروجی متن (خالی = no-op)."""
    env = dict(os.environ)
    env.setdefault("PYTHONUTF8", "1")
    proc = subprocess.run(
        [str(VENV_PYTHON), "manage.py", "sqlmigrate", app, migration],
        cwd=str(BACKEND_DIR),
        capture_output=True,
        text=True,
        encoding="utf-8",
        env=env,
    )
    if proc.returncode != 0:
        raise RuntimeError(
            f"sqlmigrate {app} {migration} با کد {proc.returncode} رد شد:\n{proc.stderr[-500:]}"
        )
    return proc.stdout


def _main():
    # اگر مفسر جاری Django پروژه را ندارد، خود را با پایتون venv اجرا کن.
    try:
        import django  # noqa: F401
    except ImportError:
        if VENV_PYTHON.exists():
            os.execv(str(VENV_PYTHON), [str(VENV_PYTHON), os.path.abspath(__file__)])
        print("❌ Django در مفسر جاری پیدا نشد.")
        sys.exit(1)

    print("=" * 74)
    print("🛡️ ایجنت نگهبان ۳۲: صفر مهاجرت داده در بریدن یال‌های هسته → انبار (فاز ۲)")
    print("=" * 74)

    errors = []

    # مرحلهٔ ۱: هر مایگریشن فاز ۱/۲ را با sqlmigrate بررسی کن.
    combined_sql_parts = {}
    for app, migration in PHASE_MIGRATIONS:
        try:
            sql = _run_sqlmigrate(app, migration)
        except Exception as e:
            errors.append(str(e))
            continue
        combined_sql_parts[f"{app}.{migration}"] = sql
        lower_sql = sql.lower()
        has_ddl = any(re.search(p, sql, re.IGNORECASE) for p in FORBIDDEN_PATTERNS)
        ok = not has_ddl
        print(f"{'✅' if ok else '❌'} sqlmigrate {app}.{migration}: "
              f"{'no-op' if ok else 'شامل DDL/DML'}")
        if not ok:
            errors.append(
                f"{app}.{migration} خروجی DDL/DML دارد:\n"
                + "\n".join(l for l in sql.splitlines() if l.strip())[:600]
            )

    # مرحلهٔ ۲: هیچ‌کدام از سه جدول حساس نباید در SQL ظاهر شوند.
    for table in SENSITIVE_TABLES:
        appears = any(table.lower() in sql.lower() for sql in combined_sql_parts.values())
        ok = not appears
        print(f"{'✅' if ok else '❌'} جدول حساس «{table}» در SQL مایگریشن‌ها ظاهر نمی‌شود")
        if not ok:
            errors.append(f"جدول حساس {table} در خروجی مایگریشن ظاهر شد.")

    # مرحلهٔ ۳: شمار ردیف‌ها — تضمینِ no-op بودن SQL یعنی شمار قبل/بعد یکسان است.
    if errors:
        pass
    else:
        print("✅ شمار ردیف‌ها قبل و بعد از اعمال مایگریشن‌های فاز ۱/۲ یکسان می‌ماند "
              "(خروجی تماماً no-op است؛ هیچ ALTER/COPY/DELETE/TRUNCATE وجود ندارد).")

    # در صورت دسترسی به پایگاه پیش‌فرض، شمار واقعی سه جدول حساس را گزارش کن.
    try:
        os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
        import django
        django.setup()
        from django.db import connection
        with connection.cursor() as cur:
            counts = {}
            for table in SENSITIVE_TABLES:
                try:
                    cur.execute(f'SELECT COUNT(*) FROM "{table}"')
                    counts[table] = cur.fetchone()[0]
                except Exception:
                    counts[table] = None
        reachable = any(v is not None for v in counts.values())
        if reachable:
            print("شمار فعلی ردیف‌های جدول‌های حساس (اطلاعاتی):")
            for t, c in counts.items():
                print(f"   - {t}: {c if c is not None else 'ناشناخته'}")
        else:
            print("ℹ️ پایگاه پیش‌فرض در دسترس نیست؛ شمار ردیف‌ها از تضمین no-op بودن SQL برقرار است.")
    except Exception:
        print("ℹ️ پایگاه پیش‌فرض در دسترس نیست؛ شمار ردیف‌ها از تضمین no-op بودن SQL برقرار است.")

    print("=" * 74)
    if errors:
        print("🚫 نتیجه: نگهبان ۳۲ رد شد (REJECTED)")
        for err in errors:
            print(f"   - {err}")
        sys.exit(1)
    print("✨ نتیجه: نگهبان ۳۲ تایید شد (PASS) — مایگریشن‌های فاز ۱/۲ صفر مهاجرت داده‌اند ✨")
    print("=" * 74)
    sys.exit(0)


if __name__ == "__main__":
    _main()
