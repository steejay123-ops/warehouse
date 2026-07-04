import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Tag } from '../models/record.model';

@Injectable({ providedIn: 'root' })
export class TagApiService {
  private readonly endpoint = 'tags';

  constructor(private api: ApiService) {}

  /** لیست تگ‌ها (فیلتر بر اساس پروژه) */
  getAll(projectId?: number): Observable<Tag[]> {
    const params = projectId ? { project: projectId } : {};
    return this.api.get<Tag[]>(this.endpoint, params);
  }

  /** ایجاد تگ جدید */
  create(name: string, projectId: number | null = null): Observable<Tag> {
    return this.api.post<Tag>(this.endpoint, { name, project: projectId });
  }
}
