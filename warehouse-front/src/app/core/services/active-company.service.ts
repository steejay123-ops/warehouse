import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Company, UserAvailableCompaniesResponse } from '../models/company.model';

@Injectable({
  providedIn: 'root'
})
export class ActiveCompanyService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/personnel/companies`;

  private activeCompanySubject = new BehaviorSubject<Company | null>(null);
  public activeCompany$ = this.activeCompanySubject.asObservable();

  private availableCompaniesSubject = new BehaviorSubject<Company[]>([]);
  public availableCompanies$ = this.availableCompaniesSubject.asObservable();

  private isModalOpenSubject = new BehaviorSubject<boolean>(false);
  public isModalOpen$ = this.isModalOpenSubject.asObservable();

  private isSuperuserSubject = new BehaviorSubject<boolean>(false);
  public isSuperuser$ = this.isSuperuserSubject.asObservable();

  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  public isLoading$ = this.isLoadingSubject.asObservable();

  constructor() {
    this.restoreActiveCompany();
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

  private restoreActiveCompany(): void {
    if (typeof window === 'undefined') return;

    try {
      const saved = sessionStorage.getItem('active_company_data') || localStorage.getItem('active_company_data');
      if (saved) {
        const parsed = JSON.parse(saved) as Company;
        if (parsed && parsed.id) {
          this.activeCompanySubject.next(parsed);
        }
      }
    } catch {
      // Ignored
    }
  }

  public loadAvailableCompanies(forcePrompt: boolean = false): Observable<UserAvailableCompaniesResponse> {
    this.isLoadingSubject.next(true);
    return this.http.get<UserAvailableCompaniesResponse>(`${this.apiUrl}/user-available/`).pipe(
      tap((res) => {
        this.isLoadingSubject.next(false);
        const companies = res.companies || [];
        this.availableCompaniesSubject.next(companies);
        this.isSuperuserSubject.next(!!res.is_superuser);

        if (companies.length === 0) {
          this.selectCompany(null);
          this.isModalOpenSubject.next(false);
          return;
        }

        // اگر کاربر فقط به ۱ شرکت دسترسی دارد: مستقیم و خودکار همان شرکت فعال می‌شود
        if (companies.length === 1) {
          this.selectCompany(companies[0]);
          this.isModalOpenSubject.next(false);
          return;
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
}
