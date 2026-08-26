import { Injectable } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { SKIP_OFFLINE } from '../core/interceptors/offline.interceptor';
import { SKIP_GLOBAL_ERROR_TOAST } from '../core/error/error.interceptor';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface SettingItem {
  value: any;
  is_override?: boolean;
}

export interface SettingsMap {
  [key: string]: SettingItem;
}

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getGlobalSettings(): Observable<any> {
    return this.http.get(`${this.apiUrl}/settings/global/`, {
      context: new HttpContext().set(SKIP_OFFLINE, true)
    });
  }

  getGlobalSettingsWithMeta(): Observable<{ data: any; etag: string | null }> {
    return this.http.get<any>(`${this.apiUrl}/settings/global/`, {
      context: new HttpContext().set(SKIP_OFFLINE, true),
      observe: 'response'
    }).pipe(
      map(res => ({
        data: res.body,
        etag: res.headers.get('ETag') || res.headers.get('etag')
      }))
    );
  }

  saveGlobalSettings(data: any, etag?: string | null): Observable<any> {
    let headers: { [header: string]: string } = {};
    if (etag) {
      headers['If-Match'] = etag;
    }
    return this.http.post(`${this.apiUrl}/settings/global/`, data, {
      headers,
      context: new HttpContext().set(SKIP_OFFLINE, true).set(SKIP_GLOBAL_ERROR_TOAST, true)
    });
  }

  getWarehouseSettings(warehouseId: number): Observable<SettingsMap> {
    return this.http.get<SettingsMap>(`${this.apiUrl}/warehouses/${warehouseId}/settings/`);
  }

  saveWarehouseSettings(warehouseId: number, data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/warehouses/${warehouseId}/settings/`, data);
  }

  resetWarehouseSettings(warehouseId: number, keys: string[]): Observable<any> {
    return this.http.delete(`${this.apiUrl}/warehouses/${warehouseId}/settings/`, { body: { keys } });
  }

  downloadBackup(password: string): Observable<Blob> {
    return this.http.post(
      `${this.apiUrl}/backup/create/`,
      { password },
      { 
        responseType: 'blob',
        context: new HttpContext().set(SKIP_OFFLINE, true).set(SKIP_GLOBAL_ERROR_TOAST, true)
      }
    );
  }

  restoreBackup(file: File, password: string, confirmText: string = 'RESTORE_DATABASE_CONFIRM'): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('password', password);
    formData.append('confirm_text', confirmText);
    return this.http.post(`${this.apiUrl}/backup/restore/`, formData, {
      context: new HttpContext().set(SKIP_OFFLINE, true).set(SKIP_GLOBAL_ERROR_TOAST, true)
    });
  }
}

