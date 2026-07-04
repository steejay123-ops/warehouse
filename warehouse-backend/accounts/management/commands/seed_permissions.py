from django.core.management.base import BaseCommand
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from accounts.models import CustomUser

class Command(BaseCommand):
    help = 'Seeds custom permissions for the Warehouse application'

    def handle(self, *args, **kwargs):
        content_type = ContentType.objects.get_for_model(CustomUser)
        
        permissions = [
            # System
            {'codename': 'perm_sys_settings', 'name': 'دسترسی به تنظیمات کلان سیستم'},
            {'codename': 'perm_sys_logs', 'name': 'مشاهده لاگ‌های امنیتی (Audit)'},
            # Warehouse
            {'codename': 'perm_wh_create', 'name': 'تعریف کارگاه/انبار جدید'},
            {'codename': 'perm_wh_edit', 'name': 'ویرایش مشخصات انبارها'},
            {'codename': 'perm_wh_freeze', 'name': 'فریز کردن و توقف عملیات انبار'},
            # Records
            {'codename': 'perm_rec_import', 'name': 'تزریق و آپلود فایل پایه (Excel)'},
            {'codename': 'perm_rec_dispatch', 'name': 'تخصیص رکورد به شمارشگر میدانی'},
            {'codename': 'perm_rec_label', 'name': 'صدور دستور چاپ لیبل و QR Code'},
            {'codename': 'perm_rec_recount', 'name': 'صدور دستور بازشماری (مغایرت)'},
            # Users
            {'codename': 'perm_usr_add', 'name': 'ثبت پرسنل جدید'},
            {'codename': 'perm_usr_edit', 'name': 'ویرایش پرونده پرسنلی'},
            {'codename': 'perm_usr_role', 'name': 'تغییر ساختار سازمانی و نقش‌ها'},
        ]

        count = 0
        for p in permissions:
            perm, created = Permission.objects.get_or_create(
                codename=p['codename'],
                content_type=content_type,
                defaults={'name': p['name']}
            )
            if created:
                count += 1

        self.stdout.write(self.style.SUCCESS(f'Successfully seeded {count} new custom permissions.'))
