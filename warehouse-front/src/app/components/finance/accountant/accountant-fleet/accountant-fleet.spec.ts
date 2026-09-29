// @vitest-environment jsdom
import '@angular/compiler';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, Subject } from 'rxjs';
import { AccountantFleetHubComponent } from './accountant-fleet';
import { VehicleDriverProfile } from '../../../../core/models/personnel.model';
import { generateShebaFromAccount } from '../../../../core/utils/sheba-utils';

describe('AccountantFleetHubComponent Unit Tests', () => {
  let component: AccountantFleetHubComponent;
  let mockAuth: any;
  let mockState: any;
  let mockToast: any;
  let mockPersonnelApi: any;
  let mockRouter: any;
  let mockRoute: any;
  let mockCdr: any;

  const validSheba = generateShebaFromAccount('017', '102222222002');

  const mockVehicle: VehicleDriverProfile = {
    id: 55,
    plate_number: '12-345-67',
    vehicle_type: 'truck',
    model_name: 'ایسوزو ۶ تن',
    driver_name: 'اکبر کریمی',
    driver_mobile: '09120000000',
    owner_name: 'شرکت ترابری ستاره',
    section: 3,
    approval_status: 'pending_accountant',
    default_service_rate: 15000000,
    sheba_number: validSheba,
    bank_name: 'بانک ملی ایران',
    account_number: '102222222002'
  };

  beforeEach(() => {
    mockAuth = {
      user: vi.fn().mockReturnValue({ id: 2, username: 'accountant_user' }),
      userPermissions: vi.fn().mockReturnValue(['view_sys_fleet_settlement', 'can_act_as_accountant'])
    };

    mockState = {
      activeWarehouse: vi.fn().mockReturnValue({ id: 1, name: 'انبار مرکزی' })
    };

    mockToast = {
      showSuccess: vi.fn(),
      showError: vi.fn(),
      showWarning: vi.fn()
    };

    mockPersonnelApi = {
      getMySections: vi.fn().mockReturnValue(of([{ id: 3, name: 'دالان کارگاه' }])),
      getProjectSections: vi.fn().mockReturnValue(of([])),
      getVehicleProfiles: vi.fn().mockReturnValue(of([mockVehicle])),
      calculateFleetSettlement: vi.fn().mockReturnValue(of({
        items: [{ plate_number: '12-345-67', driver_name: 'اکبر کریمی', total_trips: 20, gross_amount: 300000000, payable_amount: 280000000, is_settled: false }]
      })),
      getVehicleChangeRequests: vi.fn().mockReturnValue(of([])),
      approveVehicleFinance: vi.fn().mockReturnValue(of({ message: 'تایید مالی ناوگان صادر شد.' })),
      updateVehicleProfile: vi.fn().mockReturnValue(of({ ...mockVehicle })),
      rejectVehicle: vi.fn().mockReturnValue(of({ message: 'رد شد' }))
    };

    mockRouter = {
      navigate: vi.fn()
    };

    mockRoute = {
      queryParams: of({ tab: 'new', section_id: '3' })
    };

    mockCdr = {
      markForCheck: vi.fn(),
      detectChanges: vi.fn()
    };

    component = new AccountantFleetHubComponent(
      mockAuth,
      mockState,
      mockToast,
      mockPersonnelApi,
      mockRouter,
      mockRoute,
      mockCdr
    );
  });

  it('1. should initialize accountant fleet hub with default subtab', () => {
    component.ngOnInit();
    expect(component.activeSubTab).toBe('new');
    expect(component.selectedSectionId).toBe(3);
    expect(mockPersonnelApi.getMySections).toHaveBeenCalled();
  });

  it('2. should fetch vehicles and count pending accountant items', () => {
    component.fetchFleetData();
    expect(mockPersonnelApi.getVehicleProfiles).toHaveBeenCalled();
    expect(component.newVehiclesList.length).toBe(1);
    expect(component.statusCounters.newPending).toBe(1);
  });

  it('3. should open modal for vehicle service rate and bank editing', () => {
    component.openEditVehicleModal(mockVehicle);
    expect(component.isVehicleModalOpen).toBe(true);
    expect(component.editingVehicle?.default_service_rate).toBe(15000000);
    expect(component.shebaValidationResult?.isValid).toBe(true);
  });

  it('4. should approve vehicle finance and send to manager', () => {
    component.approveVehicleFinance(mockVehicle);
    expect(mockPersonnelApi.approveVehicleFinance).toHaveBeenCalledWith(55);
    expect(mockToast.showSuccess).toHaveBeenCalled();
  });

  it('5. should reject vehicle with valid reason', () => {
    component.openRejectModal(55, '12-345-67', 'vehicle', 'reject');
    expect(component.isRejectModalOpen).toBe(true);
    component.rejectReason = 'پلاک ناخواناست';

    component.submitRejectModal();
    expect(mockPersonnelApi.rejectVehicle).toHaveBeenCalledWith(55, 'پلاک ناخواناست');
    expect(mockToast.showSuccess).toHaveBeenCalled();
    expect(component.isRejectModalOpen).toBe(false);
  });
});
