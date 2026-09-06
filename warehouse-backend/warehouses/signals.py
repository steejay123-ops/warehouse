"""
فاز ۱ §۱.۳ — بازسازی رفتار CASCADE از سمت wh-warehouse.

در فاز ۱، `SystemSetting.warehouse` از یک FK با `on_delete=CASCADE` به ستون عددی
سادهٔ `warehouse_id` تبدیل شد تا هسته (`settings_core`) به اپ انبار وابسته نماند.
از آن‌جا که دیگر FK نیست، حذف انبار به‌صورت خودکار تنظیماتش را پاک نمی‌کند؛
بنابراین این سیگنال `post_delete` ثبت می‌شود تا همان رفتار حذف آبشاریِ پیشین حفظ
شود. در نصب بدون اپ انبار (حسابداری‌تنها) این فایل اصلاً بارگذاری نمی‌شود.
"""
from django.db.models.signals import post_delete
from django.dispatch import receiver
from .models import Warehouse


@receiver(post_delete, sender=Warehouse)
def purge_warehouse_settings(sender, instance, **kwargs):
    from settings_core.models import SystemSetting
    from settings_core.services import clear_setting_cache

    keys = list(
        SystemSetting.objects.filter(warehouse_id=instance.id)
        .values_list('key', flat=True)
    )
    if keys:
        SystemSetting.objects.filter(warehouse_id=instance.id).delete()
        # پاک‌سازی کش سطری و کل برای آن انبار تا مقدار کهنه میسر نشود.
        for k in keys:
            clear_setting_cache(k, instance.id)
        clear_setting_cache(None, instance.id)
