import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild, ElementRef, HostListener, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpContext } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { SKIP_OFFLINE } from '../../../core/interceptors/offline.interceptor';
import { StateService } from '../../../services/state.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from '../../../services/toast.service';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { PersonnelApiService } from '../../../core/api/personnel-api.service';
import { WarehouseHttpService } from '../../../core/http/warehouse-http.service';
import { WebSocketService } from '../../../core/http/websocket.service';
import {
  AttendanceMatrixRow,
  VehicleMatrixRow,
  MonthlyGridDayMeta,
  MonthlyGridPersonnelDay,
  MonthlyGridRow,
  MonthlyGridResponse,
  AttendanceAnomaly
} from '../../../core/models/personnel.model';
import { jalaliToGregorian, gregorianToJalali } from '../../../core/utils/date-utils';
import { NgPersianDatepickerModule } from 'ng-persian-datepicker';

@Component({
  selector: 'app-warehouse-attendance',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgPersianDatepickerModule],
  templateUrl: './warehouse-attendance.html',
  styleUrl: './warehouse-attendance.css'
})
export class WarehouseAttendance implements OnInit, OnDestroy {
  // Top-Level Separation: 'personnel' (کارکرد پرسنل) | 'fleet' (مدیریت ناوگان)
  mainSectionTab: 'personnel' | 'fleet' = 'personnel';

  // Sub-view modes: 'daily' (ثبت ماتریسی روزانه) | 'monthly_grid' (تقویم ۳۱ روزه ماهانه) | 'fleet' (سرویس‌های ناوگان)
  activeMode: 'daily' | 'monthly_grid' | 'fleet' = 'daily';

  // Filters & State
  selectedWarehouseId: number | null = null;
  isWarehouseMenuOpen = false;
  warehouses: any[] = [];
  selectedDateShamsi = '';
  selectedYearMonth = '';
  fiscalYear = '1405';
  isAttendanceDatePickerOpen = false;
  attendanceDateControl = new FormControl('');
  searchQuery = '';

  // Persian Month Popover
  isMonthPickerOpen = false;
  readonly PERSIAN_MONTHS = [
    { num: 1, name: 'فروردین' },
    { num: 2, name: 'اردیبهشت' },
    { num: 3, name: 'خرداد' },
    { num: 4, name: 'تیر' },
    { num: 5, name: 'مرداد' },
    { num: 6, name: 'شهریور' },
    { num: 7, name: 'مهر' },
    { num: 8, name: 'آبان' },
    { num: 9, name: 'آذر' },
    { num: 10, name: 'دی' },
    { num: 11, name: 'بهمن' },
    { num: 12, name: 'اسفند' },
  ];

  // Excel File Upload
  isImportingExcel = false;
  @ViewChild('excelFileInput') excelFileInput?: ElementRef<HTMLInputElement>;

  // Matrix Attendance
  attendanceRows: AttendanceMatrixRow[] = [];
  filteredAttendanceRows: AttendanceMatrixRow[] = [];
  isAttendanceLoading = false;
  isSavingAttendance = false;
  isPeriodLocked = false;
  periodStatus = 'OPEN';
  hasUnsavedChanges = false;
  hasRemoteConflict = false;

  // Active open dropdown for special status row
  openSpecialMenuRowId: number | null = null;

  // Row selection in matrix
  selectedPersonnelIds = new Set<number>();
  selectAllChecked = false;

  // Bulk Hours Modal
  isBulkHoursModalOpen = false;
  bulkHoursScope: 'selected' | 'present' | 'all' = 'selected';
  bulkEffectiveHours = 10;
  bulkOvertimeHours = 0;
  bulkStatusOption: '' | 'PRESENT_10H' | 'HALF_5H' = '';
  bulkNotes = '';

