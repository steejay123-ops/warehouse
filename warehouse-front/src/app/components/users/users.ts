import { Component, OnInit, OnDestroy, ChangeDetectorRef, HostListener, computed, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '../../services/state.service';
import { ToastService } from '../../services/toast.service';
import { AuthService } from '../../core/auth/auth.service';
import { AppPersonaService } from '../../core/services/app-persona.service';
import { ModuleRegistryService } from '../../core/modules/module-registry.service';
import { AccountsHttpService, User, Role, Permission, ImportResult } from '../../core/http/accounts-http.service';
import { WarehouseHttpService } from '../../core/http/warehouse-http.service';
import { ClickOutsideDirective } from '../../shared/directives/click-outside.directive';
import { IdCards } from '../id-cards/id-cards';
import { ConfirmDialogService } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { ExcelImportModal } from '../../shared/components/excel-import-modal/excel-import-modal';
import { SmartDeleteModalComponent } from '../../shared/components/smart-delete-modal/smart-delete-modal';
import { AvatarCropperModal } from '../../shared/components/avatar-cropper-modal/avatar-cropper-modal';
import { environment } from '../../../environments/environment';
import { Observable, Subject, Subscription, forkJoin } from 'rxjs';
import { debounceTime, finalize } from 'rxjs/operators';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-users',
  imports: [CommonModule, FormsModule, ClickOutsideDirective, IdCards, ExcelImportModal, SmartDeleteModalComponent, AvatarCropperModal],
  templateUrl: './users.html',
  styleUrl: './users.css'
})
export class Users implements OnInit, OnDestroy {
  @ViewChild(IdCards) idCardsComponent?: IdCards;
  activeTab = 'users';
  activeRoleTab = 'custom';
  activePermTab = 'WH_AUDIT';
  userRoleModalTab: 'all' | 'warehouse' | 'finance' | 'global' = 'warehouse';
  searchQuery = '';
  searchSubject = new Subject<string>();
  private searchSub?: Subscription;

  // Pagination & Filtering
  currentPage = 1;
  pageSize = 24;
  visibleCount = 24;
  pageSizeOptions = [12, 24, 48, 96];
  userStatusFilter: 'all' | 'active' | 'inactive' | 'no_warehouse' | 'superuser' = 'all';
  userRoleFilter: number | 'ALL' = 'ALL';
  userWarehouseFilter: number | string | 'ALL' = 'ALL';
  selectedUserIds = new Set<number>();
  activePopoverRoleId: number | null = null;
  userViewMode: 'grid' | 'table' = 'grid';
  roleViewMode: 'tree' | 'table' = 'tree';
  activeRolePresetId: string | null = null;

  readonly ROLE_COLORS = [
    '#4f46e5', // نیلی ایندیگو
    '#7c3aed', // بنفش سلطنتی
    '#059669', // سبز زمردی
    '#0284c7', // آبی آسمانی
    '#d97706', // کهربایی گرم
    '#dc2626', // یاقوتی / سرخ
    '#e11d48', // رز متالیک
    '#475569', // سربی تیره
  ];

  setRoleColor(color: string) {
    this.roleForm.color = color;
    this.cdr.detectChanges();
  }

  setViewMode(mode: 'grid' | 'table') {
    this.userViewMode = mode;
    try {
      localStorage.setItem('users_view_mode', mode);
    } catch (e) {}
    this.cdr.detectChanges();
  }

  setRoleViewMode(mode: 'tree' | 'table') {
    this.roleViewMode = mode;
    try {
      localStorage.setItem('roles_view_mode', mode);
    } catch (e) {}
    this.cdr.detectChanges();
  }

  roleSearchQuery: string = '';

  onRoleSearchChange(query: string) {
    this.roleSearchQuery = query ? query.trim() : '';
    this.cdr.detectChanges();
  }

  get displayedRoles(): any[] {
    const roles = this.allRoles;
    if (!this.roleSearchQuery) return roles;
    const q = this.roleSearchQuery.toLowerCase();
    return roles.filter((r: any) => 
      (r.name && r.name.toLowerCase().includes(q)) ||
      (r.title && r.title.toLowerCase().includes(q))
    );
  }

  get displayedRootRoles(): any[] {
    if (!this.roleSearchQuery) return this.rootRoles;
    const q = this.roleSearchQuery.toLowerCase();
    return this.allRoles.filter((r: any) => 
      (r.name && r.name.toLowerCase().includes(q)) ||
      (r.title && r.title.toLowerCase().includes(q))
    );
  }

  printIdCards() {
    if (this.idCardsComponent) {
      this.idCardsComponent.executeCardPrint();
    }
    this.cdr.detectChanges();
  }

  openIdCardsSheetPreview() {
    if (this.idCardsComponent) {
      this.idCardsComponent.openSheetPreviewModal();
    }
    this.cdr.detectChanges();
  }

  openIdCardsExportModal() {
    if (this.idCardsComponent) {
      this.idCardsComponent.openExportModal();
    }
    this.cdr.detectChanges();
  }

  get idCardsPrintableCount(): number {
    return this.idCardsComponent?.printableUsers?.length || 0;
  }

  get isIdCardsExporting(): boolean {
    return this.idCardsComponent?.isExportingImage || false;
  }

  // Memoization Caches (O(1) lookups during change detection)
  roleChildrenMap = new Map<number, any[]>();
  roleUsersCountMap = new Map<number, number>();
  userRolesMap = new Map<number, { name: string, color: string }[]>();
  primaryRoleMap = new Map<number, { name: string, color: string }>();
  permIdToCodenameMap = new Map<number, string>();
  cachedRootRoles: any[] = [];

  openMenuId: string | null = null;

  isUserModalOpen = false;
  isRoleModalOpen = false;
  isDeleteModalOpen = false;
  isAvatarCropperOpen = false;
  targetUserForAvatar: any = null;
  isSavingUserAvatar = false;
  entityToDelete: any = null;
  deleteImpactUrl = '';
  deleteType: 'user' | 'role' = 'user';
  isDeleting = false;
  deleteErrorMessage = '';

  // Role Form
  editingRole: any = null;
  roleForm = {
    id: null as number | null, name: '', title: '', parent: null as number | null, color: '#94a3b8', permissions: [] as number[], user_ids: [] as number[]
  };
  roleMemberSearchQuery: string = '';
  isRoleMembersExpanded: boolean = false;

  // User Form (با حذف فیلدهای موهومی انقضا و افزودن کلمه عبور و آواتار تراکنشی)
  editingUser: any = null;
  userForm = {
    id: null as number | null, first_name: '', last_name: '', national_code: '', username: '', phone_number: '', password: '',
    operational_zone: '', supervisor: null as number | null, address: '', company: '', email: '', avatar: null as string | null,
    _pendingAvatarBlob: null as Blob | null, _pendingAvatarDelete: false, blood_type: '', emergency_contact: '', groups: [] as number[],
    assigned_warehouses: [] as number[], date_joined: '', last_login: '', is_active: true, is_superuser: false
  };

