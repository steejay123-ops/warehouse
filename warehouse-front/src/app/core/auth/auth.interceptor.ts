import { inject } from '@angular/core';
import {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
  HttpErrorResponse,
} from '@angular/common/http';
import { catchError, switchMap, throwError, BehaviorSubject, filter, take } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

/**
 * وضعیت رفرش — برای مدیریت درخواست‌های همزمان
 * وقتی یک درخواست در حال رفرش توکن است، بقیه درخواست‌ها صبر می‌کنند
 */
let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

/**
 * HTTP Interceptor — به تمام request‌های API هدر Authorization اضافه می‌کند
 * همچنین در صورت 401 خودکار refresh token انجام می‌دهد
 * از مکانیزم صف برای جلوگیری از تداخل درخواست‌های همزمان استفاده می‌کند
 */
export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const auth = inject(AuthService);

  // فقط روی request‌های API اعمال شود (نه CDN، font و...)
  if (!req.url.startsWith(environment.apiUrl)) {
    return next(req);
  }

  // اگر request مربوط به login یا refresh باشد، توکن نمی‌خواهد
  if (req.url.includes('/auth/login') || req.url.includes('/auth/refresh')) {
    return next(req);
  }

  const token = auth.getAccessToken();
  const authReq = token ? addToken(req, token) : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && token) {
        // اگر قبلاً یک درخواست رفرش در حال انجام است، صبر کن
        if (isRefreshing) {
          return refreshTokenSubject.pipe(
            filter((newToken) => newToken !== null),
            take(1),
            switchMap((newToken) => {
              const retryReq = addToken(req, newToken!);
              return next(retryReq);
            })
          );
        }

        // اولین درخواست 401 — شروع رفرش
        isRefreshing = true;
        refreshTokenSubject.next(null);

        return auth.refreshToken().pipe(
          switchMap((newToken) => {
            isRefreshing = false;
            refreshTokenSubject.next(typeof newToken === 'string' ? newToken : '');
            const retryReq = addToken(req, typeof newToken === 'string' ? newToken : '');
            return next(retryReq);
          }),
          catchError((refreshError) => {
            isRefreshing = false;
            refreshTokenSubject.next(null);
            // پاک کردن نشست و هدایت به login داخل AuthService.refreshToken انجام
            // می‌شود و فقط برای رد صریح سرور (4xx) است؛ خطای شبکه نباید کاربر
            // آفلاین را بیرون بیندازد. اینجا فقط خطا را عبور می‌دهیم.
            return throwError(() => refreshError);
          })
        );
      }
      return throwError(() => error);
    })
  );
};

function addToken(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`,
    },
  });
}
