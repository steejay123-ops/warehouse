import { inject } from '@angular/core';
import {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
  HttpErrorResponse,
} from '@angular/common/http';
import { catchError, switchMap, throwError, BehaviorSubject, filter, take } from 'rxjs';
import { AuthService } from './auth.service';
import { SessionTabService } from '../services/session-tab.service';
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
  const sessionTab = inject(SessionTabService);

  // فقط روی request‌های API اعمال شود (نه CDN، font و...)
  if (!req.url.startsWith(environment.apiUrl)) {
    return next(req);
  }

  // اگر request مربوط به login یا refresh باشد، توکن نمی‌خواهد (به جز login-logs)
  const isAuthBypass = /\/auth\/(login|refresh)(\/|\?|$)/.test(req.url) && !req.url.includes('login-logs');
  if (isAuthBypass) {
    return next(req);
  }

  const token = auth.getAccessToken();
  const authReq = token ? addToken(req, token, sessionTab) : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && token) {
        // اگر قبلاً یک درخواست رفرش در حال انجام است، صبر کن
        if (isRefreshing) {
          return refreshTokenSubject.pipe(
            filter((newToken) => newToken !== null),
            take(1),
            switchMap((newToken) => {
              const retryReq = addToken(req, newToken!, sessionTab);
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
            const retryReq = addToken(req, typeof newToken === 'string' ? newToken : '', sessionTab);
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

function addToken(req: HttpRequest<unknown>, token: string, sessionTab?: SessionTabService): HttpRequest<unknown> {
  const activeRole = sessionTab
    ? sessionTab.getActiveRole()
    : ((typeof window !== 'undefined' && (sessionStorage.getItem('active_role_persona') || localStorage.getItem('active_role_persona'))) || 'operator');
  const activeApp = sessionTab
    ? sessionTab.getActiveApp()
    : ((typeof window !== 'undefined' && (sessionStorage.getItem('active_app_module') || localStorage.getItem('active_app_module'))) || 'personnel');
  const clientTabId = sessionTab
    ? sessionTab.tabId
    : ((typeof window !== 'undefined' && sessionStorage.getItem('wh_tab_session_id')) || 'tab_main');

  return req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`,
      'X-Active-Role': activeRole,
      'X-Active-App': activeApp,
      'X-Client-Tab-Id': clientTabId,
    },
  });
}

