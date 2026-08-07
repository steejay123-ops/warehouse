"""
تست‌های گزارش‌ساز — تمرکز روی مرزهای امنیتی و صحت موتور کوئری.
اجرا: python manage.py test reports
"""
import io
from decimal import Decimal
from unittest.mock import patch

import openpyxl
from django.contrib.auth.models import Permission
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import CustomUser
from inventory.models import Item, ItemFieldDefinition
from warehouses.models import SystemSetting, Warehouse

from .engine import ReportEngine, ReportError
from .excel import _run_export_job, cleanup_old_jobs, start_export_job
from .models import ExportWorkerStatus, ReportExportJob, ReportTemplate


def _perm(codename):
    return Permission.objects.get(codename=codename, content_type__app_label='accounts')


def make_user(username, perms=(), superuser=False, warehouses=()):
    u = CustomUser.objects.create_user(username=username, password='x', is_superuser=superuser)
    for c in perms:
        u.user_permissions.add(_perm(c))
    for w in warehouses:
        u.assigned_warehouses.add(w)
    # کش مجوزهای جنگو را دور بزن
    return CustomUser.objects.get(pk=u.pk)


class BaseReportTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.wh1 = Warehouse.objects.create(name='انبار ۱', project_name='پروژه الف')
        cls.wh2 = Warehouse.objects.create(name='انبار ۲')

        # شمارش کور را برای این تست‌ها خاموش کن (پیش‌فرض سیستم blind است)
        SystemSetting.objects.create(key='blind_counting', value='normal', warehouse=None)

        cls.i1 = Item.objects.create(
            warehouse=cls.wh1, fa_unic_code='FA-001', description='پیچ فولادی',
            vendor='زیمنس', inventory=Decimal('10'), dynamic_data={'coating': '5.5'},
        )
        cls.i2 = Item.objects.create(
            warehouse=cls.wh1, fa_unic_code='FA-002', description='مهره',
            vendor='ABB', inventory=Decimal('4'), dynamic_data={'coating': '2'},
        )
        cls.i3 = Item.objects.create(
            warehouse=cls.wh2, fa_unic_code='FA-003', description='واشر',
            vendor='زیمنس', inventory=Decimal('7'), dynamic_data={},
        )
        ItemFieldDefinition.objects.create(
            warehouse=cls.wh1, name='coating', label='پوشش', field_type='number',
        )

        cls.admin = make_user('admin', superuser=True)
        cls.viewer = make_user(
            'viewer', perms=('view_sys_reports', 'view_wh_docs'), warehouses=(cls.wh1,),
        )
        cls.no_access = make_user('noaccess', perms=('view_sys_reports',))


class EngineSecurityTests(BaseReportTest):
    def test_unknown_entity_rejected(self):
        with self.assertRaises(ReportError):
            ReportEngine(self.admin, {'entity': 'nope'})

    def test_entity_permission_403(self):
        with self.assertRaises(ReportError) as ctx:
            ReportEngine(self.no_access, {'entity': 'items'})
        self.assertEqual(ctx.exception.status, 403)

    def test_unknown_field_rejected(self):
        eng = ReportEngine(self.admin, {'entity': 'items', 'fields': ['warehouse__manager__password']})
        with self.assertRaises(ReportError):
            eng.build()

    def test_raw_orm_path_in_filter_rejected(self):
        eng = ReportEngine(self.admin, {
            'entity': 'items', 'fields': ['fa_unic_code'],
            'filters': {'field': 'created_by__password', 'operator': 'icontains', 'value': 'x'},
        })
        with self.assertRaises(ReportError):
            eng.build()

    def test_warehouse_scope_enforced(self):
        # کاربر فقط انبار ۱ را دارد — ردیف انبار ۲ هرگز نمی‌آید
        res = ReportEngine(self.viewer, {'entity': 'items', 'fields': ['fa_unic_code']}).run()
        codes = {r['fa_unic_code'] for r in res['rows']}
        self.assertEqual(codes, {'FA-001', 'FA-002'})

    def test_foreign_warehouse_id_403(self):
        with self.assertRaises(ReportError) as ctx:
            ReportEngine(self.viewer, {
                'entity': 'items', 'warehouse_id': self.wh2.id, 'fields': ['fa_unic_code'],
            })
        self.assertEqual(ctx.exception.status, 403)

    def test_bad_warehouse_id_400(self):
        with self.assertRaises(ReportError) as ctx:
            ReportEngine(self.admin, {'entity': 'items', 'warehouse_id': 'abc'})
        self.assertEqual(ctx.exception.status, 400)

    def test_sensitive_field_hidden_without_bypass(self):
        SystemSetting.objects.create(
            key='SENSITIVE_EXCEL_FIELDS', value=['inventory'], warehouse=None,
        )
        eng = ReportEngine(self.viewer, {'entity': 'items', 'fields': ['inventory']})
        with self.assertRaises(ReportError):
            eng.build()
        # superuser می‌بیند
        res = ReportEngine(self.admin, {'entity': 'items', 'fields': ['inventory']}).run()
        self.assertEqual(res['count'], 3)

    def test_blind_counting_hides_balance(self):
        SystemSetting.objects.filter(key='blind_counting').update(value='blind')
        eng = ReportEngine(self.viewer, {'entity': 'items', 'fields': ['inventory']})
        with self.assertRaises(ReportError):
            eng.build()


