import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Company,
  CompanyDocument,
  CompanyBankAccount,
  ExpiringDocumentsResponse,
  UserAvailableCompaniesResponse
} from '../models/company.model';

@Injectable({
  providedIn: 'root'
})
export class CompanyApiService {
  private http = inject(HttpClient);
  private endpoint = `${environment.apiUrl}/personnel/companies`;
  private documentsEndpoint = `${environment.apiUrl}/personnel/company-documents`;
  private bankAccountsEndpoint = `${environment.apiUrl}/personnel/company-bank-accounts`;

  getAll(filters?: { search?: string; is_active?: boolean }): Observable<Company[] | { results: Company[]; count: number }> {
    let params = new HttpParams();
    if (filters?.search) {
      params = params.set('search', filters.search);
    }
    if (filters?.is_active !== undefined) {
      params = params.set('is_active', String(filters.is_active));
    }
    return this.http.get<Company[] | { results: Company[]; count: number }>(`${this.endpoint}/`, { params });
  }

  getById(id: number): Observable<Company> {
    return this.http.get<Company>(`${this.endpoint}/${id}/`);
  }

  create(payload: Partial<Company>): Observable<Company> {
    return this.http.post<Company>(`${this.endpoint}/`, payload);
  }

  update(id: number, payload: Partial<Company>): Observable<Company> {
    return this.http.put<Company>(`${this.endpoint}/${id}/`, payload);
  }

  patch(id: number, payload: Partial<Company>): Observable<Company> {
    return this.http.patch<Company>(`${this.endpoint}/${id}/`, payload);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.endpoint}/${id}/`);
  }

  getUserAvailable(): Observable<UserAvailableCompaniesResponse> {
    return this.http.get<UserAvailableCompaniesResponse>(`${this.endpoint}/user-available/`);
  }

  exportExcel(): Observable<Blob> {
    return this.http.get(`${this.endpoint}/export-excel/`, { responseType: 'blob' });
  }

  uploadLogo(id: number, file: File): Observable<Company> {
    const formData = new FormData();
    formData.append('logo', file);
    return this.http.patch<Company>(`${this.endpoint}/${id}/`, formData);
  }

  uploadCoreDoc(id: number, docType: 'articles_of_association' | 'latest_gazette', file: File): Observable<Company> {
    const formData = new FormData();
    formData.append(docType, file);
    return this.http.patch<Company>(`${this.endpoint}/${id}/`, formData);
  }

  // مدیریت اسناد و آرشیو مدارک شرکت
  getDocuments(params?: { company_id?: number; document_type?: string; search?: string }): Observable<CompanyDocument[] | { results: CompanyDocument[]; count: number }> {
    let httpParams = new HttpParams();
    if (params?.company_id) httpParams = httpParams.set('company_id', String(params.company_id));
    if (params?.document_type) httpParams = httpParams.set('document_type', params.document_type);
    if (params?.search) httpParams = httpParams.set('search', params.search);
    return this.http.get<CompanyDocument[] | { results: CompanyDocument[]; count: number }>(`${this.documentsEndpoint}/`, { params: httpParams });
  }

  createDocument(formData: FormData): Observable<CompanyDocument> {
    return this.http.post<CompanyDocument>(`${this.documentsEndpoint}/`, formData);
  }

  deleteDocument(id: number): Observable<void> {
    return this.http.delete<void>(`${this.documentsEndpoint}/${id}/`);
  }

  getExpiringDocuments(): Observable<ExpiringDocumentsResponse> {
    return this.http.get<ExpiringDocumentsResponse>(`${this.endpoint}/expiring-documents/`);
  }

  getUserAccesses(params?: { user_id?: number; company_id?: number }): Observable<any[]> {
    let httpParams = new HttpParams();
    if (params?.user_id) httpParams = httpParams.set('user_id', String(params.user_id));
    if (params?.company_id) httpParams = httpParams.set('company_id', String(params.company_id));
    return this.http.get<any[]>(`${environment.apiUrl}/personnel/user-company-access/`, { params: httpParams });
  }

  createUserAccess(payload: { user: number; company: number; is_default?: boolean }): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/personnel/user-company-access/`, payload);
  }

  deleteUserAccess(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/personnel/user-company-access/${id}/`);
  }

  // مدیریت حساب‌های بانکی و شبای رسمی شرکت
  getBankAccounts(companyId?: number): Observable<CompanyBankAccount[] | { results: CompanyBankAccount[]; count: number }> {
    let params = new HttpParams();
    if (companyId) {
      params = params.set('company_id', String(companyId));
    }
    return this.http.get<CompanyBankAccount[] | { results: CompanyBankAccount[]; count: number }>(`${this.bankAccountsEndpoint}/`, { params });
  }

  createBankAccount(payload: Partial<CompanyBankAccount>): Observable<CompanyBankAccount> {
    return this.http.post<CompanyBankAccount>(`${this.bankAccountsEndpoint}/`, payload);
  }

  updateBankAccount(id: number, payload: Partial<CompanyBankAccount>): Observable<CompanyBankAccount> {
    return this.http.put<CompanyBankAccount>(`${this.bankAccountsEndpoint}/${id}/`, payload);
  }

  deleteBankAccount(id: number): Observable<void> {
    return this.http.delete<void>(`${this.bankAccountsEndpoint}/${id}/`);
  }

  setPrimaryBankAccount(id: number): Observable<CompanyBankAccount> {
    return this.http.post<CompanyBankAccount>(`${this.bankAccountsEndpoint}/${id}/set-primary/`, {});
  }
}

