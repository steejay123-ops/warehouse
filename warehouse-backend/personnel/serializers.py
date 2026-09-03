from rest_framework import serializers
from django.db import transaction
from django.utils import timezone
from .models import (
    FinancialProject,
    ProjectSection,
    UserSectionAssignment,
    Counterparty,
    ExpenseInvoice,
    PersonnelProfile,
    VehicleDriverProfile,
    PersonnelChangeRequest,
    VehicleChangeRequest,
    MonthlyWorkPeriod,
    DailyAttendance,
    AttendanceAuditLog,
    VehicleTripLog,
    VehicleTripAuditLog,
    PayrollYearlySettings,
    JobGradeTier,
    WorkshopInsuranceSettings,
    TaxRuleSettings,
    BankExportSettings,
    MonthlyPayrollRecord
)
from .sheba_utils import validate_sheba, clean_sheba, get_bank_from_sheba


class VehicleTripAuditLogSerializer(serializers.ModelSerializer):
    changed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = VehicleTripAuditLog
        fields = '__all__'

    def get_changed_by_name(self, obj):
        if obj.changed_by:
            return f"{obj.changed_by.first_name} {obj.changed_by.last_name}".strip() or obj.changed_by.username
        return 'سیستم'


class JobGradeTierSerializer(serializers.ModelSerializer):
    class Meta:
        model = JobGradeTier
        fields = '__all__'


class WorkshopInsuranceSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkshopInsuranceSettings
        fields = '__all__'


class TaxRuleSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaxRuleSettings
        fields = '__all__'


class BankExportSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = BankExportSettings
        fields = '__all__'


class PayrollYearlySettingsSerializer(serializers.ModelSerializer):
    job_grades = JobGradeTierSerializer(many=True, read_only=True)
    workshop_insurance = WorkshopInsuranceSettingsSerializer(read_only=True)
    tax_settings = TaxRuleSettingsSerializer(read_only=True)
    bank_export_settings = BankExportSettingsSerializer(read_only=True)
    project_name = serializers.CharField(source='project.name', read_only=True)

    class Meta:
        model = PayrollYearlySettings
        fields = '__all__'


class MonthlyPayrollRecordSerializer(serializers.ModelSerializer):
    personnel_name = serializers.CharField(source='personnel.full_name', read_only=True)
    period_year_month = serializers.CharField(source='period.year_month', read_only=True)
    paid_by_name = serializers.SerializerMethodField()

    class Meta:
        model = MonthlyPayrollRecord
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at', 'paid_by', 'paid_at']

    def get_paid_by_name(self, obj):
        if obj.paid_by:
            return f"{obj.paid_by.first_name} {obj.paid_by.last_name}".strip() or obj.paid_by.username
        return None



class PersonnelProfileSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    effective_daily_rate = serializers.FloatField(read_only=True)
    hourly_rate = serializers.FloatField(read_only=True)
    assigned_warehouse_name = serializers.CharField(source='assigned_warehouse.name', read_only=True)
    user_username = serializers.CharField(source='user.username', read_only=True)
    supervisor_approved_by_name = serializers.SerializerMethodField()
    accountant_approved_by_name = serializers.SerializerMethodField()
    manager_approved_by_name = serializers.SerializerMethodField()
    treasury_paid_by_name = serializers.SerializerMethodField()
    revision_requested_by_name = serializers.SerializerMethodField()
    auto_passed_by_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = PersonnelProfile
        fields = '__all__'
        read_only_fields = [
            'created_at', 'updated_at', 'created_by',
            'supervisor_approved_by', 'supervisor_approved_at',
            'accountant_approved_by', 'accountant_approved_at',
            'manager_approved_by', 'manager_approved_at',
            'treasury_paid_by', 'treasury_paid_at',
            'is_auto_passed', 'auto_passed_by', 'auto_passed_at',
            'revision_requested_by', 'revision_requested_at'
        ]

    def get_supervisor_approved_by_name(self, obj):
        if obj.supervisor_approved_by:
            return f"{obj.supervisor_approved_by.first_name} {obj.supervisor_approved_by.last_name}".strip() or obj.supervisor_approved_by.username
        return None

    def get_accountant_approved_by_name(self, obj):
        if obj.accountant_approved_by:
            return f"{obj.accountant_approved_by.first_name} {obj.accountant_approved_by.last_name}".strip() or obj.accountant_approved_by.username
        return None

    def get_manager_approved_by_name(self, obj):
        if obj.manager_approved_by:
            return f"{obj.manager_approved_by.first_name} {obj.manager_approved_by.last_name}".strip() or obj.manager_approved_by.username
        return None

    def get_treasury_paid_by_name(self, obj):
        if obj.treasury_paid_by:
            return f"{obj.treasury_paid_by.first_name} {obj.treasury_paid_by.last_name}".strip() or obj.treasury_paid_by.username
        return None

    def get_revision_requested_by_name(self, obj):
        if obj.revision_requested_by:
            return f"{obj.revision_requested_by.first_name} {obj.revision_requested_by.last_name}".strip() or obj.revision_requested_by.username
        return None

    def get_auto_passed_by_name(self, obj):
        if obj.auto_passed_by:
            return f"{obj.auto_passed_by.first_name} {obj.auto_passed_by.last_name}".strip() or obj.auto_passed_by.username
        return None

    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None

    def validate_national_code(self, value):
        if not value:
            raise serializers.ValidationError("کد ملی الزامی است.")
        clean_code = str(value).strip().zfill(10)
        if len(clean_code) != 10 or not clean_code.isdigit():
            raise serializers.ValidationError("کد ملی باید دقیقاً ۱۰ رقم عددی باشد.")
        return clean_code

    def validate_sheba_number(self, value):
        if not value or not str(value).strip():
            return value
        cleaned = clean_sheba(value)
        is_valid, err_msg, _ = validate_sheba(cleaned)
        if not is_valid:
            raise serializers.ValidationError(err_msg or "شماره شبا نامعتبر است.")
        return cleaned


class VehicleDriverProfileSerializer(serializers.ModelSerializer):
    vehicle_type_display = serializers.CharField(source='get_vehicle_type_display', read_only=True)
    ownership_type_display = serializers.CharField(source='get_ownership_type_display', read_only=True)
    assigned_warehouse_name = serializers.CharField(source='assigned_warehouse.name', read_only=True)
    user_username = serializers.CharField(source='user.username', read_only=True)
    supervisor_approved_by_name = serializers.SerializerMethodField()
    accountant_approved_by_name = serializers.SerializerMethodField()
    manager_approved_by_name = serializers.SerializerMethodField()
    treasury_paid_by_name = serializers.SerializerMethodField()
    revision_requested_by_name = serializers.SerializerMethodField()
    auto_passed_by_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = VehicleDriverProfile
        fields = '__all__'
        read_only_fields = [
            'created_at', 'updated_at', 'created_by',
            'supervisor_approved_by', 'supervisor_approved_at',
            'accountant_approved_by', 'accountant_approved_at',
            'manager_approved_by', 'manager_approved_at',
            'treasury_paid_by', 'treasury_paid_at',
            'is_auto_passed', 'auto_passed_by', 'auto_passed_at',
            'revision_requested_by', 'revision_requested_at'
        ]

    def get_supervisor_approved_by_name(self, obj):
        if obj.supervisor_approved_by:
            return f"{obj.supervisor_approved_by.first_name} {obj.supervisor_approved_by.last_name}".strip() or obj.supervisor_approved_by.username
        return None

    def get_accountant_approved_by_name(self, obj):
        if obj.accountant_approved_by:
            return f"{obj.accountant_approved_by.first_name} {obj.accountant_approved_by.last_name}".strip() or obj.accountant_approved_by.username
        return None

    def get_manager_approved_by_name(self, obj):
        if obj.manager_approved_by:
            return f"{obj.manager_approved_by.first_name} {obj.manager_approved_by.last_name}".strip() or obj.manager_approved_by.username
        return None

    def get_treasury_paid_by_name(self, obj):
        if obj.treasury_paid_by:
            return f"{obj.treasury_paid_by.first_name} {obj.treasury_paid_by.last_name}".strip() or obj.treasury_paid_by.username
        return None

    def get_revision_requested_by_name(self, obj):
        if obj.revision_requested_by:
            return f"{obj.revision_requested_by.first_name} {obj.revision_requested_by.last_name}".strip() or obj.revision_requested_by.username
        return None

    def get_auto_passed_by_name(self, obj):
        if obj.auto_passed_by:
            return f"{obj.auto_passed_by.first_name} {obj.auto_passed_by.last_name}".strip() or obj.auto_passed_by.username
        return None

    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None

    def validate_sheba_number(self, value):
        if not value or not str(value).strip():
            return value
        cleaned = clean_sheba(value)
        is_valid, err_msg, _ = validate_sheba(cleaned)
        if not is_valid:
            raise serializers.ValidationError(err_msg or "شماره شبا نامعتبر است.")
        return cleaned

    def validate(self, data):
        sheba = data.get('sheba_number')
        bank_name = data.get('bank_name')
        if sheba and not bank_name:
            bank_info = get_bank_from_sheba(sheba)
            if bank_info:
                data['bank_name'] = bank_info['name']
        return data


