from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.http import HttpResponse
from django.db import transaction
from django.db.models import Sum, Count, Q
from django.utils import timezone
import io
import zipfile
import openpyxl
from decimal import Decimal

from .models import (
    PersonnelProfile,
    VehicleDriverProfile,
    MonthlyWorkPeriod,
    DailyAttendance,
    AttendanceAuditLog,
    VehicleTripLog,
    PayrollYearlySettings,
    JobGradeTier,
    WorkshopInsuranceSettings,
    TaxRuleSettings,
    BankExportSettings,
    MonthlyPayrollRecord
)
from .serializers import (
    PersonnelProfileSerializer,
    VehicleDriverProfileSerializer,
    DailyAttendanceSerializer,
    BulkAttendanceMatrixSerializer,
    AttendanceAuditLogSerializer,
    VehicleTripLogSerializer,
    BulkVehicleTripMatrixSerializer,
    MonthlyWorkPeriodSerializer,
    PayrollYearlySettingsSerializer,
    JobGradeTierSerializer,
    WorkshopInsuranceSettingsSerializer,
    TaxRuleSettingsSerializer,
    BankExportSettingsSerializer,
    MonthlyPayrollRecordSerializer
)
from .payroll_engine import calculate_monthly_payroll_for_period
from .dbf_generator import generate_dskkar_bytes, generate_dskwor_bytes
from .tax_bank_exporter import generate_wh_tax_content, generate_wp_tax_content, generate_bank_meli_excel
from .payroll_excel_exporter import generate_monthly_payroll_excel


