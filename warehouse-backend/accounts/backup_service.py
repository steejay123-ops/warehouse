import os
import json
import hashlib
import sqlite3
import shutil
import subprocess
import logging
from datetime import datetime
from django.conf import settings
from django.db import connections
from django.utils import timezone
from .audit_utils import log_audit_event

logger = logging.getLogger(__name__)

BACKUP_DIR = os.path.join(settings.BASE_DIR, 'backups', 'db')


def _ensure_backup_dir():
    os.makedirs(BACKUP_DIR, exist_ok=True)


def calculate_sha256(filepath):
    """محاسبه هش امنیتی SHA-256 فایل"""
    h = hashlib.sha256()
    with open(filepath, 'rb') as f:
        while chunk := f.read(8192):
            h.update(chunk)
    return h.hexdigest()


def get_backup_list():
    """دریافت لیست تمام فایل‌های پشتیبان ثبت‌شده همراه با متادیتا و وضعیت سلامت"""
    _ensure_backup_dir()
    backups = []

    for item in os.listdir(BACKUP_DIR):
        if item.endswith('.meta.json'):
            meta_path = os.path.join(BACKUP_DIR, item)
            try:
                with open(meta_path, 'r', encoding='utf-8') as f:
                    meta = json.load(f)
                    
                data_file = os.path.join(BACKUP_DIR, meta.get('filename', ''))
                if os.path.exists(data_file):
                    meta['file_exists'] = True
                    meta['actual_size'] = os.path.getsize(data_file)
                else:
                    meta['file_exists'] = False
                    
                backups.append(meta)
            except Exception as e:
                logger.error(f"Error reading backup meta {meta_path}: {e}")

    # مرتب‌سازی بر اساس تاریخ ایجاد نزولی
    backups.sort(key=lambda x: x.get('created_at', ''), reverse=True)
    return backups


def create_database_backup(user=None, description="پشتیبان‌گیری دستی", is_emergency=False):
    """
    ایجاد نسخه پشتیبان باینری کامل و یکپارچه بر اساس موتور پایگاه‌داده (PostgreSQL یا SQLite)
    """
    _ensure_backup_dir()
    db_config = settings.DATABASES['default']
    engine = db_config.get('ENGINE', '')
    now_str = datetime.now().strftime('%Y%m%d_%H%M%S')
    prefix = 'emergency' if is_emergency else 'backup'

    if 'postgresql' in engine:
        filename = f"{prefix}_{now_str}.dump"
        dest_path = os.path.join(BACKUP_DIR, filename)

        env = os.environ.copy()
        if db_config.get('PASSWORD'):
            env['PGPASSWORD'] = str(db_config.get('PASSWORD'))

        cmd = [
            'pg_dump',
            '-h', str(db_config.get('HOST', '127.0.0.1')),
            '-p', str(db_config.get('PORT', '5432')),
            '-U', str(db_config.get('USER', 'postgres')),
            '-d', str(db_config.get('NAME', 'warehouse_db')),
            '-F', 'c',  # Custom compressed archive format
            '-f', dest_path
        ]

        res = subprocess.run(cmd, env=env, capture_output=True, text=True)
        if res.returncode != 0:
            raise RuntimeError(f"pg_dump failed (code {res.returncode}): {res.stderr}")

        file_size = os.path.getsize(dest_path)
        checksum = calculate_sha256(dest_path)

        meta = {
            'id': filename,
            'filename': filename,
            'description': description,
            'engine': 'postgresql',
            'size': file_size,
            'checksum': checksum,
            'is_emergency': is_emergency,
            'created_by': user.username if user else 'System',
            'created_by_name': f"{user.first_name} {user.last_name}".strip() if user else 'سیستم',
            'created_at': datetime.now().isoformat()
        }

        meta_path = os.path.join(BACKUP_DIR, f"{filename}.meta.json")
        with open(meta_path, 'w', encoding='utf-8') as f:
            json.dump(meta, f, ensure_ascii=False, indent=2)

        log_audit_event(
            module='system',
            action='BACKUP',
            severity='info' if not is_emergency else 'warning',
            target_model='Database',
            target_object_id=filename,
            target_repr=f"پشتیبان پایگاه داده: {filename} ({round(file_size / 1024, 1)} KB)",
            user=user,
            details=meta
        )

        return meta

    elif 'sqlite3' in engine:
        db_path = db_config.get('NAME')
        if not os.path.exists(db_path):
            raise FileNotFoundError(f"Database file not found at {db_path}")

        filename = f"{prefix}_{now_str}.sqlite3"
        dest_path = os.path.join(BACKUP_DIR, filename)

        src_conn = sqlite3.connect(db_path)
        dest_conn = sqlite3.connect(dest_path)
        try:
            with dest_conn:
                src_conn.backup(dest_conn)
        finally:
            src_conn.close()
            dest_conn.close()

        file_size = os.path.getsize(dest_path)
        checksum = calculate_sha256(dest_path)

        meta = {
            'id': filename,
            'filename': filename,
            'description': description,
            'engine': 'sqlite3',
            'size': file_size,
            'checksum': checksum,
            'is_emergency': is_emergency,
            'created_by': user.username if user else 'System',
            'created_by_name': f"{user.first_name} {user.last_name}".strip() if user else 'سیستم',
            'created_at': datetime.now().isoformat()
        }

        meta_path = os.path.join(BACKUP_DIR, f"{filename}.meta.json")
        with open(meta_path, 'w', encoding='utf-8') as f:
            json.dump(meta, f, ensure_ascii=False, indent=2)

        log_audit_event(
            module='system',
            action='BACKUP',
            severity='info' if not is_emergency else 'warning',
            target_model='Database',
            target_object_id=filename,
            target_repr=f"پشتیبان SQLite دیتابیس: {filename} ({round(file_size / 1024, 1)} KB)",
            user=user,
            details=meta
        )

        return meta

    else:
        raise NotImplementedError(f"موتور دیتابیس {engine} پشتیبانی نمی‌شود.")


