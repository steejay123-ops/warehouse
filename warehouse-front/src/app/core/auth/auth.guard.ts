import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * گارد احراز هویت — فقط کاربران لاگین‌شده اجازه ورود دارند
 */
export const AuthGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isLoggedIn()) {
    const user = auth.user();
    if (user?.requires_password_change) {
      if (state.url.includes('/change-password')) {
        return true;
      }
      return router.parseUrl('/change-password');
    }
    return true;
  }
  return router.parseUrl('/login');
};
