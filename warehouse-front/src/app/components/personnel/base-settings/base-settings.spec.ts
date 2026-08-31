// @vitest-environment jsdom
import '@angular/compiler';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BaseSettings } from './base-settings';
import { of } from 'rxjs';

describe('BaseSettings Unit Tests', () => {
  let component: BaseSettings;
  let mockState: any;
  let mockAuth: any;
  let mockPersonnelApi: any;
  let mockToast: any;
  let mockCdr: any;
  let mockRoute: any;
  let mockRouter: any;

  beforeEach(() => {
    mockState = {
      hasRole: vi.fn().mockReturnValue(true)
    };

    mockAuth = {
      userPermissions: vi.fn().mockReturnValue(['perm_settings_personnel', 'admin_all'])
    };

    mockPersonnelApi = {
      getYearlySettings: vi.fn().mockReturnValue(of({
        id: 1,
        fiscal_year: '1405',
        monthly_housing_allowance: 30000000,
        monthly_food_allowance: 22000000,
        attendance_edit_past_days: 3,
        attendance_edit_future_days: 0,
        job_grades: [
          { grade_number: 1, daily_base_wage: 2000000, daily_seniority_bonus: 50000 }
        ]
      })),
      updateYearlySettings: vi.fn().mockReturnValue(of({
        message: 'تنظیمات با موفقیت ذخیره شد',
        settings: { id: 1, fiscal_year: '1405' }
      })),
      updateAllSettingsTabs: vi.fn().mockReturnValue(of({
        message: 'تنظیمات با موفقیت ذخیره شد',
        settings: { id: 1, fiscal_year: '1405' }
      }))
    };

    mockToast = {
      show: vi.fn()
    };

    mockCdr = {
      detectChanges: vi.fn()
    };

    mockRoute = {
      queryParams: of({ tab: 'payroll_settings', year: '1405' })
    };

    mockRouter = {
      navigate: vi.fn()
    };

    component = new BaseSettings(
      mockAuth,
      mockState,
      mockPersonnelApi,
      mockToast,
      mockCdr,
      mockRoute,
      mockRouter
    );
  });

  it('should initialize and load yearly settings', () => {
    component.ngOnInit();
    expect(component.activeTab).toBe('grades');
    expect(mockPersonnelApi.getYearlySettings).toHaveBeenCalledWith('1405');
    expect(component.yearlySettings).toBeDefined();
    expect(component.canManageSettings).toBe(true);
  });

  it('should switch tabs and sync query parameters', () => {
    component.setTab('calendar_attendance');
    expect(component.activeTab).toBe('calendar_attendance');
    expect(mockRouter.navigate).toHaveBeenCalled();
  });

  it('should update attendance edit window presets', () => {
    component.ngOnInit();
    component.setAttendanceWindowPreset(7, 1);
    expect(component.yearlySettings?.attendance_edit_past_days).toBe(7);
    expect(component.yearlySettings?.attendance_edit_future_days).toBe(1);
  });

  it('should save yearly settings across all tabs', () => {
    component.ngOnInit();
    component.saveYearlySettings();
    expect(mockPersonnelApi.updateYearlySettings).toHaveBeenCalledWith('1405', expect.any(Object));
    expect(mockToast.show).toHaveBeenCalledWith('success', expect.any(String));
  });
});
