import { inject } from '@angular/core';
import {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
  HttpErrorResponse,
} from '@angular/common/http';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

/**
 * HTTP Interceptor — به تمام request‌های API هدر Authorization اضافه می‌کند
 * همچنین در صورت 401 خودکار refresh token انجام می‌دهد
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
        // توکن منقضی شده → تلاش برای refresh
        return auth.refreshToken().pipe(
          switchMap((newToken) => {
            const retryReq = addToken(req, typeof newToken === 'string' ? newToken : '');
            return next(retryReq);
          }),
          catchError((refreshError) => {
            // refresh هم شکست خورد → logout
            auth.logout();
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
