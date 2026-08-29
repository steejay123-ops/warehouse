from rest_framework import serializers
from django.db import transaction
from django.utils import timezone
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

    class Meta:
        model = PayrollYearlySettings
        fields = '__all__'


class MonthlyPayrollRecordSerializer(serializers.ModelSerializer):
    personnel_name = serializers.CharField(source='personnel.full_name', read_only=True)
    period_year_month = serializers.CharField(source='period.year_month', read_only=True)

    class Meta:
        model = MonthlyPayrollRecord
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']



class PersonnelProfileSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    effective_daily_rate = serializers.FloatField(read_only=True)
    hourly_rate = serializers.FloatField(read_only=True)
    assigned_warehouse_name = serializers.CharField(source='assigned_warehouse.name', read_only=True)
    user_username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = PersonnelProfile
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at', 'created_by']

    def validate_national_code(self, value):
        if not value:
            raise serializers.ValidationError("کد ملی الزامی است.")
        clean_code = str(value).strip().zfill(10)
        if len(clean_code) != 10 or not clean_code.isdigit():
            raise serializers.ValidationError("کد ملی باید دقیقاً ۱۰ رقم عددی باشد.")
        return clean_code


class VehicleDriverProfileSerializer(serializers.ModelSerializer):
    vehicle_type_display = serializers.CharField(source='get_vehicle_type_display', read_only=True)
    ownership_type_display = serializers.CharField(source='get_ownership_type_display', read_only=True)
    assigned_warehouse_name = serializers.CharField(source='assigned_warehouse.name', read_only=True)
    user_username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = VehicleDriverProfile
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at', 'created_by']


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
    status = serializers.ChoiceField(choices=DailyAttendance.STATUS_CHOICES, default='PRESENT_10H')
    effective_hours = serializers.DecimalField(max_digits=5, decimal_places=2, default=10.00)
    overtime_hours = serializers.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    is_friday_work = serializers.BooleanField(default=False)
    is_mission = serializers.BooleanField(default=False)
    advance_payment = serializers.DecimalField(max_digits=12, decimal_places=0, default=0)
    notes = serializers.CharField(max_length=255, required=False, allow_blank=True, allow_null=True)


class BulkAttendanceMatrixSerializer(serializers.Serializer):
    warehouse_id = serializers.IntegerField(required=False, allow_null=True)
    date_shamsi = serializers.CharField(max_length=15)
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
    year_month = serializers.CharField(max_length=10)
    items = MonthlyGridItemInputSerializer(many=True)



class VehicleTripLogSerializer(serializers.ModelSerializer):
    driver_name = serializers.CharField(source='vehicle.driver_name', read_only=True)
    plate_number = serializers.CharField(source='vehicle.plate_number', read_only=True)
    vehicle_type_display = serializers.CharField(source='vehicle.get_vehicle_type_display', read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)

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
    warehouse_id = serializers.IntegerField()
    date_shamsi = serializers.CharField(max_length=10)
    items = VehicleTripItemInputSerializer(many=True)


class MonthlyWorkPeriodSerializer(serializers.ModelSerializer):
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    locked_by_name = serializers.SerializerMethodField()

    class Meta:
        model = MonthlyWorkPeriod
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at', 'locked_at', 'locked_by']

    def get_locked_by_name(self, obj):
        if obj.locked_by:
            return f"{obj.locked_by.first_name} {obj.locked_by.last_name}".strip() or obj.locked_by.username
        return None
