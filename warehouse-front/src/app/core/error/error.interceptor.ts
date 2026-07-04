import { inject } from '@angular/core';
import {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
  HttpErrorResponse,
} from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../../services/toast.service';

/**
 * Global Error Interceptor — خطاهای HTTP را catch کرده و toast مناسب نمایش می‌دهد
 * خطاهای 401 در AuthInterceptor handle می‌شوند، اینجا بقیه خطاها
 */
export const errorInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const toast = inject(ToastService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // 401 توسط auth interceptor مدیریت می‌شود
      if (error.status === 401) {
        return throwError(() => error);
      }
      
      // لاگین خودش 429 را هندل می‌کند
      if (error.status === 429 && req.url.includes('/auth/login')) {
        return throwError(() => error);
      }

      let message = 'خطای ارتباط با سرور. لطفا دوباره تلاش کنید.';

      if (error.status === 0) {
        message = 'ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید.';
      } else if (error.status === 403) {
        message = 'شما مجوز دسترسی به این عملیات را ندارید.';
      } else if (error.status === 404) {
        message = 'مورد درخواستی یافت نشد.';
      } else if (error.status === 422 || error.status === 400) {
        // Validation error — DRF field errors
        if (error.error?.detail) {
          message = error.error.detail;
        } else if (error.error && typeof error.error === 'object') {
          const firstField = Object.keys(error.error)[0];
          const firstError = error.error[firstField];
          message = Array.isArray(firstError)
            ? `${firstField}: ${firstError[0]}`
            : String(firstError);
        }
      } else if (error.status >= 500) {
        message = 'خطای داخلی سرور. لطفا با پشتیبانی تماس بگیرید.';
      }

      toast.show('error', message);

      return throwError(() => error);
    })
  );
};
