import os
import tempfile
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.test import TransactionTestCase
from rest_framework import status
from rest_framework.test import APIClient

from warehouses.models import Warehouse
from inventory.models import ImportLog

User = get_user_model()


class DownloadImportLogSecurityTests(TransactionTestCase):
    def setUp(self):
        self.client = APIClient()

        self.warehouse = Warehouse.objects.create(name="انبار تست ۱")
        self.other_warehouse = Warehouse.objects.create(name="انبار تست ۲")

        # کاربران
        self.user_with_perm = User.objects.create_user(
            username="importer_user",
            password="Password123!"
        )
        from django.contrib.contenttypes.models import ContentType
        ct = ContentType.objects.get_for_model(User)
        perm, _ = Permission.objects.get_or_create(content_type=ct, codename="perm_rec_import", defaults={'name': "Import Excel"})
        self.user_with_perm.user_permissions.add(perm)
        self.user_with_perm.assigned_warehouses.add(self.warehouse)

        self.user_no_perm = User.objects.create_user(
            username="unauthorized_user",
            password="Password123!"
        )

        self.import_id = "testimport123"
        self.log_file_path = os.path.join(tempfile.gettempdir(), f"import_log_{self.import_id}.xlsx")
        with open(self.log_file_path, "wb") as f:
            f.write(b"dummy excel content")

        self.import_log = ImportLog.objects.create(
            import_id=self.import_id,
            warehouse=self.warehouse,
            imported_by=self.user_with_perm,
            file_name="test.xlsx"
        )

    def tearDown(self):
        if os.path.exists(self.log_file_path):
            try:
                os.remove(self.log_file_path)
            except OSError:
                pass

    def test_unauthenticated_access_is_blocked(self):
        """درخواست بدون احراز هویت باید مسدود شود (۴۰۱ یا ۴۰۳)"""
        url = f"/api/inventory/items/download_import_log/?import_id={self.import_id}"
        response = self.client.get(url)
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def test_user_without_permission_is_blocked(self):
        """کاربر لاگین‌شده بدون پرمیشن perm_rec_import باید ۴۰۳ شود"""
        self.client.force_authenticate(user=self.user_no_perm)
        url = f"/api/inventory/items/download_import_log/?import_id={self.import_id}"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_path_traversal_attempt_is_rejected(self):
        """تلاش برای Path Traversal باید ارور ۴۰۰ برگرداند"""
        self.client.force_authenticate(user=self.user_with_perm)
        bad_ids = [
            "../../etc/passwd",
            "..\\..\\windows\\win.ini",
            "/etc/passwd",
            "import_id/../secret"
        ]
        for bad_id in bad_ids:
            url = f"/api/inventory/items/download_import_log/?import_id={bad_id}"
            response = self.client.get(url)
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_user_from_other_warehouse_cannot_download_others_log(self):
        """کاربر دارای پرمیشن ایمپورت در انبار دیگر نباید لاگ انبار ۱ را ببیند (۴۰۳)"""
        other_user = User.objects.create_user(
            username="other_wh_user",
            password="Password123!"
        )
        from django.contrib.contenttypes.models import ContentType
        ct = ContentType.objects.get_for_model(User)
        perm = Permission.objects.get(codename="perm_rec_import", content_type=ct)
        other_user.user_permissions.add(perm)
        other_user.assigned_warehouses.add(self.other_warehouse)

        self.client.force_authenticate(user=other_user)
        url = f"/api/inventory/items/download_import_log/?import_id={self.import_id}"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_authorized_user_can_download(self):
        """کاربر مجاز باید بتواند فایل لاگ را دانلود کند (۲۰۰)"""
        self.client.force_authenticate(user=self.user_with_perm)
        url = f"/api/inventory/items/download_import_log/?import_id={self.import_id}"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.content, b"dummy excel content")

    def test_clear_warehouse_data_blocks_unauthorized_warehouse(self):
        """کاربر انبار ۱ نباید بتواند داده‌های انبار ۲ را پاک کند (۴۰۳)"""
        self.client.force_authenticate(user=self.user_with_perm)
        url = "/api/inventory/items/clear_warehouse_data/"
        response = self.client.post(url, {'warehouse_id': self.other_warehouse.id}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_latest_import_blocks_unauthorized_warehouse(self):
        """کاربر انبار ۱ نباید بتواند آخرین ایمپورت‌های انبار ۲ را مشاهده کند (۴۰۳)"""
        self.client.force_authenticate(user=self.user_with_perm)
        url = f"/api/inventory/items/latest_import/?warehouse_id={self.other_warehouse.id}"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_revert_import_blocks_unauthorized_warehouse(self):
        """کاربر انبار ۱ نباید بتواند ایمپورت متعلق به انبار ۲ را بازگردانی کند (۴۰۳)"""
        other_import = ImportLog.objects.create(
            import_id="otherimport999",
            warehouse=self.other_warehouse,
            file_name="other.xlsx"
        )
        self.client.force_authenticate(user=self.user_with_perm)
        url = "/api/inventory/items/revert_import/"
        response = self.client.post(url, {'import_id': other_import.import_id}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_import_excel_blocks_unauthorized_warehouse(self):
        """کاربر انبار ۱ نباید بتواند در انبار ۲ اکسل بارگذاری کند (۴۰۳)"""
        import io
        from django.core.files.uploadedfile import SimpleUploadedFile
        fake_excel = SimpleUploadedFile("items.xlsx", b"dummy content", content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        self.client.force_authenticate(user=self.user_with_perm)
        url = "/api/inventory/items/import_excel/"
        response = self.client.post(url, {'warehouse_id': self.other_warehouse.id, 'file': fake_excel}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_delete_from_excel_blocks_unauthorized_warehouse(self):
        """کاربر انبار ۱ نباید بتواند از طریق اکسل در انبار ۲ حذف انجام دهد (۴۰۳)"""
        from django.core.files.uploadedfile import SimpleUploadedFile
        fake_excel = SimpleUploadedFile("delete.xlsx", b"dummy content", content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        self.client.force_authenticate(user=self.user_with_perm)
        url = "/api/inventory/items/delete_from_excel/"
        response = self.client.post(url, {'warehouse_id': self.other_warehouse.id, 'file': fake_excel}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_import_excel_with_foreign_item_id_fails_to_steal_item(self):
        """تلاش برای جابجایی یا ویرایش کالای انبار دیگر با ستون id باید رد شده و انبار کالا تغییر نکند"""
        import io
        import openpyxl
        from django.core.files.uploadedfile import SimpleUploadedFile
        from inventory.models import Item

        foreign_item = Item.objects.create(
            warehouse=self.other_warehouse,
            fa_unic_code="FA-FOREIGN-1",
            description="کالای انبار دوم"
        )

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.append(['id', 'fa_unic_code', 'description'])
        ws.append([foreign_item.id, 'FA-FOREIGN-1', 'تلاش برای سرقت کالا'])
        out = io.BytesIO()
        wb.save(out)
        out.seek(0)

        excel_file = SimpleUploadedFile("steal.xlsx", out.read(), content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

        self.client.force_authenticate(user=self.user_with_perm)
        url = "/api/inventory/items/import_excel/"
        response = self.client.post(url, {
            'warehouse_id': self.warehouse.id,
            'conflict_strategy': 'replace',
            'file': excel_file
        }, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        async def _consume(gen):
            res = []
            async for chunk in gen:
                res.append(chunk.decode('utf-8') if isinstance(chunk, bytes) else chunk)
            return "".join(res)

        import asyncio
        import json
        content = asyncio.run(_consume(response.streaming_content))
        lines = [json.loads(l) for l in content.strip().split('\n') if l.strip()]
        msgs = [l.get('msg', '') for l in lines]
        self.assertTrue(any("مغایرت انبار" in m for m in msgs), f"Expected 'مغایرت انبار' in messages: {msgs}")

        foreign_item.refresh_from_db()
        self.assertEqual(foreign_item.warehouse_id, self.other_warehouse.id)
        self.assertEqual(foreign_item.description, "کالای انبار دوم")

    def test_import_excel_with_conflicting_warehouse_column_fails(self):
        """ردیف با نام انبار مغایر با انبار انتخابی فرآیند باید رد شود"""
        import io
        import openpyxl
        from django.core.files.uploadedfile import SimpleUploadedFile

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.append(['fa_unic_code', 'description', 'warehouse'])
        ws.append(['FA-NEW-99', 'تست مغایرت انبار', self.other_warehouse.name])
        out = io.BytesIO()
        wb.save(out)
        out.seek(0)

        excel_file = SimpleUploadedFile("conflict_wh.xlsx", out.read(), content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

        self.client.force_authenticate(user=self.user_with_perm)
        url = "/api/inventory/items/import_excel/"
        response = self.client.post(url, {
            'warehouse_id': self.warehouse.id,
            'file': excel_file
        }, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        async def _consume(gen):
            res = []
            async for chunk in gen:
                res.append(chunk.decode('utf-8') if isinstance(chunk, bytes) else chunk)
            return "".join(res)

        import asyncio
        import json
        content = asyncio.run(_consume(response.streaming_content))
        lines = [json.loads(l) for l in content.strip().split('\n') if l.strip()]
        msgs = [l.get('msg', '') for l in lines]
        self.assertTrue(any("مغایرت انبار" in m for m in msgs), f"Expected 'مغایرت انبار' in messages: {msgs}")

    def test_broken_row_does_not_rollback_valid_rows_and_emits_summary(self):
        """یک ردیف خراب نباید کل تراکنش و ردیف‌های معتبر قبل و بعد از خود را رول‌بک کند"""
        import io
        import openpyxl
        from django.core.files.uploadedfile import SimpleUploadedFile
        from inventory.models import Item

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.append(['fa_unic_code', 'description', 'total_value'])
        ws.append(['FA-GOOD-1', 'کالای معتبر ۱', 1000])
        # ردیف خراب: مقدار نامعتبر متنی برای فیلد اعشاری total_value
        ws.append(['FA-BAD-2', 'کالای خراب ۲', 'INVALID_NUMERIC_VALUE_XYZ'])
        ws.append(['FA-GOOD-3', 'کالای معتبر ۳', 3000])
        out = io.BytesIO()
        wb.save(out)
        out.seek(0)

        excel_file = SimpleUploadedFile("mixed.xlsx", out.read(), content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

        self.client.force_authenticate(user=self.user_with_perm)
        url = "/api/inventory/items/import_excel/"
        response = self.client.post(url, {
            'warehouse_id': self.warehouse.id,
            'file': excel_file
        }, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        async def _consume(gen):
            res = []
            async for chunk in gen:
                res.append(chunk.decode('utf-8') if isinstance(chunk, bytes) else chunk)
            return "".join(res)

        import asyncio
        import json
        content = asyncio.run(_consume(response.streaming_content))
        lines = [json.loads(l) for l in content.strip().split('\n') if l.strip()]

        summary = next((l for l in lines if l.get('type') == 'summary'), None)
        self.assertIsNotNone(summary, "پیام خلاصه نهایی summary باید ارسال شود")
        self.assertEqual(summary.get('status'), 'success')
        self.assertEqual(summary.get('created'), 2)
        self.assertEqual(summary.get('failed'), 1)

        self.assertTrue(Item.objects.filter(fa_unic_code='FA-GOOD-1', warehouse=self.warehouse).exists())
        self.assertTrue(Item.objects.filter(fa_unic_code='FA-GOOD-3', warehouse=self.warehouse).exists())
        self.assertFalse(Item.objects.filter(fa_unic_code='FA-BAD-2').exists())

    def test_user_with_only_import_perm_can_access_parse_headers_and_export_columns(self):
        """کاربری که فقط پرمیشن ایمپورت دارد ولی perm_wh_edit ندارد، باید بتواند هدرها و ستون‌ها را بخواند"""
        import io
        import openpyxl
        from django.core.files.uploadedfile import SimpleUploadedFile

        self.client.force_authenticate(user=self.user_with_perm)

        # ۱. ستون‌های قابل شناسایی
        res_cols = self.client.get('/api/inventory/items/export_columns/', {'warehouse_id': self.warehouse.id})
        self.assertEqual(res_cols.status_code, status.HTTP_200_OK)
        self.assertTrue(any(c.get('key') == 'fa_unic_code' for c in res_cols.data))

        # ۲. خواندن هدرهای فایل اکسل
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.append(['fa_unic_code', 'description'])
        out = io.BytesIO()
        wb.save(out)
        out.seek(0)
        excel_file = SimpleUploadedFile("headers.xlsx", out.read(), content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

        res_parse = self.client.post('/api/inventory/items/parse_headers/', {
            'file': excel_file,
            'warehouse_id': self.warehouse.id
        }, format='multipart')
        self.assertEqual(res_parse.status_code, status.HTTP_200_OK)
        self.assertIn('fa_unic_code', res_parse.data.get('found_fields', []))

        # ۳. دریافت آخرین وضعیت ایمپورت
        res_latest = self.client.get('/api/inventory/items/latest_import/', {'warehouse_id': self.warehouse.id})
        self.assertEqual(res_latest.status_code, status.HTTP_200_OK)

    def test_user_without_perm_cannot_access_parse_headers(self):
        """کاربر بدون پرمیشن perm_rec_import نباید به parse_headers دسترسی داشته باشد (۴۰۳)"""
        import io
        import openpyxl
        from django.core.files.uploadedfile import SimpleUploadedFile

        self.client.force_authenticate(user=self.user_no_perm)
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.append(['fa_unic_code', 'description'])
        out = io.BytesIO()
        wb.save(out)
        out.seek(0)
        excel_file = SimpleUploadedFile("headers.xlsx", out.read(), content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

        res = self.client.post('/api/inventory/items/parse_headers/', {
            'file': excel_file,
            'warehouse_id': self.warehouse.id
        }, format='multipart')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_update_empty_does_not_overwrite_zero_or_false(self):
        """در حالت تکمیل نواقص، موجودی صفر و مقادیر False نباید با مقادیر اکسل بازنویسی شوند"""
        import io
        import openpyxl
        from django.core.files.uploadedfile import SimpleUploadedFile
        from inventory.models import Item

        item = Item.objects.create(
            warehouse=self.warehouse,
            fa_unic_code="FA-ZERO-TEST",
            inventory=0,
            has_conflict=False,
            description=""
        )

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.append(['fa_unic_code', 'inventory', 'has_conflict', 'description'])
        ws.append(['FA-ZERO-TEST', 999, True, 'شرح اضافه شده'])
        out = io.BytesIO()
        wb.save(out)
        out.seek(0)

        excel_file = SimpleUploadedFile("update_empty.xlsx", out.read(), content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

        self.client.force_authenticate(user=self.user_with_perm)
        url = "/api/inventory/items/import_excel/"
        response = self.client.post(url, {
            'warehouse_id': self.warehouse.id,
            'conflict_strategy': 'update_empty',
            'file': excel_file
        }, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        async def _consume(gen):
            res = []
            async for chunk in gen:
                res.append(chunk.decode('utf-8') if isinstance(chunk, bytes) else chunk)
            return "".join(res)

        import asyncio
        asyncio.run(_consume(response.streaming_content))

        item.refresh_from_db()
        # شرح خالی پر شد
        self.assertEqual(item.description, 'شرح اضافه شده')
        # موجودی صفر دست‌نخورده باقی ماند
        self.assertEqual(item.inventory, 0)
        # وضعیت تداخل دست‌نخورده باقی ماند
        self.assertEqual(item.has_conflict, False)

    def test_delete_from_excel_with_float_ids_succeeds(self):
        """حذف از اکسل با شناسه‌های اعشاری مثل 101.0 نباید خطای دیتابیسی بدهد"""
        import io
        import openpyxl
        from django.core.files.uploadedfile import SimpleUploadedFile
        from inventory.models import Item

        item = Item.objects.create(
            warehouse=self.warehouse,
            fa_unic_code="FA-DEL-FLOAT",
            description="کالای حذف شونده"
        )

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.append(['id', 'fa_unic_code'])
        # اکسل عدد را اعشاری لود می‌کند مثلاً 101.0
        ws.append([f"{item.id}.0", 'FA-DEL-FLOAT'])
        out = io.BytesIO()
        wb.save(out)
        out.seek(0)

        excel_file = SimpleUploadedFile("delete_float.xlsx", out.read(), content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

        self.client.force_authenticate(user=self.user_with_perm)
        url = "/api/inventory/items/delete_from_excel/"
        response = self.client.post(url, {
            'warehouse_id': self.warehouse.id,
            'file': excel_file
        }, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data.get('status'), 'success')

        # کالا با موفقیت حذف شده است
        self.assertFalse(Item.objects.filter(id=item.id).exists())
