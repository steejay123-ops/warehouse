import { Routes } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { FinanceCartable } from '../../components/personnel/finance-cartable/finance-cartable';
import { WarehouseAttendance } from '../../components/personnel/warehouse-attendance/warehouse-attendance';
import { ManagerApprovals } from '../../components/personnel/manager-approvals/manager-approvals';
import { TreasuryCartable } from '../../components/personnel/treasury-cartable/treasury-cartable';
import { PersonnelProfilesHub } from '../../components/personnel/personnel-profiles/personnel-profiles';
import { BaseSettings } from '../../components/personnel/base-settings/base-settings';
import { ProjectsAndSectionsComponent } from '../../components/organization/projects-and-sections/projects-and-sections';
import { Audit } from '../../components/audit/audit';
import { HealthDashboardComponent } from '../../components/health-dashboard/health-dashboard';

export const IS_ACCOUNTING_INSTALLED = true;

export const ACCOUNTING_ROUTES: Routes = [
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
  { path: 'health', component: HealthDashboardComponent, data: { appScope: 'finance', reuse: false } },
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
];
