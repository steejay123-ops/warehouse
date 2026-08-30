import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import {
  PersonnelProfile,
  VehicleDriverProfile,
  AttendanceMatrixResponse,
  VehicleMatrixResponse,
  AttendanceSummaryRow,
  VehicleSummaryRow,
  MonthlyWorkPeriod,
  MonthlyGridResponse
} from '../models/personnel.model';

@Injectable({ providedIn: 'root' })
export class PersonnelApiService {
  private readonly baseUrl = 'personnel';

  constructor(private api: ApiService) {}

  // --- پرسنل و کارگزینی ---
  getPersonnelProfiles(params?: { warehouse_id?: number; is_active?: boolean; search?: string }): Observable<PersonnelProfile[]> {
    return this.api.get<PersonnelProfile[]>(`${this.baseUrl}/profiles`, params as Record<string, unknown>);
  }

  getPersonnelProfile(id: number): Observable<PersonnelProfile> {
    return this.api.get<PersonnelProfile>(`${this.baseUrl}/profiles/${id}`);
  }

  createPersonnelProfile(data: Partial<PersonnelProfile>): Observable<PersonnelProfile> {
    return this.api.post<PersonnelProfile>(`${this.baseUrl}/profiles`, data);
  }

  updatePersonnelProfile(id: number, data: Partial<PersonnelProfile>): Observable<PersonnelProfile> {
    return this.api.patch<PersonnelProfile>(`${this.baseUrl}/profiles/${id}`, data);
  }

  deletePersonnelProfile(id: number): Observable<void> {
    return this.api.delete<void>(`${this.baseUrl}/profiles/${id}`);
  }

  importPersonnelExcel(formData: FormData): Observable<any> {
    return this.api.upload<any>(`${this.baseUrl}/profiles/import-excel/`, formData);
  }

  // --- ناوگان و رانندگان ---
  getVehicleProfiles(params?: { warehouse_id?: number; is_active?: boolean; search?: string }): Observable<VehicleDriverProfile[]> {
    return this.api.get<VehicleDriverProfile[]>(`${this.baseUrl}/vehicles`, params as Record<string, unknown>);
  }

  getVehicleProfile(id: number): Observable<VehicleDriverProfile> {
    return this.api.get<VehicleDriverProfile>(`${this.baseUrl}/vehicles/${id}`);
  }

  createVehicleProfile(data: Partial<VehicleDriverProfile>): Observable<VehicleDriverProfile> {
    return this.api.post<VehicleDriverProfile>(`${this.baseUrl}/vehicles`, data);
  }

  updateVehicleProfile(id: number, data: Partial<VehicleDriverProfile>): Observable<VehicleDriverProfile> {
    return this.api.patch<VehicleDriverProfile>(`${this.baseUrl}/vehicles/${id}`, data);
  }

  deleteVehicleProfile(id: number): Observable<void> {
    return this.api.delete<void>(`${this.baseUrl}/vehicles/${id}`);
  }

  // --- ماتریس ثبت کارکرد پرسنل ---
  getAttendanceMatrix(
    warehouseId: number | null | undefined,
    dateShamsi: string,
    options?: { context?: import('@angular/common/http').HttpContext }
  ): Observable<AttendanceMatrixResponse> {
    const params: any = { date_shamsi: dateShamsi };
    if (warehouseId) {
      params.warehouse_id = warehouseId;
    }
    return this.api.get<AttendanceMatrixResponse>(`${this.baseUrl}/attendance/matrix`, params, options);
  }

  saveAttendanceBulk(payload: {
    warehouse_id?: number | null;
    date_shamsi: string;
    client_tab_id?: string;
    items: Array<{
      personnel_id: number;
      status: string;
      effective_hours: number;
      overtime_hours: number;
      is_friday_work: boolean;
      is_mission: boolean;
      advance_payment: number;
      notes?: string;
    }>;
  }): Observable<{ message: string; saved_count: number; updated_count: number }> {
    return this.api.post<{ message: string; saved_count: number; updated_count: number }>(
      `${this.baseUrl}/attendance/bulk-save`,
      payload
    );
  }