class EngineQueryTests(BaseReportTest):
    def test_and_or_filter_tree(self):
        spec = {
            'entity': 'items', 'fields': ['fa_unic_code'],
            'filters': {'op': 'AND', 'children': [
                {'field': 'inventory', 'operator': 'gte', 'value': 5},
                {'op': 'OR', 'children': [
                    {'field': 'vendor', 'operator': 'icontains', 'value': 'زیمنس'},
                    {'field': 'description', 'operator': 'icontains', 'value': 'مهره'},
                ]},
            ]},
        }
        res = ReportEngine(self.admin, spec).run()
        codes = {r['fa_unic_code'] for r in res['rows']}
        self.assertEqual(codes, {'FA-001', 'FA-003'})

    def test_invalid_coercion_400_not_500(self):
        spec = {
            'entity': 'items', 'fields': ['fa_unic_code'],
            'filters': {'field': 'inventory', 'operator': 'gte', 'value': 'متن'},
        }
        with self.assertRaises(ReportError):
            ReportEngine(self.admin, spec).build()

    def test_invalid_operator_for_type(self):
        spec = {
            'entity': 'items', 'fields': ['fa_unic_code'],
            'filters': {'field': 'inventory', 'operator': 'icontains', 'value': '1'},
        }
        with self.assertRaises(ReportError):
            ReportEngine(self.admin, spec).build()

    def test_group_by_with_sum(self):
        spec = {
            'entity': 'items',
            'group_by': ['warehouse__name'],
            'aggregations': [{'field': 'inventory', 'fn': 'sum', 'alias': 'total_balance'}],
            'sort': [{'field': 'total_balance', 'dir': 'desc'}],
        }
        res = ReportEngine(self.admin, spec).run()
        self.assertEqual(res['count'], 2)
        first = res['rows'][0]
        self.assertEqual(first['warehouse__name'], 'انبار ۱')
        self.assertEqual(Decimal(first['total_balance']), Decimal('14'))

    def test_dynamic_jsonb_filter_and_sum(self):
        spec = {
            'entity': 'items', 'warehouse_id': self.wh1.id,
            'group_by': ['warehouse__name'],
            'aggregations': [{'field': 'dyn__coating', 'fn': 'sum', 'alias': 'sum_coating'}],
            'filters': {'field': 'dyn__coating', 'operator': 'gte', 'value': 1},
        }
        res = ReportEngine(self.admin, spec).run()
        self.assertEqual(res['count'], 1)
        self.assertEqual(Decimal(res['rows'][0]['sum_coating']), Decimal('7.5'))

    def test_dynamic_field_requires_warehouse(self):
        eng = ReportEngine(self.admin, {'entity': 'items', 'fields': ['dyn__coating']})
        with self.assertRaises(ReportError):
            eng.build()

    def test_alias_validation(self):
        spec = {
            'entity': 'items', 'group_by': ['warehouse__name'],
            'aggregations': [{'field': 'inventory', 'fn': 'sum', 'alias': 'DROP TABLE'}],
        }
        with self.assertRaises(ReportError):
            ReportEngine(self.admin, spec).build()

    def test_sort_only_on_selected(self):
        spec = {
            'entity': 'items', 'fields': ['fa_unic_code'],
            'sort': [{'field': 'inventory', 'dir': 'desc'}],
        }
        with self.assertRaises(ReportError):
            ReportEngine(self.admin, spec).build()

    def test_not_on_leaf(self):
        spec = {
            'entity': 'items', 'fields': ['fa_unic_code'],
            'filters': {'field': 'vendor', 'operator': 'icontains',
                        'value': 'زیمنس', 'not': True},
        }
        res = ReportEngine(self.admin, spec).run()
        codes = {r['fa_unic_code'] for r in res['rows']}
        self.assertEqual(codes, {'FA-002'})

    def test_not_on_group(self):
        # NOT(vendor~زیمنس OR balance>=7) → فقط FA-002 (ABB، balance=4)
        spec = {
            'entity': 'items', 'fields': ['fa_unic_code'],
            'filters': {'op': 'OR', 'not': True, 'children': [
                {'field': 'vendor', 'operator': 'icontains', 'value': 'زیمنس'},
                {'field': 'inventory', 'operator': 'gte', 'value': 7},
            ]},
        }
        res = ReportEngine(self.admin, spec).run()
        codes = {r['fa_unic_code'] for r in res['rows']}
        self.assertEqual(codes, {'FA-002'})

    def test_having_basic(self):
        spec = {
            'entity': 'items',
            'group_by': ['warehouse__name'],
            'aggregations': [{'field': 'inventory', 'fn': 'sum', 'alias': 'total_balance'}],
            'having': [{'alias': 'total_balance', 'operator': 'gte', 'value': 10}],
        }
        res = ReportEngine(self.admin, spec).run()
        self.assertEqual(res['count'], 1)
        row = res['rows'][0]
        self.assertEqual(row['warehouse__name'], 'انبار ۱')
        self.assertEqual(Decimal(row['total_balance']), Decimal('14'))

    def test_having_between(self):
        spec = {
            'entity': 'items',
            'group_by': ['warehouse__name'],
            'aggregations': [{'field': 'inventory', 'fn': 'sum', 'alias': 'total_balance'}],
            'having': [{'alias': 'total_balance', 'operator': 'between', 'value': [5, 10]}],
        }
        res = ReportEngine(self.admin, spec).run()
        self.assertEqual(res['count'], 1)
        self.assertEqual(res['rows'][0]['warehouse__name'], 'انبار ۲')

    def test_having_unknown_alias_400(self):
        spec = {
            'entity': 'items',
            'group_by': ['warehouse__name'],
            'aggregations': [{'field': 'inventory', 'fn': 'sum', 'alias': 'total_balance'}],
            'having': [{'alias': 'inventory', 'operator': 'gte', 'value': 1}],
        }
        with self.assertRaises(ReportError) as ctx:
            ReportEngine(self.admin, spec).build()
        self.assertEqual(ctx.exception.status, 400)

    def test_having_without_group_by_400(self):
        spec = {
            'entity': 'items', 'fields': ['fa_unic_code'],
            'having': [{'alias': 'x', 'operator': 'gte', 'value': 1}],
        }
        with self.assertRaises(ReportError) as ctx:
            ReportEngine(self.admin, spec).build()
        self.assertEqual(ctx.exception.status, 400)

    def test_having_non_numeric_value_400(self):
        spec = {
            'entity': 'items',
            'group_by': ['warehouse__name'],
            'aggregations': [{'field': 'inventory', 'fn': 'sum', 'alias': 'total_balance'}],
            'having': [{'alias': 'total_balance', 'operator': 'gte', 'value': 'متن'}],
        }
        with self.assertRaises(ReportError) as ctx:
            ReportEngine(self.admin, spec).build()
        self.assertEqual(ctx.exception.status, 400)
        self.assertIn('HAVING', ctx.exception.message)

    def test_users_m2m_count_no_cartesian(self):
        res = ReportEngine(self.admin, {
            'entity': 'users', 'fields': ['username', 'assigned_warehouses_count'],
        }).run()
        by_name = {r['username']: r for r in res['rows']}
        self.assertEqual(by_name['viewer']['assigned_warehouses_count'], 1)
        # هر کاربر دقیقاً یک ردیف — تکثیر دکارتی رخ نداده
        self.assertEqual(res['count'], CustomUser.objects.count())