  get isSelectedDateFriday(): boolean {
    if (!this.selectedDateShamsi) return false;
    try {
      const parts = this.selectedDateShamsi.split('/').map(p => parseInt(p, 10));
      if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
        const g = jalaliToGregorian(parts[0], parts[1], parts[2]);
        const d = new Date(g.gy, g.gm - 1, g.gd);
        return d.getDay() === 5;
      }
    } catch {}
    return false;
  }

  // Excel Smart Paste Modal
  isExcelPasteModalOpen = false;
  excelPasteText = '';
  excelParsedRows: Array<{
    national_code?: string;
    full_name?: string;
    status?: string;
    effective_hours?: number;
    overtime_hours?: number;
    notes?: string;
    matchedRow?: AttendanceMatrixRow;
  }> = [];

  // Monthly Timesheet Grid (31 Days)
  monthlyGridDays: MonthlyGridDayMeta[] = [];
  monthlyGridRows: MonthlyGridRow[] = [];
  isMonthlyGridLoading = false;
  isSavingMonthlyGrid = false;
  hasUnsavedMonthlyGrid = false;
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
  dayDetailNotes: string = '';

  // Date Range Bulk Applicator Modal
  isRangeModalOpen = false;
  rangeStartDay = 1;
  rangeEndDay = 31;
  rangeTargetScope: 'all' | 'selected' = 'all';
  rangeStatus: 'PRESENT_10H' | 'HALF_5H' | 'LEAVE' | 'ABSENT' | 'MISSION' | 'FRIDAY_WORK' = 'PRESENT_10H';
  rangeEffectiveHours = 10;
  rangeOvertimeHours = 0;
  rangeSkipFridays = true;
  rangeOnlyEmptyDays = true;

  // Workflow Approval
  periodInfo: any = null;
  isSubmittingWorkflow = false;
  isSubmitModalOpen = false;
  submitNotes = '';

  // Anomaly Alerts
  anomalies: AttendanceAnomaly[] = [];
  showAnomalies = false;

  // Two-Way Timesheet Excel
  isExportingMonthlyExcel = false;

  // Matrix Fleet Trips
  vehicleRows: VehicleMatrixRow[] = [];
  isVehicleLoading = false;
  isSavingVehicles = false;

  // WebSocket Live Subscription
  private wsSub?: Subscription;
  private wsConnectedSub?: Subscription;

  constructor(
    public state: StateService,
    public auth: AuthService,
    private api: PersonnelApiService,
    private whService: WarehouseHttpService,
    private wsService: WebSocketService,
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

  // Summary counts for daily status using smart aggregation
  get attendanceCounts() {
    let present = 0;
    let half = 0;
    let absent = 0;
    let leave = 0;
    let mission = 0;
    let other = 0;
    let totalEffectiveHours = 0;
    let totalOvertimeHours = 0;
    let totalAdvance = 0;

    for (const r of (this.attendanceRows || [])) {
      if (r.status === 'PRESENT_10H') present++;
      else if (r.status === 'HALF_5H') half++;
      else if (r.status === 'ABSENT') absent++;
      else if (r.status === 'LEAVE' || r.status === 'HOURLY_LEAVE') leave++;
      else if (r.status === 'MISSION') mission++;
      else if (r.status) other++;

      totalEffectiveHours += Number(r.effective_hours) || 0;
      totalOvertimeHours += Number(r.overtime_hours) || 0;
      totalAdvance += Number(r.advance_payment) || 0;
    }
    return {
      present,
      half,
      absent,
      leave,
      mission,
      other,
      total: this.attendanceRows.length,
      totalEffectiveHours,
      totalOvertimeHours,
      totalAdvance
    };
  }

  ngOnInit(): void {
    this.initDefaultDate();
    this.loadWarehouses();

    // گوش دادن بلادرنگ به رویدادهای کارکرد و ناوگان از طریق وب‌سوکت سراسری
    this.wsSub = this.wsService.notifications$.subscribe(notif => {
      if (!notif) return;

      // ۱. نادیده گرفتن اکوی پیام به همین تب مرورگر (سایر تب‌ها و دستگاه‌های کاربر آپدیت می‌شوند)
      if (notif.client_tab_id && notif.client_tab_id === this.wsService.tabId) {
        return;
      }

      // ۲. بررسی رویدادهای کارکرد پرسنل
      if (notif.type === 'attendance_updated' || notif.event === 'attendance_updated') {
        // فیلتر تطابق انبار جهت جلوگیری از تداخل انبارها (Warehouse Bleed)
        if (this.selectedWarehouseId && notif.warehouse_id && notif.warehouse_id !== this.selectedWarehouseId) {
          return;
        }

        if (this.activeMode === 'daily') {
          if (notif.date_shamsi === this.selectedDateShamsi || (notif.year_month && notif.year_month === this.selectedYearMonth)) {
            if (this.hasUnsavedChanges) {
              this.hasRemoteConflict = true;
              this.toast.show('warning', '⚠️ تغییرات کارکرد جدیدی توسط همکار دیگر ثبت شد.');
            } else {
              this.refreshAttendanceMatrixSilently();
            }
          }
        } else if (this.activeMode === 'monthly_grid') {
          const isMatchingMonth = notif.year_month === this.selectedYearMonth ||
            (notif.date_shamsi && notif.date_shamsi.startsWith(this.selectedYearMonth));
          if (isMatchingMonth) {
            if (this.hasUnsavedMonthlyGrid) {
              this.hasRemoteConflict = true;
              this.toast.show('warning', '⚠️ شیت ماهانه توسط همکار دیگر به‌روزرسانی شد.');
            } else {
              this.refreshMonthlyGridSilently();
            }
          }
        }
      }

      // ۳. بررسی رویدادهای تردد ناوگان
      if ((notif.type === 'fleet_trips_updated' || notif.event === 'fleet_trips_updated') && this.activeMode === 'fleet') {
        if (this.selectedWarehouseId && notif.warehouse_id && notif.warehouse_id !== this.selectedWarehouseId) {
          return;
        }
        if (notif.date_shamsi === this.selectedDateShamsi) {
          this.refreshVehicleMatrixSilently();
        }
      }
    });

    // ۴. مکانیزم Catch-up پس از وصل مجدد شبکه یا وب‌سوکت
    let isFirstConnection = true;
    this.wsConnectedSub = this.wsService.connected$.subscribe(isConnected => {
      if (isConnected) {
        if (!isFirstConnection) {
          console.log('[Attendance] 🔄 اتصال مجدد وب‌سوکت — اجرای استعلام Catch-up...');
          if (this.activeMode === 'daily') {
            this.refreshAttendanceMatrixSilently(true);
          } else if (this.activeMode === 'monthly_grid') {
            this.refreshMonthlyGridSilently(true);
          } else if (this.activeMode === 'fleet') {
            this.refreshVehicleMatrixSilently(true);
          }
        }
        isFirstConnection = false;
      }
    });

    // خواندن و سینک کامل تمام تب‌ها، حالت‌ها و فیلترها از روی URL مرورگر
    this.route.queryParams.subscribe(params => {
      let shouldReload = false;
      if (params['tab']) {
        this.mainSectionTab = params['tab'] === 'fleet' ? 'fleet' : 'personnel';
      }
      if (params['mode']) {
        this.activeMode = params['mode'];
      }
      if (params['wh'] !== undefined) {
        const whId = params['wh'] ? Number(params['wh']) : null;
        if (this.selectedWarehouseId !== whId) {
          this.selectedWarehouseId = whId;
          shouldReload = true;
        }
      }
      if (params['date'] && params['date'] !== this.selectedDateShamsi) {
        this.selectedDateShamsi = params['date'];
        this.attendanceDateControl.setValue(params['date'], { emitEvent: false });
        shouldReload = true;
      }
      if (params['month'] && params['month'] !== this.selectedYearMonth) {
        this.selectedYearMonth = params['month'];
        shouldReload = true;
      }
      if (params['q'] && params['q'] !== this.searchQuery) {
        this.searchQuery = params['q'];
        this.applySearchFilter();
      }
      if (shouldReload && this.warehouses.length > 0) {
        this.onFilterChange();
      }
    });
  }

  updateUrlParams(): void {
    const queryParams: any = {
      tab: this.mainSectionTab,
      mode: this.activeMode,
      wh: this.selectedWarehouseId !== null ? this.selectedWarehouseId : null,
      date: this.selectedDateShamsi || null,
      month: this.selectedYearMonth || null,
      q: this.searchQuery?.trim() ? this.searchQuery.trim() : null
    };
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  dismissRemoteConflict(): void {
    this.hasRemoteConflict = false;
  }

  reloadWithRemote(): void {
    this.hasRemoteConflict = false;
    this.onFilterChange();
  }

  ngOnDestroy(): void {
    if (this.wsSub) {
      this.wsSub.unsubscribe();
    }
    if (this.wsConnectedSub) {
      this.wsConnectedSub.unsubscribe();
    }
  }

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
        this.selectedWarehouseId = null;
        this.onFilterChange();
        this.cdr.detectChanges();
      },
      error: () => {
        this.toast.show('error', 'خطا در بارگذاری لیست انبارها');
      }
    });
  }

  get attendanceRegistrationState(): {
    status: 'none' | 'partial' | 'full';
    savedCount: number;
    totalCount: number;
    label: string;
  } {
    const total = this.attendanceRows.length;
    if (total === 0) {
      return { status: 'none', savedCount: 0, totalCount: 0, label: 'پیش‌نویس (بدون پرسنل)' };
    }
    const saved = this.attendanceRows.filter(r => !!r.is_existing || !!r.attendance_id).length;
    if (saved === 0) {
      return { status: 'none', savedCount: 0, totalCount: total, label: 'وضعیت: پیش‌نویس (هنوز در سرور ثبت نشده)' };
    } else if (saved === total) {
      return { status: 'full', savedCount: saved, totalCount: total, label: `وضعیت: نهایی و ثبت‌شده کامل (${saved} از ${total} نفر)` };
    } else {
      return { status: 'partial', savedCount: saved, totalCount: total, label: `وضعیت: ثبت ناقص (${saved} از ${total} نفر ثبت‌شده)` };
    }
  }

  get hasExistingAttendance(): boolean {
    return (this.attendanceRows || []).some(r => !!r.is_existing || !!r.attendance_id);
  }

  setMainTab(tab: 'personnel' | 'fleet'): void {
    this.mainSectionTab = tab;
    if (tab === 'personnel') {
      if (this.activeMode === 'fleet') {
        this.activeMode = 'daily';
      }
    } else {
      this.activeMode = 'fleet';
    }
    this.onFilterChange();
  }

  toggleMonthPicker(event?: Event): void {
    if (event) event.stopPropagation();
    this.isMonthPickerOpen = !this.isMonthPickerOpen;
    this.isWarehouseMenuOpen = false;
    this.openSpecialMenuRowId = null;
  }

  selectMonth(monthNum: number): void {
    const rawYear = this.selectedYearMonth ? this.selectedYearMonth.split('/')[0] : '1405';
    const year = rawYear.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());
    const mmStr = monthNum < 10 ? `0${monthNum}` : `${monthNum}`;
    this.selectedYearMonth = `${year}/${mmStr}`;
    this.fiscalYear = year;
    const curDay = this.selectedDateShamsi ? (this.selectedDateShamsi.split('/')[2] || '01') : '01';
    this.selectedDateShamsi = `${year}/${mmStr}/${curDay}`;
    this.attendanceDateControl.setValue(this.selectedDateShamsi, { emitEvent: false });
    this.isMonthPickerOpen = false;
    this.onFilterChange();
  }

  toggleWarehouseMenu(event?: Event): void {
    if (event) event.stopPropagation();
    this.isWarehouseMenuOpen = !this.isWarehouseMenuOpen;
    this.isMonthPickerOpen = false;
    this.openSpecialMenuRowId = null;
  }

  selectWarehouse(whId: number | null): void {
    this.selectedWarehouseId = whId;
    this.isWarehouseMenuOpen = false;
    this.onFilterChange();
  }

  getSelectedWarehouseName(): string {
    if (!this.selectedWarehouseId) return 'همه پرسنل';
    const wh = this.warehouses.find(w => w.id === this.selectedWarehouseId);
    return wh ? wh.name : 'همه پرسنل';
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    this.openSpecialMenuRowId = null;
    this.isMonthPickerOpen = false;
    this.isWarehouseMenuOpen = false;
  }

  @HostListener('window:keydown.escape')
  onGlobalEscape(): void {
    if (this.isRangeModalOpen) {
      this.isRangeModalOpen = false;
      return;
    }
    if (this.isDayDetailModalOpen) {
      this.isDayDetailModalOpen = false;
      return;
    }
    if (this.isBulkHoursModalOpen) {
      this.isBulkHoursModalOpen = false;
      return;
    }
    if (this.isExcelPasteModalOpen) {
      this.isExcelPasteModalOpen = false;
      return;
    }
    if (this.isSubmitModalOpen) {
      this.isSubmitModalOpen = false;
      return;
    }
    this.openSpecialMenuRowId = null;
    this.isMonthPickerOpen = false;
    this.isWarehouseMenuOpen = false;
  }

  // ناوبری هوشمند کلیدهای جهت‌نما (Arrow Keys)، اینتر و اسکیپ در جدول کارکرد روزانه
  onAttendanceGridKeydown(event: KeyboardEvent, colType: 'status' | 'eff' | 'ot' | 'note' | 'wh', rowIndex: number, statusType?: string, row?: AttendanceMatrixRow): void {
    const key = event.key;

    // ۱. ناوبری روی دکمه‌های وضعیت حضور (حاضر، نیمه‌وقت، مرخصی، غایب)
    if (colType === 'status') {
      const statuses = ['PRESENT_10H', 'HALF_5H', 'LEAVE', 'ABSENT'];
      const currentIdx = statuses.indexOf(statusType || 'PRESENT_10H');

      if (key === 'ArrowLeft') {
        event.preventDefault();
        if (currentIdx < statuses.length - 1) {
          const nextStatus = statuses[currentIdx + 1];
          const el = document.getElementById(`btn-status-${nextStatus}-${rowIndex}`);
          if (el) el.focus();
        } else {
          const el = document.getElementById(`input-eff-${rowIndex}`);
          if (el) {
            (el as HTMLInputElement).focus();
            (el as HTMLInputElement).select?.();
          }
        }
      } else if (key === 'ArrowRight') {
        event.preventDefault();
        if (currentIdx > 0) {
          const prevStatus = statuses[currentIdx - 1];
          const el = document.getElementById(`btn-status-${prevStatus}-${rowIndex}`);
          if (el) el.focus();
        } else {
          const el = document.getElementById(`chk-${rowIndex}`);
          if (el) el.focus();
        }
      } else if (key === 'ArrowDown') {
        event.preventDefault();
        const nextEl = document.getElementById(`btn-status-${statusType}-${rowIndex + 1}`);
        if (nextEl) nextEl.focus();
      } else if (key === 'ArrowUp') {
        event.preventDefault();
        const prevEl = document.getElementById(`btn-status-${statusType}-${rowIndex - 1}`);
        if (prevEl) prevEl.focus();
      } else if (key === 'Enter' || key === ' ') {
        event.preventDefault();
        if (row && statusType) {
          this.setAttendanceStatus(row, statusType);
        }
      }
      return;
    }

    // ۲. ناوبری روی ورودی‌های عددی و متنی (ساعت موثر، اضافه‌کار، یادداشت، تگ انبار)
    if (key === 'ArrowUp') {
      event.preventDefault();
      const prevEl = document.getElementById(colType === 'wh' ? `select-wh-${rowIndex - 1}` : `input-${colType}-${rowIndex - 1}`);
      if (prevEl) {
        (prevEl as HTMLElement).focus();
        (prevEl as HTMLInputElement).select?.();
      }
    } else if (key === 'ArrowDown' || key === 'Enter') {
      event.preventDefault();
      const nextEl = document.getElementById(colType === 'wh' ? `select-wh-${rowIndex + 1}` : `input-${colType}-${rowIndex + 1}`);
      if (nextEl) {
        (nextEl as HTMLElement).focus();
        (nextEl as HTMLInputElement).select?.();
      } else {
        (event.target as HTMLElement).blur();
      }
    } else if (key === 'ArrowLeft') {
      const target = event.target as HTMLInputElement;
      const isAtEnd = target.selectionStart === target.selectionEnd && target.selectionStart === (target.value || '').length;
      if (isAtEnd || target.type === 'number' || target.tagName === 'SELECT') {
        event.preventDefault();
        let nextColId = '';
        if (colType === 'eff') nextColId = `input-ot-${rowIndex}`;
        else if (colType === 'ot') nextColId = `input-note-${rowIndex}`;
        else if (colType === 'note') nextColId = `select-wh-${rowIndex}`;
        if (nextColId) {
          const el = document.getElementById(nextColId);
          if (el) {
            (el as HTMLElement).focus();
            (el as HTMLInputElement).select?.();
          }
        }
      }
    } else if (key === 'ArrowRight') {
      const target = event.target as HTMLInputElement;
      const isAtStart = target.selectionStart === 0 && target.selectionEnd === 0;
      if (isAtStart || target.type === 'number' || target.tagName === 'SELECT') {
        event.preventDefault();
        let prevColId = '';
        if (colType === 'wh') prevColId = `input-note-${rowIndex}`;
        else if (colType === 'note') prevColId = `input-ot-${rowIndex}`;
        else if (colType === 'ot') prevColId = `input-eff-${rowIndex}`;
        else if (colType === 'eff') {
          // بازگشت به دکمه وضعیت فعال یا غایب
          const activeStatus = row?.status || 'ABSENT';
          prevColId = `btn-status-${activeStatus}-${rowIndex}`;
        }
        if (prevColId) {
          const el = document.getElementById(prevColId);
          if (el) {
            (el as HTMLElement).focus();
            (el as HTMLInputElement).select?.();
          }
        }
      }
    } else if (key === 'Escape') {
      event.preventDefault();
      (event.target as HTMLElement).blur();
    }
  }

  // ناوبری کلیدهای جهت‌نما در جدول ناوگان
  onFleetGridKeydown(event: KeyboardEvent, colType: 'trip' | 'rate' | 'dispatch' | 'dest' | 'vnote', rowIndex: number): void {
    const key = event.key;
    if (key === 'ArrowUp') {
      event.preventDefault();
      const prevEl = document.getElementById(`input-${colType}-${rowIndex - 1}`);
      if (prevEl) {
        (prevEl as HTMLElement).focus();
        (prevEl as HTMLInputElement).select?.();
      }
    } else if (key === 'ArrowDown' || key === 'Enter') {
      event.preventDefault();
      const nextEl = document.getElementById(`input-${colType}-${rowIndex + 1}`);
      if (nextEl) {
        (nextEl as HTMLElement).focus();
        (nextEl as HTMLInputElement).select?.();
      } else {
        (event.target as HTMLElement).blur();
      }
    } else if (key === 'ArrowLeft') {
      const cols: ('trip' | 'rate' | 'dispatch' | 'dest' | 'vnote')[] = ['trip', 'rate', 'dispatch', 'dest', 'vnote'];
      const cIdx = cols.indexOf(colType);
      if (cIdx < cols.length - 1) {
        event.preventDefault();
        const nextEl = document.getElementById(`input-${cols[cIdx + 1]}-${rowIndex}`);
        if (nextEl) {
          (nextEl as HTMLElement).focus();
          (nextEl as HTMLInputElement).select?.();
        }
      }
    } else if (key === 'ArrowRight') {
      const cols: ('trip' | 'rate' | 'dispatch' | 'dest' | 'vnote')[] = ['trip', 'rate', 'dispatch', 'dest', 'vnote'];
      const cIdx = cols.indexOf(colType);
      if (cIdx > 0) {
        event.preventDefault();
        const prevEl = document.getElementById(`input-${cols[cIdx - 1]}-${rowIndex}`);
        if (prevEl) {
          (prevEl as HTMLElement).focus();
          (prevEl as HTMLInputElement).select?.();
        }
      }
    } else if (key === 'Escape') {
      event.preventDefault();
      (event.target as HTMLElement).blur();
    }
  }

  triggerExcelImport(): void {
    if (this.isPeriodLocked) {
      this.toast.show('warning', 'دوره قفل است و امکان بارگذاری اکسل وجود ندارد.');
      return;
    }
    this.excelFileInput?.nativeElement.click();
  }

  onExcelFileSelected(event: any): void {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      this.toast.show('warning', 'لطفاً فقط فایل اکسل (.xlsx یا .xls) انتخاب کنید.');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    if (this.selectedWarehouseId) {
      formData.append('warehouse_id', this.selectedWarehouseId.toString());
    }
    formData.append('year_month', this.selectedYearMonth);

    this.isImportingExcel = true;
    this.api.importMonthlyAttendanceExcel(formData).subscribe({
      next: (res: any) => {
        this.isImportingExcel = false;
        const updated = res.updated_count || res.matched_count || res.saved_count || 0;
        this.toast.show('success', `فایل اکسل با موفقیت پردازش شد و کارکرد ${updated} پرسنل به‌روزرسانی گردید.`);
        if (this.activeMode === 'daily') {
          this.loadAttendanceMatrix();
        } else {
          this.loadMonthlyAttendanceGrid();
        }
        if (this.excelFileInput?.nativeElement) {
          this.excelFileInput.nativeElement.value = '';
        }
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.isImportingExcel = false;
        const msg = err.error?.error || err.error?.message || 'خطا در بارگذاری فایل اکسل کارکرد';
        this.toast.show('error', msg);
        if (this.excelFileInput?.nativeElement) {
          this.excelFileInput.nativeElement.value = '';
        }
        this.cdr.detectChanges();
      }
    });
  }

  setMode(mode: 'daily' | 'monthly_grid' | 'fleet'): void {
    this.activeMode = mode;
    if (mode === 'fleet') {
      this.mainSectionTab = 'fleet';
    } else {
      this.mainSectionTab = 'personnel';
    }
    this.onFilterChange();
  }

  onFilterChange(): void {
    this.closeSpecialMenu();
    this.updateUrlParams();
    if (this.activeMode === 'daily') {
      this.loadAttendanceMatrix();
    } else if (this.activeMode === 'monthly_grid') {
      this.loadMonthlyAttendanceGrid();
    } else if (this.activeMode === 'fleet') {
      this.loadVehicleMatrix();
    }
  }

  onDateChanged(newDate: string): void {
    if (!newDate) return;
    this.selectedDateShamsi = newDate;
    const parts = newDate.split('/');
    if (parts.length >= 2) {
      this.selectedYearMonth = `${parts[0]}/${parts[1]}`;
      this.fiscalYear = parts[0];
    }
    this.onFilterChange();
  }

  goToPrevDay(): void {
    this.selectedDateShamsi = this.shiftShamsiDay(this.selectedDateShamsi, -1);
    this.syncYearMonthFromDailyDate();
    this.attendanceDateControl.setValue(this.selectedDateShamsi, { emitEvent: false });
    this.onFilterChange();
  }

  goToNextDay(): void {
    this.selectedDateShamsi = this.shiftShamsiDay(this.selectedDateShamsi, 1);
    this.syncYearMonthFromDailyDate();
    this.attendanceDateControl.setValue(this.selectedDateShamsi, { emitEvent: false });
    this.onFilterChange();
  }

  goToToday(): void {
    this.initDefaultDate();
    this.onFilterChange();
  }

  goToYesterday(): void {
    this.selectedDateShamsi = this.shiftShamsiDay(this.getTodayShamsi(), -1);
    this.syncYearMonthFromDailyDate();
    this.attendanceDateControl.setValue(this.selectedDateShamsi, { emitEvent: false });
    this.onFilterChange();
  }

  private syncYearMonthFromDailyDate(): void {
    if (this.selectedDateShamsi) {
      const parts = this.selectedDateShamsi.split('/');
      if (parts.length >= 2) {
        this.selectedYearMonth = `${parts[0]}/${parts[1]}`;
        this.fiscalYear = parts[0];
      }
    }
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

  private getTodayShamsi(): string {
    const d = new Date();
    const j = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
    const pad = (n: number) => n < 10 ? '0' + n : String(n);
    return `${j.jy}/${pad(j.jm)}/${pad(j.jd)}`;
  }

  // --- ماتریس ثبت کارکرد روزانه ---
  loadAttendanceMatrix(): void {
    if (!this.selectedDateShamsi) return;
    this.isAttendanceLoading = true;
    this.selectedPersonnelIds.clear();
    this.selectAllChecked = false;

    this.api.getAttendanceMatrix(this.selectedWarehouseId, this.selectedDateShamsi).subscribe({
      next: res => {
        this.attendanceRows = (res.rows || []).map((r: any) => ({
          ...r,
          warehouse_id: r.warehouse_id !== undefined && r.warehouse_id !== null ? r.warehouse_id : null
        }));
        this.isPeriodLocked = !!res.is_locked;
        this.periodStatus = res.period_status || 'OPEN';
        this.isAttendanceLoading = false;
        this.hasUnsavedChanges = false;
        this.applySearchFilter();
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.isAttendanceLoading = false;
        this.toast.show('error', err?.error?.detail || err?.error?.error || 'خطا در بارگذاری ماتریس کارکرد روزانه');
        this.cdr.detectChanges();
      }
    });
  }

  // به‌روزرسانی نامحسوس و درجا بدون نمایش اسپینر لودینگ و بدون پاک‌شدن چک‌باکس‌ها
  refreshAttendanceMatrixSilently(forceFresh = true): void {
    if (!this.selectedDateShamsi) return;
    const context = forceFresh ? new HttpContext().set(SKIP_OFFLINE, true) : undefined;
    this.api.getAttendanceMatrix(this.selectedWarehouseId, this.selectedDateShamsi, { context }).subscribe({
      next: res => {
        const newRows: AttendanceMatrixRow[] = (res.rows || []).map((r: any) => ({
          ...r,
          warehouse_id: r.warehouse_id !== undefined && r.warehouse_id !== null ? r.warehouse_id : null
        }));
        this.isPeriodLocked = !!res.is_locked;
        this.periodStatus = res.period_status || 'OPEN';

        const rowMap = new Map<number, AttendanceMatrixRow>();
        newRows.forEach(r => rowMap.set(r.personnel_id, r));

        // ۱. حذف سطرهایی که در دیتای سرور وجود ندارند (Ghost Rows)
        this.attendanceRows = this.attendanceRows.filter(r => rowMap.has(r.personnel_id));

        // ۲. به‌روزرسانی سطرهای موجود
        this.attendanceRows.forEach(r => {
          const updated = rowMap.get(r.personnel_id);
          if (updated) {
            r.status = updated.status;
            r.effective_hours = updated.effective_hours;
            r.overtime_hours = updated.overtime_hours;
            r.is_friday_work = updated.is_friday_work;
            r.is_mission = updated.is_mission;
            r.advance_payment = updated.advance_payment;
            r.notes = updated.notes;
            r.is_existing = updated.is_existing;
            r.warehouse_id = updated.warehouse_id;
            r.warehouse_name = updated.warehouse_name;
            r.attendance_id = updated.attendance_id;
          }
        });

        // ۳. افزودن سطرهای جدید
        const existingIds = new Set(this.attendanceRows.map(r => r.personnel_id));
        newRows.forEach(nr => {
          if (!existingIds.has(nr.personnel_id)) {
            this.attendanceRows.push(nr);
          }
        });

        this.applySearchFilter();
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  applySearchFilter(): void {
    if (!this.searchQuery.trim()) {
      this.filteredAttendanceRows = [...this.attendanceRows];
    } else {
      const q = this.searchQuery.trim().toLowerCase();
      this.filteredAttendanceRows = this.attendanceRows.filter(r =>
        (r.full_name && r.full_name.toLowerCase().includes(q)) ||
        (r.national_code && r.national_code.includes(q)) ||
        (r.job_title && r.job_title.toLowerCase().includes(q))
      );
    }
  }

  // تغییرات دستی در فیلدهای سطر
  onAttendanceCellChange(row: AttendanceMatrixRow): void {
    row._isDirty = true;
    this.hasUnsavedChanges = true;
  }

  // تنظیم وضعیت با ۱ کلیک (پشتیبانی از کلیک مجدد جهت لغو انتخاب / Toggle)
  setAttendanceStatus(row: AttendanceMatrixRow, status: string): void {
    if (this.isPeriodLocked) {
      this.toast.show('warning', 'دوره کارکرد قفل شده و قابل ویرایش نیست');
      return;
    }
    this.closeSpecialMenu();

    // اگر روی همان وضعیت انتخاب‌شده کلیک شد، وضعیت را لغو و خالی می‌کند
    if (row.status === status) {
      row.status = '';
      row.effective_hours = 0;
      row.overtime_hours = 0;
      row.is_friday_work = false;
      row.is_mission = false;
      row._isDirty = true;
      this.hasUnsavedChanges = true;
      this.cdr.detectChanges();
      return;
    }

    row.status = status;
    row._isDirty = true;
    this.hasUnsavedChanges = true;

    const isFriday = this.isSelectedDateFriday;
    if (status === 'PRESENT_10H') {
      row.effective_hours = 10;
      row.is_friday_work = isFriday;
      row.is_mission = false;
    } else if (status === 'HALF_5H') {
      row.effective_hours = 5;
      row.is_friday_work = isFriday;
      row.is_mission = false;
    } else if (status === 'ABSENT' || status === 'LEAVE') {
      row.effective_hours = 0;
      row.overtime_hours = 0;
      row.is_friday_work = false;
      row.is_mission = false;
    }
    this.cdr.detectChanges();
  }

  toggleSpecialMenu(rowId: number, event: MouseEvent): void {
    event.stopPropagation();
    if (this.openSpecialMenuRowId === rowId) {
      this.openSpecialMenuRowId = null;
    } else {
      this.openSpecialMenuRowId = rowId;
    }
  }

  closeSpecialMenu(): void {
    this.openSpecialMenuRowId = null;
  }

  // انتخاب سطرها
  toggleSelectAll(): void {
    this.selectAllChecked = !this.selectAllChecked;
    if (this.selectAllChecked) {
      const targets = this.searchQuery.trim() ? this.filteredAttendanceRows : this.attendanceRows;
      targets.forEach(r => this.selectedPersonnelIds.add(r.personnel_id));
    } else {
      this.selectedPersonnelIds.clear();
    }
  }

  toggleRowSelection(personnelId: number): void {
    if (this.selectedPersonnelIds.has(personnelId)) {
      this.selectedPersonnelIds.delete(personnelId);
    } else {
      this.selectedPersonnelIds.add(personnelId);
    }
    const currentTargetCount = this.searchQuery.trim() ? this.filteredAttendanceRows.length : this.attendanceRows.length;
    this.selectAllChecked = this.selectedPersonnelIds.size === currentTargetCount && currentTargetCount > 0;
  }

  isRowSelected(personnelId: number): boolean {
    return this.selectedPersonnelIds.has(personnelId);
  }

  // عملیات دسته‌جمعی هوشمند (انتخاب‌شده‌ها یا همه)
  setBulkAttendanceStatus(status: 'PRESENT_10H' | 'HALF_5H' | 'ABSENT' | 'LEAVE'): void {
    if (this.isPeriodLocked) {
      this.toast.show('warning', 'دوره کارکرد قفل شده و قابل ویرایش نیست');
      return;
    }
    const targetRows = this.selectedPersonnelIds.size > 0
      ? this.attendanceRows.filter(r => this.selectedPersonnelIds.has(r.personnel_id))
      : (this.searchQuery.trim() ? this.filteredAttendanceRows : this.attendanceRows);

    if (targetRows.length === 0) {
      this.toast.show('info', 'هیچ پرسنلی برای تغییر وضعیت یافت نشد');
      return;
    }

    let statusLabel = '';
    const isFriday = this.isSelectedDateFriday;
    targetRows.forEach(r => {
      r.status = status;
      r._isDirty = true;
      if (status === 'PRESENT_10H') {
        r.effective_hours = 10;
        r.overtime_hours = 0;
        r.is_friday_work = isFriday;
        r.is_mission = false;
        statusLabel = isFriday ? 'حاضر (۱۰ ساعت - جمعه‌کاری)' : 'حاضر (۱۰ ساعت)';
      } else if (status === 'HALF_5H') {
        r.effective_hours = 5;
        r.overtime_hours = 0;
        r.is_friday_work = isFriday;
        r.is_mission = false;
        statusLabel = isFriday ? 'نیمه‌وقت (۵ ساعت - جمعه‌کاری)' : 'نیمه‌وقت (۵ ساعت)';
      } else if (status === 'ABSENT') {
        r.effective_hours = 0;
        r.overtime_hours = 0;
        r.is_friday_work = false;
        r.is_mission = false;
        statusLabel = 'غایب';
      } else if (status === 'LEAVE') {
        r.effective_hours = 0;
        r.overtime_hours = 0;
        r.is_friday_work = false;
        r.is_mission = false;
        statusLabel = 'مرخصی';
      }
    });

    this.hasUnsavedChanges = true;
    const scopeText = this.selectedPersonnelIds.size > 0 ? `${targetRows.length} نفر انتخاب‌شده` : `${targetRows.length} نفر`;
    this.toast.show('success', `${scopeText} به عنوان «${statusLabel}» تنظیم شدند`);
    this.cdr.detectChanges();
  }

  copyFromYesterday(): void {
    if (this.isPeriodLocked) return;
    this.isAttendanceLoading = true;
    const yesterdayStr = this.shiftShamsiDay(this.selectedDateShamsi, -1);

    this.api.getAttendanceMatrix(this.selectedWarehouseId, yesterdayStr).subscribe({
      next: res => {
        this.isAttendanceLoading = false;
        const prevRows = res.rows || [];
        if (prevRows.length === 0) {
          this.toast.show('warning', 'اطلاعاتی برای روز قبل یافت نشد');
          return;
        }
        let matched = 0;
        prevRows.forEach(pr => {
          const cur = this.attendanceRows.find(r => r.personnel_id === pr.personnel_id);
          if (cur) {
            cur.status = pr.status || '';
            const isZeroHour = (pr.status === 'ABSENT' || pr.status === 'LEAVE' || !pr.status);
            cur.effective_hours = isZeroHour ? 0 : (Number(pr.effective_hours) || 0);
            cur.overtime_hours = isZeroHour ? 0 : (Number(pr.overtime_hours) || 0);
            cur.is_friday_work = !!pr.is_friday_work;
            cur.is_mission = !!pr.is_mission;
            cur.is_existing = !!pr.is_existing;
            cur._isDirty = true;
            matched++;
          }
        });
        this.hasUnsavedChanges = true;
        this.toast.show('success', `اطلاعات کارکرد ${matched} نفر از روز قبل کپی شد`);
        this.cdr.detectChanges();
      },
      error: () => {
        this.isAttendanceLoading = false;
        this.toast.show('error', 'خطا در واکشی اطلاعات روز قبل');
        this.cdr.detectChanges();
      }
    });
  }

  markOfficialHoliday(): void {
    if (this.isPeriodLocked) return;
    const targets = this.selectedPersonnelIds.size > 0
      ? this.attendanceRows.filter(r => this.selectedPersonnelIds.has(r.personnel_id))
      : (this.searchQuery.trim() ? this.filteredAttendanceRows : this.attendanceRows);

    targets.forEach(r => {
      r.status = 'LEAVE';
      r.effective_hours = 0;
      r.overtime_hours = 0;
      r.notes = r.notes ? `${r.notes} (تعطیل رسمی)` : 'تعطیل رسمی';
      r._isDirty = true;
    });
    this.hasUnsavedChanges = true;
    this.toast.show('success', `وضعیت ${targets.length} نفر به تعطیل رسمی تغییر یافت`);
    this.cdr.detectChanges();
  }

  clearDayAttendance(): void {
    if (this.isPeriodLocked) {
      this.toast.show('warning', 'دوره کارکرد قفل شده و امکان پاکسازی وجود ندارد');
      return;
    }

    const target = this.selectedPersonnelIds.size > 0
      ? this.attendanceRows.filter(r => this.selectedPersonnelIds.has(r.personnel_id))
      : (this.searchQuery.trim() ? this.filteredAttendanceRows : this.attendanceRows);

    if (target.length === 0) {
      this.toast.show('info', 'هیچ سطری برای پاکسازی انتخاب نشده است');
      return;
    }

    target.forEach(r => {
      r.status = '';
      r.effective_hours = 0;
      r.overtime_hours = 0;
      r.is_friday_work = false;
      r.is_mission = false;
      r.notes = '';
      r._isDirty = true;
    });

    this.hasUnsavedChanges = true;
    this.applySearchFilter();
    this.toast.show('info', `وضعیت ${target.length} نفر پاکسازی شد. جهت اعمال نهایی در سرور، دکمه «به‌روزرسانی کارکرد» را بزنید.`);
    this.cdr.detectChanges();
  }

  // اعمال گروهی ساعت و اضافه کار
  openBulkHoursModal(): void {
    if (this.isPeriodLocked) return;
    this.bulkHoursScope = this.selectedPersonnelIds.size > 0 ? 'selected' : 'all';
    this.bulkEffectiveHours = 10;
    this.bulkOvertimeHours = 0;
    this.bulkStatusOption = '';
    this.bulkNotes = '';
    this.isBulkHoursModalOpen = true;
  }

  applyBulkHours(): void {
    let targets: AttendanceMatrixRow[] = [];
    const baseRows = this.searchQuery.trim() ? this.filteredAttendanceRows : this.attendanceRows;
    if (this.bulkHoursScope === 'selected') {
      targets = this.attendanceRows.filter(r => this.selectedPersonnelIds.has(r.personnel_id));
    } else if (this.bulkHoursScope === 'present') {
      targets = baseRows.filter(r => r.status === 'PRESENT_10H' || r.status === 'HALF_5H');
    } else {
      targets = baseRows;
    }

    targets.forEach(r => {
      const isAbsentOrLeave = r.status === 'ABSENT' || r.status === 'LEAVE';
      if (this.bulkStatusOption) {
        r.status = this.bulkStatusOption;
        r.effective_hours = this.bulkEffectiveHours;
        r.overtime_hours = this.bulkOvertimeHours;
      } else {
        if (!isAbsentOrLeave) {
          r.effective_hours = this.bulkEffectiveHours;
          r.overtime_hours = this.bulkOvertimeHours;
        }
      }
      if (this.bulkNotes.trim()) {
        r.notes = this.bulkNotes.trim();
      }
      r._isDirty = true;
    });
    this.hasUnsavedChanges = true;
    this.isBulkHoursModalOpen = false;
    this.toast.show('success', `ساعات کارکرد برای ${targets.length} نفر با موفقیت اعمال شد`);
    this.cdr.detectChanges();
  }

  // پیست هوشمند از اکسل
  openExcelPasteModal(): void {
    if (this.isPeriodLocked) return;
    this.excelPasteText = '';
    this.excelParsedRows = [];
    this.isExcelPasteModalOpen = true;
  }

  parseExcelPasteText(): void {
    if (!this.excelPasteText.trim()) {
      this.excelParsedRows = [];
      return;
    }
    const lines = this.excelPasteText.trim().split('\n');
    this.excelParsedRows = [];

    lines.forEach(line => {
      const cols = line.split('\t').map(c => c.trim());
      if (cols.length === 0 || !cols[0]) return;

      const codeOrName = cols[0];
      const matchedRow = this.attendanceRows.find(r =>
        r.national_code === codeOrName ||
        (r.full_name && r.full_name.includes(codeOrName))
      );

      let status = cols[1] || 'PRESENT_10H';
      if (status.includes('حاضر')) status = 'PRESENT_10H';
      else if (status.includes('غایب')) status = 'ABSENT';
      else if (status.includes('مرخصی')) status = 'LEAVE';
      else if (status.includes('ماموریت')) status = 'MISSION';
      else if (status.includes('جمعه')) status = 'FRIDAY_WORK';

      const isZeroHourStatus = (status === 'ABSENT' || status === 'LEAVE');
      const defaultHours = isZeroHourStatus ? 0 : 10;
      const effectiveHours = cols[2] ? parseFloat(cols[2]) : defaultHours;
      const overtimeHours = (cols[3] && !isZeroHourStatus) ? parseFloat(cols[3]) : 0;
      const notes = cols[4] || '';

      this.excelParsedRows.push({
        national_code: matchedRow?.national_code || (codeOrName.length === 10 ? codeOrName : ''),
        full_name: matchedRow?.full_name || codeOrName,
        status,
        effective_hours: isNaN(effectiveHours) ? defaultHours : (isZeroHourStatus ? 0 : effectiveHours),
        overtime_hours: isNaN(overtimeHours) ? 0 : (isZeroHourStatus ? 0 : overtimeHours),
        notes,
        matchedRow
      });
    });
  }

  applyExcelPaste(): void {
    let appliedCount = 0;
    this.excelParsedRows.forEach(pr => {
      if (pr.matchedRow) {
        if (pr.status) pr.matchedRow.status = pr.status;
        if (pr.effective_hours !== undefined) pr.matchedRow.effective_hours = pr.effective_hours;
        if (pr.overtime_hours !== undefined) pr.matchedRow.overtime_hours = pr.overtime_hours;
        if (pr.notes) pr.matchedRow.notes = pr.notes;
        pr.matchedRow._isDirty = true;
        appliedCount++;
      }
    });

    if (appliedCount > 0) {
      this.hasUnsavedChanges = true;
      this.toast.show('success', `${appliedCount} سطر از اکسل با موفقیت تطبیق و اعمال شد`);
      this.isExcelPasteModalOpen = false;
      this.cdr.detectChanges();
    } else {
      this.toast.show('warning', 'هیچ سطری با پرسنل سیستم تطبیق داده نشد');
    }
  }

  // استخراج متن خطای ساختاریافته از پاسخ سرور DRF
  private extractApiErrorMessage(err: any): string {
    if (!err) return 'خطای نامشخص در ارتباط با سرور';
    const errorData = err.error || err;
    if (typeof errorData === 'string') return errorData;
    if (errorData.detail && typeof errorData.detail === 'string') return errorData.detail;
    if (errorData.error && typeof errorData.error === 'string') return errorData.error;
    if (errorData.message && typeof errorData.message === 'string') return errorData.message;

    // پیمایش خطاهای تودرتوی DRF (مانند آرایه items)
    if (errorData.items && Array.isArray(errorData.items)) {
      for (let i = 0; i < errorData.items.length; i++) {
        const itemErr = errorData.items[i];
        if (itemErr && typeof itemErr === 'object') {
          const firstKey = Object.keys(itemErr)[0];
          if (firstKey) {
            const rowRef = this.attendanceRows[i];
            const namePrefix = rowRef ? `خطا برای «${rowRef.full_name}»: ` : `ردیف ${i + 1}: `;
            const val = itemErr[firstKey];
            const msg = Array.isArray(val) ? val.join('، ') : String(val);
            return `${namePrefix}${msg}`;
          }
        }
      }
    }

    // سایر کلیدهای خطا
    if (typeof errorData === 'object') {
      const keys = Object.keys(errorData);
      if (keys.length > 0) {
        const firstVal = errorData[keys[0]];
        if (Array.isArray(firstVal)) {
          return `${keys[0]}: ${firstVal.join('، ')}`;
        }
        if (typeof firstVal === 'string') {
          return `${keys[0]}: ${firstVal}`;
        }
      }
    }

    return 'خطا در ذخیره کارکرد روزانه (اطلاعات ارسالی نامعتبر است)';
  }

  // ذخیره نهایی کارکرد روزانه با ارسال اختصاصی ردیف‌های تغییریافته (Dirty Tracking)
  saveAttendanceMatrix(): void {
    if (this.isPeriodLocked) {
      this.toast.show('warning', 'دوره قفل شده و امکان ذخیره وجود ندارد');
      return;
    }

    const dirtyRows = this.attendanceRows.filter(r => r._isDirty);
    if (dirtyRows.length === 0) {
      this.hasUnsavedChanges = false;
      this.toast.show('info', 'هیچ تغییر جدیدی برای ذخیره وجود ندارد.');
      return;
    }

    this.isSavingAttendance = true;

    const payload = {
      warehouse_id: this.selectedWarehouseId,
      date_shamsi: this.selectedDateShamsi,
      client_tab_id: this.wsService.tabId,
      items: dirtyRows.map(r => ({
        personnel_id: r.personnel_id,
        warehouse_id: r.warehouse_id || this.selectedWarehouseId || null,
        status: r.status || '',
        effective_hours: Number(r.effective_hours) || 0,
        overtime_hours: Number(r.overtime_hours) || 0,
        is_friday_work: !!r.is_friday_work,
        is_mission: !!r.is_mission,
        advance_payment: Number(r.advance_payment) || 0,
        notes: r.notes || ''
      }))
    };

    this.api.saveAttendanceBulk(payload).subscribe({
      next: res => {
        this.isSavingAttendance = false;
        this.hasUnsavedChanges = false;
        dirtyRows.forEach(r => {
          r._isDirty = false;
          r.is_existing = !!r.status || Number(r.effective_hours) > 0;
        });
        this.applySearchFilter();
        this.toast.show('success', res.message || (this.hasExistingAttendance ? 'کارکرد روزانه با موفقیت به‌روزرسانی شد' : 'کارکرد روزانه با موفقیت ثبت شد'));
        
        // همگام‌سازی خودکار کش و اطلاعات شیت ماهانه در پس‌زمینه بدون کش کهنه
        if (this.selectedYearMonth) {
          this.api.getMonthlyAttendanceGrid(this.selectedWarehouseId, this.selectedYearMonth, {
            context: new HttpContext().set(SKIP_OFFLINE, true)
          }).subscribe({
            next: mRes => {
              this.monthlyGridDays = mRes.days_meta || [];
              this.monthlyGridRows = mRes.rows || [];
              this.monthName = mRes.month_name || '';
              this.daysInMonth = mRes.days_in_month || 31;
              this.cdr.detectChanges();
            },
            error: () => {}
          });
        }
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.isSavingAttendance = false;
        const errorMsg = this.extractApiErrorMessage(err);
        this.toast.show('error', errorMsg);
        this.cdr.detectChanges();
      }
    });
  }

  // --- تقویم ۳۱ روزه ماهانه (Monthly Timesheet Grid) ---
  loadMonthlyAttendanceGrid(): void {
    if (!this.selectedYearMonth) return;
    this.isMonthlyGridLoading = true;
    this.hasUnsavedMonthlyGrid = false;

    this.api.getMonthlyAttendanceGrid(this.selectedWarehouseId, this.selectedYearMonth).subscribe({
      next: (res: MonthlyGridResponse) => {
        this.monthlyGridDays = res.days_meta || [];
        this.monthlyGridRows = res.rows || [];
        this.monthName = res.month_name || '';
        this.daysInMonth = res.days_in_month || 31;
        this.isPeriodLocked = !!res.is_locked;
        this.periodStatus = res.period_status || 'OPEN';
        this.periodInfo = res.period_info || null;
        this.anomalies = res.anomalies || [];
        this.monthlyGridSettingsWindow = res.settings_window || { past_days: 3, future_days: 0 };
        this.isMonthlyGridLoading = false;
        this.hasUnsavedMonthlyGrid = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.isMonthlyGridLoading = false;
        this.toast.show('error', err?.error?.detail || err?.error?.error || 'خطا در دریافت ماتریس ماهانه کارکرد');
        this.cdr.detectChanges();
      }
    });
  }

  // به‌روزرسانی نامحسوس شیت ماهانه از طریق وب‌سوکت
  refreshMonthlyGridSilently(forceFresh = true): void {
    if (!this.selectedYearMonth) return;
    const context = forceFresh ? new HttpContext().set(SKIP_OFFLINE, true) : undefined;
    this.api.getMonthlyAttendanceGrid(this.selectedWarehouseId, this.selectedYearMonth, { context }).subscribe({
      next: (res: MonthlyGridResponse) => {
        this.monthlyGridDays = res.days_meta || [];
        this.monthlyGridRows = res.rows || [];
        this.monthName = res.month_name || '';
        this.daysInMonth = res.days_in_month || 31;
        this.isPeriodLocked = !!res.is_locked;
        this.periodStatus = res.period_status || 'OPEN';
        this.periodInfo = res.period_info || null;
        this.anomalies = res.anomalies || [];
        this.monthlyGridSettingsWindow = res.settings_window || { past_days: 3, future_days: 0 };

        // بازیابی و اتصال مجدد رفرنس مودال باز به داده‌های زنده جدید
        if (this.isDayDetailModalOpen && this.selectedDayDetailRow && this.selectedDayDetailItem) {
          const targetPid = this.selectedDayDetailRow.personnel_id;
          const targetDay = this.selectedDayDetailItem.day;
          const freshRow = this.monthlyGridRows.find(r => r.personnel_id === targetPid);
          if (freshRow) {
            this.selectedDayDetailRow = freshRow;
            const freshDayItem = freshRow.days.find(d => d.day === targetDay);
            if (freshDayItem) {
              this.selectedDayDetailItem = freshDayItem;
            }
          }
        }

        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  // باز کردن مودال اعمال کارکرد در بازه زمانی مشخص
  openRangeModal(): void {
    if (this.isPeriodLocked) {
      this.toast.show('warning', 'دوره قفل شده و امکان ویرایش وجود ندارد.');
      return;
    }
    this.rangeStartDay = 1;
    this.rangeEndDay = this.daysInMonth || 31;
    this.rangeTargetScope = this.selectedPersonnelIds.size > 0 ? 'selected' : 'all';
    this.rangeStatus = 'PRESENT_10H';
    this.rangeEffectiveHours = 10;
    this.rangeOvertimeHours = 0;
    this.rangeSkipFridays = true;
    this.rangeOnlyEmptyDays = true;
    this.isRangeModalOpen = true;
  }

  onRangeStatusChange(): void {
    if (this.rangeStatus === 'PRESENT_10H') {
      this.rangeEffectiveHours = 10;
      this.rangeOvertimeHours = 0;
    } else if (this.rangeStatus === 'HALF_5H') {
      this.rangeEffectiveHours = 5;
      this.rangeOvertimeHours = 0;
    } else if (this.rangeStatus === 'FRIDAY_WORK') {
      this.rangeEffectiveHours = 10;
      this.rangeOvertimeHours = 0;
      this.rangeSkipFridays = false;
    } else if (this.rangeStatus === 'MISSION') {
      this.rangeEffectiveHours = 10;
      this.rangeOvertimeHours = 0;
    } else if (this.rangeStatus === 'ABSENT' || this.rangeStatus === 'LEAVE') {
      this.rangeEffectiveHours = 0;
      this.rangeOvertimeHours = 0;
    }
  }

  // اعمال هوشمند کارکرد در بازه زمانی انتخابی در تقویم ماهانه
  applyDateRangeAttendance(): void {
    if (this.isPeriodLocked) return;
    if (this.rangeStartDay > this.rangeEndDay) {
      this.toast.show('warning', 'روز شروع نمی‌تواند از روز پایان بزرگتر باشد.');
      return;
    }
    if (!this.monthlyGridRows.length) {
      this.toast.show('warning', 'سطری در جدول ماهانه وجود ندارد.');
      return;
    }

    const targetRows = this.rangeTargetScope === 'selected' && this.selectedPersonnelIds.size > 0
      ? this.monthlyGridRows.filter(r => this.selectedPersonnelIds.has(r.personnel_id))
      : this.monthlyGridRows;

    if (targetRows.length === 0) {
      this.toast.show('warning', 'سطری برای اعمال کارکرد یافت نشد.');
      return;
    }

    const fridayDays = new Set(this.monthlyGridDays.filter(m => m.is_friday).map(m => m.day));
    let affectedCount = 0;

    for (const row of targetRows) {
      for (const d of row.days) {
        if (d.day < this.rangeStartDay || d.day > this.rangeEndDay) {
          continue;
        }
        const isFriday = fridayDays.has(d.day);
        if (this.rangeSkipFridays && isFriday && this.rangeStatus !== 'FRIDAY_WORK') {
          continue;
        }

        if (this.rangeOnlyEmptyDays) {
          const hasExistingWork = d.status && d.status !== 'ABSENT' && Number(d.effective_hours) > 0;
          if (hasExistingWork) {
            continue;
          }
        }

        d.status = this.rangeStatus;
        d.effective_hours = this.rangeEffectiveHours;
        d.overtime_hours = this.rangeOvertimeHours;
        d.is_friday_work = isFriday && this.rangeEffectiveHours > 0;
        d.is_mission = this.rangeStatus === 'MISSION';
        affectedCount++;
      }
      row.total_hours = row.days.reduce((acc, d) => acc + (parseFloat(d.effective_hours as any) || 0), 0);
      row.total_overtime = row.days.reduce((acc, d) => acc + (parseFloat(d.overtime_hours as any) || 0), 0);
      row.present_days = row.days.filter(d => ['PRESENT_10H', 'HALF_5H', 'FRIDAY_WORK', 'MISSION', 'CUSTOM'].includes(d.status) && (parseFloat(d.effective_hours as any) || 0) > 0).length;
    }

    this.isRangeModalOpen = false;
    if (affectedCount > 0) {
      this.hasUnsavedMonthlyGrid = true;
      this.toast.show('success', `کارکرد بازه روزهای ${this.rangeStartDay} تا ${this.rangeEndDay} برای ${targetRows.length} نفر (${affectedCount} سلول) اعمال شد. جهت ذخیره نهایی، دکمه ذخیره را بزنید.`);
    } else {
      this.toast.show('info', 'هیچ سلولی مطابق شروط انتخابی تغییر نیافت.');
    }
    this.cdr.detectChanges();
  }

  saveMonthlyGrid(): void {
    if (!this.selectedYearMonth) return;
    if (this.isPeriodLocked) {
      this.toast.show('warning', 'دوره قفل شده و امکان ذخیره وجود ندارد');
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
      client_tab_id: this.wsService.tabId,
      items
    }).subscribe({
      next: () => {
        this.isSavingMonthlyGrid = false;
        this.hasUnsavedMonthlyGrid = false;
        this.toast.show('success', 'تغییرات ماتریس ماهانه ذخیره شد');
        this.refreshMonthlyGridSilently();
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.isSavingMonthlyGrid = false;
        this.toast.show('error', err?.error?.detail || err?.error?.error || 'خطا در ذخیره ماتریس ماهانه');
        this.cdr.detectChanges();
      }
    });
  }

  onMonthlyCellHoursChange(row: MonthlyGridRow, dayItem: MonthlyGridPersonnelDay): void {
    this.hasUnsavedMonthlyGrid = true;
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
    row.present_days = row.days.filter(d => ['PRESENT_10H', 'HALF_5H', 'FRIDAY_WORK', 'MISSION', 'CUSTOM'].includes(d.status) && (parseFloat(d.effective_hours as any) || 0) > 0).length;
  }

  quickSetMonthlyDayStatus(row: MonthlyGridRow, dayItem: MonthlyGridPersonnelDay): void {
    if (this.isPeriodLocked) {
      this.toast.show('warning', 'دوره کارکرد قفل شده است.');
      return;
    }
    const dayMeta = this.monthlyGridDays.find(d => d.day === dayItem.day);
    if (!dayItem.status) {
      dayItem.status = 'PRESENT_10H';
      dayItem.effective_hours = 10;
      dayItem.is_friday_work = !!dayMeta?.is_friday;
    } else if (dayItem.status === 'PRESENT_10H') {
      dayItem.status = 'HALF_5H';
      dayItem.effective_hours = 5;
      dayItem.is_friday_work = !!dayMeta?.is_friday;
    } else if (dayItem.status === 'HALF_5H') {
      dayItem.status = 'ABSENT';
      dayItem.effective_hours = 0;
      dayItem.overtime_hours = 0;
      dayItem.is_friday_work = false;
      dayItem.is_mission = false;
    } else if (dayItem.status === 'ABSENT') {
      dayItem.status = 'LEAVE';
      dayItem.effective_hours = 0;
      dayItem.overtime_hours = 0;
      dayItem.is_friday_work = false;
      dayItem.is_mission = false;
    } else {
      dayItem.status = '';
      dayItem.effective_hours = 0;
      dayItem.overtime_hours = 0;
      dayItem.is_friday_work = false;
      dayItem.is_mission = false;
    }
    this.onMonthlyCellHoursChange(row, dayItem);
  }

  get isSelectedDayDetailFriday(): boolean {
    if (!this.selectedDayDetailItem) return false;
    return !!this.monthlyGridDays.find(d => d.day === this.selectedDayDetailItem?.day)?.is_friday;
  }

  openDayDetailModal(row: MonthlyGridRow, dayItem: MonthlyGridPersonnelDay): void {
    if (this.isPeriodLocked) {
      this.toast.show('info', 'این سلول در دوره قفل‌شده قرار دارد و فقط‌خواندنی است');
      return;
    }
    this.selectedDayDetailRow = row;
    this.selectedDayDetailItem = dayItem;
    this.dayDetailStatus = dayItem.status || 'PRESENT_10H';
    this.dayDetailEffectiveHours = (this.dayDetailStatus === 'ABSENT' || this.dayDetailStatus === 'LEAVE') ? 0 : (dayItem.effective_hours || 10);
    this.dayDetailOvertimeHours = (this.dayDetailStatus === 'ABSENT' || this.dayDetailStatus === 'LEAVE') ? 0 : (dayItem.overtime_hours || 0);
    this.dayDetailIsFridayWork = !!dayItem.is_friday_work;
    this.dayDetailIsMission = false;
    this.dayDetailNotes = dayItem.notes || '';
    this.isDayDetailModalOpen = true;
  }

  onDayDetailStatusChange(): void {
    if (this.dayDetailStatus === 'ABSENT' || this.dayDetailStatus === 'LEAVE') {
      this.dayDetailEffectiveHours = 0;
      this.dayDetailOvertimeHours = 0;
      this.dayDetailIsFridayWork = false;
      this.dayDetailIsMission = false;
    } else if (this.dayDetailStatus === 'PRESENT_10H') {
      if (!this.dayDetailEffectiveHours) this.dayDetailEffectiveHours = 10;
      this.dayDetailIsFridayWork = this.isSelectedDayDetailFriday;
    } else if (this.dayDetailStatus === 'HALF_5H') {
      if (!this.dayDetailEffectiveHours) this.dayDetailEffectiveHours = 5;
      this.dayDetailIsFridayWork = this.isSelectedDayDetailFriday;
    }
  }

  saveDayDetail(): void {
    if (!this.selectedDayDetailItem || !this.selectedDayDetailRow) return;

    // اطمینان از پیدا کردن سطر و سلول فعال در آرایه monthlyGridRows
    const activeRow = this.monthlyGridRows.find(r => r.personnel_id === this.selectedDayDetailRow?.personnel_id) || this.selectedDayDetailRow;
    const activeItem = activeRow.days.find(d => d.day === this.selectedDayDetailItem?.day) || this.selectedDayDetailItem;

    activeItem.status = this.dayDetailStatus as any;
    if (this.dayDetailStatus === 'ABSENT' || this.dayDetailStatus === 'LEAVE') {
      this.dayDetailEffectiveHours = 0;
      this.dayDetailOvertimeHours = 0;
      this.dayDetailIsFridayWork = false;
    } else {
      this.dayDetailIsFridayWork = this.isSelectedDayDetailFriday && (this.dayDetailEffectiveHours > 0);
    }
    activeItem.effective_hours = this.dayDetailEffectiveHours;
    activeItem.overtime_hours = this.dayDetailOvertimeHours;
    activeItem.is_friday_work = this.dayDetailIsFridayWork;
    activeItem.is_mission = false;
    activeItem.notes = this.dayDetailNotes;
    
    this.onMonthlyCellHoursChange(activeRow, activeItem);
    this.isDayDetailModalOpen = false;
    this.saveMonthlyGrid();
  }

  // گردش کار ارسال و تایید
  openSubmitModal(): void {
    if (!this.selectedWarehouseId) {
      this.toast.show('warning', 'برای ارسال کارکرد ماهانه به واحد مالی، لطفاً ابتدا یک انبار مشخص را انتخاب کنید.');
      return;
    }
    this.submitNotes = '';
    this.isSubmitModalOpen = true;
  }

  submitPeriodForReview(): void {
    this.isSubmittingWorkflow = true;
    this.api.periodWorkflowAction({
      warehouse_id: this.selectedWarehouseId,
      year_month: this.selectedYearMonth,
      action: 'submit',
      notes: this.submitNotes
    }).subscribe({
      next: res => {
        this.isSubmittingWorkflow = false;
        this.isSubmitModalOpen = false;
        this.toast.show('success', res.message || 'کارکرد ماهانه جهت بررسی مالی ارسال گردید');
        this.loadMonthlyAttendanceGrid();
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.isSubmittingWorkflow = false;
        this.toast.show('error', err?.error?.detail || err?.error?.error || 'خطا در ارسال دوره جهت بررسی');
        this.cdr.detectChanges();
      }
    });
  }

  // اکسپورت اکسل شیت ماهانه
  exportMonthlyExcel(): void {
    this.isExportingMonthlyExcel = true;
    this.api.exportMonthlyAttendanceExcel(this.selectedWarehouseId, this.selectedYearMonth).subscribe({
      next: (blob: Blob) => {
        this.isExportingMonthlyExcel = false;
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Timesheet_${this.selectedYearMonth.replace('/', '_')}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
        this.toast.show('success', 'فایل اکسل تقویم کارکرد با موفقیت دانلود شد');
        this.cdr.detectChanges();
      },
      error: () => {
        this.isExportingMonthlyExcel = false;
        this.toast.show('error', 'خطا در دانلود فایل اکسل کارکرد');
        this.cdr.detectChanges();
      }
    });
  }

  // --- ناوگان و سرویس‌های انبار ---
  loadVehicleMatrix(): void {
    if (!this.selectedDateShamsi) return;
    this.isVehicleLoading = true;
    this.api.getVehicleMatrix(this.selectedWarehouseId, this.selectedDateShamsi).subscribe({
      next: res => {
        this.vehicleRows = res.rows || [];
        this.isVehicleLoading = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.isVehicleLoading = false;
        this.toast.show('error', err?.error?.detail || err?.error?.error || 'خطا در بارگذاری ماتریس ناوگان');
        this.cdr.detectChanges();
      }
    });
  }

  // به‌روزرسانی نامحسوس ناوگان از طریق وب‌سوکت
  refreshVehicleMatrixSilently(forceFresh = true): void {
    if (!this.selectedDateShamsi) return;
    const context = forceFresh ? new HttpContext().set(SKIP_OFFLINE, true) : undefined;
    this.api.getVehicleMatrix(this.selectedWarehouseId, this.selectedDateShamsi, { context }).subscribe({
      next: res => {
        const newRows: VehicleMatrixRow[] = res.rows || [];
        const vMap = new Map<number, VehicleMatrixRow>();
        newRows.forEach(r => vMap.set(r.vehicle_id, r));

        // ۱. حذف ناوگانی که از سرور پاک شده‌اند
        this.vehicleRows = this.vehicleRows.filter(r => vMap.has(r.vehicle_id));

        // ۲. به‌روزرسانی مقادیر ردیف‌های موجود
        this.vehicleRows.forEach(r => {
          const updated = vMap.get(r.vehicle_id);
          if (updated) {
            r.trip_count = updated.trip_count;
            r.unit_rate = updated.unit_rate;
            r.total_amount = updated.total_amount;
            r.dispatch_reference = updated.dispatch_reference;
            r.origin_destination = updated.origin_destination;
            r.notes = updated.notes;
            r.warehouse_name = updated.warehouse_name;
            r.is_existing = updated.is_existing;
          }
        });

        // ۳. افزودن ناوگان جدید
        const existingIds = new Set(this.vehicleRows.map(r => r.vehicle_id));
        newRows.forEach(nr => {
          if (!existingIds.has(nr.vehicle_id)) {
            this.vehicleRows.push(nr);
          }
        });

        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  saveVehicleMatrix(): void {
    this.isSavingVehicles = true;
    const payload = {
      warehouse_id: this.selectedWarehouseId,
      date_shamsi: this.selectedDateShamsi,
      client_tab_id: this.wsService.tabId,
      items: this.vehicleRows.map(r => ({
        vehicle_id: r.vehicle_id,
        trip_count: Number(r.trip_count) || 0,
        unit_rate: r.unit_rate || r.default_rate || 0,
        dispatch_reference: r.dispatch_reference || '',
        origin_destination: r.origin_destination || '',
        notes: r.notes || ''
      }))
    };

    this.api.saveVehicleTripsBulk(payload).subscribe({
      next: res => {
        this.isSavingVehicles = false;
        this.vehicleRows.forEach(r => {
          r.is_existing = true;
        });
        this.toast.show('success', res.message || 'اطلاعات ناوگان ذخیره شد');
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.isSavingVehicles = false;
        this.toast.show('error', err?.error?.detail || err?.error?.error || 'خطا در ذخیره تردد ناوگان');
        this.cdr.detectChanges();
      }
    });
  }
}
