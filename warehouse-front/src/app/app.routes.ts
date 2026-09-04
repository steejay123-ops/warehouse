import { Routes } from '@angular/router';
import { inject } from '@angular/core';
import { AuthStore } from './core/stores/auth.store';
import { AuthService } from './core/auth/auth.service';
import { Login } from './components/login/login';
import { Layout } from './components/layout/layout';
import { AppLauncherComponent } from './components/app-launcher/app-launcher';
import { Dashboard } from './components/dashboard/dashboard';
import { Projects } from './components/projects/projects';
import { Dispatch } from './components/dispatch/dispatch';
import { Docs } from './components/docs/docs';
import { Users } from './components/users/users';
import { Settings } from './components/settings/settings';
import { Audit } from './components/audit/audit';
import { Feeding } from './components/feeding/feeding';
import { Placeholders } from './components/placeholders/placeholders';
import { Customs } from './components/customs/customs';
import { ChangePassword } from './components/change-password/change-password';
import { WhSettings } from './components/wh-settings/wh-settings';
import { CounterDashboard } from './components/counter/counter-dashboard/counter-dashboard';
import { SupervisorDashboard } from './components/supervisor/supervisor-dashboard/supervisor-dashboard';
import { ManagerReview } from './components/manager-review/manager-review';
import { CountTracking } from './components/count-tracking/count-tracking';
import { Reports } from './components/reports/reports';
import { VerifyCard } from './components/verify-card/verify-card';
import { WarehouseAttendance } from './components/personnel/warehouse-attendance/warehouse-attendance';
import { ManagerApprovals } from './components/personnel/manager-approvals/manager-approvals';
import { FinanceCartable } from './components/personnel/finance-cartable/finance-cartable';
import { BaseSettings } from './components/personnel/base-settings/base-settings';
import { PersonnelProfilesHub } from './components/personnel/personnel-profiles/personnel-profiles';
import { TreasuryCartable } from './components/personnel/treasury-cartable/treasury-cartable';
import { ProjectsAndSectionsComponent } from './components/organization/projects-and-sections/projects-and-sections';
import { AuthGuard, AuthGuardChild } from './core/auth/auth.guard';
import { importLeaveGuard } from './core/guards/import-leave.guard';
import { settingsLeaveGuard } from './core/guards/settings-leave.guard';

const WAREHOUSE_CHECK_PERMS = [
  'view_sys_dashboard', 'view_wh_dashboard', 'view_sys_counter',
  'view_sys_supervisor', 'view_sys_manager_review', 'view_wh_docs',
  'view_wh_dispatch', 'view_wh_customs', 'view_wh_doc_approvals',
  'view_wh_feeding', 'view_wh_feed_approvals', 'view_wh_labels',
  'view_wh_label_designer', 'view_wh_audit', 'view_wh_settings',
  'view_sys_recounts', 'view_sys_export', 'view_sys_reports'
];

const PERSONNEL_CHECK_PERMS = [
  'view_sys_personnel', 'view_sys_personnel_attendance', 'view_sys_fleet_attendance',
  'view_sys_payroll', 'view_sys_fleet_settlement', 'view_sys_treasury',
  'perm_lock_work_period', 'perm_approve_personnel_supervisor', 'perm_approve_personnel_manager',
  'perm_approve_personnel_finance', 'perm_approve_fleet_supervisor', 'perm_approve_fleet_manager',
  'perm_approve_fleet_finance', 'perm_manager_payment_authorize', 'perm_treasury_disburse_action',
  'can_act_as_accountant', 'can_act_as_operator'
];