  clearAttendanceDay(payload: {
    warehouse_id?: number | null;
    date_shamsi: string;
    client_tab_id?: string;
    personnel_ids?: number[];
  }): Observable<{ message: string; cleared_count: number }> {
    return this.api.post<{ message: string; cleared_count: number }>(
      `${this.baseUrl}/attendance/clear-day`,
      payload
    );
  }

  getAttendanceMonthlySummary(warehouseId: number | null | undefined, yearMonth: string): Observable<{
    warehouse_id?: number | null;
    year_month: string;
    period_status: string;
    is_locked: boolean;
    summary: AttendanceSummaryRow[];
  }> {
    const params: any = { year_month: yearMonth };
    if (warehouseId) {
      params.warehouse_id = warehouseId;
    }
    return this.api.get<{
      warehouse_id?: number | null;
      year_month: string;
      period_status: string;
      is_locked: boolean;
      summary: AttendanceSummaryRow[];
    }>(`${this.baseUrl}/attendance/monthly-summary`, params);
  }

  getMonthlyAttendanceGrid(
    warehouseId: number | null | undefined,
    yearMonth: string,
    options?: { context?: import('@angular/common/http').HttpContext }
  ): Observable<MonthlyGridResponse> {
    const params: any = { year_month: yearMonth };
    if (warehouseId) {
      params.warehouse_id = warehouseId;
    }
    return this.api.get<MonthlyGridResponse>(`${this.baseUrl}/attendance/monthly-grid`, params, options);
  }

  bulkSaveMonthlyGrid(payload: {
    warehouse_id?: number | null;
    year_month: string;
    client_tab_id?: string;
    items: Array<{
      personnel_id: number;
      day: number;
      status: string;
      effective_hours: number;
      overtime_hours: number;
      is_friday_work: boolean;
      is_mission: boolean;
      advance_payment: number;
      notes?: string;
    }>;
  }): Observable<{ message: string; saved_count: number; updated_count: number }> {
    return this.api.post<{ message: string; saved_count: number; updated_count: number }>(
      `${this.baseUrl}/attendance/bulk-save-monthly-grid/`,
      payload
    );
  }

  // --- گردش کار دو مرحله‌ای تایید کارکرد ---
  periodWorkflowAction(payload: {
    warehouse_id?: number | null;
    year_month: string;
    action: 'submit' | 'approve' | 'reject' | 'unlock';
    notes?: string;
  }): Observable<any> {
    return this.api.post<any>(`${this.baseUrl}/periods/workflow-action/`, payload);
  }

  // --- خروجی و بارگذاری دوطرفه اکسل شیت ماهانه ---
  exportMonthlyAttendanceExcel(warehouseId: number | null | undefined, yearMonth: string): Observable<Blob> {
    const params: any = { year_month: yearMonth };
    if (warehouseId) {
      params.warehouse_id = warehouseId;
    }
    return this.api.download(`${this.baseUrl}/attendance/export-monthly-excel/`, params);
  }

  importMonthlyAttendanceExcel(formData: FormData): Observable<any> {
    return this.api.upload<any>(`${this.baseUrl}/attendance/import-monthly-excel/`, formData);
  }

  // --- ماتریس ثبت سرویس‌های خودرو ---
  getVehicleMatrix(
    warehouseId: number | null | undefined,
    dateShamsi: string,
    options?: { context?: import('@angular/common/http').HttpContext }
  ): Observable<VehicleMatrixResponse> {
    const params: any = { date_shamsi: dateShamsi };
    if (warehouseId) {
      params.warehouse_id = warehouseId;
    }
    return this.api.get<VehicleMatrixResponse>(`${this.baseUrl}/trips/matrix`, params, options);
  }

  saveVehicleTripsBulk(payload: {
    warehouse_id?: number | null;
    date_shamsi: string;
    client_tab_id?: string;
    items: Array<{
      vehicle_id: number;
      trip_count: number;
      unit_rate?: number;
      dispatch_reference?: string;
      origin_destination?: string;
      notes?: string;
    }>;
  }): Observable<{ message: string; saved_count: number }> {
    return this.api.post<{ message: string; saved_count: number }>(
      `${this.baseUrl}/trips/bulk-save`,
      payload
    );
  }

