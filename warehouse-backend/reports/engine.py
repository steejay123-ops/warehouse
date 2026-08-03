"""
موتور کوئری گزارش‌ساز — تبدیل spec (JSON) به QuerySet امن

خط لوله:
  ۱. موجودیت + مجوز per-entity
  ۲. محدودسازی به انبارهای تخصیص‌یافته کاربر
  ۳. سد whitelist: هر کلید spec باید در رجیستری مجاز باشد
  ۴. annotationها (فیلد پویا/محاسباتی)
  ۵. درخت فیلتر AND/OR ← Q (با coercion امن هر برگ)
  ۶. گروه‌بندی/تجمیع با values()/annotate()
  ۷. مرتب‌سازی + صفحه‌بندی
هر خطای کاربری با ReportError (پیام فارسی + status) بالا می‌آید — هرگز 500.
"""
import re
from decimal import Decimal, InvalidOperation

from django.db import DataError, OperationalError, transaction, connection
from django.db.models import Avg, Count, Max, Min, Q, Sum
from django.utils.dateparse import parse_date, parse_datetime

from .registry import AGG_FUNCTIONS, get_registry

MAX_FILTER_DEPTH = 5
MAX_FILTER_CONDITIONS = 60
MAX_HAVING_CONDITIONS = 10
MAX_PAGE_SIZE = 200

HAVING_OPERATORS = ('eq', 'gt', 'gte', 'lt', 'lte', 'between')
STATEMENT_TIMEOUT_MS = 15000  # فیوز ایمنی کوئری‌های run

ALIAS_RE = re.compile(r'^[a-z_][a-z0-9_]{0,40}$')

AGG_MAP = {'count': Count, 'sum': Sum, 'avg': Avg, 'min': Min, 'max': Max}

OPERATOR_LOOKUPS = {
    'eq': '',           # exact (برای datetime → __date)
    'icontains': '__icontains',
    'istartswith': '__istartswith',
    'in': '__in',
    'isnull': '__isnull',
    'gt': '__gt',
    'gte': '__gte',
    'lt': '__lt',
    'lte': '__lte',
    # between جداگانه هندل می‌شود (جفت gte/lte)
}


class ReportError(Exception):
    """خطای قابل نمایش به کاربر."""

    def __init__(self, message, status=400):
        super().__init__(message)
        self.message = message
        self.status = status


