import { Routes } from '@angular/router';
import { adminGuard } from './guards/admin.guard';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'verify', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    canActivate: [adminGuard],
    loadComponent: () => import('./pages/register/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: 'amend',
    canActivate: [adminGuard],
    loadComponent: () => import('./pages/amend/amend.component').then((m) => m.AmendComponent),
  },
  {
    path: 'transfer',
    canActivate: [adminGuard],
    loadComponent: () => import('./pages/transfer/transfer.component').then((m) => m.TransferComponent),
  },
  {
    path: 'verify',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/verify/verify.component').then((m) => m.VerifyComponent),
  },
  {
    path: 'history',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/history/history.component').then((m) => m.HistoryComponent),
  },
  {
    path: 'access-denied',
    loadComponent: () => import('./pages/access-denied/access-denied.component').then((m) => m.AccessDeniedComponent),
  },
  { path: '**', redirectTo: 'verify' },
];