class ApiTests(BaseReportTest):
    def setUp(self):
        self.client = APIClient()

    def test_entities_filtered_by_permission(self):
        self.client.force_authenticate(self.viewer)
        r = self.client.get('/api/reports/entities/')
        self.assertEqual(r.status_code, 200)
        keys = {e['key'] for e in r.json()}
        self.assertIn('items', keys)
        self.assertNotIn('users', keys)

    def test_reports_menu_gate(self):
        u = make_user('nomenu', perms=('view_wh_docs',))
        self.client.force_authenticate(u)
        r = self.client.get('/api/reports/entities/')
        self.assertEqual(r.status_code, 403)

    def test_run_endpoint(self):
        self.client.force_authenticate(self.viewer)
        r = self.client.post('/api/reports/run/', {
            'entity': 'items', 'fields': ['fa_unic_code', 'description'],
        }, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()['count'], 2)

    def test_run_bad_field_400(self):
        self.client.force_authenticate(self.viewer)
        r = self.client.post('/api/reports/run/', {
            'entity': 'items', 'fields': ['warehouse__manager__password'],
        }, format='json')
        self.assertEqual(r.status_code, 400)

    def test_export_requires_export_perm(self):
        self.client.force_authenticate(self.viewer)  # view_sys_export ندارد
        r = self.client.post('/api/reports/export/', {
            'entity': 'items', 'fields': ['fa_unic_code'],
        }, format='json')
        self.assertEqual(r.status_code, 403)

    def test_export_sync_small(self):
        self.client.force_authenticate(self.admin)
        r = self.client.post('/api/reports/export/', {
            'entity': 'items', 'fields': ['fa_unic_code'],
        }, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertIn('spreadsheetml', r['Content-Type'])

    def test_template_visibility(self):
        other = make_user('other', perms=('view_sys_reports',))
        ReportTemplate.objects.create(
            name='خصوصی', entity='items', owner=self.viewer, spec={'entity': 'items'},
        )
        pub = ReportTemplate.objects.create(
            name='عمومی', entity='items', owner=self.viewer, spec={'entity': 'items'},
            is_public=True,
        )
        self.client.force_authenticate(other)
        r = self.client.get('/api/reports/templates/')
        names = {t['name'] for t in r.json()}
        self.assertEqual(names, {'عمومی'})
        # غیرمالک نمی‌تواند قالب عمومی را ویرایش/حذف کند
        r = self.client.patch(f'/api/reports/templates/{pub.id}/', {'name': 'x'}, format='json')
        self.assertEqual(r.status_code, 403)
        r = self.client.delete(f'/api/reports/templates/{pub.id}/')
        self.assertEqual(r.status_code, 403)

    def test_template_create_sets_owner(self):
        self.client.force_authenticate(self.viewer)
        r = self.client.post('/api/reports/templates/', {
            'name': 'گزارشم', 'entity': 'items', 'spec': {'entity': 'items'},
        }, format='json')
        self.assertEqual(r.status_code, 201)
        self.assertEqual(ReportTemplate.objects.get(pk=r.json()['id']).owner, self.viewer)

    def test_run_with_not_and_having(self):
        self.client.force_authenticate(self.admin)
        r = self.client.post('/api/reports/run/', {
            'entity': 'items',
            'group_by': ['warehouse__name'],
            'aggregations': [{'field': 'inventory', 'fn': 'sum', 'alias': 'total_balance'}],
            'filters': {'field': 'vendor', 'operator': 'icontains',
                        'value': 'ABB', 'not': True},
            'having': [{'alias': 'total_balance', 'operator': 'gte', 'value': 8}],
        }, format='json')
        self.assertEqual(r.status_code, 200)
        body = r.json()
        # بدون ABB: انبار ۱ جمع ۱۰، انبار ۲ جمع ۷ → having>=8 فقط انبار ۱
        self.assertEqual(body['count'], 1)
        self.assertEqual(body['rows'][0]['warehouse__name'], 'انبار ۱')

    def test_template_bad_entity_rejected(self):
        self.client.force_authenticate(self.viewer)
        r = self.client.post('/api/reports/templates/', {
            'name': 'بد', 'entity': 'nope', 'spec': {},
        }, format='json')
        self.assertEqual(r.status_code, 400)


class ExcelStyleTests(BaseReportTest):
    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def test_sync_excel_styled_and_openable(self):
        r = self.client.post('/api/reports/export/', {
            'entity': 'items', 'fields': ['fa_unic_code', 'inventory'],
            'report_name': 'گزارش تست',
        }, format='json')
        self.assertEqual(r.status_code, 200)

        ws = openpyxl.load_workbook(io.BytesIO(r.content))['Report']
        # ردیف ۱ عنوان، ردیف ۲ برچسب (بولد روی fill سرمه‌ای)، ردیف ۳ کلید، داده از ۴
        self.assertTrue(str(ws['A1'].value).startswith('گزارش تست'))
        self.assertTrue(ws['A2'].font.bold)
        self.assertIn('4F46E5', str(ws['A2'].fill.fgColor.rgb))
        self.assertEqual(ws['A3'].value, 'fa_unic_code')
        self.assertEqual(ws.max_row, 3 + 3)  # ۳ ردیف سربرگ + ۳ آیتم
        # فرمت هزارگان روی ستون عددی balance
        self.assertEqual(ws['B4'].number_format, '#,##0.###')
        # زبرا روی ردیف دوم داده
        self.assertIn('F1F5F9', str(ws['A5'].fill.fgColor.rgb))
        # فریز و فیلتر (در write_only فقط از راه Pane/auto_filter.ref ممکن است)
        self.assertEqual(ws.freeze_panes, 'A4')
        self.assertEqual(ws.auto_filter.ref, 'A3:B6')
        self.assertTrue(ws.sheet_view.rightToLeft)


class PdfExportTests(BaseReportTest):
    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def _spec(self, **extra):
        return {'entity': 'items', 'fields': ['fa_unic_code', 'vendor'],
                'format': 'pdf', 'report_name': 'گزارش اقلام', **extra}

    def test_pdf_returned(self):
        r = self.client.post('/api/reports/export/', self._spec(), format='json')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r['Content-Type'], 'application/pdf')
        self.assertTrue(r.content.startswith(b'%PDF'))

    def test_pdf_row_limit_persian_error(self):
        with patch('reports.pdf.PDF_ROW_LIMIT', 2):
            r = self.client.post('/api/reports/export/', self._spec(), format='json')
        self.assertEqual(r.status_code, 400)
        self.assertIn('Excel', r.json()['error'])

    def test_pdf_column_limit(self):
        with patch('reports.pdf.PDF_MAX_COLUMNS', 1):
            r = self.client.post('/api/reports/export/', self._spec(), format='json')
        self.assertEqual(r.status_code, 400)
        self.assertIn('ستون', r.json()['error'])

    def test_pdf_grouped_report(self):
        spec = {
            'entity': 'items', 'format': 'pdf', 'report_name': 'گروهی',
            'group_by': ['warehouse__name'],
            'aggregations': [{'field': 'inventory', 'fn': 'sum', 'alias': 'total'}],
        }
        r = self.client.post('/api/reports/export/', spec, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.content.startswith(b'%PDF'))


