from django.db import migrations

def forwards_func(apps, schema_editor):
    Item = apps.get_model('inventory', 'Item')
    # یکپارچه‌سازی رکوردهای قدیمی با مقدار 'approved' به استاندارد 'done'
    Item.objects.filter(doc_status='approved').update(doc_status='done')

def reverse_func(apps, schema_editor):
    pass

class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0028_alter_itemphoto_options_and_more'),
    ]

    operations = [
        migrations.RunPython(forwards_func, reverse_func),
    ]