export const routes: Routes = [
  // ─── احراز هویت و صفحات عمومی ─────────────────────────
  { path: 'login', component: Login },
  { path: 'verify-card/:code', component: VerifyCard },
  { path: 'verify-card', component: VerifyCard },
  { path: 'change-password', component: ChangePassword, canActivate: [AuthGuard] },

  // ─── پورتال لانچر برنامه‌ها (App Launcher) ──────────────
  { path: 'app/launcher', component: AppLauncherComponent, canActivate: [AuthGuard] },

  // ─── ماژول ۱: سامانه انبارگردانی (/app/warehouse/...) ──
  {
    path: 'app/warehouse',
    component: Layout,
    canActivate: [AuthGuard],
    canActivateChild: [AuthGuardChild],
    children: [
      { path: 'dashboard', component: Dashboard },
      { path: 'projects', component: Projects },
      { 
        path: 'dispatch', 
        component: Dispatch,
        canDeactivate: [importLeaveGuard],
        data: { reuse: true }
      },
      { 
        path: 'docs', 
        component: Docs,
        canDeactivate: [importLeaveGuard]
      },
      { path: 'users', component: Users },
      { 
        path: 'settings', 
        component: Settings,
        canDeactivate: [settingsLeaveGuard]
      },
      { path: 'wh-settings', component: WhSettings },
      { path: 'audit', component: Audit, data: { appScope: 'warehouse' } },
      { path: 'feeding', component: Feeding },
      { path: 'field', redirectTo: 'counter', pathMatch: 'full' },
      { path: 'placeholders', component: Placeholders },
      { path: 'counter', component: CounterDashboard, data: { reuse: true } },
      { path: 'supervisor', component: SupervisorDashboard, data: { reuse: true } },
      { path: 'manager-review', component: ManagerReview, data: { reuse: true } },
      { path: 'count-tracking', component: CountTracking, data: { reuse: true } },
      { path: 'reports', component: Reports },
      { path: 'customs', component: Customs },
      { path: 'tasks', component: Placeholders },
      { path: 'labels', component: Placeholders },
      { path: 'approvals', component: Placeholders },
      { path: 'doc_approvals', component: Placeholders },
      { path: 'feed_approvals', component: Placeholders },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  },

  // ─── ماژول ۲: سامانه مالی و پرسنلی (/app/finance/...) ───
  {
    path: 'app/finance',
    component: Layout,
    canActivate: [AuthGuard],
    canActivateChild: [AuthGuardChild],
    children: [
      { path: 'finance-cartable', component: FinanceCartable, data: { reuse: true } },
      { path: 'attendance', component: WarehouseAttendance, data: { defaultTab: 'personnel' } },
      { path: 'fleet', component: WarehouseAttendance, data: { defaultTab: 'fleet' } },
      { path: 'fleet-attendance', component: WarehouseAttendance, data: { defaultTab: 'fleet' } },
      { path: 'manager-approvals', component: ManagerApprovals, data: { reuse: true } },
      { path: 'treasury-cartable', component: TreasuryCartable, data: { reuse: true } },
      { path: 'treasury', component: TreasuryCartable, data: { reuse: true } },
      { path: 'profiles', component: PersonnelProfilesHub, data: { reuse: true } },
      { path: 'personnel-profiles', component: PersonnelProfilesHub, data: { reuse: true } },
      { path: 'base-settings', component: BaseSettings, data: { reuse: true } },
      { path: 'projects-and-sections', component: ProjectsAndSectionsComponent, data: { reuse: true } },
      { path: 'audit', component: Audit, data: { appScope: 'finance', reuse: true } },
      { path: 'finance-audit', redirectTo: 'audit', pathMatch: 'full' },
      { path: 'personnel', redirectTo: 'finance-cartable', pathMatch: 'full' },
      { path: 'payroll', redirectTo: 'finance-cartable', pathMatch: 'full' },
      { path: 'fleet-settlement', redirectTo: 'treasury-cartable', pathMatch: 'full' },
      { 
        path: '', 
        redirectTo: () => {
          const auth = inject(AuthService);
          const perms = auth.userPermissions() || [];
          if (perms.includes('perm_approve_personnel_finance') || perms.includes('view_sys_payroll')) {
            return 'finance-cartable';
          }
          if (perms.includes('view_sys_treasury') || perms.includes('perm_treasury_disburse_action')) {
            return 'treasury-cartable';
          }
          if (perms.includes('perm_approve_personnel_manager')) {
            return 'manager-approvals';
          }
          return 'attendance';
        }, 
        pathMatch: 'full' 
      }
    ]
  },

  // ─── هدایت هوشمند ریشه ماژولار (/app) ───────────────────
  {
    path: 'app',
    redirectTo: () => {
      inject(AuthStore).setWarehouseContext(false);
      const auth = inject(AuthService);
      const perms = auth.userPermissions() || [];
      const isSuper = perms.includes('admin_all') || auth.user()?.is_superuser;

      if (isSuper) {
        return 'app/launcher';
      }

      const hasWh = WAREHOUSE_CHECK_PERMS.some(p => perms.includes(p));
      const hasFin = PERSONNEL_CHECK_PERMS.some(p => perms.includes(p));

      if (hasWh && hasFin) {
        return 'app/launcher';
      }
      if (hasWh && !hasFin) {
        return 'app/warehouse/dashboard';
      }
      if (!hasWh && hasFin) {
        if (perms.includes('perm_approve_personnel_finance') || perms.includes('view_sys_payroll')) {
          return 'app/finance/finance-cartable';
        }
        return 'app/finance/attendance';
      }
      return 'app/launcher';
    },
    pathMatch: 'full'
  },

  // ─── سازگاری کامل با مسیرهای قبلی (Legacy Route Redirects) ─
  { path: 'dashboard', redirectTo: 'app/warehouse/dashboard', pathMatch: 'full' },
  { path: 'projects', redirectTo: 'app/warehouse/projects', pathMatch: 'full' },
  { path: 'dispatch', redirectTo: 'app/warehouse/dispatch', pathMatch: 'full' },
  { path: 'docs', redirectTo: 'app/warehouse/docs', pathMatch: 'full' },
  { path: 'users', redirectTo: 'app/warehouse/users', pathMatch: 'full' },
  { path: 'settings', redirectTo: 'app/warehouse/settings', pathMatch: 'full' },
  { path: 'wh-settings', redirectTo: 'app/warehouse/wh-settings', pathMatch: 'full' },
  { path: 'audit', redirectTo: 'app/warehouse/audit', pathMatch: 'full' },
  { path: 'feeding', redirectTo: 'app/warehouse/feeding', pathMatch: 'full' },
  { path: 'counter', redirectTo: 'app/warehouse/counter', pathMatch: 'full' },
  { path: 'supervisor', redirectTo: 'app/warehouse/supervisor', pathMatch: 'full' },
  { path: 'manager-review', redirectTo: 'app/warehouse/manager-review', pathMatch: 'full' },
  { path: 'count-tracking', redirectTo: 'app/warehouse/count-tracking', pathMatch: 'full' },
  { path: 'reports', redirectTo: 'app/warehouse/reports', pathMatch: 'full' },
  { path: 'customs', redirectTo: 'app/warehouse/customs', pathMatch: 'full' },
  { path: 'tasks', redirectTo: 'app/warehouse/tasks', pathMatch: 'full' },
  { path: 'labels', redirectTo: 'app/warehouse/labels', pathMatch: 'full' },
  { path: 'approvals', redirectTo: 'app/warehouse/approvals', pathMatch: 'full' },
  { path: 'doc_approvals', redirectTo: 'app/warehouse/doc_approvals', pathMatch: 'full' },
  { path: 'feed_approvals', redirectTo: 'app/warehouse/feed_approvals', pathMatch: 'full' },

  { path: 'finance-cartable', redirectTo: 'app/finance/finance-cartable', pathMatch: 'full' },
  { path: 'attendance', redirectTo: 'app/finance/attendance', pathMatch: 'full' },
  { path: 'fleet', redirectTo: 'app/finance/fleet', pathMatch: 'full' },
  { path: 'fleet-attendance', redirectTo: 'app/finance/fleet-attendance', pathMatch: 'full' },
  { path: 'manager-approvals', redirectTo: 'app/finance/manager-approvals', pathMatch: 'full' },
  { path: 'treasury-cartable', redirectTo: 'app/finance/treasury-cartable', pathMatch: 'full' },
  { path: 'treasury', redirectTo: 'app/finance/treasury', pathMatch: 'full' },
  { path: 'profiles', redirectTo: 'app/finance/profiles', pathMatch: 'full' },
  { path: 'personnel-profiles', redirectTo: 'app/finance/personnel-profiles', pathMatch: 'full' },
  { path: 'base-settings', redirectTo: 'app/finance/base-settings', pathMatch: 'full' },
  { path: 'projects-and-sections', redirectTo: 'app/finance/projects-and-sections', pathMatch: 'full' },
  { path: 'personnel', redirectTo: 'app/finance/finance-cartable', pathMatch: 'full' },
  { path: 'payroll', redirectTo: 'app/finance/finance-cartable', pathMatch: 'full' },
  { path: 'fleet-settlement', redirectTo: 'app/finance/treasury-cartable', pathMatch: 'full' },
  { path: 'finance-audit', redirectTo: 'app/finance/audit', pathMatch: 'full' },

  // ─── هدایت ریشه اصلی به پورتال هوشمند ─────────────────
  { 
    path: '', 
    redirectTo: () => {
      inject(AuthStore).setWarehouseContext(false);
      const auth = inject(AuthService);
      const perms = auth.userPermissions() || [];
      const isSuper = perms.includes('admin_all') || auth.user()?.is_superuser;

      if (isSuper) {
        return 'app/launcher';
      }

      const hasWh = WAREHOUSE_CHECK_PERMS.some(p => perms.includes(p));
      const hasFin = PERSONNEL_CHECK_PERMS.some(p => perms.includes(p));

      if (hasWh && hasFin) {
        return 'app/launcher';
      }
      if (hasWh && !hasFin) {
        return 'app/warehouse/dashboard';
      }
      if (!hasWh && hasFin) {
        if (perms.includes('perm_approve_personnel_finance') || perms.includes('view_sys_payroll')) {
          return 'app/finance/finance-cartable';
        }
        return 'app/finance/attendance';
      }
      return 'app/launcher';
    }, 
    pathMatch: 'full' 
  },
  { path: '**', redirectTo: 'login' }
];
