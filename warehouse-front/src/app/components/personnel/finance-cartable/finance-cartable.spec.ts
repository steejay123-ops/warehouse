// @vitest-environment jsdom
import '@angular/compiler';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FinanceCartable } from './finance-cartable';
import { of } from 'rxjs';

describe('FinanceCartable Unit Tests', () => {
  let component: FinanceCartable;
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
      userPermissions: vi.fn().mockReturnValue(['perm_approve_personnel_finance', 'perm_approve_fleet_finance', 'admin_all']),
      userRoleTitles: vi.fn().mockReturnValue(['مدیر مالی'])
    };

    mockPersonnelApi = {
      getPersonnelProfiles: vi.fn().mockReturnValue(of([
        { id: 1, full_name: 'محمد رضایی', national_code: '1234567890', approval_status: 'manager_approved' }
      ])),
      getVehicleProfiles: vi.fn().mockReturnValue(of([
        { id: 10, driver_name: 'حسین احمدی', plate_number: '12-345-67', approval_status: 'manager_approved' }
      ])),
      getPersonnelChangeRequests: vi.fn().mockReturnValue(of([
        { id: 201, status: 'manager_approved', changes_payload: {} }
      ])),
      getVehicleChangeRequests: vi.fn().mockReturnValue(of([])),
      getMonthlyPayrollRecords: vi.fn().mockReturnValue(of({
        records: [
          {
            id: 1,
            full_name: 'محمد رضایی',
            national_code: '1234567890',
            job_grade: '19',
            gross_salary: 250000000,
            net_salary: 230000000,
            payable_amount: 220000000,
            period: 10
          }
        ],
        summary: { total_personnel: 1, total_gross: 250000000, total_payable: 220000000 }
      })),
      calculateMonthlyPayroll: vi.fn().mockReturnValue(of({
        message: 'محاسبه انجام شد',
        records: [],
        period_id: 10,
        period_status: 'OPEN'
      })),
      calculateFleetSettlement: vi.fn().mockReturnValue(of({
        records: [
          { vehicle_id: 10, driver_name: 'حسین احمدی', total_trips: 15, total_payable: 45000000 }
        ],
        summary: { total_vehicles: 1, total_trips: 15, total_payable: 45000000 }
      })),
      approvePersonnelFinance: vi.fn().mockReturnValue(of({ message: 'تایید نهایی شد' })),
      approveVehicleFinance: vi.fn().mockReturnValue(of({ message: 'تایید نهایی شد' })),
      lockPeriod: vi.fn().mockReturnValue(of({ message: 'دوره قفل شد' })),
      unlockPeriod: vi.fn().mockReturnValue(of({ message: 'دوره بازگشایی شد' })),
      getMonthlyExcelDownloadUrl: vi.fn().mockReturnValue('/download/excel'),
      getDskZipDownloadUrl: vi.fn().mockReturnValue('/download/dsk')
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
      queryParams: of({ tab: 'final_approvals', period: '1405/04' })
    };

    mockRouter = {
      navigate: vi.fn()
    };

    component = new FinanceCartable(
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

  it('should initialize and load final approvals queue', () => {
    component.ngOnInit();
    expect(component.activeTab).toBe('final_approvals');
    expect(mockPersonnelApi.getPersonnelProfiles).toHaveBeenCalled();
    expect(component.pendingPersonnelList.length).toBe(1);
    expect(component.pendingFinanceCount).toBe(3); // 1 personnel + 1 vehicle + 1 CR
  });

  it('should calculate 58-column monthly payroll', () => {
    component.setTab('payroll');
    component.calculateMonthlyPayroll();
    expect(mockPersonnelApi.calculateMonthlyPayroll).toHaveBeenCalledWith(undefined, '1405/04');
    expect(mockToast.show).toHaveBeenCalledWith('success', expect.any(String));
  });

  it('should approve personnel finance and activate record', () => {
    component.approvePersonnelFinance({ id: 1 } as any);
    expect(mockPersonnelApi.approvePersonnelFinance).toHaveBeenCalledWith(1);
    expect(mockToast.show).toHaveBeenCalledWith('success', expect.any(String));
  });

  it('should calculate fleet settlement and paya records', () => {
    component.setTab('fleet_settlement');
    component.loadFleetSettlement();
    expect(mockPersonnelApi.calculateFleetSettlement).toHaveBeenCalled();
    expect(component.fleetSettlementRecords.length).toBe(1);
  });
});
