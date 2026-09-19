import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ProjectSection, VehicleDriverProfile } from '../../../../core/models/personnel.model';
import { PersonnelApiService } from '../../../../core/api/personnel-api.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { ToastService } from '../../../../shared/components/toast/toast.component';
import {
  cleanShebaInput,
  validateSheba,
  extractAccountNumberFromSheba,
  ShebaValidationResult,
  IRANIAN_BANKS
} from '../../../../core/utils/sheba-utils';

export type VehicleStatusFilter = 'all' | 'draft' | 'pending_supervisor' | 'approved' | 'rejected';

@Component({
  selector: 'app-employee-new-vehicle-hub',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './employee-new-vehicle.html',
  styleUrl: './employee-new-vehicle.css'
})
export class EmployeeNewVehicleHubComponent implements OnInit {
  readonly Math = Math;

  // ─── مدیریت بخش و ایزولاسیون قلمرو (Guardian G1: Section Isolation) ───
  mySections: ProjectSection[] = [];
  selectedSectionId: number | null = null;
  selectedSection: ProjectSection | null = null;
  isLoadingSections: boolean = false;

  // ─── جدول خودروهای اخیراً ثبت‌شده بخش ───
  recentVehicles: VehicleDriverProfile[] = [];
  isLoadingVehicles: boolean = false;
  isSaving: boolean = false;
  isExportingExcel: boolean = false;
  searchQuery: string = '';
  statusFilter: VehicleStatusFilter = 'all';

  // ─── فرم ثبت خودرو جدید (Guardian G2: Enforced Draft Invariant) ───
  newVehicle: Partial<VehicleDriverProfile> = {
    plate_number: '',
    vehicle_type: 'nissan',
    ownership_type: 'contract',
    driver_name: '',
    driver_national_code: '',
    driver_phone: '',
    default_service_rate: 0,
    bank_name: '',
    account_number: '',
    sheba_number: '',
    is_active: true,
    approval_status: 'draft'
  };

  // اعتبارسنجی زنده شبا
  shebaValidationResult: ShebaValidationResult | null = null;

  // اعتبارسنجی زنده کد ملی
  nationalCodeError: string | null = null;

  // ─── لیست انواع خودرو ───
  readonly vehicleTypes = [
    { value: 'nissan', label: 'وانت نیسان' },
    { value: 'khavar', label: 'خاور / کامیونت' },
    { value: 'trailer', label: 'تریلی / کشنده' },
    { value: 'pickup', label: 'وانت بار' },
    { value: 'truck', label: 'کامیون تک/جفت' },
    { value: 'sedan', label: 'سواری' },
    { value: 'other', label: 'سایر ماشین‌آلات' }
  ];

  // ─── لیست انواع مالکیت ───
  readonly ownershipTypes = [
    { value: 'contract', label: 'استیجاری / پیمانکاری سرویسی' },
    { value: 'company', label: 'خودرو شرکتی / ملکی پروژه' },
    { value: 'personal', label: 'خودرو ملکی راننده' }
  ];

  constructor(
    public auth: AuthService,
    private personnelApi: PersonnelApiService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadMySections();
    this.route.queryParams.subscribe(params => {
      if (params['section_id']) {
        const sId = Number(params['section_id']);
        if (!isNaN(sId) && sId !== this.selectedSectionId) {
          this.selectedSectionId = sId;
          this.selectedSection = this.mySections.find(s => s.id === sId) || null;
          if (this.selectedSectionId) {
            this.loadRecentVehicles();
          }
        }
      }
      if (params['status_filter'] && ['all', 'draft', 'pending_supervisor', 'approved', 'rejected'].includes(params['status_filter'])) {
        this.statusFilter = params['status_filter'] as VehicleStatusFilter;
      }
      if (params['search'] !== undefined) {
        this.searchQuery = params['search'] || '';
      }
    });
  }