class PersonnelProfileViewSet(viewsets.ModelViewSet):
    queryset = PersonnelProfile.objects.all().select_related('assigned_warehouse', 'user')
    serializer_class = PersonnelProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        qs = super().get_queryset()
        warehouse_id = self.request.query_params.get('warehouse_id')
        if warehouse_id:
            qs = qs.filter(Q(assigned_warehouse_id=warehouse_id) | Q(assigned_warehouse__isnull=True))
        
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() in ['true', '1'])
            
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(national_code__icontains=search) |
                Q(job_title__icontains=search)
            )
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['post', 'POST', 'get', 'GET'], url_path='import-excel')
    def import_excel(self, request):
        """
        درون‌ریزی مستقیم شیت Emp_info از فایل اکسل شرکت (Upsert بر مبنای کد ملی ۱۰ رقمی)
        """
        import openpyxl
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'error': 'فایل اکسل الزامی است.'}, status=status.HTTP_400_BAD_REQUEST)
        
        warehouse_id = request.data.get('warehouse_id') or request.query_params.get('warehouse_id')
        
        try:
            wb = openpyxl.load_workbook(file_obj, data_only=True)
        except Exception as e:
            return Response({'error': f'خطا در باز کردن فایل اکسل: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)
        
        target_sheet = None
        for name in wb.sheetnames:
            if name.strip().lower() in ['emp_info', 'emp info', 'empinfo', 'پرسنل']:
                target_sheet = wb[name]
                break
        if not target_sheet:
            target_sheet = wb.active

        ws = target_sheet
        
        # پیدا کردن ردیف هدر
        header_map = {}
        header_row_idx = 1
        for r_idx in range(1, min(ws.max_row + 1, 5)):
            row_vals = [ws.cell(row=r_idx, column=c).value for c in range(1, ws.max_column + 1)]
            row_str = ' '.join([str(v) for v in row_vals if v is not None])
            if 'کد ملی' in row_str or 'نام خانوادگی' in row_str:
                header_row_idx = r_idx
                break

        for col_idx in range(1, ws.max_column + 1):
            val = ws.cell(row=header_row_idx, column=col_idx).value
            if val:
                cleaned = str(val).strip().replace('  ', ' ')
                header_map[cleaned] = col_idx

        if 'کد ملی' not in header_map and 'نام خانوادگی' not in header_map:
            return Response({'error': 'شیت پرسنلی یا ستون‌های الزامی (کد ملی، نام خانوادگی) در فایل یافت نشد.'}, status=status.HTTP_400_BAD_REQUEST)

        created_count = 0
        updated_count = 0
        errors = []

        with transaction.atomic():
            for r in range(header_row_idx + 1, ws.max_row + 1):
                nat_col = header_map.get('کد ملی')
                if not nat_col:
                    continue
                raw_nc = ws.cell(row=r, column=nat_col).value
                if raw_nc is None or str(raw_nc).strip() == '':
                    continue
                
                nc_clean = str(raw_nc).split('.')[0].strip().zfill(10)
                if not nc_clean.isdigit() or len(nc_clean) != 10:
                    errors.append(f'ردیف {r}: کد ملی نامعتبر است ({raw_nc})')
                    continue

                def get_v(key, default=''):
                    c_idx = header_map.get(key)
                    if c_idx:
                        val = ws.cell(row=r, column=c_idx).value
                        if val is not None:
                            return str(val).strip()
                    return default

                def get_num(key, default=0):
                    c_idx = header_map.get(key)
                    if c_idx:
                        val = ws.cell(row=r, column=c_idx).value
                        if val is not None:
                            try:
                                return float(val)
                            except (ValueError, TypeError):
                                pass
                    return default

                def get_bool(key, default=True):
                    c_idx = header_map.get(key)
                    if c_idx:
                        val = ws.cell(row=r, column=c_idx).value
                        if val is not None:
                            return str(val).strip() in ['1', 'true', 'True', 'بله']
                    return default

                first_name = get_v('نام')
                last_name = get_v('نام خانوادگی')
                if not last_name:
                    continue

                profile_defaults = {
                    'first_name': first_name,
                    'last_name': last_name,
                    'father_name': get_v('نام پدر') or get_v('نام  پدر'),
                    'birth_date': get_v('تاریخ تولد'),
                    'id_number': get_v('شماره شناسنامه'),
                    'birth_place': get_v('محل تولد'),
                    'education_level': get_v('مدرک تحصیلی', '5'),
                    'insurance_type': get_v('نوع بیمه', '2'),
                    'insurance_number': get_v('شماره بیمه'),
                    'insurance_name': get_v('نام بیمه', 'تامین اجتماعی'),
                    'exemption_type': get_v('نوع معافیت', '1'),
                    'job_category': get_v('رسته', '15'),
                    'job_title': get_v('سمت شغل') or get_v('عنوان شغل') or 'پرسنل انبار',
                    'employment_type': get_v('نوع استخدام', '2'),
                    'start_date': get_v('تاریخ شروع به کار'),
                    'end_date': get_v('تاریخ پایان کار'),
                    'retirement_date': get_v('تاریخ بازنشستگی'),
                    'job_code': get_v('کد شغل').zfill(6) if get_v('کد شغل') else '',
                    'id_series': get_v('مسلسل شناسنامه'),
                    'id_serial': get_v('سریال'),
                    'issue_place': get_v('محل صدور'),
                    'issue_date': get_v('تاریخ صدور'),
                    'gender': get_v('جنسیت', 'مرد'),
                    'phone_number': get_v('موبایل') or get_v('شماره همراه') or get_v('شماره تماس'),
                    'account_number': get_v('شماره حساب'),
                    'sheba_number': get_v('شماره شبا') or get_v('شبا'),
                    'bank_name': get_v('نام بانک') or get_v('بانک'),
                    'address': get_v('آدرس') or get_v('ادرس') or get_v('آدرس محل سکونت'),
                    'postal_code': get_v('کد پستی') or get_v('کدپستی'),
                    'marital_status': 'married' if 'متاهل' in get_v('وضعیت تاهل') or 'متأهل' in get_v('وضعیت تاهل') else 'single',
                    'children_count': int(get_num('تعداد فرزند', 0)),
                    'contract_hours': get_num('ساعت کار قرارداد شده', 230),
                    'contract_base_salary': get_num('حقوق قرارداد شده', 0),
                    'job_grade': get_v('گروه شغلی', '19'),
                    'daily_base_wage': get_num('مزد روزانه', 0),
                    'daily_seniority_bonus': get_num('پایه سنواتی', 0),
                    'base_daily_rate': get_num('مزد مبنا', 0),
                    'base_years_experience': int(get_num('تعداد سال کارکرد', 0)),
                    'status_category': get_v('وضعیت', 'نفرات شرکتی'),
                    'group_status': get_v('گروه', 'شاغل'),
                    'include_in_tax': get_bool('maliat', True),
                    'include_in_insurance': get_bool('بیمه', True),
                    'include_in_bank': get_bool('bank', True),
                    'created_by': request.user if request.user and request.user.is_authenticated else None
                }
                if warehouse_id and str(warehouse_id).isdigit():
                    profile_defaults['assigned_warehouse_id'] = int(warehouse_id)

                obj, created = PersonnelProfile.objects.update_or_create(
                    national_code=nc_clean,
                    defaults=profile_defaults
                )
                if created:
                    created_count += 1
                else:
                    updated_count += 1

        return Response({
            'message': f'درون‌ریزی پرسنل با موفقیت انجام شد ({created_count} پرسنل جدید، {updated_count} به‌روزرسانی).',
            'created_count': created_count,
            'updated_count': updated_count,
            'errors': errors
        })


class VehicleDriverProfileViewSet(viewsets.ModelViewSet):
    queryset = VehicleDriverProfile.objects.all().select_related('assigned_warehouse', 'user')
    serializer_class = VehicleDriverProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        qs = super().get_queryset()
        warehouse_id = self.request.query_params.get('warehouse_id')
        if warehouse_id:
            qs = qs.filter(Q(assigned_warehouse_id=warehouse_id) | Q(assigned_warehouse__isnull=True))
            
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() in ['true', '1'])
            
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(driver_name__icontains=search) |
                Q(plate_number__icontains=search) |
                Q(driver_national_code__icontains=search)
            )
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class DailyAttendanceViewSet(viewsets.ModelViewSet):
    queryset = DailyAttendance.objects.filter(is_deleted=False).select_related('personnel', 'warehouse', 'period')
    serializer_class = DailyAttendanceSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        qs = super().get_queryset()
        warehouse_id = self.request.query_params.get('warehouse_id')
        if warehouse_id:
            qs = qs.filter(warehouse_id=warehouse_id)
        date_shamsi = self.request.query_params.get('date_shamsi')
        if date_shamsi:
            qs = qs.filter(date_shamsi=date_shamsi)
        personnel_id = self.request.query_params.get('personnel_id')
        if personnel_id:
            qs = qs.filter(personnel_id=personnel_id)
        return qs

    @action(detail=False, methods=['get'], url_path='matrix')
    def get_matrix(self, request):
        """
        دریافت داده‌های ماتریسی حضور و غیاب برای یک انبار و تاریخ مشخص
        """
        warehouse_id = request.query_params.get('warehouse_id')
        date_shamsi = request.query_params.get('date_shamsi')
        if not warehouse_id or not date_shamsi:
            return Response({'error': 'پارامترهای warehouse_id و date_shamsi الزامی هستند.'}, status=status.HTTP_400_BAD_REQUEST)

        # استخراج سال و ماه از تاریخ (مثال: 1404/05/12 -> 1404/05)
        year_month = date_shamsi[:7]
        period = MonthlyWorkPeriod.objects.filter(warehouse_id=warehouse_id, year_month=year_month).first()
        is_locked = period.status == 'LOCKED' if period else False

        # پرسنل فعال این انبار
        personnel_list = PersonnelProfile.objects.filter(
            Q(assigned_warehouse_id=warehouse_id) | Q(assigned_warehouse__isnull=True),
            is_active=True
        ).order_by('last_name', 'first_name')

        # رکوردهای ثبت‌شده قبلی برای این تاریخ
        existing_attendances = {
            att.personnel_id: att
            for att in DailyAttendance.objects.filter(
                warehouse_id=warehouse_id,
                date_shamsi=date_shamsi,
                is_deleted=False
            ).select_related('personnel')
        }

        matrix_rows = []
        for p in personnel_list:
            att = existing_attendances.get(p.id)
            if att:
                matrix_rows.append({
                    'personnel_id': p.id,
                    'full_name': p.full_name,
                    'national_code': p.national_code,
                    'job_title': p.job_title,
                    'attendance_id': att.id,
                    'status': att.status,
                    'effective_hours': float(att.effective_hours),
                    'overtime_hours': float(att.overtime_hours),
                    'is_friday_work': att.is_friday_work,
                    'is_mission': att.is_mission,
                    'advance_payment': float(att.advance_payment),
                    'notes': att.notes or '',
                    'is_existing': True
                })
            else:
                # مقدار پیش‌فرض: حاضر ۱۰ ساعته
                matrix_rows.append({
                    'personnel_id': p.id,
                    'full_name': p.full_name,
                    'national_code': p.national_code,
                    'job_title': p.job_title,
                    'attendance_id': None,
                    'status': 'PRESENT_10H',
                    'effective_hours': 10.0,
                    'overtime_hours': 0.0,
                    'is_friday_work': False,
                    'is_mission': False,
                    'advance_payment': 0.0,
                    'notes': '',
                    'is_existing': False
                })

        return Response({
            'warehouse_id': int(warehouse_id),
            'date_shamsi': date_shamsi,
            'year_month': year_month,
            'is_locked': is_locked,
            'period_status': period.status if period else 'OPEN',
            'rows': matrix_rows
        })

    @action(detail=False, methods=['post'], url_path='bulk-save')
    def bulk_save(self, request):
        """
        ذخیره گروهی و سریع ماتریس حضور و غیاب پرسنل در پایان روز
        همراه با ایجاد خودکار لاگ ممیزی در صورت ویرایش
        """
        serializer = BulkAttendanceMatrixSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        warehouse_id = serializer.validated_data['warehouse_id']
        date_shamsi = serializer.validated_data['date_shamsi']
        items = serializer.validated_data['items']

        year_month = date_shamsi[:7]
        period, _ = MonthlyWorkPeriod.objects.get_or_create(
            warehouse_id=warehouse_id,
            year_month=year_month,
            defaults={'status': 'OPEN'}
        )

        if period.status == 'LOCKED':
            return Response({'error': f'دوره کارکرد {year_month} قفل شده است و امکان ثبت یا ویرایش وجود ندارد.'}, status=status.HTTP_400_BAD_REQUEST)

        saved_count = 0
        updated_count = 0

        with transaction.atomic():
            for item in items:
                personnel_id = item['personnel_id']
                p_obj = PersonnelProfile.objects.filter(id=personnel_id).first()
                if not p_obj:
                    continue

                att_obj = DailyAttendance.objects.select_for_update().filter(
                    personnel_id=personnel_id,
                    warehouse_id=warehouse_id,
                    date_shamsi=date_shamsi,
                    is_deleted=False
                ).first()

                if att_obj:
                    # بررسی تغییرات جهت ثبت در Audit Log
                    changes = []
                    fields_to_check = ['status', 'effective_hours', 'overtime_hours', 'is_friday_work', 'is_mission', 'advance_payment', 'notes']
                    for f in fields_to_check:
                        new_val = item.get(f)
                        old_val = getattr(att_obj, f)
                        # تبدیل به استرینگ جهت مقایسه
                        if str(new_val) != str(old_val):
                            changes.append((f, str(old_val), str(new_val)))

                    # اعمال تغییرات
                    att_obj.status = item['status']
                    att_obj.effective_hours = item['effective_hours']
                    att_obj.overtime_hours = item['overtime_hours']
                    att_obj.is_friday_work = item['is_friday_work']
                    att_obj.is_mission = item['is_mission']
                    att_obj.advance_payment = item.get('advance_payment', 0)
                    att_obj.notes = item.get('notes', '')
                    att_obj.modified_by = request.user
                    att_obj.period = period
                    att_obj.save()

                    # ثبت لاگ‌های ممیزی
                    for f_name, o_val, n_val in changes:
                        AttendanceAuditLog.objects.create(
                            attendance=att_obj,
                            personnel_name=p_obj.full_name,
                            date_shamsi=date_shamsi,
                            changed_by=request.user,
                            field_name=f_name,
                            old_value=o_val,
                            new_value=n_val,
                            reason='ویرایش ماتریسی کارکرد روزانه'
                        )
                    updated_count += 1
                else:
                    # ایجاد رکورد جدید
                    att_obj = DailyAttendance.objects.create(
                        personnel_id=personnel_id,
                        warehouse_id=warehouse_id,
                        date_shamsi=date_shamsi,
                        status=item['status'],
                        effective_hours=item['effective_hours'],
                        overtime_hours=item['overtime_hours'],
                        is_friday_work=item['is_friday_work'],
                        is_mission=item['is_mission'],
                        advance_payment=item.get('advance_payment', 0),
                        notes=item.get('notes', ''),
                        period=period,
                        created_by=request.user,
                        modified_by=request.user
                    )
                    saved_count += 1

        return Response({
            'message': f'اطلاعات کارکرد با موفقیت ذخیره شد ({saved_count} جدید، {updated_count} بروزرسانی).',
            'saved_count': saved_count,
            'updated_count': updated_count
        })

    @action(detail=False, methods=['get'], url_path='monthly-summary')
    def get_monthly_summary(self, request):
        """
        گزارش تجمیعی ماهانه کارکرد پرسنل
        """
        warehouse_id = request.query_params.get('warehouse_id')
        year_month = request.query_params.get('year_month')
        if not warehouse_id or not year_month:
            return Response({'error': 'warehouse_id و year_month الزامی هستند.'}, status=status.HTTP_400_BAD_REQUEST)

        personnel_list = PersonnelProfile.objects.filter(
            Q(assigned_warehouse_id=warehouse_id) | Q(assigned_warehouse__isnull=True),
            is_active=True
        ).order_by('last_name', 'first_name')

        attendances = DailyAttendance.objects.filter(
            warehouse_id=warehouse_id,
            date_shamsi__startswith=year_month,
            is_deleted=False
        )

        period = MonthlyWorkPeriod.objects.filter(warehouse_id=warehouse_id, year_month=year_month).first()

        summary_rows = []
        for p in personnel_list:
            p_atts = [a for a in attendances if a.personnel_id == p.id]
            
            total_hours = sum(float(a.effective_hours) for a in p_atts)
            total_overtime = sum(float(a.overtime_hours) for a in p_atts)
            friday_days = sum(1 for a in p_atts if a.is_friday_work)
            mission_days = sum(1 for a in p_atts if a.is_mission)
            absent_days = sum(1 for a in p_atts if a.status == 'ABSENT')
            leave_days = sum(1 for a in p_atts if a.status == 'LEAVE')
            present_days = sum(1 for a in p_atts if a.status in ['PRESENT_10H', 'HALF_5H', 'FRIDAY_WORK', 'MISSION', 'CUSTOM'] and a.effective_hours > 0)
            total_advances = sum(float(a.advance_payment) for a in p_atts)
            
            # تبدیل به معادل روز (تقسیم بر ۱۰)
            equivalent_days = round(total_hours / 10.0, 2)
            
            # برآورد دستمزد ناخالص کارکرد
            daily_wage = float(p.daily_base_wage)
            hourly_wage = float(p.hourly_rate)
            gross_base_pay = round(equivalent_days * daily_wage, 0)
            overtime_pay = round(total_overtime * (hourly_wage * 1.4), 0)

            summary_rows.append({
                'personnel_id': p.id,
                'full_name': p.full_name,
                'national_code': p.national_code,
                'job_title': p.job_title,
                'contract_type': p.get_contract_type_display(),
                'daily_base_wage': daily_wage,
                'total_hours': round(total_hours, 1),
                'equivalent_days': equivalent_days,
                'present_days': present_days,
                'total_overtime_hours': round(total_overtime, 1),
                'friday_days': friday_days,
                'mission_days': mission_days,
                'absent_days': absent_days,
                'leave_days': leave_days,
                'total_advances': total_advances,
                'gross_base_pay': gross_base_pay,
                'overtime_pay': overtime_pay,
                'estimated_total_pay': gross_base_pay + overtime_pay - total_advances
            })

        return Response({
            'warehouse_id': int(warehouse_id),
            'year_month': year_month,
            'period_status': period.status if period else 'OPEN',
            'is_locked': period.status == 'LOCKED' if period else False,
            'summary': summary_rows
        })


