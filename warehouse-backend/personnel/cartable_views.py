# -*- coding: utf-8 -*-
"""
Enterprise 5-Tier Cartable Views Module (Phase 3).
Provides role-specific aggregated cartable endpoints for:
1. Supervisor Cartable (/api/personnel/cartable/supervisor/)
2. Accountant / Finance Cartable (/api/personnel/cartable/accountant/)
3. General Manager Cartable (/api/personnel/cartable/manager/)
4. Treasury & Banking Cartable (/api/personnel/cartable/treasury/)
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from django.http import HttpResponse
from django.db.models import Q
from django.utils import timezone

from accounts.permissions import (
    CanApprovePersonnelSupervisor,
    CanApproveFleetSupervisor,
    CanApprovePersonnelFinance,
    CanApproveFleetFinance,
    CanAuthorizePaymentManager,
    CanDisburseTreasury,
    CanViewTreasury
)

from .models import (
    PersonnelProfile,
    VehicleDriverProfile,
    PersonnelChangeRequest,
    VehicleChangeRequest,
    MonthlyWorkPeriod,
    MonthlyPayrollRecord,
    VehicleTripLog
)
from .serializers import (
    PersonnelProfileSerializer,
    VehicleDriverProfileSerializer,
    PersonnelChangeRequestSerializer,
    VehicleChangeRequestSerializer,
    MonthlyWorkPeriodSerializer,
    MonthlyPayrollRecordSerializer
)
from .workflow_engine import (
    WorkflowStatuses,
    WorkflowTiers,
    determine_user_tier,
    advance_workflow_step,
    request_workflow_revision,
    reject_workflow
)
from .treasury_engine import (
    TreasuryDisbursementService,
    generate_paya_diskette_csv,
    generate_satna_diskette_csv
)


def _get_target_instance(model_name: str, instance_id: int):
    """یافتن نمونه مدل بر اساس نام و شناسه"""
    models_map = {
        'personnel': PersonnelProfile,
        'personnel_profile': PersonnelProfile,
        'vehicle': VehicleDriverProfile,
        'vehicle_driver': VehicleDriverProfile,
        'personnel_change': PersonnelChangeRequest,
        'personnel_change_request': PersonnelChangeRequest,
        'vehicle_change': VehicleChangeRequest,
        'vehicle_change_request': VehicleChangeRequest,
        'period': MonthlyWorkPeriod,
        'work_period': MonthlyWorkPeriod,
        'payroll': MonthlyPayrollRecord,
        'payroll_record': MonthlyPayrollRecord,
        'trip': VehicleTripLog
    }
    model_cls = models_map.get(model_name.lower())
    if not model_cls:
        raise ValidationError(f"مدل «{model_name}» نامعتبر است.")
    try:
        return model_cls.objects.get(pk=instance_id)
    except model_cls.DoesNotExist:
        raise ValidationError(f"رکورد موردنظر در مدل «{model_name}» یافت نشد.")


class SupervisorCartableAPIView(APIView):
    """
    کارتابل یکپارچه سرپرست انبار (سطح ۲)
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        tier = determine_user_tier(user)
        if tier < WorkflowTiers.TIER_2_SUPERVISOR:
            raise PermissionDenied("دسترسی به کارتابل سرپرست مجاز نمی‌باشد.")

        # رکوردهای پرسنل نیازمند بررسی سرپرست
        personnel_qs = PersonnelProfile.objects.filter(
            approval_status__in=[WorkflowStatuses.DRAFT, WorkflowStatuses.PENDING_SUPERVISOR, WorkflowStatuses.REVISION_REQUIRED]
        ).select_related('assigned_warehouse', 'user')

        # رکوردهای ناوگان نیازمند بررسی سرپرست
        vehicles_qs = VehicleDriverProfile.objects.filter(
            approval_status__in=[WorkflowStatuses.DRAFT, WorkflowStatuses.PENDING_SUPERVISOR, WorkflowStatuses.REVISION_REQUIRED]
        ).select_related('assigned_warehouse', 'user')

        # درخواست‌های تغییرات پرسنل
        p_changes = PersonnelChangeRequest.objects.filter(
            status__in=[WorkflowStatuses.PENDING_SUPERVISOR, WorkflowStatuses.REVISION_REQUIRED]
        ).select_related('personnel', 'requested_by')

        # درخواست‌های تغییرات ناوگان
        v_changes = VehicleChangeRequest.objects.filter(
            status__in=[WorkflowStatuses.PENDING_SUPERVISOR, WorkflowStatuses.REVISION_REQUIRED]
        ).select_related('vehicle', 'requested_by')

        # دوره‌های کارکرد نیازمند بررسی اولیه
        periods = MonthlyWorkPeriod.objects.filter(
            status__in=[WorkflowStatuses.PERIOD_OPEN, WorkflowStatuses.PERIOD_REVISION_REQUIRED]
        )

        return Response({
            'tier': 'SUPERVISOR',
            'counts': {
                'personnel': personnel_qs.count(),
                'vehicles': vehicles_qs.count(),
                'personnel_changes': p_changes.count(),
                'vehicle_changes': v_changes.count(),
                'periods': periods.count(),
                'total_pending': personnel_qs.count() + vehicles_qs.count() + p_changes.count() + v_changes.count() + periods.count()
            },
            'personnel': PersonnelProfileSerializer(personnel_qs[:50], many=True).data,
            'vehicles': VehicleDriverProfileSerializer(vehicles_qs[:50], many=True).data,
            'personnel_changes': PersonnelChangeRequestSerializer(p_changes[:50], many=True).data,
            'vehicle_changes': VehicleChangeRequestSerializer(v_changes[:50], many=True).data,
            'periods': MonthlyWorkPeriodSerializer(periods, many=True).data
        })

    def post(self, request):
        """ثبت اقدام (تایید، ارجاع به بازنگری یا رد) توسط سرپرست"""
        user = request.user
        action_type = request.data.get('action') # 'approve', 'revision', 'reject'
        model_name = request.data.get('model')
        item_id = request.data.get('id')
        reason = request.data.get('reason', '')

        if not action_type or not model_name or not item_id:
            raise ValidationError("پارامترهای action، model و id الزامی هستند.")

        instance = _get_target_instance(model_name, item_id)
        is_financial = model_name in ['period', 'work_period', 'payroll', 'payroll_record']

        if action_type == 'approve':
            updated = advance_workflow_step(instance, user, is_financial=is_financial)
            return Response({'message': 'تایید سرپرست با موفقیت ثبت گردید و پرونده به مرحله بعد ارسال شد.'})
        elif action_type == 'revision':
            if not reason:
                raise ValidationError("ثبت علت بازنگری الزامی است.")
            updated = request_workflow_revision(instance, user, reason=reason)
            return Response({'message': 'پرونده جهت بازنگری و اصلاح به مرحله قبل ارجاع گردید.'})
        elif action_type == 'reject':
            if not reason:
                raise ValidationError("ثبت دلیل ابطال پرونده الزامی است.")
            updated = reject_workflow(instance, user, reason=reason)
            return Response({'message': 'پرونده با موفقیت ابطال و بایگانی شد.'})
        else:
            raise ValidationError(f"اقدام «{action_type}» نامعتبر است.")


