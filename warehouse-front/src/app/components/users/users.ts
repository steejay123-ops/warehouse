import { Component, OnInit, OnDestroy, ChangeDetectorRef, HostListener, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '../../services/state.service';
import { ToastService } from '../../services/toast.service';
import { AuthService } from '../../core/auth/auth.service';
import { AccountsHttpService, User, Role, Permission, ImportResult } from '../../core/http/accounts-http.service';
import { WarehouseHttpService } from '../../core/http/warehouse-http.service';
import { ClickOutsideDirective } from '../../shared/directives/click-outside.directive';
import { IdCards } from '../id-cards/id-cards';
import { ConfirmDialogService } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { ExcelImportModal } from '../../shared/components/excel-import-modal/excel-import-modal';
import { SmartDeleteModalComponent } from '../../shared/components/smart-delete-modal/smart-delete-modal';
import { AvatarCropperModal } from '../../shared/components/avatar-cropper-modal/avatar-cropper-modal';
import { Observable, Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-users',
  imports: [CommonModule, FormsModule, ClickOutsideDirective, IdCards, ExcelImportModal, SmartDeleteModalComponent, AvatarCropperModal],
  templateUrl: './users.html',
  styleUrl: './users.css'
})
export class Users implements OnInit, OnDestroy {
  activeTab = 'users';
  activeRoleTab = 'custom';
  activePermTab = 'MAIN_MENU';
  userRoleModalTab: 'all' | 'warehouse' | 'finance' | 'global' = 'warehouse';
  searchQuery = '';
  searchSubject = new Subject<string>();
  private searchSub?: Subscription;
  
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
    id: null as number | null, name: '', title: '', parent: null as number | null, color: '#94a3b8', permissions: [] as number[]
  };

  // User Form
  editingUser: any = null;
  isDefaultExpiry = true;
  userForm = {
    id: null as number | null, first_name: '', last_name: '', national_code: '', username: '', phone_number: '', 
    operational_zone: '', supervisor: null as number | null, address: '', company: '', email: '', avatar: null as string | null, _pendingAvatarBlob: null as Blob | null, blood_type: '', emergency_contact: '', groups: [] as number[], assigned_warehouses: [] as string[], expiry_date: '',
    date_joined: '', last_login: '', is_active: true, is_superuser: false, expiryDays: 90
  };

  // Quick Role Presets / Templates for One-Click Permission Granting
  readonly ROLE_PRESETS = [
    {
      id: 'manager',
      title: 'مدیر شرکت / مدیرعامل',
      color: '#7c3aed',
      icon: '👑',
      description: 'دسترسی کامل مدیریتی، تاییدات کارکرد، صدور مجوز پرداخت، مانیتورینگ و گزارش‌ها',
      permissionCodenames: [
        'view_sys_dashboard', 'view_sys_users', 'view_sys_projects', 'view_sys_reports',
        'view_sys_personnel', 'view_sys_personnel_attendance', 'view_sys_fleet_attendance',
        'view_sys_payroll', 'view_sys_fleet_settlement', 'view_sys_treasury',
        'view_wh_dashboard', 'view_sys_manager_review', 'view_sys_supervisor', 'view_sys_recounts', 'view_wh_customs',
        'perm_approve_personnel_manager', 'perm_approve_fleet_manager', 'perm_manager_payment_authorize',
        'perm_lock_work_period', 'perm_inventory_finalize', 'can_act_as_manager'
      ]
    },
    {
      id: 'accountant',
      title: 'حسابدار / مالی و حقوق',
      color: '#059669',
      icon: '💳',
      description: 'محاسبات حقوق و دستمزد، کارتابل مالی، تسویه ناوگان، پرونده‌ها و تایید مرحله مالی',
      permissionCodenames: [
        'view_sys_personnel', 'view_sys_payroll', 'view_sys_fleet_settlement',
        'view_sys_personnel_attendance', 'view_sys_fleet_attendance',
        'perm_approve_personnel_finance', 'perm_approve_fleet_finance', 'can_act_as_accountant'
      ]
    },
    {
      id: 'treasury',
      title: 'خزانه‌دار و پرداخت',
      color: '#d97706',
      icon: '🏦',
      description: 'کارتابل خزانه‌داری، اجرای واریز پایا/چک، مشاهده مبالغ مصوب حقوق و تسویه',
      permissionCodenames: [
        'view_sys_treasury', 'perm_treasury_disburse_action', 'view_sys_payroll', 'view_sys_personnel'
      ]
    },
    {
      id: 'supervisor',
      title: 'سرپرست انبار / اجرا',
      color: '#2563eb',
      icon: '📋',
      description: 'ثبت و تایید کارکرد میدانی پرسنل و ناوگان، کارتابل سرپرست شمارش، تخصیص کالا',
      permissionCodenames: [
        'view_sys_personnel_attendance', 'view_sys_fleet_attendance', 'view_wh_attendance',
        'view_wh_dashboard', 'view_wh_docs', 'view_wh_dispatch', 'view_sys_supervisor', 'view_sys_counter',
        'perm_approve_personnel_supervisor', 'perm_approve_fleet_supervisor', 'can_act_as_supervisor'
      ]
    },
    {
      id: 'counter',
      title: 'انبارگردان / شمارشگر',
      color: '#0284c7',
      icon: '🔢',
      description: 'میزکار شمارش کور فیزیکی، اسکن بارکد و ثبت تگ‌ها بدون دسترسی به مبالغ مالی',
      permissionCodenames: [
        'view_sys_counter', 'can_act_as_counter'
      ]
    },
    {
      id: 'docs_auditor',
      title: 'مسئول اسناد و انبار',
      color: '#0d9488',
      icon: '📑',
      description: 'مدیریت کالا، تایید اسناد وارده و صادره، ممیزی و رهگیری تگ‌ها',
      permissionCodenames: [
        'view_wh_docs', 'view_wh_dispatch', 'view_wh_doc_approvals', 'view_wh_audit', 'perm_doc_approve_action'
      ]
    },
    {
      id: 'operator',
      title: 'کارمند / اپراتور ثبت',
      color: '#64748b',
      icon: '👤',
      description: 'ثبت اولیه روزهای کارکرد و حضور غیاب پرسنل و ماشین‌آلات',
      permissionCodenames: [
        'view_sys_personnel_attendance', 'view_sys_fleet_attendance', 'can_act_as_operator'
      ]
    },
    {
      id: 'admin_all',
      title: 'مدیر کل سیستم (همه دسترسی‌ها)',
      color: '#4f46e5',
      icon: '⚡',
      description: 'اعطای ۱۰۰٪ تمام دسترسی‌های سیستمی، عملیاتی، مالی و فرآیندی',
      permissionCodenames: 'ALL'
    }
  ];

  systemPermissions: Permission[] = [];
  systemPermissionGroups: { key: string, title: string, items: Permission[], is_sensitive_group?: boolean }[] = [];
  permSearchQuery = '';
  isLoading = false;

  // Sensitive Permissions Guard Modal
  pendingSensitivePerm: Permission | null = null;
  isSensitiveWarningModalOpen = false;
  isSuperuser = computed(() => !!(this.auth.user()?.is_superuser || this.auth.user()?.roles?.includes('admin') || this.auth.user()?.department === 'admin'));

  // Excel Import/Export
  isExcelModalOpen = false;
  excelModalTitle = '';
  excelImportFn!: (file: File, updateExisting: boolean) => Observable<ImportResult>;
  excelTemplateFn!: () => void;

  constructor(
    public state: StateService,
    public auth: AuthService,
    private toast: ToastService, 
    private accountsService: AccountsHttpService, 
    private whService: WarehouseHttpService,
    private cdr: ChangeDetectorRef,
    private confirmDialog: ConfirmDialogService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe((params: any) => {
      this.activeTab = params['tab'] || 'users';
      this.activeRoleTab = params['roleTab'] || 'custom';
      this.activePermTab = params['permTab'] || 'PERSONNEL_FINANCE';
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

      const sysPersonnelPerms = [
        'view_sys_personnel', 'view_sys_personnel_attendance', 'view_sys_fleet_attendance',
        'view_sys_payroll', 'view_sys_fleet_settlement', 'view_sys_treasury'
      ];
      const sysGeneralPerms = [
        'view_sys_dashboard', 'view_sys_users', 'view_sys_projects', 'view_sys_id_cards',
        'view_sys_settings', 'view_sys_reports'
      ];
      const sysWarehousePerms = [
        'view_wh_dashboard', 'view_wh_docs', 'view_wh_dispatch', 'view_sys_counter',
        'view_wh_customs', 'view_sys_supervisor', 'view_sys_manager_review', 'view_sys_recounts',
        'view_wh_attendance', 'view_wh_doc_approvals', 'view_wh_feeding', 'view_wh_feed_approvals',
        'view_wh_labels', 'view_wh_label_designer', 'view_wh_audit', 'view_wh_settings'
      ];

      const generalMenuPerms = res.filter((p: any) => sysGeneralPerms.includes(p.codename) && !p.is_sensitive);
      const personnelMenuPerms = res.filter((p: any) => sysPersonnelPerms.includes(p.codename) && !p.is_sensitive);
      const warehouseMenuPerms = res.filter((p: any) => sysWarehousePerms.includes(p.codename) && !p.is_sensitive);
      
      const workflowPerms = res.filter((p: any) => 
        (p.codename.startsWith('perm_approve_') || 
         p.codename.startsWith('perm_manager_') || 
         p.codename.startsWith('perm_treasury_') || 
         p.codename.startsWith('perm_doc_') || 
         p.codename.startsWith('perm_feed_') || 
         p.codename.startsWith('perm_lock_') || 
         p.codename.startsWith('perm_inventory_') || 
         p.codename.startsWith('can_act_as_')) && !p.is_sensitive
      );

      const otherPerms = res.filter((p: any) => 
        !p.is_sensitive && 
        !generalMenuPerms.includes(p) && 
        !personnelMenuPerms.includes(p) && 
        !warehouseMenuPerms.includes(p) && 
        !workflowPerms.includes(p)
      );

      const groups: { key: string, title: string, items: Permission[], is_sensitive_group?: boolean }[] = [
        {
          key: 'PERSONNEL_FINANCE',
          title: 'کارکرد، حقوق و خزانه‌داری 💳',
          items: personnelMenuPerms
        },
        {
          key: 'WH_MENU',
          title: 'عملیات انبار و شمارش 📦',
          items: warehouseMenuPerms
        },
        {
          key: 'WORKFLOW',
          title: 'تاییدات و کارتابل‌ها 📋',
          items: workflowPerms
        },
        {
          key: 'MAIN_MENU',
          title: 'مدیریت و کلان سیستم ⚙️',
          items: generalMenuPerms
        },
        {
          key: 'BACKEND',
          title: 'سایر دسترسی‌ها 📑',
          items: otherPerms
        },
        {
          key: 'SENSITIVE',
          title: 'حساس و بحرانی 🛡️',
          items: sensitivePerms,
          is_sensitive_group: true
        }
      ];

      this.systemPermissionGroups = groups.filter(g => g.items.length > 0);
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
        setTimeout(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        }, 400);
      },
      error: (err) => {
        setTimeout(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        }, 400);
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

  get filteredUsers() {
    const q = this.searchQuery.trim().toLowerCase();
    const users = Array.isArray(this.state.appState.users) ? this.state.appState.users : [];
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

  get rootRoles() {
    const roles = Array.isArray(this.state.appState.roles) ? this.state.appState.roles : [];
    const allIds = new Set(roles.map((r: any) => r.id));
    return roles.filter((r: any) => !r.parent || !allIds.has(r.parent));
  }

  getRoleChildren(parentId: number) {
    const roles = Array.isArray(this.state.appState.roles) ? this.state.appState.roles : [];
    return roles.filter((r: any) => r.parent === parentId);
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
    const users = Array.isArray(this.state.appState.users) ? this.state.appState.users : [];
    return users.filter((u: any) => Array.isArray(u.groups) && u.groups.includes(roleId)).length;
  }

  getPrimaryRole(u: any) {
    const userRolesArr = u.groups || [];
    const r = this.state.appState.roles?.find((r: any) => r.id === userRolesArr[0]);
    if (!r) return {name: 'نامشخص', color: '#94a3b8'};
    return { name: r.title || r.name, color: r.color || '#94a3b8' };
  }

  getUserRoles(u: any) {
    const userRolesArr = u.groups || [];
    return userRolesArr.map((rId: any) => {
      const r = this.state.appState.roles?.find((r: any) => r.id === rId);
      if (!r) return {name: 'نامشخص', color: '#94a3b8'};
      return { name: r.title || r.name, color: r.color || '#94a3b8' };
    });
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
    this.router.navigate([], { queryParams: { permTab: tab }, queryParamsHandling: 'merge' });
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
    if (this.targetUserForAvatar && this.targetUserForAvatar.id) {
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
    } else {
      this.userForm._pendingAvatarBlob = blob;
      const previewUrl = URL.createObjectURL(blob);
      this.userForm.avatar = previewUrl;
      this.isAvatarCropperOpen = false;
      this.toast.show('success', 'تصویر انتخاب شد و پس از ذخیره فرم اعمال می‌گردد.');
      this.cdr.detectChanges();
    }
  }

  onRemoveUserAvatar() {
    if (this.targetUserForAvatar && this.targetUserForAvatar.id) {
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
    } else {
      this.userForm._pendingAvatarBlob = null;
      this.userForm.avatar = null;
      this.isAvatarCropperOpen = false;
      this.toast.show('success', 'تصویر حذف شد.');
      this.cdr.detectChanges();
    }
  }

  openUserModal(id: number | null = null) {
    this.closeMenus();
    if (id) {
      const u = this.state.appState.users.find((x: any) => x.id === id);
      this.editingUser = u;
      this.userForm = { 
        ...u,
        company: u.company || '',
        address: u.address || '',
        email: u.email || '',
        avatar: u.avatar || null,
        _pendingAvatarBlob: null,
        blood_type: u.blood_type || '',
        emergency_contact: u.emergency_contact || '',
        operational_zone: u.operational_zone || '',
        supervisor: u.supervisor || null,
        expiryDays: 90
      };
      if (!this.userForm.groups) this.userForm.groups = [];
      if (!this.userForm.assigned_warehouses) this.userForm.assigned_warehouses = [];
      this.isDefaultExpiry = true;
    } else {
      this.editingUser = null;
      this.isDefaultExpiry = true;
      this.userForm = {
        id: null, first_name: '', last_name: '', national_code: '', username: '', phone_number: '', 
        operational_zone: '', supervisor: null, address: '', company: '', email: '', avatar: null, _pendingAvatarBlob: null, blood_type: '', emergency_contact: '', groups: [], assigned_warehouses: [], expiry_date: '',
        date_joined: '', last_login: '', is_active: true, is_superuser: false, expiryDays: 90
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

  toggleUserProjCheckbox(projId: string, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      if (!this.userForm.assigned_warehouses.includes(projId)) this.userForm.assigned_warehouses.push(projId);
    } else {
      this.userForm.assigned_warehouses = this.userForm.assigned_warehouses.filter((id: string) => id !== projId);
    }
  }

  saveUser() {
    if (!this.userForm.first_name || !this.userForm.last_name || !this.userForm.username) {
      return this.toast.show('error', 'وارد کردن نام، نام خانوادگی و شناسه ورود الزامی است.');
    }

    const normalizeDigits = (str: string) => {
      return (str || '')
        .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
        .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
        .replace(/[\s\-_]/g, '')
        .trim();
    };

    let phone = normalizeDigits(this.userForm.phone_number);
    if (phone) {
      if (phone.startsWith('+98')) phone = '0' + phone.substring(3);
      else if (phone.startsWith('0098')) phone = '0' + phone.substring(4);
      else if (phone.startsWith('98') && phone.length === 12) phone = '0' + phone.substring(2);
      else if (phone.startsWith('9') && phone.length === 10) phone = '0' + phone;
    }

    if (!this.editingUser && !phone) {
      return this.toast.show('error', 'وارد کردن شماره تلفن همراه برای تعریف کاربر جدید الزامی است.');
    }

    if (phone && !/^09\d{9}$/.test(phone)) {
      return this.toast.show('error', 'فرمت شماره همراه نامعتبر است. شماره همراه باید با 09 شروع شده و ۱۱ رقم باشد (مانند 09123456789).');
    }

    const pendingBlob = this.userForm._pendingAvatarBlob;
    const payload: any = { ...this.userForm };
    delete payload._pendingAvatarBlob;
    delete payload.avatar; // Avatar is uploaded via dedicated endpoint
    if (!payload.national_code) payload.national_code = null;
    if (!payload.supervisor) payload.supervisor = null;
    payload.phone_number = phone || null;
    payload.email = payload.email ? payload.email.trim() : '';
    if (!payload.company) payload.company = null;
    if (!payload.address) payload.address = null;
    if (!payload.operational_zone) payload.operational_zone = null;

    if (this.editingUser) {
      this.accountsService.updateUser(this.editingUser.id, payload).subscribe({
        next: (res) => {
          Object.assign(this.editingUser, res);
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
      this.accountsService.createUser(payload).subscribe({
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
    if (id) {
      const r = this.state.appState.roles.find((x: any) => x.id === id);
      this.editingRole = r;
      this.roleForm = { 
        id: r.id, 
        name: r.name, 
        title: r.title || r.name, 
        parent: r.parent !== null && r.parent !== undefined ? r.parent : null, 
        color: r.color || '#94a3b8', 
        permissions: r.permissions ? [...r.permissions] : [] 
      };
    } else {
      this.editingRole = null;
      this.roleForm = { id: null, name: '', title: '', parent: null, color: '#94a3b8', permissions: [] };
    }
    this.activePermTab = 'PERSONNEL_FINANCE';
    this.isRoleModalOpen = true;
    this.cdr.detectChanges();
  }

  applyRolePreset(preset: any) {
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

    this.toast.show(
      'success',
      `قالب «${preset.title}» اعمال شد (${this.roleForm.permissions.length} مجوز انتخاب گردید).`
    );
    this.cdr.detectChanges();
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
        permissions: this.roleForm.permissions
    };

    if (!payload.name || !payload.title) return this.toast.show('error', 'عنوان و کد سیستمی نقش الزامی است.');

    if (this.editingRole) {
      this.accountsService.updateRole(this.editingRole.id, payload).subscribe({
        next: (res) => {
          Object.assign(this.editingRole, res);
          this.toast.show('success', 'نقش و دسترسی‌های آن با موفقیت بروزرسانی شد.');
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
          this.state.appState.roles.push(res);
          this.toast.show('success', 'نقش جدید به همراه ماتریس دسترسی ایجاد شد.');
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
    this.deleteImpactUrl = `/api/auth/roles/${id}/delete_impact/`;
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
    this.deleteImpactUrl = `/api/auth/users/${id}/delete_impact/`;
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
    const name = (r.name || '').toLowerCase();
    const title = (r.title || '').toLowerCase();
    
    if (name === 'admin' || name === 'superuser' || title.includes('مدیر کل') || title.includes('مدیر ارشد') || title.includes('ادمین')) {
      return 'global';
    }
    
    // قلمرو مالی و پرسنلی (Finance & Personnel)
    if (
      name === 'hesabdar' || name === 'accountant' || name === 'treasury' || name === 'operator' ||
      name.includes('personnel') || name.includes('payroll') || name.includes('finance') ||
      title.includes('حسابدار') || title.includes('مالی') || title.includes('حقوق') ||
      title.includes('خزانه') || title.includes('پرسنل') || title.includes('کارکرد')
    ) {
      return 'finance';
    }
    
    // قلمرو انبارداری و شمارش (Warehouse & Inventory)
    if (
      name === 'counter' || name.startsWith('doc_') || name.includes('warehouse') ||
      name.includes('supervisor') || title.includes('انبار') || title.includes('شمارش') ||
      title.includes('اسناد') || title.includes('تطبیق')
    ) {
      return 'warehouse';
    }

    return 'warehouse';
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

  exportUsersExcel() {
    this.accountsService.exportUsersExcel().subscribe({
      next: (blob) => {
        this.triggerDownload(blob, 'users_export.xlsx');
        this.toast.show('success', 'فایل اکسل کاربران با موفقیت دانلود شد.');
      },
      error: () => {
        this.toast.show('error', 'خطا در دانلود فایل اکسل کاربران.');
      }
    });
  }

  openUsersImportModal() {
    this.excelModalTitle = 'آپلود دسته‌جمعی کاربران';
    this.excelImportFn = (file: File, updateExisting: boolean) => this.accountsService.importUsersExcel(file, updateExisting);
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
    this.excelImportFn = (file: File, updateExisting: boolean) => this.accountsService.importRolesExcel(file, updateExisting);
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
