// @vitest-environment jsdom
import '@angular/compiler';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, Subject } from 'rxjs';
import { ManagerPersonnelHubComponent } from './manager-personnel';
import { PersonnelChangeRequest } from '../../../../core/models/personnel.model';

describe('ManagerPersonnelHubComponent Unit Tests', () => {
  let component: ManagerPersonnelHubComponent;
  let mockAuth: any;
  let mockState: any;
  let mockToast: any;
  let mockPersonnelApi: any;
  let mockWs: any;
  let mockRouter: any;
  let mockRoute: any;
  let mockCdr: any;
  let wsSubject: Subject<any>;

  const mockCrPersonnel: PersonnelChangeRequest = {
    id: 301,
    personnel: 12,
    personnel_name: 'رضا کاظمی',
    personnel_national_code: '0076543210',
    status: 'pending_manager',
    status_display: 'در انتظار تایید مدیر',
    proposed_changes: { daily_base_wage: 5000000 },
    previous_values: { daily_base_wage: 4000000 },
    requested_by_name: 'حسابدار ارشد',
    created_at: '2026-09-22T10:00:00Z',
    updated_at: '2026-09-22T10:00:00Z'
  };

  beforeEach(() => {
    wsSubject = new Subject<any>();

    mockAuth = {
      user: vi.fn().mockReturnValue({ id: 1, username: 'manager_user' }),
      userPermissions: vi.fn().mockReturnValue(['can_act_as_company_manager', 'perm_approve_personnel_manager'])
    };

    mockState = {
      activeWarehouse: vi.fn().mockReturnValue({ id: 1, name: 'دفتر مرکزی' })
    };

    mockToast = {
      showSuccess: vi.fn(),
      showError: vi.fn(),
      showWarning: vi.fn()
    };

    mockPersonnelApi = {
      getProjectSections: vi.fn().mockReturnValue(of([
        { id: 10, name: 'کارگاه خط لوله', project_name: 'پروژه جنوب' }
      ])),
      getPersonnelProfiles: vi.fn().mockImplementation((params) => {
        if (params?.approval_status === 'pending_manager') {
          return of([
            { id: 201, first_name: 'سهراب', last_name: 'سپهری', national_code: '1234567890', approval_status: 'pending_manager' }
          ]);
        }
        return of([
          { id: 201, first_name: 'سهراب', last_name: 'سپهری', national_code: '1234567890', approval_status: 'approved' },
          { id: 202, first_name: 'نیما', last_name: 'یوشیج', national_code: '9876543210', approval_status: 'approved' }
        ]);
      }),
      getPersonnelContracts: vi.fn().mockReturnValue(of([
        { id: 501, personnel_name: 'سهراب سپهری', status: 'pending_manager', contract_no: 'CT-1405-01' }
      ])),
      getPersonnelChangeRequests: vi.fn().mockReturnValue(of([mockCrPersonnel])),
      approvePersonnelManager: vi.fn().mockReturnValue(of({ success: true })),
      approvePersonnelChangeRequest: vi.fn().mockReturnValue(of({ success: true })),
      rejectPersonnel: vi.fn().mockReturnValue(of({ success: true }))
    };

    mockWs = {
      notifications$: wsSubject.asObservable()
    };

    mockRouter = {
      navigate: vi.fn()
    };

    mockRoute = {
      queryParams: of({ tab: 'new', section_id: '10' })
    };

    mockCdr = {
      markForCheck: vi.fn(),
      detectChanges: vi.fn()
    };

    component = new ManagerPersonnelHubComponent(
      mockAuth,
      mockState,
      mockToast,
      mockPersonnelApi,
      mockWs,
      mockRouter,
      mockRoute,
      mockCdr
    );
  });

  it('1. should initialize with default subtab and load sections & data', () => {
    component.ngOnInit();
    expect(component.activeSubTab).toBe('new');
    expect(mockPersonnelApi.getProjectSections).toHaveBeenCalled();
    expect(component.selectedSectionId).toBe(10);
    expect(component.pendingManagerList.length).toBe(1);
    expect(component.contractsList.length).toBe(2);
    expect(component.changeRequests.length).toBe(1);
    expect(component.allPersonnelList.length).toBe(2);
    expect(component.statusCounters.newPending).toBe(1);
  });

  it('2. should switch subtabs properly and update url params', () => {
    component.ngOnInit();
    component.switchSubTab('contracts');
    expect(component.activeSubTab).toBe('contracts');
    expect(mockRouter.navigate).toHaveBeenCalled();
  });

  it('3. should open and submit approval for pending personnel', () => {
    component.ngOnInit();
    const candidate = component.pendingManagerList[0];
    component.openApproveModal('new', candidate);
    expect(component.isApprovalModalOpen).toBe(true);
    expect(component.approvalTarget?.type).toBe('new');

    component.approvalNote = 'مورد تایید مدیریت است';
    component.submitApproval();
    expect(mockPersonnelApi.approvePersonnelManager).toHaveBeenCalledWith(candidate.id, 'مورد تایید مدیریت است');
    expect(mockToast.showSuccess).toHaveBeenCalled();
    expect(component.isApprovalModalOpen).toBe(false);
  });

  it('4. should open and submit rejection for pending personnel', () => {
    component.ngOnInit();
    const candidate = component.pendingManagerList[0];
    component.openRejectModal(candidate.id, 'سهراب سپهری', 'personnel');
    expect(component.isRejectModalOpen).toBe(true);

    component.rejectReason = 'مدارک شناسایی ناقص است';
    component.submitReject();
    expect(mockPersonnelApi.rejectPersonnel).toHaveBeenCalledWith(candidate.id, 'مدارک شناسایی ناقص است');
    expect(mockToast.showSuccess).toHaveBeenCalled();
    expect(component.isRejectModalOpen).toBe(false);
  });

  it('5. should open and inspect change request diff details', () => {
    component.ngOnInit();
    component.openDiffModal(mockCrPersonnel);
    expect(component.isDiffModalOpen).toBe(true);
    expect(component.diffFieldRows.length).toBe(1);
    expect(component.diffFieldRows[0].field_name).toBe('daily_base_wage');
    expect(component.diffFieldRows[0].new_value).toBe(5000000);

    component.closeDiffModal();
    expect(component.isDiffModalOpen).toBe(false);
  });

  it('6. should react to real-time websocket updates', () => {
    component.ngOnInit();
    const fetchSpy = vi.spyOn(component, 'fetchData');
    wsSubject.next({ type_str: 'personnel_updated', data: { id: 201 } });
    expect(fetchSpy).toHaveBeenCalled();
  });
});