  // ─── بارگذاری بخش‌های مجاز کارمند ───
  loadMySections(): void {
    this.isLoadingSections = true;
    this.personnelApi.getMySections().subscribe({
      next: (sections: ProjectSection[]) => {
        this.mySections = sections || [];
        if (this.mySections.length === 0) {
          const isSuper = this.auth.user()?.is_superuser || (this.auth.userPermissions() || []).includes('admin_all');
          if (isSuper) {
            this.personnelApi.getProjectSections({ is_active: true }).subscribe({
              next: (allSecs: ProjectSection[]) => {
                this.mySections = allSecs || [];
                this.pickDefaultSection();
              },
              error: () => {
                this.isLoadingSections = false;
                this.cdr.detectChanges();
              }
            });
            return;
          }
        }
        this.pickDefaultSection();
      },
      error: () => {
        this.isLoadingSections = false;
        this.cdr.detectChanges();
      }
    });
  }

  private pickDefaultSection(): void {
    if (this.mySections.length > 0) {
      if (!this.selectedSectionId || !this.mySections.some(s => s.id === this.selectedSectionId)) {
        this.selectedSectionId = this.mySections[0]?.id ?? null;
      }
      this.selectedSection = this.mySections.find(s => s.id === this.selectedSectionId) || null;
      if (this.selectedSectionId) {
        this.loadRecentVehicles();
      }
    }
    this.isLoadingSections = false;
    this.cdr.detectChanges();
  }

