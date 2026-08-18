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
  title: string;
  color: string;
  parent: number | null;
  permissions: number[];
  children?: Role[];
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
  company?: string;
  address?: string;
  avatar?: string | null;
  blood_type?: string | null;
  emergency_contact?: string | null;
  supervisor: number | null;
  is_active: boolean;
  groups: number[];
  roles?: string[];
  role_titles?: string[];
  user_permissions: number[];
  assigned_warehouses: string[];
}

export interface ImportResult {
  success: boolean;
  summary: { total_rows: number; created: number; updated?: number; skipped: number };
  errors: { row: number; field: string; message: string }[];
}

@Injectable({ providedIn: 'root' })
export class AccountsHttpService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getUsers(has_perm?: string): Observable<User[]> {
    let url = `${this.apiUrl}/auth/users/`;
    if (has_perm) {
      url += `?has_perm=${has_perm}`;
    }
    return this.http.get<any>(url).pipe(
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

  deleteUser(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/auth/users/${id}/`);
  }

  adminResetPassword(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/users/${id}/admin_reset_password/`, {});
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

  // ── Users Excel ──────────────────────────────────────────────────
  exportUsersExcel(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/auth/users/export_excel/`, { responseType: 'blob' });
  }

  importUsersExcel(file: File, updateExisting: boolean = false): Observable<ImportResult> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('update_existing', String(updateExisting));
    return this.http.post<ImportResult>(`${this.apiUrl}/auth/users/import_excel/`, formData);
  }

  downloadUsersTemplate(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/auth/users/download_template/`, { responseType: 'blob' });
  }

  // ── Roles Excel ──────────────────────────────────────────────────
  exportRolesExcel(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/auth/roles/export_excel/`, { responseType: 'blob' });
  }

  importRolesExcel(file: File, updateExisting: boolean = false): Observable<ImportResult> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('update_existing', String(updateExisting));
    return this.http.post<ImportResult>(`${this.apiUrl}/auth/roles/import_excel/`, formData);
  }

  downloadRolesTemplate(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/auth/roles/download_template/`, { responseType: 'blob' });
  }

  // ── Avatar Management ────────────────────────────────────────────
  updateMyAvatar(file: Blob): Observable<{ success: boolean; avatar: string; message: string }> {
    const formData = new FormData();
    formData.append('avatar', file, 'avatar.webp');
    return this.http.post<any>(`${this.apiUrl}/auth/users/me/avatar/`, formData);
  }

  deleteMyAvatar(): Observable<{ success: boolean; avatar: null; message: string }> {
    return this.http.delete<any>(`${this.apiUrl}/auth/users/me/avatar/`);
  }

  updateUserAvatar(userId: number, file: Blob): Observable<{ success: boolean; avatar: string; message: string }> {
    const formData = new FormData();
    formData.append('avatar', file, 'avatar.webp');
    return this.http.post<any>(`${this.apiUrl}/auth/users/${userId}/avatar/`, formData);
  }

  deleteUserAvatar(userId: number): Observable<{ success: boolean; avatar: null; message: string }> {
    return this.http.delete<any>(`${this.apiUrl}/auth/users/${userId}/avatar/`);
  }
}
