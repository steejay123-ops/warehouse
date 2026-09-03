import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import {
  PersonnelProfile,
  VehicleDriverProfile,
  PersonnelChangeRequest,
  VehicleChangeRequest,
  AttendanceMatrixResponse,
  VehicleMatrixResponse,
  AttendanceSummaryRow,
  VehicleSummaryRow,
  MonthlyWorkPeriod,
  MonthlyGridResponse,
  VehicleMonthlyGridResponse,
  VehicleTripAuditLog,
  FinancialProject,
  ProjectSection,
  UserSectionAssignment,
  Counterparty,
  ExpenseInvoice
} from '../models/personnel.model';

@Injectable({ providedIn: 'root' })
export class PersonnelApiService {
  private readonly baseUrl = 'personnel';

  constructor(private api: ApiService) {}

  // --- پرسنل و کارگزینی ---
  getPersonnelProfiles(params?: { warehouse_id?: number; is_active?: boolean; approval_status?: string; search?: string }): Observable<PersonnelProfile[]> {
    return this.api.get<PersonnelProfile[]>(`${this.baseUrl}/profiles`, params as Record<string, unknown>);
  }

  getPersonnelProfile(id: number): Observable<PersonnelProfile> {
    return this.api.get<PersonnelProfile>(`${this.baseUrl}/profiles/${id}`);
  }

  createPersonnelProfile(data: Partial<PersonnelProfile>): Observable<PersonnelProfile> {
    return this.api.post<PersonnelProfile>(`${this.baseUrl}/profiles`, data);
  }

  updatePersonnelProfile(id: number, data: Partial<PersonnelProfile>): Observable<any> {
    return this.api.patch<any>(`${this.baseUrl}/profiles/${id}`, data);
  }

  deletePersonnelProfile(id: number): Observable<void> {
    return this.api.delete<void>(`${this.baseUrl}/profiles/${id}`);
  }

  importPersonnelExcel(formData: FormData): Observable<any> {
    return this.api.upload<any>(`${this.baseUrl}/profiles/import-excel/`, formData);
  }

  // --- گردش کار تایید پرسنل ---
  approvePersonnelManager(id: number): Observable<any> {
    return this.api.post<any>(`${this.baseUrl}/profiles/${id}/approve-manager/`, {});
  }

  approvePersonnelFinance(id: number): Observable<any> {
    return this.api.post<any>(`${this.baseUrl}/profiles/${id}/approve-finance/`, {});
  }

  rejectPersonnel(id: number, reason: string): Observable<any> {
    return this.api.post<any>(`${this.baseUrl}/profiles/${id}/reject/`, { reason });
  }

  requestPersonnelRevision(id: number, reason: string): Observable<any> {
    return this.api.post<any>(`${this.baseUrl}/profiles/${id}/request-revision/`, { reason });
  }

  // --- ناوگان و رانندگان ---
  getVehicleProfiles(params?: { warehouse_id?: number; is_active?: boolean; approval_status?: string; search?: string }): Observable<VehicleDriverProfile[]> {
    return this.api.get<VehicleDriverProfile[]>(`${this.baseUrl}/vehicles`, params as Record<string, unknown>);
  }

  getVehicleProfile(id: number): Observable<VehicleDriverProfile> {
    return this.api.get<VehicleDriverProfile>(`${this.baseUrl}/vehicles/${id}`);
  }

  getVehicleDriverProfile(id: number): Observable<VehicleDriverProfile> {
    return this.getVehicleProfile(id);
  }

  createVehicleProfile(data: Partial<VehicleDriverProfile>): Observable<VehicleDriverProfile> {
    return this.api.post<VehicleDriverProfile>(`${this.baseUrl}/vehicles`, data);
  }

  createVehicleDriverProfile(data: Partial<VehicleDriverProfile>): Observable<VehicleDriverProfile> {
    return this.createVehicleProfile(data);
  }

  updateVehicleProfile(id: number, data: Partial<VehicleDriverProfile>): Observable<any> {
    return this.api.patch<any>(`${this.baseUrl}/vehicles/${id}`, data);
  }

  updateVehicleDriverProfile(id: number, data: Partial<VehicleDriverProfile>): Observable<any> {
    return this.updateVehicleProfile(id, data);
  }