  // Quick Role Presets / Templates for One-Click Permission Granting
  readonly ROLE_PRESETS = [
    // ─── دسته ۱: انبارگردانی و اسناد (Inventory Audit) ───
    {
      id: 'counter',
      title: 'انبارگردان / شمارشگر کور',
      category: 'inventory',
      categoryTitle: 'انبارگردانی',
      color: '#0284c7',
      icon: '🔢',
      description: 'میزکار شمارش کور فیزیکی، اسکن بارکد و ثبت تگ‌ها بدون دسترسی به مبالغ مالی',
      permissionCodenames: [
        'view_sys_counter', 'can_act_as_counter'
      ]
    },
    {
      id: 'count_supervisor',
      title: 'سرپرست شمارش',
      category: 'inventory',
      categoryTitle: 'انبارگردانی',
      color: '#2563eb',
      icon: '📋',
      description: 'مدیریت شمارشگران میدانی، تخصیص کالا و زون‌ها، مقایسه با موجودی دفتری و صدور دستور بازشماری',
      permissionCodenames: [
        'view_sys_supervisor', 'can_act_as_supervisor', 'view_sys_recounts', 'perm_rec_recount',
        'view_wh_dispatch', 'perm_rec_dispatch', 'view_sys_counter'
      ]
    },
    {
      id: 'doc_worker',
      title: 'کارشناس اسناد و کالا',
      category: 'inventory',
      categoryTitle: 'انبارگردانی',
      color: '#0d9488',
      icon: '📑',
      description: 'ورود اطلاعات فاکتورها، پکینگ‌لیست‌ها، بارگذاری عکس‌ها و انطباق اسناد در کارتابل اسناد',
      permissionCodenames: [
        'view_wh_docs', 'can_act_as_doc_worker', 'view_wh_labels', 'view_wh_dispatch'
      ]
    },
    {
      id: 'doc_supervisor',
      title: 'سرپرست مالی انبار',
      category: 'inventory',
      categoryTitle: 'انبارگردانی',
      color: '#0891b2',
      icon: '⚖️',
      description: 'ممیزی کارتابل اسناد، تایید ارزی و ریالی فاکتورها، مهر و امضا و تایید فیدهای گمرکی و MT',
      permissionCodenames: [
        'view_wh_doc_approvals', 'perm_doc_approve_action', 'view_wh_customs',
        'view_wh_feed_approvals', 'perm_feed_approve_action', 'can_act_as_doc_supervisor', 'view_wh_docs'
      ]
    },
    {
      id: 'finance_manager',
      title: 'مدیر مالی انبارگردانی',
      category: 'inventory',
      categoryTitle: 'انبارگردانی',
      color: '#059669',
      icon: '📊',
      description: 'ممیزی ارزش ریالی کل انبار، ارزیابی مالی مغایرت‌های کسری و اضافات و امضای صورتجلسه مالی',
      permissionCodenames: [
        'view_wh_customs', 'view_wh_audit', 'view_sys_reports', 'view_sys_manager_review',
        'perm_doc_approve_action'
      ]
    },
    {
      id: 'count_manager',
      title: 'مدیر شمارش و انبار',
      category: 'inventory',
      categoryTitle: 'انبارگردانی',
      color: '#7c3aed',
      icon: '📦',
      description: 'فرماندهی عملیاتی انبارگردانی، داوری نهایی مغایرت‌ها، فریز انبار و بستن قطعی دوره انبارگردانی',
      permissionCodenames: [
        'view_sys_manager_review', 'can_act_as_manager', 'perm_inventory_finalize',
        'perm_wh_freeze', 'view_wh_dashboard', 'view_sys_recounts', 'view_wh_docs'
      ]
    },

    // ─── دسته ۲: حسابداری، کارگاه و کارکرد (Accounting & Workshop) ───
    {
      id: 'workshop_operator',
      title: 'کارمند کارگاه',
      category: 'accounting',
      categoryTitle: 'حسابداری و کارگاه',
      color: '#64748b',
      icon: '👤',
      description: 'ثبت روزانه کارت‌های تردد، حضور و غیاب پرسنل و ساعات کارکرد و سرویس ماشین‌آلات و ناوگان',
      permissionCodenames: [
        'view_sys_personnel_attendance', 'view_sys_fleet_attendance', 'view_wh_attendance', 'can_act_as_operator'
      ]
    },
    {
      id: 'workshop_supervisor',
      title: 'سرپرست کارگاه',
      category: 'accounting',
      categoryTitle: 'حسابداری و کارگاه',
      color: '#3b82f6',
      icon: '🦺',
      description: 'کنترل کارکردها و تایید مرحله اول (عملیاتی و میدانی) کارکرد ماهانه پرسنل و ناوگان',
      permissionCodenames: [
        'perm_approve_personnel_supervisor', 'perm_approve_fleet_supervisor',
        'view_sys_personnel_attendance', 'view_sys_fleet_attendance', 'view_wh_attendance',
        'view_sys_supervisor', 'can_act_as_supervisor'
      ]
    },
    {
      id: 'accountant',
      title: 'حسابدار',
      category: 'accounting',
      categoryTitle: 'حسابداری و کارگاه',
      color: '#10b981',
      icon: '💳',
      description: 'محاسبات حقوق و دستمزد ماهانه، کسر بیمه و مالیات، تسویه پیمانکاران ناوگان و تایید مرحله مالی',
      permissionCodenames: [
        'view_sys_personnel', 'view_sys_payroll', 'view_sys_fleet_settlement',
        'perm_approve_personnel_finance', 'perm_approve_fleet_finance', 'can_act_as_accountant'
      ]
    },
    {
      id: 'company_manager',
      title: 'مدیر شرکت',
      category: 'accounting',
      categoryTitle: 'حسابداری و کارگاه',
      color: '#8b5cf6',
      icon: '👑',
      description: 'بررسی گزارش‌های مالی و حقوق کارگاه‌ها، قفل دوره ماهانه، تصویب و صدور مجوز پرداخت بانکی',
      permissionCodenames: [
        'view_sys_dashboard', 'view_sys_reports', 'view_sys_personnel', 'view_sys_payroll',
        'view_sys_fleet_settlement', 'perm_approve_personnel_manager', 'perm_approve_fleet_manager',
        'perm_lock_work_period', 'perm_manager_payment_authorize', 'can_act_as_manager'
      ]
    },
    {
      id: 'treasury',
      title: 'خزانه‌دار و پرداخت',
      category: 'accounting',
      categoryTitle: 'حسابداری و کارگاه',
      color: '#d97706',
      icon: '🏦',
      description: 'کارتابل خزانه‌داری، صدور فایل پرداخت پایا/چک، ثبت واریز قطعی و صدور رسید تسویه',
      permissionCodenames: [
        'view_sys_treasury', 'perm_treasury_disburse_action', 'view_sys_payroll', 'view_sys_personnel'
      ]
    },

    // ─── دسته ۳: مدیریت و کلان سیستم (Infrastructure & SOC) ───
    {
      id: 'admin_all',
      title: 'مدیر کل سیستم (سوپریوزر)',
      category: 'system',
      categoryTitle: 'کلان سیستم',
      color: '#4f46e5',
      icon: '⚡',
      description: 'اعطای ۱۰۰٪ تمام دسترسی‌های سیستمی، عملیاتی، مالی، اتاق فرماندهی مرکز عملیات و بازیابی',
      permissionCodenames: 'ALL'
    }
  ];

  activePresetCategory: 'all' | 'inventory' | 'accounting' | 'system' = 'all';
  isPresetsExpanded = false;

  getActivePresetTitle(): string {
    const p = this.ROLE_PRESETS.find(x => x.id === this.activeRolePresetId);
    return p ? p.title : '';
  }

  hasInventoryModule(): boolean {
    return this.systemPermissionGroups.some(g => g.key === 'WH_AUDIT');
  }

  hasAccountingModule(): boolean {
    return this.systemPermissionGroups.some(g => g.key === 'ACCOUNTING_FINANCE');
  }

  get availableRolePresets() {
    return this.ROLE_PRESETS.filter(p => {
      if (p.category === 'inventory' && !this.hasInventoryModule()) return false;
      if (p.category === 'accounting' && !this.hasAccountingModule()) return false;
      return true;
    });
  }

  get filteredRolePresets() {
    const list = this.availableRolePresets;
    if (this.activePresetCategory === 'all') {
      return list;
    }
    return list.filter(p => p.category === this.activePresetCategory);
  }

  // عناوین کوتاه و مختصر جهت نمایش بهینه در چیپ‌های دسترسی تفکیکی
  readonly SHORT_PERMISSION_NAMES: Record<string, string> = {
    // کارکرد و پرسنل و ناوگان
    'view_sys_personnel_attendance': 'کارکرد پرسنل',
    'view_sys_fleet_attendance': 'کارکرد ناوگان',
    'view_sys_payroll': 'حقوق و دستمزد',
    'view_sys_fleet_settlement': 'تسویه ناوگان',
    'view_sys_personnel': 'مدیریت پرسنل',
    'view_sys_treasury': 'خزانه‌داری',
    'view_wh_attendance': 'کارکرد ناوگان انبار',

    // تاییدات و کارتابل‌ها
    'perm_approve_personnel_supervisor': 'تایید سرپرست پرسنل',
    'perm_approve_personnel_manager': 'تایید مدیر پرسنل',
    'perm_approve_personnel_finance': 'تایید مالی پرسنل',
    'perm_approve_fleet_supervisor': 'تایید سرپرست ناوگان',
    'perm_approve_fleet_manager': 'تایید مدیر ناوگان',
    'perm_approve_fleet_finance': 'تایید مالی ناوگان',
    'perm_manager_payment_authorize': 'مجوز پرداخت مدیر',
    'perm_treasury_disburse_action': 'واریز خزانه‌داری',
    'perm_lock_work_period': 'قفل کارکرد ماهانه',
    'perm_inventory_finalize': 'بستن انبارگردانی',
    'perm_doc_approve_action': 'امضا و تایید اسناد',
    'perm_feed_approve_action': 'تایید فیدهای گمرکی',
    'can_act_as_counter': 'شمارشگر میدانی',
    'can_act_as_supervisor': 'سرپرست شمارش',
    'can_act_as_manager': 'مدیر انبار',
    'can_act_as_doc_worker': 'کارشناس اسناد',
    'can_act_as_doc_supervisor': 'سرپرست اسناد',
    'can_act_as_operator': 'کارمند ثبت',
    'can_act_as_accountant': 'حسابدار',

    // عملیات انبار و شمارش
    'view_sys_counter': 'میزکار شمارش کور',
    'view_sys_supervisor': 'کارتابل سرپرست',
    'view_sys_manager_review': 'بررسی مدیر انبار',
    'view_sys_recounts': 'مغایرت و بازشماری',
    'view_wh_dashboard': 'داشبورد انبار',
    'view_wh_docs': 'مدیریت کالا',
    'view_wh_dispatch': 'تخصیص کالا',
    'view_wh_customs': 'مالی و گمرکی',
    'view_wh_doc_approvals': 'تاییدات اسناد',
    'view_wh_feeding': 'تغذیه MT',
    'view_wh_feed_approvals': 'تاییدات تغذیه',
    'view_wh_labels': 'چاپ لیبل',
    'view_wh_label_designer': 'طراحی لیبل',
    'view_wh_audit': 'ممیزی انبار',
    'view_wh_settings': 'تنظیمات انبار',
    'perm_rec_dispatch': 'تخصیص به شمارشگر',
    'perm_rec_recount': 'دستور بازشماری',
    'perm_rec_label': 'دستور چاپ لیبل',
    'perm_rec_import': 'آپلود فایل پایه',
    'perm_wh_create': 'تعریف انبار جدید',
    'perm_wh_edit': 'ویرایش انبار',
    'perm_wh_freeze': 'فریز عملیات انبار',

    // کلان سیستم
    'view_sys_dashboard': 'داشبورد کلان',
    'view_sys_users': 'کاربران و نقش‌ها',
    'view_sys_projects': 'انبارها و پروژه‌ها',
    'view_sys_id_cards': 'صدور کارت پرسنلی',
    'view_sys_export': 'صدور فایل تغذیه',
    'view_sys_reports': 'گزارش‌ساز',
    'view_sys_settings': 'تنظیمات سیستم',
    'perm_sys_settings': 'تنظیمات کلان',
    'perm_sys_logs': 'لاگ‌های امنیتی',
    'perm_usr_add': 'ثبت پرسنل جدید',
    'perm_usr_edit': 'ویرایش پرونده',
    'perm_usr_role': 'تغییر ساختار نقش‌ها',

    // دسترسی‌های حساس
    'perm_rollback_data': 'احیای جامع داده‌ها',
    'perm_rollback_single': 'بازگردانی تکی سند',
    'perm_rollback_bulk': 'بازگردانی گروهی',
    'perm_restore_deleted': 'احیای حذف‌شده‌ها',
    'perm_sys_backup_manage': 'مدیریت فایل پشتیبان',
    'perm_sys_backup_restore': 'بازیابی دیتابیس',
    'perm_sys_audit_export': 'خروجی لاگ ممیزی',
    'perm_sys_purge_logs': 'حذف لاگ ممیزی',
    'perm_sys_hard_delete': 'حذف قطعی داده‌ها',
    'perm_sys_emergency_freeze': 'فریز اضطراری کل سیستم',
    'perm_sys_factory_reset': 'ریست فکتوری سیستم',

    // عملیات پایه انبار و کالا
    'view_warehouse': 'مشاهده انبارها',
    'add_warehouse': 'تعریف انبار جدید',
    'change_warehouse': 'ویرایش انبار',
    'delete_warehouse': 'حذف انبار',
    'view_record': 'مشاهده رکوردهای شمارش',
    'add_record': 'ثبت رکورد شمارش',
    'change_record': 'ویرایش رکورد شمارش',
    'delete_record': 'حذف رکورد شمارش',

    // عملیات پایه کاربران و گروه‌ها
    'view_customuser': 'مشاهده کاربران',
    'add_customuser': 'تعریف کاربر جدید',
    'change_customuser': 'ویرایش اطلاعات کاربر',
    'delete_customuser': 'حذف کاربر',
    'view_group': 'مشاهده گروه‌ها',
    'add_group': 'تعریف گروه جدید',
    'change_group': 'ویرایش گروه',
    'delete_group': 'حذف گروه'
  };

