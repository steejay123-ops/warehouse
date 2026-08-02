# مرحله ۱ از ۳ (زیرساخت سینک Local-First):
# افزودن sync_id به صورت nullable و «بدون default» تا ردیف‌های موجود NULL بمانند.
# (اگر default می‌گذاشتیم، Django برای همه ردیف‌های موجود یک UUID «یکسان» می‌نوشت.)
# مرحله ۲ (0017) مقدارهای یکتا را backfill می‌کند و مرحله ۳ (0018) unique=True می‌کند.
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0015_alter_itemfielddefinition_field_type_and_more'),
    ]

    operations = [
        # sync_id — بدون default، بدون unique
        migrations.AddField(
            model_name='item',
            name='sync_id',
            field=models.UUIDField(blank=True, db_index=True, editable=False, null=True, verbose_name='شناسه همگام‌سازی'),
        ),
        migrations.AddField(
            model_name='counttask',
            name='sync_id',
            field=models.UUIDField(blank=True, db_index=True, editable=False, null=True, verbose_name='شناسه همگام‌سازی'),
        ),
        migrations.AddField(
            model_name='counttaskhistory',
            name='sync_id',
            field=models.UUIDField(blank=True, db_index=True, editable=False, null=True, verbose_name='شناسه همگام‌سازی'),
        ),
        migrations.AddField(
            model_name='itemfielddefinition',
            name='sync_id',
            field=models.UUIDField(blank=True, db_index=True, editable=False, null=True, verbose_name='شناسه همگام‌سازی'),
        ),
        # is_deleted (tombstone حذف نرم)
        migrations.AddField(
            model_name='item',
            name='is_deleted',
            field=models.BooleanField(db_index=True, default=False, verbose_name='حذف‌شده (نرم)'),
        ),
        migrations.AddField(
            model_name='counttask',
            name='is_deleted',
            field=models.BooleanField(db_index=True, default=False, verbose_name='حذف‌شده (نرم)'),
        ),
        migrations.AddField(
            model_name='counttaskhistory',
            name='is_deleted',
            field=models.BooleanField(db_index=True, default=False, verbose_name='حذف‌شده (نرم)'),
        ),
        migrations.AddField(
            model_name='itemfielddefinition',
            name='is_deleted',
            field=models.BooleanField(db_index=True, default=False, verbose_name='حذف‌شده (نرم)'),
        ),
        # CountTaskHistory فقط created_at داشت؛ برای cursor سینک updated_at لازم است
        migrations.AddField(
            model_name='counttaskhistory',
            name='updated_at',
            field=models.DateTimeField(auto_now=True, verbose_name='زمان به‌روزرسانی'),
        ),
    ]
