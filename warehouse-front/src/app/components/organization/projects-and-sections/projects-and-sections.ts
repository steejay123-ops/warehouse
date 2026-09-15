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

export interface RoleDefinition {
  key: 'manager' | 'accountant' | 'supervisor' | 'treasury' | 'employee';
  label: string;
  shortLabel: string;
  badgeClass: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  icon: string;
  description: string;
}

export interface SectionGroupedAssignments {
  section: ProjectSection;
  roles: {
    roleDef: RoleDefinition;
    assignments: UserSectionAssignment[];
  }[];
  totalAssignedUsers: number;
}

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
  allProjectSections: ProjectSection[] = [];
  projectSections: ProjectSection[] = [];
  userAssignments: UserSectionAssignment[] = [];
  counterparties: Counterparty[] = [];
  systemUsers: User[] = [];
  selectedProjectId: number | null = null;
  isLoading = false;

  // وضعیت کارت‌های جمع‌شونده (Collapsible Cards - پیش‌فرض: همه بسته)
  expandedSectionIds: Set<number> = new Set<number>();

  // وضعیت مدال تکثیر و کپی ساختار پرسنلی (Clone Assignments)
  cloneModal: {
    isOpen: boolean;
    targetSection: ProjectSection | null;
    sourceProjectId: number | null;
    sourceSectionId: number | null;
    isSubmitting: boolean;
  } = {
    isOpen: false,
    targetSection: null,
    sourceProjectId: null,
    sourceSectionId: null,
    isSubmitting: false
  };

  // مدال تایید اختصاصی (جایگزین کامل confirm مرورگر)
  confirmModal: {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    isDanger: boolean;
    onConfirm: () => void;
  } = {
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'تایید و حذف',
    cancelText: 'انصراف',
    isDanger: true,
    onConfirm: () => {}
  };

  // فیلترهای جستجوی سریع درجا برای جداول
  projectSearchQuery: string = '';
  sectionSearchQuery: string = '';
  counterpartySearchQuery: string = '';
  assignmentSearchQuery: string = '';
  assignmentProjectFilter: number | null = null;
  assignmentRoleFilter: string = 'all';
  assignmentViewMode: 'matrix' | 'table' = 'matrix';

  // تعاریف نقش‌های ۵ گانه سازمانی
  readonly roleDefinitions: RoleDefinition[] = [
    {
      key: 'manager',
      label: 'مدیران پروژه / شرکت (تایید نهایی)',
      shortLabel: 'مدیران',
      badgeClass: 'bg-purple-100 text-purple-800 border-purple-300',
      bgClass: 'bg-purple-50/50',
      borderClass: 'border-purple-200',
      textClass: 'text-purple-900',
      icon: '👑',
      description: 'تایید هر یک از مدیران، گردش‌کار و اسناد را مستقیماً به مرحله بعد منتقل می‌کند.'
    },
    {
      key: 'accountant',
      label: 'حسابداران پروژه (بررسی و تایید مالی)',
      shortLabel: 'حسابداران',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
      bgClass: 'bg-amber-50/50',
      borderClass: 'border-amber-200',
      textClass: 'text-amber-900',
      icon: '💼',
      description: 'بررسی هزینه‌ها و تطبیق صورت‌حساب‌ها.'
    },
    {
      key: 'supervisor',
      label: 'سرپرستان بخش (بررسی عملیاتی)',
      shortLabel: 'سرپرستان',
      badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
      bgClass: 'bg-blue-50/50',
      borderClass: 'border-blue-200',
      textClass: 'text-blue-900',
      icon: '🛡️',
      description: 'نظارت عملیاتی بر ترددها، کارکرد پرسنل و ناوگان.'
    },
    {
      key: 'treasury',
      label: 'خزانه‌داران کل (پرداخت و تسویه)',
      shortLabel: 'خزانه‌داران',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      bgClass: 'bg-emerald-50/50',
      borderClass: 'border-emerald-200',
      textClass: 'text-emerald-900',
      icon: '💰',
      description: 'صدور حواله پرداخت و تسویه ریالی فاکتورها.'
    },
    {
      key: 'employee',
      label: 'کارمندان و اپراتورها (ثبت‌کنندگان)',
      shortLabel: 'کارمندان',
      badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
      bgClass: 'bg-slate-50/70',
      borderClass: 'border-slate-200',
      textClass: 'text-slate-900',
      icon: '📝',
      description: 'ثبت اطلاعات خام، کارکرد و پیش‌نویس اسناد.'
    }
  ];

  // وضعیت مدال انتساب سریع درجا (پشتیبانی از انتخاب همزمان چند کاربر)
  quickAssignState: {
    isOpen: boolean;
    section: ProjectSection | null;
    role: 'employee' | 'supervisor' | 'accountant' | 'manager' | 'treasury';
    roleDef: RoleDefinition | null;
    selectedUserIds: number[];
    userSearchQuery: string;
    isSubmitting: boolean;
  } = {
    isOpen: false,
    section: null,
    role: 'employee',
    roleDef: null,
    selectedUserIds: [],
    userSearchQuery: '',
    isSubmitting: false
  };

  // وضعیت و توابع مدال اکسل
  isExcelModalOpen = false;
  excelModalTitle = 'آپلود فایل اکسل';
  excelImportFn!: (file: File, updateExisting: boolean) => any;
  excelTemplateFn!: () => void;

  // مدل‌های فرم
  newProject: Partial<FinancialProject> = { code: '', name: '', description: '', is_active: true };
  editingProject: FinancialProject | null = null;

  newSection: {
    id?: number;
    project: number | null;
    code: string;
    name: string;
    is_active: boolean;
  } = { project: null, code: '', name: '', is_active: true };
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
    this.loadCollapsedSectionsState();
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

        const q = params['q'] || '';

        if (this.activeSubTab === 'projects') {
          this.projectSearchQuery = q;
        } else if (this.activeSubTab === 'sections') {
          this.sectionSearchQuery = q;
          if (params['project_id'] !== undefined) {
            const pId = Number(params['project_id']);
            this.selectedProjectId = (!isNaN(pId) && pId > 0) ? pId : null;
            if (this.selectedProjectId && !this.newSection.project) {
              this.newSection.project = this.selectedProjectId;
            }
          }
        } else if (this.activeSubTab === 'assignments') {
          this.assignmentSearchQuery = q;
          if (params['project_id'] !== undefined) {
            const pId = Number(params['project_id']);
            this.assignmentProjectFilter = (!isNaN(pId) && pId > 0) ? pId : null;
          } else {
            this.assignmentProjectFilter = null;
          }
          if (params['role'] !== undefined) {
            this.assignmentRoleFilter = params['role'] || 'all';
          }
          if (params['view'] !== undefined) {
            this.assignmentViewMode = params['view'] === 'table' ? 'table' : 'matrix';
          }
        } else if (this.activeSubTab === 'counterparties') {
          this.counterpartySearchQuery = q;
        }

        this.cdr.detectChanges();
      })
    );
  }

  updateQueryParams(params: Record<string, any>): void {
    this.router.navigate([], {
      queryParams: params,
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  switchSubTab(tab: 'projects' | 'sections' | 'assignments' | 'counterparties'): void {
    this.activeSubTab = tab;
    const queryParams: any = { tab };
    if (tab === 'projects') {
      queryParams['project_id'] = null;
      queryParams['role'] = null;
      queryParams['view'] = null;
      queryParams['q'] = this.projectSearchQuery || null;
    } else if (tab === 'sections') {
      queryParams['project_id'] = this.selectedProjectId || null;
      queryParams['role'] = null;
      queryParams['view'] = null;
      queryParams['q'] = this.sectionSearchQuery || null;
    } else if (tab === 'assignments') {
      queryParams['project_id'] = this.assignmentProjectFilter || null;
      queryParams['role'] = this.assignmentRoleFilter !== 'all' ? this.assignmentRoleFilter : null;
      queryParams['view'] = this.assignmentViewMode === 'table' ? 'table' : null;
      queryParams['q'] = this.assignmentSearchQuery || null;
    } else if (tab === 'counterparties') {
      queryParams['project_id'] = null;
      queryParams['role'] = null;
      queryParams['view'] = null;
      queryParams['q'] = this.counterpartySearchQuery || null;
    }
    this.router.navigate([], { queryParams, replaceUrl: true });
    this.cdr.detectChanges();
  }

  onProjectSelectChange(projectId: any): void {
    const pId = projectId ? Number(projectId) : null;
    this.selectedProjectId = pId;
    if (pId) {
      this.newSection.project = pId;
    }
    this.updateQueryParams({ project_id: pId || null });
    this.cdr.detectChanges();
  }

  onAssignmentProjectFilterChange(projectId: any): void {
    const pId = projectId ? Number(projectId) : null;
    this.assignmentProjectFilter = pId;
    this.invalidateAssignmentsCache();
    this.updateQueryParams({ project_id: pId || null });
    this.cdr.detectChanges();
  }

  onAssignmentRoleFilterChange(role: string): void {
    this.assignmentRoleFilter = role || 'all';
    this.invalidateAssignmentsCache();
    this.updateQueryParams({ role: role !== 'all' ? role : null });
    this.cdr.detectChanges();
  }

  onAssignmentViewModeChange(mode: 'matrix' | 'table'): void {
    this.assignmentViewMode = mode;
    this.updateQueryParams({ view: mode === 'table' ? 'table' : null });
    this.cdr.detectChanges();
  }

  onSearchQueryChange(tab: 'projects' | 'sections' | 'assignments' | 'counterparties', query: string): void {
    const q = query?.trim() || null;
    if (tab === 'projects') this.projectSearchQuery = query;
    else if (tab === 'sections') this.sectionSearchQuery = query;
    else if (tab === 'assignments') {
      this.assignmentSearchQuery = query;
      this.invalidateAssignmentsCache();
    }
    else if (tab === 'counterparties') this.counterpartySearchQuery = query;
    this.updateQueryParams({ q });
    this.cdr.detectChanges();
  }

  onSectionParentProjectChange(projectId: any): void {
    const pId = projectId ? Number(projectId) : null;
    this.newSection.project = pId;
    if (pId && !this.selectedProjectId) {
      this.selectedProjectId = pId;
      this.loadSections();
    }
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
            this.loadAssignments(true);
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
        } else if (url.includes('/user-section-assignments/')) {
          if (Array.isArray(data)) {
            this.userAssignments = data;
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
        if (this.activeSubTab === 'assignments') {
          if (numId && projects.some(p => p.id === numId)) {
            this.assignmentProjectFilter = numId;
          }
        } else if (this.activeSubTab === 'sections') {
          if (numId && projects.some(p => p.id === numId)) {
            this.selectedProjectId = numId;
          } else if (!this.selectedProjectId && projects.length > 0) {
            this.selectedProjectId = projects[0].id!;
          }
          if (!this.newSection.project && this.selectedProjectId) {
            this.newSection.project = this.selectedProjectId;
          }
        } else {
          if (numId && projects.some(p => p.id === numId)) {
            this.selectedProjectId = numId;
          } else if (!this.selectedProjectId && projects.length > 0) {
            this.selectedProjectId = projects[0].id!;
          }
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

  // --- ابزارهای کمکی و فیلترهای جستجو ---

  get filteredProjects(): FinancialProject[] {
    if (!this.projectSearchQuery?.trim()) return this.financialProjects;
    const q = this.projectSearchQuery.trim().toLowerCase();
    return this.financialProjects.filter(p =>
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.code && p.code.toLowerCase().includes(q)) ||
      (p.description && p.description.toLowerCase().includes(q))
    );
  }

  get filteredSections(): ProjectSection[] {
    let list = this.allProjectSections.length > 0 ? this.allProjectSections : this.projectSections;
    if (this.selectedProjectId) {
      list = list.filter(s => s.project === this.selectedProjectId);
    }
    if (!this.sectionSearchQuery?.trim()) return list;
    const q = this.sectionSearchQuery.trim().toLowerCase();
    return list.filter(s =>
      (s.name && s.name.toLowerCase().includes(q)) ||
      (s.code && s.code.toLowerCase().includes(q)) ||
      (s.project_name && s.project_name.toLowerCase().includes(q))
    );
  }

  get filteredCounterparties(): Counterparty[] {
    if (!this.counterpartySearchQuery?.trim()) return this.counterparties;
    const q = this.counterpartySearchQuery.trim().toLowerCase();
    return this.counterparties.filter(c =>
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q)) ||
      (c.national_id && c.national_id.includes(q)) ||
      (c.account_number && c.account_number.includes(q)) ||
      (c.sheba_number && c.sheba_number.includes(q)) ||
      (c.section_name && c.section_name.toLowerCase().includes(q)) ||
      (c.bank_name && c.bank_name.toLowerCase().includes(q))
    );
  }

  // --- حافظه کش محلی و متدهای بهینه‌سازی عملکرد (DOM Optimization & TrackBy) ---
  private _cachedGroupedAssignments: SectionGroupedAssignments[] | null = null;
  private _cachedFilteredAssignments: UserSectionAssignment[] | null = null;
  private _cachedAvailableUsers: User[] | null = null;
  private _lastQuickAssignStateKey: string = '';

  invalidateAssignmentsCache(): void {
    this._cachedGroupedAssignments = null;
    this._cachedFilteredAssignments = null;
    this._cachedAvailableUsers = null;
    this._lastQuickAssignStateKey = '';
  }

  trackBySectionId(index: number, group: SectionGroupedAssignments): number | string {
    return group.section.id || index;
  }

  trackByRoleKey(index: number, r: any): string {
    return r.roleDef.key;
  }

  trackByAssignmentId(index: number, a: UserSectionAssignment): number {
    return a.id || index;
  }

  trackByUserId(index: number, u: User): number {
    return u.id;
  }

  get filteredAssignments(): UserSectionAssignment[] {
    if (this._cachedFilteredAssignments) {
      return this._cachedFilteredAssignments;
    }
    let list = this.userAssignments;
    const pFilter = this.assignmentProjectFilter ? Number(this.assignmentProjectFilter) : null;
    if (pFilter) {
      list = list.filter(a => {
        if (a.project_id) return Number(a.project_id) === pFilter;
        const allSecs = this.allProjectSections.length > 0 ? this.allProjectSections : this.projectSections;
        const sec = allSecs.find(s => s.id === a.section);
        return sec ? Number(sec.project) === pFilter : false;
      });
    }
    if (this.assignmentRoleFilter && this.assignmentRoleFilter !== 'all') {
      list = list.filter(a => a.role === this.assignmentRoleFilter);
    }
    if (this.assignmentSearchQuery?.trim()) {
      const q = this.assignmentSearchQuery.trim().toLowerCase();
      list = list.filter(a =>
        (a.user_full_name && a.user_full_name.toLowerCase().includes(q)) ||
        (a.username && a.username.toLowerCase().includes(q)) ||
        (a.section_name && a.section_name.toLowerCase().includes(q)) ||
        (a.project_name && a.project_name.toLowerCase().includes(q)) ||
        (a.role_display && a.role_display.toLowerCase().includes(q))
      );
    }
    this._cachedFilteredAssignments = list;
    return list;
  }

  get groupedAssignmentsBySection(): SectionGroupedAssignments[] {
    if (this._cachedGroupedAssignments) {
      return this._cachedGroupedAssignments;
    }
    let sections = [...(this.allProjectSections.length > 0 ? this.allProjectSections : this.projectSections)];
    const pFilter = this.assignmentProjectFilter ? Number(this.assignmentProjectFilter) : null;
    if (pFilter) {
      sections = sections.filter(s => Number(s.project) === pFilter);
    }

    const query = this.assignmentSearchQuery?.trim().toLowerCase();
    const result: SectionGroupedAssignments[] = [];

    for (const sec of sections) {
      const secAssignments = this.userAssignments.filter(a => {
        const secId = typeof a.section === 'object' ? (a.section as any)?.id : a.section;
        return Number(secId) === Number(sec.id) && a.is_active !== false;
      });

      let rolesData = this.roleDefinitions.map(roleDef => {
        const assigned = secAssignments.filter(a => a.role === roleDef.key);
        return {
          roleDef,
          assignments: assigned
        };
      });

      if (this.assignmentRoleFilter && this.assignmentRoleFilter !== 'all') {
        rolesData = rolesData.filter(r => r.roleDef.key === this.assignmentRoleFilter);
      }

      if (query) {
        const matchesSection = (sec.name && sec.name.toLowerCase().includes(query)) ||
                               (sec.code && sec.code.toLowerCase().includes(query)) ||
                               (sec.project_name && sec.project_name.toLowerCase().includes(query));
        const hasMatchingUser = secAssignments.some(a =>
          (a.user_full_name && a.user_full_name.toLowerCase().includes(query)) ||
          (a.username && a.username.toLowerCase().includes(query)) ||
          (a.role_display && a.role_display.toLowerCase().includes(query))
        );
        if (!matchesSection && !hasMatchingUser) {
          continue;
        }
      }

      result.push({
        section: sec,
        roles: rolesData,
        totalAssignedUsers: secAssignments.length
      });
    }

    this._cachedGroupedAssignments = result;
    return result;
  }

  get availableUsersForQuickAssign(): User[] {
    if (!this.quickAssignState.section) return this.systemUsers;
    const currentSectionId = Number(this.quickAssignState.section.id);
    const currentRole = this.quickAssignState.role;
    const q = this.quickAssignState.userSearchQuery?.trim().toLowerCase() || '';
    const currentKey = `${currentSectionId}_${currentRole}_${q}_${this.userAssignments.length}_${this.systemUsers.length}`;

    if (this._cachedAvailableUsers && this._lastQuickAssignStateKey === currentKey) {
      return this._cachedAvailableUsers;
    }

    const existingUserIds = new Set(
      this.userAssignments
        .filter(a => {
          const secId = typeof a.section === 'object' ? (a.section as any)?.id : a.section;
          return Number(secId) === currentSectionId && a.role === currentRole && a.is_active !== false;
        })
        .map(a => Number(typeof a.user === 'object' ? (a.user as any)?.id : a.user))
    );
    let users = this.systemUsers.filter(u => !existingUserIds.has(Number(u.id)));
    if (q) {
      users = users.filter(u =>
        (u.first_name && u.first_name.toLowerCase().includes(q)) ||
        (u.last_name && u.last_name.toLowerCase().includes(q)) ||
        (u.username && u.username.toLowerCase().includes(q))
      );
    }
    this._cachedAvailableUsers = users;
    this._lastQuickAssignStateKey = currentKey;
    return users;
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
    } else if (this.activeSubTab === 'assignments') {
      this.api.exportUserSectionAssignmentsExcel(this.selectedProjectId || undefined).subscribe({
        next: (blob) => {
          this.triggerDownloadBlob(blob, 'user_assignments.xlsx');
          this.toast.show('success', 'فایل اکسل انتساب پرسنل و نقش‌ها با موفقیت دانلود شد.');
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.toast.show('error', 'خطا در دانلود فایل اکسل انتساب پرسنل');
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

  getExportTooltip(): string {
    switch (this.activeSubTab) {
      case 'projects': return 'خروجی اکسل پروژه‌های مالی';
      case 'sections': return 'خروجی اکسل بخش‌ها و دپارتمان‌ها';
      case 'assignments': return 'خروجی اکسل ماتریس انتساب کاربران و نقش‌ها';
      case 'counterparties': return 'خروجی اکسل طرف‌حساب‌های مالی';
      default: return 'خروجی فایل اکسل';
    }
  }

  getImportTooltip(): string {
    switch (this.activeSubTab) {
      case 'projects': return 'ورودی و ثبت پروژه‌ها از فایل اکسل';
      case 'sections': return 'ورودی و ثبت بخش‌ها از فایل اکسل';
      case 'assignments': return 'ورودی و ثبت انتساب پرسنل از فایل اکسل';
      case 'counterparties': return 'ورودی و ثبت طرف‌حساب‌ها از فایل اکسل';
      default: return 'ورودی فایل اکسل';
    }
  }

  openImportModal(): void {
    if (this.activeSubTab === 'projects') {
      this.excelModalTitle = 'آپلود و ثبت دسته‌جمعی پروژه‌ها از اکسل';
      this.excelImportFn = (file: File) => this.api.importFinancialProjectsExcel(file);
      this.excelTemplateFn = () => this.downloadProjectsTemplate();
    } else if (this.activeSubTab === 'sections') {
      this.excelModalTitle = 'آپلود و ثبت دسته‌جمعی بخش‌های پروژه از اکسل';
      this.excelImportFn = (file: File) => this.api.importProjectSectionsExcel(file);
      this.excelTemplateFn = () => this.downloadSectionsTemplate();
    } else if (this.activeSubTab === 'assignments') {
      this.excelModalTitle = 'آپلود و ثبت دسته‌جمعی انتساب پرسنل و نقش‌ها از اکسل';
      this.excelImportFn = (file: File) => this.api.importUserSectionAssignmentsExcel(file);
      this.excelTemplateFn = () => this.downloadAssignmentsTemplate();
    } else {
      this.excelModalTitle = 'آپلود و ثبت دسته‌جمعی طرف‌حساب‌های مالی از اکسل';
      this.excelImportFn = (file: File) => this.api.importCounterpartiesExcel(file);
      this.excelTemplateFn = () => this.downloadCounterpartyTemplate();
    }
    this.isExcelModalOpen = true;
    this.cdr.detectChanges();
  }

  downloadProjectsTemplate(): void {
    this.api.downloadFinancialProjectsTemplate().subscribe({
      next: (blob) => {
        this.triggerDownloadBlob(blob, 'projects_template.xlsx');
        this.toast.show('success', 'قالب اکسل پروژه‌ها با موفقیت دانلود شد.');
      },
      error: () => this.toast.show('error', 'خطا در دریافت قالب اکسل پروژه‌ها')
    });
  }

  downloadSectionsTemplate(): void {
    this.api.downloadProjectSectionsTemplate().subscribe({
      next: (blob) => {
        this.triggerDownloadBlob(blob, 'sections_template.xlsx');
        this.toast.show('success', 'قالب اکسل بخش‌ها با موفقیت دانلود شد.');
      },
      error: () => this.toast.show('error', 'خطا در دریافت قالب اکسل بخش‌ها')
    });
  }

  downloadAssignmentsTemplate(): void {
    this.api.downloadUserSectionAssignmentsTemplate().subscribe({
      next: (blob) => {
        this.triggerDownloadBlob(blob, 'assignments_template.xlsx');
        this.toast.show('success', 'قالب اکسل انتساب پرسنل با موفقیت دانلود شد.');
      },
      error: () => this.toast.show('error', 'خطا در دریافت قالب اکسل انتساب پرسنل')
    });
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
    this.api.getProjectSections().subscribe({
      next: (sections) => {
        this.allProjectSections = sections;
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

  loadAssignments(forceFresh: boolean = false): void {
    this.api.getUserSectionAssignments(undefined, forceFresh).subscribe({
      next: (assignments) => {
        this.userAssignments = assignments;
        this.invalidateAssignmentsCache();
        this.cdr.detectChanges();
      },
      error: () => {
        this.userAssignments = [];
        this.invalidateAssignmentsCache();
        this.cdr.detectChanges();
      }
    });
  }

  loadCounterparties(): void {
    this.api.getCounterparties().subscribe({
      next: (cp) => {
        this.counterparties = cp;
        this.cdr.detectChanges();
      },
      error: () => {
        this.counterparties = [];
        this.cdr.detectChanges();
      }
    });
  }

  loadUsers(): void {
    this.accountsHttp.getUsers().subscribe({
      next: (users) => {
        this.systemUsers = users;
        this.cdr.detectChanges();
      },
      error: () => {
        this.systemUsers = [];
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
    this.openConfirmDialog({
      title: 'حذف پروژه مالی و عملیاتی',
      message: `آیا از حذف پروژه «${name}» اطمینان دارید؟ تمامی بخش‌های سازمانی، انتساب‌ها و اسناد تابعه این پروژه نیز حذف یا غیرفعال خواهند شد.`,
      confirmText: 'بله، پروژه حذف شود',
      cancelText: 'انصراف',
      isDanger: true,
      onConfirm: () => {
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
    });
  }

  // --- عملیات بخش‌ها (Section CRUD) ---
  saveSection(): void {
    const targetProjectId = this.newSection.project || this.selectedProjectId;
    if (!targetProjectId) {
      this.toast.show('warning', 'لطفاً ابتدا پروژه والد را انتخاب کنید.');
      return;
    }
    if (!this.newSection.code?.trim() || !this.newSection.name?.trim()) {
      this.toast.show('warning', 'لطفاً کد و نام بخش را وارد نمایید.');
      return;
    }

    const payload = {
      code: this.newSection.code.trim(),
      name: this.newSection.name.trim(),
      is_active: this.newSection.is_active !== false,
      project: targetProjectId
    };

    if (this.editingSection?.id) {
      const editId = this.editingSection.id;
      this.api.updateProjectSection(editId, payload).subscribe({
        next: (updated) => {
          this.toast.show('success', `بخش «${updated.name}» بروزرسانی شد.`);
          this.editingSection = null;
          this.newSection = { project: this.selectedProjectId, code: '', name: '', is_active: true };
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
          this.newSection = { project: targetProjectId, code: '', name: '', is_active: true };
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
    this.newSection = {
      id: sec.id,
      project: sec.project ?? this.selectedProjectId,
      code: sec.code,
      name: sec.name,
      is_active: sec.is_active !== false
    };
  }

  cancelEditSection(): void {
    this.editingSection = null;
    this.newSection = { project: this.selectedProjectId, code: '', name: '', is_active: true };
  }

  deleteSection(id: number, name: string): void {
    this.openConfirmDialog({
      title: 'حذف بخش سازمانی',
      message: `آیا از حذف بخش سازمانی «${name}» اطمینان دارید؟ تمامی انتساب‌های کاربران به این بخش نیز حذف خواهند شد.`,
      confirmText: 'بله، بخش حذف شود',
      cancelText: 'انصراف',
      isDanger: true,
      onConfirm: () => {
        this.api.deleteProjectSection(id).subscribe({
          next: () => {
            this.toast.show('success', 'بخش با موفقیت حذف شد.');
            this.allProjectSections = this.allProjectSections.filter(s => s.id !== id);
            this.projectSections = this.projectSections.filter(s => s.id !== id);
            this.loadSections();
            this.cdr.detectChanges();
          },
          error: () => this.toast.show('error', 'خطا در حذف بخش')
        });
      }
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

  deleteAssignment(id: number, userOrRoleInfo?: string): void {
    const desc = userOrRoleInfo ? ` (${userOrRoleInfo})` : '';
    this.openConfirmDialog({
      title: 'لغو انتساب نقش سازمانی',
      message: `آیا از لغو این انتساب کاربر به بخش سازمانی${desc} اطمینان دارید؟`,
      confirmText: 'لغو انتساب',
      cancelText: 'انصراف',
      isDanger: true,
      onConfirm: () => {
        // ۱. حذف آنی و خوش‌بینانه از آرایه محلی
        this.userAssignments = this.userAssignments.filter(a => a.id !== id);
        this.invalidateAssignmentsCache();
        this.cdr.detectChanges();

        this.api.deleteUserSectionAssignment(id).subscribe({
          next: () => {
            this.toast.show('success', 'انتساب با موفقیت لغو شد.');
            // ۲. نامعتبرسازی کش و استعلام مستقیم بدون کش SWR از سرور
            this.offlineSync.invalidateCache('user-section-assignments');
            this.loadAssignments(true);
            this.cdr.detectChanges();
          },
          error: () => {
            this.toast.show('error', 'خطا در لغو انتساب');
            this.loadAssignments(true);
            this.cdr.detectChanges();
          }
        });
      }
    });
  }

  getRoleDef(key: string): RoleDefinition {
    return this.roleDefinitions.find(r => r.key === key) || this.roleDefinitions[4];
  }

  getUserInitials(name?: string, username?: string): string {
    const clean = (name || username || '').trim();
    if (!clean) return '؟';
    const parts = clean.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + ' ' + parts[1][0]);
    }
    return clean.slice(0, 2);
  }

  // --- متدهای انتساب سریع و گروهی پرسنل به بخش‌ها ---
  openQuickAssignModal(section: ProjectSection, roleKey: 'employee' | 'supervisor' | 'accountant' | 'manager' | 'treasury'): void {
    const roleDef = this.getRoleDef(roleKey);
    this.quickAssignState = {
      isOpen: true,
      section,
      role: roleKey,
      roleDef,
      selectedUserIds: [],
      userSearchQuery: '',
      isSubmitting: false
    };
    this._cachedAvailableUsers = null;
    this._lastQuickAssignStateKey = '';
    this.cdr.detectChanges();
  }

  closeQuickAssignModal(): void {
    this.quickAssignState.isOpen = false;
    this.quickAssignState.section = null;
    this.quickAssignState.selectedUserIds = [];
    this.quickAssignState.userSearchQuery = '';
    this.quickAssignState.isSubmitting = false;
    this._cachedAvailableUsers = null;
    this._lastQuickAssignStateKey = '';
    this.cdr.detectChanges();
  }

  toggleUserSelection(userId: number): void {
    const idx = this.quickAssignState.selectedUserIds.indexOf(userId);
    if (idx >= 0) {
      this.quickAssignState.selectedUserIds.splice(idx, 1);
    } else {
      this.quickAssignState.selectedUserIds.push(userId);
    }
  }

  selectAllAvailableUsers(): void {
    const available = this.availableUsersForQuickAssign;
    const currentSet = new Set(this.quickAssignState.selectedUserIds);
    available.forEach(u => currentSet.add(u.id));
    this.quickAssignState.selectedUserIds = Array.from(currentSet);
  }

  deselectAllUsers(): void {
    this.quickAssignState.selectedUserIds = [];
  }

  isUserSelected(userId: number): boolean {
    return this.quickAssignState.selectedUserIds.includes(userId);
  }

  submitQuickAssign(): void {
    if (!this.quickAssignState.section || this.quickAssignState.selectedUserIds.length === 0) {
      this.toast.show('warning', 'لطفاً حداقل یک کاربر را برای انتساب انتخاب کنید.');
      return;
    }

    const section = this.quickAssignState.section;
    const userIds = [...this.quickAssignState.selectedUserIds];
    const role = this.quickAssignState.role;
    const roleDef = this.quickAssignState.roleDef;

    this.quickAssignState.isSubmitting = true;
    this.api.bulkAssignUsersToSection({
      section_id: section.id!,
      user_ids: userIds,
      role: role
    }).subscribe({
      next: (createdAssignments) => {
        const count = createdAssignments.length;
        this.toast.show('success', `${count} کاربر با موفقیت به عنوان «${roleDef?.shortLabel || 'نقش'}» در بخش «${section.name}» منتسب شدند.`);

        // ۱. ادغام آنی و خوش‌بینانه انتساب‌های جدید در لیست محلی
        const createdIds = new Set(createdAssignments.map(a => a.id));
        this.userAssignments = [
          ...createdAssignments,
          ...this.userAssignments.filter(a => !createdIds.has(a.id))
        ];
        this.invalidateAssignmentsCache();

        // ۲. بستن فوری مدال و پاکسازی
        this.closeQuickAssignModal();
        this.cdr.detectChanges();

        // ۳. نامعتبرسازی کش SWR و استعلام مستقیم بدون کش از سرور
        this.offlineSync.invalidateCache('user-section-assignments');
        this.loadAssignments(true);
      },
      error: (err) => {
        this.quickAssignState.isSubmitting = false;
        this.toast.show('error', err?.error?.error || 'خطا در انتساب کاربران');
        this.cdr.detectChanges();
      }
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
    this.openConfirmDialog({
      title: 'حذف طرف‌حساب مالی',
      message: `آیا از حذف طرف‌حساب مالی «${name}» اطمینان دارید؟`,
      confirmText: 'بله، حذف شود',
      cancelText: 'انصراف',
      isDanger: true,
      onConfirm: () => {
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
    });
  }

  // --- سیستم دیالوگ تایید اختصاصی درون‌برنامه‌ای ---
  openConfirmDialog(options: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
    onConfirm: () => void;
  }): void {
    this.confirmModal = {
      isOpen: true,
      title: options.title,
      message: options.message,
      confirmText: options.confirmText || 'تایید و حذف',
      cancelText: options.cancelText || 'انصراف',
      isDanger: options.isDanger !== false,
      onConfirm: options.onConfirm
    };
    this.cdr.detectChanges();
  }

  closeConfirmDialog(): void {
    this.confirmModal.isOpen = false;
    this.cdr.detectChanges();
  }

  executeConfirmDialog(): void {
    const action = this.confirmModal.onConfirm;
    this.closeConfirmDialog();
    if (action) {
      action();
    }
  }

  // --- مدیریت کارت‌های جمع‌شونده (Collapsible Sections - پیش‌فرض: بسته بودن تمامی کارت‌ها) ---
  private loadCollapsedSectionsState(): void {
    try {
      const stored = localStorage.getItem('warehouse_expanded_sections');
      if (stored) {
        const ids: number[] = JSON.parse(stored);
        this.expandedSectionIds = new Set<number>(ids);
      } else {
        // پیش‌فرض: لیست خالی، یعنی تمامی کارت‌ها به صورت پیش‌فرض بسته هستند
        this.expandedSectionIds = new Set<number>();
      }
    } catch {
      this.expandedSectionIds = new Set<number>();
    }
  }

  private saveCollapsedSectionsState(): void {
    try {
      localStorage.setItem('warehouse_expanded_sections', JSON.stringify(Array.from(this.expandedSectionIds)));
    } catch {
      // Ignore
    }
  }

  toggleSectionCollapse(sectionId: number, event?: Event): void {
    event?.stopPropagation();
    if (this.expandedSectionIds.has(sectionId)) {
      this.expandedSectionIds.delete(sectionId);
    } else {
      this.expandedSectionIds.add(sectionId);
    }
    this.saveCollapsedSectionsState();
    this.cdr.detectChanges();
  }

  isSectionCollapsed(sectionId: number): boolean {
    return !this.expandedSectionIds.has(sectionId);
  }

  expandAllSections(): void {
    const allSecs = this.allProjectSections.length > 0 ? this.allProjectSections : this.projectSections;
    const validIds = allSecs.map(s => s.id).filter((id): id is number => typeof id === 'number');
    this.expandedSectionIds = new Set<number>(validIds);
    this.saveCollapsedSectionsState();
    this.cdr.detectChanges();
  }

  collapseAllSections(): void {
    this.expandedSectionIds.clear();
    this.saveCollapsedSectionsState();
    this.cdr.detectChanges();
  }

  hasManagerAssigned(sGroup: SectionGroupedAssignments): boolean {
    const managerRole = sGroup.roles.find(r => r.roleDef.key === 'manager');
    return (managerRole?.assignments?.length || 0) > 0;
  }

  // --- مدیریت تکثیر و کپی ساختار پرسنلی (Clone Assignments) ---
  openCloneModal(targetSection: ProjectSection, event?: Event): void {
    event?.stopPropagation();
    this.cloneModal = {
      isOpen: true,
      targetSection,
      sourceProjectId: null,
      sourceSectionId: null,
      isSubmitting: false
    };
    this.cdr.detectChanges();
  }

  closeCloneModal(): void {
    this.cloneModal.isOpen = false;
    this.cloneModal.targetSection = null;
    this.cloneModal.sourceSectionId = null;
    this.cloneModal.isSubmitting = false;
    this.cdr.detectChanges();
  }

  getAvailableSourceSectionsForClone(): ProjectSection[] {
    const targetId = this.cloneModal.targetSection?.id;
    let list = this.allProjectSections.length > 0 ? this.allProjectSections : this.projectSections;
    list = list.filter(s => s.id !== targetId);
    if (this.cloneModal.sourceProjectId) {
      list = list.filter(s => s.project === this.cloneModal.sourceProjectId);
    }
    return list;
  }

  getSourceSectionAssignmentCount(sectionId: number): number {
    return this.userAssignments.filter(a => a.section === sectionId && a.is_active).length;
  }

  getSelectedSourceSectionDetails(): { total: number; roleCounts: { [key: string]: number } } {
    if (!this.cloneModal.sourceSectionId) return { total: 0, roleCounts: {} };
    const assignments = this.userAssignments.filter(a => a.section === this.cloneModal.sourceSectionId && a.is_active);
    const roleCounts: { [key: string]: number } = {};
    for (const a of assignments) {
      roleCounts[a.role] = (roleCounts[a.role] || 0) + 1;
    }
    return { total: assignments.length, roleCounts };
  }

  executeCloneAssignments(): void {
    if (!this.cloneModal.targetSection?.id || !this.cloneModal.sourceSectionId) {
      this.toast.show('warning', 'لطفاً بخش مبدأ را جهت کپی انتخاب کنید.');
      return;
    }

    this.cloneModal.isSubmitting = true;
    const targetId = this.cloneModal.targetSection.id;
    this.api.cloneSectionAssignments(targetId, this.cloneModal.sourceSectionId).subscribe({
      next: (res) => {
        this.toast.show('success', res?.message || 'ساختار پرسنلی با موفقیت کپی شد.');
        this.loadAssignments();
        // باز کردن کارت بخش مقصد تا کاربر نتیجه را بلافاصله ببیند
        this.expandedSectionIds.add(targetId);
        this.saveCollapsedSectionsState();
        this.closeCloneModal();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.cloneModal.isSubmitting = false;
        this.toast.show('error', err?.error?.error || 'خطا در کپی ساختار پرسنلی');
        this.cdr.detectChanges();
      }
    });
  }
}