  getShortPermissionName(perm: Permission | any): string {
    if (!perm) return '';
    return this.SHORT_PERMISSION_NAMES[perm.codename] || perm.name;
  }

  systemPermissions: Permission[] = [];
  systemPermissionGroups: { key: string, title: string, items: Permission[], is_sensitive_group?: boolean }[] = [];
  permSearchQuery = '';
  isLoading = false;

  // Sensitive Permissions Guard Modal
  pendingSensitivePerm: Permission | null = null;
  isSensitiveWarningModalOpen = false;
  isSuperuser = computed(() => !!(this.auth.user()?.is_superuser || this.auth.user()?.roles?.includes('admin') || this.auth.user()?.department === 'admin'));
  public isOperationsMode = computed(() => {
    return this.persona.activeApp() === 'operations' || this.router.url.includes('/operations/');
  });

  isSavingUser = false;
  userFormErrors: { [key: string]: boolean } = {};

  // Excel Import/Export
  isExcelModalOpen = false;
  excelModalTitle = '';
  excelImportFn!: (file: File, updateExisting: boolean, dryRun?: boolean) => Observable<ImportResult>;
  excelTemplateFn!: () => void;

  constructor(
    public state: StateService,
    public auth: AuthService,
    public persona: AppPersonaService,
    public registry: ModuleRegistryService,
    private toast: ToastService,
    private accountsService: AccountsHttpService,
    private whService: WarehouseHttpService,
    private cdr: ChangeDetectorRef,
    private confirmDialog: ConfirmDialogService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    try {
      const savedMode = localStorage.getItem('users_view_mode');
      if (savedMode === 'grid' || savedMode === 'table') {
        this.userViewMode = savedMode;
      }
      const savedRoleMode = localStorage.getItem('roles_view_mode');
      if (savedRoleMode === 'tree' || savedRoleMode === 'table') {
        this.roleViewMode = savedRoleMode;
      }
    } catch (e) {}

    this.route.queryParams.subscribe((params: any) => {
      this.activeTab = params['tab'] || 'users';
      this.activeRoleTab = params['roleTab'] || 'custom';
      const q = params['q'] || '';
      if (q !== this.searchQuery) {
        this.searchQuery = q;
      }
      this.cdr.detectChanges();
    });

    this.searchSub = this.searchSubject.pipe(
      debounceTime(350)
    ).subscribe(q => {
      this.router.navigate([], { queryParams: { q: q || null }, queryParamsHandling: 'merge', replaceUrl: true });
    });

    this.loadData();
  }

  ngOnDestroy() {
    if (this.searchSub) {
      this.searchSub.unsubscribe();
    }
  }

