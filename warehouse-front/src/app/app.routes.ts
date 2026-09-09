import { Routes } from '@angular/router';
import { inject } from '@angular/core';
import { AuthStore } from './core/stores/auth.store';
import { AuthService } from './core/auth/auth.service';
import { Login } from './components/login/login';
import { Layout } from './components/layout/layout';
import { AppLauncherComponent } from './components/app-launcher/app-launcher';
import { ChangePassword } from './components/change-password/change-password';
import { VerifyCard } from './components/verify-card/verify-card';
import { AuthGuard, AuthGuardChild } from './core/auth/auth.guard';
import { OperationsGuard, OperationsGuardChild } from './core/guards/operations.guard';
import { OperationsLayoutComponent } from './components/operations/operations-layout/operations-layout';
import { OperationsCockpitComponent } from './components/operations/operations-cockpit/operations-cockpit';
import { SettingsBackupTabComponent } from './components/settings/tabs/settings-backup-tab/settings-backup-tab';
import { OperationsSyncMonitorComponent } from './components/operations/operations-sync-monitor/operations-sync-monitor';
import { OperationsRbacGovernanceComponent } from './components/operations/operations-rbac-governance/operations-rbac-governance';
import { Users } from './components/users/users';
import { Audit } from './components/audit/audit';
import { HealthDashboardComponent } from './components/health-dashboard/health-dashboard';
import { ModuleRegistryService } from './core/modules/module-registry.service';

export const routes: Routes = [
  // ─── احراز هویت و صفحات عمومی ─────────────────────────
  { path: 'login', component: Login },
  { path: 'verify-card/:code', component: VerifyCard },
  { path: 'verify-card', component: VerifyCard },
  { path: 'change-password', component: ChangePassword, canActivate: [AuthGuard] },

  // ─── پورتال لانچر برنامه‌ها (App Launcher) ──────────────
  { path: 'app/launcher', component: AppLauncherComponent, canActivate: [AuthGuard] },

  // ─── ماژول ۱: سامانه انبارگردانی (/app/warehouse/...) با بارگذاری تنبل (Lazy Loading) ──
  {
    path: 'app/warehouse',
    component: Layout,
    canActivate: [AuthGuard],
    canActivateChild: [AuthGuardChild],
    loadChildren: () => import('./modules/warehouse/warehouse.routes').then(m => m.WAREHOUSE_ROUTES)
  },

  // ─── ماژول ۲: سامانه مالی و پرسنلی (/app/finance/...) با بارگذاری تنبل (Lazy Loading) ───
  {
    path: 'app/finance',
    component: Layout,
    canActivate: [AuthGuard],
    canActivateChild: [AuthGuardChild],
    loadChildren: () => import('./modules/accounting/accounting.routes').then(m => m.ACCOUNTING_ROUTES)
  },

  // ─── ماژول ۳: مرکز عملیات و زیرساخت سازمان (/app/operations/...) ───
  {
    path: 'app/operations',
    component: OperationsLayoutComponent,
    canActivate: [AuthGuard, OperationsGuard],
    canActivateChild: [AuthGuardChild, OperationsGuardChild],
    children: [
      { path: 'cockpit', component: OperationsCockpitComponent, data: { reuse: true } },
      { path: 'snapshots', component: SettingsBackupTabComponent, data: { reuse: true } },
      { path: 'backup', redirectTo: 'snapshots', pathMatch: 'full' },
      { path: 'users', component: Users, data: { reuse: true } },
      { path: 'health', component: HealthDashboardComponent, data: { appScope: 'operations', reuse: false } },
      { path: 'audit', component: Audit, data: { appScope: 'security', reuse: true } },
      { path: 'sync-monitor', component: OperationsSyncMonitorComponent, data: { reuse: true } },
      { path: 'rbac-governance', component: OperationsRbacGovernanceComponent, data: { reuse: true } },
      { path: '', redirectTo: 'cockpit', pathMatch: 'full' }
    ]
  },

  // ─── هدایت هوشمند ریشه ماژولار (/app) — فاز ۶ (تسک ۵۳) ───────────────────
  {
    path: 'app',
    redirectTo: () => {
      inject(AuthStore).setWarehouseContext(false);
      const auth = inject(AuthService);
      const registry = inject(ModuleRegistryService);
      const perms = auth.userPermissions() || [];
      const isSuper = perms.includes('admin_all') || auth.user()?.is_superuser;

      if (isSuper) {
        return 'app/launcher';
      }

      const whMarkers = registry.permissionMarkers('warehouse');
      const acctMarkers = registry.permissionMarkers('accounting');

      const hasWh = registry.isModuleInstalled('warehouse') && whMarkers.some(p => perms.includes(p));
      const hasFin = registry.isModuleInstalled('accounting') && acctMarkers.some(p => perms.includes(p));

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
  { path: 'operations', redirectTo: 'app/operations/cockpit', pathMatch: 'full' },
  { path: 'cockpit', redirectTo: 'app/operations/cockpit', pathMatch: 'full' },

  // ─── هدایت ریشه اصلی به پورتال هوشمند — فاز ۶ (تسک ۵۳) ─────────────────
  {
    path: '',
    redirectTo: () => {
      inject(AuthStore).setWarehouseContext(false);
      const auth = inject(AuthService);
      const registry = inject(ModuleRegistryService);
      const perms = auth.userPermissions() || [];
      const isSuper = perms.includes('admin_all') || auth.user()?.is_superuser;

      if (isSuper) {
        return 'app/launcher';
      }

      const whMarkers = registry.permissionMarkers('warehouse');
      const acctMarkers = registry.permissionMarkers('accounting');

      const hasWh = registry.isModuleInstalled('warehouse') && whMarkers.some(p => perms.includes(p));
      const hasFin = registry.isModuleInstalled('accounting') && acctMarkers.some(p => perms.includes(p));

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
