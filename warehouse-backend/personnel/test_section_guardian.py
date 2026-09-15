from django.test import TestCase
from django.contrib.auth import get_user_model
from decimal import Decimal
from rest_framework.test import APIClient
from personnel.models import (
    FinancialProject,
    ProjectSection,
    UserSectionAssignment,
    Counterparty,
    ExpenseInvoice,
    PersonnelProfile,
    VehicleDriverProfile,
    DailyAttendance,
    VehicleTripLog
)
from personnel.section_guardian import SectionGuardian

User = get_user_model()


class SectionGuardianPhase1Tests(TestCase):
    """
    مجموعه تست‌های خودکار ایجنت نگهبان فونداسیون معماری پروژه و بخش
    """

    def setUp(self):
        self.user = User.objects.create_user(
            username='test_operator',
            password='Password123!',
            first_name='علی',
            last_name='رضایی'
        )
        self.supervisor = User.objects.create_user(
            username='test_supervisor',
            password='Password123!',
            first_name='مهندس',
            last_name='احمدی'
        )
        self.project = FinancialProject.objects.create(
            code='PRJ-SHIRAZ',
            name='پروژه انبار مرکزی شیراز',
            description='انبار لجستیک جنوب کشور'
        )
        self.section = ProjectSection.objects.create(
            project=self.project,
            code='SEC-TRANS',
            name='بخش ترابری و لجستیک'
        )

    def test_section_guardian_automated_audit(self):
        """اجرای ممیزی خودکار ایجنت نگهبان"""
        guardian = SectionGuardian()
        self.assertTrue(guardian.audit_phase_1_foundation())

    def test_financial_project_and_section_creation(self):
        """تست ایجاد پروژه و بخش و روابط یکتایی"""
        self.assertEqual(str(self.project), "پروژه انبار مرکزی شیراز (PRJ-SHIRAZ)")
        self.assertEqual(str(self.section), "پروژه انبار مرکزی شیراز - بخش ترابری و لجستیک (SEC-TRANS)")
        self.assertEqual(self.project.sections.count(), 1)
        self.assertEqual(self.project.sections.first(), self.section)

    def test_user_section_assignment(self):
        """تست انتساب کاربر به بخش با نقش‌های مجاز"""
        assignment = UserSectionAssignment.objects.create(
            user=self.user,
            section=self.section,
            role='employee'
        )
        self.assertEqual(assignment.role, 'employee')
        self.assertTrue(assignment.is_active)
        self.assertEqual(self.user.section_assignments.count(), 1)

    def test_counterparty_creation(self):
        """تست ایجاد طرف‌حساب و اتصال اختیاری به بخش"""
        cp = Counterparty.objects.create(
            name='تعمیرگاه تخصصی دیزل پارس',
            counterparty_type='repair_shop',
            phone='09171234567',
            section=self.section
        )
        self.assertEqual(cp.counterparty_type, 'repair_shop')
        self.assertEqual(cp.section, self.section)
        self.assertIn("تعمیرگاه", str(cp))

    def test_expense_invoice_draft_invariant(self):
        """تست الزام وضعیت پیش‌نویس (draft) برای فاکتور جدید"""
        cp = Counterparty.objects.create(
            name='جایگاه سوخت پارسیان',
            counterparty_type='fuel_station',
            section=self.section
        )
        invoice = ExpenseInvoice.objects.create(
            section=self.section,
            counterparty=cp,
            invoice_number='INV-1404-001',
            invoice_date_shamsi='1404/05/10',
            amount=Decimal('5500000'),
            category='سوخت ناوگان',
            description='بنزین و گازوئیل خودروهای شیفت روز',
            created_by=self.user
        )
        self.assertEqual(invoice.status, 'draft', "وضعیت اولیه فاکتور باید اجباراً draft باشد")
        self.assertEqual(invoice.amount, Decimal('5500000'))
        self.assertIn("INV-1404-001", str(invoice))

    def test_backward_compatibility_existing_models_without_project(self):
        """تست عدم وابستگی اجباری و کارکرد کامل رکوردهای قدیمی بدون پروژه و بخش"""
        personnel = PersonnelProfile.objects.create(
            first_name='حسن',
            last_name='مرادی',
            national_code='1234567890',
            job_title='کارشناس انبار'
        )
        self.assertIsNone(personnel.project)
        self.assertIsNone(personnel.section)

        # انتساب اختیاری
        personnel.project = self.project
        personnel.section = self.section
        personnel.save()
        self.assertEqual(personnel.project, self.project)
        self.assertEqual(personnel.section, self.section)

        # کارکرد روزانه پرسنل
        attendance = DailyAttendance.objects.create(
            personnel=personnel,
            date_shamsi='1404/05/12',
            project=self.project,
            section=self.section,
            effective_hours=Decimal('10.00')
        )
        self.assertEqual(attendance.section, self.section)