class AccountantCartableAPIView(APIView):
    """
    کارتابل یکپارچه حسابداری و مالی (سطح ۳)
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        tier = determine_user_tier(user)
        if tier < WorkflowTiers.TIER_3_ACCOUNTANT:
            raise PermissionDenied("دسترسی به کارتابل حسابداری مجاز نمی‌باشد.")

        personnel_qs = PersonnelProfile.objects.filter(
            approval_status__in=[WorkflowStatuses.PENDING_ACCOUNTANT, 'manager_approved', WorkflowStatuses.SUPERVISOR_APPROVED]
        ).select_related('assigned_warehouse', 'user')

        vehicles_qs = VehicleDriverProfile.objects.filter(
            approval_status__in=[WorkflowStatuses.PENDING_ACCOUNTANT, 'manager_approved', WorkflowStatuses.SUPERVISOR_APPROVED]
        ).select_related('assigned_warehouse', 'user')

        p_changes = PersonnelChangeRequest.objects.filter(
            status__in=[WorkflowStatuses.PENDING_ACCOUNTANT, 'pending_finance']
        ).select_related('personnel', 'requested_by')

        v_changes = VehicleChangeRequest.objects.filter(
            status__in=[WorkflowStatuses.PENDING_ACCOUNTANT, 'pending_finance']
        ).select_related('vehicle', 'requested_by')

        periods = MonthlyWorkPeriod.objects.filter(
            status__in=[WorkflowStatuses.PERIOD_SUBMITTED_SUPERVISOR, 'SUBMITTED_SUPERVISOR']
        )

        return Response({
            'tier': 'ACCOUNTANT',
            'counts': {
                'personnel': personnel_qs.count(),
                'vehicles': vehicles_qs.count(),
                'personnel_changes': p_changes.count(),
                'vehicle_changes': v_changes.count(),
                'periods': periods.count(),
                'total_pending': personnel_qs.count() + vehicles_qs.count() + p_changes.count() + v_changes.count() + periods.count()
            },
            'personnel': PersonnelProfileSerializer(personnel_qs[:50], many=True).data,
            'vehicles': VehicleDriverProfileSerializer(vehicles_qs[:50], many=True).data,
            'personnel_changes': PersonnelChangeRequestSerializer(p_changes[:50], many=True).data,
            'vehicle_changes': VehicleChangeRequestSerializer(v_changes[:50], many=True).data,
            'periods': MonthlyWorkPeriodSerializer(periods, many=True).data
        })

    def post(self, request):
        user = request.user
        action_type = request.data.get('action')
        model_name = request.data.get('model')
        item_id = request.data.get('id')
        reason = request.data.get('reason', '')

        if not action_type or not model_name or not item_id:
            raise ValidationError("پارامترهای action، model و id الزامی هستند.")

        instance = _get_target_instance(model_name, item_id)
        is_financial = model_name in ['period', 'work_period', 'payroll', 'payroll_record']

        if action_type == 'approve':
            updated = advance_workflow_step(instance, user, is_financial=is_financial)
            return Response({'message': 'تایید مالی و محاسباتی با موفقیت ثبت شد و به مدیر ارجاع گردید.'})
        elif action_type == 'revision':
            if not reason:
                raise ValidationError("ثبت علت بازنگری الزامی است.")
            updated = request_workflow_revision(instance, user, reason=reason)
            return Response({'message': 'پرونده با ثبت اشکال به سرپرست/ثبت‌کننده برگردانده شد.'})
        elif action_type == 'reject':
            if not reason:
                raise ValidationError("ثبت دلیل ابطال الزامی است.")
            updated = reject_workflow(instance, user, reason=reason)
            return Response({'message': 'پرونده ابطال و رد قطعی گردید.'})
        else:
            raise ValidationError(f"اقدام «{action_type}» نامعتبر است.")


class ManagerCartableAPIView(APIView):
    """
    کارتابل یکپارچه مدیریت شرکت (سطح ۴) - صدور مجوزهای نهایی و مجوز پرداخت
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        tier = determine_user_tier(user)
        if tier < WorkflowTiers.TIER_4_MANAGER:
            raise PermissionDenied("دسترسی به کارتابل مدیر شرکت مجاز نمی‌باشد.")

        personnel_qs = PersonnelProfile.objects.filter(
            approval_status__in=[WorkflowStatuses.PENDING_MANAGER, WorkflowStatuses.ACCOUNTANT_APPROVED]
        ).select_related('assigned_warehouse', 'user')

        vehicles_qs = VehicleDriverProfile.objects.filter(
            approval_status__in=[WorkflowStatuses.PENDING_MANAGER, WorkflowStatuses.ACCOUNTANT_APPROVED]
        ).select_related('assigned_warehouse', 'user')

        p_changes = PersonnelChangeRequest.objects.filter(
            status__in=[WorkflowStatuses.PENDING_MANAGER, 'pending_manager']
        ).select_related('personnel', 'requested_by')

        v_changes = VehicleChangeRequest.objects.filter(
            status__in=[WorkflowStatuses.PENDING_MANAGER, 'pending_manager']
        ).select_related('vehicle', 'requested_by')

        periods = MonthlyWorkPeriod.objects.filter(
            status__in=[WorkflowStatuses.PERIOD_SUBMITTED_ACCOUNTANT, 'SUBMITTED_ACCOUNTANT']
        )

        return Response({
            'tier': 'MANAGER',
            'counts': {
                'personnel': personnel_qs.count(),
                'vehicles': vehicles_qs.count(),
                'personnel_changes': p_changes.count(),
                'vehicle_changes': v_changes.count(),
                'periods': periods.count(),
                'total_pending': personnel_qs.count() + vehicles_qs.count() + p_changes.count() + v_changes.count() + periods.count()
            },
            'personnel': PersonnelProfileSerializer(personnel_qs[:50], many=True).data,
            'vehicles': VehicleDriverProfileSerializer(vehicles_qs[:50], many=True).data,
            'personnel_changes': PersonnelChangeRequestSerializer(p_changes[:50], many=True).data,
            'vehicle_changes': VehicleChangeRequestSerializer(v_changes[:50], many=True).data,
            'periods': MonthlyWorkPeriodSerializer(periods, many=True).data
        })

    def post(self, request):
        user = request.user
        action_type = request.data.get('action')
        model_name = request.data.get('model')
        item_id = request.data.get('id')
        reason = request.data.get('reason', '')

        if not action_type or not model_name or not item_id:
            raise ValidationError("پارامترهای action، model و id الزامی هستند.")

        instance = _get_target_instance(model_name, item_id)
        is_financial = model_name in ['period', 'work_period', 'payroll', 'payroll_record']

        if action_type == 'approve':
            updated = advance_workflow_step(instance, user, is_financial=is_financial)
            msg = 'مجوز پرداخت اسناد مالی با موفقیت صادر و به خزانه‌داری ارسال شد.' if is_financial else 'پرونده با موفقیت تصویب نهایی و در سیستم فعال شد.'
            return Response({'message': msg})
        elif action_type == 'revision':
            if not reason:
                raise ValidationError("ثبت علت بازنگری الزامی است.")
            updated = request_workflow_revision(instance, user, reason=reason)
            return Response({'message': 'پرونده با دستور مدیریت جهت بازنگری ارجاع گردید.'})
        elif action_type == 'reject':
            if not reason:
                raise ValidationError("ثبت علت رد الزامی است.")
            updated = reject_workflow(instance, user, reason=reason)
            return Response({'message': 'پرونده توسط مدیریت ابطال گردید.'})
        else:
            raise ValidationError(f"اقدام «{action_type}» نامعتبر است.")