  loadData() {
    this.accountsService.getPermissions().subscribe(res => {
      this.systemPermissions = res;
      
      const sensitivePerms = res.filter((p: any) => p.is_sensitive);

      // ۱. نرم‌افزار انبارگردانی و اسناد کالا (کلیه منوها، عملیات میدانی و تاییدات انبارگردانی)
      const warehouseCodenames = [
        'view_wh_dashboard', 'view_wh_docs', 'view_wh_dispatch', 'view_sys_counter',
        'view_wh_customs', 'view_sys_supervisor', 'view_sys_manager_review', 'view_sys_recounts',
        'view_wh_attendance', 'view_wh_doc_approvals', 'view_wh_feeding', 'view_wh_feed_approvals',
        'view_wh_labels', 'view_wh_label_designer', 'view_wh_audit', 'view_wh_settings',
        'view_wh_stocktaking', 'view_warehouse', 'add_warehouse', 'change_warehouse', 'delete_warehouse',
        'view_record', 'add_record', 'change_record', 'delete_record',
        'can_act_as_counter', 'can_act_as_supervisor', 'can_act_as_manager',
        'can_act_as_doc_worker', 'can_act_as_doc_supervisor',
        'perm_doc_approve_action', 'perm_feed_approve_action', 'perm_inventory_finalize',
        'perm_rec_dispatch', 'perm_rec_recount', 'perm_rec_label', 'perm_rec_import',
        'perm_wh_create', 'perm_wh_edit', 'perm_wh_freeze'
      ];

      // ۲. نرم‌افزار حسابداری و کارگاه (کارکرد پرسنل و ناوگان، حقوق و دستمزد، تسویه و تاییدات مالی)
      const accountingCodenames = [
        'view_sys_personnel', 'view_sys_personnel_attendance', 'view_sys_fleet_attendance',
        'view_sys_payroll', 'view_sys_fleet_settlement', 'view_sys_treasury',
        'can_act_as_operator', 'can_act_as_accountant',
        'perm_approve_personnel_supervisor', 'perm_approve_fleet_supervisor',
        'perm_approve_personnel_manager', 'perm_approve_fleet_manager',
        'perm_approve_personnel_finance', 'perm_approve_fleet_finance',
        'perm_lock_work_period', 'perm_manager_payment_authorize', 'perm_treasury_disburse_action'
      ];

      // ۳. مدیریت و زیرساخت سیستم
      const systemCodenames = [
        'view_sys_dashboard', 'view_sys_users', 'view_sys_projects', 'view_sys_id_cards',
        'view_sys_export', 'view_sys_settings', 'view_sys_reports',
        'perm_sys_settings', 'perm_sys_logs', 'perm_usr_add', 'perm_usr_edit', 'perm_usr_role',
        'view_customuser', 'add_customuser', 'change_customuser', 'delete_customuser',
        'view_group', 'add_group', 'change_group', 'delete_group'
      ];

      const warehousePerms = res.filter((p: any) => warehouseCodenames.includes(p.codename) && !p.is_sensitive);
      const accountingPerms = res.filter((p: any) => accountingCodenames.includes(p.codename) && !p.is_sensitive);
      const systemPerms = res.filter((p: any) => systemCodenames.includes(p.codename) && !p.is_sensitive);

      const otherPerms = res.filter((p: any) => 
        !p.is_sensitive && 
        !warehousePerms.includes(p) && 
        !accountingPerms.includes(p) && 
        !systemPerms.includes(p)
      );

      const groups: { key: string, title: string, items: Permission[], is_sensitive_group?: boolean }[] = [
        {
          key: 'WH_AUDIT',
          title: 'انبارگردانی 📦',
          items: warehousePerms
        },
        {
          key: 'ACCOUNTING_FINANCE',
          title: 'حسابداری 💳',
          items: accountingPerms
        },
        {
          key: 'MAIN_MENU',
          title: 'سیستم ⚙️',
          items: systemPerms
        },
        {
          key: 'BACKEND',
          title: 'سایر 📑',
          items: otherPerms
        },
        {
          key: 'SENSITIVE',
          title: 'حساس 🛡️',
          items: sensitivePerms,
          is_sensitive_group: true
        }
      ];

      this.systemPermissionGroups = groups.filter(g => g.items.length > 0);
      this.rebuildMemoizedData();
    }, error => {
      console.warn('[Users] خطا در دریافت مجوزهای سیستم:', error);
    });

    this.accountsService.getRoles().subscribe({
      next: (res) => {
        const rolesList = Array.isArray(res) ? res : [];
        this.state.appState.roles = rolesList;
        const map: any = {};
        const flattenRoles = (roles: any[]) => {
          for (const r of roles) {
            map[r.name] = { title: r.title, color: r.color };
            if (Array.isArray(r.children) && r.children.length) flattenRoles(r.children);
          }
        };
        flattenRoles(rolesList);
        this.state.appState.rolesMap = map;
        this.rebuildMemoizedData();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.warn('[Users] خطا در دریافت نقش‌ها:', err);
      }
    });

    this.isLoading = true;
    this.accountsService.getUsers().subscribe({
      next: (res) => {
        this.state.appState.users = Array.isArray(res) ? res : [];
        this.rebuildMemoizedData();
        setTimeout(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        }, 300);
      },
      error: (err) => {
        setTimeout(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        }, 300);
      }
    });

    this.whService.getAll().subscribe({
      next: (res: any) => {
        this.state.appState.projects = Array.isArray(res) ? res : [];
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  rebuildMemoizedData(): void {
    const roles: any[] = Array.isArray(this.state.appState.roles) ? this.state.appState.roles : [];
    const users: any[] = Array.isArray(this.state.appState.users) ? this.state.appState.users : [];

    // 1. Permissions id -> codename map
    if (this.systemPermissions && this.systemPermissions.length > 0) {
      this.permIdToCodenameMap.clear();
      for (const p of this.systemPermissions) {
        this.permIdToCodenameMap.set(p.id, p.codename);
      }
    }

    // 2. Root roles and children map
    this.roleChildrenMap.clear();
    const allRoleIds = new Set<number>(roles.map((r: any) => r.id));
    this.cachedRootRoles = roles.filter((r: any) => !r.parent || !allRoleIds.has(r.parent));

    for (const r of roles) {
      if (r.parent) {
        const list = this.roleChildrenMap.get(r.parent) || [];
        list.push(r);
        this.roleChildrenMap.set(r.parent, list);
      }
    }

    // 3. Count of users per role
    this.roleUsersCountMap.clear();
    for (const u of users) {
      if (Array.isArray(u.groups)) {
        for (const gId of u.groups) {
          this.roleUsersCountMap.set(gId, (this.roleUsersCountMap.get(gId) || 0) + 1);
        }
      }
    }

    // 4. Map user to roles list & primary role
    this.userRolesMap.clear();
    this.primaryRoleMap.clear();
    const rolesById = new Map<number, any>(roles.map((r: any) => [r.id, r]));

    for (const u of users) {
      const uGroups = u.groups || [];
      const userRoles = uGroups.map((rId: any) => {
        const r = rolesById.get(rId);
        if (!r) return { name: 'نامشخص', color: '#94a3b8' };
        return { name: r.title || r.name, color: r.color || '#94a3b8' };
      });
      this.userRolesMap.set(u.id, userRoles);
      this.primaryRoleMap.set(u.id, userRoles[0] || { name: 'نامشخص', color: '#94a3b8' });
    }
  }

  get filteredUsers() {
    const q = this.searchQuery.trim().toLowerCase();
    let users = Array.isArray(this.state.appState.users) ? this.state.appState.users : [];

    // فیلتر سریع بر اساس وضعیت سازمانی
    if (this.userStatusFilter === 'active') {
      users = users.filter((u: any) => u.is_active);
    } else if (this.userStatusFilter === 'inactive') {
      users = users.filter((u: any) => !u.is_active);
    } else if (this.userStatusFilter === 'no_warehouse') {
      users = users.filter((u: any) => !u.assigned_warehouses || u.assigned_warehouses.length === 0);
    } else if (this.userStatusFilter === 'superuser') {
      users = users.filter((u: any) => u.is_superuser);
    }

    // فیلتر انتخابی بر اساس نقش سازمانی
    if (this.userRoleFilter !== 'ALL') {
      const rId = Number(this.userRoleFilter);
      users = users.filter((u: any) => Array.isArray(u.groups) && u.groups.includes(rId));
    }

    // فیلتر انتخابی بر اساس انبار انتساب‌یافته
    if (this.userWarehouseFilter !== 'ALL') {
      const wId = String(this.userWarehouseFilter);
      users = users.filter((u: any) => Array.isArray(u.assigned_warehouses) && u.assigned_warehouses.some((id: any) => String(id) === wId));
    }

    if (!q) return users;

    return users.filter((u: any) => {
      const fullName = `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase();
      const username = (u.username || '').toLowerCase();
      const nid = (u.national_code || '');
      const phone = (u.phone_number || '');
      const comp = (u.company || '').toLowerCase();
      const opZone = (u.operational_zone || '').toLowerCase();
      const roleTitles = this.getUserRoles(u).map((r: any) => r.name.toLowerCase()).join(' ');

      return fullName.includes(q) ||
             username.includes(q) ||
             nid.includes(q) ||
             phone.includes(q) ||
             comp.includes(q) ||
             opZone.includes(q) ||
             roleTitles.includes(q);
    });
  }

  // ── Pagination Getters & Methods ─────────────────────────────────
  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredUsers.length / this.pageSize));
  }

  get pagedUsers(): any[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredUsers.slice(start, start + this.pageSize);
  }

  get displayedUsers(): any[] {
    return this.pagedUsers;
  }

  get paginationRange(): { start: number; end: number } {
    if (this.filteredUsers.length === 0) return { start: 0, end: 0 };
    const start = (this.currentPage - 1) * this.pageSize + 1;
    const end = Math.min(this.filteredUsers.length, this.currentPage * this.pageSize);
    return { start, end };
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.cdr.detectChanges();
  }

  setPageSize(size: number): void {
    this.pageSize = size;
    this.currentPage = 1;
    this.cdr.detectChanges();
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.clearUserSelection();
    this.cdr.detectChanges();
  }

  getPageNumbers(): (number | string)[] {
    const total = this.totalPages;
    const current = this.currentPage;
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const pages: (number | string)[] = [1];
    if (current > 3) {
      pages.push('...');
    }
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    if (current < total - 2) {
      pages.push('...');
    }
    pages.push(total);
    return pages;
  }

  loadMoreUsers(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.cdr.detectChanges();
    }
  }

  setStatusFilter(filter: 'all' | 'active' | 'inactive' | 'no_warehouse' | 'superuser') {
    this.userStatusFilter = filter;
    this.currentPage = 1;
    this.clearUserSelection();
    this.cdr.detectChanges();
  }

  // ── Bulk Selection & Actions ─────────────────────────────────────
  isUserSelected(id: number): boolean {
    return this.selectedUserIds.has(id);
  }

  toggleSelectUser(id: number, event?: Event): void {
    if (event) event.stopPropagation();
    if (this.selectedUserIds.has(id)) {
      this.selectedUserIds.delete(id);
    } else {
      this.selectedUserIds.add(id);
    }
    this.cdr.detectChanges();
  }

  isAllCurrentPageSelected(): boolean {
    const users = this.pagedUsers;
    return users.length > 0 && users.every(u => this.selectedUserIds.has(u.id));
  }

  toggleSelectAllCurrentPage(event?: Event): void {
    if (event) event.stopPropagation();
    const users = this.pagedUsers;
    if (this.isAllCurrentPageSelected()) {
      users.forEach(u => this.selectedUserIds.delete(u.id));
    } else {
      users.forEach(u => this.selectedUserIds.add(u.id));
    }
    this.cdr.detectChanges();
  }

  clearUserSelection(): void {
    this.selectedUserIds.clear();
    this.cdr.detectChanges();
  }

  bulkToggleStatus(activate: boolean): void {
    const targetIds = Array.from(this.selectedUserIds).filter(id => {
      const u = this.state.appState.users.find((x: any) => x.id === id);
      return u && u.is_active !== activate;
    });

    if (targetIds.length === 0) {
      this.toast.show('info', `تمامی کاربران انتخاب‌شده در حال حاضر ${activate ? 'فعال' : 'معلق'} هستند.`);
      return;
    }

    this.isLoading = true;
    const requests = targetIds.map(id => this.accountsService.toggleUserStatus(id));
    forkJoin(requests).subscribe({
      next: () => {
        targetIds.forEach(id => {
          const u = this.state.appState.users.find((x: any) => x.id === id);
          if (u) u.is_active = activate;
        });
        this.isLoading = false;
        this.toast.show('success', `وضعیت ${targetIds.length} کاربر با موفقیت به «${activate ? 'فعال' : 'معلق'}» تغییر یافت.`);
        this.clearUserSelection();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoading = false;
        const msg = err.error?.detail || err.error?.error || (typeof err.error === 'string' ? err.error : 'خطا در تغییر وضعیت گروهی کاربران');
        this.toast.show('error', msg);
        this.loadData();
      }
    });
  }

  bulkExportSelectedUsers(): void {
    const ids = Array.from(this.selectedUserIds);
    if (ids.length === 0) {
      this.exportUsersExcel();
      return;
    }
    this.accountsService.exportUsersExcel(ids).subscribe({
      next: (blob) => {
        this.triggerDownload(blob, `users_export_${ids.length}_selected.xlsx`);
        this.toast.show('success', `خروجی اکسل ${ids.length} کاربر انتخاب‌شده با موفقیت دانلود شد.`);
      },
      error: () => {
        this.toast.show('error', 'خطا در دانلود فایل اکسل کاربران انتخاب‌شده.');
      }
    });
  }

  // ── Role Percentage & Popover Helpers ────────────────────────────
  getRolePermissionPercent(role: any): number {
    const total = this.systemPermissions.length || 70;
    const count = role.permissions?.length || 0;
    return Math.min(100, Math.round((count / total) * 100));
  }

  toggleRolePopover(roleId: number, event: Event): void {
    event.stopPropagation();
    this.activePopoverRoleId = this.activePopoverRoleId === roleId ? null : roleId;
    this.cdr.detectChanges();
  }

  closeRolePopover(): void {
    this.activePopoverRoleId = null;
    this.cdr.detectChanges();
  }

  getRoleGroupSummary(role: any): { title: string; count: number; total: number }[] {
    if (!role || !role.permissions) return [];
    const rolePermSet = new Set<number>(role.permissions);
    return (this.systemPermissionGroups || []).map(group => {
      const count = group.items.filter(p => rolePermSet.has(p.id)).length;
      return {
        title: group.title,
        count: count,
        total: group.items.length
      };
    }).filter(g => g.count > 0);
  }

  get userCounts() {
    const users = Array.isArray(this.state.appState.users) ? this.state.appState.users : [];
    return {
      all: users.length,
      active: users.filter((u: any) => u.is_active).length,
      inactive: users.filter((u: any) => !u.is_active).length,
      noWarehouse: users.filter((u: any) => !u.assigned_warehouses || u.assigned_warehouses.length === 0).length,
      superuser: users.filter((u: any) => u.is_superuser).length
    };
  }

  get rootRoles() {
    return this.cachedRootRoles.length > 0 ? this.cachedRootRoles : (this.state.appState.roles || []);
  }

  getRoleChildren(parentId: number) {
    return this.roleChildrenMap.get(parentId) || [];
  }

  getSelectableParents() {
    const roles = Array.isArray(this.state.appState.roles) ? this.state.appState.roles : [];
    if (!this.roleForm || !this.roleForm.id) return roles;

    const invalidIds = new Set<number>();
    invalidIds.add(this.roleForm.id);

    const addDescendants = (parentId: number) => {
      const children = this.getRoleChildren(parentId);
      children.forEach((c: any) => {
        invalidIds.add(c.id);
        addDescendants(c.id);
      });
    };
    addDescendants(this.roleForm.id);

    return roles.filter((r: any) => !invalidIds.has(r.id));
  }

  getAvailableSupervisors() {
    return this.state.appState.users.filter((u: any) => !this.editingUser || u.id !== this.editingUser.id);
  }

  getSupervisorName(supId: number | null): string {
    if (!supId) return '---';
    const sup = this.state.appState.users.find((u: any) => u.id === supId);
    return sup ? `${sup.first_name} ${sup.last_name}` : `کاربر #${supId}`;
  }

  getUserAvatarLetter(u: any): string {
    if (u.first_name && u.first_name.trim().length > 0) {
      return u.first_name.trim()[0];
    }
    if (u.username && u.username.trim().length > 0) {
      return u.username.trim()[0].toUpperCase();
    }
    return '👤';
  }

  getUsersInRoleCount(roleId: number): number {
    return this.roleUsersCountMap.get(roleId) || 0;
  }

  getUsersInRole(roleId: number): any[] {
    const users = this.state.appState?.users || [];
    return users.filter((u: any) => u.groups && u.groups.includes(roleId));
  }

  get allRoles(): any[] {
    return Array.isArray(this.state.appState?.roles) ? this.state.appState.roles : [];
  }

  getParentRoleTitle(parentId: number | null): string {
    if (!parentId) return 'سطح ریشه (بدون والد)';
    const p = this.allRoles.find((r: any) => r.id === parentId);
    return p ? (p.title || p.name) : `شناسه ${parentId}`;
  }

  getPrimaryRole(u: any) {
    return this.primaryRoleMap.get(u.id) || { name: 'نامشخص', color: '#94a3b8' };
  }

  getUserRoles(u: any) {
    return this.userRolesMap.get(u.id) || [];
  }

  getProjectName(id: any) {
    const p = this.state.appState.projects.find((proj: any) => String(proj.id) === String(id));
    return p ? p.name : id;
  }

  switchTab(tab: string) {
    this.router.navigate([], { queryParams: { tab }, queryParamsHandling: 'merge' });
    this.openMenuId = null;
  }

  switchRoleTab(tab: string) {
    this.router.navigate([], { queryParams: { roleTab: tab }, queryParamsHandling: 'merge' });
  }

  switchPermTab(tab: string) {
    this.activePermTab = tab;
    this.cdr.detectChanges();
  }

  onSearchChange(val: string) {
    this.searchSubject.next(val);
  }

  toggleMenu(event: Event, menuId: string) {
    event.stopPropagation();
    if (this.openMenuId === menuId) this.openMenuId = null;
    else this.openMenuId = menuId;
    this.cdr.detectChanges();
  }

  closeMenus() {
    this.openMenuId = null;
    this.cdr.detectChanges();
  }

  trackById(index: number, item: any) {
    return item.id;
  }

  toggleUserStatus(id: number) {
    this.closeMenus();
    this.accountsService.toggleUserStatus(id).subscribe({
      next: (res) => {
        const u = this.state.appState.users.find((x: any) => x.id === id);
        if (u) {
          u.is_active = res.is_active;
          if (res.is_active) {
              this.toast.show('success', `حساب کاربری از تعلیق خارج و مجدداً فعال شد.`);
          } else {
              this.toast.show('warning', `حساب کاربری مسدود و دسترسی وی قطع شد.`);
          }
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        const msg = err.error?.detail || err.error?.error || (typeof err.error === 'string' ? err.error : 'خطا در تغییر وضعیت حساب کاربری');
        this.toast.show('error', msg);
      }
    });
  }

  async resetPassword(id: number) {
    this.closeMenus();
    const u = this.state.appState.users.find((x: any) => x.id === id);
    const confirmed = await this.confirmDialog.open({
      title: 'ریست رمز عبور',
      message: `آیا مطمئن هستید که می‌خواهید رمز عبور ${u.first_name} ${u.last_name} را به حالت پیش‌فرض (123456) بازنشانی کنید؟`,
      confirmText: 'بله، بازنشانی',
      cancelText: 'انصراف',
      type: 'warning',
    });
    if (confirmed) {
        this.accountsService.adminResetPassword(id).subscribe({
          next: (res) => {
            this.toast.show('success', res.message || 'رمز عبور با موفقیت به مقدار پیش‌فرض تغییر یافت.');
          },
          error: (err) => {
            const msg = err.error?.detail || err.error?.error || 'خطا در بازنشانی رمز عبور';
            this.toast.show('error', msg);
          }
        });
    }
  }

  openAvatarModalForUser(u: any) {
    this.closeMenus();
    this.targetUserForAvatar = u;
    this.isAvatarCropperOpen = true;
    this.cdr.detectChanges();
  }

  onSaveUserAvatar(blob: Blob) {
    if (this.isUserModalOpen) {
      // در حالت باز بودن فرم: تغییرات به صورت تراکنشی ذخیره می‌شود و تا قبل از ذخیره نهایی به سرور ارسال نمی‌شود
      this.userForm._pendingAvatarBlob = blob;
      this.userForm._pendingAvatarDelete = false;
      this.userForm.avatar = URL.createObjectURL(blob);
      this.isAvatarCropperOpen = false;
      this.toast.show('info', 'تصویر انتخاب شد و پس از ذخیره فرم اعمال خواهد شد.');
      this.cdr.detectChanges();
    } else if (this.targetUserForAvatar && this.targetUserForAvatar.id) {
      this.isSavingUserAvatar = true;
      this.accountsService.updateUserAvatar(this.targetUserForAvatar.id, blob).subscribe({
        next: (res) => {
          this.isSavingUserAvatar = false;
          this.isAvatarCropperOpen = false;
          const bustAvatar = res.avatar ? `${res.avatar}?t=${Date.now()}` : null;
          this.targetUserForAvatar.avatar = bustAvatar;
          if (this.editingUser && this.editingUser.id === this.targetUserForAvatar.id) {
            this.userForm.avatar = bustAvatar;
          }
          if (this.auth.user()?.id === this.targetUserForAvatar.id) {
            this.auth.updateUserAvatar(bustAvatar);
          }
          this.toast.show('success', 'تصویر کاربر با موفقیت بروزرسانی شد.');
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.isSavingUserAvatar = false;
          const msg = err.error?.error || 'خطا در ذخیره تصویر کاربر';
          this.toast.show('error', msg);
          this.cdr.detectChanges();
        }
      });
    }
  }

  onRemoveUserAvatar() {
    if (this.isUserModalOpen) {
      // در حالت باز بودن فرم: علامت‌گذاری برای حذف در زمان ذخیره نهایی فرم
      this.userForm._pendingAvatarBlob = null;
      this.userForm._pendingAvatarDelete = true;
      this.userForm.avatar = null;
      this.isAvatarCropperOpen = false;
      this.toast.show('info', 'تصویر حذف شد و پس از ذخیره فرم اعمال خواهد شد.');
      this.cdr.detectChanges();
    } else if (this.targetUserForAvatar && this.targetUserForAvatar.id) {
      this.isSavingUserAvatar = true;
      this.accountsService.deleteUserAvatar(this.targetUserForAvatar.id).subscribe({
        next: () => {
          this.isSavingUserAvatar = false;
          this.isAvatarCropperOpen = false;
          this.targetUserForAvatar.avatar = null;
          if (this.editingUser && this.editingUser.id === this.targetUserForAvatar.id) {
            this.userForm.avatar = null;
          }
          if (this.auth.user()?.id === this.targetUserForAvatar.id) {
            this.auth.updateUserAvatar(null);
          }
          this.toast.show('success', 'تصویر کاربر حذف شد.');
          this.cdr.detectChanges();
        },
        error: () => {
          this.isSavingUserAvatar = false;
          this.toast.show('error', 'خطا در حذف تصویر کاربر');
          this.cdr.detectChanges();
        }
      });
    }
  }

  openUserModal(id: number | null = null) {
    this.closeMenus();
    this.userFormErrors = {};
    this.isSavingUser = false;
    if (id) {
      const u = this.state.appState.users.find((x: any) => x.id === id);
      this.editingUser = u;
      this.userForm = {
        ...u,
        company: u.company || '',
        address: u.address || '',
        email: u.email || '',
        avatar: u.avatar || null,
        password: '',
        _pendingAvatarBlob: null,
        _pendingAvatarDelete: false,
        blood_type: u.blood_type || '',
        emergency_contact: u.emergency_contact || '',
        operational_zone: u.operational_zone || '',
        supervisor: u.supervisor || null
      };
      if (!this.userForm.groups) this.userForm.groups = [];
      this.userForm.assigned_warehouses = (this.userForm.assigned_warehouses || []).map(Number);
    } else {
      this.editingUser = null;
      this.userForm = {
        id: null, first_name: '', last_name: '', national_code: '', username: '', phone_number: '', password: '',
        operational_zone: '', supervisor: null, address: '', company: '', email: '', avatar: null, _pendingAvatarBlob: null,
        _pendingAvatarDelete: false, blood_type: '', emergency_contact: '', groups: [], assigned_warehouses: [],
        date_joined: '', last_login: '', is_active: true, is_superuser: false
      };
    }
    this.isUserModalOpen = true;
    this.cdr.detectChanges();
  }

  toggleUserRoleCheckbox(roleId: number, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      if (!this.userForm.groups.includes(roleId)) this.userForm.groups.push(roleId);
    } else {
      this.userForm.groups = this.userForm.groups.filter((id: number) => id !== roleId);
    }
  }

  isWarehouseAssigned(projId: any): boolean {
    const numId = Number(projId);
    return (this.userForm.assigned_warehouses || []).some((id: any) => Number(id) === numId);
  }

  toggleUserProjCheckbox(projId: any, event: Event) {
    const numId = Number(projId);
    const checked = (event.target as HTMLInputElement).checked;
    let list = (this.userForm.assigned_warehouses || []).map(Number);
    if (checked) {
      if (!list.includes(numId)) list.push(numId);
    } else {
      list = list.filter(id => id !== numId);
    }
    this.userForm.assigned_warehouses = list;
  }

  getRoleDepthMargin(depth: number): string {
    if (depth === 0) return '0rem';
    return `clamp(0.75rem, ${depth * 1.5}vw, ${(depth * 2.2)}rem)`;
  }

  getContrastTextColor(hexColor: string): string {
    if (!hexColor) return '#ffffff';
    let c = hexColor.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    if (c.length !== 6) return '#ffffff';
    const r = parseInt(c.substr(0, 2), 16);
    const g = parseInt(c.substr(2, 2), 16);
    const b = parseInt(c.substr(4, 2), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 165 ? '#0f172a' : '#ffffff';
  }

  validateNationalCode(code: string): boolean {
    if (!code) return true;
    const clean = code.replace(/\D/g, '');
    if (clean.length !== 10) return false;
    if (/^(\d)\1{9}$/.test(clean)) return false;
    const digits = clean.split('').map(Number);
    const checksum = digits[9];
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += digits[i] * (10 - i);
    const remainder = sum % 11;
    return (remainder < 2 && checksum === remainder) || (remainder >= 2 && checksum === 11 - remainder);
  }

  clearUserFormError(field: string) {
    if (this.userFormErrors[field]) {
      delete this.userFormErrors[field];
    }
  }

  toEnglishDigits(str: string): string {
    if (!str) return '';
    return str
      .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
      .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧۸۹'.indexOf(d).toString());
  }

  isFieldValid(field: string): boolean {
    if (this.userFormErrors && this.userFormErrors[field]) return false;

    switch (field) {
      case 'first_name':
        return (this.userForm.first_name || '').trim().length >= 2;

      case 'last_name':
        return (this.userForm.last_name || '').trim().length >= 2;

      case 'username': {
        const u = (this.userForm.username || '').trim();
        return u.length >= 3 && /^[a-zA-Z0-9._-]+$/.test(u);
      }

      case 'national_code': {
        const val = this.toEnglishDigits(this.userForm.national_code || '').replace(/\D/g, '');
        return val.length === 10 && this.validateNationalCode(val);
      }

      case 'phone_number': {
        let p = this.toEnglishDigits(this.userForm.phone_number || '').replace(/[\s\-_]/g, '');
        if (p.startsWith('+98')) p = '0' + p.substring(3);
        else if (p.startsWith('0098')) p = '0' + p.substring(4);
        else if (p.startsWith('98') && p.length === 12) p = '0' + p.substring(2);
        else if (p.startsWith('9') && p.length === 10) p = '0' + p;
        return /^09\d{9}$/.test(p);
      }

      case 'emergency_contact': {
        const em = this.toEnglishDigits(this.userForm.emergency_contact || '').replace(/\D/g, '');
        return em.length >= 8 && em.length <= 11;
      }

      case 'email': {
        const email = (this.userForm.email || '').trim();
        return email.length > 0 && /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
      }

      case 'password': {
        const pwd = this.userForm.password || '';
        return pwd.length >= 6;
      }

      case 'company':
        return (this.userForm.company || '').trim().length >= 2;

      case 'operational_zone':
        return (this.userForm.operational_zone || '').trim().length >= 2;

      case 'address':
        return (this.userForm.address || '').trim().length >= 5;

      case 'blood_type':
        return !!this.userForm.blood_type;

      case 'supervisor':
        return this.userForm.supervisor !== null;

      default:
        return false;
    }
  }

  getFieldClass(field: string): string {
    if (this.userFormErrors && this.userFormErrors[field]) {
      return 'border-rose-400 bg-rose-50/50 text-rose-900 ring-2 ring-rose-200/80 focus:border-rose-500 focus:ring-rose-300';
    }
    if (this.isFieldValid(field)) {
      return 'border-emerald-500 bg-emerald-50/20 text-slate-800 ring-1.5 ring-emerald-400/80 focus:border-emerald-500 focus:ring-emerald-300';
    }
    return 'border-slate-200 bg-slate-50/60 text-slate-800 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100';
  }

  generateRandomPassword() {
    const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%';
    let pwd = '';
    for (let i = 0; i < 10; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    this.userForm.password = pwd;
    this.clearUserFormError('password');
  }

  saveUser() {
    this.userFormErrors = {};

    const fName = (this.userForm.first_name || '').trim();
    const lName = (this.userForm.last_name || '').trim();
    const uName = (this.userForm.username || '').trim();

    if (!fName) {
      this.userFormErrors['first_name'] = true;
      return this.toast.show('error', 'وارد کردن «نام» الزامی است.');
    }

    if (!lName) {
      this.userFormErrors['last_name'] = true;
      return this.toast.show('error', 'وارد کردن «نام خانوادگی» الزامی است.');
    }

    if (!uName) {
      this.userFormErrors['username'] = true;
      return this.toast.show('error', 'وارد کردن «کد / نام کاربری (Username)» الزامی است.');
    }

    const normalizeDigits = (str: string) => {
      return (str || '')
        .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
        .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
        .replace(/[\s\-_]/g, '')
        .trim();
    };

    let phone = normalizeDigits(this.userForm.phone_number);
    let nid = normalizeDigits(this.userForm.national_code);
    let emergency = normalizeDigits(this.userForm.emergency_contact);

    if (nid && !this.validateNationalCode(nid)) {
      this.userFormErrors['national_code'] = true;
      return this.toast.show('error', 'کد ملی وارد شده با الگوریتم استاندارد ۱۰ رقمی همخوانی ندارد.');
    }

    if (phone) {
      if (phone.startsWith('+98')) phone = '0' + phone.substring(3);
      else if (phone.startsWith('0098')) phone = '0' + phone.substring(4);
      else if (phone.startsWith('98') && phone.length === 12) phone = '0' + phone.substring(2);
      else if (phone.startsWith('9') && phone.length === 10) phone = '0' + phone;
    }

    if (!this.editingUser && !phone) {
      this.userFormErrors['phone_number'] = true;
      return this.toast.show('error', 'وارد کردن شماره تلفن همراه برای تعریف کاربر جدید الزامی است.');
    }

    if (phone && !/^09\d{9}$/.test(phone)) {
      this.userFormErrors['phone_number'] = true;
      return this.toast.show('error', 'فرمت شماره همراه نامعتبر است. شماره همراه باید با 09 شروع شده و ۱۱ رقم باشد (مانند 09123456789).');
    }

    const pendingBlob = this.userForm._pendingAvatarBlob;
    const pendingDelete = this.userForm._pendingAvatarDelete;
    const payload: any = { ...this.userForm };
    delete payload._pendingAvatarBlob;
    delete payload._pendingAvatarDelete;
    delete payload.avatar; // Avatar is uploaded via dedicated endpoint
    if (!payload.password) delete payload.password;
    payload.first_name = fName;
    payload.last_name = lName;
    payload.username = uName;
    payload.national_code = nid || null;
    payload.emergency_contact = emergency || null;
    if (!payload.supervisor) payload.supervisor = null;
    payload.phone_number = phone || null;
    payload.email = payload.email ? payload.email.trim() : '';
    if (!payload.company) payload.company = null;
    if (!payload.address) payload.address = null;
    if (!payload.operational_zone) payload.operational_zone = null;

    // پاک‌سازی قطعی فیلدهای سیستمی تا از خطای فرمت تاریخ جنگو جلوگیری شود
    delete payload.date_joined;
    delete payload.last_login;
    delete payload.created_by;
    delete payload.modified_by;
    delete payload.updated_at;
    if (!this.editingUser) {
      delete payload.id;
    }

    this.isSavingUser = true;
    if (this.editingUser) {
      this.accountsService.updateUser(this.editingUser.id, payload).pipe(
        finalize(() => {
          this.isSavingUser = false;
          this.cdr.detectChanges();
        })
      ).subscribe({
        next: (res) => {
          Object.assign(this.editingUser, res);
          if (pendingBlob) {
            this.accountsService.updateUserAvatar(this.editingUser.id, pendingBlob).subscribe({
              next: (avatarRes) => {
                this.editingUser.avatar = avatarRes.avatar;
                if (this.auth.user()?.id === this.editingUser.id) {
                  this.auth.updateUserAvatar(avatarRes.avatar);
                }
                this.cdr.detectChanges();
              }
            });
          } else if (pendingDelete) {
            this.accountsService.deleteUserAvatar(this.editingUser.id).subscribe({
              next: () => {
                this.editingUser.avatar = null;
                if (this.auth.user()?.id === this.editingUser.id) {
                  this.auth.updateUserAvatar(null);
                }
                this.cdr.detectChanges();
              }
            });
          }
          this.rebuildMemoizedData();
          this.toast.show('success', 'اطلاعات کاربر با موفقیت بروزرسانی شد.');
          this.isUserModalOpen = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          const msg = err.error?.detail || err.error?.error || (typeof err.error === 'object' ? Object.values(err.error).flat().join(' ') : 'خطا در بروزرسانی اطلاعات کاربر');
          this.toast.show('error', msg);
        }
      });
    } else {
      this.accountsService.createUser(payload).pipe(
        finalize(() => {
          this.isSavingUser = false;
          this.cdr.detectChanges();
        })
      ).subscribe({
        next: (res) => {
          this.state.appState.users.unshift(res);
          if (pendingBlob) {
            this.accountsService.updateUserAvatar(res.id, pendingBlob).subscribe({
              next: (avatarRes) => {
                res.avatar = avatarRes.avatar;
                this.cdr.detectChanges();
              }
            });
          }
          this.rebuildMemoizedData();
          this.toast.show('success', 'کاربر جدید با موفقیت ایجاد شد.');
          this.isUserModalOpen = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          const msg = err.error?.detail || err.error?.error || (typeof err.error === 'object' ? Object.values(err.error).flat().join(' ') : 'خطا در ایجاد کاربر');
          this.toast.show('error', msg);
        }
      });
    }
  }

  openRoleModal(id: number | null = null) {
    this.closeMenus();
    this.permSearchQuery = '';
    this.activeRolePresetId = null;
    this.roleMemberSearchQuery = '';
    this.isRoleMembersExpanded = false;
    if (id) {
      const r = this.state.appState.roles.find((x: any) => x.id === id);
      this.editingRole = r;
      const assignedUserIds = (r.user_ids && Array.isArray(r.user_ids))
        ? [...r.user_ids]
        : (this.state.appState.users || [])
            .filter((u: any) => u.groups && u.groups.includes(r.id))
            .map((u: any) => u.id);

      this.roleForm = { 
        id: r.id, 
        name: r.name, 
        title: r.title || r.name, 
        parent: r.parent !== null && r.parent !== undefined ? r.parent : null, 
        color: r.color || '#94a3b8', 
        permissions: r.permissions ? [...r.permissions] : [],
        user_ids: assignedUserIds
      };
    } else {
      this.editingRole = null;
      this.roleForm = { id: null, name: '', title: '', parent: null, color: '#94a3b8', permissions: [], user_ids: [] };
    }
    this.activePermTab = this.systemPermissionGroups[0]?.key || 'MAIN_MENU';
    this.isPresetsExpanded = false;
    this.isRoleModalOpen = true;
    this.cdr.detectChanges();
  }

  cloneRole(role: any) {
    this.closeMenus();
    this.editingRole = null;
    this.activeRolePresetId = null;
    this.permSearchQuery = '';
    this.roleMemberSearchQuery = '';
    this.isRoleMembersExpanded = false;
    this.roleForm = {
      id: null,
      name: `${role.name}_copy`,
      title: `${role.title || role.name} (کپی)`,
      parent: role.parent !== null && role.parent !== undefined ? role.parent : null,
      color: role.color || '#94a3b8',
      permissions: role.permissions ? [...role.permissions] : [],
      user_ids: []
    };
    this.activePermTab = this.systemPermissionGroups[0]?.key || 'MAIN_MENU';
    this.isRoleModalOpen = true;
    this.toast.show('info', `نقش «${role.title || role.name}» با دسترسی‌های مرتبط آماده تکثیر است.`);
    this.cdr.detectChanges();
  }

  getFilteredPersonnelForRole(): any[] {
    const q = (this.roleMemberSearchQuery || '').trim().toLowerCase();
    const users = this.state.appState.users || [];
    if (!q) return users;
    return users.filter((u: any) => {
      const fn = (u.first_name || '').toLowerCase();
      const ln = (u.last_name || '').toLowerCase();
      const un = (u.username || '').toLowerCase();
      const nc = (u.national_code || '').toLowerCase();
      const phone = (u.phone_number || '').toLowerCase();
      return fn.includes(q) || ln.includes(q) || un.includes(q) || nc.includes(q) || phone.includes(q);
    });
  }

  toggleRoleMember(userId: number): void {
    if (!this.roleForm.user_ids) this.roleForm.user_ids = [];
    const idx = this.roleForm.user_ids.indexOf(userId);
    if (idx > -1) {
      this.roleForm.user_ids.splice(idx, 1);
    } else {
      this.roleForm.user_ids.push(userId);
    }
  }

  selectAllFilteredRoleMembers(): void {
    if (!this.roleForm.user_ids) this.roleForm.user_ids = [];
    const filtered = this.getFilteredPersonnelForRole();
    const currentSet = new Set(this.roleForm.user_ids);
    filtered.forEach((u: any) => currentSet.add(u.id));
    this.roleForm.user_ids = Array.from(currentSet);
  }

  deselectAllRoleMembers(): void {
    this.roleForm.user_ids = [];
  }

  isRoleMemberSelected(userId: number): boolean {
    return this.roleForm.user_ids?.includes(userId) ?? false;
  }

  getSelectedRoleMembers(): any[] {
    const ids = new Set(this.roleForm.user_ids || []);
    return (this.state.appState.users || []).filter((u: any) => ids.has(u.id));
  }

  applyRolePreset(preset: any) {
    this.activeRolePresetId = preset.id;
    if (preset.permissionCodenames === 'ALL') {
      this.roleForm.permissions = this.systemPermissions
        .filter(p => !p.is_sensitive || this.isSuperuser())
        .map(p => p.id);
    } else {
      const targetCodenames = new Set(preset.permissionCodenames);
      const matchedIds = this.systemPermissions
        .filter(p => targetCodenames.has(p.codename))
        .map(p => p.id);
      this.roleForm.permissions = Array.from(new Set([...matchedIds]));
    }

    // اگر در حال ایجاد نقش جدید هستیم و فیلدها خالی هستند، مشخصات قالب را پر کند
    if (!this.editingRole && (!this.roleForm.title || !this.roleForm.name)) {
      this.roleForm.title = preset.title.split('/')[0].trim();
      this.roleForm.name = preset.id;
      this.roleForm.color = preset.color;
    }

    this.isPresetsExpanded = false;
    this.toast.show(
      'success',
      `قالب «${preset.title}» اعمال شد (${this.roleForm.permissions.length} مجوز انتخاب گردید).`
    );
    this.cdr.detectChanges();
  }

  getGroupPermissionCount(groupKey: string): { selected: number, total: number } {
    const group = this.systemPermissionGroups.find(g => g.key === groupKey);
    if (!group || !group.items) return { selected: 0, total: 0 };
    const selectedIds = new Set(this.roleForm.permissions || []);
    const selectedCount = group.items.filter(p => selectedIds.has(p.id)).length;
    return { selected: selectedCount, total: group.items.length };
  }

  get filteredPermissionGroups() {
    if (!this.permSearchQuery.trim()) {
      return this.systemPermissionGroups;
    }
    const q = this.permSearchQuery.trim().toLowerCase();
    return this.systemPermissionGroups.map(group => ({
      ...group,
      items: group.items.filter((p: any) => 
        (p.name && p.name.toLowerCase().includes(q)) || 
        (this.getShortPermissionName(p) && this.getShortPermissionName(p).toLowerCase().includes(q)) ||
        (p.codename && p.codename.toLowerCase().includes(q))
      )
    })).filter(group => group.items.length > 0);
  }

  toggleRolePermission(perm: Permission, event: Event) {
    const target = event.target as HTMLInputElement;
    const isCurrentlyChecked = this.roleForm.permissions.includes(perm.id);

    if (perm.is_sensitive) {
      if (!this.isSuperuser()) {
        event.preventDefault();
        target.checked = isCurrentlyChecked;
        this.toast.show('error', 'تخصیص یا تغییر دسترسی‌های حساس و بحرانی صرفاً در انحصار مدیر ارشد سامانه (Superuser) می‌باشد.');
        return;
      }

      if (!isCurrentlyChecked) {
        // User clicked to check a sensitive permission -> prevent instant check & open warning modal
        event.preventDefault();
        target.checked = false;
        this.pendingSensitivePerm = perm;
        this.isSensitiveWarningModalOpen = true;
      } else {
        // Uncheck directly
        this.roleForm.permissions = this.roleForm.permissions.filter((id: number) => id !== perm.id);
      }
    } else {
      if (target.checked) {
        if (!this.roleForm.permissions.includes(perm.id)) this.roleForm.permissions.push(perm.id);
      } else {
        this.roleForm.permissions = this.roleForm.permissions.filter((id: number) => id !== perm.id);
      }
    }
  }

  confirmSensitivePermission() {
    if (this.pendingSensitivePerm) {
      if (!this.roleForm.permissions.includes(this.pendingSensitivePerm.id)) {
        this.roleForm.permissions.push(this.pendingSensitivePerm.id);
      }
      this.toast.show('warning', `دسترسی حساس «${this.pendingSensitivePerm.name}» به این نقش اضافه شد.`);
    }
    this.isSensitiveWarningModalOpen = false;
    this.pendingSensitivePerm = null;
    this.cdr.detectChanges();
  }

  cancelSensitivePermission() {
    this.isSensitiveWarningModalOpen = false;
    this.pendingSensitivePerm = null;
    this.cdr.detectChanges();
  }

  toggleAllPermissions() {
    // Only toggle normal/non-sensitive permissions. Sensitive permissions are NEVER selected by toggleAll.
    const normalPermIds = this.systemPermissions.filter(p => !p.is_sensitive).map(p => p.id);
    const hasAllNormal = normalPermIds.every(id => this.roleForm.permissions.includes(id));
    
    if (hasAllNormal) {
      this.roleForm.permissions = this.roleForm.permissions.filter(id => !normalPermIds.includes(id));
      this.toast.show('info', 'کلیه دسترسی‌های عمومی لغو شدند.');
    } else {
      const newPerms = new Set([...this.roleForm.permissions, ...normalPermIds]);
      this.roleForm.permissions = Array.from(newPerms);
      this.toast.show('info', 'کلیه دسترسی‌های عمومی انتخاب شدند (دسترسی‌های حساس مستثنی هستند).');
    }
  }

  toggleGroupPermissions(groupKey: string) {
    if (groupKey === 'SENSITIVE') {
      this.toast.show('warning', 'دسترسی‌های حساس و بحرانی قابلیت انتخاب گروهی ندارند و صرفاً باید به صورت دستی و تک‌به‌تک اعطا شوند.');
      return;
    }
    const group = this.systemPermissionGroups.find(g => g.key === groupKey);
    if (!group) return;
    
    const groupPermIds = group.items.map((p: any) => p.id);
    const hasAll = groupPermIds.every((id: number) => this.roleForm.permissions.includes(id));
    
    if (hasAll) {
      this.roleForm.permissions = this.roleForm.permissions.filter((id: number) => !groupPermIds.includes(id));
    } else {
      const newPerms = new Set([...this.roleForm.permissions, ...groupPermIds]);
      this.roleForm.permissions = Array.from(newPerms);
    }
  }

  saveRole() {
    const payload = {
        name: this.roleForm.name.trim(),
        title: this.roleForm.title.trim(),
        color: this.roleForm.color,
        parent: this.roleForm.parent !== null && this.roleForm.parent !== undefined ? this.roleForm.parent : null,
        permissions: this.roleForm.permissions,
        user_ids: this.roleForm.user_ids || []
    };

    if (!payload.name || !payload.title) return this.toast.show('error', 'عنوان و کد سیستمی نقش الزامی است.');

    const syncUsersLocalRoles = (roleId: number, targetUserIds: number[]) => {
      const targetSet = new Set(targetUserIds);
      (this.state.appState.users || []).forEach((u: any) => {
        if (!u.groups) u.groups = [];
        const hasRole = u.groups.includes(roleId);
        const shouldHave = targetSet.has(u.id);
        if (shouldHave && !hasRole) {
          u.groups.push(roleId);
        } else if (!shouldHave && hasRole) {
          u.groups = u.groups.filter((gid: number) => gid !== roleId);
        }
      });
    };

    if (this.editingRole) {
      this.accountsService.updateRole(this.editingRole.id, payload).subscribe({
        next: (res) => {
          Object.assign(this.editingRole, res);
          this.editingRole.user_ids = [...(payload.user_ids || [])];
          syncUsersLocalRoles(this.editingRole.id, payload.user_ids || []);
          this.toast.show('success', 'نقش، دسترسی‌ها و اعضای منتسب با موفقیت بروزرسانی شد.');
          this.isRoleModalOpen = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          const msg = err.error?.detail || err.error?.error || (typeof err.error === 'object' ? Object.values(err.error).flat().join(' ') : 'خطا در ویرایش نقش');
          this.toast.show('error', msg);
        }
      });
    } else {
      this.accountsService.createRole(payload).subscribe({
        next: (res) => {
          res.user_ids = [...(payload.user_ids || [])];
          this.state.appState.roles.push(res);
          syncUsersLocalRoles(res.id, payload.user_ids || []);
          this.toast.show('success', 'نقش جدید به همراه اعضای منتسب ایجاد شد.');
          this.isRoleModalOpen = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          const msg = err.error?.detail || err.error?.error || (typeof err.error === 'object' ? Object.values(err.error).flat().join(' ') : 'خطا در ایجاد نقش');
          this.toast.show('error', msg);
        }
      });
    }
  }

  deleteRole(id: number) {
    const role = this.state.appState.roles.find((r: any) => r.id === id);
    if (!role) return;

    this.entityToDelete = role;
    this.deleteType = 'role';
    this.deleteImpactUrl = `${environment.apiUrl}/auth/roles/${id}/delete_impact/`;
    this.isDeleteModalOpen = true;
    this.isDeleting = false;
    this.deleteErrorMessage = '';
    this.cdr.detectChanges();
  }

  deleteUser(id: number) {
    const user = this.state.appState.users.find((u: any) => u.id === id);
    if (!user) return;

    this.entityToDelete = user;
    this.deleteType = 'user';
    this.deleteImpactUrl = `${environment.apiUrl}/auth/users/${id}/delete_impact/`;
    this.isDeleteModalOpen = true;
    this.isDeleting = false;
    this.deleteErrorMessage = '';
    this.cdr.detectChanges();
  }

  handleHardDelete() {
    if (!this.entityToDelete) return;
    const id = this.entityToDelete.id;
    this.isDeleting = true;
    this.deleteErrorMessage = '';
    
    if (this.deleteType === 'role') {
        this.accountsService.deleteRole(id).subscribe({
            next: () => {
                this.state.appState.roles = this.state.appState.roles.filter((r: any) => r.id !== id);
                this.state.appState.users.forEach((u: any) => {
                    if (u.groups && u.groups.includes(id)) {
                        u.groups = u.groups.filter((gId: number) => gId !== id);
                    }
                });
                this.toast.show('success', 'نقش مورد نظر حذف و دسترسی کاربران مرتبط بروزرسانی شد.');
                this.isDeleteModalOpen = false;
                this.entityToDelete = null;
                this.isDeleting = false;
                this.cdr.detectChanges();
            },
            error: (err) => {
                this.deleteErrorMessage = err.error?.error || err.error?.detail || (typeof err.error === 'string' ? err.error : 'خطا در حذف نقش');
                this.isDeleting = false;
            }
        });
    } else {
        this.accountsService.deleteUser(id).subscribe({
            next: () => {
                this.state.appState.users = this.state.appState.users.filter((u: any) => u.id !== id);
                this.toast.show('success', 'حساب کاربری برای همیشه حذف شد.');
                this.isDeleteModalOpen = false;
                this.entityToDelete = null;
                this.isDeleting = false;
                this.cdr.detectChanges();
            },
            error: (err) => {
                this.deleteErrorMessage = err.error?.error || err.error?.detail || (typeof err.error === 'string' ? err.error : 'این کاربر به دلیل داشتن تراکنش یا تاریخچه سیستم قابل حذف فیزیکی نیست. می‌توانید آن را تعلیق کنید.');
                this.isDeleting = false;
            }
        });
    }
  }

  formatDate(dStr: string) {
    if (!dStr) return '';
    try {
      return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(dStr));
    } catch {
      return dStr;
    }
  }

  getRoleTitleForForm(r: any) {
    return r.title || r.name;
  }

  getRoleAppScope(r: any): 'warehouse' | 'finance' | 'global' {
    const permIds: number[] = Array.isArray(r.permissions) ? r.permissions : [];
    const permCodenames: string[] = permIds
      .map(id => this.permIdToCodenameMap.get(id))
      .filter((c): c is string => typeof c === 'string');

    const whMarkers = this.registry.permissionMarkers('warehouse');
    const finMarkers = this.registry.permissionMarkers('accounting');

    const hasWh = permCodenames.some(p => whMarkers.includes(p));
    const hasFin = permCodenames.some(p => finMarkers.includes(p));

    if (hasWh && hasFin) return 'global';
    if (hasWh) return 'warehouse';
    if (hasFin) return 'finance';

    // fallback به عناوین قدیمی برای نقش‌های بدون پرمیشن ست‌شده
    const name = (r.name || '').toLowerCase();
    const title = (r.title || '').toLowerCase();
    if (name === 'admin' || name === 'superuser' || title.includes('مدیر کل') || title.includes('مدیر ارشد') || title.includes('ادمین')) {
      return 'global';
    }
    if (name.includes('warehouse') || title.includes('انبار') || title.includes('شمارش')) {
      return 'warehouse';
    }
    if (name.includes('finance') || name.includes('payroll') || title.includes('مالی') || title.includes('حقوق')) {
      return 'finance';
    }
    return 'global';
  }

  getFilteredRolesForModal(tab: 'all' | 'warehouse' | 'finance' | 'global'): any[] {
    const roles = this.state.appState.roles || [];
    if (tab === 'all') return roles;
    return roles.filter((r: any) => this.getRoleAppScope(r) === tab);
  }

  getSelectedRolesCountForScope(scope: 'warehouse' | 'finance' | 'global'): number {
    const selectedIds = this.userForm.groups || [];
    const roles = this.state.appState.roles || [];
    return roles.filter((r: any) => selectedIds.includes(r.id) && this.getRoleAppScope(r) === scope).length;
  }

  // ── Excel Import/Export ──────────────────────────────────────────
  private triggerDownload(blob: Blob, filename: string) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  exportUsersExcel(ids?: number[]) {
    this.accountsService.exportUsersExcel(ids).subscribe({
      next: (blob) => {
        const filename = ids && ids.length > 0 ? `users_export_${ids.length}_selected.xlsx` : 'users_export.xlsx';
        this.triggerDownload(blob, filename);
        this.toast.show('success', 'فایل اکسل کاربران با موفقیت دانلود شد.');
      },
      error: () => {
        this.toast.show('error', 'خطا در دانلود فایل اکسل کاربران.');
      }
    });
  }

  openUsersImportModal() {
    this.excelModalTitle = 'آپلود دسته‌جمعی کاربران';
    this.excelImportFn = (file: File, updateExisting: boolean, dryRun?: boolean) => this.accountsService.importUsersExcel(file, updateExisting, dryRun || false);
    this.excelTemplateFn = () => this.downloadUsersTemplate();
    this.isExcelModalOpen = true;
    this.cdr.detectChanges();
  }

  downloadUsersTemplate() {
    this.accountsService.downloadUsersTemplate().subscribe({
      next: (blob) => {
        this.triggerDownload(blob, 'users_template.xlsx');
      },
      error: () => {
        this.toast.show('error', 'خطا در دانلود قالب اکسل کاربران.');
      }
    });
  }

  exportRolesExcel() {
    this.accountsService.exportRolesExcel().subscribe({
      next: (blob) => {
        this.triggerDownload(blob, 'roles_export.xlsx');
        this.toast.show('success', 'فایل اکسل نقش‌ها با موفقیت دانلود شد.');
      },
      error: () => {
        this.toast.show('error', 'خطا در دانلود فایل اکسل نقش‌ها.');
      }
    });
  }

  openRolesImportModal() {
    this.excelModalTitle = 'آپلود دسته‌جمعی نقش‌ها';
    this.excelImportFn = (file: File, updateExisting: boolean, dryRun?: boolean) => this.accountsService.importRolesExcel(file, updateExisting, dryRun || false);
    this.excelTemplateFn = () => this.downloadRolesTemplate();
    this.isExcelModalOpen = true;
    this.cdr.detectChanges();
  }

  downloadRolesTemplate() {
    this.accountsService.downloadRolesTemplate().subscribe({
      next: (blob) => {
        this.triggerDownload(blob, 'roles_template.xlsx');
      },
      error: () => {
        this.toast.show('error', 'خطا در دانلود قالب اکسل نقش‌ها.');
      }
    });
  }

  exportIdCardsExcel() {
    const selectedIds = this.idCardsComponent ? Array.from(this.idCardsComponent.selectedUserIds) : [];
    this.accountsService.exportIdCardsExcel(selectedIds).subscribe({
      next: (blob) => {
        this.triggerDownload(blob, 'id_cards_export.xlsx');
        const countMsg = selectedIds.length > 0 ? `(${selectedIds.length} نفر انتخاب‌شده)` : 'کل پرسنل انبار';
        this.toast.show('success', `فایل اکسل کارت‌های پرسنلی ${countMsg} با موفقیت دانلود شد.`);
      },
      error: () => {
        this.toast.show('error', 'خطا در دانلود فایل اکسل کارت‌های پرسنلی.');
      }
    });
  }

  onExcelImported(result: ImportResult) {
    if (result.success) {
      const parts = [];
      if (result.summary.created > 0) parts.push(`${result.summary.created} رکورد ایجاد شد`);
      if (result.summary.updated && result.summary.updated > 0) parts.push(`${result.summary.updated} رکورد به‌روزرسانی شد`);
      if (parts.length > 0) {
        this.toast.show('success', parts.join(' و ') + '.');
      }
      this.loadData();
    }
  }

  closeExcelModal() {
    this.isExcelModalOpen = false;
    this.cdr.detectChanges();
  }
}
