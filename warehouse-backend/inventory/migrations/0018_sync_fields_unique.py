# مرحله ۳ از ۳ (زیرساخت سینک Local-First):
# حالا که همه ردیف‌ها sync_id یکتا دارند، قید unique اضافه می‌شود و default
# برای ردیف‌های جدید فعال می‌گردد. (unique خودش ایندکس می‌سازد؛ db_index حذف شد.)
import uuid

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0017_sync_fields_backfill'),
    ]

    operations = [
        migrations.AlterField(
            model_name='item',
            name='sync_id',
            field=models.UUIDField(blank=True, default=uuid.uuid4, editable=False, null=True, unique=True, verbose_name='شناسه همگام‌سازی'),
        ),
        migrations.AlterField(
            model_name='counttask',
            name='sync_id',
            field=models.UUIDField(blank=True, default=uuid.uuid4, editable=False, null=True, unique=True, verbose_name='شناسه همگام‌سازی'),
        ),
        migrations.AlterField(
            model_name='counttaskhistory',
            name='sync_id',
            field=models.UUIDField(blank=True, default=uuid.uuid4, editable=False, null=True, unique=True, verbose_name='شناسه همگام‌سازی'),
        ),
        migrations.AlterField(
            model_name='itemfielddefinition',
            name='sync_id',
            field=models.UUIDField(blank=True, default=uuid.uuid4, editable=False, null=True, unique=True, verbose_name='شناسه همگام‌سازی'),
        ),
    ]
