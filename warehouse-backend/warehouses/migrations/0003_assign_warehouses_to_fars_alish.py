# Generated data migration to assign all existing warehouses to Fars Alish (ID: 2)

from django.db import migrations


def assign_warehouses_to_fars_alish(apps, schema_editor):
    Warehouse = apps.get_model('warehouses', 'Warehouse')
    
    # تمامی ۹ انبار موجود فعلی سیستم که فاقد شرکت هستند به شرکت فارس عالیش (شناسه ۲) منتسب می‌شوند
    updated_count = Warehouse.objects.filter(company_id__isnull=True).update(
        company_id=2,
        company_name='فارس عالیش'
    )
    print(f"\n[DataMigration] {updated_count} warehouse(s) successfully assigned to company 'Fars Alish' (ID: 2).")


def reverse_assignment(apps, schema_editor):
    Warehouse = apps.get_model('warehouses', 'Warehouse')
    Warehouse.objects.filter(company_id=2).update(
        company_id=None,
        company_name=None
    )


class Migration(migrations.Migration):

    dependencies = [
        ('warehouses', '0002_warehouse_company_id_warehouse_company_name'),
    ]

    operations = [
        migrations.RunPython(assign_warehouses_to_fars_alish, reverse_assignment),
    ]
