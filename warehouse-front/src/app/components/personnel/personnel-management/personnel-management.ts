import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { StateService } from '../../../services/state.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from '../../../services/toast.service';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { PersonnelApiService } from '../../../core/api/personnel-api.service';
import { WarehouseHttpService } from '../../../core/http/warehouse-http.service';
import {
  PersonnelProfile,
  VehicleDriverProfile,
  AttendanceMatrixRow,
  VehicleMatrixRow,
  AttendanceSummaryRow,
  VehicleSummaryRow,
  PayrollYearlySettings,
  JobGradeTier,
  MonthlyPayrollRecord,
  MonthlyGridDayMeta,
  MonthlyGridPersonnelDay,
  MonthlyGridRow,
  MonthlyGridResponse,
  AttendanceAnomaly
} from '../../../core/models/personnel.model';
import { jalaliToGregorian, gregorianToJalali } from '../../../core/utils/date-utils';
import { NgPersianDatepickerModule } from 'ng-persian-datepicker';

@Component({
  selector: 'app-personnel-management',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgPersianDatepickerModule],
  templateUrl: './personnel-management.html',
  styleUrl: './personnel-management.css'
})
export class PersonnelManagement implements OnInit, OnDestroy {
  // Perspective: 'warehouse' (انباردار) vs 'accountant' (حسابدار)
  portalPerspective: 'warehouse' | 'accountant' = 'accountant';

  // Active Main Tab
  activeTab: string = 'payroll';
  profileSubTab: 'personnel' | 'vehicles' = 'personnel';
  reportSubTab: 'personnel' | 'fleet' = 'personnel';
  settingsSubTab: 'grades' | 'labor' | 'attendance_window' | 'dsk' | 'tax' | 'bank' = 'grades';

  // Filters & State
  selectedWarehouseId: number | null = null;
  warehouses: any[] = [];
  selectedDateShamsi = '';
  selectedYearMonth = '';
  fiscalYear = '1405';
  isAttendanceDatePickerOpen = false;
  attendanceDateControl = new FormControl('');

  // Matrix Attendance
  attendanceRows: AttendanceMatrixRow[] = [];
  isAttendanceLoading = false;
  isSavingAttendance = false;
  isPeriodLocked = false;
  periodStatus = 'OPEN';
  currentPeriodId: number | null = null;

  // Row selection in matrix
  selectedPersonnelIds = new Set<number>();
  selectAllChecked = false;

  // Bulk Hours Modal
  isBulkHoursModalOpen = false;
  bulkHoursScope: 'selected' | 'present' | 'all' = 'selected';
  bulkEffectiveHours = 10;
  bulkOvertimeHours = 0;
  bulkStatusOption: '' | 'PRESENT_10H' | 'HALF_5H' | 'MISSION' | 'FRIDAY_WORK' = '';
  bulkAdvancePayment: number | null = null;
  bulkNotes = '';

  // Excel Smart Paste Modal
  isExcelPasteModalOpen = false;
  excelPasteText = '';
  excelParsedRows: Array<{
    national_code?: string;
    full_name?: string;
    status?: string;
    effective_hours?: number;
    overtime_hours?: number;
    advance_payment?: number;
    notes?: string;
    matchedRow?: AttendanceMatrixRow;
  }> = [];

  // Monthly Timesheet Grid
  attendanceViewMode: 'daily' | 'monthly_grid' = 'daily';
  monthlyGridDays: MonthlyGridDayMeta[] = [];
  monthlyGridRows: MonthlyGridRow[] = [];
  isMonthlyGridLoading = false;
  isSavingMonthlyGrid = false;
  monthlyGridSettingsWindow = { past_days: 3, future_days: 0 };
  monthName = '';
  daysInMonth = 31;

  // Monthly Timesheet Day Detail Modal
  isDayDetailModalOpen = false;
  selectedDayDetailRow: MonthlyGridRow | null = null;
  selectedDayDetailItem: MonthlyGridPersonnelDay | null = null;
  dayDetailStatus: string = '';
  dayDetailEffectiveHours: number = 0;
  dayDetailOvertimeHours: number = 0;
  dayDetailIsFridayWork: boolean = false;
  dayDetailIsMission: boolean = false;
  dayDetailAdvancePayment: number = 0;
  dayDetailNotes: string = '';

  // ── گردش کار تایید دو مرحله‌ای (Two-Step Approval Workflow) ──
  periodInfo: any = null;
  isSubmittingWorkflow = false;
  isRejectModalOpen = false;
  rejectReason = '';
  isSubmitModalOpen = false;
  submitNotes = '';

  // ── هشدارهای هوشمند ناهنجاری‌ها (Anomaly & Conflict Alerts) ──
  anomalies: AttendanceAnomaly[] = [];
  isAnomaliesPanelOpen = false;
  highlightPersonnelId: number | null = null;
  highlightDay: number | null = null;

  // ── خروجی چاپی شیت ماهانه جهت امضا و اثر انگشت (Printable Timesheet) ──
  isPrintModalOpen = false;

  // ── خروجی و ورود دو طرفه اکسل شیت ماهانه (Two-Way Timesheet Excel) ──
  isExportingMonthlyExcel = false;
  isImportingMonthlyExcel = false;
  isExcelImportModalOpen = false;
  selectedExcelImportFile: File | null = null;

  // Matrix Fleet Trips
  vehicleRows: VehicleMatrixRow[] = [];
  isVehicleLoading = false;
  isSavingVehicles = false;

  // Monthly Reports
  attendanceSummary: AttendanceSummaryRow[] = [];
  vehicleSummary: VehicleSummaryRow[] = [];
  isSummaryLoading = false;

  // Monthly Payroll (58 Columns)
  monthlyPayrollRecords: MonthlyPayrollRecord[] = [];
  filteredPayrollRecords: MonthlyPayrollRecord[] = [];
  payrollSearch = '';
  selectedStatusCategory = 'ALL';
  isPayrollLoading = false;
  isCalculatingPayroll = false;
  payrollSummary = {
    total_personnel: 0,
    total_gross: 0,
    total_payable: 0,
    total_insurance: 0,
    total_tax: 0
  };

  // Yearly Settings & 20 Job Grades
  yearlySettings: PayrollYearlySettings | null = null;
  isSettingsLoading = false;
  isSavingSettings = false;

  // Profiles Management
  personnelList: PersonnelProfile[] = [];
  vehiclesList: VehicleDriverProfile[] = [];
  isProfilesLoading = false;
  profileSearch = '';

  // Modals
  isPersonnelModalOpen = false;
  personnelModalTab: 'identity' | 'contract' | 'insurance' | 'allowances' | 'contact' = 'identity';
  editingPersonnel: Partial<PersonnelProfile> | null = null;
  isSavingPersonnel = false;

  isVehicleModalOpen = false;
  editingVehicle: Partial<VehicleDriverProfile> | null = null;
  isSavingVehicle = false;

  // Tax Excel Import Modal
  isTaxModalOpen = false;
  isUploadingTax = false;
  selectedTaxFile: File | null = null;
  taxUploadSummary: any = null;

