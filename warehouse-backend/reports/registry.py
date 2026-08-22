"""
رجیستری موجودیت/فیلد گزارش‌ساز — هسته امنیتی

هیچ رشته‌ای از کلاینت مستقیم وارد ORM نمی‌شود؛ فقط کلیدهایی که اینجا ثبت
شده‌اند قابل استفاده در fields/filters/group_by/sort/aggregations هستند.

قاعده سخت (ضد ضرب دکارتی / باگ annotate جنگو):
هیچ مسیر چندمقداری (reverse FK یا ManyToMany) هرگز در این رجیستری ثبت نمی‌شود.
`model._meta.fields` جنگو M2M را شامل نمی‌شود، پس فیلدهای خودکار امن‌اند؛
whitelist روابط (`related`) هم فقط FK مستقیم (many-to-one) می‌پذیرد که ردیف
تکثیر نمی‌کند. تنها استثنا annotationهای تجمیعیِ خودِ رجیستری است (مثل
Count با distinct=True) که به‌عمد امن ساخته شده‌اند.

برای JOIN چندمقداری (reverse FK) از JoinDef و JOINS whitelist استفاده می‌شود؛
موتور با FilteredRelation تکثیر ردیف را کنترل می‌کند.
"""
from dataclasses import dataclass, field as dc_field
from typing import Callable, Dict, List, Optional

from django.db.models import Count, DateField, DecimalField, F, Value
from django.db.models.fields.json import KeyTextTransform
from django.db.models.functions import Cast, Concat

# ---------------------------------------------------------------------------
# اپراتورهای مجاز به تفکیک نوع فیلد (سمت سرور enforce می‌شود؛ متادیتا هم
# همین را به UI می‌دهد تا کنترل مناسب رندر شود)
# ---------------------------------------------------------------------------
OPERATORS_BY_TYPE = {
    'text':     ['eq', 'icontains', 'istartswith', 'in', 'isnull'],
    'number':   ['eq', 'gt', 'gte', 'lt', 'lte', 'between', 'isnull'],
    'date':     ['eq', 'gte', 'lte', 'between', 'isnull'],
    'datetime': ['eq', 'gte', 'lte', 'between', 'isnull'],
    'boolean':  ['eq'],
    'choice':   ['eq', 'in'],
}

AGG_FUNCTIONS = ('count', 'sum', 'avg', 'min', 'max')

# کاربرانی با یکی از این مجوزها اجازه دیدن فیلدهای حساس را دارند
SENSITIVE_BYPASS_PERMS = ('view_sys_export', 'view_sys_manager_review')


# ---------------------------------------------------------------------------
# JoinDef — تعریف یک JOIN مجاز از یک موجودیت پایه به مقصد (reverse FK)
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class JoinDef:
    target: str           # کلید موجودیت مقصد در رجیستری
    label: str            # برچسب فارسی برای UI
    path: str             # related accessor از پایه به مقصد (verified از related_name مدل)
    cardinality: str      # 'many': یک‌به‌چند | 'one': یک‌به‌یک (بدون گارد تکثیر)
    warehouse_path: str   # مسیر از مقصد به warehouse_id (برای شرط ON در FilteredRelation)
    path_to_base: str     # مسیر FK از مقصد به پایه (برای EXISTS subquery)
    allowed_types: tuple = ('left', 'inner')


