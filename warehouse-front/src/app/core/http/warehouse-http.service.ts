import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Warehouse {
  id: number;
  code: string | null;
  name: string;
  project_name: string | null;
  type: string | null;
  location: string | null;
  gps_coordinates: string | null;
  phone_number: string | null;
  manager: number | null;
  is_active: boolean;
  capacity: number | null;
  parent_warehouse: number | null;
  description: string | null;
  operator_company: string | null;
  color: string;
  total_quantity?: number;
  counted_quantity?: number;
  percent?: number;
  created_at: string;
  updated_at: string;
  created_by: number | null;
  modified_by: number | null;
}

@Injectable({
  providedIn: 'root'
})
export class WarehouseHttpService {
  private baseUrl = `${environment.apiUrl}/warehouses/`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<Warehouse[]> {
    return this.http.get<Warehouse[]>(`${this.baseUrl}?t=${new Date().getTime()}`);
  }

  getById(id: number): Observable<Warehouse> {
    return this.http.get<Warehouse>(`${this.baseUrl}${id}/`);
  }

  create(data: Partial<Warehouse>): Observable<Warehouse> {
    return this.http.post<Warehouse>(this.baseUrl, data);
  }

  update(id: number, data: Partial<Warehouse>): Observable<Warehouse> {
    return this.http.patch<Warehouse>(`${this.baseUrl}${id}/`, data);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}${id}/`);
  }

  toggleArchive(id: number): Observable<Warehouse> {
    return this.http.patch<Warehouse>(`${this.baseUrl}${id}/toggle_archive/`, {});
  }
}