class PersonnelChangeRequestSerializer(serializers.ModelSerializer):
    personnel_name = serializers.CharField(source='personnel.full_name', read_only=True)
    personnel_national_code = serializers.CharField(source='personnel.national_code', read_only=True)
    requested_by_name = serializers.SerializerMethodField()
    supervisor_reviewed_by_name = serializers.SerializerMethodField()
    accountant_reviewed_by_name = serializers.SerializerMethodField()
    manager_reviewed_by_name = serializers.SerializerMethodField()
    revision_requested_by_name = serializers.SerializerMethodField()
    auto_passed_by_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = PersonnelChangeRequest
        fields = '__all__'
        read_only_fields = [
            'created_at', 'updated_at', 'requested_by',
            'supervisor_reviewed_by', 'supervisor_reviewed_at',
            'accountant_reviewed_by', 'accountant_reviewed_at',
            'manager_reviewed_by', 'manager_reviewed_at',
            'is_auto_passed', 'auto_passed_by', 'auto_passed_at',
            'revision_requested_by', 'revision_requested_at'
        ]

    def get_requested_by_name(self, obj):
        if obj.requested_by:
            return f"{obj.requested_by.first_name} {obj.requested_by.last_name}".strip() or obj.requested_by.username
        return "سیستم"

    def get_supervisor_reviewed_by_name(self, obj):
        if obj.supervisor_reviewed_by:
            return f"{obj.supervisor_reviewed_by.first_name} {obj.supervisor_reviewed_by.last_name}".strip() or obj.supervisor_reviewed_by.username
        return None

    def get_accountant_reviewed_by_name(self, obj):
        if obj.accountant_reviewed_by:
            return f"{obj.accountant_reviewed_by.first_name} {obj.accountant_reviewed_by.last_name}".strip() or obj.accountant_reviewed_by.username
        return None

    def get_manager_reviewed_by_name(self, obj):
        if obj.manager_reviewed_by:
            return f"{obj.manager_reviewed_by.first_name} {obj.manager_reviewed_by.last_name}".strip() or obj.manager_reviewed_by.username
        return None

    def get_revision_requested_by_name(self, obj):
        if obj.revision_requested_by:
            return f"{obj.revision_requested_by.first_name} {obj.revision_requested_by.last_name}".strip() or obj.revision_requested_by.username
        return None

    def get_auto_passed_by_name(self, obj):
        if obj.auto_passed_by:
            return f"{obj.auto_passed_by.first_name} {obj.auto_passed_by.last_name}".strip() or obj.auto_passed_by.username
        return None


