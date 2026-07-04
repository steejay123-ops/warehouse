import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { AuditLog, AuditFilters } from '../models/audit-log.model';
import { Paginated } from '../models/api-response.model';

@Injectable({ providedIn: 'root' })
export class AuditApiService {
  private readonly endpoint = 'audit';

  constructor(private api: ApiService) {}

  /** لیست لاگ‌های تغییرات با فیلتر */
  getAll(filters?: AuditFilters): Observable<Paginated<AuditLog>> {
    return this.api.get<Paginated<AuditLog>>(this.endpoint, filters as Record<string, unknown>);
  }
}
