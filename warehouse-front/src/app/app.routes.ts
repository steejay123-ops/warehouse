import { Routes } from '@angular/router';
import { inject } from '@angular/core';
import { AuthStore } from './core/stores/auth.store';
import { Login } from './components/login/login';
import { Layout } from './components/layout/layout';
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
import { PersonnelManagement } from './components/personnel/personnel-management/personnel-management';
import { WarehouseAttendance } from './components/personnel/warehouse-attendance/warehouse-attendance';
import { AuthGuard, AuthGuardChild } from './core/auth/auth.guard';
import { importLeaveGuard } from './core/guards/import-leave.guard';
import { settingsLeaveGuard } from './core/guards/settings-leave.guard';
export const routes: Routes = [
  { path: 'login', component: Login },
  { path: 'verify-card/:code', component: VerifyCard },
  { path: 'verify-card', component: VerifyCard },
  { path: 'change-password', component: ChangePassword, canActivate: [AuthGuard] },
  {
    path: '',
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
      { path: 'audit', component: Audit },
      { path: 'feeding', component: Feeding },
      { path: 'field', redirectTo: 'counter', pathMatch: 'full' },
      { path: 'placeholders', component: Placeholders },
      
      { path: 'counter', component: CounterDashboard, data: { reuse: true } },
      { path: 'supervisor', component: SupervisorDashboard, data: { reuse: true } },
      { path: 'manager-review', component: ManagerReview, data: { reuse: true } },
      { path: 'count-tracking', component: CountTracking, data: { reuse: true } },
      { path: 'reports', component: Reports },
      { path: 'personnel', component: PersonnelManagement, data: { defaultTab: 'payroll' } },
      { path: 'payroll', component: PersonnelManagement, data: { defaultTab: 'payroll' } },
      { path: 'fleet-settlement', component: PersonnelManagement, data: { defaultTab: 'fleet_settlement' } },
      { path: 'attendance', component: WarehouseAttendance, data: { defaultTab: 'personnel' } },
      { path: 'fleet', component: WarehouseAttendance, data: { defaultTab: 'fleet' } },
      { path: 'fleet-attendance', component: WarehouseAttendance, data: { defaultTab: 'fleet' } },
      { path: 'tasks', component: Placeholders },
      { path: 'labels', component: Placeholders },
      { path: 'approvals', component: Placeholders },
      { path: 'customs', component: Customs },
      { path: 'doc_approvals', component: Placeholders },
      { path: 'feed_approvals', component: Placeholders },

      { 
        path: '', 
        redirectTo: () => {
          inject(AuthStore).setWarehouseContext(false);
          return 'dashboard';
        },
        pathMatch: 'full' 
      }
    ]
  },
  { path: '**', redirectTo: 'login' }
];
