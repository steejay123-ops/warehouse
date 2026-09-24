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
import { CounterpartiesComponent } from '../../components/finance/counterparties/counterparties';
import { EmployeePortalComponent } from '../../components/finance/employee-portal/employee-portal';
import { EmployeeAttendanceHubComponent } from '../../components/finance/employee/employee-attendance/employee-attendance';
import { EmployeeFleetHubComponent } from '../../components/finance/employee/employee-fleet/employee-fleet';
import { EmployeeInvoicesHubComponent } from '../../components/finance/employee/employee-invoices/employee-invoices';
import { EmployeePettyCashHubComponent } from '../../components/finance/employee/employee-petty-cash/employee-petty-cash';
import { EmployeeNewVehicleHubComponent } from '../../components/finance/employee/employee-new-vehicle/employee-new-vehicle';
import { EmployeeNewPersonnelHubComponent } from '../../components/finance/employee/employee-new-personnel/employee-new-personnel';
import { SupervisorAttendanceHubComponent } from '../../components/finance/supervisor/supervisor-attendance/supervisor-attendance';
import { SupervisorFleetHubComponent } from '../../components/finance/supervisor/supervisor-fleet/supervisor-fleet';
import { SupervisorInvoicesHubComponent } from '../../components/finance/supervisor/supervisor-invoices/supervisor-invoices';
import { SupervisorPettyCashHubComponent } from '../../components/finance/supervisor/supervisor-petty-cash/supervisor-petty-cash';
import { SupervisorNewProfilesHubComponent } from '../../components/finance/supervisor/supervisor-new-profiles/supervisor-new-profiles';
import { SupervisorPeriodLockHubComponent } from '../../components/finance/supervisor/supervisor-period-lock/supervisor-period-lock';
import { AccountantPayrollHubComponent } from '../../components/finance/accountant/accountant-payroll/accountant-payroll';
import { AccountantFleetHubComponent } from '../../components/finance/accountant/accountant-fleet/accountant-fleet';
import { AccountantInvoicesHubComponent } from '../../components/finance/accountant/accountant-invoices/accountant-invoices';
import { AccountantPettyCashHubComponent } from '../../components/finance/accountant/accountant-petty-cash/accountant-petty-cash';
import { AccountantDiskettesHubComponent } from '../../components/finance/accountant/accountant-diskettes/accountant-diskettes';
import { AccountantCounterpartiesHubComponent } from '../../components/finance/accountant/accountant-counterparties/accountant-counterparties';
import { ManagerDashboardComponent } from '../../components/finance/manager/manager-dashboard/manager-dashboard';
import { ManagerBudgetComponent } from '../../components/finance/manager/manager-budget/manager-budget';
import { ManagerContractsComponent } from '../../components/finance/manager/manager-contracts/manager-contracts';
import { ManagerReportsComponent } from '../../components/finance/manager/manager-reports/manager-reports';
import { TreasurerDisbursementsComponent } from '../../components/finance/treasurer/treasurer-disbursements/treasurer-disbursements';
import { TreasurerInvoicesComponent } from '../../components/finance/treasurer/treasurer-invoices/treasurer-invoices';
import { TreasurerBankAccountsComponent } from '../../components/finance/treasurer/treasurer-bank-accounts/treasurer-bank-accounts';
import { TreasurerChequesComponent } from '../../components/finance/treasurer/treasurer-cheques/treasurer-cheques';
import { TreasurerReconciliationComponent } from '../../components/finance/treasurer/treasurer-reconciliation/treasurer-reconciliation';
import { Audit } from '../../components/audit/audit';
import { HealthDashboardComponent } from '../../components/health-dashboard/health-dashboard';

export { IS_ACCOUNTING_INSTALLED } from './accounting-flags';

