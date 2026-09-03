import { inject } from '@angular/core';
import { Router, CanActivateFn, CanActivateChildFn } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * گارد احراز هویت — فقط کاربران لاگین‌شده اجازه ورود دارند
 */
const ROUTE_PERMISSIONS: Record<string, string[]> = {
  'dashboard': ['view_sys_dashboard', 'view_wh_dashboard'],
  'users': ['view_sys_users'],
  'projects': ['view_sys_projects'],
  'id-cards': ['view_sys_id_cards'],
  'counter': ['view_sys_counter'],
  'supervisor': ['view_sys_supervisor'],
  'manager-review': ['view_sys_manager_review', 'can_act_as_manager'],
  'recounts': ['view_sys_recounts'],
  'settings': ['view_sys_settings'],
  'reports': ['view_sys_reports', 'view_sys_dashboard'],
  'docs': ['view_wh_docs'],
  'dispatch': ['view_wh_dispatch'],
  'customs': ['view_wh_customs'],
  'doc_approvals': ['view_wh_doc_approvals'],
  'feeding': ['view_wh_feeding'],
  'feed_approvals': ['view_wh_feed_approvals'],
  'labels': ['view_wh_labels'],
  'label-designer': ['view_wh_label_designer'],
  'audit': ['view_wh_audit', 'perm_sys_logs'],
  'count-tracking': ['view_sys_manager_review', 'view_sys_supervisor', 'view_sys_dashboard', 'perm_inventory_finalize', 'view_wh_stocktaking', 'can_act_as_manager', 'can_act_as_supervisor'],
  
  // Personnel, Attendance, Fleet, Finance & Treasury
  'personnel': ['view_sys_payroll', 'view_sys_personnel', 'admin_all'],
  'payroll': ['view_sys_payroll', 'view_sys_personnel', 'admin_all'],
  'fleet-settlement': ['view_sys_fleet_settlement', 'view_sys_payroll', 'admin_all'],
  'attendance': ['view_sys_personnel_attendance', 'view_wh_attendance', 'view_sys_personnel', 'view_sys_payroll', 'perm_register_daily_attendance', 'can_act_as_operator', 'can_act_as_supervisor', 'admin_all'],
  'fleet': ['view_sys_fleet_attendance', 'view_wh_attendance', 'view_sys_personnel', 'view_sys_payroll', 'admin_all'],
  'fleet-attendance': ['view_sys_fleet_attendance', 'view_wh_attendance', 'view_sys_personnel', 'view_sys_payroll', 'admin_all'],
  'manager-approvals': ['perm_manager_payment_authorize', 'perm_approve_personnel_manager', 'perm_approve_fleet_manager', 'view_sys_personnel', 'can_act_as_manager', 'admin_all'],
  'finance-cartable': ['perm_approve_personnel_finance', 'perm_approve_fleet_finance', 'view_sys_payroll', 'view_sys_personnel', 'admin_all'],
  'treasury-cartable': ['view_sys_treasury', 'perm_treasury_disburse_action', 'view_sys_payroll', 'admin_all'],
  'treasury': ['view_sys_treasury', 'perm_treasury_disburse_action', 'view_sys_payroll', 'admin_all'],
  'profiles': ['view_sys_personnel', 'view_sys_payroll', 'admin_all'],
  'personnel-profiles': ['view_sys_personnel', 'view_sys_payroll', 'admin_all'],
  'base-settings': ['view_sys_personnel', 'view_sys_settings', 'view_sys_payroll', 'admin_all']
};

