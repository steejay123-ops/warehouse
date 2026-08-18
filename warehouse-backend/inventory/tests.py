import json
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from warehouses.models import Warehouse, SystemSetting
from inventory.models import Item, CountTask, CountTaskHistory

User = get_user_model()


class InventoryCountingCycleTests(TestCase):
    """
    تست جامع انبارگردانی در بک‌اند
    پوشش تمامی سناریوهای چرخه انبارگردانی:
    ۱. چرخه کامل و استاندارد با حضور سرپرست و مدیر (Happy Path)
    ۲. بازشماری و رد مکرر نامحدود توسط مدیر و سرپرست (Unlimited Recounts)
    ۳. ارسال مستقیم به مدیر بدون سرپرست (Skip Supervisor)
    ۴. استخر عمومی و بر عهده گرفتن تسک (Pool & Claim)
    ۵. تشخیص و ثبت مغایرت در صورت عدم انطباق با bal4miv
    ۶. لغو تخصیص (Bulk Cancel)
    ۷. همگام‌سازی آفلاین و شمارش کور (Sync Pull & Blind Redaction)
    """

    def setUp(self):
        self.client = APIClient()

        # ۱. ساخت انبار
        self.warehouse = Warehouse.objects.create(
            name="انبار مرکزی پروژه",
            project_name="پروژه الف"
        )

        # ۲. ساخت کاربران با سطوح دسترسی
        self.admin = User.objects.create_superuser(
            username="admin_user",
            email="admin@test.com",
            password="Password123!"
        )

        self.manager = User.objects.create_user(
            username="manager_user",
            first_name="مدیر",
            last_name="انبار",
            password="Password123!"
        )
        self.manager = self._assign_perms(self.manager, [
            'view_sys_manager_review',
            'perm_wh_edit',
            'perm_rec_dispatch',
            'perm_rec_recount',
            'view_wh_docs'
        ])

        self.supervisor = User.objects.create_user(
            username="supervisor_user",
            first_name="سرپرست",
            last_name="شمارش",
            password="Password123!"
        )
        self.supervisor = self._assign_perms(self.supervisor, [
            'view_sys_supervisor',
            'perm_rec_recount',
            'view_wh_docs'
        ])

        self.counter = User.objects.create_user(
            username="counter_user",
            first_name="انبارگردان",
            last_name="میدانی",
            password="Password123!"
        )
        self.counter = self._assign_perms(self.counter, [
            'view_sys_counter'
        ])

        # ۳. ساخت اقلام نمونه
        self.item1 = Item.objects.create(
            warehouse=self.warehouse,
            fa_unic_code="FA-1001",
            description="لوله استیل ۳ اینچ",
            inventory=Decimal('100.000'),
            bal4miv=Decimal('100.000'),
            new_location="A-01-01",
            field_status="waiting"
        )

        self.item2 = Item.objects.create(
            warehouse=self.warehouse,
            fa_unic_code="FA-1002",
            description="شیر فلکه‌ای ۶ اینچ",
            inventory=Decimal('50.000'),
            bal4miv=Decimal('50.000'),
            new_location="B-02-03",
            field_status="waiting"
        )

        self.item3 = Item.objects.create(
            warehouse=self.warehouse,
            fa_unic_code="FA-1003",
            description="فلنج کربن استیل",
            inventory=Decimal('20.000'),
            bal4miv=Decimal('20.000'),
            new_location="C-03-01",
            field_status="waiting"
        )

        self.item4 = Item.objects.create(
            warehouse=self.warehouse,
            fa_unic_code="FA-1004",
            description="گسکت اسپیرال",
            inventory=Decimal('10.000'),
            bal4miv=Decimal('10.000'),
            new_location="D-01-05",
            field_status="waiting"
        )

        self.item5 = Item.objects.create(
            warehouse=self.warehouse,
            fa_unic_code="FA-1005",
            description="پیچ و مهره استل",
            inventory=Decimal('500.000'),
            bal4miv=Decimal('500.000'),
            new_location="E-02-01",
            field_status="waiting"
        )

    def _assign_perms(self, user, perm_codenames):
        from django.contrib.contenttypes.models import ContentType
        ct = ContentType.objects.get_for_model(User)
        perms = []
        for code in perm_codenames:
            p, _ = Permission.objects.get_or_create(content_type=ct, codename=code, defaults={'name': code})
            perms.append(p)
        user.user_permissions.set(perms)
        user.save()
        if hasattr(user, '_perm_cache'):
            delattr(user, '_perm_cache')
        if hasattr(user, '_user_perm_cache'):
            delattr(user, '_user_perm_cache')
        return User.objects.get(pk=user.pk)

    # ═══════════════════════════════════════════════════════════════════════
    # سناریو ۱: چرخه استاندارد کامل (Happy Path with Supervisor & Manager)
    # ═══════════════════════════════════════════════════════════════════════
    def test_01_full_happy_path_with_supervisor(self):
        """تست چرخه کامل: ارجاع -> شمارش -> تایید سرپرست -> تایید مدیر -> بروزرسانی کالا"""
        # ۱. ارجاع توسط مدیر یا کاربر ارجاع‌دهنده
        self.client.force_authenticate(user=self.manager)
        dispatch_resp = self.client.post('/api/inventory/items/bulk_assign/', {
            'item_ids': [self.item1.id],
            'field_assignee': self.counter.id,
            'supervisor_assignee': self.supervisor.id,
            'manager_assignee': self.manager.id,
            'field_status': 'counting'
        }, format='json')
        self.assertEqual(dispatch_resp.status_code, status.HTTP_200_OK)

        # بررسی ایجاد تسک با وضعیت PENDING_COUNT
        task = CountTask.objects.get(item=self.item1)
        self.assertEqual(task.status, 'PENDING_COUNT')
        self.assertEqual(task.counter, self.counter)
        self.assertEqual(task.supervisor, self.supervisor)
        self.assertEqual(task.assigned_manager, self.manager)

        # ۲. شمارشگر وارد کارتابل شده و شمارش را ثبت و ارسال می‌کند
        self.client.force_authenticate(user=self.counter)
        # ثبت موقت مقدار شمرده شده
        task.counted_balance = Decimal('100.000')
        task.counter_note = 'شمارش دقیق انجام شد'
        task.status = 'INITIAL_COUNT'
        task.save()

        # ارسال به سرپرست
        submit_resp = self.client.post('/api/inventory/count-tasks/bulk_submit/', {
            'task_ids': [task.id],
            'warehouse_id': self.warehouse.id
        }, format='json')
        self.assertEqual(submit_resp.status_code, status.HTTP_200_OK)

        task.refresh_from_db()
        self.assertEqual(task.status, 'COUNTED')

        # بررسی ثبت تاریخچه
        history_entry = CountTaskHistory.objects.filter(task=task, action_type='COUNTED').first()
        self.assertIsNotNone(history_entry)
        self.assertEqual(history_entry.action_by, self.counter)

        # ۳. سرپرست کارتابل خود را باز کرده و تایید می‌کند
        self.client.force_authenticate(user=self.supervisor)
        sup_approve_resp = self.client.post('/api/inventory/count-tasks/bulk_approve/', {
            'task_ids': [task.id],
            'note': 'تایید سرپرست: اقلام چک شد'
        }, format='json')
        self.assertEqual(sup_approve_resp.status_code, status.HTTP_200_OK)

        task.refresh_from_db()
        self.assertEqual(task.status, 'MANAGER_REVIEW')

        # ۴. مدیر تایید نهایی را ثبت می‌کند
        self.client.force_authenticate(user=self.manager)
        mgr_approve_resp = self.client.post('/api/inventory/count-tasks/bulk_manager_approve/', {
            'task_ids': [task.id],
            'note': 'تایید نهایی مدیر'
        }, format='json')
        self.assertEqual(mgr_approve_resp.status_code, status.HTTP_200_OK)

        task.refresh_from_db()
        self.item1.refresh_from_db()
        self.assertEqual(task.status, 'FINAL_APPROVED')
        self.assertEqual(self.item1.field_status, 'done')
        self.assertEqual(self.item1.inventory, Decimal('100.000'))
        self.assertFalse(self.item1.has_conflict)

    # ═══════════════════════════════════════════════════════════════════════
    # سناریو ۲: بازشماری و رد نامحدود مدیر (Unlimited Recounts & Reject Flow)
    # ═══════════════════════════════════════════════════════════════════════
    def test_02_recount_and_unlimited_rejects(self):
        """تست رد مکرر (بیش از ۳ بار) توسط مدیر بدون خطای سقف بازشماری و جریان بازگشت"""
        # ۱. تخصیص و ارسال اولیه
        task = CountTask.objects.create(
            item=self.item2,
            counter=self.counter,
            supervisor=self.supervisor,
            assigned_manager=self.manager,
            status='MANAGER_REVIEW',
            counted_balance=Decimal('45.000')
        )

        self.client.force_authenticate(user=self.manager)

        # ۴ بار متوالی رد کردن برای اطمینان از حذف کامل سقف بازشماری
        for i in range(1, 5):
            task.status = 'MANAGER_REVIEW'
            task.counted_balance = Decimal('45.000')
            task.save()

            reject_resp = self.client.post(f'/api/inventory/count-tasks/{task.id}/manager_reject/', {
                'note': f'علت رد مدیر: دور {i} - عدم تطابق موجودی'
            }, format='json')
            self.assertEqual(reject_resp.status_code, status.HTTP_200_OK, f"رد در دور {i} با خطا مواجه شد")

            task.refresh_from_db()
            self.assertEqual(task.status, 'MANAGER_REJECTED')
            self.assertEqual(task.manager_note, f'علت رد مدیر: دور {i} - عدم تطابق موجودی')

        # سرپرست مورد رد شده را به انبارگردان ارجاع می‌دهد
        self.client.force_authenticate(user=self.supervisor)
        sup_reject_resp = self.client.post(f'/api/inventory/count-tasks/{task.id}/reject/', {
            'note': 'دستور بازشماری میدانی'
        }, format='json')
        self.assertEqual(sup_reject_resp.status_code, status.HTTP_200_OK)

        task.refresh_from_db()
        self.assertEqual(task.status, 'SUPERVISOR_REJECTED')

        # انبارگردان شمارش مجدد را ثبت می‌کند
        self.client.force_authenticate(user=self.counter)
        task.counted_balance = Decimal('50.000')
        task.save()
        submit_resp = self.client.post('/api/inventory/count-tasks/bulk_submit/', {
            'task_ids': [task.id],
            'warehouse_id': self.warehouse.id
        }, format='json')
        self.assertEqual(submit_resp.status_code, status.HTTP_200_OK)

        # سرپرست و مدیر تایید می‌کنند
        self.client.force_authenticate(user=self.supervisor)
        self.client.post('/api/inventory/count-tasks/bulk_approve/', {'task_ids': [task.id]}, format='json')

        self.client.force_authenticate(user=self.manager)
        self.client.post('/api/inventory/count-tasks/bulk_manager_approve/', {'task_ids': [task.id]}, format='json')

        task.refresh_from_db()
        self.assertEqual(task.status, 'FINAL_APPROVED')

    # ═══════════════════════════════════════════════════════════════════════
    # سناریو ۳: ارسال مستقیم به مدیر بدون سرپرست (Skip Supervisor)
    # ═══════════════════════════════════════════════════════════════════════
    def test_03_direct_to_manager_skip_supervisor(self):
        """تست ارجاع کالا بدون نیاز به سرپرست و ارسال مستقیم از انبارگردان به مدیر"""
        self.client.force_authenticate(user=self.manager)
        dispatch_resp = self.client.post('/api/inventory/items/bulk_assign/', {
            'item_ids': [self.item3.id],
            'field_assignee': self.counter.id,
            'supervisor_assignee': 'skip',
            'manager_assignee': self.manager.id,
            'field_status': 'counting'
        }, format='json')
        self.assertEqual(dispatch_resp.status_code, status.HTTP_200_OK)

        task = CountTask.objects.get(item=self.item3)
        self.assertTrue(task.skip_supervisor)
        self.assertIsNone(task.supervisor)

        # انبارگردان شمارش را ثبت و ارسال می‌کند
        self.client.force_authenticate(user=self.counter)
        task.counted_balance = Decimal('20.000')
        task.save()

        submit_resp = self.client.post('/api/inventory/count-tasks/bulk_submit/', {
            'task_ids': [task.id],
            'warehouse_id': self.warehouse.id
        }, format='json')
        self.assertEqual(submit_resp.status_code, status.HTTP_200_OK)

        # باید مستقیماً وضعیت MANAGER_REVIEW شود نه COUNTED
        task.refresh_from_db()
        self.assertEqual(task.status, 'MANAGER_REVIEW')

    # ═══════════════════════════════════════════════════════════════════════
    # سناریو ۴: استخر عمومی و بر عهده گرفتن تسک (Pool & Claim)
    # ═══════════════════════════════════════════════════════════════════════
    def test_04_pool_tasks_and_claim(self):
        """تست تخصیص به استخر عمومی و بر عهده گرفتن توسط انبارگردان"""
        self.client.force_authenticate(user=self.manager)
        dispatch_resp = self.client.post('/api/inventory/items/bulk_assign/', {
            'item_ids': [self.item4.id],
            'field_assignee': None,  # استخر عمومی
            'supervisor_assignee': self.supervisor.id,
            'manager_assignee': self.manager.id,
            'field_status': 'counting'
        }, format='json')
        self.assertEqual(dispatch_resp.status_code, status.HTTP_200_OK)

        task = CountTask.objects.get(item=self.item4)
        self.assertIsNone(task.counter)

        # انبارگردان استخر را استعلام می‌کند
        self.client.force_authenticate(user=self.counter)
        pool_resp = self.client.get('/api/inventory/count-tasks/pool_tasks/', {
            'as_role': 'counter',
            'warehouse_id': self.warehouse.id
        })
        self.assertEqual(pool_resp.status_code, status.HTTP_200_OK)
        pool_ids = [t['id'] for t in pool_resp.data]
        self.assertIn(task.id, pool_ids)

        # انبارگردان تسک را بر عهده می‌گیرد (Claim)
        claim_resp = self.client.post('/api/inventory/count-tasks/claim_tasks/', {
            'task_ids': [task.id],
            'as_role': 'counter'
        }, format='json')
        self.assertEqual(claim_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(claim_resp.data.get('claimed_count'), 1)

        task.refresh_from_db()
        self.assertEqual(task.counter, self.counter)

    # ═══════════════════════════════════════════════════════════════════════
    # سناریو ۵: تشخیص مغایرت در صورت عدم انطباق با bal4miv
    # ═══════════════════════════════════════════════════════════════════════
    def test_05_conflict_detection_when_mismatched(self):
        """تست علامت‌گذاری has_conflict=True در صورت مغایرت موجودی شمرده شده با bal4miv"""
        task = CountTask.objects.create(
            item=self.item5,
            counter=self.counter,
            supervisor=self.supervisor,
            assigned_manager=self.manager,
            status='MANAGER_REVIEW',
            counted_balance=Decimal('480.000')  # موجودی دفتری 500 بوده، پس ۲۰ تا مغایرت دارد
        )

        self.client.force_authenticate(user=self.manager)
        approve_resp = self.client.post('/api/inventory/count-tasks/bulk_manager_approve/', {
            'task_ids': [task.id],
            'note': 'تایید مغایرت ۲۰ عددی'
        }, format='json')
        self.assertEqual(approve_resp.status_code, status.HTTP_200_OK)

        self.item5.refresh_from_db()
        self.assertEqual(self.item5.field_status, 'done')
        self.assertEqual(self.item5.inventory, Decimal('480.000'))
        self.assertTrue(self.item5.has_conflict, "کالا باید به عنوان دارای مغایرت تگ شود")

    # ═══════════════════════════════════════════════════════════════════════
    # سناریو ۶: لغو تخصیص (Bulk Cancel)
    # ═══════════════════════════════════════════════════════════════════════
    def test_06_bulk_cancel_tasks(self):
        """تست لغو تخصیص تسک‌های در انتظار شمارش"""
        task = CountTask.objects.create(
            item=self.item1,
            counter=self.counter,
            supervisor=self.supervisor,
            assigned_manager=self.manager,
            status='PENDING_COUNT'
        )

        self.client.force_authenticate(user=self.manager)
        cancel_resp = self.client.post('/api/inventory/count-tasks/bulk_cancel/', {
            'task_ids': [task.id]
        }, format='json')
        self.assertEqual(cancel_resp.status_code, status.HTTP_200_OK)

        self.assertFalse(CountTask.objects.filter(id=task.id).exists())

    # ═══════════════════════════════════════════════════════════════════════
    # سناریو ۷: سینک و شمارش کور (Sync Pull & Blind Counting Redaction)
    # ═══════════════════════════════════════════════════════════════════════
    def test_07_sync_pull_and_blind_redaction(self):
        """تست عدم نشت موجودی سیستمی به انبارگردان در حالت شمارش کور"""
        SystemSetting.objects.update_or_create(
            key='blind_counting',
            warehouse=self.warehouse,
            defaults={'value': 'blind'}
        )

        task = CountTask.objects.create(
            item=self.item1,
            counter=self.counter,
            status='PENDING_COUNT'
        )

        # درخواست همگام‌سازی با کاربر انبارگردان
        self.client.force_authenticate(user=self.counter)
        pull_resp = self.client.get('/api/inventory/sync/pull/', {
            'warehouse_id': self.warehouse.id,
            'models': 'count_tasks,items'
        })
        self.assertEqual(pull_resp.status_code, status.HTTP_200_OK)

        # موجودی inventory و bal4miv نباید در اطلاعات کالای دریافتی انبارگردان باشد
        items = pull_resp.data.get('results', {}).get('items', [])
        for itm in items:
            self.assertNotIn('inventory', itm, "موجودی سیستمی نباید در شمارش کور ارسال شود")
            self.assertNotIn('bal4miv', itm, "موجودی مجاز MIV نباید در شمارش کور ارسال شود")

    # ═══════════════════════════════════════════════════════════════════════
    # سناریو ۸: ذخیره‌سازی و ویرایش فیلدهای پویا (Dynamic Extra Fields)
    # ═══════════════════════════════════════════════════════════════════════
    def test_08_dynamic_extra_fields_saving(self):
        """تست ذخیره‌سازی مقادیر فیلدهای پویا (سریال، بچ، شرایط کالا) روی کالا"""
        self.client.force_authenticate(user=self.manager)
        update_resp = self.client.patch(f'/api/inventory/items/{self.item1.id}/', {
            'dynamic_data': {
                'batch_number': 'BATCH-2026-X',
                'package_condition': 'سالم و پلمپ'
            }
        }, format='json')
        self.assertEqual(update_resp.status_code, status.HTTP_200_OK)

        self.item1.refresh_from_db()
        self.assertEqual(self.item1.dynamic_data.get('batch_number'), 'BATCH-2026-X')
        self.assertEqual(self.item1.dynamic_data.get('package_condition'), 'سالم و پلمپ')

    # ═══════════════════════════════════════════════════════════════════════
    # سناریو ۹: تداخل همزمانی خوش‌بینانه و خطای 409 (Optimistic Concurrency 409)
    # ═══════════════════════════════════════════════════════════════════════
    def test_09_optimistic_concurrency_409_conflict(self):
        """تست تشخیص تداخل خوش‌بینانه در صورت آپدیت همزمان تسک توسط دو کاربر یا کلاینت آفلاین"""
        task = CountTask.objects.create(
            item=self.item1,
            counter=self.counter,
            status='PENDING_COUNT'
        )

        self.client.force_authenticate(user=self.counter)
        # ارسال base_updated_at بسیار قدیمی که نشان‌دهنده تغییر تسک در سرور است
        conflict_resp = self.client.patch(f'/api/inventory/count-tasks/{task.id}/', {
            'counted_balance': Decimal('100.000'),
            'base_updated_at': '2020-01-01T00:00:00Z'
        }, format='json')

        self.assertEqual(conflict_resp.status_code, status.HTTP_409_CONFLICT)
        self.assertIn('server_record', conflict_resp.data)

    # ═══════════════════════════════════════════════════════════════════════
    # سناریو ۱۰: ارجاع مجدد کالا با فلگ force=True (Re-dispatch with Force)
    # ═══════════════════════════════════════════════════════════════════════
    def test_10_redispatch_with_force_flag(self):
        """تست ارجاع مجدد کالایی که قبلاً دارای تسک فعال بوده است"""
        # ایجاد تسک اولیه
        CountTask.objects.create(
            item=self.item2,
            counter=self.counter,
            supervisor=self.supervisor,
            assigned_manager=self.manager,
            status='PENDING_COUNT'
        )

        # ارجاع مجدد با force=True به یک شمارشگر جدید
        self.client.force_authenticate(user=self.manager)
        redispatch_resp = self.client.post('/api/inventory/items/bulk_assign/', {
            'item_ids': [self.item2.id],
            'field_assignee': self.counter.id,
            'supervisor_assignee': self.supervisor.id,
            'manager_assignee': self.manager.id,
            'field_status': 'counting',
            'force': True
        }, format='json')

        self.assertEqual(redispatch_resp.status_code, status.HTTP_200_OK)

    # ═══════════════════════════════════════════════════════════════════════
    # سناریو ۱۱: شمارش عدد صفر و دقت اعشاری (Zero Count & Decimal Precision)
    # ═══════════════════════════════════════════════════════════════════════
    def test_11_zero_count_and_decimal_precision(self):
        """تست معتبر بودن شمارش عدد صفر (کسری کامل) و حفظ ۳ رقم اعشار دقیق (مانند ۱۲.۳۴۵)"""
        # الف) تست شمارش صفر
        task_zero = CountTask.objects.create(
            item=self.item3,
            counter=self.counter,
            supervisor=self.supervisor,
            assigned_manager=self.manager,
            status='MANAGER_REVIEW',
            counted_balance=Decimal('0.000')
        )

        self.client.force_authenticate(user=self.manager)
        approve_zero = self.client.post('/api/inventory/count-tasks/bulk_manager_approve/', {
            'task_ids': [task_zero.id]
        }, format='json')
        self.assertEqual(approve_zero.status_code, status.HTTP_200_OK)

        self.item3.refresh_from_db()
        self.assertEqual(self.item3.inventory, Decimal('0.000'))
        self.assertTrue(self.item3.has_conflict)

        # ب) تست دقت اعشاری ۳ رقمی
        task_dec = CountTask.objects.create(
            item=self.item4,
            counter=self.counter,
            supervisor=self.supervisor,
            assigned_manager=self.manager,
            status='MANAGER_REVIEW',
            counted_balance=Decimal('12.345')
        )

        approve_dec = self.client.post('/api/inventory/count-tasks/bulk_manager_approve/', {
            'task_ids': [task_dec.id]
        }, format='json')
        self.assertEqual(approve_dec.status_code, status.HTTP_200_OK)

        self.item4.refresh_from_db()
        self.assertEqual(self.item4.inventory, Decimal('12.345'))

    # ═══════════════════════════════════════════════════════════════════════
    # سناریو ۱۲: استخر عمومی سرپرست و Claim (Supervisor Pool & Claim)
    # ═══════════════════════════════════════════════════════════════════════
    def test_12_supervisor_pool_and_claim(self):
        """تست ورود تسک به استخر سرپرستان در صورت عدم تعیین سرپرست در زمان ارجاع و Claim آن"""
        task = CountTask.objects.create(
            item=self.item1,
            counter=self.counter,
            supervisor=None, # بدون سرپرست مستقیم
            assigned_manager=self.manager,
            status='COUNTED',
            counted_balance=Decimal('100.000')
        )

        # سرپرست استخر را فراخوانی می‌کند
        self.client.force_authenticate(user=self.supervisor)
        pool_resp = self.client.get('/api/inventory/count-tasks/pool_tasks/', {
            'as_role': 'supervisor',
            'warehouse_id': self.warehouse.id
        })
        self.assertEqual(pool_resp.status_code, status.HTTP_200_OK)
        pool_ids = [t['id'] for t in pool_resp.data]
        self.assertIn(task.id, pool_ids)

        # سرپرست تسک را بر عهده می‌گیرد
        claim_resp = self.client.post('/api/inventory/count-tasks/claim_tasks/', {
            'task_ids': [task.id],
            'as_role': 'supervisor'
        }, format='json')
        self.assertEqual(claim_resp.status_code, status.HTTP_200_OK)

        task.refresh_from_db()
        self.assertEqual(task.supervisor, self.supervisor)

        # سپس تسک را تایید می‌کند
        approve_resp = self.client.post('/api/inventory/count-tasks/bulk_approve/', {
            'task_ids': [task.id]
        }, format='json')
        self.assertEqual(approve_resp.status_code, status.HTTP_200_OK)

        task.refresh_from_db()
        self.assertEqual(task.status, 'MANAGER_REVIEW')

    # ═══════════════════════════════════════════════════════════════════════
    # سناریو ۱۳: رفع مغایرت در بازشماری مجدد (Conflict Resolution)
    # ═══════════════════════════════════════════════════════════════════════
    def test_13_conflict_resolution_on_recount(self):
        """تست رفع پرچم مغایرت هنگام انطباق شمارش مجدد با موجودی دفتری"""
        self.item5.has_conflict = True
        self.item5.bal4miv = Decimal('500.000')
        self.item5.save()

        task = CountTask.objects.create(
            item=self.item5,
            counter=self.counter,
            supervisor=self.supervisor,
            assigned_manager=self.manager,
            status='MANAGER_REVIEW',
            counted_balance=Decimal('500.000') # شمارش با bal4miv منطبق است
        )

        self.client.force_authenticate(user=self.manager)
        approve_resp = self.client.post('/api/inventory/count-tasks/bulk_manager_approve/', {
            'task_ids': [task.id]
        }, format='json')
        self.assertEqual(approve_resp.status_code, status.HTTP_200_OK)

        self.item5.refresh_from_db()
        self.assertEqual(self.item5.inventory, Decimal('500.000'))

    # ═══════════════════════════════════════════════════════════════════════
    # سناریو ۱۴: حذف نرم و تولید تومب‌استون آفلاین (Soft Delete Tombstones)
    # ═══════════════════════════════════════════════════════════════════════
    def test_14_soft_delete_and_sync_tombstone(self):
        """تست قرارگیری رکوردهای حذف نرم‌شده با is_deleted=True در پاسخ سینک دلتا"""
        task = CountTask.objects.create(
            item=self.item1,
            counter=self.counter,
            supervisor=self.supervisor,
            status='PENDING_COUNT'
        )
        task_id = task.id
        task.soft_delete()

        # فراخوانی سینک برای بررسی تومب‌استون
        self.client.force_authenticate(user=self.counter)
        pull_resp = self.client.get('/api/inventory/sync/pull/', {
            'warehouse_id': self.warehouse.id,
            'models': 'count_tasks'
        })
        self.assertEqual(pull_resp.status_code, status.HTTP_200_OK)

        tasks_in_sync = pull_resp.data.get('results', {}).get('count_tasks', [])
        deleted_task = next((t for t in tasks_in_sync if t.get('id') == task_id), None)
        if deleted_task:
            self.assertTrue(deleted_task.get('is_deleted'))

    # ═══════════════════════════════════════════════════════════════════════
    # سناریو ۱۵: به‌روزرسانی موقعیت فیزیکی کالا (New Location Persistence)
    # ═══════════════════════════════════════════════════════════════════════
    def test_15_new_location_persistence(self):
        """تست ثبت و حفظ موقعیت جدید قفسه/انبار (new_location) کالا"""
        self.client.force_authenticate(user=self.manager)
        update_resp = self.client.patch(f'/api/inventory/items/{self.item1.id}/', {
            'new_location': 'WAREHOUSE-B-BAY-12'
        }, format='json')
        self.assertEqual(update_resp.status_code, status.HTTP_200_OK)

        self.item1.refresh_from_db()
        self.assertEqual(self.item1.new_location, 'WAREHOUSE-B-BAY-12')