# ---------------------------------------------------------------------------
# JOINS whitelist — فقط روابط وارونه‌ای که JOIN آن‌ها مجاز است
# هر entry دستی و بررسی‌شده است؛ path از related_name مدل تأیید شده.
# ---------------------------------------------------------------------------
JOINS: Dict[str, Dict[str, JoinDef]] = {
    'items': {
        'count_tasks': JoinDef(
            target='count_tasks',
            label='وظایف شمارش',
            path='count_tasks',          # CountTask.item related_name='count_tasks'
            cardinality='many',
            warehouse_path='item__warehouse_id',
            path_to_base='item',
        ),
        'doc_tasks': JoinDef(
            target='doc_tasks',
            label='وظایف مدارک',
            path='doc_tasks',            # DocTask.item related_name='doc_tasks'
            cardinality='many',
            warehouse_path='item__warehouse_id',
            path_to_base='item',
        ),
    },
    'count_tasks': {
        'ct_history': JoinDef(
            target='count_task_history',
            label='تاریخچه شمارش',
            path='history',              # CountTaskHistory.task related_name='history'
            cardinality='many',
            warehouse_path='task__item__warehouse_id',
            path_to_base='task',
        ),
    },
    'doc_tasks': {
        'dt_history': JoinDef(
            target='doc_task_history',
            label='تاریخچه مدارک',
            path='history',              # DocTaskHistory.task related_name='history'
            cardinality='many',
            warehouse_path='task__item__warehouse_id',
            path_to_base='task',
        ),
    },
}



@dataclass(frozen=True)
class FieldDef:
    key: str                      # کلید سمت کلاینت (مثلاً warehouse__name یا dyn__coating)
    source: str                   # مسیر ORM؛ برای annotationها برابر alias (== key)
    label: str                    # برچسب فارسی
    type: str                     # text | number | boolean | date | datetime | choice
    choices: Optional[tuple] = None
    sensitive: bool = False
    groupable: bool = True
    aggregatable: bool = False    # فقط عددی‌ها برای sum/avg/min/max
    # سازنده تنبل expression برای فیلدهای پویا/محاسباتی — None یعنی فیلد مستقیم
    annotation: Optional[Callable] = None

    @property
    def operators(self):
        return OPERATORS_BY_TYPE.get(self.type, [])


def _map_model_field(f):
    """نگاشت نوع فیلد جنگو به نوع گزارش‌ساز؛ None یعنی قابل استفاده نیست."""
    if getattr(f, 'choices', None):
        return 'choice'
    internal = f.get_internal_type()
    if internal in ('CharField', 'TextField', 'EmailField', 'SlugField'):
        return 'text'
    if internal in ('IntegerField', 'BigIntegerField', 'SmallIntegerField',
                    'PositiveIntegerField', 'PositiveSmallIntegerField',
                    'PositiveBigIntegerField', 'DecimalField', 'FloatField',
                    'AutoField', 'BigAutoField'):
        return 'number'
    if internal == 'DateField':
        return 'date'
    if internal == 'DateTimeField':
        return 'datetime'
    if internal == 'BooleanField':
        return 'boolean'
    # FK / JSON / UUID / Image و بقیه: از تولید خودکار خارج‌اند
    return None


COMMON_FIELD_LABELS = {
    'id': 'شناسه',
    'created_at': 'تاریخ ایجاد',
    'updated_at': 'تاریخ ویرایش',
    'created_by': 'ایجادکننده',
    'modified_by': 'ویرایش‌کننده',
    'username': 'نام کاربری',
    'first_name': 'نام',
    'last_name': 'نام خانوادگی',
    'phone_number': 'شماره تلفن',
    'operational_zone': 'منطقه عملیاتی',
    'is_active': 'وضعیت فعال',
    'date_joined': 'تاریخ عضویت',
    'assigned_warehouses_count': 'تعداد انبارهای مجاز',
    'status': 'وضعیت',
    'action_type': 'نوع اقدام',
    'note': 'توضیحات',
    'file_name': 'نام فایل',
}


def _clean_persian_label(name: str, label: str) -> str:
    import re
    if not label or label.lower() == name.lower() or label == 'ID':
        return COMMON_FIELD_LABELS.get(name, label or name)
    # حذف هرگونه پسوند یا توضیحات انگلیسی داخل پرانتز
    cleaned = re.sub(r'\s*\([A-Za-z0-9_\-\s]+\)', '', label).strip()
    return cleaned or COMMON_FIELD_LABELS.get(name, label)


