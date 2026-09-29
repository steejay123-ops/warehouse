# Generated data migration to assign test warehouse 21 to Payandeh Tavan Sayna (PTS)

from django.db import migrations


def assign_pts_warehouse(apps, schema_editor):
    Warehouse = apps.get_model('warehouses', 'Warehouse')
    Company = apps.get_model('personnel', 'Company')
    pts = Company.objects.filter(code='PTS').first() or Company.objects.filter(id=1).first()
    if pts:
        Warehouse.objects.filter(id=21).update(
            company=pts,
            company_name=pts.name
        )
        print(f"\n[DataMigration] Warehouse 21 successfully assigned to company '{pts.name}' (ID: {pts.id}).")


def reverse_pts_warehouse(apps, schema_editor):
    Warehouse = apps.get_model('warehouses', 'Warehouse')
    Company = apps.get_model('personnel', 'Company')
    fa = Company.objects.filter(code='FA').first() or Company.objects.filter(id=2).first()
    if fa:
        Warehouse.objects.filter(id=21).update(
            company=fa,
            company_name=fa.name
        )


class Migration(migrations.Migration):

    dependencies = [
        ('personnel', '0020_counterparty_company_monthlyworkperiod_company_and_more'),
        ('warehouses', '0004_remove_warehouse_company_id_warehouse_company'),
    ]

    operations = [
        migrations.RunPython(assign_pts_warehouse, reverse_pts_warehouse),
    ]
