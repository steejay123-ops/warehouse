import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
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
    return this.http.get(`${this.apiUrl}/settings/global/`);
  }

  saveGlobalSettings(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/settings/global/`, data);
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
}
