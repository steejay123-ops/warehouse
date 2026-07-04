import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import {
  Record as WarehouseRecord,
  RecordCreatePayload,
  RecordUpdatePayload,
  RecordFilters,
  BulkDispatchPayload,
  BulkTagPayload,
  BulkLabelPayload,
  BulkRecountPayload,
  Tag,
} from '../models/record.model';
import { Paginated } from '../models/api-response.model';
import { ImportLog } from '../models/audit-log.model';

@Injectable({ providedIn: 'root' })
export class RecordApiService {
  private readonly endpoint = 'records';

  constructor(private api: ApiService) {}

  /** لیست رکوردها + فیلتر + مرتب‌سازی + صفحه‌بندی */
  getAll(filters?: RecordFilters): Observable<Paginated<WarehouseRecord>> {
    return this.api.get<Paginated<WarehouseRecord>>(this.endpoint, filters as globalThis.Record<string, unknown>);
  }

  /** جزئیات یک رکورد */
  getById(id: number): Observable<WarehouseRecord> {
    return this.api.get<WarehouseRecord>(`${this.endpoint}/${id}`);
  }

  /** ایجاد رکورد */
  create(payload: RecordCreatePayload): Observable<WarehouseRecord> {
    return this.api.post<WarehouseRecord>(this.endpoint, payload);
  }

  /** ویرایش رکورد */
  update(id: number, payload: RecordUpdatePayload): Observable<WarehouseRecord> {
    return this.api.patch<WarehouseRecord>(`${this.endpoint}/${id}`, payload);
  }

  // ────────── عملیات دسته‌ای ──────────

  /** آپلود فایل Excel → ایجاد رکوردها */
  bulkImport(file: File, projectId: number): Observable<ImportLog> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('project_id', String(projectId));
    return this.api.upload<ImportLog>(`${this.endpoint}/bulk-import`, formData);
  }

  /** تگ‌گذاری دسته‌ای */
  bulkTag(payload: BulkTagPayload): Observable<{ updated_count: number }> {
    return this.api.post(`${this.endpoint}/bulk-tag`, payload);
  }

  /** تخصیص دسته‌ای به تیم میدانی یا اسناد */
  bulkDispatch(payload: BulkDispatchPayload): Observable<{ updated_count: number }> {
    return this.api.post(`${this.endpoint}/bulk-dispatch`, payload);
  }

  /** دستور چاپ لیبل دسته‌ای */
  bulkLabel(payload: BulkLabelPayload): Observable<{ updated_count: number }> {
    return this.api.post(`${this.endpoint}/bulk-label`, payload);
  }

  /** دستور بازشماری */
  bulkRecount(payload: BulkRecountPayload): Observable<{ updated_count: number }> {
    return this.api.post(`${this.endpoint}/bulk-recount`, payload);
  }

  // ────────── خروجی ──────────

  /** خروجی Excel رکوردها */
  exportExcel(filters?: RecordFilters): Observable<Blob> {
    return this.api.download('reports/records/excel', filters as globalThis.Record<string, unknown>);
  }

  /** خروجی PDF رکوردها */
  exportPdf(filters?: RecordFilters): Observable<Blob> {
    return this.api.download('reports/records/pdf', filters as globalThis.Record<string, unknown>);
  }
}
