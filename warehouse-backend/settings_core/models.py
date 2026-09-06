from django.db import models


class SystemSetting(models.Model):
    """
    تنظیمات سلسله‌مراتبی سیستم (هستهٔ پلتفرم).

    اگر `warehouse_id` تهی باشد، تنظیم سراسری است؛ اگر مقدار داشته باشد،
    override همان انبار است. برای خنثی‌بودن هسته نسبت به ماژول انبار، به‌جای
    FK به `Warehouse` یک ستون عددی ساده نگه می‌داریم (همان جدول و همان ستونِ
    قبلی، فقط بدون وابستگی سطح مایگریشن به اپ انبار).

    قوانین پروژه (صفر مهاجرت داده): این مدل با `SeparateDatabaseAndState`
    از اپ `warehouses` به اینجا منتقل شده و `db_table='warehouses_systemsetting'`
    عیناً ثابت مانده است. هیچ داده‌ای جابجا نشده و نمی‌شود.
    """
    key = models.CharField(max_length=100)
    value = models.JSONField()
    warehouse_id = models.IntegerField(
        null=True, blank=True, db_index=True, db_column='warehouse_id',
        verbose_name="شناسهٔ انبار",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'warehouses_systemsetting'
        unique_together = ('key', 'warehouse_id')

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        from .services import clear_setting_cache
        clear_setting_cache(self.key, self.warehouse_id)

    def delete(self, *args, **kwargs):
        key = self.key
        wh_id = self.warehouse_id
        super().delete(*args, **kwargs)
        from .services import clear_setting_cache
        clear_setting_cache(key, wh_id)

    def __str__(self):
        if self.warehouse_id:
            return f"{self.key} - WH#{self.warehouse_id}"
        return f"{self.key} - Global"
