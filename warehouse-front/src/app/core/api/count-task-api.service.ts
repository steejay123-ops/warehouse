import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Paginated } from '../models/api-response.model';

import { CountTask } from '../models/count-task.model';

@Injectable({ providedIn: 'root' })
export class CountTaskApiService {
  private readonly endpoint = 'inventory/count-tasks';

  constructor(private api: ApiService) {}

  getAll(filters?: any): Observable<Paginated<CountTask>> {
    return this.api.get<Paginated<CountTask>>(this.endpoint, filters as globalThis.Record<string, unknown>);
  }

  getById(id: string): Observable<CountTask> {
    return this.api.get<CountTask>(`${this.endpoint}/${id}/`);
  }

  update(id: string | number, payload: Partial<CountTask>): Observable<CountTask> {
    return this.api.patch<CountTask>(`${this.endpoint}/${id}/`, payload);
  }

  bulkSubmit(payload: any = {}): Observable<{ message: string }> {
    return this.api.post<{ message: string }>(`${this.endpoint}/bulk_submit/`, payload);
  }

  bulkCancel(taskIds: number[]): Observable<{ message: string }> {
    return this.api.post<{ message: string }>(`${this.endpoint}/bulk_cancel/`, { task_ids: taskIds });
  }

  bulkApprove(taskIds: number[], note: string = ''): Observable<{ message: string }> {
    return this.api.post<{ message: string }>(`${this.endpoint}/bulk_approve/`, { task_ids: taskIds, note });
  }

  bulkManagerApprove(taskIds: number[], note: string = ''): Observable<{ message: string }> {
    return this.api.post<{ message: string }>(`${this.endpoint}/bulk_manager_approve/`, { task_ids: taskIds, note });
  }

  reject(id: number | string, note: string): Observable<{ message: string }> {
    return this.api.post<{ message: string }>(`${this.endpoint}/${id}/reject/`, { note });
  }

  managerReject(id: number | string, note: string): Observable<{ message: string }> {
    return this.api.post<{ message: string }>(`${this.endpoint}/${id}/manager_reject/`, { note });
  }
}