class VehicleChangeRequestSerializer(serializers.ModelSerializer):
    driver_name = serializers.CharField(source='vehicle.driver_name', read_only=True)
    plate_number = serializers.CharField(source='vehicle.plate_number', read_only=True)
    requested_by_name = serializers.SerializerMethodField()
    supervisor_reviewed_by_name = serializers.SerializerMethodField()
    accountant_reviewed_by_name = serializers.SerializerMethodField()
    manager_reviewed_by_name = serializers.SerializerMethodField()
    revision_requested_by_name = serializers.SerializerMethodField()
    auto_passed_by_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = VehicleChangeRequest
        fields = '__all__'
        read_only_fields = [
            'created_at', 'updated_at', 'requested_by',
            'supervisor_reviewed_by', 'supervisor_reviewed_at',
            'accountant_reviewed_by', 'accountant_reviewed_at',
            'manager_reviewed_by', 'manager_reviewed_at',
            'is_auto_passed', 'auto_passed_by', 'auto_passed_at',
            'revision_requested_by', 'revision_requested_at'
        ]

    def get_requested_by_name(self, obj):
        if obj.requested_by:
            return f"{obj.requested_by.first_name} {obj.requested_by.last_name}".strip() or obj.requested_by.username
        return "سیستم"

    def get_supervisor_reviewed_by_name(self, obj):
        if obj.supervisor_reviewed_by:
            return f"{obj.supervisor_reviewed_by.first_name} {obj.supervisor_reviewed_by.last_name}".strip() or obj.supervisor_reviewed_by.username
        return None

    def get_accountant_reviewed_by_name(self, obj):
        if obj.accountant_reviewed_by:
            return f"{obj.accountant_reviewed_by.first_name} {obj.accountant_reviewed_by.last_name}".strip() or obj.accountant_reviewed_by.username
        return None

    def get_manager_reviewed_by_name(self, obj):
        if obj.manager_reviewed_by:
            return f"{obj.manager_reviewed_by.first_name} {obj.manager_reviewed_by.last_name}".strip() or obj.manager_reviewed_by.username
        return None

    def get_revision_requested_by_name(self, obj):
        if obj.revision_requested_by:
            return f"{obj.revision_requested_by.first_name} {obj.revision_requested_by.last_name}".strip() or obj.revision_requested_by.username
        return None

    def get_auto_passed_by_name(self, obj):
        if obj.auto_passed_by:
            return f"{obj.auto_passed_by.first_name} {obj.auto_passed_by.last_name}".strip() or obj.auto_passed_by.username
        return None


class AttendanceAuditLogSerializer(serializers.ModelSerializer):
    changed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = AttendanceAuditLog
        fields = '__all__'

    def get_changed_by_name(self, obj):
        if obj.changed_by:
            return f"{obj.changed_by.first_name} {obj.changed_by.last_name}".strip() or obj.changed_by.username
        return "سیستم"


class DailyAttendanceSerializer(serializers.ModelSerializer):
    personnel_name = serializers.CharField(source='personnel.full_name', read_only=True)
    personnel_national_code = serializers.CharField(source='personnel.national_code', read_only=True)
    personnel_job_title = serializers.CharField(source='personnel.job_title', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)
    audit_logs = AttendanceAuditLogSerializer(many=True, read_only=True)

    class Meta:
        model = DailyAttendance
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at', 'created_by', 'modified_by']


class AttendanceItemInputSerializer(serializers.Serializer):
    personnel_id = serializers.IntegerField()
    warehouse_id = serializers.IntegerField(required=False, allow_null=True)
    project_id = serializers.IntegerField(required=False, allow_null=True)
    section_id = serializers.IntegerField(required=False, allow_null=True)
    status = serializers.CharField(max_length=20, required=False, allow_blank=True, default='')
    effective_hours = serializers.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    overtime_hours = serializers.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    is_friday_work = serializers.BooleanField(default=False)
    is_mission = serializers.BooleanField(default=False)
    advance_payment = serializers.DecimalField(max_digits=12, decimal_places=0, default=0)
    notes = serializers.CharField(max_length=255, required=False, allow_blank=True, allow_null=True)


