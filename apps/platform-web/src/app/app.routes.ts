import { Routes } from '@angular/router';
import { superAdminGuard } from './core/guards/super-admin.guard';
import { guestGuard } from './core/guards/guest.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    canActivate: [superAdminGuard],
    loadComponent: () =>
      import('./layout/shell.component').then((m) => m.ShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent,
          ),
      },
      {
        path: 'tenants',
        loadComponent: () =>
          import('./features/tenants/tenants-list.component').then(
            (m) => m.TenantsListComponent,
          ),
      },
      {
        path: 'statistics',
        loadComponent: () =>
          import('./features/dashboard/platform-dashboard.component').then(
            (m) => m.PlatformDashboardComponent,
          ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