def _auto_fields(model, exclude=(), include=None, sensitive_keys=()):
    """
    تولید خودکار FieldDef از فیلدهای مستقیم مدل (الگوی export_columns).
    نکته: `_meta.fields` شامل M2M نیست — قاعده ضد ضرب دکارتی حفظ می‌شود.
    """
    out = {}
    for f in model._meta.fields:
        if include is not None and f.name not in include:
            continue
        if f.name in exclude:
            continue
        ftype = _map_model_field(f)
        if ftype is None:
            continue
        raw_label = str(getattr(f, 'verbose_name', '') or f.name)
        label = _clean_persian_label(f.name, raw_label)
        choices = tuple(c[0] for c in f.choices) if getattr(f, 'choices', None) else None
        out[f.name] = FieldDef(
            key=f.name, source=f.name, label=label, type=ftype,
            choices=choices,
            sensitive=(f.name in sensitive_keys),
            aggregatable=(ftype == 'number' and f.name != 'id'),
        )
    return out


def _person_name_annotation(prefix):
    """نام کامل شخص از روی FK کاربر — الگوی CountTaskSerializer.get_counter_name"""
    def factory(base_prefix=None):
        p = f'{base_prefix}__{prefix}' if base_prefix else prefix
        return Concat(
            F(f'{p}__first_name'), Value(' '), F(f'{p}__last_name'),
        )
    return factory


# ---------------------------------------------------------------------------
# پیکربندی موجودیت‌ها
# ---------------------------------------------------------------------------
class EntityConfig:
    def __init__(self, key, label, model, permissions, warehouse_path=None,
                 exclude=(), include=None, related=None, extra=None,
                 select_related=(), blind_sensitive=()):
        self.key = key
        self.label = label
        self.model = model
        self.permissions = tuple(permissions)   # any-of (accounts.<code>)
        self.warehouse_path = warehouse_path    # مسیر ORM تا warehouse_id
        self.exclude = tuple(exclude)
        self.include = include                  # اگر ست شود فقط همین‌ها (users)
        self.related = related or {}            # key -> FieldDef (فقط FK مستقیم!)
        self.extra = extra or {}                # key -> FieldDef (annotationها)
        self.select_related = tuple(select_related)
        self.blind_sensitive = tuple(blind_sensitive)  # فیلدهای حساسِ حالت شمارش کور

    def user_has_access(self, user):
        if user.is_superuser:
            return True
        return any(user.has_perm(f'accounts.{c}') for c in self.permissions)

    def base_queryset(self):
        qs = self.model.objects.all()
        if self.select_related:
            qs = qs.select_related(*self.select_related)
        return qs

    def get_fields(self, warehouse_id=None):
        """همه FieldDefهای این موجودیت با پرچم sensitive نهایی."""
        from warehouses.services import get_setting

        sensitive_keys = set()
        if self.key == 'items':
            restricted = get_setting('SENSITIVE_EXCEL_FIELDS', warehouse_id) \
                or ['doc_status', 'field_status', 'tag_status']
            sensitive_keys.update(restricted)
        if self.blind_sensitive and get_setting('blind_counting', warehouse_id) == 'blind':
            sensitive_keys.update(self.blind_sensitive)

        fields = _auto_fields(
            self.model, exclude=self.exclude, include=self.include,
            sensitive_keys=sensitive_keys,
        )
        fields.update(self.related)
        fields.update(self.extra)

        # فیلدهای پویا فقط برای items و فقط با warehouse_id مشخص
        if self.key == 'items' and warehouse_id:
            fields.update(_dynamic_item_fields(warehouse_id))

        # اعمال پرچم حساس روی related/extra/dynamic هم (کلیدهای مشترک)
        out = {}
        for k, fd in fields.items():
            if k in sensitive_keys and not fd.sensitive:
                fd = FieldDef(
                    key=fd.key, source=fd.source, label=fd.label, type=fd.type,
                    choices=fd.choices, sensitive=True, groupable=fd.groupable,
                    aggregatable=fd.aggregatable, annotation=fd.annotation,
                )
            out[k] = fd
        return out

    def allowed_fields(self, user, warehouse_id=None):
        """فیلدهای مجاز برای این کاربر — حساس‌ها برای غیرمجازها حذف می‌شوند."""
        fields = self.get_fields(warehouse_id)
        if user.is_superuser or any(
            user.has_perm(f'accounts.{p}') for p in SENSITIVE_BYPASS_PERMS
        ):
            return fields
        return {k: fd for k, fd in fields.items() if not fd.sensitive}