class BulkAttendanceMatrixSerializer(serializers.Serializer):
    warehouse_id = serializers.IntegerField(required=False, allow_null=True)
    project_id = serializers.IntegerField(required=False, allow_null=True)
    section_id = serializers.IntegerField(required=False, allow_null=True)
    date_shamsi = serializers.CharField(max_length=15)
    client_tab_id = serializers.CharField(max_length=64, required=False, allow_blank=True, allow_null=True)
    items = AttendanceItemInputSerializer(many=True)


class MonthlyGridItemInputSerializer(serializers.Serializer):
    personnel_id = serializers.IntegerField()
    day = serializers.IntegerField(min_value=1, max_value=31)
    status = serializers.CharField(max_length=20, required=False, allow_blank=True, default='PRESENT_10H')
    effective_hours = serializers.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    overtime_hours = serializers.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    is_friday_work = serializers.BooleanField(default=False)
    is_mission = serializers.BooleanField(default=False)
    advance_payment = serializers.DecimalField(max_digits=12, decimal_places=0, default=0)
    notes = serializers.CharField(max_length=255, required=False, allow_blank=True, allow_null=True)


class BulkMonthlyAttendanceGridSerializer(serializers.Serializer):
    warehouse_id = serializers.IntegerField(required=False, allow_null=True)
    project_id = serializers.IntegerField(required=False, allow_null=True)
    section_id = serializers.IntegerField(required=False, allow_null=True)
    year_month = serializers.CharField(max_length=10)
    client_tab_id = serializers.CharField(max_length=64, required=False, allow_blank=True, allow_null=True)
    items = MonthlyGridItemInputSerializer(many=True)



class VehicleTripLogSerializer(serializers.ModelSerializer):
    driver_name = serializers.CharField(source='vehicle.driver_name', read_only=True)
    plate_number = serializers.CharField(source='vehicle.plate_number', read_only=True)
    vehicle_type_display = serializers.CharField(source='vehicle.get_vehicle_type_display', read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)
    project_name = serializers.CharField(source='project.name', read_only=True)
    section_name = serializers.CharField(source='section.name', read_only=True)

    class Meta:
        model = VehicleTripLog
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at', 'created_by']


