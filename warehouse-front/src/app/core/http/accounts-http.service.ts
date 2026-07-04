import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface Permission {
  id: number;
  name: string;
  codename: string;
}

export interface Role {
  id: number;
  name: string;
  permissions: number[];
}

export interface User {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  national_code: string;
  phone_number: string;
  operational_zone: string;
  supervisor: number | null;
  is_active: boolean;
  groups: number[];
  user_permissions: number[];
  assigned_warehouses: string[];
}

@Injectable({ providedIn: 'root' })
export class AccountsHttpService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getUsers(): Observable<User[]> {
    return this.http.get<any>(`${this.apiUrl}/auth/users/`).pipe(
      map(res => res.results !== undefined ? res.results : res)
    );
  }

  getUser(id: number): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/auth/users/${id}/`);
  }

  createUser(data: any): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}/auth/users/`, data);
  }

  updateUser(id: number, data: any): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/auth/users/${id}/`, data);
  }

  toggleUserStatus(id: number): Observable<any> {
    return this.http.patch(`${this.apiUrl}/auth/users/${id}/toggle_status/`, {});
  }

  getRoles(): Observable<Role[]> {
    return this.http.get<any>(`${this.apiUrl}/auth/roles/`).pipe(
      map(res => res.results !== undefined ? res.results : res)
    );
  }

  createRole(data: any): Observable<Role> {
    return this.http.post<Role>(`${this.apiUrl}/auth/roles/`, data);
  }

  updateRole(id: number, data: any): Observable<Role> {
    return this.http.put<Role>(`${this.apiUrl}/auth/roles/${id}/`, data);
  }

  deleteRole(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/auth/roles/${id}/`);
  }

  getPermissions(): Observable<Permission[]> {
    return this.http.get<any>(`${this.apiUrl}/auth/permissions/`).pipe(
      map(res => res.results !== undefined ? res.results : res)
    );
  }
}
