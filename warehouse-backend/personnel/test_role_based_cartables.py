from django.test import TestCase
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from decimal import Decimal
from personnel.models import (
    PersonnelProfile,
    VehicleDriverProfile,
    PersonnelChangeRequest,
    VehicleChangeRequest,
    MonthlyWorkPeriod,
    PayrollYearlySettings,
    JobGradeTier
)

User = get_user_model()

class RoleBasedCartablesTestCase(TestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(
            username='cartable_admin',
            email='admin@example.com',
            password='password123'
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

        # Base Yearly Settings & Job Grades
        self.settings = PayrollYearlySettings.objects.create(
            fiscal_year='1405',
            title='قانون کار ۱۴۰۵',
            is_active=True,
            attendance_edit_past_days=3,
            attendance_edit_future_days=0
        )
        for g in range(1, 21):
            JobGradeTier.objects.create(
                yearly_settings=self.settings,
                grade_number=g,
                daily_base_wage=Decimal(1000000 + g * 50000),
                daily_seniority_bonus=Decimal(g * 10000)
            )

        # Draft Personnel Profile
        self.personnel = PersonnelProfile.objects.create(
            first_name='علی',
            last_name='تقوی',
            national_code='1122334455',
            approval_status='draft',
            is_active=False
        )

        # Draft Vehicle Profile
        self.vehicle = VehicleDriverProfile.objects.create(
            driver_name='حسن مرادی',
            plate_number='33-888-11',
            default_service_rate=Decimal(3500000),
            approval_status='draft',
            is_active=False
        )

    def test_01_base_settings_endpoint(self):
        """بررسی بازیابی تنظیمات پایه و ۲۰ گروه شغلی"""
        response = self.client.get('/api/personnel/settings/active-or-year/?year=1405')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data.get('job_grades', [])), 20)

    def test_02_manager_approval_flow(self):
        """بررسی تایید مرحله اول مدیر برای پرسنل و ناوگان"""
        # Personnel Manager Approval
        res = self.client.post(f'/api/personnel/profiles/{self.personnel.id}/approve-manager/')
        self.assertEqual(res.status_code, 200)
        self.personnel.refresh_from_db()
        self.assertEqual(self.personnel.approval_status, 'manager_approved')

        # Vehicle Manager Approval
        res_v = self.client.post(f'/api/personnel/vehicles/{self.vehicle.id}/approve-manager/')
        self.assertEqual(res_v.status_code, 200)
        self.vehicle.refresh_from_db()
        self.assertEqual(self.vehicle.approval_status, 'manager_approved')

    def test_03_finance_final_approval_flow(self):
        """بررسی تایید مرحله دوم و نهایی مالی و فعال‌سازی پرونده"""
        self.personnel.approval_status = 'manager_approved'
        self.personnel.save()
        self.vehicle.approval_status = 'manager_approved'
        self.vehicle.save()

        # Finance Personnel Approval
        res = self.client.post(f'/api/personnel/profiles/{self.personnel.id}/approve-finance/')
        self.assertEqual(res.status_code, 200)
        self.personnel.refresh_from_db()
        self.assertEqual(self.personnel.approval_status, 'approved')

        # Finance Vehicle Approval
        res_v = self.client.post(f'/api/personnel/vehicles/{self.vehicle.id}/approve-finance/')
        self.assertEqual(res_v.status_code, 200)
        self.vehicle.refresh_from_db()
        self.assertEqual(self.vehicle.approval_status, 'approved')

    def test_04_change_requests_diff_and_approval(self):
        """بررسی کارتابل تغییرات و اعمال متادیتا"""
        cr = PersonnelChangeRequest.objects.create(
            personnel=self.personnel,
            proposed_changes={'first_name': 'علیرضا'},
            previous_values={'first_name': 'علی'},
            status='pending_manager',
            requested_by=self.admin
        )
        # Manager Approval of CR
        res = self.client.post(f'/api/personnel/personnel-change-requests/{cr.id}/approve-manager/')
        self.assertEqual(res.status_code, 200)
        cr.refresh_from_db()
        self.assertEqual(cr.status, 'manager_approved')

        # Finance Approval of CR
        res_f = self.client.post(f'/api/personnel/personnel-change-requests/{cr.id}/approve-finance/')
        self.assertEqual(res_f.status_code, 200)
        cr.refresh_from_db()
        self.assertEqual(cr.status, 'approved')
        self.personnel.refresh_from_db()
        self.assertEqual(self.personnel.first_name, 'علیرضا')

    def test_05_fleet_settlement_calculation(self):
        """بررسی اندپوینت محاسبه تسویه ناوگان"""
        res = self.client.get('/api/personnel/fleet-settlement/calculate/?year_month=1405/04')
        self.assertEqual(res.status_code, 200)
        self.assertIn('records', res.data)
        self.assertIn('summary', res.data)
