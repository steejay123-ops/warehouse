from django.apps import AppConfig


class PersonnelConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'personnel'
    verbose_name = 'مدیریت پرسنل، کارکرد و ناوگان'

    def ready(self):
        # فاز ۲ §۲.۷ — ثبت ماژول‌های ممیزی حسابداری در رجیستری هسته.
        # این ماژول‌ها امروز در `MODULE_CHOICES` کلاً غایب‌اند و در نصب حسابداری
        # از سمت همین اپ ثبت می‌شوند.
        from accounts.models import register_audit_modules
        register_audit_modules({
            'attendance': 'کارکرد پرسنل',
            'fleet': 'کارکرد ناوگان و ماشین‌آلات',
            'payroll': 'محاسبات حقوق و دستمزد پرسنل',
            'treasury': 'کارتابل خزانه‌داری و پرداخت',
            'projects': 'پروژه‌ها و بخش‌ها',
            'invoices': 'فاکتورهای هزینه',
        })
