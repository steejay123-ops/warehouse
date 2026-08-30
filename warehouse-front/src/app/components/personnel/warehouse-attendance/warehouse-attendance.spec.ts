// @vitest-environment jsdom
import '@angular/compiler';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WarehouseAttendance } from './warehouse-attendance';
import { of, Subject } from 'rxjs';

describe('WarehouseAttendance Comprehensive Vitest Suite', () => {
  let component: WarehouseAttendance;
  let mockState: any;
  let mockAuth: any;
  let mockPersonnelApi: any;
  let mockWhService: any;
  let mockWsService: any;
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
      user: vi.fn().mockReturnValue({ id: 1, username: 'admin', is_superuser: true }),
      isSuperAdmin: vi.fn().mockReturnValue(true)
    };

    mockPersonnelApi = {
      getAttendanceMatrix: vi.fn().mockReturnValue(of({
        warehouse_id: 1,
        date_shamsi: '1405/06/08',
        is_locked: false,
        period_status: 'OPEN',
        rows: [
          {
            personnel_id: 101,
            full_name: 'علی رضایی',
            national_code: '0012345678',
            job_title: 'کارگر انبار',
            status: 'PRESENT_10H',
            effective_hours: 10,
            overtime_hours: 2,
            is_friday_work: false,
            is_mission: false,
            advance_payment: 0,
            notes: '',
            is_existing: true
          },
          {
            personnel_id: 102,
            full_name: 'رضا حسینی',
            national_code: '0087654321',
            job_title: 'انباردار',
            status: 'ABSENT',
            effective_hours: 0,
            overtime_hours: 0,
            is_friday_work: false,
            is_mission: false,
            advance_payment: 0,
            notes: '',
            is_existing: false
          }
        ]
      })),
      saveAttendanceBulk: vi.fn().mockReturnValue(of({ success: true, saved_count: 2, updated_count: 0 })),
      getVehicleMatrix: vi.fn().mockReturnValue(of({
        warehouse_id: 1,
        date_shamsi: '1405/06/08',
        rows: []
      })),
      saveVehicleTripsBulk: vi.fn().mockReturnValue(of({ success: true, saved_count: 1 })),
      getMonthlyAttendanceGrid: vi.fn().mockReturnValue(of({
        warehouse_id: 1,
        year_month: '1405/06',
        days_in_month: 31,
        is_locked: false,
        period_status: 'OPEN',
        settings_window: { past_days: 3, future_days: 0 },
        days_meta: [],
        rows: []
      })),
      bulkSaveMonthlyGrid: vi.fn().mockReturnValue(of({ success: true, saved_count: 5, updated_count: 0 }))
    };

    mockWhService = {
      getAll: vi.fn().mockReturnValue(of([
        { id: 1, name: 'انبار مرکزی' },
        { id: 2, name: 'انبار غرب' }
      ]))
    };

    mockWsService = {
      notifications$: new Subject<any>()
    };

    mockToast = {
      show: vi.fn(),
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn()
    };

    mockConfirmDialog = {
      confirm: vi.fn().mockResolvedValue(true)
    };

    mockCdr = {
      detectChanges: vi.fn(),
      markForCheck: vi.fn()
    };

    mockRoute = {
      queryParams: of({})
    };

    mockRouter = {
      navigate: vi.fn()
    };

    component = new WarehouseAttendance(
      mockState,
      mockAuth,
      mockPersonnelApi,
      mockWhService,
      mockWsService,
      mockToast,
      mockConfirmDialog,
      mockCdr,
      mockRoute,
      mockRouter
    );

    component.selectedDateShamsi = '1405/06/08';
    component.selectedYearMonth = '1405/06';
    component.fiscalYear = '1405';
  });

  describe('1. Initialization and Matrix Loading', () => {
    it('should initialize with default mode and load warehouses', () => {
      expect(component.activeMode).toBe('daily');
      expect(component.mainSectionTab).toBe('personnel');
    });

    it('should load attendance matrix and populate rows', () => {
      component.loadAttendanceMatrix();
      expect(mockPersonnelApi.getAttendanceMatrix).toHaveBeenCalledWith(null, '1405/06/08');
      expect(component.attendanceRows.length).toBe(2);
      expect(component.attendanceRows[0].full_name).toBe('علی رضایی');
      expect(component.attendanceRows[0].is_existing).toBe(true);
    });

    it('should compute hasExistingAttendance correctly', () => {
      component.loadAttendanceMatrix();
      expect(component.hasExistingAttendance).toBe(true);
    });
  });

  describe('2. Status Management and Hours Sanitization', () => {
    beforeEach(() => {
      component.loadAttendanceMatrix();
    });

    it('should set status PRESENT_10H with 10 effective hours', () => {
      const row = component.attendanceRows[1];
      component.setAttendanceStatus(row, 'PRESENT_10H');
      expect(row.status).toBe('PRESENT_10H');
      expect(row.effective_hours).toBe(10);
      expect(row.is_friday_work).toBe(false);
      expect(component.hasUnsavedChanges).toBe(true);
    });

    it('should reset hours to 0 when status is changed to ABSENT or LEAVE', () => {
      const row = component.attendanceRows[0];
      component.setAttendanceStatus(row, 'ABSENT');
      expect(row.status).toBe('ABSENT');
      expect(row.effective_hours).toBe(0);
      expect(row.overtime_hours).toBe(0);
      expect(row.is_friday_work).toBe(false);
    });

    it('should set status HALF_5H with 5 effective hours', () => {
      const row = component.attendanceRows[0];
      component.setAttendanceStatus(row, 'HALF_5H');
      expect(row.status).toBe('HALF_5H');
      expect(row.effective_hours).toBe(5);
    });
  });

  describe('3. Bulk Hours Management and Protection of Absent Personnel', () => {
    beforeEach(() => {
      component.loadAttendanceMatrix();
    });

    it('should protect ABSENT personnel when bulk applying hours without status override', () => {
      component.bulkHoursScope = 'all';
      component.bulkEffectiveHours = 12;
      component.bulkOvertimeHours = 2;
      component.bulkStatusOption = '';

      component.applyBulkHours();

      expect(component.attendanceRows[0].effective_hours).toBe(12);
      expect(component.attendanceRows[0].overtime_hours).toBe(2);

      expect(component.attendanceRows[1].effective_hours).toBe(0);
      expect(component.attendanceRows[1].overtime_hours).toBe(0);
    });

    it('should override status and hours when bulkStatusOption is specified', () => {
      component.bulkHoursScope = 'all';
      component.bulkStatusOption = 'PRESENT_10H';
      component.bulkEffectiveHours = 10;
      component.bulkOvertimeHours = 1;

      component.applyBulkHours();

      expect(component.attendanceRows[1].status).toBe('PRESENT_10H');
      expect(component.attendanceRows[1].effective_hours).toBe(10);
      expect(component.attendanceRows[1].overtime_hours).toBe(1);
    });
  });

  describe('4. Silent In-Place Patching and Conflict Handling', () => {
    beforeEach(() => {
      component.loadAttendanceMatrix();
    });

    it('should silently update rows without resetting component loading state', () => {
      const freshData = {
        warehouse_id: 1,
        date_shamsi: '1405/06/08',
        is_locked: false,
        period_status: 'OPEN',
        rows: [
          {
            personnel_id: 101,
            full_name: 'علی رضایی',
            national_code: '0012345678',
            job_title: 'کارگر انبار',
            status: 'PRESENT_10H',
            effective_hours: 10,
            overtime_hours: 4,
            is_friday_work: false,
            is_mission: false,
            advance_payment: 0,
            notes: 'پچ زنده',
            is_existing: true
          }
        ]
      };

      mockPersonnelApi.getAttendanceMatrix.mockReturnValue(of(freshData));
      component.refreshAttendanceMatrixSilently();

      expect(component.attendanceRows[0].overtime_hours).toBe(4);
      expect(component.attendanceRows[0].notes).toBe('پچ زنده');
      expect(component.isAttendanceLoading).toBe(false);
    });

    it('should flag conflict and allow dismissal', () => {
      component.hasRemoteConflict = true;
      expect(component.hasRemoteConflict).toBe(true);

      component.dismissRemoteConflict();
      expect(component.hasRemoteConflict).toBe(false);
    });
  });

  describe('5. Saving Attendance and State Transitions', () => {
    beforeEach(() => {
      component.loadAttendanceMatrix();
    });

    it('should call backend bulk-save and reset unsaved changes flag on success', () => {
      component.attendanceRows[0]._isDirty = true;
      component.hasUnsavedChanges = true;
      component.saveAttendanceMatrix();

      expect(mockPersonnelApi.saveAttendanceBulk).toHaveBeenCalled();
      expect(component.hasUnsavedChanges).toBe(false);
      expect(mockToast.show).toHaveBeenCalledWith('success', expect.stringContaining('موفقیت'));
    });

    it('should preserve updated row status and mark as existing without reverting to old state on save', () => {
      // 1. تغییر وضعیت ردیف از PRESENT_10H به HALF_5H
      const row = component.attendanceRows[0];
      component.setAttendanceStatus(row, 'HALF_5H');
      expect(row.status).toBe('HALF_5H');
      expect(row.effective_hours).toBe(5);
      expect(component.hasUnsavedChanges).toBe(true);

      // 2. ذخیره کارکرد
      component.saveAttendanceMatrix();

      // 3. بررسی اینکه وضعیت در فرانت‌اند روی HALF_5H باقی مانده و به حالت قبل برنگشته است
      expect(component.attendanceRows[0].status).toBe('HALF_5H');
      expect(component.attendanceRows[0].effective_hours).toBe(5);
      expect(component.attendanceRows[0].is_existing).toBe(true);
      expect(component.hasUnsavedChanges).toBe(false);
    });
  });
});