  getVehicleMonthlySummary(warehouseId: number | null | undefined, yearMonth: string): Observable<{
    warehouse_id: number;
    year_month: string;
    summary: VehicleSummaryRow[];
  }> {
    const params: any = { year_month: yearMonth };
    if (warehouseId) {
      params.warehouse_id = warehouseId;
    }
    return this.api.get<{
      warehouse_id: number;
      year_month: string;
      summary: VehicleSummaryRow[];
    }>(`${this.baseUrl}/trips/monthly-summary`, params);
  }

  // --- دوره‌های ماهانه و قفل ---
  lockPeriod(periodId: number): Observable<{ message: string }> {
    return this.api.post<{ message: string }>(`${this.baseUrl}/periods/${periodId}/lock/`, {});
  }

  unlockPeriod(periodId: number): Observable<{ message: string }> {
    return this.api.post<{ message: string }>(`${this.baseUrl}/periods/${periodId}/unlock/`, {});
  }

  // --- تنظیمات پایه سالانه و ۲۰ گروه شغلی ---
  getYearlySettings(year = '1405'): Observable<any> {
    return this.api.get<any>(`${this.baseUrl}/settings/active-or-year/`, { year });
  }

  getJobGradeRate(grade: string, year = '1405'): Observable<{
    grade_number: number;
    daily_base_wage: number;
    daily_seniority_bonus: number;
    hourly_rate: number;
  }> {
    return this.api.get<any>(`${this.baseUrl}/settings/job-grade-rate/`, { grade, year });
  }

  updateAllSettingsTabs(settingsId: number, payload: any): Observable<any> {
    return this.api.post<any>(`${this.baseUrl}/settings/${settingsId}/update-all/`, payload);
  }

  // --- محاسبه ماهانه ۵۸ ستون حقوق و دیسکت‌ها ---
  calculateMonthlyPayroll(warehouseId: number | null | undefined, yearMonth: string): Observable<{
    message: string;
    period_id: number;
    period_status: string;
    summary: {
      total_personnel: number;
      total_gross: number;
      total_payable: number;
      total_insurance: number;
      total_tax: number;
    };
    records: any[];
  }> {
    return this.api.post<any>(`${this.baseUrl}/monthly-payroll/calculate-period/`, {
      warehouse_id: warehouseId,
      year_month: yearMonth
    });
  }

  getMonthlyPayrollRecords(params: { period_id?: number | null; warehouse_id?: number | null; year_month?: string }): Observable<any[]> {
    return this.api.get<any[]>(`${this.baseUrl}/monthly-payroll/`, params as Record<string, unknown>);
  }

  importTaxExcel(formData: FormData): Observable<{
    message: string;
    matched_count: number;
    unmatched_count: number;
    unmatched_rows: any[];
    total_imported_tax: number;
    period_year_month: string;
  }> {
    return this.api.upload<any>(`${this.baseUrl}/monthly-payroll/import-tax-excel/`, formData);
  }

  // لینک‌های مستقیم دانلود فایل‌ها و دیسکت‌ها
  getDskZipDownloadUrl(periodId: number): string {
    return `/api/personnel/monthly-payroll/export-dsk-zip/?period_id=${periodId}`;
  }

  getTaxWhDownloadUrl(periodId: number): string {
    return `/api/personnel/monthly-payroll/export-tax-wh/?period_id=${periodId}`;
  }

  getTaxWpDownloadUrl(periodId: number): string {
    return `/api/personnel/monthly-payroll/export-tax-wp/?period_id=${periodId}`;
  }

  getBankExcelDownloadUrl(periodId: number): string {
    return `/api/personnel/monthly-payroll/export-bank-excel/?period_id=${periodId}`;
  }

  getMonthlyExcelDownloadUrl(periodId: number): string {
    return `/api/personnel/monthly-payroll/export-monthly-excel/?period_id=${periodId}`;
  }
}

