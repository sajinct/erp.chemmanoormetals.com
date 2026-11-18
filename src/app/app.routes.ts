import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { authGuard, roleGuard } from './core/auth';

/**
 * Customers get links of the form /?q=CODE: the bare address always loads on
 * static hosting, where a deep path would first answer "not found". This
 * sends such a visit to the public quotation page instead of the sign-in.
 */
const shareLinkGuard: CanActivateFn = (route) => {
  const code = route.queryParamMap.get('q');
  return code ? inject(Router).createUrlTree(['/q', code]) : true;
};

export const routes: Routes = [
  {
    path: 'q/:code',
    loadComponent: () => import('./features/quotes/quote-link').then((m) => m.QuoteLink),
  },
  { path: 'login', loadComponent: () => import('./features/auth/login').then((m) => m.Login) },
  {
    path: '',
    canActivate: [shareLinkGuard, authGuard],
    loadComponent: () => import('./shell').then((m) => m.Shell),
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'leads',
        loadComponent: () => import('./features/leads/leads-list').then((m) => m.LeadsList),
      },
      {
        path: 'leads/:id',
        loadComponent: () => import('./features/leads/lead-detail').then((m) => m.LeadDetail),
      },
      {
        path: 'customers',
        loadComponent: () =>
          import('./features/customers/customers-list').then((m) => m.CustomersList),
      },
      {
        path: 'customers/:id',
        loadComponent: () =>
          import('./features/customers/customer-detail').then((m) => m.CustomerDetail),
      },
      {
        path: 'projects',
        loadComponent: () => import('./features/projects/projects-list').then((m) => m.ProjectsList),
      },
      {
        path: 'projects/:id',
        loadComponent: () =>
          import('./features/projects/project-detail').then((m) => m.ProjectDetail),
      },
      {
        path: 'projects/:id/measurements/:mid',
        loadComponent: () =>
          import('./features/measurements/measurement-editor').then((m) => m.MeasurementEditor),
      },
      {
        path: 'projects/:id/quotes/:qid',
        loadComponent: () => import('./features/quotes/quote-editor').then((m) => m.QuoteEditor),
      },
      {
        path: 'catalogue',
        loadComponent: () => import('./features/catalogue/catalogue').then((m) => m.Catalogue),
      },
      {
        path: 'settings',
        canActivate: [roleGuard('admin')],
        loadComponent: () => import('./features/settings/settings').then((m) => m.SettingsPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
