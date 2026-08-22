import os
import logging
from django.core.management.base import BaseCommand
from accounts.backup_service import create_database_backup, get_backup_list, BACKUP_DIR

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'ایجاد پشتیبان خودکار از پایگاه داده و چرخش (حفظ N نسخه اخیر)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--keep',
            type=int,
            default=7,
            help='تعداد نسخه‌های پشتیبان معتبر برای نگهداری (پیش‌فرض: ۷)'
        )

    def handle(self, *args, **options):
        keep_count = options['keep']
        self.stdout.write("Creating automated database backup...")

        try:
            meta = create_database_backup(
                user=None,
                description="پشتیبان‌گیری خودکار زمان‌بندی‌شده",
                is_emergency=False
            )
            self.stdout.write(self.style.SUCCESS(f"Backup successfully created: {meta['filename']} ({round(meta['size']/1024, 1)} KB)"))

            # اجرای الگوریتم چرخش و حذف فایل‌های قدیمی
            backups = get_backup_list()
            routine_backups = [b for b in backups if not b.get('is_emergency')]

            if len(routine_backups) > keep_count:
                to_delete = routine_backups[keep_count:]
                for b in to_delete:
                    data_file = os.path.join(BACKUP_DIR, b.get('filename', ''))
                    meta_file = os.path.join(BACKUP_DIR, f"{b.get('filename', '')}.meta.json")

                    if os.path.exists(data_file):
                        os.remove(data_file)
                    if os.path.exists(meta_file):
                        os.remove(meta_file)

                    self.stdout.write(self.style.WARNING(f"Purged old backup: {b.get('filename')}"))

            self.stdout.write(self.style.SUCCESS("Automated backup and rotation completed successfully."))

        except Exception as e:
            self.stderr.write(self.style.ERROR(f"Backup failed: {str(e)}"))
            raise
