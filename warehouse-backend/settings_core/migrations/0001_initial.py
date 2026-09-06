from django.db import migrations, models


class Migration(migrations.Migration):
    """
    فاز ۱ — انتقال مدل SystemSetting از اپ warehouses به settings_core با
    SeparateDatabaseAndState (صفر مهاجرت داده).

    این عملیات فقط وضعیت (state) مدل را در اپ جدید ثبت می‌کند؛ هیچ SQL ای روی
    دیتابیس اجرا نمی‌کند. جدول `warehouses_systemsetting` همان‌جا و با همان
    محتوا می‌ماند و db_table عیناً ثابت شده است. ستون `warehouse_id` (که پیش‌تر
    FK به Warehouse بود) حالا یک IntegerField ساده با همان db_column است تا
    هسته به ماژول انبار وابسته نباشد.
    """

    initial = True

    dependencies = []

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.CreateModel(
                    name='SystemSetting',
                    fields=[
                        ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                        ('key', models.CharField(max_length=100)),
                        ('value', models.JSONField()),
                        ('warehouse_id', models.IntegerField(blank=True, db_column='warehouse_id', db_index=True, null=True, verbose_name='شناسهٔ انبار')),
                        ('created_at', models.DateTimeField(auto_now_add=True)),
                        ('updated_at', models.DateTimeField(auto_now=True)),
                    ],
                    options={
                        'db_table': 'warehouses_systemsetting',
                        'unique_together': {('key', 'warehouse_id')},
                    },
                ),
            ],
        ),
    ]
