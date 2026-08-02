# مرحله ۲ از ۳ (زیرساخت سینک Local-First):
# backfill مقدار UUID یکتا برای همه ردیف‌های موجود که sync_id ندارند.
# نکته: bulk_update عمداً updated_at را دست نمی‌زند تا دلتای سینک شلوغ نشود.
import uuid

from django.db import migrations

BATCH_SIZE = 2000
SYNC_MODELS = ['Item', 'CountTask', 'CountTaskHistory', 'ItemFieldDefinition']


def backfill_sync_ids(apps, schema_editor):
    for model_name in SYNC_MODELS:
        Model = apps.get_model('inventory', model_name)
        batch = []
        for obj in Model.objects.filter(sync_id__isnull=True).only('id').iterator(chunk_size=BATCH_SIZE):
            obj.sync_id = uuid.uuid4()
            batch.append(obj)
            if len(batch) >= BATCH_SIZE:
                Model.objects.bulk_update(batch, ['sync_id'])
                batch = []
        if batch:
            Model.objects.bulk_update(batch, ['sync_id'])


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0016_sync_fields_stage1'),
    ]

    operations = [
        # برگشت (reverse) عمداً no-op است؛ داشتن sync_id اضافه ضرری ندارد
        migrations.RunPython(backfill_sync_ids, migrations.RunPython.noop),
    ]