class VehicleTripViewSet(viewsets.ModelViewSet):
    queryset = VehicleTripLog.objects.filter(is_deleted=False).select_related('vehicle', 'warehouse', 'period')
    serializer_class = VehicleTripLogSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        qs = super().get_queryset()
        warehouse_id = self.request.query_params.get('warehouse_id')
        if warehouse_id:
            qs = qs.filter(warehouse_id=warehouse_id)
        date_shamsi = self.request.query_params.get('date_shamsi')
        if date_shamsi:
            qs = qs.filter(date_shamsi=date_shamsi)
        vehicle_id = self.request.query_params.get('vehicle_id')
        if vehicle_id:
            qs = qs.filter(vehicle_id=vehicle_id)
        return qs

    @action(detail=False, methods=['get'], url_path='matrix')
    def get_matrix(self, request):
        """
        دریافت لیست سریع خودروها برای ثبت سرویس روزانه
        """
        warehouse_id = request.query_params.get('warehouse_id')
        date_shamsi = request.query_params.get('date_shamsi')
        if not warehouse_id or not date_shamsi:
            return Response({'error': 'warehouse_id و date_shamsi الزامی هستند.'}, status=status.HTTP_400_BAD_REQUEST)

        vehicles = VehicleDriverProfile.objects.filter(
            Q(assigned_warehouse_id=warehouse_id) | Q(assigned_warehouse__isnull=True),
            is_active=True
        ).order_by('driver_name')

        existing_trips = {
            t.vehicle_id: t
            for t in VehicleTripLog.objects.filter(
                warehouse_id=warehouse_id,
                date_shamsi=date_shamsi,
                is_deleted=False
            )
        }

        matrix_rows = []
        for v in vehicles:
            t = existing_trips.get(v.id)
            if t:
                matrix_rows.append({
                    'vehicle_id': v.id,
                    'driver_name': v.driver_name,
                    'plate_number': v.plate_number,
                    'vehicle_type_display': v.get_vehicle_type_display(),
                    'default_rate': float(v.default_service_rate),
                    'trip_id': t.id,
                    'trip_count': t.trip_count,
                    'unit_rate': float(t.unit_rate),
                    'total_amount': float(t.total_amount),
                    'dispatch_reference': t.dispatch_reference or '',
                    'origin_destination': t.origin_destination or '',
                    'notes': t.notes or '',
                    'is_existing': True
                })
            else:
                matrix_rows.append({
                    'vehicle_id': v.id,
                    'driver_name': v.driver_name,
                    'plate_number': v.plate_number,
                    'vehicle_type_display': v.get_vehicle_type_display(),
                    'default_rate': float(v.default_service_rate),
                    'trip_id': None,
                    'trip_count': 0,
                    'unit_rate': float(v.default_service_rate),
                    'total_amount': 0.0,
                    'dispatch_reference': '',
                    'origin_destination': '',
                    'notes': '',
                    'is_existing': False
                })

        return Response({
            'warehouse_id': int(warehouse_id),
            'date_shamsi': date_shamsi,
            'rows': matrix_rows
        })

    @action(detail=False, methods=['post'], url_path='bulk-save')
    def bulk_save(self, request):
        """
        ثبت سریع سرویس‌های ناوگان در پایان روز
        """
        serializer = BulkVehicleTripMatrixSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        warehouse_id = serializer.validated_data['warehouse_id']
        date_shamsi = serializer.validated_data['date_shamsi']
        items = serializer.validated_data['items']

        year_month = date_shamsi[:7]
        period, _ = MonthlyWorkPeriod.objects.get_or_create(
            warehouse_id=warehouse_id,
            year_month=year_month,
            defaults={'status': 'OPEN'}
        )

        if period.status == 'LOCKED':
            return Response({'error': f'دوره {year_month} قفل شده است.'}, status=status.HTTP_400_BAD_REQUEST)

        saved_count = 0
        with transaction.atomic():
            for item in items:
                vehicle_id = item['vehicle_id']
                trip_count = item.get('trip_count', 0)
                
                v_obj = VehicleDriverProfile.objects.filter(id=vehicle_id).first()
                if not v_obj:
                    continue

                trip_obj = VehicleTripLog.objects.filter(
                    vehicle_id=vehicle_id,
                    warehouse_id=warehouse_id,
                    date_shamsi=date_shamsi,
                    is_deleted=False
                ).first()

                unit_rate = item.get('unit_rate', v_obj.default_service_rate)
                total_amount = unit_rate * trip_count

                if trip_count > 0:
                    if trip_obj:
                        trip_obj.trip_count = trip_count
                        trip_obj.unit_rate = unit_rate
                        trip_obj.total_amount = total_amount
                        trip_obj.dispatch_reference = item.get('dispatch_reference', '')
                        trip_obj.origin_destination = item.get('origin_destination', '')
                        trip_obj.notes = item.get('notes', '')
                        trip_obj.period = period
                        trip_obj.save()
                    else:
                        VehicleTripLog.objects.create(
                            vehicle_id=vehicle_id,
                            warehouse_id=warehouse_id,
                            date_shamsi=date_shamsi,
                            trip_count=trip_count,
                            unit_rate=unit_rate,
                            total_amount=total_amount,
                            dispatch_reference=item.get('dispatch_reference', ''),
                            origin_destination=item.get('origin_destination', ''),
                            notes=item.get('notes', ''),
                            period=period,
                            created_by=request.user
                        )
                    saved_count += 1
                else:
                    # اگر صفر بود و قبلاً ثبت شده بود، حذف منطقی
                    if trip_obj:
                        trip_obj.is_deleted = True
                        trip_obj.save()

        return Response({
            'message': 'سرویس‌های خودروها با موفقیت ذخیره شدند.',
            'saved_count': saved_count
        })

    @action(detail=False, methods=['get'], url_path='monthly-summary')
    def get_monthly_summary(self, request):
        """
        گزارش کاردکس و عملکرد ماهانه خودروها
        """
        warehouse_id = request.query_params.get('warehouse_id')
        year_month = request.query_params.get('year_month')
        if not warehouse_id or not year_month:
            return Response({'error': 'warehouse_id و year_month الزامی هستند.'}, status=status.HTTP_400_BAD_REQUEST)

        vehicles = VehicleDriverProfile.objects.filter(
            Q(assigned_warehouse_id=warehouse_id) | Q(assigned_warehouse__isnull=True),
            is_active=True
        ).order_by('driver_name')

        trips = VehicleTripLog.objects.filter(
            warehouse_id=warehouse_id,
            date_shamsi__startswith=year_month,
            is_deleted=False
        )

        summary_rows = []
        for v in vehicles:
            v_trips = [t for t in trips if t.vehicle_id == v.id]
            total_trips = sum(t.trip_count for t in v_trips)
            total_payable = sum(float(t.total_amount) for t in v_trips)
            active_days = len(set(t.date_shamsi for t in v_trips if t.trip_count > 0))

            summary_rows.append({
                'vehicle_id': v.id,
                'driver_name': v.driver_name,
                'plate_number': v.plate_number,
                'vehicle_type': v.get_vehicle_type_display(),
                'default_rate': float(v.default_service_rate),
                'sheba_number': v.sheba_number or '',
                'active_days': active_days,
                'total_trips': total_trips,
                'total_payable': total_payable
            })

        return Response({
            'warehouse_id': int(warehouse_id),
            'year_month': year_month,
            'summary': summary_rows
        })