  deleteVehicleProfile(id: number): Observable<void> {
    return this.api.delete<void>(`${this.baseUrl}/vehicles/${id}`);
  }

  // --- گردش کار تایید ناوگان ---
  approveVehicleManager(id: number): Observable<any> {
    return this.api.post<any>(`${this.baseUrl}/vehicles/${id}/approve-manager/`, {});
  }

  approveVehicleFinance(id: number): Observable<any> {
    return this.api.post<any>(`${this.baseUrl}/vehicles/${id}/approve-finance/`, {});
  }

  rejectVehicle(id: number, reason: string): Observable<any> {
    return this.api.post<any>(`${this.baseUrl}/vehicles/${id}/reject/`, { reason });
  }

  requestVehicleRevision(id: number, reason: string): Observable<any> {
    return this.api.post<any>(`${this.baseUrl}/vehicles/${id}/request-revision/`, { reason });
  }

  // --- کارتابل تغییرات پرسنل (Personnel Change Requests) ---
  getPersonnelChangeRequests(params?: { status?: string; search?: string }): Observable<PersonnelChangeRequest[]> {
    return this.api.get<PersonnelChangeRequest[]>(`${this.baseUrl}/personnel-change-requests`, params as Record<string, unknown>);
  }

  approvePersonnelChangeRequestManager(id: number): Observable<any> {
    return this.api.post<any>(`${this.baseUrl}/personnel-change-requests/${id}/approve-manager/`, {});
  }

  approvePersonnelChangeRequestFinance(id: number): Observable<any> {
    return this.api.post<any>(`${this.baseUrl}/personnel-change-requests/${id}/approve-finance/`, {});
  }

  rejectPersonnelChangeRequest(id: number, reason: string): Observable<any> {
    return this.api.post<any>(`${this.baseUrl}/personnel-change-requests/${id}/reject/`, { reason });
  }

  // --- کارتابل تغییرات ناوگان (Vehicle Change Requests) ---
  getVehicleChangeRequests(params?: { status?: string; search?: string }): Observable<VehicleChangeRequest[]> {
    return this.api.get<VehicleChangeRequest[]>(`${this.baseUrl}/vehicle-change-requests`, params as Record<string, unknown>);
  }

  approveVehicleChangeRequestManager(id: number): Observable<any> {
    return this.api.post<any>(`${this.baseUrl}/vehicle-change-requests/${id}/approve-manager/`, {});
  }

  approveVehicleChangeRequestFinance(id: number): Observable<any> {
    return this.api.post<any>(`${this.baseUrl}/vehicle-change-requests/${id}/approve-finance/`, {});
  }

