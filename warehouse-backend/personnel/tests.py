import os
from django.conf import settings
from django.test import TestCase
from django.core.management import call_command
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from warehouses.models import Warehouse
from .models import (
    PersonnelProfile,
    VehicleDriverProfile,
    MonthlyWorkPeriod,
    DailyAttendance,
    AttendanceAuditLog,
    VehicleTripLog,
    PayrollYearlySettings,
    MonthlyPayrollRecord
)

User = get_user_model()


class PersonnelAppTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_superuser(
            username='admin_test',
            password='testpassword123',
            national_code='1234567890'
        )
        self.client.force_authenticate(user=self.user)
        call_command('seed_payroll_settings')
        
        self.warehouse = Warehouse.objects.create(
            name='انبار مرکزی پارس',
            code='WH-PARS-01'
        )
        
        self.personnel1 = PersonnelProfile.objects.create(
            first_name='حسین',
            last_name='اکبری',
            national_code='2452304301',
            job_title='مدیر پروژه',
            daily_base_wage=6572696,
            assigned_warehouse=self.warehouse
        )
        
        self.personnel2 = PersonnelProfile.objects.create(
            first_name='علیرضا',
            last_name='عالیشوندی',
            national_code='4260006134',
            job_title='کمک انباردار',
            daily_base_wage=6044057,
            assigned_warehouse=self.warehouse
        )
        
        self.vehicle1 = VehicleDriverProfile.objects.create(
            plate_number='12-الف-345-ایران-72',
            vehicle_type='nissan',
            driver_name='محمد رضایی',
            default_service_rate=2500000,
            assigned_warehouse=self.warehouse
        )

    def test_personnel_hourly_rate(self):
        """تست نرخ ساعتی معادل ۱۰ ساعت در روز"""
        self.assertEqual(self.personnel1.hourly_rate, 657269.6)

    def test_matrix_get_and_bulk_save(self):
        """تست واکشی ماتریس و ذخیره سریع گروهی کارکرد"""
        date_str = '1404/05/10'
        res = self.client.get(f'/api/personnel/attendance/matrix/?warehouse_id={self.warehouse.id}&date_shamsi={date_str}')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data['rows']), 2)
        self.assertEqual(res.data['rows'][0]['status'], 'PRESENT_10H')

        # ذخیره گروهی
        save_payload = {
            'warehouse_id': self.warehouse.id,
            'date_shamsi': date_str,
            'items': [
                {
                    'personnel_id': self.personnel1.id,
                    'status': 'PRESENT_10H',
                    'effective_hours': 10.0,
                    'overtime_hours': 2.5,
                    'is_friday_work': False,
                    'is_mission': False,
                    'advance_payment': 0,
                    'notes': 'تست اضافه‌کار'
                },
                {
                    'personnel_id': self.personnel2.id,
                    'status': 'HALF_5H',
                    'effective_hours': 5.0,
                    'overtime_hours': 0.0,
                    'is_friday_work': False,
                    'is_mission': False,
                    'advance_payment': 500000,
                    'notes': 'نیمه‌وقت'
                }
            ]
        }
        res_save = self.client.post('/api/personnel/attendance/bulk-save/', save_payload, format='json')
        self.assertEqual(res_save.status_code, 200)
        self.assertEqual(res_save.data['saved_count'], 2)

        # ویرایش مجدد و بررسی ثبت لاگ ممیزی
        save_payload['items'][0]['overtime_hours'] = 4.0
        res_update = self.client.post('/api/personnel/attendance/bulk-save/', save_payload, format='json')
        self.assertEqual(res_update.status_code, 200)
        self.assertEqual(res_update.data['updated_count'], 2)
        
        # بررسی ثبت لاگ ممیزی
        logs = AttendanceAuditLog.objects.filter(field_name='overtime_hours')
        self.assertTrue(logs.exists())
        self.assertIn(logs.first().new_value, ['4.00', '4.0'])

    def test_vehicle_trips_bulk_save_and_summary(self):
        """تست ثبت سریع سرویس‌های خودرو و دریافت خلاصه ماهانه"""
        date_str = '1404/05/10'
        trip_payload = {
            'warehouse_id': self.warehouse.id,
            'date_shamsi': date_str,
            'items': [
                {
                    'vehicle_id': self.vehicle1.id,
                    'trip_count': 3,
                    'unit_rate': 2500000,
                    'dispatch_reference': 'DISP-1001',
                    'origin_destination': 'انبار به سایت عسلویه'
                }
            ]
        }
        res = self.client.post('/api/personnel/trips/bulk-save/', trip_payload, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['saved_count'], 1)

        # بررسی خلاصه ماهانه
        res_summary = self.client.get(f'/api/personnel/trips/monthly-summary/?warehouse_id={self.warehouse.id}&year_month=1404/05')
        self.assertEqual(res_summary.status_code, 200)
        self.assertEqual(res_summary.data['summary'][0]['total_trips'], 3)
        self.assertEqual(res_summary.data['summary'][0]['total_payable'], 7500000)

    def test_period_lock(self):
        """تست قفل شدن دوره و ممانعت از ویرایش"""
        date_str = '1404/05/10'
        period = MonthlyWorkPeriod.objects.create(
            warehouse=self.warehouse,
            year_month='1404/05',
            status='OPEN'
        )
        res_lock = self.client.post(f'/api/personnel/periods/{period.id}/lock/')
        self.assertEqual(res_lock.status_code, 200)
        period.refresh_from_db()
        self.assertEqual(period.status, 'LOCKED')

        # تلاش برای ثبت در دوره قفل شده
        payload = {
            'warehouse_id': self.warehouse.id,
            'date_shamsi': date_str,
            'items': []
        }
        res_err = self.client.post('/api/personnel/attendance/bulk-save/', payload, format='json')
        self.assertEqual(res_err.status_code, 400)

    def test_national_code_padding_and_wage_linkage(self):
        """تست پدینگ خودکار کد ملی و محاسبه خودکار مزد مبنا و نرخ ساعتی"""
        p = PersonnelProfile.objects.create(
            first_name='سعید',
            last_name='مرادی',
            national_code='245230430',  # 9 رقمی با صفر ابتدایی افتاده
            daily_base_wage=5000000,
            daily_seniority_bonus=200000
        )
        self.assertEqual(p.national_code, '0245230430')
        self.assertEqual(p.base_daily_rate, 5200000)
        self.assertEqual(p.hourly_rate, 520000.0)

    def test_excel_import_endpoint(self):
        """تست اندپوینت درون‌ریزی فایل اکسل شرکت"""
        excel_path = 'E:/warehouse project/Documents/SalaryCalculation/حقوق تیر ماه انبارداری.xlsm'
        if not os.path.exists(excel_path):
            excel_path = 'E:/warehouse project/حقوق تیر ماه انبارداری.xlsm'
        with open(excel_path, 'rb') as fp:
            res = self.client.post(
                f'/api/personnel/profiles/import-excel/?warehouse_id={self.warehouse.id}',
                {'file': fp},
                format='multipart'
            )
        self.assertEqual(res.status_code, 200)
        self.assertGreater(res.data['created_count'] + res.data['updated_count'], 40)
        
        # بررسی ثبت شدن پرسنل شیت Emp_info
        hossein = PersonnelProfile.objects.get(national_code='2452304301')
        self.assertEqual(hossein.first_name, 'حسین')
        self.assertEqual(hossein.last_name, 'اکبری')
        self.assertEqual(hossein.job_code, '027212')
        self.assertEqual(hossein.status_category, 'نفرات شرکتی')
        self.assertEqual(hossein.contract_hours, 230)

    def test_payroll_yearly_settings_and_job_grades(self):
        """تست تنظیمات سالانه حقوق و دریافت نرخ گروه شغلی"""
        res_settings = self.client.get('/api/personnel/settings/active-or-year/?year=1405')
        self.assertEqual(res_settings.status_code, 200)
        self.assertEqual(res_settings.data['fiscal_year'], '1405')

        # تست واکشی گروه شغلی ۱۹
        res_grade = self.client.get('/api/personnel/settings/job-grade-rate/?grade=19&year=1405')
        self.assertEqual(res_grade.status_code, 200)
        self.assertEqual(res_grade.data['daily_base_wage'], 6572696.0)
        self.assertEqual(res_grade.data['daily_seniority_bonus'], 171867.0)
        self.assertEqual(res_grade.data['hourly_rate'], 657269.6)

    def test_monthly_payroll_calculation_and_exports_flow(self):
        """تست جامع محاسبه حقوق ماهانه، تولید دیسکت‌های بیمه، فایل‌های مالیات و بانک"""
        # 1. محاسبه حقوق دوره تیر ماه ۱۴۰۵
        calc_payload = {
            'warehouse_id': self.warehouse.id,
            'year_month': '1405/04'
        }
        res_calc = self.client.post('/api/personnel/monthly-payroll/calculate-period/', calc_payload, format='json')
        self.assertEqual(res_calc.status_code, 200)
        self.assertGreater(len(res_calc.data['records']), 0)
        period_id = res_calc.data['period_id']

        # 2. تست صدور دیسکت‌های بیمه (ZIP حاوی DSKWOR00.DBF و DSKKAR00.DBF)
        res_dsk = self.client.get(f'/api/personnel/monthly-payroll/export-dsk-zip/?period_id={period_id}')
        self.assertEqual(res_dsk.status_code, 200)
        self.assertEqual(res_dsk['Content-Type'], 'application/zip')
        self.assertGreater(len(res_dsk.content), 1000)

        # 3. تست صدور فایل‌های مالیات حقوق (WH و WP)
        res_wh = self.client.get(f'/api/personnel/monthly-payroll/export-tax-wh/?period_id={period_id}')
        self.assertEqual(res_wh.status_code, 200)
        self.assertTrue(res_wh.content.startswith(b'\xef\xbb\xbf')) # UTF-8 BOM

        res_wp = self.client.get(f'/api/personnel/monthly-payroll/export-tax-wp/?period_id={period_id}')
        self.assertEqual(res_wp.status_code, 200)
        self.assertTrue(res_wp.content.startswith(b'\xef\xbb\xbf')) # UTF-8 BOM

        # 4. تست صدور فایل اکسل پرداخت بانک ملی
        res_bank = self.client.get(f'/api/personnel/monthly-payroll/export-bank-excel/?period_id={period_id}')
        self.assertEqual(res_bank.status_code, 200)
        self.assertEqual(res_bank['Content-Type'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

        # 5. تست صدور اکسل ۲ سطری استاندارد ۵۸ ستون حقوق
        res_excel = self.client.get(f'/api/personnel/monthly-payroll/export-monthly-excel/?period_id={period_id}')
        self.assertEqual(res_excel.status_code, 200)
        self.assertEqual(res_excel['Content-Type'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

    def test_surplus_allocation_and_zero_tax_check_discrepancy(self):
        """تست اختصاصی تسهیم مازاد و صفر بودن چک مالیات (ستون ۵۸)"""
        period = MonthlyWorkPeriod.objects.create(
            year_month='1405/04',
            warehouse=self.warehouse,
            status='OPEN'
        )
        self.personnel1.contract_hours = 230
        self.personnel1.contract_base_salary = 270000000 # 27 Million Tomans
        self.personnel1.job_grade = '19'
        self.personnel1.save()

        # ثبت کارکرد کامل ۲۳۰ ساعت
        DailyAttendance.objects.create(
            personnel=self.personnel1,
            warehouse=self.warehouse,
            date_shamsi='1405/04/01',
            effective_hours=230,
            status='PRESENT_10H'
        )

        from personnel.payroll_engine import PayrollCalculationEngine
        engine = PayrollCalculationEngine(period=period)
        records = engine.calculate_period(period)
        self.assertEqual(len(records), 2)

        record1 = next(r for r in records if r.personnel_id == self.personnel1.id)
        # ستون ۵۸ (چک مالیات) باید دقیقاً ۰ باشد
        self.assertEqual(record1.tax_check_discrepancy, 0)
        # حقوق ناخالص باید ۲۷۰ میلیون ریال باشد
        self.assertEqual(record1.gross_salary, 270000000)
        # اضافه‌کار و سفر/ماموریت باید مقادیر مثبت تسهیم‌شده داشته باشند
        self.assertGreater(record1.overtime_amount, 0)
        self.assertGreater(record1.travel_cost_amount + record1.mission_amount, 0)

    def test_import_tax_excel_flow(self):
        """تست اختصاصی درون‌ریزی فایل اکسل مالیات دارایی و تطبیق با کدملی"""
        self.personnel1.national_code = '2450718214'
        self.personnel1.save()

        period = MonthlyWorkPeriod.objects.create(
            year_month='1405/04',
            warehouse=self.warehouse,
            status='OPEN'
        )
        from personnel.payroll_engine import PayrollCalculationEngine
        PayrollCalculationEngine(period=period).calculate_period(period)

        possible_paths = [
            r'E:\warehouse project\Documents\SalaryCalculation\TaxCalculatedByTheTaxOffice.xlsx',
            r'E:\warehouse project\Documents\SalaryCalculation\نمونه مالیات محاسبه شده.xlsx',
            os.path.join(settings.BASE_DIR, '..', 'Documents', 'SalaryCalculation', 'TaxCalculatedByTheTaxOffice.xlsx'),
            os.path.join(settings.BASE_DIR, '..', 'Documents', 'SalaryCalculation', 'نمونه مالیات محاسبه شده.xlsx'),
            r'E:\warehouse project\نمونه مالیات محاسبه شده.xlsx',
        ]
        tax_file_path = next((p for p in possible_paths if os.path.exists(p)), possible_paths[0])
        with open(tax_file_path, 'rb') as fp:
            res = self.client.post(
                '/api/personnel/monthly-payroll/import-tax-excel/',
                {'file': fp, 'period_id': period.id},
                format='multipart'
            )
        self.assertEqual(res.status_code, 200)
        self.assertGreater(res.data['matched_count'], 0)

        # بررسی به‌روزرسانی مالیات پرسنل با کدملی 2452304301
        rec = MonthlyPayrollRecord.objects.get(period=period, personnel=self.personnel1)
        self.assertTrue(rec.is_tax_imported)
        self.assertEqual(rec.tax_source_type, 'IMPORTED_EXCEL')

    def test_wh_and_wp_tax_file_exports(self):
        """تست اختصاصی ساختار فایل‌های WP (۲۳ ستون) و WH (۳۹ ستون) با تنظیمات انفرادی پرسنل"""
        from personnel.tax_bank_exporter import generate_wp_tax_content, generate_wh_tax_content

        # تنظیم مشخصات پرسنل با کدهای اختصاصی دارایی 1.7.0.4
        self.personnel1.education_level = '7' # فوق دکتری
        self.personnel1.nationality_code = '1'
        self.personnel1.exemption_type = '11' # معافیت جوانی جمعیت
        self.personnel1.job_category = '5' # انبارداری
        self.personnel1.employment_type = '2' # شرکتی
        self.personnel1.tax_payment_type = '2' # ارزی
        self.personnel1.tax_service_location = '2' # مناطق محروم
        self.personnel1.tax_exceptions = '4' # کارکنان عملیاتی نفت
        self.personnel1.tax_currency_type = '40' # دلار
        self.personnel1.tax_currency_exchange_rate = 1.00
        self.personnel1.tax_housing_benefit_type = '2' # مسکن با اثاثیه
        self.personnel1.tax_vehicle_benefit_type = '2' # با راننده
        self.personnel1.save()

        period = MonthlyWorkPeriod.objects.create(
            year_month='1405/04',
            warehouse=self.warehouse,
            status='OPEN'
        )
        rec = MonthlyPayrollRecord.objects.create(
            period=period,
            personnel=self.personnel1,
            continuous_taxable_salary_allowances=250000000,
            overtime_amount=40000000,
            travel_cost_amount=20000000,
            mission_amount=15000000,
            bonus_amount=30000000,
            seniority_allowance=15000000,
            worker_insurance=45000000,
            include_in_tax=True
        )

        wp_content = generate_wp_tax_content([rec])
        wh_content = generate_wh_tax_content([rec])

        # بررسی ۲۳ ستون فایل WP
        wp_lines = [l for l in wp_content.replace('\ufeff', '').split('\r\n') if l.strip()]
        self.assertEqual(len(wp_lines), 1)
        wp_cols = wp_lines[0].split(',')
        self.assertEqual(len(wp_cols), 23)
        self.assertEqual(wp_cols[0], '1') # ملیت
        self.assertEqual(wp_cols[1], '2452304301') # کدملی
        self.assertEqual(wp_cols[8], '7') # مدرک تحصیلی فوق دکتری
        self.assertEqual(wp_cols[12], '11') # معافیت ماده ۱۸
        self.assertEqual(wp_cols[17], '5') # رسته انبارداری

        # بررسی ۳۹ ستون فایل WH
        wh_lines = [l for l in wh_content.replace('\ufeff', '').split('\r\n') if l.strip()]
        self.assertEqual(len(wh_lines), 1)
        wh_cols = wh_lines[0].split(',')
        self.assertEqual(len(wh_cols), 39)
        self.assertEqual(wh_cols[0], '2452304301') # کدملی
        self.assertEqual(wh_cols[1], '2') # نوع پرداختی ارزی
        self.assertEqual(wh_cols[2], '2') # محل خدمت مناطق محروم
        self.assertEqual(wh_cols[3], '4') # استثنائات نفت
        self.assertEqual(wh_cols[4], '40') # دلار
        self.assertEqual(wh_cols[6], '250000000') # ناخالص مستمر
        self.assertEqual(wh_cols[8], '2') # مسکن با اثاثیه
        self.assertEqual(wh_cols[10], '2') # اتومبیل با راننده
        self.assertEqual(wh_cols[16], '40000000') # اضافه کار
        self.assertEqual(wh_cols[17], '20000000') # هزینه سفر
        self.assertEqual(wh_cols[18], '15000000') # ماموریت
        self.assertEqual(wh_cols[22], '30000000') # عیدی
        self.assertEqual(wh_cols[26], '15000000') # سنوات
        self.assertEqual(wh_cols[32], '45000000') # بیمه کارگر






