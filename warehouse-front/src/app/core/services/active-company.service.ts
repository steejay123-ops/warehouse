import { Injectable, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Company, UserAvailableCompaniesResponse } from '../models/company.model';
import { SessionTabService } from './session-tab.service';

@Injectable({
  providedIn: 'root'
})
export class ActiveCompanyService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/personnel/companies`;

  private activeCompanySubject = new BehaviorSubject<Company | null>(null);
  public activeCompany$ = this.activeCompanySubject.asObservable();
  public activeCompanySignal = signal<Company | null>(null);

  private availableCompaniesSubject = new BehaviorSubject<Company[]>([]);
  public availableCompanies$ = this.availableCompaniesSubject.asObservable();

  private isModalOpenSubject = new BehaviorSubject<boolean>(false);
  public isModalOpen$ = this.isModalOpenSubject.asObservable();

  private documentCompaniesSubject = new BehaviorSubject<Company[]>([]);
  public documentCompanies$ = this.documentCompaniesSubject.asObservable();
  public documentCompaniesSignal = signal<Company[]>([]);

  private isSuperuserSubject = new BehaviorSubject<boolean>(false);
  public isSuperuser$ = this.isSuperuserSubject.asObservable();

  private isFirstBootSubject = new BehaviorSubject<boolean>(false);
  public isFirstBoot$ = this.isFirstBootSubject.asObservable();
  public isFirstBootSignal = signal<boolean>(false);

  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  public isLoading$ = this.isLoadingSubject.asObservable();

  public hasWarehouseModuleSignal = computed<boolean>(() => {
    const c = this.activeCompanySignal();
    if (!c) {
      return false;
    }
    return c.has_warehouse_module !== false;
  });

  public hasCompanyDocumentsAccess = computed<boolean>(() => {
    return this.isSuperuserSubject.value || this.documentCompaniesSignal().length > 0;
  });

  private sessionTab = inject(SessionTabService, { optional: true });
  private router = inject(Router, { optional: true });

  constructor() {
    this.restoreActiveCompany();
    this.listenToMultiTabEvents();
  }

  private listenToMultiTabEvents(): void {
    if (!this.sessionTab) return;
    this.sessionTab.onMessage((msg) => {
      if (msg.type === 'AUTH_LOGOUT') {
        this.clearActiveCompany();
      }
    });
  }

  get activeCompany(): Company | null {
    return this.activeCompanySubject.value;
  }

  get activeCompanyId(): number | null {
    return this.activeCompany?.id || null;
  }

  get availableCompanies(): Company[] {
    return this.availableCompaniesSubject.value;
  }

  get isSuperuser(): boolean {
    return this.isSuperuserSubject.value;
  }

  get hasWarehouseModule(): boolean {
    return this.hasWarehouseModuleSignal();
  }

  public hasWarehouseModule$ = this.activeCompany$.pipe(
    map((c) => !!c && c.has_warehouse_module !== false)
  );

  public loadDocumentCompanies(): Observable<Company[]> {
    return this.http.get<UserAvailableCompaniesResponse>(`${this.apiUrl}/user-available/?scope=documents`).pipe(
      tap((res) => {
        const comps = res.companies || [];
        this.documentCompaniesSubject.next(comps);
        this.documentCompaniesSignal.set(comps);
        try {
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('wh_document_companies', JSON.stringify(comps));
            localStorage.setItem('wh_document_companies', JSON.stringify(comps));
          }
        } catch {}
        if (res.is_superuser) {
          this.isSuperuserSubject.next(true);
        }
      }),
      map((res) => res.companies || []),
      catchError(() => of([]))
    );
  }

  public openFirstBootWizard(): void {
    this.isFirstBootSubject.next(true);
    this.isFirstBootSignal.set(true);
  }

  public closeFirstBootWizard(): void {
    this.isFirstBootSubject.next(false);
    this.isFirstBootSignal.set(false);
  }

  /**
   * بازیابی وضعیت شرکت با اولویت مطلق سشن تب (Tab-Scoped Isolation)
   * جهت جلوگیری از تداخل اطلاعات بین تب‌های همزمان مرورگر (State Desync)
   */
  private restoreActiveCompany(): void {
    if (typeof window === 'undefined') return;

    try {
      const savedDocs = sessionStorage.getItem('wh_document_companies') || localStorage.getItem('wh_document_companies');
      if (savedDocs) {
        const parsedDocs = JSON.parse(savedDocs) as Company[];
        if (Array.isArray(parsedDocs)) {
          this.documentCompaniesSubject.next(parsedDocs);
          this.documentCompaniesSignal.set(parsedDocs);
          if (!sessionStorage.getItem('wh_document_companies')) {
            sessionStorage.setItem('wh_document_companies', savedDocs);
          }
        }
      }
    } catch {
      // Ignored
    }

    try {
      // ۱. اولویت نخست: بررسی حافظه ایزوله همین تب
      let saved = sessionStorage.getItem('active_company_data');
      if (!saved) {
        // ۲. اگر تب جدید است، از آخرین وضعیت در localStorage پیش‌مقداردهی می‌شود
        saved = localStorage.getItem('active_company_data');
        if (saved) {
          // ۳. بلافاصله در سشن همین تب قفل می‌شود تا از تغییرات آتی سایر تب‌ها ایزوله بماند
          sessionStorage.setItem('active_company_data', saved);
          try {
            const parsed = JSON.parse(saved) as Company;
            if (parsed?.id) {
              sessionStorage.setItem('active_company_id', String(parsed.id));
            }
          } catch {}
        }
      }

      if (saved) {
        const parsed = JSON.parse(saved) as Company;
        if (parsed && parsed.id) {
          this.activeCompanySubject.next(parsed);
          this.activeCompanySignal.set(parsed);
          // اطمینان از همگام بودن کلید شناسه در سشن همین تب برای اینترسپتور
          sessionStorage.setItem('active_company_id', String(parsed.id));
        }
      }
    } catch {
      // Ignored
    }
  }

  public loadAvailableCompanies(forcePrompt: boolean = false): Observable<UserAvailableCompaniesResponse> {
    this.isLoadingSubject.next(true);
    this.loadDocumentCompanies().subscribe();
    return this.http.get<UserAvailableCompaniesResponse>(`${this.apiUrl}/user-available/`).pipe(
      tap((res) => {
        this.isLoadingSubject.next(false);
        const companies = res.companies || [];
        this.availableCompaniesSubject.next(companies);
        this.isSuperuserSubject.next(!!res.is_superuser);

        if (companies.length === 0) {
          this.selectCompany(null);
          this.isModalOpenSubject.next(false);
          // در صورتی که دیتابیس خام باشد و هیچ شرکتی وجود نداشته باشد، ویزارد راه‌اندازی اول باز می‌شود
          if (res.is_superuser) {
            this.openFirstBootWizard();
          }
          return;
        }

        // اگر شرکت وجود دارد، ویزارد اجرای اول بسته می‌شود
        this.closeFirstBootWizard();

        // اگر کاربر فقط به ۱ شرکت دسترسی دارد: مستقیم و خودکار همان شرکت فعال می‌شود
        if (companies.length === 1) {
          this.selectCompany(companies[0]);
          this.isModalOpenSubject.next(false);
          return;
        }

        // بررسی اولویت کوئری‌پارامتر cid در آدرس بار (Deep Linking)
        const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
        const urlCidStr = urlParams?.get('cid');
        const urlCid = urlCidStr ? parseInt(urlCidStr, 10) : null;

        if (urlCid && companies.some((c) => c.id === urlCid)) {
          const matched = companies.find((c) => c.id === urlCid);
          if (matched) {
            this.selectCompany(matched);
            this.isModalOpenSubject.next(false);
            return;
          }
        }

        // اگر کاربر چندشرکتی یا سوپریوزر است:
        const currentActive = this.activeCompany;
        const existsInList = currentActive && companies.some((c) => c.id === currentActive.id);

        if (existsInList && !forcePrompt) {
          // شرکت ذخیره‌شده معتبر است، ادامه بده
          const refreshed = companies.find((c) => c.id === currentActive!.id) || currentActive;
          this.selectCompany(refreshed);
          this.isModalOpenSubject.next(false);
        } else {
          // نیاز به انتخاب شرکت کاری توسط کاربر
          this.isModalOpenSubject.next(true);
        }
      }),
      catchError((err) => {
        this.isLoadingSubject.next(false);
        return of({ companies: [], is_superuser: false, count: 0 });
      })
    );
  }

  public selectCompany(company: Company | null): void {
    this.activeCompanySubject.next(company);
    this.activeCompanySignal.set(company);
    this.isModalOpenSubject.next(false);

    if (typeof window !== 'undefined') {
      if (company) {
        localStorage.setItem('active_company_id', String(company.id));
        localStorage.setItem('active_company_data', JSON.stringify(company));
        sessionStorage.setItem('active_company_id', String(company.id));
        sessionStorage.setItem('active_company_data', JSON.stringify(company));
      } else {
        localStorage.removeItem('active_company_id');
        localStorage.removeItem('active_company_data');
        sessionStorage.removeItem('active_company_id');
        sessionStorage.removeItem('active_company_data');
      }

      // همگام‌سازی URL با کوئری‌پارامتر ?cid=... بدون رفرش صفحه
      try {
        const url = new URL(window.location.href);
        if (company) {
          url.searchParams.set('cid', String(company.id));
        } else {
          url.searchParams.delete('cid');
        }
        window.history.replaceState({}, '', url.toString());
      } catch {}

      if (this.router) {
        this.router.navigate([], {
          queryParams: { cid: company ? company.id : null },
          queryParamsHandling: 'merge',
          replaceUrl: true
        }).catch(() => {});
      }

      // انتشار رویداد سفارشی در پنجره مرورگر برای کامپوننت‌هایی که لیسنر دارند
      window.dispatchEvent(new CustomEvent('company_context_changed', { detail: company }));
    }
  }

  public openSwitchModal(): void {
    this.isModalOpenSubject.next(true);
  }

  public closeSwitchModal(): void {
    // اگر شرکتی انتخاب شده اجازه بستن بده، اگر نشده و کاربر چندشرکتی است نگه دار
    if (this.activeCompany || this.availableCompanies.length <= 1) {
      this.isModalOpenSubject.next(false);
    }
  }

  public clearActiveCompany(): void {
    this.selectCompany(null);
    this.availableCompaniesSubject.next([]);
    this.documentCompaniesSubject.next([]);
    this.documentCompaniesSignal.set([]);
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('wh_document_companies');
        localStorage.removeItem('wh_document_companies');
        sessionStorage.removeItem('active_company_id');
        sessionStorage.removeItem('active_company_data');
        localStorage.removeItem('active_company_id');
        localStorage.removeItem('active_company_data');
      }
    } catch {}
    this.isSuperuserSubject.next(false);
  }
}
