import { Injectable, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError, tap, catchError, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AuthTokens,
  LoginPayload,
  LoginResponse,
  AuthUserProfile,
} from '../models/api-response.model';

const TOKEN_KEY = 'wh_access_token';
const REFRESH_KEY = 'wh_refresh_token';
const USER_KEY = 'wh_user_profile';

/**
 * سرویس احراز هویت — آماده JWT
 * فعلاً با mock data کار می‌کند و با سوئیچ environment.useMockData به API واقعی وصل می‌شود
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  /** سیگنال‌های reactive */
  private readonly _user = signal<AuthUserProfile | null>(this.loadUserFromStorage());
  private readonly _isLoading = signal(false);

  /** computed signals — قابل خواندن توسط تمام کامپوننت‌ها */
  readonly user = this._user.asReadonly();
  readonly isLoggedIn = computed(() => this._user() !== null);
  readonly isLoading = this._isLoading.asReadonly();
  readonly userName = computed(() => {
    const u = this._user();
    return u ? `${u.first_name} ${u.last_name}` : '';
  });
  readonly userAvatar = computed(() => this._user()?.avatar_letter ?? '');
  readonly userDepartment = computed(() => this._user()?.department ?? '');
  readonly userRoleTitles = computed(() => this._user()?.role_titles ?? []);
  readonly userPermissions = computed(() => this._user()?.permissions ?? []);

  /** Mock database — فقط در حالت useMockData */
  private readonly mockUsers: Record<string, any> = {
    saman_admin: {
      password: '123456',
      profile: {
        id: 1, username: 'saman_admin', first_name: 'سامان', last_name: 'تقوی سوق',
        avatar_letter: 'س', department: 'admin', role_titles: ['مدیریت کل سیستم (Admin)'],
        permissions: ['perm_sys_settings', 'perm_sys_logs', 'perm_wh_create', 'perm_wh_edit', 'perm_wh_freeze', 'perm_rec_import', 'perm_rec_dispatch', 'perm_rec_label', 'perm_rec_recount', 'perm_usr_add', 'perm_usr_edit', 'perm_usr_role'],
      },
    },
    heydari_manager: {
      password: '123456',
      profile: {
        id: 2, username: 'heydari_manager', first_name: 'ناصر', last_name: 'حیدری',
        avatar_letter: 'ح', department: 'management', role_titles: ['مدیریت پروژه'],
        permissions: ['perm_wh_edit', 'perm_rec_dispatch', 'perm_rec_recount'],
      },
    },
    ghasemi_exec: {
      password: '123456',
      profile: {
        id: 3, username: 'ghasemi_exec', first_name: 'علی', last_name: 'قاسمی',
        avatar_letter: 'ع', department: 'execution', role_titles: ['سرپرست اجرا'],
        permissions: ['perm_rec_label'],
      } as any,
    },
    rezaei_docs: {
      password: '123456',
      profile: {
        id: 4, username: 'rezaei_docs', first_name: 'فاطمه', last_name: 'رضایی',
        avatar_letter: 'ف', department: 'documents', role_titles: ['کارشناس مدارک'],
        permissions: [],
      },
    },
    karimi_feed: {
      password: '123456',
      profile: {
        id: 5, username: 'karimi_feed', first_name: 'حسین', last_name: 'کریمی',
        avatar_letter: 'ه', department: 'feeding', role_titles: ['اپراتور تغذیه MT'],
        permissions: [],
      },
    },
  };

  constructor(private router: Router, private http: HttpClient) {}

  /** لاگین — mock یا API واقعی */
  login(username: string, password: string): Observable<LoginResponse> {
    this._isLoading.set(true);

    if (environment.useMockData) {
      return this.mockLogin(username, password);
    }

    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/auth/login/`, { username, password })
      .pipe(
        tap((response) => this.handleLoginSuccess(response)),
        catchError((err) => {
          this._isLoading.set(false);
          return throwError(() => err);
        })
      );
  }

  /** لاگ‌اوت */
  logout(): void {
    if (!environment.useMockData) {
      const refresh = localStorage.getItem(REFRESH_KEY);
      if (refresh) {
        this.http
          .post(`${environment.apiUrl}/auth/logout/`, { refresh })
          .subscribe({ error: () => {} });
      }
    }
    this.clearAuth();
    this.router.navigate(['/login']);
  }

  /** رفرش توکن — خودکار توسط interceptor */
  refreshToken(): Observable<string> {
    const refresh = localStorage.getItem(REFRESH_KEY);
    if (!refresh) {
      this.clearAuth();
      return throwError(() => new Error('No refresh token'));
    }

    if (environment.useMockData) {
      return of('mock-access-token-refreshed');
    }

    return this.http
      .post<{ access: string }>(`${environment.apiUrl}/auth/refresh/`, { refresh })
      .pipe(
        tap((response) => localStorage.setItem(TOKEN_KEY, response.access)),
        catchError((err) => {
          this.clearAuth();
          this.router.navigate(['/login']);
          return throwError(() => err);
        }),
        map((response) => response.access),
      );
  }

  /** دریافت access token فعلی */
  getAccessToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  /** بررسی دسترسی */
  hasPermission(permCode: string): boolean {
    return this.userPermissions().includes(permCode);
  }

  /** بررسی نقش (department) */
  hasDepartment(dept: string): boolean {
    return this.userDepartment() === dept;
  }

  // ────────── Private ──────────

  private mockLogin(username: string, password: string): Observable<LoginResponse> {
    return new Observable((subscriber) => {
      setTimeout(() => {
        const account = this.mockUsers[username];
        if (account && account.password === password) {
          const response: LoginResponse = {
            tokens: { access: 'mock-access-token', refresh: 'mock-refresh-token' },
            user: account.profile,
          };
          this.handleLoginSuccess(response);
          subscriber.next(response);
          subscriber.complete();
        } else {
          this._isLoading.set(false);
          subscriber.error({ detail: 'نام کاربری یا رمز عبور نادرست است.' });
        }
      }, 800);
    });
  }

  private handleLoginSuccess(response: LoginResponse): void {
    localStorage.setItem(TOKEN_KEY, response.tokens.access);
    localStorage.setItem(REFRESH_KEY, response.tokens.refresh);
    localStorage.setItem(USER_KEY, JSON.stringify(response.user));
    this._user.set(response.user);
    this._isLoading.set(false);
  }

  private clearAuth(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    this._user.set(null);
  }

  private loadUserFromStorage(): AuthUserProfile | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}
