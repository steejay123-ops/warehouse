import { Injectable, signal, computed, inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { Router } from '@angular/router';

export type AppModuleType = 'warehouse' | 'personnel';

export interface RolePersona {
  code: string;
  title: string;
  app: AppModuleType;
  badgeColor: string;
  bgClass: string;
  icon: string;
  tierLevel: number;
}

export const ALL_APP_ROLES: RolePersona[] = [
  // --- Personnel / Payroll / Treasury Roles ---
  {
    code: 'operator',
    title: 'کارمند',
    app: 'personnel',
    badgeColor: '#64748b',
    bgClass: 'bg-slate-600',
    icon: '👤',
    tierLevel: 1
  },
  {
    code: 'supervisor',
    title: 'سرپرست',
    app: 'personnel',
    badgeColor: '#2563eb',
    bgClass: 'bg-blue-600',
    icon: '📋',
    tierLevel: 2
  },
  {
    code: 'accountant',
    title: 'حسابدار',
    app: 'personnel',
    badgeColor: '#059669',
    bgClass: 'bg-emerald-600',
    icon: '💳',
    tierLevel: 3
  },
  {
    code: 'manager',
    title: 'مدیر',
    app: 'personnel',
    badgeColor: '#7c3aed',
    bgClass: 'bg-purple-600',
    icon: '👑',
    tierLevel: 4
  },
  {
    code: 'treasury',
    title: 'خزانه‌دار',
    app: 'personnel',
    badgeColor: '#d97706',
    bgClass: 'bg-amber-600',
    icon: '🏦',
    tierLevel: 5
  },
  // --- Warehouse / Inventory Roles ---
  {
    code: 'counter',
    title: 'انبارگردان / شمارشگر کور',
    app: 'warehouse',
    badgeColor: '#0284c7',
    bgClass: 'bg-sky-600',
    icon: '🔢',
    tierLevel: 1
  },
  {
    code: 'warehouse_supervisor',
    title: 'سرپرست انبار و شمارش',
    app: 'warehouse',
    badgeColor: '#4f46e5',
    bgClass: 'bg-indigo-600',
    icon: '📦',
    tierLevel: 2
  },
  {
    code: 'docs_specialist',
    title: 'مسئول تطبیق و اسناد انبار',
    app: 'warehouse',
    badgeColor: '#0d9488',
    bgClass: 'bg-teal-600',
    icon: '📑',
    tierLevel: 3
  },
  {
    code: 'manager_review',
    title: 'ناظر عالی و بررسی مدیر',
    app: 'warehouse',
    badgeColor: '#9333ea',
    bgClass: 'bg-purple-600',
    icon: '🔍',
    tierLevel: 4
  },
  // --- Global Superuser ---
  {
    code: 'superuser',
    title: 'مدیر ارشد',
    app: 'personnel',
    badgeColor: '#e11d48',
    bgClass: 'bg-rose-600',
    icon: '⚡',
    tierLevel: 6
  }
];

// ماتریس محلی خطوط قرمز جهت پنهان‌سازی سریع در DOM فرانت‌اند (O(1))
export const FRONTEND_SOD_PROHIBITIONS: Record<string, string[]> = {
  'personnel:operator:/attendance': ['approve_attendance_period', 'lock_period'],
  'personnel:operator:/profiles': ['approve_personnel_profile', 'approve_vehicle_profile'],
  'personnel:operator:/finance-cartable': ['view_and_calculate_payroll', 'calculate_payroll', 'export_dsk'],
  'personnel:operator:/treasury-cartable': ['disburse_treasury_payment'],

  'personnel:supervisor:/profiles': ['edit_base_wage_and_bonuses'],
  'personnel:supervisor:/finance-cartable': ['approve_payroll_finance'],
  'personnel:supervisor:/treasury-cartable': ['disburse_treasury_payment'],

  'personnel:accountant:/attendance': ['create_daily_attendance_entry'],
  'personnel:accountant:/manager-approvals': ['authorize_manager_payment'],
  'personnel:accountant:/treasury-cartable': ['disburse_direct_payment'],

  'personnel:manager:/attendance': ['input_bulk_attendance_records'],
  'personnel:manager:/treasury-cartable': ['disburse_treasury_paya'],

  'personnel:treasury:/finance-cartable': ['modify_payroll_calculations'],
  'personnel:treasury:/profiles': ['modify_employment_contracts'],

  'warehouse:counter:/manager-review': ['finalize_inventory_count'],
  'warehouse:counter:/customs': ['view_customs_and_costs']
};

@Injectable({
  providedIn: 'root'
})
export class AppPersonaService {
  private auth = inject(AuthService);
  private router = inject(Router);

  // سیگنال ماژول فعال (انبارداری یا مالی)
  public activeApp = signal<AppModuleType>(
    (localStorage.getItem('active_app_module') as AppModuleType) || 'personnel'
  );

  // سیگنال کد نقش فعال
  public activeRole = signal<string>(
    localStorage.getItem('active_role_persona') || 'operator'
  );

  public isSuperuser(): boolean {
    const u = this.auth.user();
    const perms = this.auth.userPermissions();
    return Boolean(
      u?.is_superuser ||
      perms.includes('admin_all') ||
      u?.roles?.includes('admin') ||
      u?.roles?.includes('superuser')
    );
  }

  // بررسی دسترسی کاربر به سامانه انبارداری
  public hasWarehouseAccess = computed<boolean>(() => {
    if (this.isSuperuser()) return true;
    const perms = this.auth.userPermissions() || [];
    const warehousePerms = [
      'view_sys_dashboard', 'view_wh_dashboard', 'view_sys_counter',
      'view_sys_supervisor', 'view_sys_manager_review', 'view_wh_docs',
      'view_wh_dispatch', 'view_wh_customs', 'view_wh_doc_approvals',
      'view_wh_feeding', 'view_wh_feed_approvals', 'view_wh_labels',
      'view_wh_label_designer', 'view_wh_audit', 'view_wh_settings',
      'view_sys_recounts', 'view_sys_export', 'view_sys_reports',
      'perm_doc_approve_action', 'perm_feed_approve_action', 'perm_inventory_finalize',
      'perm_rec_import', 'perm_rec_recount', 'perm_rec_dispatch',
      'perm_wh_create', 'perm_wh_edit', 'perm_wh_freeze'
    ];
    return warehousePerms.some(p => perms.includes(p));
  });

  // بررسی دسترسی کاربر به سامانه مالی و کارکرد پرسنل
  public hasPersonnelAccess = computed<boolean>(() => {
    if (this.isSuperuser()) return true;
    const perms = this.auth.userPermissions() || [];
    const personnelPerms = [
      'view_sys_personnel', 'view_sys_personnel_attendance', 'view_sys_fleet_attendance',
      'view_sys_payroll', 'view_sys_fleet_settlement', 'view_sys_treasury',
      'perm_lock_work_period', 'perm_approve_personnel_supervisor', 'perm_approve_personnel_manager',
      'perm_approve_personnel_finance', 'perm_approve_fleet_supervisor', 'perm_approve_fleet_manager',
      'perm_approve_fleet_finance', 'perm_manager_payment_authorize', 'perm_treasury_disburse_action',
      'can_act_as_accountant', 'can_act_as_operator'
    ];
    return personnelPerms.some(p => perms.includes(p));
  });

  public canAccessApp(app: AppModuleType): boolean {
    if (this.isSuperuser()) return true;
    if (app === 'warehouse') return this.hasWarehouseAccess();
    if (app === 'personnel') return this.hasPersonnelAccess();
    return false;
  }

  // آیا کاربر مجوز سوئیچ بین دو سامانه را دارد؟ (نیازمند دسترسی به هر دو)
  public canSwitchApps = computed<boolean>(() => {
    return this.hasWarehouseAccess() && this.hasPersonnelAccess();
  });

  // لیست نقش‌های واجد شرایط کاربر در ماژول جاری
  public availableRoles = computed<RolePersona[]>(() => {
    const app = this.activeApp();
    const isSuper = this.isSuperuser();
    
    if (isSuper) {
      return ALL_APP_ROLES.filter(r => r.app === app || r.code === 'superuser');
    }

    if (app === 'warehouse' && !this.hasWarehouseAccess()) {
      return [];
    }
    if (app === 'personnel' && !this.hasPersonnelAccess()) {
      return [];
    }

    const perms = this.auth.userPermissions() || [];
    const roles: RolePersona[] = [];

    if (app === 'personnel') {
      if (perms.includes('view_sys_personnel_attendance') || perms.includes('view_sys_personnel')) {
        roles.push(ALL_APP_ROLES.find(r => r.code === 'operator')!);
      }
      if (perms.includes('perm_approve_personnel_supervisor') || perms.includes('perm_approve_fleet_supervisor') || perms.includes('view_sys_supervisor')) {
        roles.push(ALL_APP_ROLES.find(r => r.code === 'supervisor')!);
      }
      if (perms.includes('perm_approve_personnel_finance') || perms.includes('perm_approve_fleet_finance') || perms.includes('view_sys_payroll')) {
        roles.push(ALL_APP_ROLES.find(r => r.code === 'accountant')!);
      }
      if (perms.includes('perm_manager_payment_authorize') || perms.includes('can_act_as_manager') || perms.includes('perm_approve_personnel_manager')) {
        roles.push(ALL_APP_ROLES.find(r => r.code === 'manager')!);
      }
      if (perms.includes('perm_treasury_disburse_action') || perms.includes('view_sys_treasury')) {
        roles.push(ALL_APP_ROLES.find(r => r.code === 'treasury')!);
      }
    } else {
      // Warehouse App
      if (perms.includes('view_sys_counter') || perms.includes('view_wh_dispatch')) {
        roles.push(ALL_APP_ROLES.find(r => r.code === 'counter')!);
      }
      if (perms.includes('view_sys_supervisor') || perms.includes('view_wh_doc_approvals')) {
        roles.push(ALL_APP_ROLES.find(r => r.code === 'warehouse_supervisor')!);
      }
      if (perms.includes('view_wh_docs') || perms.includes('perm_doc_approve_action')) {
        roles.push(ALL_APP_ROLES.find(r => r.code === 'docs_specialist')!);
      }
      if (perms.includes('view_sys_manager_review') || perms.includes('perm_inventory_finalize')) {
        roles.push(ALL_APP_ROLES.find(r => r.code === 'manager_review')!);
      }
    }

    return roles.filter(Boolean);
  });

  // آیا کاربر چندنقشه است؟
  public isMultiRole = computed<boolean>(() => {
    return this.availableRoles().length > 1;
  });

  // شیء کامل نقش فعال جاری
  public currentPersona = computed<RolePersona>(() => {
    const code = this.activeRole();
    const app = this.activeApp();
    const match = ALL_APP_ROLES.find(r => r.code === code && (r.app === app || r.code === 'superuser'));
    return match || this.availableRoles()[0] || ALL_APP_ROLES[0];
  });

  constructor() {
    this.sanitizeActiveRole();
  }

  public sanitizeActiveRole(): void {
    const hasWh = this.hasWarehouseAccess();
    const hasPers = this.hasPersonnelAccess();

    if (!hasWh && hasPers && this.activeApp() !== 'personnel') {
      this.activeApp.set('personnel');
      localStorage.setItem('active_app_module', 'personnel');
    } else if (!hasPers && hasWh && this.activeApp() !== 'warehouse') {
      this.activeApp.set('warehouse');
      localStorage.setItem('active_app_module', 'warehouse');
    }

    const roles = this.availableRoles();
    const current = this.activeRole();
    const isValid = roles.some(r => r.code === current);
    
    if (!isValid && roles.length > 0) {
      this.switchRole(roles[0].code, false);
    }
  }

  public switchApp(app: AppModuleType): void {
    if (!this.canAccessApp(app)) {
      return;
    }

    this.activeApp.set(app);
    localStorage.setItem('active_app_module', app);
    
    // انتخاب اولین نقش مجاز در ماژول مقصد
    const roles = this.availableRoles();
    if (roles.length > 0) {
      this.switchRole(roles[0].code, false);
    }

    // ریدایرکت خودکار به صفحه پیش‌فرض اپلیکیشن مقصد
    if (app === 'warehouse') {
      this.router.navigate(['/app/warehouse/dashboard']);
    } else {
      const perms = this.auth.userPermissions() || [];
      if (perms.includes('perm_approve_personnel_finance') || perms.includes('view_sys_payroll')) {
        this.router.navigate(['/app/finance/finance-cartable']);
      } else if (perms.includes('view_sys_treasury') || perms.includes('perm_treasury_disburse_action')) {
        this.router.navigate(['/app/finance/treasury-cartable']);
      } else if (perms.includes('perm_approve_personnel_manager')) {
        this.router.navigate(['/app/finance/manager-approvals']);
      } else {
        this.router.navigate(['/app/finance/attendance']);
      }
    }
  }

  public toggleApp(): void {
    if (!this.canSwitchApps()) {
      return;
    }
    const nextApp: AppModuleType = this.activeApp() === 'warehouse' ? 'personnel' : 'warehouse';
    this.switchApp(nextApp);
  }

  public switchRole(roleCode: string, redirectIfUnauthorized: boolean = true): void {
    this.activeRole.set(roleCode);
    localStorage.setItem('active_role_persona', roleCode);

    if (redirectIfUnauthorized) {
      const currentUrl = this.router.url.split('?')[0];
      if (!this.canAccessRoute(currentUrl)) {
        const fallback = this.activeApp() === 'warehouse' ? '/app/warehouse/dashboard' : '/app/finance/attendance';
        this.router.navigate([fallback]);
      }
    }
  }

  public canAccessRoute(routePath: string): boolean {
    if (this.isSuperuser()) return true;
    const cleanRoute = routePath.split('?')[0];
    const role = this.activeRole();

    // مسیرهای مالی اختصاصی
    if (cleanRoute.includes('finance-cartable') && role === 'operator') return false;
    if (cleanRoute.includes('treasury-cartable') && !['treasury', 'manager', 'superuser'].includes(role)) return false;
    if (cleanRoute.includes('manager-approvals') && !['manager', 'superuser'].includes(role)) return false;

    return true;
  }

  public isActionProhibited(pageRoute: string, actionCode: string): boolean {
    if (this.isSuperuser() || this.activeRole() === 'superuser') {
      return false;
    }
    const app = this.activeApp();
    const role = this.activeRole();
    // نرمال‌سازی پیشوند ماژولار /app/warehouse یا /app/finance به مسیر نسبی پایه
    const normalizedRoute = pageRoute.replace(/^\/app\/(warehouse|finance)/, '') || pageRoute;
    const key = `${app}:${role}:${normalizedRoute}`;
    const prohibitedList = FRONTEND_SOD_PROHIBITIONS[key];

    return prohibitedList ? prohibitedList.includes(actionCode) : false;
  }

  public canPerform(pageRoute: string, actionCode: string): boolean {
    return !this.isActionProhibited(pageRoute, actionCode);
  }
}
