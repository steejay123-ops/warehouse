import io
from datetime import timedelta
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework import status

from personnel.models import Company, CompanyDocument, CompanyBankAccount, UserCompanyAccess
from personnel.serializers import CompanySerializer

User = get_user_model()


class CompanyDocumentTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.superuser = User.objects.create_superuser(
            username='admin_doc',
            password='Password123!',
            email='admin_doc@example.com'
        )

        self.user_a = User.objects.create_user(
            username='user_comp_a',
            password='Password123!',
            email='usera@example.com'
        )

        self.user_b = User.objects.create_user(
            username='user_comp_b',
            password='Password123!',
            email='userb@example.com'
        )

        self.company_a = Company.objects.create(
            code='CMPA',
            name='شرکت آلفا',
            company_type='private_joint_stock',
            national_id='14001234567',
            workshop_code='1234567890',
            tax_memory_id='A1B2C3',
            primary_iban='IR120120000000001234567890',
            has_warehouse_module=True,
            is_active=True
        )

        self.company_b = Company.objects.create(
            code='CMPB',
            name='شرکت بتا',
            company_type='holding',
            national_id='14009876543',
            has_warehouse_module=False,
            is_active=True
        )

        # انتساب دسترسی کاربر A به شرکت A
        UserCompanyAccess.objects.create(user=self.user_a, company=self.company_a, is_default=True)
        # انتساب دسترسی کاربر B به شرکت B
        UserCompanyAccess.objects.create(user=self.user_b, company=self.company_b, is_default=True)

    def test_company_document_model_and_expiry_status(self):
        """تست محاسبات تاریخ انقضا و پراپرتی‌های وضعیت اعتبار سند"""
        today = timezone.now().date()

        # ۱. سند بدون تاریخ انقضا (دائمی)
        doc_perm = CompanyDocument.objects.create(
            company=self.company_a,
            document_type='statute',
            title='اساسنامه شرکت آلفا',
            file=SimpleUploadedFile('statute.pdf', b'content-pdf', content_type='application/pdf')
        )
        self.assertEqual(doc_perm.expiry_status, 'permanent')
        self.assertIsNone(doc_perm.days_until_expiry)

        # ۲. سند منقضی شده
        doc_exp = CompanyDocument.objects.create(
            company=self.company_a,
            document_type='operating_license',
            title='پروانه بهره‌برداری منقضی',
            file=SimpleUploadedFile('license.pdf', b'license', content_type='application/pdf'),
            expiry_date=today - timedelta(days=5)
        )
        self.assertEqual(doc_exp.expiry_status, 'expired')
        self.assertTrue(doc_exp.days_until_expiry < 0)

        # ۳. سند نزدیک به انقضا (کمتر از ۳۰ روز)
        doc_soon = CompanyDocument.objects.create(
            company=self.company_a,
            document_type='commercial_card',
            title='کارت بازرگانی در آستانه انقضا',
            file=SimpleUploadedFile('card.pdf', b'card', content_type='application/pdf'),
            expiry_date=today + timedelta(days=12)
        )
        self.assertEqual(doc_soon.expiry_status, 'expiring_soon')
        self.assertEqual(doc_soon.days_until_expiry, 12)

        # ۴. سند کاملاً معتبر
        doc_valid = CompanyDocument.objects.create(
            company=self.company_a,
            document_type='contractor_qualification',
            title='گواهی رتبه‌بندی معتبر',
            file=SimpleUploadedFile('rank.pdf', b'rank', content_type='application/pdf'),
            expiry_date=today + timedelta(days=150)
        )
        self.assertEqual(doc_valid.expiry_status, 'valid')
        self.assertEqual(doc_valid.days_until_expiry, 150)

    def test_company_serializer_health_status(self):
        """تست سریالایزر شرکت و متادیتای خلاصه سلامت مدارک"""
        # شرکت بدون مدرک
        serializer_b = CompanySerializer(self.company_b)
        self.assertEqual(serializer_b.data['documents_health_status'], 'no_documents')
        self.assertEqual(serializer_b.data['documents_count'], 0)

        # ایجاد مدرک معتبر برای شرکت A
        today = timezone.now().date()
        CompanyDocument.objects.create(
            company=self.company_a,
            document_type='statute',
            title='اساسنامه',
            file=SimpleUploadedFile('statute.pdf', b'statute')
        )
        CompanyDocument.objects.create(
            company=self.company_a,
            document_type='vat_certificate',
            title='گواهی ارزش افزوده',
            file=SimpleUploadedFile('vat.pdf', b'vat'),
            expiry_date=today + timedelta(days=90)
        )
        serializer_a = CompanySerializer(self.company_a)
        self.assertEqual(serializer_a.data['documents_health_status'], 'valid')
        self.assertEqual(serializer_a.data['documents_count'], 2)

        # افزودن مدرک منقضی
        CompanyDocument.objects.create(
            company=self.company_a,
            document_type='commercial_card',
            title='کارت بازرگانی',
            file=SimpleUploadedFile('card.pdf', b'card'),
            expiry_date=today - timedelta(days=1)
        )
        serializer_a_updated = CompanySerializer(self.company_a)
        self.assertEqual(serializer_a_updated.data['documents_health_status'], 'expired')
        self.assertEqual(serializer_a_updated.data['documents_count'], 3)

    def test_confidential_document_isolation(self):
        """تست امنیت اسناد محرمانه و عدم نمایش به کاربران عادی"""
        # ایجاد سند محرمانه توسط سوپریوزر
        doc_conf = CompanyDocument.objects.create(
            company=self.company_a,
            document_type='master_agreement',
            title='قرارداد محرمانه سهامداران',
            file=SimpleUploadedFile('secret.pdf', b'confidential-content'),
            is_confidential=True
        )
        doc_pub = CompanyDocument.objects.create(
            company=self.company_a,
            document_type='statute',
            title='اساسنامه عمومی',
            file=SimpleUploadedFile('statute.pdf', b'public-content'),
            is_confidential=False
        )

        # ورود به عنوان کاربر عادی A
        self.client.force_authenticate(user=self.user_a)
        resp_user = self.client.get(f'/api/personnel/company-documents/?company_id={self.company_a.id}')
        self.assertEqual(resp_user.status_code, status.HTTP_200_OK)
        results_user = resp_user.data if isinstance(resp_user.data, list) else resp_user.data.get('results', [])
        ids_user = [d['id'] for d in results_user]
        self.assertIn(doc_pub.id, ids_user)
        self.assertNotIn(doc_conf.id, ids_user, "سند محرمانه نباید برای کاربر عادی قابل مشاهده باشد.")

        # ورود به عنوان سوپریوزر
        self.client.force_authenticate(user=self.superuser)
        resp_admin = self.client.get(f'/api/personnel/company-documents/?company_id={self.company_a.id}')
        self.assertEqual(resp_admin.status_code, status.HTTP_200_OK)
        results_admin = resp_admin.data if isinstance(resp_admin.data, list) else resp_admin.data.get('results', [])
        ids_admin = [d['id'] for d in results_admin]
        self.assertIn(doc_conf.id, ids_admin, "سوپریوزر باید به اسناد محرمانه دسترسی کامل داشته باشد.")

    def test_user_company_access_bola_protection(self):
        """تست ممانعت از دسترسی BOLA بین شرکت‌های مجزا"""
        # کاربر B حق دسترسی به شرکت A را ندارد
        self.client.force_authenticate(user=self.user_b)
        resp = self.client.get(f'/api/personnel/company-documents/?company_id={self.company_a.id}')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

        # تلاش کاربر B برای بارگذاری مدرک در شرکت A
        test_file = SimpleUploadedFile('test.pdf', b'content', content_type='application/pdf')
        resp_create = self.client.post('/api/personnel/company-documents/', {
            'company': self.company_a.id,
            'document_type': 'statute',
            'title': 'نفوذ غیرمجاز',
            'file': test_file
        }, format='multipart')
        self.assertEqual(resp_create.status_code, status.HTTP_403_FORBIDDEN)

    def test_expiring_documents_action(self):
        """تست اکشن تجمیعی اسناد در آستانه انقضا جهت خوراک ویجت مرکز عملیات"""
        today = timezone.now().date()
        # سند منقضی در شرکت A
        CompanyDocument.objects.create(
            company=self.company_a,
            document_type='vat_certificate',
            title='ارزش افزوده منقضی',
            file=SimpleUploadedFile('vat.pdf', b'vat'),
            expiry_date=today - timedelta(days=2)
        )
        # سند نزدیک به انقضا در شرکت A (۱۰ روز)
        CompanyDocument.objects.create(
            company=self.company_a,
            document_type='commercial_card',
            title='کارت بازرگانی نزدیک انقضا',
            file=SimpleUploadedFile('card.pdf', b'card'),
            expiry_date=today + timedelta(days=10)
        )
        # سند معتبر بلندمدت (۱۰۰ روز) - نباید در این اندپوینت بیاید
        CompanyDocument.objects.create(
            company=self.company_a,
            document_type='operating_license',
            title='مجوز بلندمدت',
            file=SimpleUploadedFile('lic.pdf', b'lic'),
            expiry_date=today + timedelta(days=100)
        )

        self.client.force_authenticate(user=self.superuser)
        resp = self.client.get('/api/personnel/companies/expiring-documents/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data['count'], 2)
        titles = [d['title'] for d in resp.data['results']]
        self.assertIn('ارزش افزوده منقضی', titles)
        self.assertIn('کارت بازرگانی نزدیک انقضا', titles)
        self.assertNotIn('مجوز بلندمدت', titles)

    def test_company_bank_accounts_crud_and_primary_sync(self):
        """تست مدیریت چند شماره شبا و همگام‌سازی حساب اصلی با مدل شرکت"""
        from personnel.sheba_utils import generate_sheba_from_account
        sheba_mellat = generate_sheba_from_account('012', '1234567890')
        sheba_melli = generate_sheba_from_account('017', '9876543210')

        self.client.force_authenticate(user=self.superuser)

        # ۱. ثبت حساب اول (ملت)
        resp1 = self.client.post('/api/personnel/company-bank-accounts/', {
            'company': self.company_a.id,
            'bank_name': 'بانک ملت',
            'account_number': '1234567890',
            'sheba_number': sheba_mellat,
            'account_title': 'حساب حقوق پرسنل'
        })
        self.assertEqual(resp1.status_code, status.HTTP_201_CREATED)
        acc1_id = resp1.data['id']
        self.assertTrue(resp1.data['is_primary'])

        # بررسی همگام‌سازی با شرکت
        self.company_a.refresh_from_db()
        self.assertEqual(self.company_a.primary_bank_name, 'بانک ملت')
        self.assertEqual(self.company_a.primary_account_number, '1234567890')
        self.assertEqual(self.company_a.primary_iban, sheba_mellat)

        # ۲. ثبت حساب دوم (ملی) بدون تعیین is_primary
        resp2 = self.client.post('/api/personnel/company-bank-accounts/', {
            'company': self.company_a.id,
            'bank_name': 'بانک ملی ایران',
            'account_number': '9876543210',
            'sheba_number': sheba_melli,
            'account_title': 'حساب بازرگانی و فروش'
        })
        self.assertEqual(resp2.status_code, status.HTTP_201_CREATED)
        acc2_id = resp2.data['id']
        self.assertFalse(resp2.data['is_primary'])

        # ۳. تغییر حساب اصلی به حساب دوم از طریق اکشن set-primary
        resp_set_primary = self.client.post(f'/api/personnel/company-bank-accounts/{acc2_id}/set-primary/')
        self.assertEqual(resp_set_primary.status_code, status.HTTP_200_OK)
        self.assertTrue(resp_set_primary.data['is_primary'])

        # حساب ۱ باید دیگر اصلی نباشد
        acc1 = CompanyBankAccount.objects.get(id=acc1_id)
        self.assertFalse(acc1.is_primary)

        # فیلدهای شرکت A باید به حساب ملی به‌روز شده باشند
        self.company_a.refresh_from_db()
        self.assertEqual(self.company_a.primary_bank_name, 'بانک ملی ایران')
        self.assertEqual(self.company_a.primary_account_number, '9876543210')
        self.assertEqual(self.company_a.primary_iban, sheba_melli)

    def test_company_bank_account_validation_and_isolation(self):
        """تست اعتبارسنجی شبا و ایزولاسیون شرکتی در حساب‌های بانکی"""
        # ۱. رد شبای نامعتبر
        self.client.force_authenticate(user=self.superuser)
        resp_invalid = self.client.post('/api/personnel/company-bank-accounts/', {
            'company': self.company_a.id,
            'bank_name': 'بانک ملت',
            'account_number': '1234567890',
            'sheba_number': 'IR000000000000000000000000',
            'account_title': 'حساب تستی'
        })
        self.assertEqual(resp_invalid.status_code, status.HTTP_400_BAD_REQUEST)

        # ۲. عدم اجازه به کاربر B جهت ایجاد حساب بانکی در شرکت A
        from personnel.sheba_utils import generate_sheba_from_account
        sheba_valid = generate_sheba_from_account('012', '5555555555')
        self.client.force_authenticate(user=self.user_b)
        resp_forbidden = self.client.post('/api/personnel/company-bank-accounts/', {
            'company': self.company_a.id,
            'bank_name': 'بانک ملت',
            'account_number': '5555555555',
            'sheba_number': sheba_valid,
            'account_title': 'تلاش غیرمجاز'
        })
        self.assertEqual(resp_forbidden.status_code, status.HTTP_403_FORBIDDEN)

