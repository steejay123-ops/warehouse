from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    PersonnelProfileViewSet,
    VehicleDriverProfileViewSet,
    DailyAttendanceViewSet,
    VehicleTripViewSet,
    MonthlyWorkPeriodViewSet,
    PayrollYearlySettingsViewSet,
    MonthlyPayrollViewSet,
    FleetSettlementViewSet
)

router = DefaultRouter()
router.register(r'profiles', PersonnelProfileViewSet, basename='personnel-profile')
router.register(r'vehicles', VehicleDriverProfileViewSet, basename='vehicle-profile')
router.register(r'attendance', DailyAttendanceViewSet, basename='daily-attendance')
router.register(r'trips', VehicleTripViewSet, basename='vehicle-trips')
router.register(r'periods', MonthlyWorkPeriodViewSet, basename='work-periods')
router.register(r'settings', PayrollYearlySettingsViewSet, basename='payroll-settings')
router.register(r'monthly-payroll', MonthlyPayrollViewSet, basename='monthly-payroll')
router.register(r'fleet-settlement', FleetSettlementViewSet, basename='fleet-settlement')

urlpatterns = [
    path('profiles/import-excel/', PersonnelProfileViewSet.as_view({'post': 'import_excel', 'get': 'import_excel'}), name='personnel-import-excel'),
    path('profiles/import-excel', PersonnelProfileViewSet.as_view({'post': 'import_excel', 'get': 'import_excel'})),
    path('', include(router.urls)),
]

