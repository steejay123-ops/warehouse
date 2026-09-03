from django.contrib import admin
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
    VehicleTripLog
)


@admin.register(FinancialProject)
class FinancialProjectAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'is_active', 'created_at')
    search_fields = ('code', 'name', 'description')
    list_filter = ('is_active',)


@admin.register(ProjectSection)
class ProjectSectionAdmin(admin.ModelAdmin):
    list_display = ('project', 'code', 'name', 'is_active')
    search_fields = ('code', 'name', 'project__name', 'project__code')
    list_filter = ('project', 'is_active')


@admin.register(UserSectionAssignment)
class UserSectionAssignmentAdmin(admin.ModelAdmin):
    list_display = ('user', 'section', 'role', 'is_active', 'created_at')
    search_fields = ('user__username', 'user__first_name', 'user__last_name', 'section__name')
    list_filter = ('role', 'is_active', 'section__project')


@admin.register(Counterparty)
class CounterpartyAdmin(admin.ModelAdmin):
    list_display = ('name', 'counterparty_type', 'phone', 'national_id', 'section', 'is_active')
    search_fields = ('name', 'national_id', 'phone', 'sheba_number')
    list_filter = ('counterparty_type', 'is_active', 'section')


@admin.register(ExpenseInvoice)
class ExpenseInvoiceAdmin(admin.ModelAdmin):
    list_display = ('invoice_number', 'section', 'counterparty', 'amount', 'invoice_date_shamsi', 'status', 'created_by')
    search_fields = ('invoice_number', 'counterparty__name', 'description')
    list_filter = ('status', 'section__project', 'section')



@admin.register(PersonnelProfile)
class PersonnelProfileAdmin(admin.ModelAdmin):
    list_display = ('full_name', 'national_code', 'job_title', 'contract_type', 'daily_base_wage', 'assigned_warehouse', 'is_active')
    search_fields = ('first_name', 'last_name', 'national_code', 'job_title')
    list_filter = ('assigned_warehouse', 'contract_type', 'is_active', 'marital_status')


@admin.register(VehicleDriverProfile)
class VehicleDriverProfileAdmin(admin.ModelAdmin):
    list_display = ('driver_name', 'plate_number', 'vehicle_type', 'approval_status', 'default_service_rate', 'assigned_warehouse', 'is_active')
    search_fields = ('driver_name', 'plate_number', 'driver_national_code')
    list_filter = ('assigned_warehouse', 'approval_status', 'vehicle_type', 'is_active')


@admin.register(PersonnelChangeRequest)
class PersonnelChangeRequestAdmin(admin.ModelAdmin):
    list_display = ('personnel', 'requested_by', 'status', 'created_at', 'manager_reviewed_by', 'accountant_reviewed_by')
    list_filter = ('status', 'created_at')
    search_fields = ('personnel__first_name', 'personnel__last_name', 'personnel__national_code')


@admin.register(VehicleChangeRequest)
class VehicleChangeRequestAdmin(admin.ModelAdmin):
    list_display = ('vehicle', 'requested_by', 'status', 'created_at', 'manager_reviewed_by', 'accountant_reviewed_by')
    list_filter = ('status', 'created_at')
    search_fields = ('vehicle__driver_name', 'vehicle__plate_number')


@admin.register(MonthlyWorkPeriod)
class MonthlyWorkPeriodAdmin(admin.ModelAdmin):
    list_display = ('warehouse', 'year_month', 'status', 'locked_at', 'locked_by')
    list_filter = ('warehouse', 'status')


@admin.register(DailyAttendance)
class DailyAttendanceAdmin(admin.ModelAdmin):
    list_display = ('personnel', 'date_shamsi', 'warehouse', 'status', 'effective_hours', 'overtime_hours', 'is_friday_work', 'is_mission')
    list_filter = ('warehouse', 'status', 'is_friday_work', 'is_mission')
    search_fields = ('personnel__first_name', 'personnel__last_name', 'personnel__national_code', 'date_shamsi')


@admin.register(AttendanceAuditLog)
class AttendanceAuditLogAdmin(admin.ModelAdmin):
    list_display = ('personnel_name', 'date_shamsi', 'field_name', 'old_value', 'new_value', 'changed_by', 'changed_at')
    search_fields = ('personnel_name', 'date_shamsi', 'field_name')
    list_filter = ('field_name', 'changed_at')


@admin.register(VehicleTripLog)
class VehicleTripLogAdmin(admin.ModelAdmin):
    list_display = ('vehicle', 'date_shamsi', 'warehouse', 'trip_count', 'unit_rate', 'total_amount', 'dispatch_reference')
    list_filter = ('warehouse', 'date_shamsi')
    search_fields = ('vehicle__driver_name', 'vehicle__plate_number', 'dispatch_reference')
