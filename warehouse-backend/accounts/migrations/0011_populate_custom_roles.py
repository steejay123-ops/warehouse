"""
Data Migration: Convert existing Group objects to CustomRole objects.
Preserves all user-group relationships and permissions.

Uses raw SQL to insert into the CustomRole extension table to avoid
Django's MTI save() which tries to update the parent Group row.
"""
from django.db import migrations


# Mapping of existing Group names to their Persian titles and colors
ROLE_METADATA = {
    'admin': {'title': 'مدیریت کل سیستم', 'color': '#4f46e5'},
    'manager': {'title': 'مدیریت پروژه', 'color': '#0891b2'},
    'supervisor': {'title': 'سرپرست اجرا / شمارش', 'color': '#059669'},
    'counter': {'title': 'انباردار میدانی / انبارگردان', 'color': '#d97706'},
    'doc_worker': {'title': 'کارشناس اسناد', 'color': '#64748b'},
    'doc_supervisor': {'title': 'سرپرست اسناد', 'color': '#7c3aed'},
    'document_expert': {'title': 'کارشناس مدارک', 'color': '#7c3aed'},
    'feeding_operator': {'title': 'اپراتور تغذیه MT', 'color': '#be123c'},
}

# Roles from migration 0009 (Persian-named roles)
LEGACY_ROLE_METADATA = {
    'مدیر سیستم': {'title': 'مدیر سیستم', 'color': '#4f46e5'},
    'سرپرست انبار': {'title': 'سرپرست انبار', 'color': '#059669'},
    'انباردار': {'title': 'انباردار', 'color': '#d97706'},
    'سرپرست شمارش': {'title': 'سرپرست شمارش', 'color': '#059669'},
    'شمارشگر': {'title': 'شمارشگر', 'color': '#d97706'},
    'مدیر پروژه': {'title': 'مدیر پروژه', 'color': '#0891b2'},
    'اپراتور صدور': {'title': 'اپراتور صدور', 'color': '#be123c'},
}


def convert_groups_to_custom_roles(apps, schema_editor):
    """
    For each existing Group, insert a row into the CustomRole extension
    table using raw SQL to avoid Django MTI save() side-effects.
    """
    from django.db import connection
    Group = apps.get_model('auth', 'Group')

    with connection.cursor() as cursor:
        for group in Group.objects.all():
            # Check if already has a CustomRole entry
            cursor.execute(
                "SELECT 1 FROM accounts_customrole WHERE group_ptr_id = %s",
                [group.id]
            )
            if cursor.fetchone():
                continue

            # Look up metadata
            metadata = ROLE_METADATA.get(group.name) or LEGACY_ROLE_METADATA.get(group.name)

            if metadata:
                title = metadata['title']
                color = metadata['color']
            else:
                title = group.name
                color = '#94a3b8'

            cursor.execute(
                """
                INSERT INTO accounts_customrole (group_ptr_id, title, color, parent_id, is_system)
                VALUES (%s, %s, %s, %s, %s)
                """,
                [group.id, title, color, None, True]
            )


def reverse_migration(apps, schema_editor):
    """Remove CustomRole entries but keep the underlying Groups intact."""
    from django.db import connection
    with connection.cursor() as cursor:
        cursor.execute("DELETE FROM accounts_customrole")


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0010_create_custom_role'),
    ]

    operations = [
        migrations.RunPython(convert_groups_to_custom_roles, reverse_migration),
    ]
