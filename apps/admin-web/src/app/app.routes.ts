import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  // Public, unauthenticated tree-view request form (outside the shell/guards).
  {
    path: 'request-view',
    loadComponent: () =>
      import('./features/view-requests/public-view-request.component').then(
        (m) => m.PublicViewRequestComponent,
      ),
  },
  {
    path: 't/:tenantSlug/request-view',
    loadComponent: () =>
      import('./features/view-requests/public-view-request.component').then(
        (m) => m.PublicViewRequestComponent,
      ),
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
        path: 'visibility-settings',
        loadComponent: () =>
          import('./features/visibility/visibility-settings.component').then(
            (m) => m.VisibilitySettingsComponent,
          ),
      },
      {
        path: 'view-requests',
        loadComponent: () =>
          import('./features/view-requests/view-requests.component').then(
            (m) => m.ViewRequestsComponent,
          ),
      },
      {
        path: 'imports',
        loadComponent: () =>
          import('./features/imports/imports-list.component').then((m) => m.ImportsListComponent),
      },
      {
        path: 'imports/new',
        loadComponent: () =>
          import('./features/imports/import-wizard.component').then((m) => m.ImportWizardComponent),
      },
      {
        path: 'imports/:id',
        loadComponent: () =>
          import('./features/imports/import-batch-detail.component').then(
            (m) => m.ImportBatchDetailComponent,
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