def verify_backup_integrity(filename):
    """اعتبارسنجی یکپارچگی فایل پشتیبان با تطبیق هش SHA-256 و بررسی اولیه فایل"""
    _ensure_backup_dir()
    data_path = os.path.join(BACKUP_DIR, filename)
    meta_path = os.path.join(BACKUP_DIR, f"{filename}.meta.json")

    if not os.path.exists(data_path):
        return {'is_valid': False, 'error': 'فایل داده پشتیبان در سرور یافت نشد.'}

    if not os.path.exists(meta_path):
        return {'is_valid': False, 'error': 'فایل متادیتای پشتیبان مفقود شده است.'}

    with open(meta_path, 'r', encoding='utf-8') as f:
        meta = json.load(f)

    current_hash = calculate_sha256(data_path)
    if current_hash != meta.get('checksum'):
        return {
            'is_valid': False,
            'error': 'هش SHA-256 فایل با متادیتای ذخیره‌شده همخوانی ندارد (احتمال دستکاری یا خرابی داده).'
        }

    return {
        'is_valid': True,
        'size': os.path.getsize(data_path),
        'checksum': current_hash,
        'meta': meta
    }


def restore_database_backup(filename, user=None, ip_address=None):
    """
    بازیابی کامل پایگاه داده از روی نسخه پشتیبان با ایجاد snapshot اضطراری قبل از بازگردانی
    """
    verify_res = verify_backup_integrity(filename)
    if not verify_res.get('is_valid'):
        raise ValueError(f"امکان بازیابی وجود ندارد: {verify_res.get('error')}")

    # ۱. ایجاد نسخه پشتیبان اضطراری پیش از بازیابی
    logger.warning("Creating emergency safety snapshot before restoring database...")
    emergency_meta = create_database_backup(
        user=user,
        description=f"اسنپ‌شات اضطراری قبل از بازیابی فایل {filename}",
        is_emergency=True
    )

    db_config = settings.DATABASES['default']
    engine = db_config.get('ENGINE', '')
    backup_file = os.path.join(BACKUP_DIR, filename)

    if 'postgresql' in engine:
        # پاکسازی شمای عمومی جهت اطمینان از حذف کلیه تغییرات بعد از بکاپ
        connections.close_all()
        try:
            with connections['default'].cursor() as cursor:
                cursor.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
        except Exception as e:
            logger.warning(f"Error recreating public schema before restore: {e}")
        connections.close_all()

        env = os.environ.copy()
        if db_config.get('PASSWORD'):
            env['PGPASSWORD'] = str(db_config.get('PASSWORD'))

        cmd = [
            'pg_restore',
            '-h', str(db_config.get('HOST', '127.0.0.1')),
            '-p', str(db_config.get('PORT', '5432')),
            '-U', str(db_config.get('USER', 'postgres')),
            '-d', str(db_config.get('NAME', 'warehouse_db')),
            '--no-owner',
            backup_file
        ]

        res = subprocess.run(cmd, env=env, capture_output=True, text=True)
        if res.returncode not in (0, 1):
            raise RuntimeError(f"pg_restore failed (code {res.returncode}): {res.stderr}")

        # بازگشایی اتصال و تست
        connections['default'].cursor().execute("SELECT 1;")
        connections.close_all()

        log_audit_event(
            module='system',
            action='ROLLBACK',
            severity='critical',
            target_model='Database',
            target_object_id=filename,
            target_repr=f"بازیابی کامل دیتابیس PostgreSQL از فایل: {filename}",
            user=user,
            details={
                'restored_from': filename,
                'emergency_snapshot': emergency_meta.get('filename'),
                'timestamp': datetime.now().isoformat()
            },
            ip_address=ip_address
        )

        return {
            'success': True,
            'message': f"پایگاه داده با موفقیت از نسخه پشتیبان {filename} بازیابی شد.",
            'emergency_snapshot': emergency_meta.get('filename')
        }

    elif 'sqlite3' in engine:
        connections.close_all()
        db_path = db_config.get('NAME')
        shutil.copy2(backup_file, db_path)
        connections['default'].cursor().execute("SELECT 1;")

        log_audit_event(
            module='system',
            action='ROLLBACK',
            severity='critical',
            target_model='Database',
            target_object_id=filename,
            target_repr=f"بازیابی کامل دیتابیس SQLite از فایل: {filename}",
            user=user,
            details={
                'restored_from': filename,
                'emergency_snapshot': emergency_meta.get('filename'),
                'timestamp': datetime.now().isoformat()
            },
            ip_address=ip_address
        )

        return {
            'success': True,
            'message': f"پایگاه داده SQLite با موفقیت از فایل {filename} بازیابی شد.",
            'emergency_snapshot': emergency_meta.get('filename')
        }

    else:
        raise NotImplementedError(f"موتور دیتابیس {engine} پشتیبانی نمی‌شود.")
