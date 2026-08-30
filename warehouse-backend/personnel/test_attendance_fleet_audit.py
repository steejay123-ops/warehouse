from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from personnel.models import (
    PersonnelProfile,
    DailyAttendance,
    MonthlyWorkPeriod,
    VehicleDriverProfile,
    VehicleTripLog,
)
from warehouses.models import Warehouse

User = get_user_model()

class AttendanceAndFleetAuditTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_superuser(
            username='admin_audit',
            password='Password123!',
            email='audit@example.com'
        )
        self.client.force_authenticate(user=self.user)

        self.warehouse1 = Warehouse.objects.create(name='انبار مرکزی', is_active=True)
        self.warehouse2 = Warehouse.objects.create(name='انبار غرب', is_active=True)

        self.personnel1 = PersonnelProfile.objects.create(
            first_name='علی',
            last_name='رضایی',
            national_code='0012345678',
            assigned_warehouse=self.warehouse1,
            daily_base_wage=5000000,
            is_active=True
        )

        self.personnel_floating = PersonnelProfile.objects.create(
            first_name='محمد',
            last_name='شناور',
            national_code='0098765432',
            assigned_warehouse=None,
            daily_base_wage=5000000,
            is_active=True
        )

        self.vehicle1 = VehicleDriverProfile.objects.create(
            driver_name='حسن راننده',
            plate_number='12ع345-67',
            assigned_warehouse=self.warehouse1,
            default_service_rate=1500000,
            is_active=True
        )

    def test_01_bulk_save_preserves_assigned_warehouse_when_floating_or_null(self):
        """
        تست اصلاح انتساب خودکار انبار در ثبت سراسری بدون نال شدن warehouse_id
        """
        payload = {
            'warehouse_id': None,
            'date_shamsi': '1405/06/08',
            'is_override': True,
            'items': [
                {
                    'personnel_id': self.personnel1.id,
                    'warehouse_id': None,
                    'status': 'PRESENT_10H',
                    'effective_hours': 10,
                    'overtime_hours': 2,
                    'is_friday_work': False,
                    'is_mission': False,
                    'advance_payment': 0,
                    'notes': 'تست انتساب انبار'
                }
            ]
        }
        res = self.client.post('/api/personnel/attendance/bulk-save/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        att = DailyAttendance.objects.get(personnel=self.personnel1, date_shamsi='1405/06/08')
        self.assertEqual(att.warehouse_id, self.warehouse1.id)

    def test_02_absent_and_leave_hours_are_sanitized_to_zero(self):
        """
        تست ریست و پاکسازی خودکار ساعات موثر و اضافه‌کار در وضعیت غیبت و مرخصی
        """
        payload = {
            'warehouse_id': self.warehouse1.id,
            'date_shamsi': '1405/06/09',
            'is_override': True,
            'items': [
                {
                    'personnel_id': self.personnel1.id,
                    'warehouse_id': self.warehouse1.id,
                    'status': 'ABSENT',
                    'effective_hours': 10,  # ارسال اشتباه ساعت برای غایب
                    'overtime_hours': 4,    # ارسال اشتباه اضافه‌کار برای غایب
                    'is_friday_work': True,
                    'is_mission': True,
                    'advance_payment': 0,
                    'notes': 'غایب غیرموجه'
                }
            ]
        }
        res = self.client.post('/api/personnel/attendance/bulk-save/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        att = DailyAttendance.objects.get(personnel=self.personnel1, date_shamsi='1405/06/09')
        self.assertEqual(att.status, 'ABSENT')
        self.assertEqual(float(att.effective_hours), 0.0)
        self.assertEqual(float(att.overtime_hours), 0.0)
        self.assertFalse(att.is_friday_work)
        self.assertFalse(att.is_mission)

    def test_03_get_matrix_does_not_propagate_friday_work_to_non_fridays(self):
        """
        تست قطع سرایت پیش‌فرض جمعه‌کاری روز قبل به روزهای عادی بعد در متد get_matrix
        """
        DailyAttendance.objects.create(
            personnel=self.personnel1,
            warehouse=self.warehouse1,
            date_shamsi='1405/06/06',
            status='FRIDAY_WORK',
            effective_hours=10,
            overtime_hours=0,
            is_friday_work=True,
            created_by=self.user
        )

        # فراخوانی ماتریس برای روز بعد 1405/06/07 (شنبه - غیر جمعه)
        res = self.client.get('/api/personnel/attendance/matrix/?date_shamsi=1405/06/07')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        rows = res.data['rows']
        p1_row = next(r for r in rows if r['personnel_id'] == self.personnel1.id)

        self.assertNotEqual(p1_row['status'], 'FRIDAY_WORK')
        self.assertFalse(p1_row['is_friday_work'])

    def test_04_vehicle_bulk_save_supports_nullable_warehouse_id(self):
        """
        تست پشتیبانی از ذخیره سراسری و شناور تردد ناوگان با warehouse_id اختیاری
        """
        payload = {
            'warehouse_id': None,
            'date_shamsi': '1405/06/08',
            'items': [
                {
                    'vehicle_id': self.vehicle1.id,
                    'trip_count': 3,
                    'unit_rate': 1500000,
                    'dispatch_reference': 'DSP-9988',
                    'origin_destination': 'انبار به کارخانه',
                    'notes': 'تست تردد بدون انبار سراسری'
                }
            ]
        }
        res = self.client.post('/api/personnel/trips/bulk-save/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        trip = VehicleTripLog.objects.get(vehicle=self.vehicle1, date_shamsi='1405/06/08')
        self.assertEqual(trip.trip_count, 3)
        self.assertEqual(trip.warehouse_id, self.warehouse1.id)
        self.assertEqual(trip.total_amount, 4500000)

    def test_05_monthly_grid_bulk_save_sanitizes_hours_and_preserves_warehouse(self):
        """
        تست ذخیره ماتریس ۳۱ روزه و پاکسازی ساعات در وضعیت غیبت/مرخصی
        """
        payload = {
            'warehouse_id': None,
            'year_month': '1405/06',
            'is_override': True,
            'items': [
                {
                    'personnel_id': self.personnel1.id,
                    'day': 10,
                    'status': 'LEAVE',
                    'effective_hours': 10,
                    'overtime_hours': 3,
                    'is_friday_work': False,
                    'is_mission': False,
                    'advance_payment': 0,
                    'notes': 'مرخصی استحقاقی'
                }
            ]
        }
        res = self.client.post('/api/personnel/attendance/bulk-save-monthly-grid/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        att = DailyAttendance.objects.get(personnel=self.personnel1, date_shamsi='1405/06/10')
        self.assertEqual(att.status, 'LEAVE')
        self.assertEqual(float(att.effective_hours), 0.0)
        self.assertEqual(float(att.overtime_hours), 0.0)
        self.assertEqual(att.warehouse_id, self.warehouse1.id)