class ReportEngine:
    def __init__(self, user, spec):
        self.user = user
        self.spec = spec if isinstance(spec, dict) else {}
        self._condition_count = 0

        entity_key = self.spec.get('entity')
        registry = get_registry()
        if entity_key not in registry:
            raise ReportError(f'موجودیت نامعتبر: {entity_key}')
        self.config = registry[entity_key]

        if not self.config.user_has_access(user):
            raise ReportError('شما به این موجودیت دسترسی ندارید.', status=403)

        self.warehouse_id = self.spec.get('warehouse_id') or None
        if self.warehouse_id is not None:
            try:
                self.warehouse_id = int(self.warehouse_id)
            except (ValueError, TypeError):
                raise ReportError('شناسه انبار نامعتبر است.')
        self._check_warehouse_access()
        self.fields = self.config.allowed_fields(user, self.warehouse_id)

    # ------------------------------------------------------------------ scope
    def _check_warehouse_access(self):
        if self.user.is_superuser:
            return
        assigned = list(self.user.assigned_warehouses.values_list('id', flat=True))
        self._assigned_ids = assigned
        if self.warehouse_id and assigned and int(self.warehouse_id) not in assigned:
            raise ReportError('به این انبار دسترسی ندارید.', status=403)

    def _scope_queryset(self, qs):
        path = self.config.warehouse_path
        if not path:
            return qs
        if not self.user.is_superuser:
            assigned = getattr(self, '_assigned_ids', None) or []
            if assigned:
                qs = qs.filter(**{f'{path}__in': assigned})
        if self.warehouse_id:
            qs = qs.filter(**{path: self.warehouse_id})
        return qs

    # ------------------------------------------------------------- validation
    def _field(self, key, usage='فیلد'):
        fd = self.fields.get(key)
        if fd is None:
            raise ReportError(f'{usage} نامعتبر یا غیرمجاز: {key}')
        return fd

    def _coerce(self, fd, value):
        """تبدیل امن مقدار فیلتر به نوع فیلد — خطا ← 400 با نام فارسی فیلد."""
        try:
            if fd.type == 'number':
                if isinstance(value, bool):
                    raise ValueError
                return Decimal(str(value))
            if fd.type == 'date':
                d = parse_date(str(value))
                if d is None:
                    raise ValueError
                return d
            if fd.type == 'datetime':
                dt = parse_datetime(str(value)) or parse_date(str(value))
                if dt is None:
                    raise ValueError
                return dt
            if fd.type == 'boolean':
                if isinstance(value, bool):
                    return value
                if str(value).lower() in ('true', '1'):
                    return True
                if str(value).lower() in ('false', '0'):
                    return False
                raise ValueError
            if fd.type == 'choice':
                v = str(value)
                if fd.choices and v not in fd.choices:
                    raise ValueError
                return v
            return str(value)
        except (ValueError, TypeError, InvalidOperation):
            raise ReportError(f'مقدار نامعتبر برای فیلد «{fd.label}»: {value!r}')

    # ---------------------------------------------------------------- filters
    def _build_q(self, node, depth=0):
        """ساخت Q یک گره + اعمال فلگ اختیاری not (نقیض) روی گروه یا برگ."""
        q = self._build_node_q(node, depth)
        if node.get('not'):
            q = ~q
        return q

    def _build_node_q(self, node, depth=0):
        if not isinstance(node, dict):
            raise ReportError('ساختار فیلتر نامعتبر است.')
        if depth > MAX_FILTER_DEPTH:
            raise ReportError(f'عمق درخت فیلتر بیش از حد مجاز ({MAX_FILTER_DEPTH}) است.')

        # گروه AND/OR
        if 'op' in node:
            op = str(node.get('op', '')).upper()
            if op not in ('AND', 'OR'):
                raise ReportError(f'عملگر گروه نامعتبر: {op}')
            children = node.get('children') or []
            if not isinstance(children, list):
                raise ReportError('children باید لیست باشد.')
            q = Q()
            for child in children:
                cq = self._build_q(child, depth + 1)
                q = (q & cq) if op == 'AND' else (q | cq)
            return q

        # برگ شرط
        self._condition_count += 1
        if self._condition_count > MAX_FILTER_CONDITIONS:
            raise ReportError(f'تعداد شرط‌های فیلتر بیش از حد مجاز ({MAX_FILTER_CONDITIONS}) است.')

        fd = self._field(node.get('field'), usage='فیلد فیلتر')
        operator = node.get('operator')
        if operator not in fd.operators:
            raise ReportError(f'اپراتور «{operator}» برای فیلد «{fd.label}» مجاز نیست.')
        value = node.get('value')

        if operator == 'isnull':
            return Q(**{f'{fd.source}__isnull': bool(value)})
        if operator == 'between':
            if not isinstance(value, (list, tuple)) or len(value) != 2:
                raise ReportError(f'مقدار بازه برای «{fd.label}» باید دو عضو داشته باشد.')
            lo, hi = self._coerce(fd, value[0]), self._coerce(fd, value[1])
            return Q(**{f'{fd.source}__gte': lo, f'{fd.source}__lte': hi})
        if operator == 'in':
            if not isinstance(value, (list, tuple)) or not value:
                raise ReportError(f'مقدار لیستی برای «{fd.label}» نامعتبر است.')
            return Q(**{f'{fd.source}__in': [self._coerce(fd, v) for v in value]})

        coerced = self._coerce(fd, value)
        if operator == 'eq' and fd.type == 'datetime':
            return Q(**{f'{fd.source}__date': coerced})
        lookup = OPERATOR_LOOKUPS[operator]
        return Q(**{f'{fd.source}{lookup}': coerced})

    # ------------------------------------------------------------------ build
    def build(self):
        """ساخت queryset نهایی + توصیف ستون‌ها. خروجی: (queryset, columns)"""
        spec = self.spec
        field_keys = spec.get('fields') or []
        group_by = spec.get('group_by') or []
        aggregations = spec.get('aggregations') or []
        sort = spec.get('sort') or []

        if not isinstance(field_keys, list) or not isinstance(group_by, list) \
                or not isinstance(aggregations, list) or not isinstance(sort, list):
            raise ReportError('ساختار spec نامعتبر است.')

        grouped = bool(group_by)
        if not grouped and not field_keys:
            raise ReportError('حداقل یک فیلد انتخاب کنید.')
        if grouped and not aggregations:
            raise ReportError('برای گروه‌بندی حداقل یک تابع تجمیعی لازم است.')

        having = spec.get('having') or []
        if having and not isinstance(having, list):
            raise ReportError('ساختار HAVING نامعتبر است.')
        if having and not grouped:
            raise ReportError('شرط روی نتایج تجمیع (HAVING) فقط با گروه‌بندی معنا دارد.')
        if len(having) > MAX_HAVING_CONDITIONS:
            raise ReportError(f'تعداد شرط‌های HAVING بیش از حد مجاز ({MAX_HAVING_CONDITIONS}) است.')

        # اعتبارسنجی کلیدها
        for k in field_keys:
            self._field(k)
        group_defs = [self._field(k, usage='فیلد گروه‌بندی') for k in group_by]
        for gd in group_defs:
            if not gd.groupable:
                raise ReportError(f'فیلد «{gd.label}» قابل گروه‌بندی نیست.')

        agg_specs = []
        used_aliases = set()
        for agg in aggregations:
            if not isinstance(agg, dict):
                raise ReportError('ساختار تجمیع نامعتبر است.')
            fn = str(agg.get('fn', '')).lower()
            if fn not in AGG_FUNCTIONS:
                raise ReportError(f'تابع تجمیعی نامعتبر: {fn}')
            fd = self._field(agg.get('field'), usage='فیلد تجمیع')
            if fn != 'count' and not fd.aggregatable:
                raise ReportError(f'فیلد «{fd.label}» قابل جمع/میانگین نیست.')
            alias = agg.get('alias') or f'{fn}_{fd.key}'.replace('__', '_')
            if not ALIAS_RE.match(alias):
                raise ReportError(f'نام alias نامعتبر: {alias}')
            if alias in self.fields or alias in used_aliases:
                raise ReportError(f'alias تکراری یا رزروشده: {alias}')
            used_aliases.add(alias)
            agg_specs.append((alias, fn, fd))

        # کوئری پایه + scope
        qs = self._scope_queryset(self.config.base_queryset())

        # annotationهای موردنیاز (پویا/محاسباتی) — قبل از فیلتر/گروه/مرتب‌سازی
        referenced = set(field_keys) | set(group_by)
        referenced |= {fd.key for _, _, fd in agg_specs}
        referenced |= self._filter_field_keys(spec.get('filters'))
        referenced |= {s.get('field') for s in sort if isinstance(s, dict)}
        annotations = {}
        for k in referenced:
            fd = self.fields.get(k)
            if fd is not None and fd.annotation is not None:
                annotations[fd.key] = fd.annotation()
        if annotations:
            qs = qs.annotate(**annotations)

        # فیلترها
        filters = spec.get('filters')
        if filters:
            qs = qs.filter(self._build_q(filters))

        # گروه‌بندی/انتخاب ستون‌ها
        if grouped:
            group_sources = [gd.source for gd in group_defs]
            agg_exprs = {alias: AGG_MAP[fn](fd.source) for alias, fn, fd in agg_specs}
            qs = qs.values(*group_sources).annotate(**agg_exprs)
            # HAVING — فیلتر روی نتایج تجمیع (جنگو filter بعد از annotate را HAVING می‌کند)
            for h in having:
                if not isinstance(h, dict):
                    raise ReportError('ساختار شرط HAVING نامعتبر است.')
                alias = h.get('alias')
                if alias not in used_aliases:
                    raise ReportError(f'شرط HAVING فقط روی نتایج تجمیع همین گزارش مجاز است: {alias}')
                op = h.get('operator')
                if op not in HAVING_OPERATORS:
                    raise ReportError(f'اپراتور HAVING نامعتبر: {op}')
                value = h.get('value')
                if op == 'between':
                    if not isinstance(value, (list, tuple)) or len(value) != 2:
                        raise ReportError(f'مقدار بازه HAVING برای «{alias}» باید دو عضو داشته باشد.')
                    lo = self._having_value(alias, value[0])
                    hi = self._having_value(alias, value[1])
                    qs = qs.filter(**{f'{alias}__gte': lo, f'{alias}__lte': hi})
                else:
                    coerced = self._having_value(alias, value)
                    qs = qs.filter(**{f'{alias}{OPERATOR_LOOKUPS[op]}': coerced})
            columns = (
                [{'key': gd.key, 'label': gd.label, 'type': gd.type} for gd in group_defs]
                + [{'key': alias, 'label': self._agg_label(fn, fd), 'type': 'number'}
                   for alias, fn, fd in agg_specs]
            )
            sortable = {gd.key for gd in group_defs} | used_aliases
        else:
            sources = [self.fields[k].source for k in field_keys]
            qs = qs.values(*sources)
            columns = [
                {'key': k, 'label': self.fields[k].label, 'type': self.fields[k].type}
                for k in field_keys
            ]
            sortable = set(field_keys)

        # مرتب‌سازی
        order = []
        for s in sort:
            if not isinstance(s, dict):
                raise ReportError('ساختار مرتب‌سازی نامعتبر است.')
            key = s.get('field')
            if key not in sortable:
                raise ReportError(f'مرتب‌سازی فقط روی ستون‌های انتخاب‌شده مجاز است: {key}')
            direction = s.get('dir', 'asc')
            if direction not in ('asc', 'desc'):
                raise ReportError(f'جهت مرتب‌سازی نامعتبر: {direction}')
            source = self.fields[key].source if key in self.fields else key
            order.append(f'-{source}' if direction == 'desc' else source)
        if not grouped:
            order.append('pk')  # tiebreak پایدار برای صفحه‌بندی
        if order:
            qs = qs.order_by(*order)

        return qs, columns

    def _having_value(self, alias, value):
        """مقدار عددی شرط HAVING — نامعتبر ← 400 فارسی (نتایج تجمیع همیشه عددی‌اند)."""
        try:
            if isinstance(value, bool):
                raise ValueError
            return Decimal(str(value))
        except (ValueError, TypeError, InvalidOperation):
            raise ReportError(f'مقدار نامعتبر در شرط HAVING «{alias}»: {value!r}')

    def _filter_field_keys(self, node, depth=0):
        """کلیدهای فیلد استفاده‌شده در درخت فیلتر (برای annotation پیش‌نیاز)."""
        keys = set()
        if not isinstance(node, dict) or depth > MAX_FILTER_DEPTH:
            return keys
        if 'op' in node:
            for child in (node.get('children') or []):
                keys |= self._filter_field_keys(child, depth + 1)
        elif node.get('field'):
            keys.add(node['field'])
        return keys

    @staticmethod
    def _agg_label(fn, fd):
        fa = {'count': 'تعداد', 'sum': 'جمع', 'avg': 'میانگین',
              'min': 'کمینه', 'max': 'بیشینه'}[fn]
        return f'{fa} {fd.label}'

    # -------------------------------------------------------------------- run
    def run(self):
        qs, columns = self.build()

        page = self.spec.get('page') or 1
        page_size = self.spec.get('page_size') or 50
        try:
            page = max(1, int(page))
            page_size = min(MAX_PAGE_SIZE, max(1, int(page_size)))
        except (ValueError, TypeError):
            raise ReportError('صفحه‌بندی نامعتبر است.')

        offset = (page - 1) * page_size
        try:
            with transaction.atomic():
                with connection.cursor() as cur:
                    cur.execute(f"SET LOCAL statement_timeout = '{STATEMENT_TIMEOUT_MS}ms'")
                total = qs.count()
                rows = list(qs[offset:offset + page_size])
        except OperationalError:
            raise ReportError(
                'اجرای گزارش بیش از حد طول کشید؛ فیلتر دقیق‌تری بگذارید یا بازه را کوچک کنید.'
            )
        except DataError:
            raise ReportError(
                'داده نامعتبر در یکی از فیلدهای پویا (مثلاً متن در فیلد عددی). '
                'مقادیر آن فیلد را اصلاح کنید یا فیلترش را بردارید.'
            )

        rows = [_jsonable(r) for r in rows]
        return {
            'columns': columns,
            'count': total,
            'page': page,
            'page_size': page_size,
            'rows': rows,
        }

    # ----------------------------------------------------------------- export
    def export_queryset(self):
        """queryset بدون صفحه‌بندی برای خروجی Excel + ستون‌ها + تعداد کل."""
        qs, columns = self.build()
        try:
            total = qs.count()
        except DataError:
            raise ReportError('داده نامعتبر در یکی از فیلدهای پویا.')
        return qs, columns, total


def _jsonable(row):
    out = {}
    for k, v in row.items():
        if isinstance(v, Decimal):
            out[k] = str(v)
        elif hasattr(v, 'isoformat'):
            out[k] = v.isoformat()
        else:
            out[k] = v
    return out
