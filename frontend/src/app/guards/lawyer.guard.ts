import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const lawyerGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isLoggedIn()) return router.parseUrl('/login');
  if (auth.role() === 'lawyer') return true;
  if (auth.role() === 'lawyer-pending') return router.parseUrl('/pending-approval');
  return router.parseUrl('/access-denied');
};
