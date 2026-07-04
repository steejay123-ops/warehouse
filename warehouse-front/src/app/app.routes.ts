import { Routes } from '@angular/router';
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
import { AuthGuard } from './guards/auth.guard';

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
      { path: 'dispatch', component: Dispatch },
      { path: 'docs', component: Docs },
      { path: 'users', component: Users },
      { path: 'settings', component: Settings },
      { path: 'audit', component: Audit },
      { path: 'feeding', component: Feeding },
      { path: 'field', component: Field },
      { path: 'id-cards', component: IdCards },
      { path: 'label-designer', component: LabelDesigner },
      { path: 'placeholders', component: Placeholders },
      
      // Placeholder routes
      { path: 'tasks', component: Placeholders },
      { path: 'labels', component: Placeholders },
      { path: 'approvals', component: Placeholders },
      { path: 'export', component: Placeholders },
      { path: 'recounts', component: Placeholders },
      { path: 'customs', component: Placeholders },
      { path: 'doc_approvals', component: Placeholders },
      { path: 'feed_approvals', component: Placeholders },

      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  },
  { path: '**', redirectTo: 'login' }
];
