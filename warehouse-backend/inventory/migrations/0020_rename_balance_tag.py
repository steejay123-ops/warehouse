# تغییر نام فیلدهای Item: balance → inventory و tag → my_tag
# + به‌روزرسانی داده‌های JSON ذخیره‌شده که به نام قدیمی فیلد اشاره دارند:
#   - LabelTemplate.elements و qr_source_field (قالب لیبل)
#   - ReportTemplate.spec (گزارش‌ساز)
#   - CustomUser.ui_preferences (ستون‌ها/فیلترهای ذخیره‌شده دیسپچ)
from django.db import migrations

FIELD_MAP = {'balance': 'inventory', 'tag': 'my_tag'}
RELATED_MAP = {'item__balance': 'item__inventory', 'item__tag': 'item__my_tag'}


def _map_name(name):
    if name in FIELD_MAP:
        return FIELD_MAP[name]
    if name in RELATED_MAP:
        return RELATED_MAP[name]
    return name


def _migrate_report_spec(spec):
    """جایگزینی نام فیلد در ساختار spec گزارش‌ساز (فقط جاهایی که نام فیلد است، نه مقدار فیلتر)."""
    changed = False

    def map_list(lst):
        nonlocal changed
        out = []
        for v in lst:
            nv = _map_name(v) if isinstance(v, str) else v
            if nv != v:
                changed = True
            out.append(nv)
        return out

    def walk_filters(node):
        nonlocal changed
        if isinstance(node, dict):
            if 'field' in node and isinstance(node['field'], str):
                nv = _map_name(node['field'])
                if nv != node['field']:
                    node['field'] = nv
                    changed = True
            for key in ('and', 'or', 'not'):
                if key in node:
                    walk_filters(node[key])
        elif isinstance(node, list):
            for child in node:
                walk_filters(child)

    if isinstance(spec.get('fields'), list):
        spec['fields'] = map_list(spec['fields'])
    if isinstance(spec.get('group_by'), list):
        spec['group_by'] = map_list(spec['group_by'])
    for section in ('aggregations', 'sort'):
        if isinstance(spec.get(section), list):
            for entry in spec[section]:
                if isinstance(entry, dict) and isinstance(entry.get('field'), str):
                    nv = _map_name(entry['field'])
                    if nv != entry['field']:
                        entry['field'] = nv
                        changed = True
    if 'filters' in spec:
        walk_filters(spec['filters'])
    if isinstance(spec.get('chart'), dict):
        for k in ('x', 'y', 'label_field', 'value_field'):
            if isinstance(spec['chart'].get(k), str):
                nv = _map_name(spec['chart'][k])
                if nv != spec['chart'][k]:
                    spec['chart'][k] = nv
                    changed = True
    return changed


def forwards(apps, schema_editor):
    # ۱) قالب‌های لیبل
    LabelTemplate = apps.get_model('warehouses', 'LabelTemplate')
    for tpl in LabelTemplate.objects.all():
        changed = False
        if tpl.qr_source_field in FIELD_MAP:
            tpl.qr_source_field = FIELD_MAP[tpl.qr_source_field]
            changed = True
        elements = tpl.elements or []
        for el in elements:
            if isinstance(el, dict) and el.get('field') in FIELD_MAP:
                el['field'] = FIELD_MAP[el['field']]
                changed = True
        if changed:
            tpl.elements = elements
            tpl.save(update_fields=['qr_source_field', 'elements'])

    # ۲) قالب‌های گزارش‌ساز (فقط موجودیت‌های مرتبط با کالا)
    ReportTemplate = apps.get_model('reports', 'ReportTemplate')
    for rpt in ReportTemplate.objects.filter(entity__in=['items', 'count_tasks']):
        spec = rpt.spec or {}
        if _migrate_report_spec(spec):
            rpt.spec = spec
            rpt.save(update_fields=['spec'])

    # ۳) ترجیحات UI کاربران (ستون‌ها و فیلترهای ذخیره‌شده دیسپچ)
    CustomUser = apps.get_model('accounts', 'CustomUser')
    for user in CustomUser.objects.exclude(ui_preferences=None).exclude(ui_preferences={}):
        prefs = user.ui_preferences or {}
        ds = prefs.get('dispatchSettings')
        if not isinstance(ds, dict):
            continue
        changed = False
        cols = ds.get('visibleCols')
        if isinstance(cols, list):
            new_cols = [FIELD_MAP.get(c, c) if isinstance(c, str) else c for c in cols]
            if new_cols != cols:
                ds['visibleCols'] = new_cols
                changed = True
        filters = ds.get('filters')
        if isinstance(filters, dict):
            for old, new in FIELD_MAP.items():
                for suffix in ('', '_search'):
                    old_key, new_key = old + suffix, new + suffix
                    if old_key in filters:
                        filters[new_key] = filters.pop(old_key)
                        changed = True
        if changed:
            user.ui_preferences = prefs
            user.save(update_fields=['ui_preferences'])


def backwards(apps, schema_editor):
    # بازگردانی داده‌های JSON انجام نمی‌شود؛ فقط تغییر نام ستون‌ها برگشت‌پذیر است
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0019_sync_managers'),
        ('warehouses', '0003_add_label_template'),
        ('reports', '0002_export_worker_heartbeat'),
        ('accounts', '0014_alter_customuser_options'),
    ]

    operations = [
        migrations.RenameField(
            model_name='item',
            old_name='balance',
            new_name='inventory',
        ),
        migrations.RenameField(
            model_name='item',
            old_name='tag',
            new_name='my_tag',
        ),
        migrations.RunPython(forwards, backwards),
    ]