class ExportWorkerTests(BaseReportTest):
    SPEC = {'entity': 'items', 'fields': ['fa_unic_code']}

    def test_run_export_job_done_with_heartbeat(self):
        job = ReportExportJob.objects.create(
            owner=self.admin, spec=self.SPEC, report_name='r',
            status='pending', total_rows=3,
        )
        _run_export_job(job.pk, self.admin.pk)
        job.refresh_from_db()
        self.assertEqual(job.status, 'done')
        self.assertEqual(job.progress, 100)
        self.assertIsNotNone(job.heartbeat_at)
        p = job.absolute_file_path
        self.assertTrue(p.exists())
        p.unlink()

    def test_job_queued_when_worker_alive(self):
        ExportWorkerStatus.objects.create(pk=1, alive_at=timezone.now())
        job = start_export_job(self.admin, self.SPEC, 'r', 20_000)
        job.refresh_from_db()
        # worker زنده → thread ساخته نمی‌شود؛ job در صف می‌ماند تا worker بردارد
        self.assertEqual(job.status, 'pending')

    def test_orphan_recovery_by_heartbeat_not_age(self):
        from .management.commands.run_export_worker import Command
        old = timezone.now() - timezone.timedelta(minutes=10)
        dead = ReportExportJob.objects.create(
            owner=self.admin, spec=self.SPEC, status='running', heartbeat_at=old,
        )
        alive = ReportExportJob.objects.create(
            owner=self.admin, spec=self.SPEC, status='running',
            heartbeat_at=timezone.now(),
        )
        # job بزرگ زنده (نبض تازه) نباید یتیم فرض شود حتی اگر قدیمی شروع شده باشد
        ReportExportJob.objects.filter(pk=alive.pk).update(
            created_at=timezone.now() - timezone.timedelta(hours=2),
        )
        import io
        Command(stdout=io.StringIO())._recover_orphans()
        dead.refresh_from_db()
        alive.refresh_from_db()
        self.assertEqual(dead.status, 'pending')
        self.assertEqual(alive.status, 'running')

    def test_cleanup_respects_live_queue(self):
        ExportWorkerStatus.objects.create(pk=1, alive_at=timezone.now())
        stale_running = ReportExportJob.objects.create(
            owner=self.admin, spec=self.SPEC, status='running',
            heartbeat_at=timezone.now() - timezone.timedelta(hours=2),
        )
        queued = ReportExportJob.objects.create(
            owner=self.admin, spec=self.SPEC, status='pending',
        )
        ReportExportJob.objects.filter(pk=queued.pk).update(
            created_at=timezone.now() - timezone.timedelta(hours=2),
        )
        cleanup_old_jobs()
        stale_running.refresh_from_db()
        queued.refresh_from_db()
        self.assertEqual(stale_running.status, 'failed')
        # با worker زنده، صف pending سالم است و failed نمی‌شود
        self.assertEqual(queued.status, 'pending')
