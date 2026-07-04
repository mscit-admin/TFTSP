import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell.component').then((m) => m.ShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'persons' },
      {
        path: 'persons',
        loadComponent: () =>
          import('./features/persons/persons-list.component').then((m) => m.PersonsListComponent),
      },
      {
        path: 'persons/new',
        loadComponent: () =>
          import('./features/persons/person-form.component').then((m) => m.PersonFormComponent),
      },
      {
        path: 'persons/:id',
        loadComponent: () =>
          import('./features/persons/person-form.component').then((m) => m.PersonFormComponent),
      },
      {
        path: 'tribal-units',
        loadComponent: () =>
          import('./features/tribal-units/tribal-units.component').then(
            (m) => m.TribalUnitsComponent,
          ),
      },
      {
        path: 'tree',
        loadComponent: () =>
          import('./features/tree/tree-view.component').then((m) => m.TreeViewComponent),
      },
      {
        path: 'change-requests',
        loadComponent: () =>
          import('./features/change-requests/review-queue.component').then(
            (m) => m.ReviewQueueComponent,
          ),
      },
      {
        path: 'change-requests/:id',
        loadComponent: () =>
          import('./features/change-requests/change-request-detail.component').then(
            (m) => m.ChangeRequestDetailComponent,
          ),
      },
      {
        path: 'my-requests',
        loadComponent: () =>
          import('./features/change-requests/my-requests.component').then(
            (m) => m.MyRequestsComponent,
          ),
      },
      {
        path: 'workflow-settings',
        loadComponent: () =>
          import('./features/workflow-settings/workflow-settings.component').then(
            (m) => m.WorkflowSettingsComponent,
          ),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/tribe-settings.component').then(
            (m) => m.TribeSettingsComponent,
          ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
