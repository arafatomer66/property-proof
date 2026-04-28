import { Routes } from '@angular/router';
import { adminGuard } from './guards/admin.guard';
import { authGuard } from './guards/auth.guard';
import { lawyerGuard } from './guards/lawyer.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./layouts/public-layout/public-layout.component').then(
        (m) => m.PublicLayoutComponent,
      ),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/public-home/public-home.component').then(
            (m) => m.PublicHomeComponent,
          ),
      },
      {
        path: 'property/:id',
        loadComponent: () =>
          import('./pages/property-detail/property-detail.component').then(
            (m) => m.PropertyDetailComponent,
          ),
      },
      {
        path: 'verify',
        loadComponent: () =>
          import('./pages/verify/verify.component').then((m) => m.VerifyComponent),
      },
      {
        path: 'history',
        loadComponent: () =>
          import('./pages/history/history.component').then((m) => m.HistoryComponent),
      },
      {
        path: 'login',
        loadComponent: () =>
          import('./pages/login/login.component').then((m) => m.LoginComponent),
      },
      {
        path: 'signup',
        loadComponent: () =>
          import('./pages/signup/signup.component').then((m) => m.SignupComponent),
      },
      {
        path: 'access-denied',
        loadComponent: () =>
          import('./pages/access-denied/access-denied.component').then(
            (m) => m.AccessDeniedComponent,
          ),
      },
      {
        path: 'pending-approval',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./pages/pending-approval/pending-approval.component').then(
            (m) => m.PendingApprovalComponent,
          ),
      },
    ],
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./layouts/dashboard-layout/dashboard-layout.component').then(
        (m) => m.DashboardLayoutComponent,
      ),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/admin-home/admin-home.component').then(
            (m) => m.AdminHomeComponent,
          ),
      },
      {
        path: 'lawyer-applications',
        loadComponent: () =>
          import(
            './pages/admin-lawyer-applications/admin-lawyer-applications.component'
          ).then((m) => m.AdminLawyerApplicationsComponent),
      },
      {
        path: 'pending-submissions',
        loadComponent: () =>
          import(
            './pages/admin-pending-submissions/admin-pending-submissions.component'
          ).then((m) => m.AdminPendingSubmissionsComponent),
      },
      {
        path: 'register',
        loadComponent: () =>
          import('./pages/register/register.component').then(
            (m) => m.RegisterComponent,
          ),
      },
      {
        path: 'amend',
        loadComponent: () =>
          import('./pages/amend/amend.component').then((m) => m.AmendComponent),
      },
      {
        path: 'transfer',
        loadComponent: () =>
          import('./pages/transfer/transfer.component').then(
            (m) => m.TransferComponent,
          ),
      },
    ],
  },
  {
    path: 'lawyer',
    canActivate: [lawyerGuard],
    loadComponent: () =>
      import('./layouts/dashboard-layout/dashboard-layout.component').then(
        (m) => m.DashboardLayoutComponent,
      ),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/lawyer-home/lawyer-home.component').then(
            (m) => m.LawyerHomeComponent,
          ),
      },
      {
        path: 'submit-registration',
        loadComponent: () =>
          import(
            './pages/lawyer-submit-registration/lawyer-submit-registration.component'
          ).then((m) => m.LawyerSubmitRegistrationComponent),
      },
      {
        path: 'submit-amendment',
        loadComponent: () =>
          import(
            './pages/lawyer-submit-amendment/lawyer-submit-amendment.component'
          ).then((m) => m.LawyerSubmitAmendmentComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
