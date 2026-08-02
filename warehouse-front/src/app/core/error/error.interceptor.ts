import { inject } from '@angular/core';
import {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
  HttpErrorResponse,
  HttpContextToken,
} from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../../services/toast.service';
import { OFFLINE_NO_CACHE, OFFLINE_UPLOAD_UNSUPPORTED } from '../interceptors/offline.interceptor';
import { isServerUnreachable } from '../services/server-reachability';

export const SKIP_GLOBAL_ERROR_TOAST = new HttpContextToken<boolean>(() => false);

/**
 * یک صفحه ممکن است چند GET موازی بزند و آفلاین همه با هم شکست بخورند.
 * ToastService نه de-dup دارد نه تایمرش را می‌شود متوقف کرد، پس فاصله‌گذاری
 * را همین‌جا انجام می‌دهیم تا کاربر با چند توست یکسان روبه‌رو نشود.
 */
let lastOfflineToastAt = 0;
const OFFLINE_TOAST_GAP_MS = 3000;

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
      if (req.context.get(SKIP_GLOBAL_ERROR_TOAST)) {
        return throwError(() => error);
      }

      // 401 توسط auth interceptor مدیریت می‌شود
      if (error.status === 401) {
        return throwError(() => error);
      }
      
      // لاگین خودش 429 را هندل می‌کند
      if (error.status === 429 && req.url.includes('/auth/login')) {
        return throwError(() => error);
      }

      // آپلود فایل در حالت آفلاین — فایل نزد کاربر مانده و چیزی گم نشده
      if (req.context.get(OFFLINE_UPLOAD_UNSUPPORTED)) {
        toast.show(
          'warning',
          'آپلود فایل در حالت آفلاین ممکن نیست. فایل شما ارسال نشد؛ پس از برقراری اتصال دوباره تلاش کنید.'
        );
        return throwError(() => error);
      }

      // آفلاین + نبود کش — این «خطای سرور» نیست، وضعیت آفلاین است
      if (req.context.get(OFFLINE_NO_CACHE)) {
        const now = Date.now();
        if (now - lastOfflineToastAt > OFFLINE_TOAST_GAP_MS) {
          lastOfflineToastAt = now;
          toast.show(
            'warning',
            'شما آفلاین هستید و این اطلاعات روی دستگاه ذخیره نشده است. پس از برقراری اتصال دوباره تلاش کنید.'
          );
        }
        return throwError(() => error);
      }

      let message = 'خطای ارتباط با سرور. لطفا دوباره تلاش کنید.';

      if (isServerUnreachable(error.status)) {
        // ۵۳۰ از Cloudflare یک پاسخ کامل HTTP است، پس در شرط `>= 500` می‌افتاد و
        // کاربر «با پشتیبانی تماس بگیرید» می‌دید؛ در حالی که بک‌اند هیچ خطایی
        // نداده — درخواست هرگز به آن نرسیده است. مقصر اتصال است، نه سرور.
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
