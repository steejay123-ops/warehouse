from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from personnel.models import Company, FinancialProject, ProjectSection, UserSectionAssignment, UserCompanyAccess

User = get_user_model()

class CompanyMultiTenantTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin_user = User.objects.create_superuser(
            username='admin_multitenant',
            password='password123',
            email='admin@test.com'
        )
        self.regular_user = User.objects.create_user(
            username='regular_staff',
            password='password123',
            email='staff@test.com'
        )

        # شرکت‌های تست
        self.company_pts = Company.objects.create(
            code='PTS_TEST',
            name='پاینده توان ساینا تست',
            national_id='14008123456',
            economic_code='411512345678',
            is_active=True
        )
        self.company_fa = Company.objects.create(
            code='FA_TEST',
            name='فارس عالیش تست',
            national_id='14009876543',
            economic_code='411698765432',
            is_active=True
        )

        # پروژه‌ها
        self.proj_dalan = FinancialProject.objects.create(
            company=self.company_pts,
            code='PRJ_DALAN',
            name='پروژه دالان'
        )
        self.proj_parsian = FinancialProject.objects.create(
            company=self.company_pts,
            code='PRJ_PARSIAN',
            name='پروژه پارسیان'
        )
        self.proj_anbar = FinancialProject.objects.create(
            company=self.company_fa,
            code='PRJ_ANBAR',
            name='پروژه انبارداری'
        )

    def test_superuser_can_list_and_create_company(self):
        self.client.force_authenticate(user=self.admin_user)
        res = self.client.get('/api/personnel/companies/')
        self.assertEqual(res.status_code, 200)
        codes = [c['code'] for c in res.json()]
        self.assertIn('PTS_TEST', codes)
        self.assertIn('FA_TEST', codes)

        # ایجاد شرکت جدید
        create_res = self.client.post('/api/personnel/companies/', {
            'code': 'NEW_CO',
            'name': 'شرکت جدید آزمایشی',
            'national_id': '14001112233'
        })
        self.assertEqual(create_res.status_code, 201)
        self.assertEqual(create_res.json()['name'], 'شرکت جدید آزمایشی')

    def test_company_national_id_validation(self):
        self.client.force_authenticate(user=self.admin_user)
        # شناسه ملی کمتر از ۱۱ رقم
        res = self.client.post('/api/personnel/companies/', {
            'code': 'INVALID_CO',
            'name': 'شرکت نامعتبر',
            'national_id': '12345'
        })
        self.assertEqual(res.status_code, 400)
        self.assertIn('۱۱ رقم', str(res.json()))

    def test_user_available_companies_hybrid_access(self):
        # ۱. ابتدا کاربر عادی به هیچ شرکتی دسترسی ندارد
        self.client.force_authenticate(user=self.regular_user)
        res = self.client.get('/api/personnel/companies/user-available/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['count'], 0)

        # ۲. انتساب مستقیم کاربر به شرکت PTS
        UserCompanyAccess.objects.create(
            user=self.regular_user,
            company=self.company_pts,
            is_default=True
        )
        res = self.client.get('/api/personnel/companies/user-available/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['count'], 1)
        self.assertEqual(res.json()['companies'][0]['code'], 'PTS_TEST')

        # ۳. انتساب ضمنی از طریق عضویت در بخش پروژه انبارداری (شرکت FA)
        sec_anbar = ProjectSection.objects.create(
            project=self.proj_anbar,
            code='SEC_LOGISTICS',
            name='بخش لجستیک انبار'
        )
        UserSectionAssignment.objects.create(
            user=self.regular_user,
            section=sec_anbar,
            role='supervisor',
            is_active=True
        )
        res = self.client.get('/api/personnel/companies/user-available/')
        self.assertEqual(res.status_code, 200)
        # اکنون باید به هر دو شرکت دسترسی داشته باشد (۱ مستقیم + ۱ مشتق‌شده)
        self.assertEqual(res.json()['count'], 2)

    def test_financial_project_filtering_by_company(self):
        self.client.force_authenticate(user=self.admin_user)

        # فیلتر بر مبنای شرکت PTS
        res_pts = self.client.get('/api/personnel/financial-projects/', {
            'company_id': self.company_pts.id
        })
        self.assertEqual(res_pts.status_code, 200)
        pts_codes = [p['code'] for p in res_pts.json()]
        self.assertIn('PRJ_DALAN', pts_codes)
        self.assertIn('PRJ_PARSIAN', pts_codes)
        self.assertNotIn('PRJ_ANBAR', pts_codes)

        # فیلتر بر مبنای هدر X-Company-ID
        res_header = self.client.get(
            '/api/personnel/financial-projects/',
            HTTP_X_COMPANY_ID=str(self.company_fa.id)
        )
        self.assertEqual(res_header.status_code, 200)
        fa_codes = [p['code'] for p in res_header.json()]
        self.assertIn('PRJ_ANBAR', fa_codes)
        self.assertNotIn('PRJ_DALAN', fa_codes)
        # بررسی فیلد شرکت در سریالایزر پروژه
        self.assertEqual(res_header.json()[0]['company_name'], 'فارس عالیش تست')
