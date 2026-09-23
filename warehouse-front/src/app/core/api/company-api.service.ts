import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Company, UserAvailableCompaniesResponse } from '../models/company.model';

@Injectable({
  providedIn: 'root'
})
export class CompanyApiService {
  private http = inject(HttpClient);
  private endpoint = `${environment.apiUrl}/personnel/companies`;

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
}
