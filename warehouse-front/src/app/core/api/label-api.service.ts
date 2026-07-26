import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface LabelElement {
  id: string;
  type: 'text' | 'qrcode' | 'special';
  field: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  textAlign: 'right' | 'center' | 'left';
  prefix?: string;
  suffix?: string;
  wrapText?: boolean;
}

export interface LabelTemplate {
  id?: number;
  warehouse: number | null;
  name: string;
  width_mm: number;
  height_mm: number;
  qr_source_field: string;
  elements: LabelElement[];
  paper_type: string;
  grid_rows: number;
  grid_cols: number;
  margin_mm: number;
  is_active: boolean;
}

export interface AvailableField {
  key: string;
  label: string;
  group: string;
}

@Injectable({
  providedIn: 'root'
})
export class LabelApiService {
  private apiUrl = `${environment.apiUrl}/warehouses/label-templates`;

  constructor(private http: HttpClient) {}

  /** Get the active template for a warehouse (with Global fallback) */
  getActiveTemplate(warehouseId: number | null): Observable<LabelTemplate> {
    const params: any = {};
    if (warehouseId) params.warehouse = warehouseId;
    return this.http.get<LabelTemplate>(`${this.apiUrl}/active/`, { params });
  }

  /** List all templates optionally filtered by warehouse */
  listTemplates(warehouseId?: number): Observable<LabelTemplate[]> {
    const params: any = {};
    if (warehouseId) params.warehouse = warehouseId;
    return this.http.get<LabelTemplate[]>(`${this.apiUrl}/`, { params });
  }

  /** Create a new template */
  createTemplate(template: Partial<LabelTemplate>): Observable<LabelTemplate> {
    return this.http.post<LabelTemplate>(`${this.apiUrl}/`, template);
  }

  /** Update an existing template */
  updateTemplate(id: number, template: Partial<LabelTemplate>): Observable<LabelTemplate> {
    return this.http.put<LabelTemplate>(`${this.apiUrl}/${id}/`, template);
  }

  /** Save (create or update) */
  saveTemplate(template: Partial<LabelTemplate>): Observable<LabelTemplate> {
    if (template.id) {
      return this.updateTemplate(template.id, template);
    }
    return this.createTemplate(template);
  }

  /** Delete a template */
  deleteTemplate(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}/`);
  }

  /** Get available fields for label design */
  getAvailableFields(warehouseId?: number): Observable<AvailableField[]> {
    const params: any = {};
    if (warehouseId) params.warehouse = warehouseId;
    return this.http.get<AvailableField[]>(`${this.apiUrl}/available-fields/`, { params });
  }

  /** Generate PDF for printing */
  generatePdf(templateId: number, itemIds: (string | number)[]): Observable<Blob> {
    return this.http.post(`${this.apiUrl}/generate-pdf/`, {
      template_id: templateId,
      item_ids: itemIds
    }, {
      responseType: 'blob'
    });
  }
}
