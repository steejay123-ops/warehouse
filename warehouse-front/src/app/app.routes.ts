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
import { IdCards } from './components/id-cards/id-cards';
import { LabelDesigner } from './components/label-designer/label-designer';
import { Placeholders } from './components/placeholders/placeholders';
import { ChangePassword } from './components/change-password/change-password';
import { CounterDashboard } from './components/counter/counter-dashboard/counter-dashboard';
import { SupervisorDashboard } from './components/supervisor/supervisor-dashboard/supervisor-dashboard';
import { ManagerReview } from './components/manager-review/manager-review';
import { AuthGuard } from './guards/auth.guard';
import { importLeaveGuard } from './core/guards/import-leave.guard';
export const routes: Routes = [
  { path: 'login', component: Login },
  { path: 'change-password', component: ChangePassword, canActivate: [AuthGuard] },
  {
    path: '',
    component: Layout,
    canActivate: [AuthGuard],
    children: [
      { path: 'dashboard', component: Dashboard },
      { path: 'projects', component: Projects },
      { 
        path: 'dispatch', 
        component: Dispatch,
        canDeactivate: [importLeaveGuard]
      },
      { 
        path: 'docs', 
        component: Docs,
        canDeactivate: [importLeaveGuard]
      },
      { path: 'users', component: Users },
      { path: 'settings', component: Settings },
      { path: 'audit', component: Audit },
      { path: 'feeding', component: Feeding },
      { path: 'field', component: Field },
      { path: 'id-cards', component: IdCards },
      { path: 'label-designer', component: LabelDesigner },
      { path: 'placeholders', component: Placeholders },
      
      { path: 'counter', component: CounterDashboard },
      { path: 'supervisor', component: SupervisorDashboard },
      { path: 'manager-review', component: ManagerReview },
      { path: 'tasks', component: Placeholders },
      { path: 'labels', component: Placeholders },
      { path: 'approvals', component: Placeholders },
      { path: 'export', component: Placeholders },
      { path: 'recounts', component: Placeholders },
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