const WAREHOUSE_PERMISSIONS = [
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

const PERSONNEL_PERMISSIONS = [
  'view_sys_personnel', 'view_sys_personnel_attendance', 'view_sys_fleet_attendance',
  'view_sys_payroll', 'view_sys_fleet_settlement', 'view_sys_treasury',
  'perm_lock_work_period', 'perm_approve_personnel_supervisor', 'perm_approve_personnel_manager',
  'perm_approve_personnel_finance', 'perm_approve_fleet_supervisor', 'perm_approve_fleet_manager',
  'perm_approve_fleet_finance', 'perm_manager_payment_authorize', 'perm_treasury_disburse_action',
  'can_act_as_accountant', 'can_act_as_operator'
];

const WAREHOUSE_ROUTE_KEYS = new Set([
  'dashboard', 'projects', 'id-cards', 'counter', 'supervisor', 'manager-review',
  'recounts', 'settings', 'reports', 'docs', 'dispatch', 'customs', 'doc_approvals',
  'feeding', 'feed_approvals', 'labels', 'label-designer', 'audit', 'count-tracking'
]);

const FINANCE_ROUTE_KEYS = new Set([
  'personnel', 'payroll', 'fleet-settlement', 'attendance', 'fleet', 'fleet-attendance',
  'manager-approvals', 'finance-cartable', 'treasury-cartable', 'treasury', 'profiles',
  'personnel-profiles', 'base-settings', 'projects-and-sections'
]);

export const AuthGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // اگر URL حاوی هش verify-card باشد (مثلاً از لینک‌های قدیمی یا اسکن با #)، مستقیماً بدون لاگین هدایت شود
  if (typeof window !== 'undefined' && window.location.hash) {
    const hash = window.location.hash;
    const match = hash.match(/#\/?verify-card(?:\/([^/?#]+))?/);
    if (match) {
      const code = match[1];
      const targetUrl = code ? `/verify-card/${code}` : '/verify-card';
      return router.parseUrl(targetUrl);
    }
  }

  if (auth.isLoggedIn()) {
    const user = auth.user();
    if (user?.requires_password_change) {
      if (state.url.includes('/change-password')) {
        return true;
      }
      return router.parseUrl('/change-password');
    }

    const userPerms = auth.userPermissions() || [];
    const isAdmin = Boolean(
      userPerms.includes('admin_all') ||
      user?.is_superuser ||
      user?.roles?.includes('admin') ||
      user?.roles?.includes('superuser') ||
      user?.department === 'admin'
    );

    // اگر مسیر launcher باشد، هر کاربر احراز هویت شده مجاز است
    if (state.url.includes('/app/launcher') || route.routeConfig?.path === 'launcher') {
      return true;
    }

    const hasWarehouseAccess = isAdmin || WAREHOUSE_PERMISSIONS.some(p => userPerms.includes(p));
    const hasPersonnelAccess = isAdmin || PERSONNEL_PERMISSIONS.some(p => userPerms.includes(p));

    // بررسی دسترسی به سطح ماژول انبار
    const isWarehouseScope = state.url.includes('/app/warehouse') || route.routeConfig?.path === 'warehouse';
    if (isWarehouseScope && !hasWarehouseAccess) {
      if (hasPersonnelAccess) {
        return router.parseUrl('/app/finance/finance-cartable');
      }
      return router.parseUrl('/login');
    }

    // بررسی دسترسی به سطح ماژول مالی
    const isFinanceScope = state.url.includes('/app/finance') || route.routeConfig?.path === 'finance';
    if (isFinanceScope && !hasPersonnelAccess) {
      if (hasWarehouseAccess) {
        return router.parseUrl('/app/warehouse/dashboard');
      }
      return router.parseUrl('/login');
    }

    // Check RBAC permissions on individual page
    const path = route.routeConfig?.path;
    if (path && ROUTE_PERMISSIONS[path]) {
      const requiredPerms = ROUTE_PERMISSIONS[path];
      if (!isAdmin) {
        if (!hasWarehouseAccess && WAREHOUSE_ROUTE_KEYS.has(path)) {
          if (hasPersonnelAccess) {
            return router.parseUrl('/app/finance/finance-cartable');
          }
          return router.parseUrl('/login');
        }

        if (!hasPersonnelAccess && FINANCE_ROUTE_KEYS.has(path)) {
          if (hasWarehouseAccess) {
            return router.parseUrl('/app/warehouse/dashboard');
          }
          return router.parseUrl('/login');
        }

        const hasAccess = requiredPerms.some(p => userPerms.includes(p));
        if (!hasAccess) {
          if (isFinanceScope || FINANCE_ROUTE_KEYS.has(path)) {
            for (const p of Object.keys(ROUTE_PERMISSIONS)) {
              if (FINANCE_ROUTE_KEYS.has(p) && ROUTE_PERMISSIONS[p].some(req => userPerms.includes(req))) {
                return router.parseUrl('/app/finance/' + p);
              }
            }
          } else {
            for (const p of Object.keys(ROUTE_PERMISSIONS)) {
              if (WAREHOUSE_ROUTE_KEYS.has(p) && ROUTE_PERMISSIONS[p].some(req => userPerms.includes(req))) {
                return router.parseUrl('/app/warehouse/' + p);
              }
            }
          }

          if (hasWarehouseAccess) return router.parseUrl('/app/warehouse/dashboard');
          if (hasPersonnelAccess) return router.parseUrl('/app/finance/attendance');
          return router.parseUrl('/login');
        }
      }
    }

    return true;
  }
  return router.parseUrl('/login');
};

export const AuthGuardChild: CanActivateChildFn = (childRoute, state) => {
  return AuthGuard(childRoute, state);
};