  rejectVehicleChangeRequest(id: number, reason: string): Observable<any> {
    return this.api.post<any>(`${this.baseUrl}/vehicle-change-requests/${id}/reject/`, { reason });
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
    options?: { context?: import('@angular/common/http').HttpContext; status?: string }
  ): Observable<VehicleMatrixResponse> {
    const params: any = { date_shamsi: dateShamsi };
    if (warehouseId) {
      params.warehouse_id = warehouseId;
    }
    if (options?.status) {
      params.status = options.status;
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

  getVehicleMonthlyGrid(
    warehouseId: number | null | undefined,
    yearMonth: string,
    options?: { context?: import('@angular/common/http').HttpContext; status?: string }
  ): Observable<VehicleMonthlyGridResponse> {
    const params: any = { year_month: yearMonth };
    if (warehouseId) {
      params.warehouse_id = warehouseId;
    }
    if (options?.status) {
      params.status = options.status;
    }
    return this.api.get<VehicleMonthlyGridResponse>(`${this.baseUrl}/trips/monthly-grid`, params, options);
  }

  updateVehicleDayTrip(payload: {
    vehicle_id: number;
    warehouse_id?: number | null;
    date_shamsi: string;
    trip_count: number;
    unit_rate?: number;
    dispatch_reference?: string;
    origin_destination?: string;
    notes?: string;
    client_tab_id?: string;
  }): Observable<{ message: string; trip_id: number | null }> {
    return this.api.post<{ message: string; trip_id: number | null }>(
      `${this.baseUrl}/trips/update-day-trip/`,
      payload
    );
  }

  saveVehicleMonthlyGridBulk(payload: {
    warehouse_id?: number | null;
    year_month: string;
    client_tab_id?: string;
    items: Array<{
      vehicle_id: number;
      day: number;
      trip_count: number;
      unit_rate?: number;
      dispatch_reference?: string;
      origin_destination?: string;
      notes?: string;
    }>;
  }): Observable<{ message: string; saved_count: number }> {
    return this.api.post<{ message: string; saved_count: number }>(
      `${this.baseUrl}/trips/bulk-save-monthly-grid/`,
      payload
    );
  }

  // --- دوره‌های ماهانه و قفل ---
  lockPeriod(periodId: number): Observable<{ message: string }> {
    return this.api.post<{ message: string }>(`${this.baseUrl}/periods/${periodId}/lock/`, {});
  }

  unlockPeriod(periodId: number): Observable<{ message: string }> {
    return this.api.post<{ message: string }>(`${this.baseUrl}/periods/${periodId}/unlock/`, {});
  }

  // --- تنظیمات پایه سالانه و ۲۰ گروه شغلی ---
  getYearlySettings(year = '1405', projectId?: number | null): Observable<any> {
    const params: any = { year };
    if (projectId) {
      params.project_id = projectId;
    }
    return this.api.get<any>(`${this.baseUrl}/settings/active-or-year/`, params);
  }

  cloneSettingsForProject(projectId: number, year = '1405'): Observable<any> {
    return this.api.post<any>(`${this.baseUrl}/settings/clone-for-project/`, { project_id: projectId, year });
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

  updateYearlySettings(year: string, payload: any): Observable<any> {
    if (payload && payload.id) {
      return this.updateAllSettingsTabs(payload.id, payload);
    }
    return this.api.post<any>(`${this.baseUrl}/settings/active-or-year/`, { year, ...payload });
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

  importTaxExcel(payload: FormData | { items: any[]; period_id?: number | null; year_month?: string }): Observable<{
    message: string;
    matched_count: number;
    unmatched_count: number;
    unmatched_rows: any[];
    total_imported_tax: number;
    period_year_month: string;
  }> {
    if (payload instanceof FormData) {
      return this.api.upload<any>(`${this.baseUrl}/monthly-payroll/import-tax-excel/`, payload);
    }
    return this.api.post<any>(`${this.baseUrl}/monthly-payroll/import-tax-excel/`, payload);
  }

  // لینک‌های مستقیم دانلود فایل‌ها و دیسکت‌ها
  getDskZipDownloadUrl(periodId: number, projectId?: number): string {
    const projParam = projectId ? `&project_id=${projectId}` : '';
    return `/api/personnel/monthly-payroll/export-bimeh-diskettes/?period_id=${periodId}${projParam}`;
  }

  getBimehDiskettesDownloadUrl(periodId: number, projectId?: number): string {
    const projParam = projectId ? `&project_id=${projectId}` : '';
    return `/api/personnel/monthly-payroll/export-bimeh-diskettes/?period_id=${periodId}${projParam}`;
  }

  getTaxWhDownloadUrl(periodId: number): string {
    return `/api/personnel/monthly-payroll/export-tax-wh/?period_id=${periodId}`;
  }

  getTaxWpDownloadUrl(periodId: number): string {
    return `/api/personnel/monthly-payroll/export-tax-wp/?period_id=${periodId}`;
  }

  getBankExcelDownloadUrl(periodId: number, projectId?: number): string {
    const projParam = projectId ? `&project_id=${projectId}` : '';
    return `/api/personnel/monthly-payroll/export-bank-excel/?period_id=${periodId}${projParam}`;
  }

  getMonthlyExcelDownloadUrl(periodId: number): string {
    return `/api/personnel/monthly-payroll/export-monthly-excel/?period_id=${periodId}`;
  }

  getFleetMonthlyExcelDownloadUrl(warehouseId: number | null | undefined, yearMonth: string): string {
    const whParam = warehouseId ? `&warehouse_id=${warehouseId}` : '';
    return `/api/personnel/trips/export-monthly-excel/?year_month=${yearMonth}${whParam}`;
  }

  importFleetMonthlyExcel(formData: FormData): Observable<any> {
    return this.api.upload<any>(`${this.baseUrl}/trips/import-monthly-excel/`, formData);
  }

  getVehicleTripAuditLogs(params?: { vehicle_id?: number; year_month?: string }): Observable<VehicleTripAuditLog[]> {
    return this.api.get<VehicleTripAuditLog[]>(`${this.baseUrl}/trips/audit-logs/`, params as Record<string, unknown>);
  }

  // --- محاسبات و تسویه مالی ناوگان ---
  calculateFleetSettlement(warehouseId: number | null | undefined, yearMonth: string): Observable<any> {
    const params: any = { year_month: yearMonth };
    if (warehouseId) {
      params.warehouse_id = warehouseId;
    }
    return this.api.get<any>(`${this.baseUrl}/fleet-settlement/calculate/`, params);
  }

  getFleetBankExcelDownloadUrl(warehouseId: number | null | undefined, yearMonth: string): string {
    const whParam = warehouseId ? `&warehouse_id=${warehouseId}` : '';
    return `/api/personnel/fleet-settlement/export-bank-excel/?year_month=${yearMonth}${whParam}`;
  }

  // --- کارتابل‌های ۵ سطحی سازمانی و خزانه‌داری ---
  getSupervisorCartable(): Observable<any> {
    return this.api.get<any>(`${this.baseUrl}/cartable/supervisor/`);
  }

  getAccountantCartable(): Observable<any> {
    return this.api.get<any>(`${this.baseUrl}/cartable/accountant/`);
  }

  getManagerCartable(): Observable<any> {
    return this.api.get<any>(`${this.baseUrl}/cartable/manager/`);
  }

  getTreasuryCartable(): Observable<any> {
    return this.api.get<any>(`${this.baseUrl}/cartable/treasury/`);
  }

  postCartableAction(
    cartableType: 'supervisor' | 'accountant' | 'manager',
    data: { action: 'approve' | 'revision' | 'reject'; model: string; id: number; reason?: string }
  ): Observable<any> {
    return this.api.post<any>(`${this.baseUrl}/cartable/${cartableType}/`, data);
  }

  disburseTreasury(data: {
    action: 'disburse_period' | 'disburse_single_payroll' | 'disburse_fleet';
    tracking_code: string;
    period_id?: number;
    payroll_id?: number;
    trip_ids?: number[];
    batch_id?: string;
  }): Observable<any> {
    return this.api.post<any>(`${this.baseUrl}/cartable/treasury/`, data);
  }

  getTreasuryDisketteDownloadUrl(periodId: number, type: 'paya' | 'satna' = 'paya'): string {
    return `/api/personnel/cartable/treasury/export-diskette/?period_id=${periodId}&type=${type}`;
  }

  // --- ساختار سازمانی: پروژه‌های مالی و عملیاتی ---
  getFinancialProjects(params?: { is_active?: boolean; search?: string }): Observable<FinancialProject[]> {
    return this.api.get<FinancialProject[]>(`${this.baseUrl}/financial-projects`, params as Record<string, unknown>);
  }

  createFinancialProject(data: Partial<FinancialProject>): Observable<FinancialProject> {
    return this.api.post<FinancialProject>(`${this.baseUrl}/financial-projects`, data);
  }

  updateFinancialProject(id: number, data: Partial<FinancialProject>): Observable<FinancialProject> {
    return this.api.patch<FinancialProject>(`${this.baseUrl}/financial-projects/${id}`, data);
  }

  deleteFinancialProject(id: number): Observable<void> {
    return this.api.delete<void>(`${this.baseUrl}/financial-projects/${id}`);
  }

  // --- ساختار سازمانی: بخش‌ها و دپارتمان‌های پروژه ---
  getProjectSections(params?: { project_id?: number; is_active?: boolean; search?: string }): Observable<ProjectSection[]> {
    return this.api.get<ProjectSection[]>(`${this.baseUrl}/project-sections`, params as Record<string, unknown>);
  }

  createProjectSection(data: Partial<ProjectSection>): Observable<ProjectSection> {
    return this.api.post<ProjectSection>(`${this.baseUrl}/project-sections`, data);
  }

  updateProjectSection(id: number, data: Partial<ProjectSection>): Observable<ProjectSection> {
    return this.api.patch<ProjectSection>(`${this.baseUrl}/project-sections/${id}`, data);
  }

  deleteProjectSection(id: number): Observable<void> {
    return this.api.delete<void>(`${this.baseUrl}/project-sections/${id}`);
  }

  // --- ساختار سازمانی: انتساب کاربران به بخش‌ها ---
  getUserSectionAssignments(params?: { section_id?: number; project_id?: number; user_id?: number; role?: string }): Observable<UserSectionAssignment[]> {
    return this.api.get<UserSectionAssignment[]>(`${this.baseUrl}/user-section-assignments`, params as Record<string, unknown>);
  }

  createUserSectionAssignment(data: Partial<UserSectionAssignment>): Observable<UserSectionAssignment> {
    return this.api.post<UserSectionAssignment>(`${this.baseUrl}/user-section-assignments`, data);
  }

  updateUserSectionAssignment(id: number, data: Partial<UserSectionAssignment>): Observable<UserSectionAssignment> {
    return this.api.patch<UserSectionAssignment>(`${this.baseUrl}/user-section-assignments/${id}`, data);
  }

  deleteUserSectionAssignment(id: number): Observable<void> {
    return this.api.delete<void>(`${this.baseUrl}/user-section-assignments/${id}`);
  }

  getMySections(): Observable<ProjectSection[]> {
    return this.api.get<ProjectSection[]>(`${this.baseUrl}/user-section-assignments/my-sections/`);
  }

  // --- طرف‌حساب‌های مالی ---
  getCounterparties(params?: { section_id?: number; counterparty_type?: string; search?: string }): Observable<Counterparty[]> {
    return this.api.get<Counterparty[]>(`${this.baseUrl}/counterparties`, params as Record<string, unknown>);
  }

  createCounterparty(data: Partial<Counterparty>): Observable<Counterparty> {
    return this.api.post<Counterparty>(`${this.baseUrl}/counterparties`, data);
  }

  updateCounterparty(id: number, data: Partial<Counterparty>): Observable<Counterparty> {
    return this.api.patch<Counterparty>(`${this.baseUrl}/counterparties/${id}`, data);
  }

  deleteCounterparty(id: number): Observable<void> {
    return this.api.delete<void>(`${this.baseUrl}/counterparties/${id}`);
  }

  // --- فاکتورهای هزینه ---
  getExpenseInvoices(params?: { section_id?: number; status?: string; search?: string }): Observable<ExpenseInvoice[]> {
    return this.api.get<ExpenseInvoice[]>(`${this.baseUrl}/expense-invoices`, params as Record<string, unknown>);
  }

  createExpenseInvoice(data: Partial<ExpenseInvoice>): Observable<ExpenseInvoice> {
    return this.api.post<ExpenseInvoice>(`${this.baseUrl}/expense-invoices`, data);
  }

  updateExpenseInvoice(id: number, data: Partial<ExpenseInvoice>): Observable<ExpenseInvoice> {
    return this.api.patch<ExpenseInvoice>(`${this.baseUrl}/expense-invoices/${id}`, data);
  }

  deleteExpenseInvoice(id: number): Observable<void> {
    return this.api.delete<void>(`${this.baseUrl}/expense-invoices/${id}`);
  }

  // --- ورودی و خروجی اکسل ساختار سازمانی و طرف‌های حساب ---
  exportFinancialProjectsExcel(): Observable<Blob> {
    return this.api.download(`${this.baseUrl}/financial-projects/export-excel/`);
  }

  downloadFinancialProjectsTemplate(): Observable<Blob> {
    return this.api.download(`${this.baseUrl}/financial-projects/download-template/`);
  }

  exportProjectSectionsExcel(projectId?: number): Observable<Blob> {
    const params = projectId ? { project_id: projectId } : undefined;
    return this.api.download(`${this.baseUrl}/project-sections/export-excel/`, params);
  }

  downloadProjectSectionsTemplate(): Observable<Blob> {
    return this.api.download(`${this.baseUrl}/project-sections/download-template/`);
  }

  exportCounterpartiesExcel(sectionId?: number): Observable<Blob> {
    const params = sectionId ? { section_id: sectionId } : undefined;
    return this.api.download(`${this.baseUrl}/counterparties/export-excel/`, params);
  }

  downloadCounterpartiesTemplate(): Observable<Blob> {
    return this.api.download(`${this.baseUrl}/counterparties/download-template/`);
  }

  importCounterpartiesExcel(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.api.post<any>(`${this.baseUrl}/counterparties/import-excel/`, formData);
  }
}