export const ACCOUNTING_ROUTES: Routes = [
  { path: 'employee-portal', component: EmployeePortalComponent, data: { reuse: true } },
  { path: 'employee-attendance', component: EmployeeAttendanceHubComponent, data: { reuse: true } },
  { path: 'employee-fleet', component: EmployeeFleetHubComponent, data: { reuse: true } },
  { path: 'employee-invoices', component: EmployeeInvoicesHubComponent, data: { reuse: true } },
  { path: 'employee-petty-cash', component: EmployeePettyCashHubComponent, data: { reuse: true } },
  { path: 'employee-new-vehicle', component: EmployeeNewVehicleHubComponent, data: { reuse: true } },
  { path: 'employee-new-personnel', component: EmployeeNewPersonnelHubComponent, data: { reuse: true } },
  { path: 'employee/attendance', redirectTo: 'employee-attendance', pathMatch: 'full' },
  { path: 'employee/fleet', redirectTo: 'employee-fleet', pathMatch: 'full' },
  { path: 'employee/invoices', redirectTo: 'employee-invoices', pathMatch: 'full' },
  { path: 'employee/petty-cash', redirectTo: 'employee-petty-cash', pathMatch: 'full' },
  { path: 'employee/new-vehicle', redirectTo: 'employee-new-vehicle', pathMatch: 'full' },
  { path: 'employee/new-personnel', redirectTo: 'employee-new-personnel', pathMatch: 'full' },
  { path: 'supervisor', redirectTo: 'supervisor-attendance', pathMatch: 'full' },
  { path: 'supervisor-attendance', component: SupervisorAttendanceHubComponent, data: { reuse: true } },
  { path: 'supervisor-fleet', component: SupervisorFleetHubComponent, data: { reuse: true } },
  { path: 'supervisor-invoices', component: SupervisorInvoicesHubComponent, data: { reuse: true } },
  { path: 'supervisor-petty-cash', component: SupervisorPettyCashHubComponent, data: { reuse: true } },
  { path: 'supervisor-new-profiles', component: SupervisorNewProfilesHubComponent, data: { reuse: true } },
  { path: 'supervisor-period-lock', component: SupervisorPeriodLockHubComponent, data: { reuse: true } },
  { path: 'supervisor/attendance', redirectTo: 'supervisor-attendance', pathMatch: 'full' },
  { path: 'supervisor/fleet', redirectTo: 'supervisor-fleet', pathMatch: 'full' },
  { path: 'supervisor/invoices', redirectTo: 'supervisor-invoices', pathMatch: 'full' },
  { path: 'supervisor/petty-cash', redirectTo: 'supervisor-petty-cash', pathMatch: 'full' },
  { path: 'supervisor/new-profiles', redirectTo: 'supervisor-new-profiles', pathMatch: 'full' },
  { path: 'supervisor/period-lock', redirectTo: 'supervisor-period-lock', pathMatch: 'full' },
  { path: 'accountant', redirectTo: 'accountant-payroll', pathMatch: 'full' },
  { path: 'accountant-payroll', component: AccountantPayrollHubComponent, data: { reuse: true } },
  { path: 'accountant-fleet', component: AccountantFleetHubComponent, data: { reuse: true } },
  { path: 'accountant-invoices', component: AccountantInvoicesHubComponent, data: { reuse: true } },
  { path: 'accountant-petty-cash', component: AccountantPettyCashHubComponent, data: { reuse: true } },
  { path: 'accountant-diskettes', component: AccountantDiskettesHubComponent, data: { reuse: true } },
  { path: 'accountant-counterparties', component: AccountantCounterpartiesHubComponent, data: { reuse: true } },
  { path: 'accountant/payroll', redirectTo: 'accountant-payroll', pathMatch: 'full' },
  { path: 'accountant/fleet', redirectTo: 'accountant-fleet', pathMatch: 'full' },
  { path: 'accountant/invoices', redirectTo: 'accountant-invoices', pathMatch: 'full' },
  { path: 'accountant/petty-cash', redirectTo: 'accountant-petty-cash', pathMatch: 'full' },
  { path: 'accountant/diskettes', redirectTo: 'accountant-diskettes', pathMatch: 'full' },
  { path: 'accountant/counterparties', redirectTo: 'accountant-counterparties', pathMatch: 'full' },
  { path: 'manager', redirectTo: 'manager-dashboard', pathMatch: 'full' },
  { path: 'manager-dashboard', component: ManagerDashboardComponent, data: { reuse: true } },
  { path: 'manager/dashboard', redirectTo: 'manager-dashboard', pathMatch: 'full' },
  { path: 'manager/approvals', redirectTo: 'manager-approvals', pathMatch: 'full' },
  { path: 'manager-budget', component: ManagerBudgetComponent, data: { reuse: true } },
  { path: 'manager/budget', redirectTo: 'manager-budget', pathMatch: 'full' },
  { path: 'manager-contracts', component: ManagerContractsComponent, data: { reuse: true } },
  { path: 'manager/contracts', redirectTo: 'manager-contracts', pathMatch: 'full' },
  { path: 'manager-reports', component: ManagerReportsComponent, data: { reuse: true } },
  { path: 'manager/reports', redirectTo: 'manager-reports', pathMatch: 'full' },
  { path: 'treasurer', redirectTo: 'treasurer-disbursements', pathMatch: 'full' },
  { path: 'treasurer-disbursements', component: TreasurerDisbursementsComponent, data: { reuse: true } },
  { path: 'treasurer/disbursements', redirectTo: 'treasurer-disbursements', pathMatch: 'full' },
  { path: 'treasurer-invoices', component: TreasurerInvoicesComponent, data: { reuse: true } },
  { path: 'treasurer/invoices', redirectTo: 'treasurer-invoices', pathMatch: 'full' },
  { path: 'treasurer-bank-accounts', component: TreasurerBankAccountsComponent, data: { reuse: true } },
  { path: 'treasurer/bank-accounts', redirectTo: 'treasurer-bank-accounts', pathMatch: 'full' },
  { path: 'treasurer-cheques', component: TreasurerChequesComponent, data: { reuse: true } },
  { path: 'treasurer/cheques', redirectTo: 'treasurer-cheques', pathMatch: 'full' },
  { path: 'treasurer-reconciliation', component: TreasurerReconciliationComponent, data: { reuse: true } },
  { path: 'treasurer/reconciliation', redirectTo: 'treasurer-reconciliation', pathMatch: 'full' },
  { path: 'finance-cartable', component: FinanceCartable, data: { reuse: true } },
  { path: 'attendance', component: WarehouseAttendance, data: { defaultTab: 'personnel' } },
  { path: 'fleet', component: WarehouseAttendance, data: { defaultTab: 'fleet' } },
  { path: 'fleet-attendance', component: WarehouseAttendance, data: { defaultTab: 'fleet' } },
  { path: 'manager-approvals', component: ManagerApprovals, data: { reuse: true } },
  { path: 'treasury-cartable', component: TreasuryCartable, data: { reuse: true } },
  { path: 'treasury', component: TreasuryCartable, data: { reuse: true } },
  { path: 'profiles', component: PersonnelProfilesHub, data: { reuse: true } },
  { path: 'personnel-profiles', component: PersonnelProfilesHub, data: { reuse: true } },
  { path: 'companies', redirectTo: '/app/operations/companies', pathMatch: 'full' },
  { path: 'base-settings', component: BaseSettings, data: { reuse: true } },
  { path: 'projects-and-sections', component: ProjectsAndSectionsComponent, data: { reuse: true } },
  { path: 'counterparties', component: CounterpartiesComponent, data: { reuse: true } },
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
      const userRoles = (auth.user()?.roles || []).map(r => String(r).toLowerCase());

      if (userRoles.includes('accountant') || perms.includes('can_act_as_accountant') || perms.includes('perm_approve_personnel_finance') || perms.includes('view_sys_payroll')) {
        return 'accountant-payroll';
      }
      if (userRoles.includes('treasury') || userRoles.includes('treasurer') || perms.includes('view_sys_treasury') || perms.includes('perm_treasury_disburse_action')) {
        return 'treasurer-disbursements';
      }
      if (userRoles.includes('manager') || perms.includes('can_act_as_company_manager') || perms.includes('perm_manager_payment_authorize') || perms.includes('perm_approve_personnel_manager')) {
        return 'manager-dashboard';
      }
      if (userRoles.includes('supervisor') || perms.includes('can_act_as_workshop_supervisor') || perms.includes('perm_approve_personnel_supervisor') || perms.includes('perm_approve_fleet_supervisor')) {
        return 'supervisor-attendance';
      }
      return 'employee-attendance';
    },
    pathMatch: 'full'
  }
];