class VehicleTripItemInputSerializer(serializers.Serializer):
    vehicle_id = serializers.IntegerField()
    trip_count = serializers.IntegerField(default=1)
    unit_rate = serializers.DecimalField(max_digits=14, decimal_places=0, required=False)
    dispatch_reference = serializers.CharField(max_length=100, required=False, allow_blank=True, allow_null=True)
    origin_destination = serializers.CharField(max_length=255, required=False, allow_blank=True, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class BulkVehicleTripMatrixSerializer(serializers.Serializer):
    warehouse_id = serializers.IntegerField(required=False, allow_null=True)
    project_id = serializers.IntegerField(required=False, allow_null=True)
    section_id = serializers.IntegerField(required=False, allow_null=True)
    date_shamsi = serializers.CharField(max_length=15)
    client_tab_id = serializers.CharField(max_length=64, required=False, allow_blank=True, allow_null=True)
    items = VehicleTripItemInputSerializer(many=True)


class VehicleDayTripUpdateSerializer(serializers.Serializer):
    vehicle_id = serializers.IntegerField()
    warehouse_id = serializers.IntegerField(required=False, allow_null=True)
    project_id = serializers.IntegerField(required=False, allow_null=True)
    section_id = serializers.IntegerField(required=False, allow_null=True)
    date_shamsi = serializers.CharField(max_length=15)
    trip_count = serializers.IntegerField(default=0)
    unit_rate = serializers.DecimalField(max_digits=14, decimal_places=0, required=False, allow_null=True)
    dispatch_reference = serializers.CharField(max_length=100, required=False, allow_blank=True, allow_null=True)
    origin_destination = serializers.CharField(max_length=255, required=False, allow_blank=True, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    client_tab_id = serializers.CharField(max_length=64, required=False, allow_blank=True, allow_null=True)


class VehicleMonthlyGridItemInputSerializer(serializers.Serializer):
    vehicle_id = serializers.IntegerField()
    day = serializers.IntegerField(min_value=1, max_value=31)
    trip_count = serializers.IntegerField(default=0)
    unit_rate = serializers.DecimalField(max_digits=14, decimal_places=0, required=False, allow_null=True)
    dispatch_reference = serializers.CharField(max_length=100, required=False, allow_blank=True, allow_null=True)
    origin_destination = serializers.CharField(max_length=255, required=False, allow_blank=True, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class BulkVehicleMonthlyGridSerializer(serializers.Serializer):
    warehouse_id = serializers.IntegerField(required=False, allow_null=True)
    project_id = serializers.IntegerField(required=False, allow_null=True)
    section_id = serializers.IntegerField(required=False, allow_null=True)
    year_month = serializers.CharField(max_length=10)
    client_tab_id = serializers.CharField(max_length=64, required=False, allow_blank=True, allow_null=True)
    items = VehicleMonthlyGridItemInputSerializer(many=True)


class MonthlyWorkPeriodSerializer(serializers.ModelSerializer):
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    locked_by_name = serializers.SerializerMethodField()
    submitted_by_name = serializers.SerializerMethodField()

    class Meta:
        model = MonthlyWorkPeriod
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at', 'locked_at', 'locked_by', 'submitted_at', 'submitted_by']

    def get_locked_by_name(self, obj):
        if obj.locked_by:
            return f"{obj.locked_by.first_name} {obj.locked_by.last_name}".strip() or obj.locked_by.username
        return None

    def get_submitted_by_name(self, obj):
        if obj.submitted_by:
            return f"{obj.submitted_by.first_name} {obj.submitted_by.last_name}".strip() or obj.submitted_by.username
        return None


# ==============================================================================
# سریالایزرهای ساختار سازمانی، پروژه، بخش، طرف‌حساب و فاکتور هزینه
# ==============================================================================

class FinancialProjectSerializer(serializers.ModelSerializer):
    sections_count = serializers.IntegerField(source='sections.count', read_only=True)

    class Meta:
        model = FinancialProject
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']


class ProjectSectionSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source='project.name', read_only=True)
    project_code = serializers.CharField(source='project.code', read_only=True)

    class Meta:
        model = ProjectSection
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']


class UserSectionAssignmentSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    user_full_name = serializers.SerializerMethodField()
    section_name = serializers.CharField(source='section.name', read_only=True)
    section_code = serializers.CharField(source='section.code', read_only=True)
    project_id = serializers.IntegerField(source='section.project.id', read_only=True)
    project_name = serializers.CharField(source='section.project.name', read_only=True)
    role_display = serializers.CharField(source='get_role_display', read_only=True)

    class Meta:
        model = UserSectionAssignment
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']

    def get_user_full_name(self, obj):
        if obj.user:
            return f"{obj.user.first_name} {obj.user.last_name}".strip() or obj.user.username
        return None


class CounterpartySerializer(serializers.ModelSerializer):
    counterparty_type_display = serializers.CharField(source='get_counterparty_type_display', read_only=True)
    section_name = serializers.CharField(source='section.name', read_only=True)

    class Meta:
        model = Counterparty
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']


class ExpenseInvoiceSerializer(serializers.ModelSerializer):
    section_name = serializers.CharField(source='section.name', read_only=True)
    project_id = serializers.IntegerField(source='section.project.id', read_only=True)
    project_name = serializers.CharField(source='section.project.name', read_only=True)
    counterparty_name = serializers.CharField(source='counterparty.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ExpenseInvoice
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at', 'created_by']

    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None

