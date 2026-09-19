// @vitest-environment jsdom
import '@angular/compiler';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EmployeeNewVehicleHubComponent } from './employee-new-vehicle';
import { of } from 'rxjs';
import { VehicleDriverProfile, ProjectSection } from '../../../../core/models/personnel.model';

describe('EmployeeNewVehicleHubComponent Vitest Suite (Phase 4)', () => {
  let component: EmployeeNewVehicleHubComponent;
  let mockAuth: any;
  let mockPersonnelApi: any;
  let mockToast: any;
  let mockCdr: any;
  let mockRoute: any;
  let mockRouter: any;

  const sampleSections: ProjectSection[] = [
    { id: 10, name: 'بخش ترابری', code: 'LOG', project: 1, project_name: 'پروژه مرکزی', is_active: true },
    { id: 20, name: 'بخش بتن', code: 'CON', project: 1, project_name: 'پروژه مرکزی', is_active: true }
  ];

  const sampleVehicles: VehicleDriverProfile[] = [
    {
      id: 501,
      plate_number: '12الف345ایران63',
      vehicle_type: 'nissan',
      ownership_type: 'contract',
      driver_name: 'رضا علوی',
      driver_national_code: '0012345678',
      driver_phone: '09121111111',
      default_service_rate: 1500000,
      bank_name: 'بانک ملت',
      sheba_number: 'IR120120000000000000000001',
      section: 10,
      approval_status: 'draft',
      is_active: true
    },
    {
      id: 502,
      plate_number: '34ب567ایران63',
      vehicle_type: 'khavar',
      ownership_type: 'company',
      driver_name: 'محسن کریمی',
      driver_national_code: '0023456789',
      driver_phone: '09122222222',
      default_service_rate: 2500000,
      bank_name: 'بانک صادرات',
      sheba_number: 'IR120190000000000000000001',
      section: 10,
      approval_status: 'approved',
      is_active: true
    },
    {
      id: 503,
      plate_number: '78ج901ایران63',
      vehicle_type: 'trailer',
      ownership_type: 'contract',
      driver_name: 'احمد مرادی',
      driver_phone: '09123333333',
      default_service_rate: 6000000,
      section: 10,
      approval_status: 'pending_supervisor',
      is_active: true
    }
  ];

  beforeEach(() => {
    mockAuth = {
      user: vi.fn().mockReturnValue({ id: 1, username: 'employee_fleet', is_superuser: false }),
      userPermissions: vi.fn().mockReturnValue([])
    };

    mockPersonnelApi = {
      getMySections: vi.fn().mockReturnValue(of(sampleSections)),
      getProjectSections: vi.fn().mockReturnValue(of(sampleSections)),
      getVehicleProfiles: vi.fn().mockReturnValue(of(sampleVehicles)),
      createVehicleProfile: vi.fn().mockImplementation((data: any) => of({ id: 504, ...data })),
      deleteVehicleProfile: vi.fn().mockReturnValue(of({ success: true })),
      exportVehiclesExcel: vi.fn().mockReturnValue(of(new Blob(['fake excel content'])))
    };

    mockToast = {
      show: vi.fn()
    };

    mockCdr = {
      detectChanges: vi.fn()
    };

    mockRoute = {
      queryParams: of({ section_id: '10' })
    };

    mockRouter = {
      navigate: vi.fn()
    };

    component = new EmployeeNewVehicleHubComponent(
      mockAuth,
      mockPersonnelApi,
      mockToast,
      mockCdr,
      mockRoute,
      mockRouter
    );
  });

  describe('۱. مقداردهی اولیه و ایزولاسیون قلمرو بخش (Guardian G1)', () => {
    it('باید بخش‌های مجاز کارمند را بارگذاری و بخش اول را انتخاب کند', () => {
      component.ngOnInit();
      expect(mockPersonnelApi.getMySections).toHaveBeenCalled();
      expect(component.mySections.length).toBe(2);
      expect(component.selectedSectionId).toBe(10);
      expect(component.selectedSection?.name).toBe('بخش ترابری');
    });

    it('باید لیست خودروهای بخش فعال را با پارامتر اجباری section_id واکشی کند', () => {
      component.ngOnInit();
      expect(mockPersonnelApi.getVehicleProfiles).toHaveBeenCalledWith({ section_id: 10 });
      expect(component.recentVehicles.length).toBe(3);
    });

    it('تغییر بخش باید کوئری‌پارامتر URL را به‌روز کرده و خودروهای بخش جدید را لود کند', () => {
      component.ngOnInit();
      component.selectedSectionId = 20;
      component.onSectionChanged();

      expect(mockRouter.navigate).toHaveBeenCalledWith([], {
        relativeTo: mockRoute,
        queryParams: { section_id: 20 },
        queryParamsHandling: 'merge'
      });
      expect(mockPersonnelApi.getVehicleProfiles).toHaveBeenCalledWith({ section_id: 20 });
    });
  });

  describe('۲. اعتبارسنجی آنلاین شماره شبا و کد ملی', () => {
    it('باید شماره شبا را اعتبارسنجی و نام بانک را به طور خودکار استخراج کند', () => {
      component.newVehicle.sheba_number = 'IR120120000000000000000001';
      component.onShebaChange();

      expect(component.shebaValidationResult).not.toBeNull();
      if (component.shebaValidationResult?.isValid) {
        expect(component.newVehicle.bank_name).toBe(component.shebaValidationResult.bank?.name);
      }
    });

    it('در صورت خالی بودن شماره شبا نتیجه اعتبارسنجی باید null شود', () => {
      component.newVehicle.sheba_number = '   ';
      component.onShebaChange();
      expect(component.shebaValidationResult).toBeNull();
    });

    it('اعتبارسنجی کد ملی ارقام نامعتبر یا تکراری را رد کند', () => {
      component.newVehicle.driver_national_code = '1111111111';
      component.onNationalCodeChange();
      expect(component.nationalCodeError).toContain('تکراری');

      component.newVehicle.driver_national_code = '123';
      component.onNationalCodeChange();
      expect(component.nationalCodeError).toContain('۱۰ رقم');
    });

    it('محاسبه معادل تومان نرخ پیش‌فرض سرویس را انجام دهد', () => {
      component.newVehicle.default_service_rate = 25000000;
      expect(component.rateInTomans).toBe(2500000);
    });
  });

  describe('۳. تحمیل قطعی وضعیت پیش‌نویس در ثبت خودرو (Guardian G2)', () => {
    beforeEach(() => {
      component.ngOnInit();
    });

    it('در صورت خالی بودن شماره پلاک باید خطا دهد', () => {
      component.newVehicle.plate_number = '';
      component.newVehicle.driver_name = 'راننده تست';
      component.saveVehicleDraft();

      expect(mockToast.show).toHaveBeenCalledWith('warning', expect.stringContaining('شماره پلاک'));
      expect(mockPersonnelApi.createVehicleProfile).not.toHaveBeenCalled();
    });

    it('در صورت خالی بودن نام راننده باید خطا دهد', () => {
      component.newVehicle.plate_number = '۱۲الف۳۴۵ایران۶۳';
      component.newVehicle.driver_name = '';
      component.saveVehicleDraft();

      expect(mockToast.show).toHaveBeenCalledWith('warning', expect.stringContaining('نام و نام خانوادگی'));
      expect(mockPersonnelApi.createVehicleProfile).not.toHaveBeenCalled();
    });

    it('ثبت خودرو باید وضعیت approval_status="draft" و section_id را به بک‌اند تحمیل کند', () => {
      component.newVehicle = {
        plate_number: '۱۲الف۳۴۵ایران۶۳',
        vehicle_type: 'nissan',
        ownership_type: 'contract',
        driver_name: 'علی حسینی',
        driver_phone: '09121234567',
        default_service_rate: 1800000,
        approval_status: 'draft'
      };

      component.saveVehicleDraft();

      expect(mockPersonnelApi.createVehicleProfile).toHaveBeenCalledWith(expect.objectContaining({
        plate_number: '۱۲الف۳۴۵ایران۶۳',
        driver_name: 'علی حسینی',
        section: 10,
        approval_status: 'draft', // Guardian G2
        is_active: true
      }));
      expect(mockToast.show).toHaveBeenCalledWith('success', expect.stringContaining('پیش‌نویس'));
    });

    it('پس از ثبت موفق، فرم باید پاکسازی شود', () => {
      component.newVehicle.plate_number = '۱۲الف۳۴۵ایران۶۳';
      component.newVehicle.driver_name = 'علی حسینی';
      component.saveVehicleDraft();

      expect(component.newVehicle.plate_number).toBe('');
      expect(component.newVehicle.driver_name).toBe('');
      expect(component.newVehicle.approval_status).toBe('draft');
    });
  });

  describe('۴. شاخص‌های آماری، فیلتر و جستجوی خودروها', () => {
    beforeEach(() => {
      component.ngOnInit();
    });

    it('شاخص‌های آماری را به درستی محاسبه کند', () => {
      const metrics = component.vehicleMetrics;
      expect(metrics.total).toBe(3);
      expect(metrics.drafts).toBe(1);
      expect(metrics.approved).toBe(1);
      expect(metrics.contractCount).toBe(2);
    });

    it('فیلتر جستجوی متنی بر روی نام راننده و پلاک را اعمال کند', () => {
      component.searchQuery = 'محسن';
      expect(component.filteredVehicles.length).toBe(1);
      expect(component.filteredVehicles[0].driver_name).toBe('محسن کریمی');

      component.searchQuery = '78ج';
      expect(component.filteredVehicles.length).toBe(1);
      expect(component.filteredVehicles[0].plate_number).toBe('78ج901ایران63');
    });

    it('فیلتر وضعیت تایید را اعمال کند', () => {
      component.statusFilter = 'draft';
      expect(component.filteredVehicles.length).toBe(1);
      expect(component.filteredVehicles[0].approval_status).toBe('draft');

      component.statusFilter = 'approved';
      expect(component.filteredVehicles.length).toBe(1);
      expect(component.filteredVehicles[0].approval_status).toBe('approved');

      component.statusFilter = 'all';
      expect(component.filteredVehicles.length).toBe(3);
    });
  });

  describe('۵. حذف امن خودرو پیش‌نویس و هلپرها', () => {
    beforeEach(() => {
      component.ngOnInit();
      vi.spyOn(window, 'confirm').mockReturnValue(true);
    });

    it('حذف خودرو پیش‌نویس را اجرا کند', () => {
      const draftVehicle = sampleVehicles[0];
      component.deleteDraftVehicle(draftVehicle);

      expect(mockPersonnelApi.deleteVehicleProfile).toHaveBeenCalledWith(draftVehicle.id);
      expect(mockToast.show).toHaveBeenCalledWith('success', expect.stringContaining('حذف گردید'));
    });

    it('حذف خودروهای غیر پیش‌نویس (مثلاً approved) را مسدود کند', () => {
      const approvedVehicle = sampleVehicles[1];
      component.deleteDraftVehicle(approvedVehicle);

      expect(mockToast.show).toHaveBeenCalledWith('warning', expect.stringContaining('فقط خودروهای در وضعیت پیش‌نویس'));
      expect(mockPersonnelApi.deleteVehicleProfile).not.toHaveBeenCalled();
    });

    it('هلپرهای نمایش عنوان نوع خودرو و وضعیت را به درستی برگرداند', () => {
      expect(component.getVehicleTypeLabel('nissan')).toBe('وانت نیسان');
      expect(component.getOwnershipTypeLabel('contract')).toBe('استیجاری / پیمانکاری سرویسی');

      expect(component.getStatusLabel('draft')).toBe('پیش‌نویس کارمند');
      expect(component.getStatusLabel('approved')).toBe('تصویب و فعال شده');

      expect(component.getStatusBadgeClass('draft')).toContain('bg-slate-100');
      expect(component.getStatusBadgeClass('approved')).toContain('bg-emerald-50');

      expect(component.formatNumber(1250000)).toContain('۱');
      expect(component.formatNumber(null)).toBe('۰');
    });
  });

  describe('۶. مرکز فرماندهی، ناوبری زیرتب‌ها و خروجی اکسل ۲ ردیفه', () => {
    beforeEach(() => {
      component.ngOnInit();
      vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:mock-url');
      vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => {});
    });

    it('کلیک روی زیرتب باید وضعیت و کوئری‌پارامتر URL را به‌روز کند', () => {
      component.setStatusFilter('pending_supervisor');
      expect(component.statusFilter).toBe('pending_supervisor');
      expect(mockRouter.navigate).toHaveBeenCalledWith([], {
        relativeTo: mockRoute,
        queryParams: { status_filter: 'pending_supervisor' },
        queryParamsHandling: 'merge'
      });

      component.setStatusFilter('all');
      expect(component.statusFilter).toBe('all');
      expect(mockRouter.navigate).toHaveBeenCalledWith([], {
        relativeTo: mockRoute,
        queryParams: { status_filter: null },
        queryParamsHandling: 'merge'
      });
    });

    it('تغییر و پاکسازی جستجو باید کوئری‌پارامتر search را هماهنگ کند', () => {
      component.searchQuery = 'نیسان';
      component.onSearchChange();
      expect(mockRouter.navigate).toHaveBeenCalledWith([], {
        relativeTo: mockRoute,
        queryParams: { search: 'نیسان' },
        queryParamsHandling: 'merge'
      });

      component.clearSearch();
      expect(component.searchQuery).toBe('');
      expect(mockRouter.navigate).toHaveBeenCalledWith([], {
        relativeTo: mockRoute,
        queryParams: { search: null },
        queryParamsHandling: 'merge'
      });
    });

    it('متد exportExcel باید خروجی اکسل بخش جاری را فراخوانی کند', () => {
      component.exportExcel();
      expect(mockPersonnelApi.exportVehiclesExcel).toHaveBeenCalledWith({ section_id: 10 });
      expect(mockToast.show).toHaveBeenCalledWith('success', expect.stringContaining('اکسل'));
    });
  });
});
