import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { StateService } from '../../../services/state.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from '../../../services/toast.service';
import { PersonnelApiService } from '../../../core/api/personnel-api.service';
import { AccountsHttpService, User, ImportResult } from '../../../core/http/accounts-http.service';
import { WebSocketService } from '../../../core/http/websocket.service';
import { OfflineSyncService } from '../../../core/services/offline-sync.service';
import { ExcelImportModal } from '../../../shared/components/excel-import-modal/excel-import-modal';
import {
  FinancialProject,
  ProjectSection,
  UserSectionAssignment,
  Counterparty
} from '../../../core/models/personnel.model';
import {
  IRANIAN_BANKS,
  IranianBankInfo,
  validateSheba,
  ShebaValidationResult,
  extractShebaDigits,
  generateShebaFromAccount,
  validateAccountNumber
} from '../../../core/utils/sheba-utils';

@Component({
  selector: 'app-projects-and-sections',
  standalone: true,
  imports: [CommonModule, FormsModule, ExcelImportModal],
  templateUrl: './projects-and-sections.html',
  styleUrl: './projects-and-sections.css'
})
export class ProjectsAndSectionsComponent implements OnInit, OnDestroy {
  activeSubTab: 'projects' | 'sections' | 'assignments' | 'counterparties' = 'projects';

  financialProjects: FinancialProject[] = [];
  projectSections: ProjectSection[] = [];
  userAssignments: UserSectionAssignment[] = [];
  counterparties: Counterparty[] = [];
  systemUsers: User[] = [];
  selectedProjectId: number | null = null;
  isLoading = false;

  // وضعیت و توابع مدال اکسل
  isExcelModalOpen = false;
  excelModalTitle = 'آپلود فایل اکسل';
  excelImportFn!: (file: File, updateExisting: boolean) => any;
  excelTemplateFn!: () => void;

  // مدل‌های فرم
  newProject: Partial<FinancialProject> = { code: '', name: '', description: '', is_active: true };
  editingProject: FinancialProject | null = null;

  newSection: Partial<ProjectSection> = { code: '', name: '', is_active: true };
  editingSection: ProjectSection | null = null;

  newAssignment: { user: number | null; section: number | null; role: 'employee' | 'supervisor' | 'accountant' | 'manager' | 'treasury' } = {
    user: null,
    section: null,
    role: 'employee'
  };

  newCounterparty: Partial<Counterparty> = {
    name: '',
    counterparty_type: 'driver',
    phone: '',
    national_id: '',
    bank_name: '',
    account_number: '',
    sheba_number: '',
    section: null,
    is_active: true
  };
  editingCounterparty: Counterparty | null = null;

  // سیستم استاندارد و هوشمند شبا و بانک عامل مشابه با تعریف خودرو
  iranianBanks: IranianBankInfo[] = IRANIAN_BANKS;
  shebaValidationResult: ShebaValidationResult | null = null;
  shebaDigitsDisplay: string = '';
  isBankDropdownOpen: boolean = false;
  bankSearchQuery: string = '';
  isShebaCopied: boolean = false;
  isAccountCopied: boolean = false;
  private _isSyncingBank = false;

  private subs: Subscription[] = [];
  private offlineSync = OfflineSyncService.getInstance();

  constructor(
    public auth: AuthService,
    public state: StateService,
    private api: PersonnelApiService,
    private accountsHttp: AccountsHttpService,
    private ws: WebSocketService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.ws.connect();
    this.setupRealtimeListeners();
    this.setupRouteQuerySync();
    this.loadAllData();
  }

  private setupRouteQuerySync(): void {
    this.subs.push(
      this.route.queryParams.subscribe(params => {
        if (params['tab']) {
          const tab = params['tab'] as any;
          if (['projects', 'sections', 'assignments', 'counterparties'].includes(tab)) {
            this.activeSubTab = tab;
          }
        }
        if (params['project_id']) {
          const pId = Number(params['project_id']);
          if (!isNaN(pId) && pId > 0) {
            this.selectedProjectId = pId;
            if (this.financialProjects.length > 0) {
              this.loadSections();
            }
          }
        }
        this.cdr.detectChanges();
      })
    );
  }