class MonthlyWorkPeriodViewSet(viewsets.ModelViewSet):
    queryset = MonthlyWorkPeriod.objects.all().select_related('warehouse', 'locked_by')
    serializer_class = MonthlyWorkPeriodSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        qs = super().get_queryset()
        warehouse_id = self.request.query_params.get('warehouse_id')
        if warehouse_id:
            qs = qs.filter(warehouse_id=warehouse_id)
        return qs

    @action(detail=True, methods=['post'], url_path='lock')
    def lock_period(self, request, pk=None):
        period = self.get_object()
        period.status = 'LOCKED'
        period.locked_at = timezone.now()
        period.locked_by = request.user
        period.save()
        return Response({'message': f'دوره {period.year_month} با موفقیت قفل شد.'})

    @action(detail=True, methods=['post'], url_path='unlock')
    def unlock_period(self, request, pk=None):
        if not request.user.is_superuser:
            return Response({'error': 'فقط مدیر ارشد سیستم اجازه بازگشایی دوره را دارد.'}, status=status.HTTP_403_FORBIDDEN)
        period = self.get_object()
        period.status = 'OPEN'
        period.locked_at = None
        period.locked_by = None
        period.save()
        return Response({'message': f'دوره {period.year_month} با موفقیت بازگشایی شد.'})


