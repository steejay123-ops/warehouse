from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    FinancialProjectViewSet,
    ProjectSectionViewSet,
    UserSectionAssignmentViewSet,
    CounterpartyViewSet,
    ExpenseInvoiceViewSet,
    PersonnelProfileViewSet,
    VehicleDriverProfileViewSet,
    PersonnelChangeRequestViewSet,
    VehicleChangeRequestViewSet,
    DailyAttendanceViewSet,
    VehicleTripViewSet,
    MonthlyWorkPeriodViewSet,
    PayrollYearlySettingsViewSet,
    MonthlyPayrollViewSet,
    FleetSettlementViewSet
)

from .cartable_views import (
    SupervisorCartableAPIView,
    AccountantCartableAPIView,
    ManagerCartableAPIView,
    TreasuryCartableAPIView,
    TreasuryDisketteExportAPIView
)

router = DefaultRouter()
router.register(r'financial-projects', FinancialProjectViewSet, basename='financial-projects')
router.register(r'project-sections', ProjectSectionViewSet, basename='project-sections')
router.register(r'user-section-assignments', UserSectionAssignmentViewSet, basename='user-section-assignments')
router.register(r'counterparties', CounterpartyViewSet, basename='counterparties')
router.register(r'expense-invoices', ExpenseInvoiceViewSet, basename='expense-invoices')
router.register(r'profiles', PersonnelProfileViewSet, basename='personnel-profile')
router.register(r'vehicles', VehicleDriverProfileViewSet, basename='vehicle-profile')
router.register(r'personnel-change-requests', PersonnelChangeRequestViewSet, basename='personnel-change-requests')
router.register(r'vehicle-change-requests', VehicleChangeRequestViewSet, basename='vehicle-change-requests')
router.register(r'attendance', DailyAttendanceViewSet, basename='daily-attendance')
router.register(r'trips', VehicleTripViewSet, basename='vehicle-trips')
router.register(r'periods', MonthlyWorkPeriodViewSet, basename='work-periods')
router.register(r'settings', PayrollYearlySettingsViewSet, basename='payroll-settings')
router.register(r'monthly-payroll', MonthlyPayrollViewSet, basename='monthly-payroll')
router.register(r'fleet-settlement', FleetSettlementViewSet, basename='fleet-settlement')

urlpatterns = [
    path('cartable/supervisor/', SupervisorCartableAPIView.as_view(), name='supervisor-cartable'),
    path('cartable/accountant/', AccountantCartableAPIView.as_view(), name='accountant-cartable'),
    path('cartable/manager/', ManagerCartableAPIView.as_view(), name='manager-cartable'),
    path('cartable/treasury/', TreasuryCartableAPIView.as_view(), name='treasury-cartable'),
    path('cartable/treasury/export-diskette/', TreasuryDisketteExportAPIView.as_view(), name='treasury-export-diskette'),
    path('profiles/import-excel/', PersonnelProfileViewSet.as_view({'post': 'import_excel', 'get': 'import_excel'}), name='personnel-import-excel'),
    path('profiles/import-excel', PersonnelProfileViewSet.as_view({'post': 'import_excel', 'get': 'import_excel'})),
    path('', include(router.urls)),
]

