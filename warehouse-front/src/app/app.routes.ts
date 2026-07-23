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
import { Field } from './components/field/field';
import { Placeholders } from './components/placeholders/placeholders';
import { ChangePassword } from './components/change-password/change-password';
import { WhSettings } from './components/wh-settings/wh-settings';
import { CounterDashboard } from './components/counter/counter-dashboard/counter-dashboard';
import { SupervisorDashboard } from './components/supervisor/supervisor-dashboard/supervisor-dashboard';
import { ManagerReview } from './components/manager-review/manager-review';
import { CountTracking } from './components/count-tracking/count-tracking';
import { AuthGuard, AuthGuardChild } from './core/auth/auth.guard';
import { importLeaveGuard } from './core/guards/import-leave.guard';
export const routes: Routes = [
  { path: 'login', component: Login },
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
      { path: 'settings', component: Settings },
      { path: 'wh-settings', component: WhSettings },
      { path: 'audit', component: Audit },
      { path: 'feeding', component: Feeding },
      { path: 'field', component: Field },
      { path: 'placeholders', component: Placeholders },
      
      { path: 'counter', component: CounterDashboard, data: { reuse: true } },
      { path: 'supervisor', component: SupervisorDashboard, data: { reuse: true } },
      { path: 'manager-review', component: ManagerReview, data: { reuse: true } },
      { path: 'count-tracking', component: CountTracking, data: { reuse: true } },
      { path: 'tasks', component: Placeholders },
      { path: 'labels', component: Placeholders },
      { path: 'approvals', component: Placeholders },
      { path: 'export', component: Placeholders },
      { path: 'customs', component: Placeholders },
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