class SectionGuardianPhase2APITests(TestCase):
    """
    تست‌های یکپارچگی اندپوینت‌های API فاز ۲ (مدیریت پروژه، بخش و انتساب کاربران)
    """

    def setUp(self):
        self.client = APIClient()
        self.admin_user = User.objects.create_superuser(
            username='admin_boss',
            password='AdminPassword123!',
            email='admin@company.com'
        )
        self.employee_user = User.objects.create_user(
            username='employee_ali',
            password='Password123!'
        )
        self.client.force_authenticate(user=self.admin_user)

    def test_api_crud_financial_project(self):
        """تست ایجاد و دریافت پروژه از طریق API"""
        res = self.client.post('/api/personnel/financial-projects/', {
            'code': 'PRJ-TEHRAN',
            'name': 'پروژه پایانه تهران غرب',
            'description': 'انبار توزیع مکانیزه پایتخت'
        }, format='json')
        self.assertEqual(res.status_code, 201)
        project_id = res.data['id']

        # لیست پروژه‌ها
        get_res = self.client.get('/api/personnel/financial-projects/')
        self.assertEqual(get_res.status_code, 200)
        self.assertTrue(any(p['code'] == 'PRJ-TEHRAN' for p in get_res.data))

        # ایجاد بخش ذیل پروژه
        sec_res = self.client.post('/api/personnel/project-sections/', {
            'project': project_id,
            'code': 'SEC-WAREHOUSE',
            'name': 'بخش تفکیک و بسته‌بندی'
        }, format='json')
        self.assertEqual(sec_res.status_code, 201)
        sec_id = sec_res.data['id']

        # انتساب کاربر به بخش
        assign_res = self.client.post('/api/personnel/user-section-assignments/', {
            'user': self.employee_user.id,
            'section': sec_id,
            'role': 'employee'
        }, format='json')
        self.assertEqual(assign_res.status_code, 201)
        self.assertEqual(assign_res.data['role'], 'employee')

        # لاگین به عنوان کارمند و دریافت my-sections
        self.client.force_authenticate(user=self.employee_user)
        my_sec_res = self.client.get('/api/personnel/user-section-assignments/my-sections/')
        self.assertEqual(my_sec_res.status_code, 200)
        self.assertEqual(len(my_sec_res.data), 1)
        self.assertEqual(my_sec_res.data[0]['code'], 'SEC-WAREHOUSE')

    def test_api_counterparty_and_invoice(self):
        """تست تعریف طرف‌حساب و صدور فاکتور هزینه با قفل draft"""
        proj = FinancialProject.objects.create(code='PRJ-ISFAHAN', name='پروژه اصفهان')
        sec = ProjectSection.objects.create(project=proj, code='SEC-FLEET', name='ناوگان اصفهان')

        # تعریف طرف‌حساب
        cp_res = self.client.post('/api/personnel/counterparties/', {
            'name': 'فروشگاه لوازم یدکی سپاهان',
            'counterparty_type': 'repair_shop',
            'phone': '03131234567',
            'section': sec.id
        }, format='json')
        self.assertEqual(cp_res.status_code, 201)
        cp_id = cp_res.data['id']

        # ثبت فاکتور
        inv_res = self.client.post('/api/personnel/expense-invoices/', {
            'section': sec.id,
            'counterparty': cp_id,
            'invoice_number': 'FAK-9901',
            'invoice_date_shamsi': '1404/05/15',
            'amount': 12500000,
            'category': 'تعمیرات و تعویض روغن',
            'description': 'سرویس دوره‌ای کامیون‌ها'
        }, format='json')
        self.assertEqual(inv_res.status_code, 201)
        self.assertEqual(inv_res.data['status'], 'draft', "فاکتور باید در وضعیت draft ایجاد شود")

    def test_clone_assignments_api(self):
        """تست اختصاصی تکثیر و کپی چارت سازمانی از بخش مبدأ به مقصد"""
        proj = FinancialProject.objects.create(code='PRJ-CLONE', name='پروژه تکثیر چارت')
        sec_source = ProjectSection.objects.create(project=proj, code='SEC-SRC', name='بخش الگو')
        sec_target = ProjectSection.objects.create(project=proj, code='SEC-TGT', name='بخش مقصد')

        # انتساب کاربر به بخش مبدأ
        UserSectionAssignment.objects.create(
            user=self.admin_user,
            section=sec_source,
            role='manager',
            is_active=True
        )
        UserSectionAssignment.objects.create(
            user=self.employee_user,
            section=sec_source,
            role='employee',
            is_active=True
        )

        # فراخوانی اکشن کپی چارت
        url = f'/api/personnel/project-sections/{sec_target.id}/clone-assignments/'
        res = self.client.post(url, {'source_section_id': sec_source.id}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data['success'])
        self.assertEqual(res.data['copied_count'], 2)

        # بررسی وجود انتساب‌ها در بخش مقصد
        target_assignments = UserSectionAssignment.objects.filter(section=sec_target)
        self.assertEqual(target_assignments.count(), 2)
        roles = set(target_assignments.values_list('role', flat=True))
        self.assertEqual(roles, {'manager', 'employee'})

        # فراخوانی مجدد (باید انتساب تکراری اضافه نکند)
        res_duplicate = self.client.post(url, {'source_section_id': sec_source.id}, format='json')
        self.assertEqual(res_duplicate.status_code, 200)
        self.assertEqual(res_duplicate.data['copied_count'], 0)
        self.assertEqual(res_duplicate.data['skipped_count'], 2)

    def test_excel_export_and_template_endpoints(self):
        """تست اندپوینت‌های صدور و قالب اکسل برای پروژه‌ها، بخش‌ها و انتساب‌ها"""
        # پروژه‌ها
        res_prj_exp = self.client.get('/api/personnel/financial-projects/export-excel/')
        self.assertEqual(res_prj_exp.status_code, 200)
        self.assertIn('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', res_prj_exp['Content-Type'])

        res_prj_tpl = self.client.get('/api/personnel/financial-projects/download-template/')
        self.assertEqual(res_prj_tpl.status_code, 200)

        # بخش‌ها
        res_sec_exp = self.client.get('/api/personnel/project-sections/export-excel/')
        self.assertEqual(res_sec_exp.status_code, 200)

        res_sec_tpl = self.client.get('/api/personnel/project-sections/download-template/')
        self.assertEqual(res_sec_tpl.status_code, 200)

        # انتساب‌ها
        res_asn_exp = self.client.get('/api/personnel/user-section-assignments/export-excel/')
        self.assertEqual(res_asn_exp.status_code, 200)

        res_asn_tpl = self.client.get('/api/personnel/user-section-assignments/download-template/')
        self.assertEqual(res_asn_tpl.status_code, 200)

    def test_bulk_assign_api(self):
        """تست اختصاصی انتساب دسته‌جمعی چند کاربر به یک بخش و نقش"""
        proj = FinancialProject.objects.create(code='PRJ-BULK', name='پروژه تست گروهی')
        sec = ProjectSection.objects.create(project=proj, code='SEC-BLK', name='بخش انتساب چندگانه')

        # درخواست انتساب همزمان مدیر و کارمند
        url = '/api/personnel/user-section-assignments/bulk-assign/'
        payload = {
            'section_id': sec.id,
            'user_ids': [self.admin_user.id, self.employee_user.id],
            'role': 'accountant'
        }
        res = self.client.post(url, payload, format='json')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(len(res.data), 2)
        self.assertTrue(all(a['role'] == 'accountant' for a in res.data))
        self.assertTrue(all(a['section'] == sec.id for a in res.data))

        # بررسی در دیتابیس
        count = UserSectionAssignment.objects.filter(section=sec, role='accountant', is_active=True).count()
        self.assertEqual(count, 2)


