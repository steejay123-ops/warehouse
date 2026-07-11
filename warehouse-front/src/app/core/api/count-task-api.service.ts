import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Paginated } from '../models/api-response.model';

@Injectable({ providedIn: 'root' })
export class CountTaskApiService {
  private readonly endpoint = 'inventory/count-tasks';

  constructor(private api: ApiService) {}

  getAll(filters?: any): Observable<Paginated<any>> {
    return this.api.get<Paginated<any>>(this.endpoint, filters as globalThis.Record<string, unknown>);
  }

  getById(id: string): Observable<any> {
    return this.api.get<any>(`${this.endpoint}/${id}/`);
  }

  update(id: string | number, payload: any): Observable<any> {
    return this.api.patch<any>(`${this.endpoint}/${id}/`, payload);
  }
}