  onSectionChanged(): void {
    this.selectedSection = this.mySections.find(s => s.id === Number(this.selectedSectionId)) || null;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { section_id: this.selectedSectionId },
      queryParamsHandling: 'merge'
    });
    this.loadRecentVehicles();
  }

  // ─── بارگذاری خودروهای بخش فعال (Guardian G1: Section Isolation) ───
  loadRecentVehicles(): void {
    if (!this.selectedSectionId) return;
    this.isLoadingVehicles = true;
    this.personnelApi.getVehicleProfiles({ section_id: this.selectedSectionId }).subscribe({
      next: (res: VehicleDriverProfile[]) => {
        this.recentVehicles = res || [];
        this.isLoadingVehicles = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.isLoadingVehicles = false;
        this.toast.show('error', 'خطا در بارگذاری خودروها: ' + (err.error?.error || err.message || 'نامشخص'));
        this.cdr.detectChanges();
      }
    });
  }

  // ─── فیلتر خودروهای اخیر ───
  get filteredVehicles(): VehicleDriverProfile[] {
    let list = this.recentVehicles;

    if (this.statusFilter !== 'all') {
      list = list.filter(v => v.approval_status === this.statusFilter);
    }

    const q = this.searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(v =>
        (v.plate_number && v.plate_number.toLowerCase().includes(q)) ||
        (v.driver_name && v.driver_name.toLowerCase().includes(q)) ||
        (v.driver_phone && v.driver_phone.includes(q)) ||
        (v.driver_national_code && v.driver_national_code.includes(q))
      );
    }

    return list;
  }

  // ─── شاخص‌های آماری خودروهای بخش ───
  get vehicleMetrics() {
    const total = this.recentVehicles.length;
    const drafts = this.recentVehicles.filter(v => v.approval_status === 'draft').length;
    const pending = this.recentVehicles.filter(v => v.approval_status === 'pending_supervisor').length;
    const approved = this.recentVehicles.filter(v => v.approval_status === 'approved' || v.approval_status === 'manager_approved').length;
    const rejected = this.recentVehicles.filter(v => v.approval_status === 'rejected' || v.approval_status === 'revision_required').length;
    const contractCount = this.recentVehicles.filter(v => v.ownership_type === 'contract').length;

    return {
      total,
      drafts,
      pending,
      approved,
      rejected,
      contractCount
    };
  }

  setStatusFilter(filter: VehicleStatusFilter): void {
    this.statusFilter = filter;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { status_filter: filter === 'all' ? null : filter },
      queryParamsHandling: 'merge'
    });
  }

  onSearchChange(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { search: this.searchQuery.trim() || null },
      queryParamsHandling: 'merge'
    });
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.onSearchChange();
  }

  exportExcel(): void {
    if (!this.selectedSectionId) {
      this.toast.show('warning', 'لطفاً ابتدا یک بخش را انتخاب کنید.');
      return;
    }
    this.isExportingExcel = true;
    this.personnelApi.exportVehiclesExcel({ section_id: this.selectedSectionId }).subscribe({
      next: (blob: Blob) => {
        this.isExportingExcel = false;
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fleet_vehicles_section_${this.selectedSectionId}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        this.toast.show('success', 'فایل اکسل ناوگان با موفقیت دانلود شد.');
      },
      error: (err: any) => {
        this.isExportingExcel = false;
        this.toast.show('error', 'خطا در دریافت خروجی اکسل: ' + (err.error?.error || err.message || 'نامشخص'));
      }
    });
  }

  // ─── اعتبارسنجی آنلاین شماره شبا ───
  onShebaChange(): void {
    const raw = this.newVehicle.sheba_number || '';
    if (!raw.trim()) {
      this.shebaValidationResult = null;
      return;
    }
    const clean = cleanShebaInput(raw);
    this.shebaValidationResult = validateSheba(clean);
    if (this.shebaValidationResult.isValid && this.shebaValidationResult.bank) {
      this.newVehicle.bank_name = this.shebaValidationResult.bank.name;
      // اگر شماره حساب خالی باشد، به صورت خودکار از شبا استخراج می‌کنیم
      if (!this.newVehicle.account_number) {
        this.newVehicle.account_number = extractAccountNumberFromSheba(clean);
      }
    }
  }

  // ─── اعتبارسنجی کد ملی راننده ───
  onNationalCodeChange(): void {
    const code = (this.newVehicle.driver_national_code || '').trim();
    if (!code) {
      this.nationalCodeError = null;
      return;
    }
    if (code.length !== 10 || !/^\d{10}$/.test(code)) {
      this.nationalCodeError = 'کد ملی باید دقیقاً ۱۰ رقم عددی باشد.';
      return;
    }
    if (/^(\d)\1{9}$/.test(code)) {
      this.nationalCodeError = 'کد ملی نامعتبر است (ارقام تکراری).';
      return;
    }
    const check = parseInt(code[9], 10);
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(code[i], 10) * (10 - i);
    }
    const rem = sum % 11;
    const isValid = (rem < 2 && check === rem) || (rem >= 2 && check === 11 - rem);
    this.nationalCodeError = isValid ? null : 'ساختار کد ملی نامعتبر است (خطای رقم کنترلی).';
  }

  // ─── معادل تومان نرخ پیش‌فرض ───
  get rateInTomans(): number {
    return Math.floor((Number(this.newVehicle.default_service_rate) || 0) / 10);
  }

  // ─── ثبت خودرو جدید (Guardian G2: Force approval_status = 'draft') ───
  saveVehicleDraft(): void {
    if (!this.selectedSectionId) {
      this.toast.show('warning', 'لطفاً ابتدا یک بخش را انتخاب کنید.');
      return;
    }
    if (!this.newVehicle.plate_number?.trim()) {
      this.toast.show('warning', 'شماره پلاک خودرو الزامی است.');
      return;
    }
    if (!this.newVehicle.driver_name?.trim()) {
      this.toast.show('warning', 'نام و نام خانوادگی راننده الزامی است.');
      return;
    }
    if (this.nationalCodeError) {
      this.toast.show('warning', this.nationalCodeError);
      return;
    }
    if (this.shebaValidationResult && !this.shebaValidationResult.isValid) {
      this.toast.show('warning', this.shebaValidationResult.errorMessage || 'شماره شبا نامعتبر است.');
      return;
    }

    this.isSaving = true;

    // Guardian G1 & G2: قفل روی بخش فعال و تحمیل وضعیت پیش‌نویس
    const payload: Partial<VehicleDriverProfile> = {
      ...this.newVehicle,
      plate_number: this.newVehicle.plate_number.trim(),
      driver_name: this.newVehicle.driver_name.trim(),
      driver_national_code: this.newVehicle.driver_national_code?.trim() || undefined,
      driver_phone: this.newVehicle.driver_phone?.trim() || undefined,
      sheba_number: this.newVehicle.sheba_number ? cleanShebaInput(this.newVehicle.sheba_number) : undefined,
      section: this.selectedSectionId,
      approval_status: 'draft', // Guardian G2
      is_active: true
    };

    this.personnelApi.createVehicleProfile(payload).subscribe({
      next: (created: VehicleDriverProfile) => {
        this.isSaving = false;
        this.toast.show('success', `خودرو «${created.plate_number}» با راننده «${created.driver_name}» در وضعیت پیش‌نویس ثبت شد.`);
        this.resetForm();
        this.loadRecentVehicles();
      },
      error: (err: any) => {
        this.isSaving = false;
        const msg = err.error?.plate_number?.[0] || err.error?.error || err.message || 'نامشخص';
        this.toast.show('error', 'خطا در ثبت خودرو: ' + msg);
        this.cdr.detectChanges();
      }
    });
  }

  resetForm(): void {
    this.newVehicle = {
      plate_number: '',
      vehicle_type: 'nissan',
      ownership_type: 'contract',
      driver_name: '',
      driver_national_code: '',
      driver_phone: '',
      default_service_rate: 0,
      bank_name: '',
      account_number: '',
      sheba_number: '',
      is_active: true,
      approval_status: 'draft'
    };
    this.shebaValidationResult = null;
    this.nationalCodeError = null;
  }

  // ─── حذف خودرو پیش‌نویس ───
  deleteDraftVehicle(vehicle: VehicleDriverProfile): void {
    if (!vehicle.id) return;
    if (vehicle.approval_status !== 'draft') {
      this.toast.show('warning', 'فقط خودروهای در وضعیت پیش‌نویس قابل حذف توسط کارمند هستند.');
      return;
    }

    if (!confirm(`آیا از حذف پیش‌نویس خودرو شماره «${vehicle.plate_number}» (${vehicle.driver_name}) اطمینان دارید؟`)) {
      return;
    }

    this.personnelApi.deleteVehicleProfile(vehicle.id).subscribe({
      next: () => {
        this.toast.show('success', `پیش‌نویس خودرو «${vehicle.plate_number}» با موفقیت حذف گردید.`);
        this.loadRecentVehicles();
      },
      error: (err: any) => {
        this.toast.show('error', 'خطا در حذف پیش‌نویس خودرو: ' + (err.error?.error || err.message || 'نامشخص'));
      }
    });
  }

  // ─── فرمت‌بندی و نمایش وضعیت ───
  getStatusBadgeClass(status?: string): string {
    switch (status) {
      case 'draft':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'pending_supervisor':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'manager_approved':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'approved':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'revision_required':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'rejected':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  }

  getStatusLabel(status?: string): string {
    switch (status) {
      case 'draft':
        return 'پیش‌نویس کارمند';
      case 'pending_supervisor':
        return 'در انتظار تایید سرپرست';
      case 'manager_approved':
        return 'تایید اولیه مدیر';
      case 'approved':
        return 'تصویب و فعال شده';
      case 'revision_required':
        return 'نیازمند اصلاح';
      case 'rejected':
        return 'رد شده';
      default:
        return status || 'نامشخص';
    }
  }

  getVehicleTypeLabel(type?: string): string {
    const found = this.vehicleTypes.find(t => t.value === type);
    return found ? found.label : (type || '-');
  }

  getOwnershipTypeLabel(type?: string): string {
    const found = this.ownershipTypes.find(t => t.value === type);
    return found ? found.label : (type || '-');
  }

  formatNumber(val: number | string | undefined | null): string {
    if (val === undefined || val === null || val === '') return '۰';
    const n = Number(val);
    if (isNaN(n)) return String(val);
    return n.toLocaleString('fa-IR');
  }
}
