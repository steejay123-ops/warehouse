from django.db import migrations


class Migration(migrations.Migration):
    """
    فاز ۱ — حذف وضعیت مدل SystemSetting از اپ warehouses (خالی کردن state).

    همراه جفتِ خود در settings_core/migrations/0001_initial عمل می‌کند: مالکیت
    مدل (state) به settings_core منتقل می‌شود ولی جدولِ واقعی روی دیتابیس
    (warehouses_systemsetting) دست نمی‌خورد — عملیات «فقط وضعیت» است و هیچ
    SQL ای تولید نمی‌کند (صفر مهاجرت داده، قانون ۲).
    """

    dependencies = [
        ('warehouses', '0003_add_label_template'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.DeleteModel(
                    name='SystemSetting',
                ),
            ],
        ),
    ]
