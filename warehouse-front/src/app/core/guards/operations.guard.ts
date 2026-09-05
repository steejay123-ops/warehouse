import { inject } from '@angular/core';
import { Router, CanActivateFn, CanActivateChildFn } from '@angular/router';
import { AuthService } from '../auth/auth.service';

/**
 * گارد اختصاصی مرکز عملیات، پدافند و زیرساخت سازمان (Strict Superuser-Only)
 * ورود و دسترسی به روت‌های /app/operations منحصراً ویژه مدیران ارشد (is_superuser=True)
 */
export const OperationsGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isLoggedIn()) {
    return router.parseUrl('/login');
  }

  const user = auth.user();
  const userPerms = auth.userPermissions() || [];
  const isSuper = Boolean(
    user?.is_superuser ||
    userPerms.includes('admin_all') ||
    user?.roles?.includes('admin') ||
    user?.roles?.includes('superuser')
  );

  if (isSuper) {
    return true;
  }

  // کاربر عادی اجازه دسترسی به مرکز عملیات و زیرساخت را ندارد -> بازگشت به پورتال لانچر
  return router.parseUrl('/app/launcher');
};

export const OperationsGuardChild: CanActivateChildFn = (childRoute, state) => {
  return OperationsGuard(childRoute, state);
};
