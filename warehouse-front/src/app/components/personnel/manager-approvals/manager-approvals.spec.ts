// @vitest-environment jsdom
import '@angular/compiler';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ManagerApprovals } from './manager-approvals';
import { of } from 'rxjs';

describe('ManagerApprovals Unit Tests', () => {
  let component: ManagerApprovals;
  let mockState: any;
  let mockAuth: any;
  let mockPersonnelApi: any;
  let mockWhService: any;
  let mockToast: any;
  let mockConfirmDialog: any;
  let mockCdr: any;
  let mockRoute: any;
  let mockRouter: any;

  beforeEach(() => {
    mockState = {
      activeWarehouse: vi.fn().mockReturnValue(null),
      hasRole: vi.fn().mockReturnValue(true)
    };

    mockAuth = {
      userPermissions: vi.fn().mockReturnValue(['perm_approve_personnel_manager', 'perm_approve_fleet_manager', 'admin_all']),
      userRoleTitles: vi.fn().mockReturnValue(['مدیر ارشد'])
    };

    mockPersonnelApi = {
      getPersonnelProfiles: vi.fn().mockReturnValue(of([
        { id: 1, full_name: 'محمد رضایی', national_code: '1234567890', approval_status: 'draft' },
        { id: 2, full_name: 'علی حسینی', national_code: '0987654321', approval_status: 'revision_required' }
      ])),
      getVehicleProfiles: vi.fn().mockReturnValue(of([
        { id: 10, driver_name: 'حسین احمدی', plate_number: '12-345-67', approval_status: 'draft' }
      ])),
      getPersonnelChangeRequests: vi.fn().mockReturnValue(of([
        { id: 201, status: 'pending_manager', changes_payload: { first_name: { old: 'علی', new: 'علیرضا' } } }
      ])),
      getVehicleChangeRequests: vi.fn().mockReturnValue(of([])),
      getAttendanceMonthlySummary: vi.fn().mockReturnValue(of({
        year_month: '1405/04',
        period_status: 'OPEN'
      })),
      getYearlySettings: vi.fn().mockReturnValue(of({ fiscal_year: '1405', job_grades: [] })),
      approvePersonnelManager: vi.fn().mockReturnValue(of({ message: 'تایید شد' })),
      approveVehicleManager: vi.fn().mockReturnValue(of({ message: 'تایید شد' })),
      approvePersonnelChangeRequestManager: vi.fn().mockReturnValue(of({ message: 'تایید شد' })),
      periodWorkflowAction: vi.fn().mockReturnValue(of({ message: 'ارسال شد' })),
      rejectPersonnel: vi.fn().mockReturnValue(of({ message: 'رد شد' })),
      requestPersonnelRevision: vi.fn().mockReturnValue(of({ message: 'ارجاع شد' }))
    };

    mockWhService = {
      getAll: vi.fn().mockReturnValue(of([{ id: 1, name: 'انبار مرکزی' }]))
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
      queryParams: of({ tab: 'new_personnel', status: 'draft' })
    };

    mockRouter = {
      navigate: vi.fn()
    };

    component = new ManagerApprovals(
      mockAuth,
      mockState,
      mockPersonnelApi,
      mockWhService,
      mockToast,
      mockConfirmDialog,
      mockCdr,
      mockRoute,
      mockRouter
    );
  });

  it('should initialize and load draft personnel', () => {
    component.ngOnInit();
    expect(component.activeTab).toBe('new_personnel');
    expect(mockPersonnelApi.getPersonnelProfiles).toHaveBeenCalled();
    expect(component.personnelList.length).toBe(2);
    expect(component.pendingPersonnelCount).toBe(2);
  });

  it('should switch tabs and update query params', () => {
    component.setTab('change_requests');
    expect(component.activeTab).toBe('change_requests');
    expect(mockRouter.navigate).toHaveBeenCalled();
  });

  it('should open Diff Viewer modal and parse changed fields', () => {
    const mockCR = {
      id: 50,
      changes_payload: {
        daily_base_wage: { old: 1000000, new: 1200000 },
        job_title: { old: 'کارگر', new: 'انباردار' }
      }
    };
    component.openDiffModal(mockCR, 'personnel');
    expect(component.isDiffModalOpen).toBe(true);
    expect(component.diffFieldRows.length).toBe(2);
    expect(component.diffFieldRows[0].is_changed).toBe(true);
  });

  it('should approve personnel by manager and reload data', () => {
    component.approvePersonnelManager({ id: 1 } as any);
    expect(mockPersonnelApi.approvePersonnelManager).toHaveBeenCalledWith(1);
    expect(mockToast.show).toHaveBeenCalledWith('success', expect.any(String));
  });

  it('should submit work period for finance review', () => {
    const wp = { id: 1, year_month: '1405/04' };
    component.submitPeriodForFinance(wp);
    expect(mockPersonnelApi.periodWorkflowAction).toHaveBeenCalledWith({
      warehouse_id: null,
      year_month: '1405/04',
      action: 'submit'
    });
    expect(mockToast.show).toHaveBeenCalledWith('success', expect.any(String));
  });
});
