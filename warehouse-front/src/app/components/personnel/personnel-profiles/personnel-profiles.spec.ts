// @vitest-environment jsdom
import '@angular/compiler';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PersonnelProfilesHub } from './personnel-profiles';
import { of } from 'rxjs';

describe('PersonnelProfilesHub Unit Tests', () => {
  let component: PersonnelProfilesHub;
  let mockState: any;
  let mockAuth: any;
  let mockApi: any;
  let mockWhService: any;
  let mockToast: any;
  let mockConfirmDialog: any;
  let mockCdr: any;
  let mockRoute: any;
  let mockRouter: any;

  beforeEach(() => {
    mockState = {
      hasRole: vi.fn().mockReturnValue(true)
    };

    mockAuth = {
      userPermissions: vi.fn().mockReturnValue(['perm_approve_personnel_manager', 'perm_approve_personnel_finance', 'admin_all'])
    };

    mockApi = {
      getPersonnelProfiles: vi.fn().mockReturnValue(of([
        { id: 1, first_name: 'حسین', last_name: 'اکبری', national_code: '2452304301', job_grade: '19', daily_base_wage: 6572696, daily_seniority_bonus: 171867, base_daily_rate: 6572696, hourly_rate: 657270, approval_status: 'draft', is_active: true }
      ])),
      getVehicleProfiles: vi.fn().mockReturnValue(of([
        { id: 1, driver_name: 'علی رضایی', plate_number: '12B345IR68', vehicle_type: 'pickup', ownership_type: 'contract', default_service_rate: 2000000, approval_status: 'approved', is_active: true }
      ])),
      getPersonnelChangeRequests: vi.fn().mockReturnValue(of([
        { id: 1, personnel: 1, personnel_name: 'حسین اکبری', national_code: '2452304301', proposed_changes: { daily_base_wage: 7000000 }, status: 'manager_approved' }
      ])),
      getVehicleChangeRequests: vi.fn().mockReturnValue(of([])),
      getYearlySettings: vi.fn().mockReturnValue(of({
        fiscal_year: '1405',
        monthly_housing_allowance: 30000000,
        monthly_food_allowance: 22000000,
        monthly_spouse_allowance: 5000000
      })),
      getJobGradeRate: vi.fn().mockReturnValue(of({
        daily_base_wage: 6572696,
        daily_seniority_bonus: 171867,
        hourly_rate: 657270
      })),
      createPersonnelProfile: vi.fn().mockReturnValue(of({ message: 'پرسنل جدید با موفقیت ثبت شد' })),
      updatePersonnelProfile: vi.fn().mockReturnValue(of({ message: 'به‌روزرسانی شد' })),
      deletePersonnelProfile: vi.fn().mockReturnValue(of({ message: 'حذف شد' })),
      createVehicleProfile: vi.fn().mockReturnValue(of({ message: 'خودرو جدید ثبت شد' })),
      updateVehicleProfile: vi.fn().mockReturnValue(of({ message: 'خودرو به‌روزرسانی شد' })),
      deleteVehicleProfile: vi.fn().mockReturnValue(of({ message: 'خودرو حذف شد' })),
      approvePersonnelManager: vi.fn().mockReturnValue(of({ message: 'تایید مدیر ثبت شد' })),
      approvePersonnelFinance: vi.fn().mockReturnValue(of({ message: 'تایید مالی ثبت شد' }))
    };

    mockWhService = {
      getAll: vi.fn().mockReturnValue(of([
        { id: 1, name: 'انبار مرکزی' }
      ]))
    };

    mockToast = {
      show: vi.fn()
    };

    mockConfirmDialog = {
      open: vi.fn().mockResolvedValue(true)
    };

    mockCdr = {
      detectChanges: vi.fn()
    };

    mockRoute = {
      queryParams: of({ tab: 'personnel', status: 'ALL' })
    };

    mockRouter = {
      navigate: vi.fn()
    };

    component = new PersonnelProfilesHub(
      mockState,
      mockAuth,
      mockApi,
      mockWhService,
      mockToast,
      mockConfirmDialog,
      mockCdr,
      mockRoute,
      mockRouter
    );
  });

  it('1. should initialize and load personnel profiles on ngOnInit', () => {
    component.ngOnInit();
    expect(mockWhService.getAll).toHaveBeenCalled();
    expect(mockApi.getPersonnelProfiles).toHaveBeenCalled();
    expect(component.personnelList.length).toBe(1);
    expect(component.personnelList[0].first_name).toBe('حسین');
  });

  it('2. should open and configure 5-tab Personnel modal with defaults', () => {
    component.openAddPersonnelModal();
    expect(component.isPersonnelModalOpen).toBe(true);
    expect(component.personnelModalTab).toBe('identity');
    expect(component.editingPersonnel).toBeDefined();
    expect(component.editingPersonnel?.job_grade).toBe('19');

    // Switch tabs
    component.setPersonnelTab('contract');
    expect(component.personnelModalTab).toBe('contract');

    component.setPersonnelTab('insurance');
    expect(component.personnelModalTab).toBe('insurance');

    component.setPersonnelTab('allowances');
    expect(component.personnelModalTab).toBe('allowances');

    component.setPersonnelTab('contact');
    expect(component.personnelModalTab).toBe('contact');
  });

  it('3. should recalculate rates accurately on grade or experience change', () => {
    component.openAddPersonnelModal();
    component.editingPersonnel!.daily_base_wage = 6000000;
    component.editingPersonnel!.daily_seniority_bonus = 200000;
    component.editingPersonnel!.base_years_experience = 2;

    component.recalculatePersonnelRates();

    // base_daily_rate = 6000000 + (2 * 200000) = 6400000
    expect(component.editingPersonnel!.base_daily_rate).toBe(6400000);
    // hourly_rate = 6400000 / 10 = 640000
    expect(component.editingPersonnel!.hourly_rate).toBe(640000);
  });

  it('4. should switch top tabs to vehicles and load fleet', () => {
    component.setTab('vehicles');
    expect(component.activeTab).toBe('vehicles');
    expect(mockApi.getVehicleProfiles).toHaveBeenCalled();
    expect(component.vehiclesList.length).toBe(1);
    expect(component.vehiclesList[0].driver_name).toBe('علی رضایی');
  });

  it('5. should open and compute Diff Viewer modal correctly', () => {
    component.personnelList = [
      { id: 1, first_name: 'حسین', last_name: 'اکبری', national_code: '2452304301', daily_base_wage: 6572696 } as any
    ];

    const cr = {
      id: 1,
      personnel: 1,
      personnel_name: 'حسین اکبری',
      proposed_changes: { daily_base_wage: 7000000 }
    };

    component.openDiffModal(cr, 'personnel');
    expect(component.isDiffModalOpen).toBe(true);
    expect(component.diffRows.length).toBe(1);
    expect(component.diffRows[0].key).toBe('daily_base_wage');
    expect(component.diffRows[0].oldValue).toBe(6572696);
    expect(component.diffRows[0].newValue).toBe(7000000);
    expect(component.diffRows[0].isDiff).toBe(true);
  });
});
