import { Component, OnInit, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { ProjectSection, PersonnelProfile } from '../../../../core/models/personnel.model';
import { PersonnelApiService } from '../../../../core/api/personnel-api.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { ToastService } from '../../../../shared/components/toast/toast.component';
import { normalizeDigits } from '../../../../core/utils/date-utils';
import { ExcelImportModal } from '../../../../shared/components/excel-import-modal/excel-import-modal';
import { ImportResult } from '../../../../core/http/accounts-http.service';
import {
  cleanShebaInput,
  validateSheba,
  extractShebaDigits,
  extractAccountNumberFromSheba,
  generateShebaFromAccount,
  validateAccountNumber,
  ShebaValidationResult
} from '../../../../core/utils/sheba-utils';

export type PersonnelStatusFilter = 'all' | 'draft' | 'pending_supervisor' | 'manager_approved' | 'approved' | 'revision_required' | 'rejected';

@Component({
  selector: 'app-employee-new-personnel-hub',
  standalone: true,
  imports: [CommonModule, FormsModule, ExcelImportModal],
  templateUrl: './employee-new-personnel.html',
  styleUrl: './employee-new-personnel.css'
})
export class EmployeeNewPersonnelHubComponent implements OnInit {
  readonly Math = Math;

  // ─── مدیریت بخش و ایزولاسیون قلمرو (Guardian G1: Section Isolation) ───
  mySections: ProjectSection[] = [];
  selectedSectionId: number | null = null;
  selectedSection: ProjectSection | null = null;
  isLoadingSections: boolean = false;

  // ─── جدول نیروهای اخیراً ثبت‌شده بخش ───
  recentPersonnel: PersonnelProfile[] = [];
  isLoadingPersonnel: boolean = false;
  isSaving: boolean = false;
  isExportingExcel: boolean = false;
  isImportingExcel: boolean = false;
  searchQuery: string = '';
  statusFilter: PersonnelStatusFilter = 'all';

  // ─── وضعیت باز بودن مودال ثبت پرسنل جدید ───
  isNewPersonnelModalOpen: boolean = false;

  // ─── مودال استاندارد ورود اطلاعات از فایل اکسل (مشابه projects-and-sections) ───
  isExcelModalOpen: boolean = false;
  excelModalTitle: string = 'آپلود و ثبت دسته‌جمعی پرسنل از فایل اکسل';
  excelImportFn!: (file: File, updateExisting: boolean, dryRun?: boolean) => Observable<ImportResult>;
  excelTemplateFn!: () => void;

  get isLoading(): boolean {
    return this.isLoadingSections || this.isLoadingPersonnel;
  }

  // ─── فرم ثبت پرسنل جدید (Guardian G2: Enforced Draft Invariant) ───
  newPersonnel: Partial<PersonnelProfile> = {
    first_name: '',
    last_name: '',
    national_code: '',
    father_name: '',
    job_title: 'کارگر انبار',
    contract_type: 'daily',
    marital_status: 'single',
    children_count: 0,
    daily_base_wage: 0,
    phone_number: '',
    bank_name: '',
    account_number: '',
    sheba_number: '',
    is_active: true,
    approval_status: 'draft'
  };

  // اعتبارسنجی زنده و نمایش فرمت‌شده شبا (مشابه تعریف راننده و خودرو)
  shebaValidationResult: ShebaValidationResult | null = null;
  shebaDigitsDisplay: string = '';
  isShebaCopied: boolean = false;
  private _isSyncingBank: boolean = false;

  // مدیریت پیوست و آپلود مدارک هویتی پرسنل
  selectedDocumentAttachment: File | null = null;
  attachmentFileName: string = '';

  // اعتبارسنجی زنده کد ملی
  nationalCodeError: string | null = null;

  // ─── عناوین شغلی استاندارد ───
  readonly jobTitles: string[] = [
    'کارگر ساده انبار',
    'اپراتور لیفتراک',
    'کمک انباردار',
    'راننده خودرو سبک/سنگین',
    'مسئول انبار',
    'کارشناس اداری و مالی',
    'نگهبان و انتظامات',
    'کارگر فنی و تاسیسات',
    'سایر'
  ];

  // ─── انواع قرارداد (منحصر بر روزمزد مبنا ۱۰ ساعت بر اساس قوانین کارگاه) ───
  readonly contractTypes = [
    { value: 'daily', label: 'روزمزد (مبنا ۱۰ ساعت)' }
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
            this.loadRecentPersonnel();
          }
        }
      }
      if (params['status_filter'] && ['all', 'draft', 'pending_supervisor', 'manager_approved', 'approved', 'revision_required', 'rejected'].includes(params['status_filter'])) {
        this.statusFilter = params['status_filter'] as PersonnelStatusFilter;
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
        this.loadRecentPersonnel();
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
    this.loadRecentPersonnel();
  }

  // ─── بارگذاری پرسنل بخش فعال (Guardian G1: Section Isolation) ───
  loadRecentPersonnel(): void {
    if (!this.selectedSectionId) return;
    this.isLoadingPersonnel = true;
    this.personnelApi.getPersonnelProfiles({ section_id: this.selectedSectionId }).subscribe({
      next: (res: PersonnelProfile[]) => {
        this.recentPersonnel = res || [];
        this.isLoadingPersonnel = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.isLoadingPersonnel = false;
        this.toast.show('error', 'خطا در بارگذاری پرسنل: ' + (err.error?.error || err.message || 'نامشخص'));
        this.cdr.detectChanges();
      }
    });
  }

  // ─── فیلتر پرسنل اخیر ───
  get filteredPersonnel(): PersonnelProfile[] {
    let list = this.recentPersonnel;

    if (this.statusFilter !== 'all') {
      list = list.filter(p => p.approval_status === this.statusFilter);
    }

    const q = this.searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(p =>
        (p.first_name && p.first_name.toLowerCase().includes(q)) ||
        (p.last_name && p.last_name.toLowerCase().includes(q)) ||
        (p.full_name && p.full_name.toLowerCase().includes(q)) ||
        (p.national_code && p.national_code.includes(q)) ||
        (p.job_title && p.job_title.toLowerCase().includes(q)) ||
        (p.phone_number && p.phone_number.includes(q))
      );
    }

    return list;
  }

  // ─── شاخص‌های آماری پرسنل بخش ───
  get personnelMetrics() {
    const total = this.recentPersonnel.length;
    const drafts = this.recentPersonnel.filter(p => p.approval_status === 'draft').length;
    const pending = this.recentPersonnel.filter(p => p.approval_status === 'pending_supervisor').length;
    const approved = this.recentPersonnel.filter(p => p.approval_status === 'approved' || p.approval_status === 'manager_approved').length;
    const rejected = this.recentPersonnel.filter(p => p.approval_status === 'rejected' || p.approval_status === 'revision_required').length;
    const dailyCount = this.recentPersonnel.filter(p => p.contract_type === 'daily').length;

    return {
      total,
      drafts,
      pending,
      approved,
      rejected,
      dailyCount
    };
  }

  setStatusFilter(filter: PersonnelStatusFilter): void {
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
    this.personnelApi.exportPersonnelExcel({ section_id: this.selectedSectionId }).subscribe({
      next: (blob: Blob) => {
        this.isExportingExcel = false;
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `personnel_section_${this.selectedSectionId}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        this.toast.show('success', 'فایل اکسل پرسنل با موفقیت دانلود شد.');
      },
      error: (err: any) => {
        this.isExportingExcel = false;
        this.toast.show('error', 'خطا در دریافت خروجی اکسل: ' + (err.error?.error || err.message || 'نامشخص'));
      }
    });
  }

  // ─── ورود اطلاعات از طریق فایل اکسل (Excel Import) ───
  onExcelFileSelected(event: any): void {
    const file = event.target?.files?.[0];
    if (!file) return;

    const fileName = (file.name || '').toLowerCase();
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      this.toast.show('warning', 'لطفاً یک فایل معتبر اکسل با پسوند .xlsx یا .xls انتخاب فرمایید.');
      if (event.target) event.target.value = '';
      return;
    }

    if (!this.selectedSectionId) {
      this.toast.show('warning', 'لطفاً ابتدا یک بخش را انتخاب کنید.');
      if (event.target) event.target.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('section_id', String(this.selectedSectionId));

    this.isImportingExcel = true;
    this.toast.show('info', 'در حال پردازش و ورود اطلاعات پرسنل از فایل اکسل...');

    this.personnelApi.importPersonnelExcel(formData).subscribe({
      next: (res: any) => {
        this.isImportingExcel = false;
        const msg = res?.message || `درون‌ریزی انجام شد: ${res?.created_count || 0} پرسنل جدید، ${res?.updated_count || 0} به‌روزرسانی.`;
        this.toast.show('success', msg);
        if (event.target) event.target.value = '';
        this.loadRecentPersonnel();
      },
      error: (err: any) => {
        this.isImportingExcel = false;
        const errMsg = err?.error?.error || err?.message || 'خطا در ورود اطلاعات از فایل اکسل';
        this.toast.show('error', errMsg);
        if (event.target) event.target.value = '';
        this.cdr.detectChanges();
      }
    });
  }

  // ─── مدیریت مودال استاندارد ورود اکسل (مشابه projects-and-sections) ───
  openImportModal(): void {
    if (!this.selectedSectionId) {
      this.toast.show('warning', 'لطفاً ابتدا یک بخش را انتخاب کنید.');
      return;
    }
    this.excelModalTitle = 'آپلود و ثبت دسته‌جمعی پرسنل از فایل اکسل';
    this.excelImportFn = (file: File, updateExisting: boolean, dryRun?: boolean) => {
      return this.personnelApi.importPersonnelExcelModal(file, this.selectedSectionId, updateExisting, dryRun);
    };
    this.excelTemplateFn = () => this.downloadPersonnelTemplate();
    this.isExcelModalOpen = true;
    this.cdr.detectChanges();
  }

  closeExcelModal(): void {
    this.isExcelModalOpen = false;
    this.cdr.detectChanges();
  }

  onExcelImported(result: any): void {
    if (result?.success || result?.created_count || result?.summary?.created) {
      this.toast.show('success', 'اطلاعات پرسنل با موفقیت از فایل اکسل اعمال شد.');
      this.loadRecentPersonnel();
    }
  }

  downloadPersonnelTemplate(): void {
    this.personnelApi.downloadPersonnelTemplate().subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'personnel_template.xlsx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        this.toast.show('success', 'قالب استاندارد اکسل پرسنل با موفقیت دانلود شد.');
      },
      error: () => this.toast.show('error', 'خطا در دریافت قالب اکسل پرسنل')
    });
  }

  // ─── مدیریت مودال ثبت و معرفی پرسنل جدید ───
  openNewPersonnelModal(): void {
    if (!this.selectedSectionId) {
      this.toast.show('warning', 'لطفاً ابتدا یک بخش را انتخاب کنید.');
      return;
    }
    this.resetForm();
    this.isNewPersonnelModalOpen = true;
    this.cdr.detectChanges();
  }

  closeNewPersonnelModal(): void {
    this.isNewPersonnelModalOpen = false;
    this.cdr.detectChanges();
  }

  @HostListener('document:keydown.escape')
  handleEscape(): void {
    if (this.isNewPersonnelModalOpen) {
      this.closeNewPersonnelModal();
    }
  }

  // ─── اعتبارسنجی و فرمت‌بندی پیشرفته شماره شبا (مشابه تعریف راننده و خودرو) ───
  onShebaInput(event: any): void {
    if (this._isSyncingBank) return;
    this._isSyncingBank = true;
    try {
      const rawVal = typeof event === 'string' ? event : (event?.target?.value || '');
      const digits = extractShebaDigits(rawVal);
      const res = validateSheba(digits);
      this.shebaValidationResult = res;
      this.shebaDigitsDisplay = res.formattedDigits || digits;
      this.newPersonnel.sheba_number = res.rawSheba;
      if (res.bank) {
        this.newPersonnel.bank_name = res.bank.name;
      }
      if (res.accountNumber) {
        this.newPersonnel.account_number = res.accountNumber;
      }
      if (event?.target) {
        event.target.value = this.shebaDigitsDisplay;
      }
    } finally {
      this._isSyncingBank = false;
    }
    this.cdr.detectChanges();
  }

  onShebaPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pasted = event.clipboardData?.getData('text') || '';
    this.onShebaInput(pasted);
  }

  onShebaCopy(event: ClipboardEvent): void {
    const digits = extractShebaDigits(this.newPersonnel.sheba_number || '');
    if (digits && event.clipboardData) {
      event.preventDefault();
      event.clipboardData.setData('text/plain', digits);
      this.isShebaCopied = true;
      setTimeout(() => { this.isShebaCopied = false; this.cdr.detectChanges(); }, 2000);
    }
  }

  copyShebaToClipboard(): void {
    const digits = extractShebaDigits(this.newPersonnel.sheba_number || '');
    if (!digits) return;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(digits).then(() => {
        this.isShebaCopied = true;
        this.toast.show('success', 'شماره شبا (۲۴ رقم بدون IR) در کلیپ‌بورد کپی شد.');
        setTimeout(() => { this.isShebaCopied = false; this.cdr.detectChanges(); }, 2000);
        this.cdr.detectChanges();
      }).catch(() => {
        this.toast.show('warning', 'امکان کپی خودکار در کلیپ‌بورد مقدور نشد.');
      });
    } else {
      this.isShebaCopied = true;
      this.toast.show('success', 'شماره شبا کپی شد.');
      setTimeout(() => { this.isShebaCopied = false; this.cdr.detectChanges(); }, 2000);
    }
  }

  // متد سازگاری رو به عقب برای شبا
  onShebaChange(): void {
    const raw = this.newPersonnel.sheba_number || '';
    if (!raw.trim()) {
      this.shebaValidationResult = null;
      this.shebaDigitsDisplay = '';
      return;
    }
    const clean = cleanShebaInput(raw);
    this.newPersonnel.sheba_number = clean;
    this.shebaValidationResult = validateSheba(clean);
    this.shebaDigitsDisplay = this.shebaValidationResult.formattedDigits || extractShebaDigits(clean);
    if (this.shebaValidationResult.isValid && this.shebaValidationResult.bank) {
      this.newPersonnel.bank_name = this.shebaValidationResult.bank.name;
      if (!this.newPersonnel.account_number) {
        this.newPersonnel.account_number = extractAccountNumberFromSheba(clean);
      }
    }
  }

  // ─── مدیریت آپلود مدارک هویتی پرسنل ───
  onDocumentFileSelected(event: any): void {
    const file = event.target?.files?.[0];
    if (file) {
      // محدودیت حجم فایل تا ۱۰ مگابایت
      if (file.size > 10 * 1024 * 1024) {
        this.toast.show('warning', 'حجم فایل مدارک نباید بیشتر از ۱۰ مگابایت باشد.');
        return;
      }
      this.selectedDocumentAttachment = file;
      this.attachmentFileName = file.name;
      this.cdr.detectChanges();
    }
  }

  removeSelectedAttachment(): void {
    this.selectedDocumentAttachment = null;
    this.attachmentFileName = '';
    this.cdr.detectChanges();
  }

  // ─── اعتبارسنجی الگوریتم ۱۰ رقمی کد ملی (Mod 11) ───
  onNationalCodeChange(): void {
    const raw = (this.newPersonnel.national_code || '').trim();
    if (!raw) {
      this.nationalCodeError = null;
      return;
    }
    const code = normalizeDigits(raw).replace(/\D/g, '');
    this.newPersonnel.national_code = code;

    if (code.length !== 10) {
      this.nationalCodeError = 'کد ملی باید دقیقاً ۱۰ رقم عددی باشد.';
      return;
    }
    if (/^(\d)\1{9}$/.test(code)) {
      this.nationalCodeError = 'کد ملی نامعتبر است (ارقام تکراری).';
      return;
    }
    const digits = code.split('').map(Number);
    const checksum = digits[9];
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += digits[i] * (10 - i);
    }
    const rem = sum % 11;
    const isValid = (rem < 2 && checksum === rem) || (rem >= 2 && checksum === 11 - rem);
    this.nationalCodeError = isValid ? null : 'ساختار کد ملی نامعتبر است (خطای رقم کنترلی).';
  }

  // ─── معادل تومان مزد پایه روزانه ───
  get wageInTomans(): number {
    return Math.floor((Number(this.newPersonnel.daily_base_wage) || 0) / 10);
  }

  // ─── ثبت پرسنل جدید (Guardian G2: Force approval_status = 'draft') ───
  savePersonnelDraft(): void {
    if (!this.selectedSectionId) {
      this.toast.show('warning', 'لطفاً ابتدا یک بخش را انتخاب کنید.');
      return;
    }
    if (!this.newPersonnel.first_name?.trim() || !this.newPersonnel.last_name?.trim()) {
      this.toast.show('warning', 'نام و نام خانوادگی پرسنل الزامی است.');
      return;
    }
    if (!this.newPersonnel.national_code?.trim() || this.newPersonnel.national_code.trim().length !== 10) {
      this.toast.show('warning', 'کد ملی ۱۰ رقمی الزامی است.');
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

    // در صورت وجود پیوست مدارک از FormData استفاده می‌کنیم
    let payload: Partial<PersonnelProfile> | FormData;

    if (this.selectedDocumentAttachment) {
      const formData = new FormData();
      formData.append('section', String(this.selectedSectionId));
      formData.append('first_name', this.newPersonnel.first_name!.trim());
      formData.append('last_name', this.newPersonnel.last_name!.trim());
      formData.append('national_code', this.newPersonnel.national_code!.trim());
      if (this.newPersonnel.father_name?.trim()) formData.append('father_name', this.newPersonnel.father_name.trim());
      if (this.newPersonnel.job_title?.trim()) formData.append('job_title', this.newPersonnel.job_title.trim());
      if (this.newPersonnel.contract_type) formData.append('contract_type', this.newPersonnel.contract_type);
      if (this.newPersonnel.marital_status) formData.append('marital_status', this.newPersonnel.marital_status);
      formData.append('children_count', String(Number(this.newPersonnel.children_count) || 0));
      if (this.newPersonnel.phone_number?.trim()) formData.append('phone_number', this.newPersonnel.phone_number.trim());
      formData.append('daily_base_wage', String(Number(this.newPersonnel.daily_base_wage) || 0));
      if (this.newPersonnel.bank_name?.trim()) formData.append('bank_name', this.newPersonnel.bank_name.trim());
      if (this.newPersonnel.account_number?.trim()) formData.append('account_number', this.newPersonnel.account_number.trim());
      if (this.newPersonnel.sheba_number) formData.append('sheba_number', cleanShebaInput(this.newPersonnel.sheba_number));
      formData.append('approval_status', 'draft');
      formData.append('is_active', 'true');
      formData.append('attachment', this.selectedDocumentAttachment);
      payload = formData;
    } else {
      payload = {
        ...this.newPersonnel,
        first_name: this.newPersonnel.first_name!.trim(),
        last_name: this.newPersonnel.last_name!.trim(),
        national_code: this.newPersonnel.national_code!.trim(),
        father_name: this.newPersonnel.father_name?.trim() || undefined,
        job_title: this.newPersonnel.job_title?.trim() || 'کارگر انبار',
        children_count: Number(this.newPersonnel.children_count) || 0,
        phone_number: this.newPersonnel.phone_number?.trim() || undefined,
        sheba_number: this.newPersonnel.sheba_number ? cleanShebaInput(this.newPersonnel.sheba_number) : undefined,
        section: this.selectedSectionId,
        approval_status: 'draft',
        is_active: true
      };
    }

    this.personnelApi.createPersonnelProfile(payload).subscribe({
      next: (created: PersonnelProfile) => {
        this.isSaving = false;
        this.toast.show('success', `پرونده «${created.first_name} ${created.last_name}» در وضعیت پیش‌نویس ثبت شد و به کارتابل سرپرست ارسال گردید.`);
        this.resetForm();
        this.isNewPersonnelModalOpen = false;
        this.loadRecentPersonnel();
      },
      error: (err: any) => {
        this.isSaving = false;
        const msg = err.error?.national_code?.[0] || err.error?.error || err.message || 'نامشخص';
        this.toast.show('error', 'خطا در ثبت پرسنل: ' + msg);
        this.cdr.detectChanges();
      }
    });
  }

  resetForm(): void {
    this.newPersonnel = {
      first_name: '',
      last_name: '',
      national_code: '',
      father_name: '',
      job_title: 'کارگر انبار',
      contract_type: 'daily',
      marital_status: 'single',
      children_count: 0,
      daily_base_wage: 0,
      phone_number: '',
      bank_name: '',
      account_number: '',
      sheba_number: '',
      is_active: true,
      approval_status: 'draft'
    };
    this.shebaValidationResult = null;
    this.shebaDigitsDisplay = '';
    this.isShebaCopied = false;
    this.selectedDocumentAttachment = null;
    this.attachmentFileName = '';
    this.nationalCodeError = null;
  }

  // ─── حذف پرسنل پیش‌نویس ───
  deleteDraftPersonnel(personnel: PersonnelProfile): void {
    if (!personnel.id) return;
    if (personnel.approval_status !== 'draft') {
      this.toast.show('warning', 'فقط پرونده‌های در وضعیت پیش‌نویس قابل حذف توسط کارمند هستند.');
      return;
    }

    if (!confirm(`آیا از حذف پرونده پیش‌نویس «${personnel.first_name} ${personnel.last_name}» اطمینان دارید؟`)) {
      return;
    }

    this.personnelApi.deletePersonnelProfile(personnel.id).subscribe({
      next: () => {
        this.toast.show('success', `پرونده پیش‌نویس «${personnel.first_name} ${personnel.last_name}» حذف گردید.`);
        this.loadRecentPersonnel();
      },
      error: (err: any) => {
        this.toast.show('error', 'خطا در حذف پرونده: ' + (err.error?.error || err.message || 'نامشخص'));
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

  getContractTypeLabel(type?: string): string {
    switch (type) {
      case 'daily':
        return 'روزمزد (۱۰ ساعت)';
      default:
        return 'روزمزد (۱۰ ساعت)';
    }
  }

  formatNumber(val: number | string | undefined | null): string {
    if (val === undefined || val === null || val === '') return '۰';
    const n = Number(val);
    if (isNaN(n)) return String(val);
    return n.toLocaleString('fa-IR');
  }
}
