import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { StateService } from '../../../services/state.service';
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
  MonthlyPayrollRecord
} from '../../../core/models/personnel.model';

@Component({
  selector: 'app-personnel-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './personnel-management.html',
  styleUrl: './personnel-management.css'
})
export class PersonnelManagement implements OnInit, OnDestroy {
  // Perspective: 'warehouse' (انباردار) vs 'accountant' (حسابدار)
  portalPerspective: 'warehouse' | 'accountant' = 'accountant';

  // Active Main Tab
  activeTab = 'attendance';
  profileSubTab: 'personnel' | 'vehicles' = 'personnel';
  reportSubTab: 'personnel' | 'fleet' = 'personnel';
  settingsSubTab: 'grades' | 'labor' | 'dsk' | 'tax' | 'bank' = 'grades';

  // Filters & State
  selectedWarehouseId: number | null = null;
  warehouses: any[] = [];
  selectedDateShamsi = '';
  selectedYearMonth = '';
  fiscalYear = '1405';

  // Matrix Attendance
  attendanceRows: AttendanceMatrixRow[] = [];
  isAttendanceLoading = false;
  isSavingAttendance = false;
  isPeriodLocked = false;
  periodStatus = 'OPEN';
  currentPeriodId: number | null = null;

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
    private api: PersonnelApiService,
    private whService: WarehouseHttpService,
    private toast: ToastService,
    private confirmDialog: ConfirmDialogService,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.initDefaultDate();
    this.loadWarehouses();
    this.loadYearlySettings();

    // Check query params if any tab or perspective requested
    this.route.queryParams.subscribe(params => {
      if (params['perspective']) {
        this.portalPerspective = params['perspective'] === 'warehouse' ? 'warehouse' : 'accountant';
      }
      if (params['tab']) {
        this.activeTab = params['tab'];
      }
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
    } catch {
      this.selectedDateShamsi = '1405/04/01';
      this.selectedYearMonth = '1405/04';
      this.fiscalYear = '1405';
    }
  }

  loadWarehouses(): void {
    this.whService.getAll().subscribe({
      next: (whs: any[]) => {
        this.warehouses = whs || [];
        const activeWhId = this.state.appState.activeWarehouseId;
        if (activeWhId && activeWhId !== 'ALL') {
          this.selectedWarehouseId = Number(activeWhId);
        } else if (this.warehouses.length > 0) {
          this.selectedWarehouseId = this.warehouses[0].id;
        }
        this.onWarehouseChange();
        this.cdr.detectChanges();
      },
      error: () => {
        this.toast.show('error', 'خطا در بارگذاری لیست انبارها');
      }
    });
  }

  onWarehouseChange(): void {
    if (!this.selectedWarehouseId) return;
    if (this.activeTab === 'attendance') {
      this.loadAttendanceMatrix();
    } else if (this.activeTab === 'fleet') {
      this.loadVehicleMatrix();
    } else if (this.activeTab === 'payroll') {
      this.loadMonthlyPayroll();
    } else if (this.activeTab === 'reports') {
      this.loadMonthlyReports();
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
    this.activeTab = tab;
    this.onWarehouseChange();
  }

  // ─────────────────────────────────────────────────────────────
  // ۱. حضور و غیاب ماتریسی پرسنل (انباردار)
  // ─────────────────────────────────────────────────────────────
  loadAttendanceMatrix(): void {
    if (!this.selectedWarehouseId || !this.selectedDateShamsi) return;
    this.isAttendanceLoading = true;
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
      this.selectedYearMonth = this.selectedDateShamsi.slice(0, 7);
      if (this.activeTab === 'attendance') this.loadAttendanceMatrix();
      if (this.activeTab === 'fleet') this.loadVehicleMatrix();
    }
  }

  onYearMonthChange(): void {
    if (this.selectedYearMonth) {
      this.fiscalYear = this.selectedYearMonth.split('/')[0];
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

  setAllPresent(): void {
    if (this.isPeriodLocked) return;
    this.attendanceRows.forEach(row => this.setAttendanceStatus(row, 'PRESENT_10H'));
    this.toast.show('info', 'وضعیت تمام پرسنل به حاضر ۱۰ ساعت تغییر یافت.');
  }

  saveAttendanceMatrix(): void {
    if (!this.selectedWarehouseId || !this.selectedDateShamsi) return;
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
    if (!this.selectedWarehouseId || !this.selectedYearMonth) return;
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
    if (!this.selectedWarehouseId || !this.selectedYearMonth) return;
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