class TreasuryCartableAPIView(APIView):
    """
    کارتابل اختصاصی خزانه‌داری و صدور دیسکت‌های بانکی (سطح ۵)
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        tier = determine_user_tier(user)
        if tier < WorkflowTiers.TIER_5_TREASURY:
            raise PermissionDenied("دسترسی به کارتابل خزانه‌داری مجاز نمی‌باشد.")

        data = TreasuryDisbursementService.get_pending_treasury_batches()

        # دریافت سوابق تفکیکی حقوق آماده پرداخت
        payrolls = MonthlyPayrollRecord.objects.filter(
            payment_status__in=[WorkflowStatuses.PAYROLL_READY_TO_PAY, 'READY_TO_PAY', WorkflowStatuses.PAYROLL_FAILED_SHEBA]
        ).select_related('personnel', 'period')[:100]

        # دریافت سرویس‌های ناوگان تسویه‌نشده
        trips = VehicleTripLog.objects.filter(
            is_settled=False,
            vehicle__approval_status__in=[WorkflowStatuses.APPROVED, 'approved']
        ).select_related('vehicle')[:100]

        data['payrolls'] = MonthlyPayrollRecordSerializer(payrolls, many=True).data
        data['trips'] = [
            {
                'id': t.id,
                'vehicle_id': t.vehicle_id,
                'driver_name': t.vehicle.driver_name,
                'plate_number': t.vehicle.plate_number,
                'sheba_number': t.vehicle.sheba_number,
                'bank_name': t.vehicle.bank_name,
                'date_shamsi': t.date_shamsi,
                'total_amount': int(t.total_amount or 0),
                'is_settled': t.is_settled
            }
            for t in trips
        ]

        return Response(data)

    def post(self, request):
        """اجرای تسویه خزانه‌داری (دوره یا منفرد)"""
        user = request.user
        action = request.data.get('action') # 'disburse_period', 'disburse_single_payroll', 'disburse_fleet'
        tracking_code = request.data.get('tracking_code')
        batch_id = request.data.get('batch_id', '')

        if not action or not tracking_code:
            raise ValidationError("پارامترهای action و tracking_code الزامی هستند.")

        if action == 'disburse_period':
            period_id = request.data.get('period_id')
            period = MonthlyWorkPeriod.objects.get(pk=period_id)
            res = TreasuryDisbursementService.disburse_payroll_period(
                period=period,
                treasury_user=user,
                tracking_code=tracking_code,
                batch_id=batch_id
            )
            return Response(res)

        elif action == 'disburse_single_payroll':
            payroll_id = request.data.get('payroll_id')
            rec = MonthlyPayrollRecord.objects.get(pk=payroll_id)
            updated_rec = TreasuryDisbursementService.disburse_single_payroll_record(
                record=rec,
                treasury_user=user,
                tracking_code=tracking_code,
                batch_id=batch_id
            )
            return Response({
                'message': 'تسویه رکورد منفرد حقوق با موفقیت انجام شد.',
                'record': MonthlyPayrollRecordSerializer(updated_rec).data
            })

        elif action == 'disburse_fleet':
            trip_ids = request.data.get('trip_ids', [])
            if not trip_ids:
                raise ValidationError("شناسه سفرهای ناوگان ارسال نشده است.")
            res = TreasuryDisbursementService.disburse_fleet_trips(
                trip_ids=trip_ids,
                treasury_user=user,
                tracking_code=tracking_code,
                batch_id=batch_id
            )
            return Response(res)

        else:
            raise ValidationError(f"اقدام «{action}» نامعتبر است.")


class TreasuryDisketteExportAPIView(APIView):
    """
    دانلود دیسکت‌های بانکی پایا و ساتنا برای دوره‌ها
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        tier = determine_user_tier(user)
        if tier < WorkflowTiers.TIER_5_TREASURY:
            raise PermissionDenied("دسترسی به خروجی دیسکت خزانه‌داری مجاز نمی‌باشد.")

        period_id = request.query_params.get('period_id')
        diskette_type = request.query_params.get('type', 'paya').lower()

        if not period_id:
            raise ValidationError("پارامتر period_id الزامی است.")

        period = MonthlyWorkPeriod.objects.get(pk=period_id)
        records = MonthlyPayrollRecord.objects.filter(
            period=period,
            include_in_bank=True
        ).select_related('personnel')

        if diskette_type == 'satna':
            content = generate_satna_diskette_csv(records, payment_description=f"حقوق {period.year_month}")
            filename = f"SATNA_{period.year_month.replace('/', '')}.csv"
        else:
            content = generate_paya_diskette_csv(records, payment_description=f"حقوق {period.year_month}")
            filename = f"PAYA_{period.year_month.replace('/', '')}.csv"

        response = HttpResponse(content.encode('utf-8-sig'), content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response