def _dynamic_item_fields(warehouse_id):
    """فیلدهای پویای Item (ذخیره در JSONB dynamic_data) به‌صورت annotation."""
    from inventory.models import ItemFieldDefinition

    out = {}
    for d in ItemFieldDefinition.objects.filter(warehouse_id=warehouse_id, is_active=True):
        key = f'dyn__{d.name}'
        name = d.name

        if d.field_type == 'number':
            def factory(n=name, base_prefix=None):
                target_field = f'{base_prefix}__dynamic_data' if base_prefix else 'dynamic_data'
                return Cast(
                    KeyTextTransform(n, target_field),
                    DecimalField(max_digits=20, decimal_places=4),
                )
            ftype, aggregatable = 'number', True
        elif d.field_type == 'date':
            def factory(n=name, base_prefix=None):
                target_field = f'{base_prefix}__dynamic_data' if base_prefix else 'dynamic_data'
                return Cast(KeyTextTransform(n, target_field), DateField())
            ftype, aggregatable = 'date', False
        elif d.field_type == 'boolean':
            def factory(n=name, base_prefix=None):
                target_field = f'{base_prefix}__dynamic_data' if base_prefix else 'dynamic_data'
                return KeyTextTransform(n, target_field)
            # مقدار bool در JSON به‌صورت متن 'true'/'false' استخراج می‌شود
            ftype, aggregatable = 'text', False
        else:
            def factory(n=name, base_prefix=None):
                target_field = f'{base_prefix}__dynamic_data' if base_prefix else 'dynamic_data'
                return KeyTextTransform(n, target_field)
            ftype, aggregatable = 'text', False

        out[key] = FieldDef(
            key=key, source=key, label=d.label, type=ftype,
            aggregatable=aggregatable, annotation=factory,
        )
    return out


