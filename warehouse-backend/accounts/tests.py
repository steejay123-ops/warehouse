from django.test import TestCase
from accounts.serializers import UserSerializer
from accounts.models import CustomUser

class UserSerializerValidationTests(TestCase):
    def test_create_user_without_email_succeeds(self):
        data = {
            'username': 'user_no_email',
            'first_name': 'علی',
            'last_name': 'رضایی',
            'phone_number': '09123456789',
        }
        serializer = UserSerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        user = serializer.save()
        self.assertEqual(user.email, '')

    def test_create_user_with_null_email_succeeds(self):
        data = {
            'username': 'user_null_email',
            'first_name': 'سارا',
            'last_name': 'محمدی',
            'phone_number': '09123456789',
            'email': None
        }
        serializer = UserSerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        user = serializer.save()
        self.assertEqual(user.email, '')

    def test_create_user_without_phone_fails(self):
        data = {
            'username': 'user_no_phone',
            'first_name': 'مهدی',
            'last_name': 'کریمی',
        }
        serializer = UserSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('phone_number', serializer.errors)

    def test_create_user_with_invalid_phone_fails(self):
        data = {
            'username': 'user_bad_phone',
            'first_name': 'مهدی',
            'last_name': 'کریمی',
            'phone_number': '02188776655', # Not mobile
        }
        serializer = UserSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('phone_number', serializer.errors)

    def test_create_user_with_iranian_mobile_normalization_succeeds(self):
        data = {
            'username': 'user_iran_phone',
            'first_name': 'مهدی',
            'last_name': 'کریمی',
            'phone_number': '+989123456789',
        }
        serializer = UserSerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        user = serializer.save()
        self.assertEqual(user.phone_number, '09123456789')


import io
import openpyxl
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from django.contrib.auth.models import Permission
from accounts.models import CustomRole

def create_excel_upload_file(headers, key_row, rows, filename="test.xlsx"):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(headers)
    ws.append(key_row)
    for r in rows:
        ws.append(r)
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return SimpleUploadedFile(filename, buf.getvalue(), content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')


class UserExcelImportTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = CustomUser.objects.create_superuser('admin_test_excel', 'admin@test.com', 'pass1234')
        self.client.force_authenticate(user=self.admin)

    def test_clear_empty_roles_and_warehouses_on_update(self):
        role = CustomRole.objects.create(name='accountant_test', title='حسابدار', color='#4f46e5')
        user = CustomUser.objects.create(
            username='user_sync_test',
            first_name='سارا',
            last_name='احمدی',
            phone_number='09121112233'
        )
        user.groups.add(role)
        self.assertEqual(user.groups.count(), 1)

        headers = ['نام', 'نام خانوادگی', 'شناسه ورود', 'کد ملی', 'تلفن', 'ایمیل', 'گروه خونی', 'تماس اضطراری', 'منطقه عملیاتی', 'شرکت متبوع', 'آدرس', 'نقش‌ها', 'انبارها', 'فعال']
        key_row = ['first_name', 'last_name', 'username', 'national_code', 'phone_number', 'email', 'blood_type', 'emergency_contact', 'operational_zone', 'company', 'address', 'roles', 'warehouses', 'is_active']
        rows = [
            ['سارا', 'احمدی', 'user_sync_test', '', '09121112233', '', '', '', '', '', '', '', '', 'بله']
        ]
        excel_file = create_excel_upload_file(headers, key_row, rows)
        res = self.client.post('/api/accounts/users/import_excel/', {'file': excel_file, 'update_existing': 'true'}, format='multipart')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data['success'])
        self.assertEqual(res.data['summary']['updated'], 1)

        user.refresh_from_db()
        self.assertEqual(user.groups.count(), 0)

    def test_atomic_rollback_on_user_import_error(self):
        headers = ['نام', 'نام خانوادگی', 'شناسه ورود', 'کد ملی', 'تلفن', 'ایمیل', 'گروه خونی', 'تماس اضطراری', 'منطقه عملیاتی', 'شرکت متبوع', 'آدرس', 'نقش‌ها', 'انبارها', 'فعال']
        key_row = ['first_name', 'last_name', 'username', 'national_code', 'phone_number', 'email', 'blood_type', 'emergency_contact', 'operational_zone', 'company', 'address', 'roles', 'warehouses', 'is_active']
        rows = [
            ['کاربر', 'یک', 'rollback_user_1', '', '09121110001', '', '', '', '', '', '', '', '', 'بله'],
            ['کاربر', 'دو', 'rollback_user_2', '', '09121110002', '', '', '', '', '', '', '', '', 'بله'],
        ]
        excel_file = create_excel_upload_file(headers, key_row, rows)

        from unittest.mock import patch
        with patch.object(CustomUser, 'save', side_effect=[None, Exception("Simulated DB Crash")]):
            res = self.client.post('/api/accounts/users/import_excel/', {'file': excel_file}, format='multipart')
            self.assertEqual(res.status_code, 400)
            self.assertFalse(res.data['success'])
            self.assertIn('تراکنش کاملاً رول‌بک شد', res.data['errors'][0]['message'])

        self.assertFalse(CustomUser.objects.filter(username='rollback_user_1').exists())
        self.assertFalse(CustomUser.objects.filter(username='rollback_user_2').exists())


class RoleExcelImportTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = CustomUser.objects.create_superuser('admin_role_test', 'admin@role.com', 'pass1234')
        self.client.force_authenticate(user=self.admin)

    def test_circular_dependency_handled_gracefully_without_500(self):
        headers = ['نام یکتا (name)', 'عنوان فارسی (title)', 'رنگ سازمانی (color)', 'نقش والد (parent)', 'مجوزها (permissions)']
        key_row = ['name', 'title', 'color', 'parent', 'permissions']
        rows = [
            ['role_alpha', 'نقش آلفا', '#4f46e5', 'role_beta', ''],
            ['role_beta', 'نقش بتا', '#06b6d4', 'role_alpha', ''],
        ]
        excel_file = create_excel_upload_file(headers, key_row, rows)
        res = self.client.post('/api/accounts/roles/import_excel/', {'file': excel_file}, format='multipart')

        # MUST NOT be 500!
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data['success'])
        parent_errors = [e for e in res.data['errors'] if e.get('field') == 'parent']
        self.assertTrue(len(parent_errors) > 0)
        self.assertIn('چرخه‌ای', parent_errors[0]['message'])

    def test_clear_empty_permissions_and_parent_on_update(self):
        parent_role = CustomRole.objects.create(name='parent_lead', title='سرپرست کل', color='#10b981')
        perm = Permission.objects.filter(codename='view_sys_dashboard').first()
        child_role = CustomRole.objects.create(name='child_dev', title='توسعه دهنده', color='#6366f1', parent=parent_role)
        if perm:
            child_role.permissions.add(perm)

        self.assertIsNotNone(child_role.parent)
        if perm:
            self.assertEqual(child_role.permissions.count(), 1)

        headers = ['نام یکتا (name)', 'عنوان فارسی (title)', 'رنگ سازمانی (color)', 'نقش والد (parent)', 'مجوزها (permissions)']
        key_row = ['name', 'title', 'color', 'parent', 'permissions']
        rows = [
            ['child_dev', 'توسعه دهنده بروز', '#6366f1', '', ''],
        ]
        excel_file = create_excel_upload_file(headers, key_row, rows)
        res = self.client.post('/api/accounts/roles/import_excel/', {'file': excel_file, 'update_existing': 'true'}, format='multipart')
        self.assertEqual(res.status_code, 200)

        child_role.refresh_from_db()
        self.assertIsNone(child_role.parent)
        self.assertEqual(child_role.permissions.count(), 0)

    def test_atomic_rollback_on_role_import_error(self):
        headers = ['نام یکتا (name)', 'عنوان فارسی (title)', 'رنگ سازمانی (color)', 'نقش والد (parent)', 'مجوزها (permissions)']
        key_row = ['name', 'title', 'color', 'parent', 'permissions']
        rows = [
            ['atomic_role_1', 'نقش اتمیک ۱', '#4f46e5', '', ''],
            ['atomic_role_2', 'نقش اتمیک ۲', '#06b6d4', '', ''],
        ]
        excel_file = create_excel_upload_file(headers, key_row, rows)

        from unittest.mock import patch
        with patch.object(CustomRole, 'save', side_effect=[None, Exception("Fatal DB Error")]):
            res = self.client.post('/api/accounts/roles/import_excel/', {'file': excel_file}, format='multipart')
            self.assertEqual(res.status_code, 400)
            self.assertFalse(res.data['success'])
            self.assertIn('تراکنش کاملاً رول‌بک شد', res.data['errors'][0]['message'])

        self.assertFalse(CustomRole.objects.filter(name='atomic_role_1').exists())
        self.assertFalse(CustomRole.objects.filter(name='atomic_role_2').exists())