  constructor(
    public state: StateService,
    public auth: AuthService,
    private api: PersonnelApiService,
    private whService: WarehouseHttpService,
    private toast: ToastService,
    private confirmDialog: ConfirmDialogService,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  get canUnlockPeriod(): boolean {
    const u = this.auth.user();
    if (!u) return false;
    return !!u.is_superuser ||
      (u.roles && (u.roles.includes('admin') || u.roles.includes('manager'))) ||
      (u.permissions && (u.permissions.includes('can_override_attendance_lock') || u.permissions.includes('perm_sys_settings')));
  }

  ngOnInit(): void {
    this.initDefaultDate();
    this.loadWarehouses();
    this.loadYearlySettings();

    // Check query params if any tab or perspective requested
    this.route.queryParams.subscribe(params => {
      let shouldReload = false;
      if (params['perspective']) {
        this.portalPerspective = params['perspective'] === 'warehouse' ? 'warehouse' : 'accountant';
      }
      if (params['tab']) {
        this.activeTab = params['tab'];
      }
      if (params['subtab']) {
        if (this.activeTab === 'profiles') this.profileSubTab = params['subtab'];
        else if (this.activeTab === 'reports') this.reportSubTab = params['subtab'];
        else if (this.activeTab === 'settings') this.settingsSubTab = params['subtab'];
      }
      if (params['wh'] !== undefined) {
        const whId = params['wh'] ? Number(params['wh']) : null;
        if (this.selectedWarehouseId !== whId) {
          this.selectedWarehouseId = whId;
          shouldReload = true;
        }
      }
      if (params['month'] && params['month'] !== this.selectedYearMonth) {
        this.selectedYearMonth = params['month'];
        shouldReload = true;
      }
      if (shouldReload && this.warehouses.length > 0) {
        this.onWarehouseChange();
      }
    });
  }

  updateUrlParams(): void {
    const sub = this.activeTab === 'profiles' ? this.profileSubTab : (this.activeTab === 'reports' ? this.reportSubTab : (this.activeTab === 'settings' ? this.settingsSubTab : null));
    const queryParams: any = {
      perspective: this.portalPerspective,
      tab: this.activeTab,
      subtab: sub || null,
      wh: this.selectedWarehouseId !== null ? this.selectedWarehouseId : null,
      month: this.selectedYearMonth || null,
      year: this.fiscalYear || null
    };
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  ngOnDestroy(): void {}

  private initDefaultDate(): void {
    try {
      const formatter = new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const parts = formatter.formatToParts(new Date());
      const y = parts.find(p => p.type === 'year')?.value || '1405';
      const m = parts.find(p => p.type === 'month')?.value || '04';
      const d = parts.find(p => p.type === 'day')?.value || '01';
      this.selectedDateShamsi = `${y}/${m}/${d}`;
      this.selectedYearMonth = `${y}/${m}`;
      this.fiscalYear = y;
      this.attendanceDateControl.setValue(this.selectedDateShamsi, { emitEvent: false });
    } catch {
      this.selectedDateShamsi = '1405/04/01';
      this.selectedYearMonth = '1405/04';
      this.fiscalYear = '1405';
      this.attendanceDateControl.setValue('1405/04/01', { emitEvent: false });
    }
  }

  loadWarehouses(): void {
    this.whService.getAll().subscribe({
      next: (whs: any[]) => {
        this.warehouses = whs || [];
        // پیش‌فرض سیستم برای ثبت و مشاهده کارکرد: همه پرسنل (مستقل از انبار)
        this.selectedWarehouseId = null;
        this.onWarehouseChange();
        this.cdr.detectChanges();
      },
      error: () => {
        this.toast.show('error', 'خطا در بارگذاری لیست انبارها');
      }
    });
  }

  onWarehouseChange(): void {
    this.updateUrlParams();
    if (this.activeTab === 'attendance') {
      if (this.attendanceViewMode === 'daily') {
        this.loadAttendanceMatrix();
      } else {
        this.loadMonthlyAttendanceGrid();
      }
      return;
    }

    if (this.activeTab === 'fleet') {
      if (this.selectedWarehouseId) {
        this.loadVehicleMatrix();
      } else {
        this.vehicleRows = [];
      }
    } else if (this.activeTab === 'payroll') {
      if (this.selectedWarehouseId) this.loadMonthlyPayroll();
    } else if (this.activeTab === 'reports') {
      if (this.selectedWarehouseId) this.loadMonthlyReports();
    } else if (this.activeTab === 'profiles') {
      this.loadProfiles();
    } else if (this.activeTab === 'settings') {
      this.loadYearlySettings();
    }
  }

  setPerspective(mode: 'warehouse' | 'accountant'): void {
    this.portalPerspective = mode;
    if (mode === 'warehouse') {
      if (this.activeTab !== 'attendance' && this.activeTab !== 'fleet') {
        this.activeTab = 'attendance';
      }
    }
    this.onWarehouseChange();
  }

  setTab(tab: string): void {
    if (tab === 'attendance') {
      this.router.navigate(['/attendance']);
      return;
    }
    if (tab === 'fleet') {
      this.router.navigate(['/attendance'], { queryParams: { mode: 'fleet' } });
      return;
    }
    this.activeTab = tab;
    this.onWarehouseChange();
  }

  // ─────────────────────────────────────────────────────────────
  // ۱. حضور و غیاب ماتریسی پرسنل (انباردار)
  // ─────────────────────────────────────────────────────────────
  loadAttendanceMatrix(): void {
    if (!this.selectedDateShamsi) return;
    this.isAttendanceLoading = true;
    this.selectedPersonnelIds.clear();
    this.selectAllChecked = false;
    this.api.getAttendanceMatrix(this.selectedWarehouseId, this.selectedDateShamsi).subscribe({
      next: (res) => {
        this.attendanceRows = res.rows || [];
        this.isPeriodLocked = res.is_locked;
        this.periodStatus = res.period_status;
        this.isAttendanceLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isAttendanceLoading = false;
        this.toast.show('error', 'خطا در واکشی ماتریس کارکرد روزانه');
        this.cdr.detectChanges();
      }
    });
  }

  onDateChange(): void {
    if (this.selectedDateShamsi) {
      this.attendanceDateControl.setValue(this.selectedDateShamsi, { emitEvent: false });
      this.selectedYearMonth = this.selectedDateShamsi.slice(0, 7);
      if (this.activeTab === 'attendance') {
        if (this.attendanceViewMode === 'daily') {
          this.loadAttendanceMatrix();
        } else {
          this.loadMonthlyAttendanceGrid();
        }
      }
      if (this.activeTab === 'fleet') this.loadVehicleMatrix();
    }
  }

  onYearMonthChange(): void {
    if (this.selectedYearMonth) {
      this.fiscalYear = this.selectedYearMonth.split('/')[0];
      if (this.activeTab === 'attendance' && this.attendanceViewMode === 'monthly_grid') {
        this.loadMonthlyAttendanceGrid();
      }
      if (this.activeTab === 'payroll') this.loadMonthlyPayroll();
      if (this.activeTab === 'reports') this.loadMonthlyReports();
    }
  }

  setAttendanceStatus(row: AttendanceMatrixRow, status: AttendanceMatrixRow['status']): void {
    if (this.isPeriodLocked) {
      this.toast.show('warning', 'دوره قفل شده است و امکان تغییر وضعیت وجود ندارد.');
      return;
    }
    row.status = status;
    if (status === 'PRESENT_10H') {
      row.effective_hours = 10;
      row.is_friday_work = false;
      row.is_mission = false;
    } else if (status === 'HALF_5H') {
      row.effective_hours = 5;
      row.is_friday_work = false;
      row.is_mission = false;
    } else if (status === 'ABSENT' || status === 'LEAVE') {
      row.effective_hours = 0;
      row.overtime_hours = 0;
      row.is_friday_work = false;
      row.is_mission = false;
    } else if (status === 'MISSION') {
      row.effective_hours = 10;
      row.is_mission = true;
      row.is_friday_work = false;
    } else if (status === 'FRIDAY_WORK') {
      row.effective_hours = 10;
      row.is_friday_work = true;
      row.is_mission = false;
    }
  }

  // ── مدیریت انتخاب چندگانه سطرها ─────────────────────────────
  toggleSelectAll(): void {
    if (this.selectAllChecked) {
      this.selectedPersonnelIds.clear();
      this.selectAllChecked = false;
    } else {
      this.attendanceRows.forEach(r => this.selectedPersonnelIds.add(r.personnel_id));
      this.selectAllChecked = true;
    }
  }

  toggleRowSelection(personnelId: number): void {
    if (this.selectedPersonnelIds.has(personnelId)) {
      this.selectedPersonnelIds.delete(personnelId);
    } else {
      this.selectedPersonnelIds.add(personnelId);
    }
    this.selectAllChecked = this.attendanceRows.length > 0 && this.selectedPersonnelIds.size === this.attendanceRows.length;
  }

  isRowSelected(personnelId: number): boolean {
    return this.selectedPersonnelIds.has(personnelId);
  }

  getSelectedCount(): number {
    return this.selectedPersonnelIds.size;
  }

  clearSelection(): void {
    this.selectedPersonnelIds.clear();
    this.selectAllChecked = false;
  }

  // ── ۱. تغییر وضعیت دسته‌جمعی هوشمند (Bulk Attendance Status) ────────
  setBulkAttendanceStatus(status: 'PRESENT_10H' | 'HALF_5H' | 'ABSENT' | 'LEAVE' | 'MISSION' | 'FRIDAY_WORK'): void {
    if (this.isPeriodLocked) {
      this.toast.show('warning', 'دوره قفل است و امکان تغییر وضعیت وجود ندارد.');
      return;
    }
    const targetRows = this.selectedPersonnelIds.size > 0
      ? this.attendanceRows.filter(r => this.selectedPersonnelIds.has(r.personnel_id))
      : this.attendanceRows;

    if (targetRows.length === 0) {
      this.toast.show('info', 'هیچ پرسنلی برای تغییر وضعیت یافت نشد.');
      return;
    }

    targetRows.forEach(row => {
      this.setAttendanceStatus(row, status);
    });

    const scopeText = this.selectedPersonnelIds.size > 0 ? `${targetRows.length} نفر انتخاب‌شده` : `تمام پرسنل (${targetRows.length} نفر)`;
    this.toast.show('success', `وضعیت ${scopeText} به‌روز شد.`);
    this.cdr.detectChanges();
  }

  // ── ۳. کپی از روز قبل (Copy from Yesterday) ──────────────────
  copyFromYesterday(): void {
    if (this.isPeriodLocked) {
      this.toast.show('warning', 'دوره قفل است و امکان تغییر وجود ندارد.');
      return;
    }
    if (!this.selectedDateShamsi) {
      this.toast.show('warning', 'تاریخ انتخابی نامشخص است.');
      return;
    }

    const yesterdayShamsi = this.shiftShamsiDay(this.selectedDateShamsi, -1);
    this.isAttendanceLoading = true;
    this.api.getAttendanceMatrix(this.selectedWarehouseId, yesterdayShamsi).subscribe({
      next: (res) => {
        this.isAttendanceLoading = false;
        const yesterdayRows = res.rows || [];
        if (yesterdayRows.length === 0) {
          this.toast.show('warning', `هیچ اطلاعات کارکردی برای روز قبل (${yesterdayShamsi}) یافت نشد.`);
          return;
        }

        const yesterdayMap = new Map<number, AttendanceMatrixRow>();
        yesterdayRows.forEach(r => yesterdayMap.set(r.personnel_id, r));

        const targetRows = this.selectedPersonnelIds.size > 0
          ? this.attendanceRows.filter(r => this.selectedPersonnelIds.has(r.personnel_id))
          : this.attendanceRows;

        let copiedCount = 0;
        targetRows.forEach(todayRow => {
          const yRow = yesterdayMap.get(todayRow.personnel_id);
          if (yRow && (yRow.status || yRow.is_existing)) {
            todayRow.status = yRow.status;
            todayRow.effective_hours = yRow.effective_hours;
            todayRow.overtime_hours = yRow.overtime_hours;
            todayRow.is_friday_work = yRow.is_friday_work;
            todayRow.is_mission = yRow.is_mission;
            todayRow.notes = yRow.notes || '';
            copiedCount++;
          }
        });

        if (copiedCount > 0) {
          this.toast.show('success', `اطلاعات کارکرد ${copiedCount} نفر از روز قبل (${yesterdayShamsi}) کپی شد. جهت ثبت نهایی، دکمه ذخیره را بزنید.`);
        } else {
          this.toast.show('info', `برای پرسنل حاضر در جدول، اطلاعات ثبت‌شده‌ای در روز قبل (${yesterdayShamsi}) یافت نشد.`);
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.isAttendanceLoading = false;
        this.toast.show('error', `خطا در واکشی کارکرد روز قبل (${yesterdayShamsi})`);
        this.cdr.detectChanges();
      }
    });
  }

  // ── ۴. اعمال گروهی ساعت کار و اضافه‌کار (Bulk Set Hours) ─────
  openBulkHoursModal(): void {
    if (this.isPeriodLocked) {
      this.toast.show('warning', 'دوره قفل است.');
      return;
    }
    this.bulkHoursScope = this.selectedPersonnelIds.size > 0 ? 'selected' : 'present';
    this.bulkEffectiveHours = 10;
    this.bulkOvertimeHours = 0;
    this.bulkStatusOption = '';
    this.bulkAdvancePayment = null;
    this.bulkNotes = '';
    this.isBulkHoursModalOpen = true;
  }

  closeBulkHoursModal(): void {
    this.isBulkHoursModalOpen = false;
  }

  applyBulkHours(): void {
    let targetRows: AttendanceMatrixRow[] = [];
    if (this.bulkHoursScope === 'selected') {
      targetRows = this.attendanceRows.filter(r => this.selectedPersonnelIds.has(r.personnel_id));
      if (targetRows.length === 0) {
        this.toast.show('warning', 'هیچ پرسنلی انتخاب نشده است.');
        return;
      }
    } else if (this.bulkHoursScope === 'present') {
      targetRows = this.attendanceRows.filter(r => r.status === 'PRESENT_10H' || r.status === 'FRIDAY_WORK' || r.status === 'MISSION');
    } else {
      targetRows = this.attendanceRows;
    }

    targetRows.forEach(row => {
      if (this.bulkStatusOption) {
        row.status = this.bulkStatusOption;
        if (this.bulkStatusOption === 'FRIDAY_WORK') row.is_friday_work = true;
        if (this.bulkStatusOption === 'MISSION') row.is_mission = true;
      }
      row.effective_hours = Number(this.bulkEffectiveHours) || 0;
      row.overtime_hours = Number(this.bulkOvertimeHours) || 0;
      if (this.bulkAdvancePayment !== null && this.bulkAdvancePayment > 0) {
        row.advance_payment = Number(this.bulkAdvancePayment);
      }
      if (this.bulkNotes.trim()) {
        row.notes = this.bulkNotes.trim();
      }
    });

    this.toast.show('success', `ساعات کارکرد و اضافه‌کار برای ${targetRows.length} پرسنل با موفقیت اعمال گردید.`);
    this.closeBulkHoursModal();
    this.cdr.detectChanges();
  }

  // ── ۵. تنظیم روز تعطیل رسمی / جمعه (Mark Official Holiday) ──
  markOfficialHoliday(): void {
    if (this.isPeriodLocked) {
      this.toast.show('warning', 'دوره قفل است.');
      return;
    }
    const targetRows = this.selectedPersonnelIds.size > 0
      ? this.attendanceRows.filter(r => this.selectedPersonnelIds.has(r.personnel_id))
      : this.attendanceRows;

    targetRows.forEach(row => {
      row.status = 'LEAVE';
      row.effective_hours = 0;
      row.overtime_hours = 0;
      row.is_friday_work = false;
      row.is_mission = false;
      row.notes = 'تعطیل رسمی';
    });

    this.toast.show('success', `وضعیت ${targetRows.length} پرسنل به تعطیل رسمی (۰ ساعت) تغییر یافت.`);
    this.cdr.detectChanges();
  }

  // ── ۶. پاکسازی وضعیت‌های امروز (Clear Day Attendance) ───────
  async clearDayAttendance(): Promise<void> {
    if (this.isPeriodLocked) {
      this.toast.show('warning', 'دوره قفل است.');
      return;
    }
    const confirmed = await this.confirmDialog.open({
      title: `پاکسازی کارکرد تاریخ ${this.selectedDateShamsi}`,
      message: `آیا از پاکسازی و ریست کردن کارکرد تمام پرسنل در تاریخ جاری (${this.selectedDateShamsi}) اطمینان دارید؟ تغییرات پس از کلیک بر دکمه «ذخیره کارکرد روزانه» در دیتابیس ثبت خواهند شد.`,
      confirmText: 'بله، پاکسازی شود',
      cancelText: 'انصراف',
      type: 'danger'
    });

    if (!confirmed) return;

    const targetRows = this.selectedPersonnelIds.size > 0
      ? this.attendanceRows.filter(r => this.selectedPersonnelIds.has(r.personnel_id))
      : this.attendanceRows;

    targetRows.forEach(row => {
      row.status = '';
      row.effective_hours = 0;
      row.overtime_hours = 0;
      row.is_friday_work = false;
      row.is_mission = false;
      row.advance_payment = 0;
      row.notes = '';
    });

    this.toast.show('info', `کارکرد روز جاری برای ${targetRows.length} پرسنل پاکسازی شد.`);
    this.cdr.detectChanges();
  }

  // ── ۷. چسباندن هوشمند از اکسل (Excel Smart Paste) ───────────
  openExcelPasteModal(): void {
    if (this.isPeriodLocked) {
      this.toast.show('warning', 'دوره قفل است.');
      return;
    }
    this.excelPasteText = '';
    this.excelParsedRows = [];
    this.isExcelPasteModalOpen = true;
  }

  closeExcelPasteModal(): void {
    this.isExcelPasteModalOpen = false;
  }

  onExcelPasteInput(): void {
    if (!this.excelPasteText.trim()) {
      this.excelParsedRows = [];
      return;
    }

    const normalizeDigits = (str: string): string => {
      if (!str) return '';
      return str
        .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
        .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
    };

    const lines = this.excelPasteText.trim().split(/\r?\n/);
    const parsed: typeof this.excelParsedRows = [];

    // نگاشت پرسنل بر اساس کد ملی و نام
    const nationalMap = new Map<string, AttendanceMatrixRow>();
    const nameMap = new Map<string, AttendanceMatrixRow>();
    this.attendanceRows.forEach(r => {
      if (r.national_code) nationalMap.set(normalizeDigits(r.national_code).trim(), r);
      if (r.full_name) nameMap.set(r.full_name.trim().replace(/\s+/g, ' '), r);
    });

    lines.forEach((line, idx) => {
      const rawCols = line.split('\t').map(c => c.trim());
      if (rawCols.length === 0 || !rawCols.some(c => c.length > 0)) return;

      const cols = rawCols.map(c => normalizeDigits(c));

      // پرش از هدر جدول در صورت وجود
      const isHeader = cols.some(c =>
        c.includes('نام') || c.includes('کد ملی') || c.includes('پرسنل') ||
        c.includes('وضعیت') || c.includes('ساعت') || c.includes('اضافه') || c.includes('ردیف')
      );
      if (idx === 0 && isHeader) {
        return;
      }

      let national_code = '';
      let full_name = '';
      let status_str = '';
      let effective_hours: number | undefined;
      let overtime_hours: number | undefined;
      let notes = '';

      if (cols.length >= 4) {
        if (/^\d{10}$/.test(cols[0])) {
          national_code = cols[0];
          full_name = rawCols[1];
          status_str = rawCols[2];
          effective_hours = parseFloat(cols[3]);
          if (cols[4]) overtime_hours = parseFloat(cols[4]);
          if (rawCols[5]) notes = rawCols[5];
        } else if (/^\d{10}$/.test(cols[1])) {
          full_name = rawCols[0];
          national_code = cols[1];
          status_str = rawCols[2];
          effective_hours = parseFloat(cols[3]);
          if (cols[4]) overtime_hours = parseFloat(cols[4]);
          if (rawCols[5]) notes = rawCols[5];
        } else {
          full_name = rawCols[0];
          status_str = rawCols[1];
          effective_hours = parseFloat(cols[2]);
          if (cols[3]) overtime_hours = parseFloat(cols[3]);
          if (rawCols[4]) notes = rawCols[4];
        }
      } else if (cols.length === 3) {
        full_name = rawCols[0];
        status_str = rawCols[1];
        effective_hours = parseFloat(cols[2]);
      } else if (cols.length === 2) {
        full_name = rawCols[0];
        status_str = rawCols[1];
      } else if (cols.length === 1) {
        status_str = rawCols[0];
      }

      // تطبیق هوشمند دقیق بدون Fallback اشتباه بر اساس شماره ردیف
      let matchedRow: AttendanceMatrixRow | undefined;
      if (national_code && nationalMap.has(national_code)) {
        matchedRow = nationalMap.get(national_code);
      } else if (full_name) {
        const cleanName = full_name.replace(/\s+/g, ' ');
        matchedRow = nameMap.get(cleanName) || this.attendanceRows.find(r => r.full_name.includes(cleanName) || cleanName.includes(r.full_name));
      }

      // نگاشت وضعیت متنی به کدهای معتبر سیستم
      let mappedStatus = 'PRESENT_10H';
      const s = (status_str || '').toLowerCase();
      if (s.includes('غایب') || s === 'absent' || s === 'a') mappedStatus = 'ABSENT';
      else if (s.includes('مرخصی') || s === 'leave' || s === 'l') mappedStatus = 'LEAVE';
      else if (s.includes('ماموریت') || s.includes('مأموریت') || s === 'mission' || s === 'm') mappedStatus = 'MISSION';
      else if (s.includes('جمعه') || s === 'friday' || s === 'f') mappedStatus = 'FRIDAY_WORK';
      else if (s.includes('نیمه') || s === 'half' || s === 'h' || effective_hours === 5) mappedStatus = 'HALF_5H';
      else if (s.includes('حاضر') || s === 'present' || s === 'p' || effective_hours === 10) mappedStatus = 'PRESENT_10H';
      else if (effective_hours !== undefined && effective_hours > 0) mappedStatus = 'CUSTOM';

      if (effective_hours === undefined || isNaN(effective_hours)) {
        if (mappedStatus === 'PRESENT_10H' || mappedStatus === 'MISSION' || mappedStatus === 'FRIDAY_WORK') effective_hours = 10;
        else if (mappedStatus === 'HALF_5H') effective_hours = 5;
        else effective_hours = 0;
      }

      parsed.push({
        national_code: national_code || matchedRow?.national_code,
        full_name: full_name || matchedRow?.full_name,
        status: mappedStatus,
        effective_hours: isNaN(effective_hours) ? 10 : effective_hours,
        overtime_hours: isNaN(Number(overtime_hours)) ? 0 : overtime_hours,
        notes,
        matchedRow
      });
    });

    this.excelParsedRows = parsed;
  }

  applyExcelPaste(): void {
    if (this.excelParsedRows.length === 0) {
      this.toast.show('warning', 'هیچ داده‌ای برای چسباندن یافت نشد.');
      return;
    }

    let appliedCount = 0;
    let unmatchedCount = 0;
    this.excelParsedRows.forEach(item => {
      const targetRow = item.matchedRow;
      if (targetRow) {
        targetRow.status = item.status || 'PRESENT_10H';
        targetRow.effective_hours = item.effective_hours !== undefined ? item.effective_hours : 10;
        targetRow.overtime_hours = item.overtime_hours || 0;
        targetRow.is_friday_work = targetRow.status === 'FRIDAY_WORK';
        targetRow.is_mission = targetRow.status === 'MISSION';
        if (item.notes) targetRow.notes = item.notes;
        appliedCount++;
      } else {
        unmatchedCount++;
      }
    });

    if (appliedCount === 0) {
      this.toast.show('error', 'هیچ‌یک از ردیف‌های پیست‌شده با پرسنل سیستم تطبیق داده نشد.');
      return;
    }

    let msg = `اطلاعات ${appliedCount} پرسنل تطبیق‌یافته اعمال شد.`;
    if (unmatchedCount > 0) {
      msg += ` (${unmatchedCount} ردیف تطبیق‌نیافته نادیده گرفته شد)`;
    }
    this.toast.show('success', msg + ' جهت ثبت در دیتابیس، دکمه «ذخیره کارکرد روزانه» را بزنید.');
    this.closeExcelPasteModal();
    this.cdr.detectChanges();
  }

  saveAttendanceMatrix(): void {
    if (!this.selectedDateShamsi) return;
    if (this.isPeriodLocked) {
      this.toast.show('error', 'دوره قفل است و امکان ذخیره وجود ندارد.');
      return;
    }
    this.isSavingAttendance = true;
    const payload = {
      warehouse_id: this.selectedWarehouseId,
      date_shamsi: this.selectedDateShamsi,
      items: this.attendanceRows.map(r => ({
        personnel_id: r.personnel_id,
        status: r.status,
        effective_hours: r.effective_hours,
        overtime_hours: r.overtime_hours,
        is_friday_work: r.is_friday_work,
        is_mission: r.is_mission,
        advance_payment: r.advance_payment,
        notes: r.notes
      }))
    };

    this.api.saveAttendanceBulk(payload).subscribe({
      next: (res) => {
        this.isSavingAttendance = false;
        this.toast.show('success', `کارکرد روزانه ذخیره شد (${res.saved_count} جدید، ${res.updated_count} به‌روزرسانی).`);
        this.loadAttendanceMatrix();
      },
      error: (err) => {
        this.isSavingAttendance = false;
        this.toast.show('error', err?.error?.error || 'خطا در ذخیره کارکرد روزانه');
      }
    });
  }

  // ── ناوبری سریع تاریخ ──────────────────────────────────────
  goToPrevDay(): void {
    this.selectedDateShamsi = this.shiftShamsiDay(this.selectedDateShamsi, -1);
    this.onDateChange();
  }

  goToNextDay(): void {
    this.selectedDateShamsi = this.shiftShamsiDay(this.selectedDateShamsi, 1);
    this.onDateChange();
  }

  goToToday(): void {
    this.selectedDateShamsi = this.getTodayShamsi();
    this.onDateChange();
  }

  goToYesterday(): void {
    this.selectedDateShamsi = this.shiftShamsiDay(this.getTodayShamsi(), -1);
    this.onDateChange();
  }

  goToPrevMonth(): void {
    this.selectedYearMonth = this.shiftShamsiMonth(this.selectedYearMonth, -1);
    this.onYearMonthChange();
  }

  goToNextMonth(): void {
    this.selectedYearMonth = this.shiftShamsiMonth(this.selectedYearMonth, 1);
    this.onYearMonthChange();
  }

  private shiftShamsiDay(dateStr: string, deltaDays: number): string {
    try {
      const parts = dateStr.split('/').map(p => parseInt(p, 10));
      if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) return dateStr;
      const g = jalaliToGregorian(parts[0], parts[1], parts[2]);
      const d = new Date(g.gy, g.gm - 1, g.gd);
      d.setDate(d.getDate() + deltaDays);
      const j = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
      const pad = (n: number) => n < 10 ? '0' + n : String(n);
      return `${j.jy}/${pad(j.jm)}/${pad(j.jd)}`;
    } catch {
      return dateStr;
    }
  }

  private shiftShamsiMonth(yearMonth: string, deltaMonths: number): string {
    try {
      const parts = yearMonth.split('/').map(p => parseInt(p, 10));
      if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) return yearMonth;
      let y = parts[0];
      let m = parts[1] + deltaMonths;
      while (m > 12) {
        m -= 12;
        y += 1;
      }
      while (m < 1) {
        m += 12;
        y -= 1;
      }
      const pad = (n: number) => n < 10 ? '0' + n : String(n);
      return `${y}/${pad(m)}`;
    } catch {
      return yearMonth;
    }
  }

  private getTodayShamsi(): string {
    const d = new Date();
    const j = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
    const pad = (n: number) => n < 10 ? '0' + n : String(n);
    return `${j.jy}/${pad(j.jm)}/${pad(j.jd)}`;
  }

  setAttendanceViewMode(mode: 'daily' | 'monthly_grid'): void {
    this.attendanceViewMode = mode;
    if (mode === 'daily') {
      this.loadAttendanceMatrix();
    } else {
      this.loadMonthlyAttendanceGrid();
    }
  }

  loadMonthlyAttendanceGrid(): void {
    if (!this.selectedYearMonth) return;
    this.isMonthlyGridLoading = true;
    this.api.getMonthlyAttendanceGrid(this.selectedWarehouseId, this.selectedYearMonth).subscribe({
      next: (res) => {
        this.monthlyGridDays = res.days_meta || [];
        this.monthlyGridRows = res.rows || [];
        this.isPeriodLocked = res.is_locked;
        this.periodStatus = res.period_status;
        this.periodInfo = res.period_info || null;
        this.anomalies = res.anomalies || [];
        this.monthlyGridSettingsWindow = res.settings_window || { past_days: 3, future_days: 0 };
        this.monthName = res.month_name || '';
        this.daysInMonth = res.days_in_month || 31;
        this.isMonthlyGridLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isMonthlyGridLoading = false;
        const msg = err?.error?.error || 'خطا در بارگذاری شیت ماهانه کارکرد پرسنل';
        this.toast.show('error', msg);
        this.cdr.detectChanges();
      }
    });
  }

  onMonthlyCellHoursChange(row: MonthlyGridRow, dayItem: MonthlyGridPersonnelDay): void {
    let h = parseFloat(dayItem.effective_hours as any) || 0;
    if (h < 0) h = 0;
    if (h > 24) h = 24;
    dayItem.effective_hours = h;
    if (h === 0 && dayItem.status === 'PRESENT_10H') {
      dayItem.status = 'ABSENT';
    } else if (h > 0 && (!dayItem.status || dayItem.status === 'ABSENT')) {
      dayItem.status = h === 10 ? 'PRESENT_10H' : (h === 5 ? 'HALF_5H' : 'CUSTOM');
    }
    row.total_hours = row.days.reduce((acc, d) => acc + (parseFloat(d.effective_hours as any) || 0), 0);
    row.total_overtime = row.days.reduce((acc, d) => acc + (parseFloat(d.overtime_hours as any) || 0), 0);
    row.present_days = row.days.filter(d => d.status && d.status !== 'ABSENT' && (parseFloat(d.effective_hours as any) || 0) > 0).length;
  }

  cycleDayStatus(row: MonthlyGridRow, dayItem: MonthlyGridPersonnelDay): void {
    if (this.isPeriodLocked) {
      this.toast.show('warning', 'دوره کارکرد قفل شده است.');
      return;
    }
    const dayMeta = this.monthlyGridDays.find(d => d.day === dayItem.day);
    if (dayMeta && !dayMeta.is_editable) {
      this.toast.show('warning', 'این تاریخ خارج از بازه مجاز ویرایش تنظیم‌شده توسط مدیر است.');
      return;
    }
    if (!dayItem.status) {
      dayItem.status = 'PRESENT_10H';
      dayItem.effective_hours = 10;
    } else if (dayItem.status === 'PRESENT_10H') {
      dayItem.status = 'HALF_5H';
      dayItem.effective_hours = 5;
    } else if (dayItem.status === 'HALF_5H') {
      dayItem.status = 'ABSENT';
      dayItem.effective_hours = 0;
    } else if (dayItem.status === 'ABSENT') {
      dayItem.status = 'LEAVE';
      dayItem.effective_hours = 0;
    } else if (dayItem.status === 'LEAVE') {
      if (dayMeta?.is_friday) {
        dayItem.status = 'FRIDAY_WORK';
        dayItem.effective_hours = 10;
        dayItem.is_friday_work = true;
      } else {
        dayItem.status = 'MISSION';
        dayItem.effective_hours = 10;
        dayItem.is_mission = true;
      }
    } else {
      dayItem.status = '';
      dayItem.effective_hours = 0;
      dayItem.is_friday_work = false;
      dayItem.is_mission = false;
    }
    this.onMonthlyCellHoursChange(row, dayItem);
  }

  // ── مودال جزئیات کارکرد روزانه در شیت ماهانه ────────────────
  openDayDetailModal(row: MonthlyGridRow, dayItem: MonthlyGridPersonnelDay): void {
    if (this.isPeriodLocked) {
      this.toast.show('warning', 'دوره کارکرد قفل شده است.');
      return;
    }
    this.selectedDayDetailRow = row;
    this.selectedDayDetailItem = dayItem;
    this.dayDetailStatus = dayItem.status || 'PRESENT_10H';
    this.dayDetailEffectiveHours = dayItem.effective_hours || 0;
    this.dayDetailOvertimeHours = dayItem.overtime_hours || 0;
    this.dayDetailIsFridayWork = dayItem.is_friday_work || false;
    this.dayDetailIsMission = dayItem.is_mission || false;
    this.dayDetailAdvancePayment = dayItem.advance_payment || 0;
    this.dayDetailNotes = dayItem.notes || '';
    this.isDayDetailModalOpen = true;
  }

  closeDayDetailModal(): void {
    this.isDayDetailModalOpen = false;
    this.selectedDayDetailRow = null;
    this.selectedDayDetailItem = null;
  }

  saveDayDetail(): void {
    if (!this.selectedDayDetailRow || !this.selectedDayDetailItem) return;
    const d = this.selectedDayDetailItem;
    d.status = this.dayDetailStatus as any;
    d.effective_hours = this.dayDetailEffectiveHours;
    d.overtime_hours = this.dayDetailOvertimeHours;
    d.is_friday_work = this.dayDetailIsFridayWork;
    d.is_mission = this.dayDetailIsMission;
    d.advance_payment = this.dayDetailAdvancePayment;
    d.notes = this.dayDetailNotes;

    this.onMonthlyCellHoursChange(this.selectedDayDetailRow, d);
    this.closeDayDetailModal();
    this.toast.show('success', 'جزئیات کارکرد روز با موفقیت روی شیت اعمال شد.');
    this.cdr.detectChanges();
  }

  saveMonthlyGrid(): void {
    if (!this.selectedYearMonth) return;
    if (this.isPeriodLocked) {
      this.toast.show('warning', 'دوره کارکرد قفل شده است و امکان ذخیره وجود ندارد.');
      return;
    }
    this.isSavingMonthlyGrid = true;
    const items: any[] = [];
    for (const row of this.monthlyGridRows) {
      for (const d of row.days) {
        if (d.status || d.effective_hours > 0 || d.is_existing) {
          items.push({
            personnel_id: row.personnel_id,
            day: d.day,
            status: d.status || 'PRESENT_10H',
            effective_hours: d.effective_hours,
            overtime_hours: d.overtime_hours,
            is_friday_work: d.is_friday_work,
            is_mission: d.is_mission,
            advance_payment: d.advance_payment || 0,
            notes: d.notes || ''
          });
        }
      }
    }
    this.api.bulkSaveMonthlyGrid({
      warehouse_id: this.selectedWarehouseId,
      year_month: this.selectedYearMonth,
      items
    }).subscribe({
      next: (res) => {
        this.isSavingMonthlyGrid = false;
        this.toast.show('success', res.message || 'شیت ماهانه با موفقیت ذخیره شد.');
        this.loadMonthlyAttendanceGrid();
      },
      error: (err) => {
        this.isSavingMonthlyGrid = false;
        const msg = err?.error?.error || 'خطا در ذخیره شیت ماهانه کارکرد';
        this.toast.show('error', msg);
        this.cdr.detectChanges();
      }
    });
  }

  // ── گردش کار دو مرحله‌ای تایید کارکرد (Two-Step Approval) ──
  getSelectedWarehouseName(): string {
    if (!this.selectedWarehouseId) return 'تمام انبارها';
    const wh = this.warehouses.find(w => w.id === this.selectedWarehouseId);
    return wh ? wh.name : 'انبار';
  }

  openSubmitModal(): void {
    if (this.isPeriodLocked) {
      this.toast.show('warning', 'دوره در حال حاضر قفل یا ارسال شده است.');
      return;
    }
    if (!this.selectedWarehouseId) {
      this.toast.show('warning', 'جهت ارسال کارکرد برای تایید مالی، ابتدا باید یک انبار مشخص را انتخاب کنید.');
      return;
    }
    this.submitNotes = '';
    this.isSubmitModalOpen = true;
  }

  closeSubmitModal(): void {
    this.isSubmitModalOpen = false;
  }

  confirmSubmitForReview(): void {
    if (!this.selectedWarehouseId || !this.selectedYearMonth) return;
    this.isSubmittingWorkflow = true;
    this.api.periodWorkflowAction({
      warehouse_id: this.selectedWarehouseId,
      year_month: this.selectedYearMonth,
      action: 'submit',
      notes: this.submitNotes
    }).subscribe({
      next: (res) => {
        this.isSubmittingWorkflow = false;
        this.isSubmitModalOpen = false;
        this.toast.show('success', res.message || 'کارکرد با موفقیت جهت بررسی مالی ارسال گردید.');
        this.loadMonthlyAttendanceGrid();
      },
      error: (err) => {
        this.isSubmittingWorkflow = false;
        this.toast.show('error', err?.error?.error || 'خطا در ارسال کارکرد');
        this.cdr.detectChanges();
      }
    });
  }

  async approveAndLockPeriod(): Promise<void> {
    if (!this.selectedWarehouseId || !this.selectedYearMonth) {
      this.toast.show('warning', 'لطفاً انبار مورد نظر را انتخاب کنید.');
      return;
    }
    const confirmed = await this.confirmDialog.open({
      title: 'تایید نهایی و قفل دوره کارکرد',
      message: `آیا از تایید نهایی و قفل قطعی دوره کارکرد ${this.selectedYearMonth} اطمینان دارید؟ پس از قفل، امکان تغییر کارکرد توسط سرپرستان وجود نخواهد داشت.`,
      confirmText: 'تایید نهایی و قفل',
      cancelText: 'انصراف',
      type: 'warning'
    });

    if (confirmed) {
      this.isSubmittingWorkflow = true;
      this.api.periodWorkflowAction({
        warehouse_id: this.selectedWarehouseId,
        year_month: this.selectedYearMonth,
        action: 'approve'
      }).subscribe({
        next: (res) => {
          this.isSubmittingWorkflow = false;
          this.toast.show('success', res.message || 'دوره کارکرد تایید نهایی و قفل شد.');
          this.loadMonthlyAttendanceGrid();
        },
        error: (err) => {
          this.isSubmittingWorkflow = false;
          this.toast.show('error', err?.error?.error || 'خطا در تایید دوره');
          this.cdr.detectChanges();
        }
      });
    }
  }

  openRejectModal(): void {
    if (!this.selectedWarehouseId) {
      this.toast.show('warning', 'لطفاً انبار مورد نظر را انتخاب کنید.');
      return;
    }
    this.rejectReason = '';
    this.isRejectModalOpen = true;
  }

  closeRejectModal(): void {
    this.isRejectModalOpen = false;
  }

  confirmRejectPeriod(): void {
    if (!this.selectedWarehouseId || !this.selectedYearMonth) return;
    if (!this.rejectReason.trim()) {
      this.toast.show('warning', 'درج علت رد دوره الزامی است.');
      return;
    }
    this.isSubmittingWorkflow = true;
    this.api.periodWorkflowAction({
      warehouse_id: this.selectedWarehouseId,
      year_month: this.selectedYearMonth,
      action: 'reject',
      notes: this.rejectReason.trim()
    }).subscribe({
      next: (res) => {
        this.isSubmittingWorkflow = false;
        this.isRejectModalOpen = false;
        this.toast.show('info', res.message || 'دوره کارکرد رد شد و جهت بازبینی به سرپرست بازگشت.');
        this.loadMonthlyAttendanceGrid();
      },
      error: (err) => {
        this.isSubmittingWorkflow = false;
        this.toast.show('error', err?.error?.error || 'خطا در رد دوره');
        this.cdr.detectChanges();
      }
    });
  }

  async unlockPeriodWorkflow(): Promise<void> {
    if (!this.selectedWarehouseId || !this.selectedYearMonth) return;
    const confirmed = await this.confirmDialog.open({
      title: 'بازگشایی مجدد دوره کارکرد',
      message: `آیا از بازگشایی قفل دوره کارکرد ${this.selectedYearMonth} اطمینان دارید؟`,
      confirmText: 'بازگشایی',
      cancelText: 'انصراف',
      type: 'info'
    });

    if (confirmed) {
      this.isSubmittingWorkflow = true;
      this.api.periodWorkflowAction({
        warehouse_id: this.selectedWarehouseId,
        year_month: this.selectedYearMonth,
        action: 'unlock'
      }).subscribe({
        next: (res) => {
          this.isSubmittingWorkflow = false;
          this.toast.show('success', res.message || 'دوره با موفقیت بازگشایی شد.');
          this.loadMonthlyAttendanceGrid();
        },
        error: (err) => {
          this.isSubmittingWorkflow = false;
          this.toast.show('error', err?.error?.error || 'خطا در بازگشایی دوره');
          this.cdr.detectChanges();
        }
      });
    }
  }

  // ── هشدارهای هوشمند ناهنجاری‌ها (Anomaly & Conflict Alerts) ──
  toggleAnomaliesPanel(): void {
    this.isAnomaliesPanelOpen = !this.isAnomaliesPanelOpen;
  }

  focusAnomaly(anomaly: AttendanceAnomaly): void {
    this.highlightPersonnelId = anomaly.personnel_id;
    this.highlightDay = anomaly.day;
    setTimeout(() => {
      const rowElem = document.getElementById(`grid-row-${anomaly.personnel_id}`);
      if (rowElem) {
        rowElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  }

  clearHighlight(): void {
    this.highlightPersonnelId = null;
    this.highlightDay = null;
  }

  // ── خروجی چاپی شیت ماهانه (Printable Timesheet) ──
  openPrintTimesheetModal(): void {
    this.isPrintModalOpen = true;
  }

  closePrintTimesheetModal(): void {
    this.isPrintModalOpen = false;
  }

  triggerPrint(): void {
    window.print();
  }

  // ── خروجی و ورود دو طرفه اکسل شیت ماهانه (Two-Way Timesheet Excel) ──
  exportMonthlyTimesheetExcel(): void {
    if (!this.selectedYearMonth) return;
    this.isExportingMonthlyExcel = true;
    this.toast.show('info', 'در حال آماده‌سازی فایل اکسل شیت ماهانه...');
    this.api.exportMonthlyAttendanceExcel(this.selectedWarehouseId, this.selectedYearMonth).subscribe({
      next: (blob) => {
        this.isExportingMonthlyExcel = false;
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const whName = this.getSelectedWarehouseName() || 'all_warehouses';
        a.download = `Timesheet_${this.selectedYearMonth.replace('/', '_')}_${whName}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        this.toast.show('success', 'فایل اکسل شیت ماهانه با موفقیت دانلود شد.');
      },
      error: (err) => {
        this.isExportingMonthlyExcel = false;
        this.toast.show('error', 'خطا در دریافت فایل اکسل شیت ماهانه.');
        this.cdr.detectChanges();
      }
    });
  }

  openExcelImportModal(): void {
    if (this.isPeriodLocked) {
      this.toast.show('warning', 'دوره کارکرد قفل شده است و امکان بارگذاری وجود ندارد.');
      return;
    }
    this.selectedExcelImportFile = null;
    this.isExcelImportModalOpen = true;
  }

  closeExcelImportModal(): void {
    this.isExcelImportModalOpen = false;
    this.selectedExcelImportFile = null;
  }

  onExcelImportFileSelected(event: any): void {
    const file = event.target?.files?.[0];
    if (file) {
      this.selectedExcelImportFile = file;
    }
  }

  uploadMonthlyTimesheetExcel(): void {
    if (!this.selectedExcelImportFile || !this.selectedYearMonth) return;
    this.isImportingMonthlyExcel = true;
    const formData = new FormData();
    formData.append('file', this.selectedExcelImportFile);
    if (this.selectedWarehouseId) {
      formData.append('warehouse_id', this.selectedWarehouseId.toString());
    }
    formData.append('year_month', this.selectedYearMonth);

    this.api.importMonthlyAttendanceExcel(formData).subscribe({
      next: (res) => {
        this.isImportingMonthlyExcel = false;
        this.closeExcelImportModal();
        this.toast.show('success', res.message || 'شیت کارکرد با موفقیت از فایل اکسل بارگذاری شد.');
        this.loadMonthlyAttendanceGrid();
      },
      error: (err) => {
        this.isImportingMonthlyExcel = false;
        this.toast.show('error', err?.error?.error || 'خطا در بارگذاری فایل اکسل');
        this.cdr.detectChanges();
      }
    });
  }

  // ── انتخابگر هوشمند تاریخ و تقویم شمسی ───────────────────────
  onAttendanceDateInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input) return;
    let val = input.value || '';
    
    // تبدیل ارقام فارسی و عربی به انگلیسی
    val = val.replace(/[\u06F0-\u06F9]/g, d => String.fromCharCode(d.charCodeAt(0) - 1728))
             .replace(/[\u0660-\u0669]/g, d => String.fromCharCode(d.charCodeAt(0) - 1584));
    
    const digitsOnly = val.replace(/\D/g, '');

    if (digitsOnly.length === 8) {
      const y = digitsOnly.substring(0, 4);
      const m = digitsOnly.substring(4, 6);
      const d = digitsOnly.substring(6, 8);
      const formatted = `${y}/${m}/${d}`;
      input.value = formatted;
      this.selectedDateShamsi = formatted;
      this.attendanceDateControl.setValue(formatted, { emitEvent: false });
      this.onDateChange();
    } else {
      this.selectedDateShamsi = val;
      this.attendanceDateControl.setValue(val, { emitEvent: false });
    }
  }

  toggleAttendanceDatePicker(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.isAttendanceDatePickerOpen = !this.isAttendanceDatePickerOpen;
    this.cdr.detectChanges();
  }

  openAttendanceDatePicker(): void {
    this.isAttendanceDatePickerOpen = true;
    this.cdr.detectChanges();
  }

  closeAttendanceDatePicker(): void {
    this.isAttendanceDatePickerOpen = false;
    this.cdr.detectChanges();
  }

  onAttendanceDateSelect(event: any): void {
    if (!event) return;
    this.closeAttendanceDatePicker();
    if (event.shamsi) {
      this.selectedDateShamsi = event.shamsi;
      this.attendanceDateControl.setValue(event.shamsi, { emitEvent: false });
      this.onDateChange();
    } else if (event.gregorian) {
      const d = new Date(event.gregorian);
      const j = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
      const pad = (n: number) => n < 10 ? '0' + n : String(n);
      const formatted = `${j.jy}/${pad(j.jm)}/${pad(j.jd)}`;
      this.selectedDateShamsi = formatted;
      this.attendanceDateControl.setValue(formatted, { emitEvent: false });
      this.onDateChange();
    }
  }

  setAttendanceWindowPreset(past: number, future: number): void {
    if (!this.yearlySettings) return;
    this.yearlySettings.attendance_edit_past_days = past;
    this.yearlySettings.attendance_edit_future_days = future;
    this.toast.show('info', `الگو اعمال شد: ${past === -1 ? 'نامحدود' : past + ' روز'} قبل، ${future === -1 ? 'نامحدود' : future + ' روز'} بعد`);
  }

  // ─────────────────────────────────────────────────────────────
  // ۲. ماتریس تردد ناوگان (انباردار)
  // ─────────────────────────────────────────────────────────────
  loadVehicleMatrix(): void {
    if (!this.selectedWarehouseId || !this.selectedDateShamsi) return;
    this.isVehicleLoading = true;
    this.api.getVehicleMatrix(this.selectedWarehouseId, this.selectedDateShamsi).subscribe({
      next: (res) => {
        this.vehicleRows = res.rows || [];
        this.isVehicleLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isVehicleLoading = false;
        this.toast.show('error', 'خطا در واکشی لیست تردد ناوگان');
      }
    });
  }

  updateVehicleTotal(row: VehicleMatrixRow): void {
    row.total_amount = (row.trip_count || 0) * (row.unit_rate || 0);
  }

  saveVehicleMatrix(): void {
    if (!this.selectedWarehouseId || !this.selectedDateShamsi) return;
    this.isSavingVehicles = true;
    const payload = {
      warehouse_id: this.selectedWarehouseId,
      date_shamsi: this.selectedDateShamsi,
      items: this.vehicleRows.map(r => ({
        vehicle_id: r.vehicle_id,
        trip_count: r.trip_count,
        unit_rate: r.unit_rate,
        dispatch_reference: r.dispatch_reference,
        origin_destination: r.origin_destination,
        notes: r.notes
      }))
    };

    this.api.saveVehicleTripsBulk(payload).subscribe({
      next: (res) => {
        this.isSavingVehicles = false;
        this.toast.show('success', `سرویس‌های ناوگان ذخیره شد (${res.saved_count} مورد).`);
        this.loadVehicleMatrix();
      },
      error: (err) => {
        this.isSavingVehicles = false;
        this.toast.show('error', err?.error?.error || 'خطا در ذخیره سرویس‌های ناوگان');
      }
    });
  }

  // ─────────────────────────────────────────────────────────────
  // ۳. محاسبه ماهانه ۵۸ ستون حقوق و دیسکت‌ها (حسابدار)
  // ─────────────────────────────────────────────────────────────
  loadMonthlyPayroll(): void {
    if (!this.selectedYearMonth) return;
    this.isPayrollLoading = true;
    this.api.getMonthlyPayrollRecords({
      warehouse_id: this.selectedWarehouseId,
      year_month: this.selectedYearMonth
    }).subscribe({
      next: (records) => {
        this.monthlyPayrollRecords = records || [];
        this.applyPayrollFilter();
        if (this.monthlyPayrollRecords.length > 0) {
          this.currentPeriodId = this.monthlyPayrollRecords[0].period;
          this.computePayrollSummary();
        }
        this.isPayrollLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isPayrollLoading = false;
        this.toast.show('error', 'خطا در واکشی رکورد‌های حقوق ماهانه');
      }
    });
  }

  calculateMonthlyPayroll(): void {
    if (!this.selectedYearMonth) return;
    this.isCalculatingPayroll = true;
    this.api.calculateMonthlyPayroll(this.selectedWarehouseId, this.selectedYearMonth).subscribe({
      next: (res) => {
        this.isCalculatingPayroll = false;
        this.currentPeriodId = res.period_id;
        this.periodStatus = res.period_status;
        this.isPeriodLocked = res.period_status === 'LOCKED';
        this.payrollSummary = res.summary;
        this.monthlyPayrollRecords = res.records || [];
        this.applyPayrollFilter();
        this.toast.show('success', res.message);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isCalculatingPayroll = false;
        this.toast.show('error', err?.error?.error || 'خطا در محاسبه حقوق دوره');
      }
    });
  }

  applyPayrollFilter(): void {
    let list = [...this.monthlyPayrollRecords];
    if (this.selectedStatusCategory !== 'ALL') {
      list = list.filter(r => r.status_category === this.selectedStatusCategory);
    }
    if (this.payrollSearch.trim()) {
      const q = this.payrollSearch.trim().toLowerCase();
      list = list.filter(r =>
        (r.full_name && r.full_name.toLowerCase().includes(q)) ||
        (r.national_code && r.national_code.includes(q)) ||
        (r.job_grade && r.job_grade.includes(q))
      );
    }
    this.filteredPayrollRecords = list;
  }

  computePayrollSummary(): void {
    const total_gross = this.monthlyPayrollRecords.reduce((acc, r) => acc + Number(r.gross_salary || 0), 0);
    const total_payable = this.monthlyPayrollRecords.reduce((acc, r) => acc + Number(r.payable_amount || 0), 0);
    const total_insurance = this.monthlyPayrollRecords.reduce((acc, r) => acc + Number(r.total_insurance || 0), 0);
    const total_tax = this.monthlyPayrollRecords.reduce((acc, r) => acc + Number(r.income_tax || 0), 0);

    this.payrollSummary = {
      total_personnel: this.monthlyPayrollRecords.length,
      total_gross,
      total_payable,
      total_insurance,
      total_tax
    };
  }

  downloadDskZip(): void {
    if (!this.currentPeriodId) {
      this.toast.show('warning', 'ابتدا حقوق دوره را محاسبه کنید.');
      return;
    }
    const url = this.api.getDskZipDownloadUrl(this.currentPeriodId);
    window.open(url, '_blank');
  }

  downloadTaxWh(): void {
    if (!this.currentPeriodId) {
      this.toast.show('warning', 'ابتدا حقوق دوره را محاسبه کنید.');
      return;
    }
    const url = this.api.getTaxWhDownloadUrl(this.currentPeriodId);
    window.open(url, '_blank');
  }

  downloadTaxWp(): void {
    if (!this.currentPeriodId) {
      this.toast.show('warning', 'ابتدا حقوق دوره را محاسبه کنید.');
      return;
    }
    const url = this.api.getTaxWpDownloadUrl(this.currentPeriodId);
    window.open(url, '_blank');
  }

  downloadBankExcel(): void {
    if (!this.currentPeriodId) {
      this.toast.show('warning', 'ابتدا حقوق دوره را محاسبه کنید.');
      return;
    }
    const url = this.api.getBankExcelDownloadUrl(this.currentPeriodId);
    window.open(url, '_blank');
  }

  downloadMonthlyExcel(): void {
    if (!this.currentPeriodId) {
      this.toast.show('warning', 'ابتدا حقوق دوره را محاسبه کنید.');
      return;
    }
    const url = this.api.getMonthlyExcelDownloadUrl(this.currentPeriodId);
    window.open(url, '_blank');
  }

  // --- بارگذاری اکسل مالیات دارایی ---
  openTaxModal(): void {
    if (!this.currentPeriodId && !this.selectedYearMonth) {
      this.toast.show('warning', 'لطفاً ابتدا دوره ماهانه را مشخص کرده یا حقوق را محاسبه فرمایید.');
      return;
    }
    this.isTaxModalOpen = true;
    this.selectedTaxFile = null;
    this.taxUploadSummary = null;
  }

  closeTaxModal(): void {
    this.isTaxModalOpen = false;
    this.selectedTaxFile = null;
    this.taxUploadSummary = null;
  }

  onTaxFileSelected(event: any): void {
    const file = event.target?.files?.[0];
    if (file) {
      this.selectedTaxFile = file;
    }
  }

  submitTaxExcel(): void {
    if (!this.selectedTaxFile) {
      this.toast.show('warning', 'لطفاً ابتدا فایل اکسل مالیات دارایی را انتخاب نمایید.');
      return;
    }

    this.isUploadingTax = true;
    const formData = new FormData();
    formData.append('file', this.selectedTaxFile);
    if (this.currentPeriodId) {
      formData.append('period_id', String(this.currentPeriodId));
    }
    if (this.selectedYearMonth) {
      formData.append('year_month', this.selectedYearMonth);
    }

    this.api.importTaxExcel(formData).subscribe({
      next: (res) => {
        this.isUploadingTax = false;
        this.taxUploadSummary = res;
        this.toast.show('success', res.message || 'فایل مالیات با موفقیت بارگذاری و تطبیق داده شد.');
        // بارگذاری مجدد رکوردهای حقوق دوره جهت نمایش مقادیر جدید مالیات
        this.loadMonthlyPayroll();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isUploadingTax = false;
        const msg = err?.error?.error || 'خطا در بارگذاری یا پردازش فایل مالیات';
        this.toast.show('error', msg);
      }
    });
  }

  // ─────────────────────────────────────────────────────────────
  // ۴. تنظیمات سالانه حقوق و ۲۰ گروه شغلی (حسابدار)
  // ─────────────────────────────────────────────────────────────
  loadYearlySettings(): void {
    this.isSettingsLoading = true;
    this.api.getYearlySettings(this.fiscalYear).subscribe({
      next: (data) => {
        this.yearlySettings = data;
        this.isSettingsLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isSettingsLoading = false;
        this.toast.show('error', 'خطا در دریافت تنظیمات پایه سالانه');
      }
    });
  }

  saveYearlySettings(): void {
    if (!this.yearlySettings || !this.yearlySettings.id) return;
    this.isSavingSettings = true;
    this.api.updateAllSettingsTabs(this.yearlySettings.id, this.yearlySettings).subscribe({
      next: (res) => {
        this.isSavingSettings = false;
        this.yearlySettings = res.settings;
        this.toast.show('success', res.message || 'تنظیمات پایه با موفقیت ذخیره شد.');
      },
      error: (err) => {
        this.isSavingSettings = false;
        this.toast.show('error', err?.error?.error || 'خطا در ذخیره تنظیمات');
      }
    });
  }

  // ─────────────────────────────────────────────────────────────
  // ۵. پرونده پرسنل و ناوگان (Emp_info)
  // ─────────────────────────────────────────────────────────────
  loadProfiles(): void {
    this.isProfilesLoading = true;
    if (this.profileSubTab === 'personnel') {
      this.api.getPersonnelProfiles({
        warehouse_id: this.selectedWarehouseId || undefined,
        search: this.profileSearch || undefined
      }).subscribe({
        next: (res) => {
          this.personnelList = res || [];
          this.isProfilesLoading = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.isProfilesLoading = false;
          this.toast.show('error', 'خطا در بارگذاری پرونده پرسنل');
        }
      });
    } else {
      this.api.getVehicleProfiles({
        warehouse_id: this.selectedWarehouseId || undefined,
        search: this.profileSearch || undefined
      }).subscribe({
        next: (res) => {
          this.vehiclesList = res || [];
          this.isProfilesLoading = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.isProfilesLoading = false;
          this.toast.show('error', 'خطا در بارگذاری لیست ناوگان');
        }
      });
    }
  }

  recalculatePersonnelRates(): void {
    if (!this.editingPersonnel) return;
    const daily = Number(this.editingPersonnel.daily_base_wage || 0);
    const seniority = Number(this.editingPersonnel.daily_seniority_bonus || 0);
    const years = Number(this.editingPersonnel.base_years_experience || 0);
    const baseDaily = daily + (years * seniority);
    this.editingPersonnel.base_daily_rate = baseDaily;
    this.editingPersonnel.hourly_rate = Math.round(baseDaily / 10);
  }

  onJobGradeChange(grade: string): void {
    if (!grade || !this.editingPersonnel) return;
    this.api.getJobGradeRate(grade, this.fiscalYear).subscribe({
      next: (res) => {
        if (this.editingPersonnel) {
          this.editingPersonnel.daily_base_wage = res.daily_base_wage;
          this.editingPersonnel.daily_seniority_bonus = res.daily_seniority_bonus;
          const years = this.editingPersonnel.base_years_experience || 0;
          this.editingPersonnel.base_daily_rate = res.daily_base_wage + (years * res.daily_seniority_bonus);
          this.editingPersonnel.hourly_rate = res.hourly_rate;
          this.cdr.detectChanges();
        }
      }
    });
  }

  openAddPersonnelModal(): void {
    this.personnelModalTab = 'identity';
    this.editingPersonnel = {
      // ۱. هویتی و شناسنامه‌ای
      first_name: '',
      last_name: '',
      national_code: '',
      father_name: '',
      id_number: '',
      id_series: '',
      id_serial: '',
      birth_date: '',
      birth_place: '',
      issue_place: '',
      issue_date: '',
      gender: 'مرد',
      nationality_code: '1',
      citizenship_country_code: '103',
      residence_country_code: '103',
      education_level: '5',
      marital_status: 'single',
      children_count: 0,

      // ۲. قرارداد، دستمزد و گروه شغلی
      contract_type: 'daily',
      contract_hours: 230,
      contract_base_salary: 0,
      job_grade: '19',
      base_years_experience: 0,
      daily_base_wage: 6572696,
      daily_seniority_bonus: 171867,
      base_daily_rate: 6572696,
      hourly_rate: 657270,
      start_date: '',
      end_date: '',
      retirement_date: '',
      personnel_id_code: '',

      // ۳. بیمه و مالیات
      job_title: 'انباردار',
      job_code: '',
      job_category: '5', // ۵ = انبارداری طبق راهنمای دارایی
      insurance_number: '',
      insurance_type: '2', // ۲ = تامین اجتماعی
      insurance_name: 'تامین اجتماعی',
      exemption_type: '1', // ۱ = عدم معافیت (عادی ماده ۸۴)
      employment_type: '2', // ۲ = شرکتی
      status_category: 'نفرات شرکتی',
      group_status: 'شاغل',
      include_in_insurance: true,
      include_in_tax: true,
      include_in_bank: true,

      // فیلدهای تنظیمی سامانه مالیات دارایی (فایل WH)
      tax_payment_type: this.yearlySettings?.tax_settings?.payment_type || '1',
      tax_service_location: this.yearlySettings?.tax_settings?.service_location || '1',
      tax_exceptions: this.yearlySettings?.tax_settings?.exceptions || '1',
      tax_currency_type: this.yearlySettings?.tax_settings?.currency_type || '84',
      tax_currency_exchange_rate: Number(this.yearlySettings?.tax_settings?.currency_exchange_rate) || 1,
      tax_housing_benefit_type: this.yearlySettings?.tax_settings?.housing_benefit_type || '1',
      tax_vehicle_benefit_type: this.yearlySettings?.tax_settings?.vehicle_benefit_type || '1',

      // ۴. مزایای مستمر قانون کار
      housing_allowance: Number(this.yearlySettings?.monthly_housing_allowance) || 30000000,
      food_allowance: Number(this.yearlySettings?.monthly_food_allowance) || 22000000,
      spouse_allowance: Number(this.yearlySettings?.monthly_spouse_allowance) || 5000000,
      weather_bonus: 0,
      asaluyeh_parsian_bonus: 0,
      remote_hardship_bonus: 0,
      market_attraction_bonus: 0,
      transport_allowance: 0,

      // ۵. حساب بانکی و نشانی
      bank_name: this.yearlySettings?.bank_export_settings?.bank_name || 'بانک ملی ایران',
      account_number: '',
      sheba_number: '',
      card_number: '',
      phone_number: '',
      postal_code: '',
      address: '',
      assigned_warehouse: this.selectedWarehouseId,
      is_active: true
    };
    this.isPersonnelModalOpen = true;
  }

  openEditPersonnelModal(p: PersonnelProfile): void {
    this.personnelModalTab = 'identity';
    this.editingPersonnel = {
      ...p,
      nationality_code: p.nationality_code || '1',
      citizenship_country_code: p.citizenship_country_code || '103',
      residence_country_code: p.residence_country_code || '103',
      education_level: p.education_level || '5',
      insurance_type: p.insurance_type || '2',
      insurance_name: p.insurance_name || 'تامین اجتماعی',
      exemption_type: p.exemption_type || '1',
      job_category: p.job_category || '5',
      employment_type: p.employment_type || '2',
      tax_payment_type: p.tax_payment_type || this.yearlySettings?.tax_settings?.payment_type || '1',
      tax_service_location: p.tax_service_location || this.yearlySettings?.tax_settings?.service_location || '1',
      tax_exceptions: p.tax_exceptions || this.yearlySettings?.tax_settings?.exceptions || '1',
      tax_currency_type: p.tax_currency_type || this.yearlySettings?.tax_settings?.currency_type || '84',
      tax_currency_exchange_rate: Number(p.tax_currency_exchange_rate) || Number(this.yearlySettings?.tax_settings?.currency_exchange_rate) || 1,
      tax_housing_benefit_type: p.tax_housing_benefit_type || this.yearlySettings?.tax_settings?.housing_benefit_type || '1',
      tax_vehicle_benefit_type: p.tax_vehicle_benefit_type || this.yearlySettings?.tax_settings?.vehicle_benefit_type || '1',
    };
    this.recalculatePersonnelRates();
    this.isPersonnelModalOpen = true;
  }

  closePersonnelModal(): void {
    this.isPersonnelModalOpen = false;
    this.editingPersonnel = null;
  }

  setPersonnelTab(tab: 'identity' | 'contract' | 'insurance' | 'allowances' | 'contact'): void {
    this.personnelModalTab = tab;
  }

  savePersonnel(): void {
    if (!this.editingPersonnel) return;
    if (!this.editingPersonnel.first_name || !this.editingPersonnel.last_name || !this.editingPersonnel.national_code) {
      this.toast.show('error', 'نام، نام خانوادگی و کد ملی الزامی است.');
      return;
    }

    this.isSavingPersonnel = true;
    if (this.editingPersonnel.id) {
      this.api.updatePersonnelProfile(this.editingPersonnel.id, this.editingPersonnel).subscribe({
        next: () => {
          this.isSavingPersonnel = false;
          this.toast.show('success', 'اطلاعات پرسنل با موفقیت به‌روزرسانی شد.');
          this.closePersonnelModal();
          this.loadProfiles();
        },
        error: (err) => {
          this.isSavingPersonnel = false;
          this.toast.show('error', err?.error?.error || 'خطا در ویرایش پرسنل');
        }
      });
    } else {
      this.api.createPersonnelProfile(this.editingPersonnel).subscribe({
        next: () => {
          this.isSavingPersonnel = false;
          this.toast.show('success', 'پرسنل جدید با موفقیت ثبت شد.');
          this.closePersonnelModal();
          this.loadProfiles();
        },
        error: (err) => {
          this.isSavingPersonnel = false;
          this.toast.show('error', err?.error?.error || 'خطا در ثبت پرسنل');
        }
      });
    }
  }

  async deletePersonnel(p: Partial<PersonnelProfile> | PersonnelProfile): Promise<void> {
    if (!p.id) return;
    const confirmed = await this.confirmDialog.open({
      title: 'حذف پرونده پرسنلی',
      message: `آیا از حذف پرونده پرسنل «${p.full_name || ((p.first_name || '') + ' ' + (p.last_name || ''))}» اطمینان دارید؟\n(نکته: در صورتی که کارکردی برای این فرد ثبت نشده باشد حذف می‌گردد، در غیر این صورت باید غیرفعال شود.)`,
      confirmText: 'بله، حذف کن',
      cancelText: 'انصراف',
      type: 'danger'
    });

    if (!confirmed) return;

    this.api.deletePersonnelProfile(p.id).subscribe({
      next: () => {
        this.toast.show('success', `پرونده پرسنل «${p.full_name || p.first_name}» با موفقیت حذف گردید.`);
        if (this.isPersonnelModalOpen) {
          this.closePersonnelModal();
        }
        this.loadProfiles();
      },
      error: (err) => {
        this.toast.show('error', err?.error?.error || 'امکان حذف این پرسنل وجود ندارد (دارای سابقه کارکرد یا حقوق است).');
      }
    });
  }

  togglePersonnelActive(p: PersonnelProfile): void {
    if (!p.id) return;
    const newStatus = !p.is_active;
    this.api.updatePersonnelProfile(p.id, { is_active: newStatus }).subscribe({
      next: () => {
        p.is_active = newStatus;
        this.toast.show('success', `وضعیت پرسنل به «${newStatus ? 'فعال' : 'غیرفعال'}» تغییر یافت.`);
        this.cdr.detectChanges();
      },
      error: () => {
        this.toast.show('error', 'خطا در تغییر وضعیت پرسنل');
      }
    });
  }

  // ─────────────────────────────────────────────────────────────
  // ۶. گزارشات تجمیعی ماهانه
  // ─────────────────────────────────────────────────────────────
  loadMonthlyReports(): void {
    if (!this.selectedWarehouseId || !this.selectedYearMonth) return;
    this.isSummaryLoading = true;
    if (this.reportSubTab === 'personnel') {
      this.api.getAttendanceMonthlySummary(this.selectedWarehouseId, this.selectedYearMonth).subscribe({
        next: (res) => {
          this.attendanceSummary = res.summary || [];
          this.isPeriodLocked = res.is_locked;
          this.periodStatus = res.period_status;
          this.isSummaryLoading = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.isSummaryLoading = false;
          this.toast.show('error', 'خطا در دریافت گزارش تجمیعی کارکرد');
        }
      });
    } else {
      this.api.getVehicleMonthlySummary(this.selectedWarehouseId, this.selectedYearMonth).subscribe({
        next: (res) => {
          this.vehicleSummary = res.summary || [];
          this.isSummaryLoading = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.isSummaryLoading = false;
          this.toast.show('error', 'خطا در دریافت گزارش تجمیعی خودروها');
        }
      });
    }
  }

  toggleLockPeriod(): void {
    if (!this.currentPeriodId) return;
    if (this.isPeriodLocked) {
      this.confirmDialog.open({
        title: 'بازگشایی دوره',
        message: `آیا از بازگشایی دوره ${this.selectedYearMonth} اطمینان دارید؟`,
        confirmText: 'بازگشایی',
        cancelText: 'انصراف'
      }).then(ok => {
        if (ok === true && this.currentPeriodId) {
          this.api.unlockPeriod(this.currentPeriodId).subscribe({
            next: (res) => {
              this.toast.show('success', res.message);
              this.isPeriodLocked = false;
              this.periodStatus = 'OPEN';
            },
            error: (err) => this.toast.show('error', err?.error?.error || 'خطا در بازگشایی دوره')
          });
        }
      });
    } else {
      this.confirmDialog.open({
        title: 'قفل دوره ماهانه',
        message: `با قفل کردن دوره ${this.selectedYearMonth}، امکان ویرایش کارکرد روزانه مسدود خواهد شد. آیا مطمئن هستید؟`,
        confirmText: 'قفل کردن دوره',
        cancelText: 'انصراف'
      }).then(ok => {
        if (ok === true && this.currentPeriodId) {
          this.api.lockPeriod(this.currentPeriodId).subscribe({
            next: (res) => {
              this.toast.show('success', res.message);
              this.isPeriodLocked = true;
              this.periodStatus = 'LOCKED';
            },
            error: (err) => this.toast.show('error', err?.error?.error || 'خطا در قفل دوره')
          });
        }
      });
    }
  }

  importExcel(event: any): void {
    const file = event.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    if (this.selectedWarehouseId) {
      formData.append('warehouse_id', this.selectedWarehouseId.toString());
    }

    this.toast.show('info', 'در حال پردازش فایل اکسل...');
    this.api.importPersonnelExcel(formData).subscribe({
      next: (res) => {
        this.toast.show('success', res.message || `درون‌ریزی انجام شد: ${res.created_count} جدید، ${res.updated_count} به‌روزرسانی.`);
        this.loadProfiles();
      },
      error: (err) => {
        this.toast.show('error', err?.error?.error || 'خطا در درون‌ریزی اکسل');
      }
    });
  }
}