def _build_registry():
    from accounts.models import CustomUser
    from inventory.models import (
        CountTask, CountTaskHistory, DocTask, DocTaskHistory, Item,
    )
    from warehouses.models import Warehouse

    sync_exclude = ('sync_id', 'is_deleted')

    def fk_text(key, label, groupable=True):
        return FieldDef(key=key, source=key, label=label, type='text', groupable=groupable)

    entities = [
        EntityConfig(
            key='items', label='کالاها', model=Item,
            permissions=('view_wh_docs', 'view_sys_export'),
            warehouse_path='warehouse_id',
            exclude=sync_exclude + ('dynamic_data',),
            related={
                'warehouse__name': fk_text('warehouse__name', 'نام انبار'),
                'warehouse__project_name': fk_text('warehouse__project_name', 'نام پروژه'),
                'created_by__username': fk_text('created_by__username', 'نام کاربری سازنده'),
            },
            select_related=('warehouse', 'created_by'),
            blind_sensitive=('inventory', 'bal4miv'),
        ),
        EntityConfig(
            key='count_tasks', label='وظایف شمارش', model=CountTask,
            permissions=('view_sys_supervisor', 'view_sys_manager_review', 'view_sys_recounts'),
            warehouse_path='item__warehouse_id',
            exclude=sync_exclude,
            related={
                'item__fa_unic_code': fk_text('item__fa_unic_code', 'کد یکتای کالا'),
                'item__description': fk_text('item__description', 'شرح کالا'),
                'item__unit': fk_text('item__unit', 'واحد سنجش'),
                'item__warehouse__name': fk_text('item__warehouse__name', 'نام انبار'),
                'item__inventory': FieldDef(
                    key='item__inventory', source='item__inventory', label='موجودی فیزیکی کالا',
                    type='number', aggregatable=True, sensitive=False,
                ),
            },
            extra={
                'counter_name': FieldDef(
                    key='counter_name', source='counter_name', label='نام شمارشگر',
                    type='text', annotation=_person_name_annotation('counter'),
                ),
                'supervisor_name': FieldDef(
                    key='supervisor_name', source='supervisor_name', label='نام سرپرست',
                    type='text', annotation=_person_name_annotation('supervisor'),
                ),
            },
            select_related=('item', 'counter', 'supervisor'),
            blind_sensitive=('counted_balance', 'item__inventory'),
        ),
        EntityConfig(
            key='count_task_history', label='تاریخچه شمارش', model=CountTaskHistory,
            permissions=('view_sys_supervisor', 'view_sys_manager_review', 'view_sys_recounts'),
            warehouse_path='task__item__warehouse_id',
            exclude=sync_exclude,
            related={
                'task__item__fa_unic_code': fk_text('task__item__fa_unic_code', 'کد یکتای کالا'),
                'action_by__username': fk_text('action_by__username', 'نام کاربری اقدام‌کننده'),
            },
            select_related=('task', 'action_by'),
            blind_sensitive=('counted_balance',),
        ),
        EntityConfig(
            key='doc_tasks', label='وظایف مدارک', model=DocTask,
            permissions=('view_wh_doc_approvals', 'view_wh_customs'),
            warehouse_path='item__warehouse_id',
            related={
                'item__fa_unic_code': fk_text('item__fa_unic_code', 'کد یکتای کالا'),
                'item__description': fk_text('item__description', 'شرح کالا'),
                'item__warehouse__name': fk_text('item__warehouse__name', 'نام انبار'),
            },
            extra={
                'doc_worker_name': FieldDef(
                    key='doc_worker_name', source='doc_worker_name', label='نام بررسی‌کننده',
                    type='text', annotation=_person_name_annotation('doc_worker'),
                ),
            },
            select_related=('item', 'doc_worker'),
        ),
        EntityConfig(
            key='doc_task_history', label='تاریخچه مدارک', model=DocTaskHistory,
            permissions=('view_wh_doc_approvals', 'view_wh_customs'),
            warehouse_path='task__item__warehouse_id',
            related={
                'task__item__fa_unic_code': fk_text('task__item__fa_unic_code', 'کد یکتای کالا'),
                'action_by__username': fk_text('action_by__username', 'نام کاربری انجام‌دهنده'),
            },
            select_related=('task', 'action_by'),
        ),
        EntityConfig(
            key='warehouses', label='انبارها', model=Warehouse,
            permissions=('view_sys_projects',),
            warehouse_path='id',
            related={
                'manager__username': fk_text('manager__username', 'نام کاربری مدیر'),
                'parent_warehouse__name': fk_text('parent_warehouse__name', 'انبار والد'),
            },
            select_related=('manager', 'parent_warehouse'),
        ),
        EntityConfig(
            key='users', label='کاربران', model=CustomUser,
            permissions=('view_sys_users',),
            warehouse_path=None,
            # فقط include-list صریح — هرگز فیلدهای احراز هویت expose نمی‌شوند
            include=('id', 'username', 'first_name', 'last_name', 'phone_number',
                     'operational_zone', 'is_active', 'date_joined'),
            extra={
                # M2M مستقیم ممنوع است (ضرب دکارتی)؛ فقط شمارنده امن با distinct
                'assigned_warehouses_count': FieldDef(
                    key='assigned_warehouses_count', source='assigned_warehouses_count',
                    label='تعداد انبارهای تخصیص‌یافته', type='number',
                    groupable=False, aggregatable=False,
                    annotation=lambda base_prefix=None: Count(
                        f'{base_prefix}__assigned_warehouses' if base_prefix else 'assigned_warehouses',
                        distinct=True,
                    ),
                ),
            },
        ),
    ]
    return {e.key: e for e in entities}


_REGISTRY = None


def get_registry():
    global _REGISTRY
    if _REGISTRY is None:
        _REGISTRY = _build_registry()
    return _REGISTRY