# ══════════════════════════════════════════════════════════════════════════════
# ── ۷. ویوست تنظیمات جامع سالانه و ۲۰ گروه شغلی ───────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

class PayrollYearlySettingsViewSet(viewsets.ModelViewSet):
    queryset = PayrollYearlySettings.objects.all().prefetch_related(
        'job_grades', 'workshop_insurance', 'tax_settings', 'bank_export_settings'
    )
    serializer_class = PayrollYearlySettingsSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    @action(detail=False, methods=['get'], url_path='active-or-year')
    def get_active_or_year(self, request):
        year = request.query_params.get('year', '1405')
        settings_obj = PayrollYearlySettings.objects.filter(fiscal_year=year).first()
        if not settings_obj:
            settings_obj = PayrollYearlySettings.objects.filter(is_active=True).first()
        if not settings_obj:
            return Response({'error': 'تنظیماتی یافت نشد.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(PayrollYearlySettingsSerializer(settings_obj).data)

    @action(detail=False, methods=['get'], url_path='job-grade-rate')
    def get_job_grade_rate(self, request):
        """
        دریافت خودکار مزد روزانه و پایه سنواتی بر اساس گروه شغلی (۱ تا ۲۰)
        """
        grade = request.query_params.get('grade', '19')
        year = request.query_params.get('year', '1405')
        
        tier = JobGradeTier.objects.filter(
            yearly_settings__fiscal_year=year,
            grade_number=int(grade)
        ).first()

        if not tier:
            tier = JobGradeTier.objects.filter(grade_number=int(grade)).first()

        if tier:
            return Response({
                'grade_number': tier.grade_number,
                'daily_base_wage': float(tier.daily_base_wage),
                'daily_seniority_bonus': float(tier.daily_seniority_bonus),
                'hourly_rate': round(float(tier.daily_base_wage) / 10.0, 2)
            })
        return Response({'error': 'گروه شغلی در جدول تنظیمات یافت نشد.'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['post'], url_path='update-all')
    def update_all_tabs(self, request, pk=None):
        """
        به‌روزرسانی یکپارچه هر ۵ تب تنظیمات توسط حسابدار
        """
        settings_obj = self.get_object()
        data = request.data

        with transaction.atomic():
            # 1. Update main fields
            for field in [
                'monthly_food_allowance', 'monthly_housing_allowance', 'monthly_spouse_allowance',
                'monthly_child_allowance', 'shift_percent', 'transport_help_percent',
                'transport_fixed_amount', 'specialist_attraction_percent', 'bad_weather_percent',
                'remote_hardship_percent', 'south_pars_percent', 'travel_cost_per_day',
                'worker_insurance_rate', 'employer_insurance_rate', 'unemployment_insurance_rate'
            ]:
                if field in data:
                    setattr(settings_obj, field, data[field])
            settings_obj.save()

            # 2. Update Workshop Insurance
            ws_data = data.get('workshop_insurance')
            if ws_data and hasattr(settings_obj, 'workshop_insurance'):
                ws = settings_obj.workshop_insurance
                for f in ['workshop_code', 'workshop_name', 'employer_name', 'workshop_address', 'list_type', 'list_number', 'default_dsk_rate', 'default_mon_pym']:
                    if f in ws_data:
                        setattr(ws, f, ws_data[f])
                ws.save()

            # 3. Update Tax Settings
            tax_data = data.get('tax_settings')
            if tax_data and hasattr(settings_obj, 'tax_settings'):
                ts = settings_obj.tax_settings
                for f in ['payment_type', 'service_location', 'exceptions', 'currency_type', 'currency_exchange_rate', 'housing_benefit_type', 'vehicle_benefit_type']:
                    if f in tax_data:
                        setattr(ts, f, tax_data[f])
                ts.save()

            # 4. Update Bank Settings
            bank_data = data.get('bank_export_settings')
            if bank_data and hasattr(settings_obj, 'bank_export_settings'):
                bs = settings_obj.bank_export_settings
                for f in ['bank_name', 'source_account_number', 'default_deposit_id', 'deposit_description_template']:
                    if f in bank_data:
                        setattr(bs, f, bank_data[f])
                bs.save()

            # 5. Update Job Grades
            jg_list = data.get('job_grades', [])
            for jg_item in jg_list:
                grade_num = jg_item.get('grade_number')
                if grade_num:
                    JobGradeTier.objects.update_or_create(
                        yearly_settings=settings_obj,
                        grade_number=int(grade_num),
                        defaults={
                            'daily_base_wage': jg_item.get('daily_base_wage', 0),
                            'daily_seniority_bonus': jg_item.get('daily_seniority_bonus', 0),
                        }
                    )

        return Response({
            'message': 'تنظیمات پایه حقوق و دستمزد با موفقیت به‌روزرسانی شد.',
            'settings': PayrollYearlySettingsSerializer(settings_obj).data
        })


# ══════════════════════════════════════════════════════════════════════════════
# ── ۸. ویوست محاسبه ماهانه حقوق و صدور دیسکت‌ها و گزارشات ۵۸ ستونی ────────────
# ══════════════════════════════════════════════════════════════════════════════

class MonthlyPayrollViewSet(viewsets.ModelViewSet):
    queryset = MonthlyPayrollRecord.objects.all().select_related('period', 'personnel', 'period__warehouse')
    serializer_class = MonthlyPayrollRecordSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        qs = super().get_queryset()
        period_id = self.request.query_params.get('period_id')
        if period_id:
            qs = qs.filter(period_id=period_id)
        
        warehouse_id = self.request.query_params.get('warehouse_id')
        if warehouse_id:
            qs = qs.filter(period__warehouse_id=warehouse_id)
            
        year_month = self.request.query_params.get('year_month')
        if year_month:
            qs = qs.filter(period__year_month=year_month)

        return qs.order_by('row_number')

    @action(detail=False, methods=['post'], url_path='calculate-period')
    def calculate_period(self, request):
        """
        تجمیع کارکرد و محاسبه خودکار ۵۸ ستون حقوق برای دوره انتخابی
        """
        warehouse_id = request.data.get('warehouse_id')
        year_month = request.data.get('year_month')
        
        if not warehouse_id or not year_month:
            return Response({'error': 'شناسه انبار و سال/ماه الزامی است.'}, status=status.HTTP_400_BAD_REQUEST)

        # Get or create work period
        period, _ = MonthlyWorkPeriod.objects.get_or_create(
            warehouse_id=int(warehouse_id),
            year_month=str(year_month).strip(),
            defaults={'status': 'OPEN'}
        )

        if period.status == 'LOCKED':
            return Response({'error': f'دوره {period.year_month} قفل شده است و امکان محاسبه مجدد ندارد.'}, status=status.HTTP_400_BAD_REQUEST)

        records = calculate_monthly_payroll_for_period(period, user=request.user)
        serialized = MonthlyPayrollRecordSerializer(records, many=True).data

        # Summary Metrics
        total_gross = sum(float(r.gross_salary) for r in records)
        total_payable = sum(float(r.payable_amount) for r in records)
        total_insurance = sum(float(r.total_insurance) for r in records)
        total_tax = sum(float(r.income_tax) for r in records)

        return Response({
            'message': f'محاسبه حقوق دوره {period.year_month} برای {len(records)} نفر پرسنل با موفقیت انجام شد.',
            'period_id': period.id,
            'period_status': period.status,
            'summary': {
                'total_personnel': len(records),
                'total_gross': total_gross,
                'total_payable': total_payable,
                'total_insurance': total_insurance,
                'total_tax': total_tax,
            },
            'records': serialized
        })

    @action(detail=False, methods=['get'], url_path='export-dsk-zip')
    def export_dsk_zip(self, request):
        """
        صدور پکیج فشرده ZIP شامل دو دیسکت استاندارد DSKWOR00.DBF و DSKKAR00.DBF
        """
        period_id = request.query_params.get('period_id')
        if not period_id:
            return Response({'error': 'شناسه دوره (period_id) الزامی است.'}, status=status.HTTP_400_BAD_REQUEST)

        period = MonthlyWorkPeriod.objects.filter(id=period_id).first()
        if not period:
            return Response({'error': 'دوره یافت نشد.'}, status=status.HTTP_404_NOT_FOUND)

        records = list(MonthlyPayrollRecord.objects.filter(period=period).select_related('personnel'))
        if not records:
            return Response({'error': 'رکوردی برای این دوره ثبت یا محاسبه نشده است.'}, status=status.HTTP_400_BAD_REQUEST)

        year_str = period.year_month.split('/')[0] if '/' in period.year_month else '1405'
        month_str = period.year_month.split('/')[1] if '/' in period.year_month else '04'
        fiscal_year_short = int(year_str[-2:]) # 05
        month_num = int(month_str)

        settings_obj = PayrollYearlySettings.objects.filter(fiscal_year=year_str).first()
        ws_settings = getattr(settings_obj, 'workshop_insurance', None) if settings_obj else None
        if not ws_settings:
            ws_settings = WorkshopInsuranceSettings.objects.first()
        if not ws_settings:
            ws_settings = WorkshopInsuranceSettings(
                workshop_code='4894290013',
                workshop_name='شرکت پیمانکاری پارس',
                employer_name='مدیریت انبارداری',
                workshop_address='عسلویه، منطقه ویژه اقتصادی'
            )

        insured_recs = [r for r in records if r.include_in_insurance]
        
        # Calculate sums for DSKKAR
        sum_days = sum(r.insurance_days for r in insured_recs)
        sum_daily = sum(int(r.daily_wage) for r in insured_recs)
        sum_base = sum(int(r.base_salary) for r in insured_recs)
        sum_maz = sum(int(r.total_taxable_allowances) for r in insured_recs)
        sum_mash = sum(int(r.total_insurable_salary_allowances) for r in insured_recs)
        sum_totl = sum(int(r.gross_salary) for r in insured_recs)
        sum_bime = sum(int(r.worker_insurance) for r in insured_recs)
        sum_koso = sum(int(r.employer_insurance) for r in insured_recs)
        sum_bic = sum(int(r.unemployment_insurance) for r in insured_recs)
        sum_inc = sum(int(r.total_seniority_accumulated) for r in insured_recs)
        sum_spouse = sum(int(r.marital_allowance) for r in insured_recs)

        month_names = {1: 'فروردین', 2: 'اردیبهشت', 3: 'خرداد', 4: 'تیر', 5: 'مرداد', 6: 'شهریور', 7: 'مهر', 8: 'آبان', 9: 'آذر', 10: 'دی', 11: 'بهمن', 12: 'اسفند'}
        m_name = month_names.get(month_num, 'تیر')
        list_desc = f"انبارداری بیمه {m_name} {year_str}"

        dskkar_bytes = generate_dskkar_bytes(
            workshop_settings=ws_settings,
            fiscal_year_short=fiscal_year_short,
            month_num=month_num,
            list_number='01',
            list_description=list_desc,
            records_count=len(insured_recs),
            sum_insurance_days=sum_days,
            sum_daily_wage=sum_daily,
            sum_base_salary=sum_base,
            sum_insurable_allowances=sum_maz,
            sum_insurable_total=sum_mash,
            sum_gross_salary=sum_totl,
            sum_employee_insurance=sum_bime,
            sum_employer_insurance=sum_koso,
            sum_unemployment_insurance=sum_bic,
            sum_seniority=sum_inc,
            sum_spouse_allowance=sum_spouse
        )

        dskwor_bytes = generate_dskwor_bytes(
            workshop_code=ws_settings.workshop_code,
            fiscal_year_short=fiscal_year_short,
            month_num=month_num,
            list_number='01',
            payroll_records=records
        )

        # Build ZIP in memory
        zip_buf = io.BytesIO()
        with zipfile.ZipFile(zip_buf, 'w', zipfile.ZIP_DEFLATED) as z:
            z.writestr("DSKKAR00.DBF", dskkar_bytes)
            z.writestr("DSKWOR00.DBF", dskwor_bytes)

        zip_val = zip_buf.getvalue()
        resp = HttpResponse(zip_val, content_type='application/zip')
        resp['Content-Disposition'] = f'attachment; filename="Bimeh_Diskettes_{year_str}_{month_str}.zip"'
        return resp

    @action(detail=False, methods=['get'], url_path='export-tax-wh')
    def export_tax_wh(self, request):
        """
        صدور فایل متنی WH مالیات حقوق
        """
        period_id = request.query_params.get('period_id')
        records = list(MonthlyPayrollRecord.objects.filter(period_id=period_id).select_related('personnel'))
        if not records:
            return Response({'error': 'رکوردی یافت نشد.'}, status=status.HTTP_404_NOT_FOUND)

        settings_obj = PayrollYearlySettings.objects.filter(is_active=True).first()
        tax_settings = getattr(settings_obj, 'tax_settings', None)

        content = generate_wh_tax_content(records, tax_settings)
        period = records[0].period
        month_code = period.year_month.replace('/', '')[2:] if period else '140504'
        filename = f"WH{month_code}.txt"

        resp = HttpResponse(content.encode('utf-8'), content_type='text/plain; charset=utf-8')
        resp['Content-Disposition'] = f'attachment; filename="{filename}"'
        return resp

    @action(detail=False, methods=['get'], url_path='export-tax-wp')
    def export_tax_wp(self, request):
        """
        صدور فایل متنی WP پرسنل مالیاتی
        """
        period_id = request.query_params.get('period_id')
        records = list(MonthlyPayrollRecord.objects.filter(period_id=period_id).select_related('personnel'))
        if not records:
            return Response({'error': 'رکوردی یافت نشد.'}, status=status.HTTP_404_NOT_FOUND)

        settings_obj = PayrollYearlySettings.objects.filter(is_active=True).first()
        tax_settings = getattr(settings_obj, 'tax_settings', None)

        content = generate_wp_tax_content(records, tax_settings)
        period = records[0].period
        month_code = period.year_month.replace('/', '')[2:] if period else '140504'
        filename = f"WP{month_code}.txt"

        resp = HttpResponse(content.encode('utf-8'), content_type='text/plain; charset=utf-8')
        resp['Content-Disposition'] = f'attachment; filename="{filename}"'
        return resp

    @action(detail=False, methods=['get'], url_path='export-bank-excel')
    def export_bank_excel(self, request):
        """
        صدور فایل اکسل پرداخت گروهی بانک ملی
        """
        period_id = request.query_params.get('period_id')
        records = list(MonthlyPayrollRecord.objects.filter(period_id=period_id).select_related('personnel'))
        if not records:
            return Response({'error': 'رکوردی یافت نشد.'}, status=status.HTTP_404_NOT_FOUND)

        settings_obj = PayrollYearlySettings.objects.filter(is_active=True).first()
        bank_settings = getattr(settings_obj, 'bank_export_settings', None)
        period = records[0].period

        excel_bytes = generate_bank_meli_excel(records, bank_settings, year_month_title=period.year_month)
        filename = f"Bank_Payment_{period.year_month.replace('/', '_')}.xlsx"

        resp = HttpResponse(excel_bytes, content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        resp['Content-Disposition'] = f'attachment; filename="{filename}"'
        return resp

    @action(detail=False, methods=['get'], url_path='export-monthly-excel')
    def export_monthly_excel(self, request):
        """
        صدور فایل اکسل ۲ سطری استاندارد ۵۸ ستون شیت ماهانه
        """
        period_id = request.query_params.get('period_id')
        records = list(MonthlyPayrollRecord.objects.filter(period_id=period_id).select_related('personnel'))
        if not records:
            return Response({'error': 'رکوردی یافت نشد.'}, status=status.HTTP_404_NOT_FOUND)

        period = records[0].period
        excel_bytes = generate_monthly_payroll_excel(records, period_title=period.year_month)
        filename = f"Payroll_Report_{period.year_month.replace('/', '_')}.xlsx"

        resp = HttpResponse(excel_bytes, content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        resp['Content-Disposition'] = f'attachment; filename="{filename}"'
        return resp

    @action(detail=False, methods=['post'], url_path='import-tax-excel')
    def import_tax_excel(self, request):
        """
        درون‌ریزی فایل اکسل مالیات محاسبه‌شده توسط دارایی (نمونه مالیات محاسبه شده.xlsx)
        و تطبیق خودکار با ستون مالیات و متادیتای رکوردهای دوره بر اساس کد ملی
        """
        excel_file = request.FILES.get('file')
        period_id = request.data.get('period_id') or request.query_params.get('period_id')
        year_month = request.data.get('year_month') or request.query_params.get('year_month')

        if not excel_file:
            return Response({'error': 'لطفاً فایل اکسل مالیات دارایی را انتخاب کنید.'}, status=status.HTTP_400_BAD_REQUEST)

        # Locate target period
        if period_id:
            try:
                p_id = int(str(period_id).strip())
                period = MonthlyWorkPeriod.objects.filter(id=p_id).first()
            except Exception:
                period = MonthlyWorkPeriod.objects.filter(id=period_id).first()
        elif year_month:
            period = MonthlyWorkPeriod.objects.filter(year_month=year_month).first()
        else:
            period = MonthlyWorkPeriod.objects.order_by('-created_at').first()

        if not period:
            return Response({'error': 'دوره ماهانه مورد نظر یافت نشد.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            file_bytes = excel_file.read()
            wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
            ws = wb.active

            # Find header indices
            col_map = {}
            for c in range(1, ws.max_column + 1):
                header_val = str(ws.cell(1, c).value or '').strip()
                clean_h = header_val.replace(' ', '').replace('_', '')
                if 'کدملی' in clean_h or 'کد_ملی' in clean_h:
                    col_map['national_code'] = c
                elif 'مالیاتمحاسبهشده' in clean_h or 'مالیات' in clean_h:
                    col_map['tax_amount'] = c
                elif 'تعدادماهاعمالشدهدرمعافیت' in clean_h or 'تعدادماه' in clean_h:
                    col_map['exemption_months'] = c
                elif 'بیشازیککارفرما' in clean_h or 'چندکارفرما' in clean_h:
                    col_map['multiple_employers'] = c

            if 'national_code' not in col_map or 'tax_amount' not in col_map:
                col_map.setdefault('national_code', 1)
                col_map.setdefault('tax_amount', 4)
                col_map.setdefault('exemption_months', 5)
                col_map.setdefault('multiple_employers', 6)

            matched_count = 0
            unmatched_rows = []
            total_imported_tax = Decimal(0)

            records = MonthlyPayrollRecord.objects.filter(period=period).select_related('personnel')
            record_map = {str(r.national_code).strip().zfill(10): r for r in records}

            with transaction.atomic():
                for r_idx in range(2, ws.max_row + 1):
                    raw_code = ws.cell(r_idx, col_map['national_code']).value
                    if raw_code is None:
                        continue
                    
                    code_str = str(raw_code).split('.')[0].strip().zfill(10)
                    if not code_str or not code_str.isdigit():
                        continue

                    raw_tax = ws.cell(r_idx, col_map['tax_amount']).value or 0
                    try:
                        tax_val = Decimal(str(raw_tax).replace(',', '').strip())
                    except Exception:
                        tax_val = Decimal(0)

                    raw_months = ws.cell(r_idx, col_map.get('exemption_months', 5)).value if 'exemption_months' in col_map else 1
                    try:
                        ex_months = int(raw_months or 1)
                    except Exception:
                        ex_months = 1

                    raw_mult = ws.cell(r_idx, col_map.get('multiple_employers', 6)).value if 'multiple_employers' in col_map else 'خیر'
                    has_mult = str(raw_mult).strip() in ['بله', 'true', 'True', '1', 'YES', 'yes']

                    if code_str in record_map:
                        rec = record_map[code_str]
                        rec.income_tax = tax_val
                        rec.tax_source_type = 'IMPORTED_EXCEL'
                        rec.tax_exemption_months = ex_months
                        rec.has_multiple_employers = has_mult
                        rec.is_tax_imported = True

                        rec.net_salary = rec.gross_salary - rec.worker_insurance - rec.income_tax
                        rec.payable_amount = rec.net_salary - rec.advance_payment_deduction
                        rec.save()

                        matched_count += 1
                        total_imported_tax += tax_val
                    else:
                        unmatched_rows.append({
                            'row': r_idx,
                            'national_code': code_str,
                            'tax_amount': float(tax_val)
                        })

            return Response({
                'message': f'اطلاعات مالیاتی با موفقیت بارگذاری شد. {matched_count} پرسنل تطبیق داده شدند.',
                'matched_count': matched_count,
                'unmatched_count': len(unmatched_rows),
                'unmatched_rows': unmatched_rows,
                'total_imported_tax': float(total_imported_tax),
                'period_year_month': period.year_month
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({
                'error': f'خطا در پردازش فایل اکسل مالیات: {str(e)}'
            }, status=status.HTTP_400_BAD_REQUEST)


