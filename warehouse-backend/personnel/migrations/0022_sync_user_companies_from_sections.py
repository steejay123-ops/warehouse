# Generated data migration to sync user company accesses based on project section assignments

from django.db import migrations


def sync_users_from_sections(apps, schema_editor):
    CustomUser = apps.get_model('accounts', 'CustomUser')
    UserSectionAssignment = apps.get_model('personnel', 'UserSectionAssignment')
    UserCompanyAccess = apps.get_model('personnel', 'UserCompanyAccess')
    Company = apps.get_model('personnel', 'Company')

    updated_count = 0
    for user in CustomUser.objects.all():
        assignments = UserSectionAssignment.objects.filter(
            user=user, is_active=True, section__project__company__isnull=False
        ).select_related('section__project__company')

        comp_map = {}
        for a in assignments:
            c = a.section.project.company
            if c:
                comp_map[c.id] = c

        if comp_map:
            for c_id, comp in comp_map.items():
                UserCompanyAccess.objects.get_or_create(
                    user=user,
                    company=comp,
                    defaults={'access_level': 'workspace_full', 'is_default': False}
                )

            user_accesses = UserCompanyAccess.objects.filter(user=user)
            if not user_accesses.filter(is_default=True).exists() and user_accesses.exists():
                first_acc = user_accesses.first()
                first_acc.is_default = True
                first_acc.save(update_fields=['is_default'])

            def_acc = user_accesses.filter(is_default=True).first() or user_accesses.first()
            if def_acc:
                user.company = def_acc.company.name
                user.save(update_fields=['company'])
                updated_count += 1
        elif user.is_superuser:
            # سوپریوزر به تمام شرکت‌های فعال متصل می‌گردد
            for comp in Company.objects.filter(is_active=True):
                UserCompanyAccess.objects.get_or_create(
                    user=user,
                    company=comp,
                    defaults={'access_level': 'workspace_full', 'is_default': (comp.code == 'PTS')}
                )

    print(f"\n[DataMigration] Successfully synchronized company accesses for {updated_count} user(s) based on section assignments.")


def reverse_sync(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('personnel', '0021_remove_monthlyworkperiod_unique_warehouse_year_month_period_and_more'),
    ]

    operations = [
        migrations.RunPython(sync_users_from_sections, reverse_sync),
    ]