  switchSubTab(tab: 'projects' | 'sections' | 'assignments' | 'counterparties'): void {
    this.activeSubTab = tab;
    const queryParams: any = { tab };
    if (tab === 'sections' && this.selectedProjectId) {
      queryParams['project_id'] = this.selectedProjectId;
    } else {
      queryParams['project_id'] = null;
    }
    this.router.navigate([], { queryParams, queryParamsHandling: 'merge', replaceUrl: true });
    this.cdr.detectChanges();
  }

  onProjectSelectChange(projectId: any): void {
    const pId = projectId ? Number(projectId) : null;
    this.selectedProjectId = pId;
    this.router.navigate([], {
      queryParams: { project_id: pId || null },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
    this.loadSections();
    this.cdr.detectChanges();
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  private setupRealtimeListeners(): void {
    // ۱. شنود وب‌سوکت سراسری جهت همگام‌سازی بلادرنگ رویدادها بین تب‌ها و کاربران
    this.subs.push(
      this.ws.notifications$.subscribe(msg => {
        if (msg?.type_str === 'org_structure_updated') {
          // فیلتر اکو: اگر مبدا رویداد همین تب بوده است، دوباره رفرش نکن چون به صورت محلی فوراً اعمال شده
          if (msg.client_tab_id && msg.client_tab_id === this.ws.tabId) {
            return;
          }
          if (msg.entity_type === 'project') {
            this.loadProjects();
          } else if (msg.entity_type === 'section') {
            this.loadSections();
          } else if (msg.entity_type === 'counterparty') {
            this.loadCounterparties();
          } else if (msg.entity_type === 'assignment') {
            this.loadAssignments();
          }
        }
      })
    );

    // ۲. شنود تغییرات زنده کش و صف آفلاین SWR
    this.subs.push(
      this.offlineSync.liveDataUpdates$.subscribe(({ url, data }) => {
        if (!url) return;
        if (url.includes('/financial-projects/')) {
          if (Array.isArray(data)) {
            this.financialProjects = data;
            this.cdr.detectChanges();
          }
        } else if (url.includes('/project-sections/')) {
          if (Array.isArray(data)) {
            this.projectSections = data;
            this.cdr.detectChanges();
          }
        } else if (url.includes('/counterparties/')) {
          if (Array.isArray(data)) {
            this.counterparties = data;
            this.cdr.detectChanges();
          }
        }
      })
    );
  }

  // --- سیستم فیلتر و انتخاب بانک شبا ---
  get filteredBanks(): IranianBankInfo[] {
    if (!this.bankSearchQuery || !this.bankSearchQuery.trim()) {
      return this.iranianBanks;
    }
    const q = this.bankSearchQuery.trim().toLowerCase();
    return this.iranianBanks.filter(b => 
      b.name.toLowerCase().includes(q) || 
      b.shortName.toLowerCase().includes(q) || 
      b.code.includes(q)
    );
  }

  selectBankFromDropdown(bank: IranianBankInfo, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.onBankSelect(bank.name);
    this.isBankDropdownOpen = false;
    this.bankSearchQuery = '';
  }

  onBankSelect(bankName: string): void {
    this.newCounterparty.bank_name = bankName;
    const accValidation = validateAccountNumber(this.newCounterparty.account_number);
    if (accValidation.isValid && bankName) {
      const generated = generateShebaFromAccount(bankName, this.newCounterparty.account_number);
      if (generated) {
        this._isSyncingBank = true;
        try {
          const res = validateSheba(generated);
          this.shebaValidationResult = res;
          this.shebaDigitsDisplay = res.formattedDigits;
          this.newCounterparty.sheba_number = res.rawSheba?.replace(/^IR/i, '') || '';
        } finally {
          this._isSyncingBank = false;
        }
      }
    } else if (this.newCounterparty.sheba_number) {
      this.onShebaInput(this.newCounterparty.sheba_number);
    }
    this.cdr.detectChanges();
  }

  onShebaInput(event: any): void {
    if (this._isSyncingBank) return;
    this._isSyncingBank = true;
    try {
      const rawVal = typeof event === 'string' ? event : (event?.target?.value || '');
      const digits = extractShebaDigits(rawVal);
      const res = validateSheba(digits);
      this.shebaValidationResult = res;
      this.shebaDigitsDisplay = res.formattedDigits || digits;
      this.newCounterparty.sheba_number = digits;
      if (res.bank) {
        this.newCounterparty.bank_name = res.bank.name;
      }
      if (res.accountNumber) {
        this.newCounterparty.account_number = res.accountNumber;
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
    if (!this.newCounterparty.sheba_number) return;
    event.preventDefault();
    const full = 'IR' + this.newCounterparty.sheba_number;
    event.clipboardData?.setData('text/plain', full);
    this.toast.show('info', `شماره شبا ${full} کپی شد.`);
  }

  copyShebaToClipboard(): void {
    if (!this.newCounterparty.sheba_number) return;
    const full = 'IR' + this.newCounterparty.sheba_number;
    navigator.clipboard.writeText(full).then(() => {
      this.isShebaCopied = true;
      this.toast.show('success', `شماره شبا ${full} در کلیپ‌بورد کپی شد.`);
      setTimeout(() => {
        this.isShebaCopied = false;
        this.cdr.detectChanges();
      }, 2000);
      this.cdr.detectChanges();
    });
  }

  // --- متدهای مدیریت شماره حساب و تبدیل به شبا ---
  onAccountNumberInput(event: any): void {
    if (this._isSyncingBank) return;
    const rawVal = typeof event === 'string' ? event : (event?.target?.value || '');
    const cleanAcc = rawVal.replace(/[۰-۹]/g, (d: string) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
                           .replace(/[٠-٩]/g, (d: string) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
                           .replace(/\D/g, '')
                           .substring(0, 18);
    this.newCounterparty.account_number = cleanAcc;
    if (event?.target) {
      event.target.value = cleanAcc;
    }
    
    // تبدیل خودکار شماره حساب و بانک به شماره شبا
    const accValidation = validateAccountNumber(cleanAcc);
    if (accValidation.isValid && this.newCounterparty.bank_name) {
      const generated = generateShebaFromAccount(this.newCounterparty.bank_name, cleanAcc);
      if (generated) {
        this._isSyncingBank = true;
        try {
          const res = validateSheba(generated);
          this.shebaValidationResult = res;
          this.shebaDigitsDisplay = res.formattedDigits;
          this.newCounterparty.sheba_number = res.rawSheba?.replace(/^IR/i, '') || '';
        } finally {
          this._isSyncingBank = false;
        }
      }
    }
    this.cdr.detectChanges();
  }

  onAccountNumberPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pasted = event.clipboardData?.getData('text') || '';
    this.onAccountNumberInput(pasted);
    const target = event.target as HTMLInputElement;
    if (target) {
      target.value = this.newCounterparty.account_number || '';
    }
  }

  onAccountNumberCopy(event: ClipboardEvent): void {
    const acc = this.newCounterparty.account_number || '';
    if (acc && event.clipboardData) {
      event.preventDefault();
      event.clipboardData.setData('text/plain', acc);
      this.isAccountCopied = true;
      setTimeout(() => { this.isAccountCopied = false; this.cdr.detectChanges(); }, 2000);
      this.cdr.detectChanges();
    }
  }

  copyAccountNumberToClipboard(): void {
    const acc = this.newCounterparty.account_number || '';
    if (!acc) return;
    navigator.clipboard.writeText(acc).then(() => {
      this.isAccountCopied = true;
      this.toast.show('success', `شماره حساب ${acc} کپی شد.`);
      setTimeout(() => {
        this.isAccountCopied = false;
        this.cdr.detectChanges();
      }, 2000);
      this.cdr.detectChanges();
    });
  }

  convertAccountToShebaNow(): void {
    if (!this.newCounterparty.bank_name) {
      this.toast.show('warning', 'لطفاً ابتدا بانک عامل را انتخاب نمایید.');
      return;
    }
    const accValidation = validateAccountNumber(this.newCounterparty.account_number);
    if (!accValidation.isValid) {
      this.toast.show('warning', accValidation.errorMessage || 'لطفاً یک شماره حساب معتبر وارد نمایید.');
      return;
    }
    const generated = generateShebaFromAccount(this.newCounterparty.bank_name, this.newCounterparty.account_number);
    if (generated) {
      this.onShebaInput(generated);
      this.toast.show('success', `شماره شبا بر اساس شماره حساب و بانک «${this.newCounterparty.bank_name}» تولید شد.`);
    } else {
      this.toast.show('error', 'امکان تبدیل خودکار شماره حساب این بانک به شبا فراهم نیست. لطفاً شبا را مستقیماً وارد کنید.');
    }
  }

  // --- بارگذاری داده‌ها ---
  loadAllData(): void {
    this.isLoading = true;
    this.loadProjects();
    this.loadAssignments();
    this.loadCounterparties();
    this.loadUsers();
  }

  loadProjects(): void {
    this.api.getFinancialProjects().subscribe({
      next: (projects) => {
        this.financialProjects = projects;
        const qpId = this.route.snapshot.queryParams['project_id'];
        const numId = qpId ? Number(qpId) : null;
        if (numId && projects.some(p => p.id === numId)) {
          this.selectedProjectId = numId;
        } else if (!this.selectedProjectId && projects.length > 0) {
          this.selectedProjectId = projects[0].id!;
        }
        this.loadSections();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.toast.show('error', 'خطا در دریافت لیست پروژه‌ها');
        this.cdr.detectChanges();
      }
    });
  }

  // --- ورودی و خروجی اکسل ---
  private triggerDownloadBlob(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  exportExcel(): void {
    this.isLoading = true;
    if (this.activeSubTab === 'projects') {
      this.api.exportFinancialProjectsExcel().subscribe({
        next: (blob) => {
          this.triggerDownloadBlob(blob, 'financial_projects.xlsx');
          this.toast.show('success', 'فایل اکسل پروژه‌های مالی با موفقیت دانلود شد.');
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.toast.show('error', 'خطا در دانلود فایل اکسل پروژه‌ها');
          this.isLoading = false;
          this.cdr.detectChanges();
        }
      });
    } else if (this.activeSubTab === 'sections') {
      this.api.exportProjectSectionsExcel(this.selectedProjectId || undefined).subscribe({
        next: (blob) => {
          this.triggerDownloadBlob(blob, 'project_sections.xlsx');
          this.toast.show('success', 'فایل اکسل بخش‌های پروژه با موفقیت دانلود شد.');
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.toast.show('error', 'خطا در دانلود فایل اکسل بخش‌ها');
          this.isLoading = false;
          this.cdr.detectChanges();
        }
      });
    } else if (this.activeSubTab === 'counterparties') {
      this.api.exportCounterpartiesExcel().subscribe({
        next: (blob) => {
          this.triggerDownloadBlob(blob, 'counterparties.xlsx');
          this.toast.show('success', 'فایل اکسل طرف‌حساب‌های مالی با موفقیت دانلود شد.');
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.toast.show('error', 'خطا در دانلود فایل اکسل طرف‌حساب‌ها');
          this.isLoading = false;
          this.cdr.detectChanges();
        }
      });
    } else {
      this.api.exportFinancialProjectsExcel().subscribe({
        next: (blob) => {
          this.triggerDownloadBlob(blob, 'organization_structure.xlsx');
          this.toast.show('success', 'فایل اکسل ساختار سازمانی دانلود شد.');
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.toast.show('error', 'خطا در دانلود فایل اکسل');
          this.isLoading = false;
          this.cdr.detectChanges();
        }
      });
    }
  }

  openImportModal(): void {
    this.excelModalTitle = 'آپلود دسته‌جمعی طرف‌حساب‌های مالی';
    this.excelImportFn = (file: File) => this.api.importCounterpartiesExcel(file);
    this.excelTemplateFn = () => this.downloadCounterpartyTemplate();
    this.isExcelModalOpen = true;
    this.cdr.detectChanges();
  }

  downloadCounterpartyTemplate(): void {
    this.api.downloadCounterpartiesTemplate().subscribe({
      next: (blob) => {
        this.triggerDownloadBlob(blob, 'counterparties_template.xlsx');
        this.toast.show('success', 'قالب اکسل طرف‌حساب‌ها با موفقیت دانلود شد.');
      },
      error: () => this.toast.show('error', 'خطا در دریافت قالب اکسل')
    });
  }

  onExcelImported(result: any): void {
    if (result?.success) {
      this.toast.show('success', 'اطلاعات اکسل با موفقیت بارگذاری و اعمال شد.');
      this.loadAllData();
      this.closeExcelModal();
    }
  }

  closeExcelModal(): void {
    this.isExcelModalOpen = false;
    this.cdr.detectChanges();
  }

  loadSections(): void {
    const params = this.selectedProjectId ? { project_id: this.selectedProjectId } : undefined;
    this.api.getProjectSections(params).subscribe({
      next: (sections) => {
        this.projectSections = sections;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadAssignments(): void {
    this.api.getUserSectionAssignments().subscribe({
      next: (assignments) => {
        this.userAssignments = assignments;
        this.cdr.detectChanges();
      }
    });
  }

  loadCounterparties(): void {
    this.api.getCounterparties().subscribe({
      next: (cp) => {
        this.counterparties = cp;
        this.cdr.detectChanges();
      }
    });
  }

  loadUsers(): void {
    this.accountsHttp.getUsers().subscribe({
      next: (users) => {
        this.systemUsers = users;
        this.cdr.detectChanges();
      }
    });
  }

  onProjectFilterChange(projId: number): void {
    this.selectedProjectId = projId;
    this.loadSections();
  }

  // --- عملیات پروژه (Project CRUD) ---
  saveProject(): void {
    if (!this.newProject.code?.trim() || !this.newProject.name?.trim()) {
      this.toast.show('warning', 'لطفاً کد و نام پروژه را وارد نمایید.');
      return;
    }

    if (this.editingProject?.id) {
      const editId = this.editingProject.id;
      this.api.updateFinancialProject(editId, this.newProject).subscribe({
        next: (updated) => {
          this.toast.show('success', `پروژه «${updated.name}» بروزرسانی شد.`);
          this.editingProject = null;
          this.newProject = { code: '', name: '', description: '', is_active: true };
          this.financialProjects = this.financialProjects.map(p => p.id === editId ? updated : p);
          this.loadProjects();
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.toast.show('error', err?.error?.error || 'خطا در ویرایش پروژه');
          this.cdr.detectChanges();
        }
      });
    } else {
      this.api.createFinancialProject(this.newProject).subscribe({
        next: (created) => {
          this.toast.show('success', `پروژه «${created.name}» با موفقیت ایجاد شد.`);
          this.newProject = { code: '', name: '', description: '', is_active: true };
          // بروزرسانی آنی آرایه در فرانت‌اند و انتخاب پروژه تازه ایجاد شده
          this.financialProjects = [created, ...this.financialProjects.filter(p => p.id !== created.id)];
          this.selectedProjectId = created.id!;
          this.loadSections();
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.toast.show('error', err?.error?.error || 'خطا در ایجاد پروژه');
          this.cdr.detectChanges();
        }
      });
    }
  }

  editProject(proj: FinancialProject): void {
    this.editingProject = proj;
    this.newProject = { ...proj };
  }

  cancelEditProject(): void {
    this.editingProject = null;
    this.newProject = { code: '', name: '', description: '', is_active: true };
  }

  deleteProject(id: number, name: string): void {
    if (!confirm(`آیا از حذف پروژه «${name}» اطمینان دارید؟ تمامی بخش‌های تابعه نیز حذف خواهند شد.`)) return;
    this.api.deleteFinancialProject(id).subscribe({
      next: () => {
        this.toast.show('success', 'پروژه با موفقیت حذف شد.');
        this.financialProjects = this.financialProjects.filter(p => p.id !== id);
        if (this.selectedProjectId === id) {
          this.selectedProjectId = this.financialProjects.length > 0 ? this.financialProjects[0].id! : null;
        }
        this.loadSections();
        this.cdr.detectChanges();
      },
      error: () => this.toast.show('error', 'خطا در حذف پروژه')
    });
  }

  // --- عملیات بخش‌ها (Section CRUD) ---
  saveSection(): void {
    if (!this.selectedProjectId) {
      this.toast.show('warning', 'لطفاً ابتدا یک پروژه والد انتخاب کنید.');
      return;
    }
    if (!this.newSection.code?.trim() || !this.newSection.name?.trim()) {
      this.toast.show('warning', 'لطفاً کد و نام بخش را وارد نمایید.');
      return;
    }

    const payload = {
      ...this.newSection,
      project: this.selectedProjectId
    };

    if (this.editingSection?.id) {
      const editId = this.editingSection.id;
      this.api.updateProjectSection(editId, payload).subscribe({
        next: (updated) => {
          this.toast.show('success', `بخش «${updated.name}» بروزرسانی شد.`);
          this.editingSection = null;
          this.newSection = { code: '', name: '', is_active: true };
          this.projectSections = this.projectSections.map(s => s.id === editId ? updated : s);
          this.loadSections();
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.toast.show('error', err?.error?.error || 'خطا در ویرایش بخش');
          this.cdr.detectChanges();
        }
      });
    } else {
      this.api.createProjectSection(payload).subscribe({
        next: (created) => {
          this.toast.show('success', `بخش «${created.name}» با موفقیت ایجاد شد.`);
          this.newSection = { code: '', name: '', is_active: true };
          // اضافه کردن فوری به لیست بخش‌ها و رفرش زنده
          this.projectSections = [created, ...this.projectSections.filter(s => s.id !== created.id)];
          this.loadSections();
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.toast.show('error', err?.error?.error || 'خطا در ایجاد بخش');
          this.cdr.detectChanges();
        }
      });
    }
  }

  editSection(sec: ProjectSection): void {
    this.editingSection = sec;
    this.newSection = { ...sec };
  }

  cancelEditSection(): void {
    this.editingSection = null;
    this.newSection = { code: '', name: '', is_active: true };
  }

  deleteSection(id: number, name: string): void {
    if (!confirm(`آیا از حذف بخش «${name}» اطمینان دارید؟`)) return;
    this.api.deleteProjectSection(id).subscribe({
      next: () => {
        this.toast.show('success', 'بخش حذف شد.');
        this.projectSections = this.projectSections.filter(s => s.id !== id);
        this.loadSections();
        this.cdr.detectChanges();
      },
      error: () => this.toast.show('error', 'خطا در حذف بخش')
    });
  }

  // --- عملیات انتساب کاربران (Assignment CRUD) ---
  saveAssignment(): void {
    if (!this.newAssignment.user || !this.newAssignment.section) {
      this.toast.show('warning', 'لطفاً کاربر و بخش را انتخاب کنید.');
      return;
    }

    this.api.createUserSectionAssignment({
      user: this.newAssignment.user,
      section: this.newAssignment.section,
      role: this.newAssignment.role,
      is_active: true
    }).subscribe({
      next: (created) => {
        this.toast.show('success', 'انتساب کاربر با موفقیت ثبت شد.');
        this.newAssignment = { user: null, section: null, role: 'employee' };
        this.userAssignments = [created, ...this.userAssignments.filter(a => a.id !== created.id)];
        this.loadAssignments();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.toast.show('error', err?.error?.error || 'خطا در انتساب کاربر');
        this.cdr.detectChanges();
      }
    });
  }

  deleteAssignment(id: number): void {
    if (!confirm('آیا از حذف این انتساب اطمینان دارید؟')) return;
    this.api.deleteUserSectionAssignment(id).subscribe({
      next: () => {
        this.toast.show('success', 'انتساب با موفقیت لغو شد.');
        this.userAssignments = this.userAssignments.filter(a => a.id !== id);
        this.loadAssignments();
        this.cdr.detectChanges();
      },
      error: () => this.toast.show('error', 'خطا در لغو انتساب')
    });
  }

  // --- عملیات طرف‌حساب‌های مالی (Counterparty CRUD) ---
  saveCounterparty(): void {
    if (!this.newCounterparty.name?.trim()) {
      this.toast.show('warning', 'نام طرف‌حساب الزامی است.');
      return;
    }

    if (this.newCounterparty.sheba_number && !this.shebaValidationResult?.isValid) {
      this.toast.show('warning', 'شماره شبا وارد شده نامعتبر است. لطفاً شماره ۲۴ رقمی استاندارد وارد کنید.');
      return;
    }

    const payload: Partial<Counterparty> = {
      ...this.newCounterparty,
      sheba_number: this.newCounterparty.sheba_number || ''
    };

    if (this.editingCounterparty?.id) {
      const editId = this.editingCounterparty.id;
      this.api.updateCounterparty(editId, payload).subscribe({
        next: (updated) => {
          this.toast.show('success', `طرف‌حساب «${updated.name}» بروزرسانی شد.`);
          this.editingCounterparty = null;
          this.resetCounterpartyForm();
          this.counterparties = this.counterparties.map(c => c.id === editId ? updated : c);
          this.loadCounterparties();
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.toast.show('error', err?.error?.error || 'خطا در ویرایش طرف‌حساب');
          this.cdr.detectChanges();
        }
      });
    } else {
      this.api.createCounterparty(payload).subscribe({
        next: (created) => {
          this.toast.show('success', `طرف‌حساب «${created.name}» با موفقیت ایجاد شد.`);
          this.resetCounterpartyForm();
          this.counterparties = [created, ...this.counterparties.filter(c => c.id !== created.id)];
          this.loadCounterparties();
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.toast.show('error', err?.error?.error || 'خطا در ایجاد طرف‌حساب');
          this.cdr.detectChanges();
        }
      });
    }
  }

  editCounterparty(cp: Counterparty): void {
    this.editingCounterparty = cp;
    this.newCounterparty = { ...cp };
    if (cp.sheba_number) {
      this.onShebaInput(cp.sheba_number);
    } else {
      this.shebaValidationResult = null;
      this.shebaDigitsDisplay = '';
    }
    this.cdr.detectChanges();
  }

  cancelEditCounterparty(): void {
    this.editingCounterparty = null;
    this.resetCounterpartyForm();
    this.cdr.detectChanges();
  }

  resetCounterpartyForm(): void {
    this.newCounterparty = {
      name: '',
      counterparty_type: 'driver',
      phone: '',
      national_id: '',
      bank_name: '',
      account_number: '',
      sheba_number: '',
      section: null,
      is_active: true
    };
    this.shebaValidationResult = null;
    this.shebaDigitsDisplay = '';
    this.isBankDropdownOpen = false;
    this.bankSearchQuery = '';
    this.isAccountCopied = false;
  }

  deleteCounterparty(id: number, name: string): void {
    if (!confirm(`آیا از حذف طرف‌حساب «${name}» اطمینان دارید؟`)) return;
    this.api.deleteCounterparty(id).subscribe({
      next: () => {
        this.toast.show('success', 'طرف‌حساب با موفقیت حذف شد.');
        this.counterparties = this.counterparties.filter(c => c.id !== id);
        this.loadCounterparties();
        this.cdr.detectChanges();
      },
      error: () => this.toast.show('error', 'خطا در حذف طرف‌حساب')
    });
  }
}
