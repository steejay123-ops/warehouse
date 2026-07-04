import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface RecordItem {
  id: string;
  warehouse: string;
  part_no: string;
  mesc: string;
  desc: string;
  category: string;
  location: string;
  tag_status: string;
  field_status: string;
  doc_status: string;
  has_conflict: boolean;
  is_fragile: boolean;
  is_heavy: boolean;
  needs_qc: boolean;
  assigned_to: string;
  created_at?: string;
  updated_at?: string;
}

@Injectable({
  providedIn: 'root'
})
export class RecordHttpService {
  private baseUrl = `${environment.apiUrl}/records/`;

  constructor(private http: HttpClient) {}

  getAll(params: any = {}): Observable<any> {
    let httpParams = new HttpParams();
    Object.keys(params).forEach(key => {
      if (params[key]) {
        httpParams = httpParams.set(key, params[key]);
      }
    });
    return this.http.get<any>(this.baseUrl, { params: httpParams });
  }

  getById(id: string): Observable<RecordItem> {
    return this.http.get<RecordItem>(`${this.baseUrl}${id}/`);
  }

  create(data: Partial<RecordItem>): Observable<RecordItem> {
    return this.http.post<RecordItem>(this.baseUrl, data);
  }

  update(id: string, data: Partial<RecordItem>): Observable<RecordItem> {
    return this.http.patch<RecordItem>(`${this.baseUrl}${id}/`, data);
  }

  bulkAssign(ids: string[], assignee: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}bulk_assign/`, { ids, assignee });
  }

  bulkTag(ids: string[], tag: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}bulk_tag/`, { ids, tag });
  }
}
