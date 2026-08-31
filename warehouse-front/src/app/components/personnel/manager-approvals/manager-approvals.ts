import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { StateService } from '../../../services/state.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from '../../../services/toast.service';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { PersonnelApiService } from '../../../core/api/personnel-api.service';
import { WarehouseHttpService } from '../../../core/http/warehouse-http.service';
import {
  PersonnelProfile,
  VehicleDriverProfile,
  PersonnelChangeRequest,
  VehicleChangeRequest,
  PayrollYearlySettings
} from '../../../core/models/personnel.model';

@Component({
  selector: 'app-manager-approvals',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './manager-approvals.html',
  styleUrl: './manager-approvals.css'
})
export class ManagerApprovals implements OnInit, OnDestroy {
  // 4 Main Tabs:
  activeTab: 'new_personnel' | 'new_fleet' | 'change_requests' | 'work_periods' = 'new_personnel';
  
  // Status Filters: 'ALL' | 'draft' | 'revision_required' | 'manager_approved' | 'approved' | 'rejected'
  approvalStatusFilter: string = 'draft';
  changeRequestSubTab: 'personnel' | 'vehicles' = 'personnel';
  
  // Warehouse & Date Context
  selectedWarehouseId: number | null = null;
  warehouses: any[] = [];
  fiscalYear = '1405';
  selectedYearMonth = '';

  // Data Collections
  personnelList: PersonnelProfile[] = [];
  vehiclesList: VehicleDriverProfile[] = [];
  personnelChangeRequests: PersonnelChangeRequest[] = [];
  vehicleChangeRequests: VehicleChangeRequest[] = [];
  workPeriods: any[] = [];
  yearlySettings: PayrollYearlySettings | null = null;

  // Loading Indicators
  isLoading = false;
  isSaving = false;

  // Search & Filter
  personnelSearch = '';
  vehicleSearch = '';

  // Diff Modal State
  isDiffModalOpen = false;
  diffTargetType: 'personnel' | 'vehicle' = 'personnel';
  selectedDiffCR: any = null;
  diffFieldRows: Array<{
    field_name: string;
    field_label: string;
    old_value: any;
    new_value: any;
    is_changed: boolean;
  }> = [];

  // Reject / Revision Reason Modal
  isRejectModalOpen = false;
  rejectActionType: 'reject' | 'revision' = 'reject';
  rejectTargetType: 'personnel' | 'vehicle' | 'personnel_cr' | 'vehicle_cr' = 'personnel';
  rejectTargetId: number | null = null;
  rejectTargetName: string = '';
  rejectReasonText: string = '';

  // Edit Personnel Modal State
  isPersonnelModalOpen = false;
  personnelModalTab: 'identity' | 'contract' | 'insurance' | 'allowances' | 'contact' = 'identity';
  editingPersonnel: Partial<PersonnelProfile> = {};

  // Edit Vehicle Modal State
  isVehicleModalOpen = false;
  editingVehicle: Partial<VehicleDriverProfile> = {};

  private querySub!: Subscription;

  constructor(
    public auth: AuthService,
    public state: StateService,
    private api: PersonnelApiService,
    private whService: WarehouseHttpService,
    private toast: ToastService,
    private confirmDialog: ConfirmDialogService,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  get canApprovePersonnelManager(): boolean {
    const p = this.auth.userPermissions();
    return p.includes('perm_approve_personnel_manager') || p.includes('admin_all');
  }

  get canApproveFleetManager(): boolean {
    const p = this.auth.userPermissions();
    return p.includes('perm_approve_fleet_manager') || p.includes('admin_all');
  }

  get pendingPersonnelCount(): number {
    return this.personnelList.filter(p => p.approval_status === 'draft' || p.approval_status === 'revision_required').length;
  }

  get pendingFleetCount(): number {
    return this.vehiclesList.filter(v => v.approval_status === 'draft' || v.approval_status === 'revision_required').length;
  }

  get pendingCRCount(): number {
    const p = this.personnelChangeRequests.filter(cr => cr.status === 'pending_manager').length;
    const v = this.vehicleChangeRequests.filter(cr => cr.status === 'pending_manager').length;
    return p + v;
  }

  get pendingWorkPeriodCount(): number {
    return this.workPeriods.filter(wp => wp.status === 'OPEN' || wp.status === 'REJECTED').length;
  }

  ngOnInit(): void {
    this.whService.getAll().subscribe({
      next: (data: any) => {
        this.warehouses = Array.isArray(data) ? data : [];
      },
      error: () => {}
    });

    this.api.getYearlySettings(this.fiscalYear).subscribe({
      next: (res: any) => { this.yearlySettings = res; },
      error: () => {}
    });

    // Listen to query params for two-way state syncing
    this.querySub = this.route.queryParams.subscribe(params => {
      if (params['tab'] && ['new_personnel', 'new_fleet', 'change_requests', 'work_periods'].includes(params['tab'])) {
        this.activeTab = params['tab'];
      }
      if (params['status']) {
        this.approvalStatusFilter = params['status'];
      }
      if (params['wh']) {
        this.selectedWarehouseId = params['wh'] === 'ALL' ? null : Number(params['wh']);
      }
      if (params['cr_type'] && ['personnel', 'vehicles'].includes(params['cr_type'])) {
        this.changeRequestSubTab = params['cr_type'];
      }
      this.refreshCurrentTabData();
    });
  }

  ngOnDestroy(): void {
    if (this.querySub) {
      this.querySub.unsubscribe();
    }
  }

  setTab(tab: 'new_personnel' | 'new_fleet' | 'change_requests' | 'work_periods'): void {
    this.activeTab = tab;
    this.updateQueryParams();
  }

  setStatusFilter(status: string): void {
    this.approvalStatusFilter = status;
    this.updateQueryParams();
  }

  setCRSubTab(subTab: 'personnel' | 'vehicles'): void {
    this.changeRequestSubTab = subTab;
    this.updateQueryParams();
  }

  onWarehouseChange(): void {
    this.updateQueryParams();
  }

  private updateQueryParams(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        tab: this.activeTab,
        status: this.approvalStatusFilter,
        wh: this.selectedWarehouseId !== null ? this.selectedWarehouseId : undefined,
        cr_type: this.activeTab === 'change_requests' ? this.changeRequestSubTab : undefined
      },
      queryParamsHandling: 'merge'
    });
  }

  refreshCurrentTabData(): void {
    if (this.activeTab === 'new_personnel') {
      this.loadPersonnel();
    } else if (this.activeTab === 'new_fleet') {
      this.loadVehicles();
    } else if (this.activeTab === 'change_requests') {
      this.loadChangeRequests();
    } else if (this.activeTab === 'work_periods') {
      this.loadWorkPeriods();
    }
  }

  // ─── 1. Personnel Operations ──────────────────────────────
  loadPersonnel(): void {
    this.isLoading = true;
    const filterStatus = this.approvalStatusFilter === 'ALL' ? undefined : this.approvalStatusFilter;
    this.api.getPersonnelProfiles({
      warehouse_id: this.selectedWarehouseId || undefined,
      approval_status: filterStatus
    }).subscribe({
      next: (res: any) => {
        this.personnelList = Array.isArray(res) ? res : (res?.results || []);
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.isLoading = false;
        this.toast.show('error', err?.error?.error || 'خطا در دریافت لیست پرسنل');
        this.cdr.detectChanges();
      }
    });
  }

  get filteredPersonnel(): PersonnelProfile[] {
    let list = this.personnelList;
    if (this.approvalStatusFilter !== 'ALL') {
      list = list.filter(p => p.approval_status === this.approvalStatusFilter);
    }
    if (this.personnelSearch.trim()) {
      const q = this.personnelSearch.trim().toLowerCase();
      list = list.filter(p =>
        (p.first_name && p.first_name.toLowerCase().includes(q)) ||
        (p.last_name && p.last_name.toLowerCase().includes(q)) ||
        (p.full_name && p.full_name.toLowerCase().includes(q)) ||
        (p.national_code && p.national_code.includes(q))
      );
    }
    return list;
  }

  approvePersonnelManager(p: PersonnelProfile): void {
    if (!p.id) return;
    this.api.approvePersonnelManager(p.id).subscribe({
      next: (res: any) => {
        this.toast.show('success', res.message || 'تایید مرحله اول مدیر با موفقیت ثبت شد.');
        this.loadPersonnel();
      },
      error: (err: any) => {
        this.toast.show('error', err?.error?.error || 'خطا در ثبت تایید مدیر');
      }
    });
  }

  // ─── 2. Fleet Operations ──────────────────────────────────
  loadVehicles(): void {
    this.isLoading = true;
    const filterStatus = this.approvalStatusFilter === 'ALL' ? undefined : this.approvalStatusFilter;
    this.api.getVehicleProfiles({
      warehouse_id: this.selectedWarehouseId || undefined,
      approval_status: filterStatus
    }).subscribe({
      next: (res: any) => {
        this.vehiclesList = Array.isArray(res) ? res : (res?.results || []);
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.isLoading = false;
        this.toast.show('error', err?.error?.error || 'خطا در دریافت لیست ناوگان');
        this.cdr.detectChanges();
      }
    });
  }

  get filteredVehicles(): VehicleDriverProfile[] {
    let list = this.vehiclesList;
    if (this.approvalStatusFilter !== 'ALL') {
      list = list.filter(v => v.approval_status === this.approvalStatusFilter);
    }
    if (this.vehicleSearch.trim()) {
      const q = this.vehicleSearch.trim().toLowerCase();
      list = list.filter(v =>
        (v.driver_name && v.driver_name.toLowerCase().includes(q)) ||
        (v.plate_number && v.plate_number.includes(q)) ||
        (v.driver_national_code && v.driver_national_code.includes(q))
      );
    }
    return list;
  }

  approveVehicleManager(v: VehicleDriverProfile): void {
    if (!v.id) return;
    this.api.approveVehicleManager(v.id).subscribe({
      next: (res: any) => {
        this.toast.show('success', res.message || 'تایید مرحله اول ناوگان با موفقیت ثبت شد.');
        this.loadVehicles();
      },
      error: (err: any) => {
        this.toast.show('error', err?.error?.error || 'خطا در ثبت تایید ناوگان');
      }
    });
  }

  // ─── 3. Change Requests (Diff Viewer) ──────────────────────
  loadChangeRequests(): void {
    this.isLoading = true;
    if (this.changeRequestSubTab === 'personnel') {
      this.api.getPersonnelChangeRequests().subscribe({
        next: (res: any) => {
          this.personnelChangeRequests = Array.isArray(res) ? res : (res?.results || []);
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: () => { this.isLoading = false; }
      });
    } else {
      this.api.getVehicleChangeRequests().subscribe({
        next: (res: any) => {
          this.vehicleChangeRequests = Array.isArray(res) ? res : (res?.results || []);
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: () => { this.isLoading = false; }
      });
    }
  }

  openDiffModal(cr: any, type: 'personnel' | 'vehicle'): void {
    this.diffTargetType = type;
    this.selectedDiffCR = cr;
    this.diffFieldRows = [];

    const changes = cr.changes_payload || cr.proposed_changes || {};
    const labels: { [k: string]: string } = {
      first_name: 'نام',
      last_name: 'نام خانوادگی',
      national_code: 'کد ملی',
      father_name: 'نام پدر',
      daily_base_wage: 'مزد روزانه پایه',
      daily_seniority_bonus: 'پایه سنواتی روزانه',
      base_daily_rate: 'مزد مبنا روزانه',
      job_title: 'سمت شغلی',
      job_grade: 'گروه شغلی',
      contract_type: 'نوع قرارداد',
      sheba_number: 'شماره شبا',
      account_number: 'شماره حساب',
      bank_name: 'نام بانک',
      driver_name: 'نام راننده',
      plate_number: 'شماره پلاک',
      vehicle_type: 'نوع خودرو',
      default_service_rate: 'نرخ پایه هر سرویس',
      driver_phone: 'شماره تماس',
      ownership_type: 'نوع مالکیت'
    };

    for (const key of Object.keys(changes)) {
      const item = changes[key];
      this.diffFieldRows.push({
        field_name: key,
        field_label: labels[key] || key,
        old_value: item?.old ?? '—',
        new_value: item?.new ?? '—',
        is_changed: String(item?.old) !== String(item?.new)
      });
    }

    this.isDiffModalOpen = true;
  }

  approveChangeRequestManager(cr: any, type: 'personnel' | 'vehicle'): void {
    const req$ = type === 'personnel'
      ? this.api.approvePersonnelChangeRequestManager(cr.id)
      : this.api.approveVehicleChangeRequestManager(cr.id);

    req$.subscribe({
      next: (res: any) => {
        this.toast.show('success', res.message || 'تایید مرحله اول تغییرات با موفقیت ثبت شد.');
        this.isDiffModalOpen = false;
        this.loadChangeRequests();
      },
      error: (err: any) => {
        this.toast.show('error', err?.error?.error || 'خطا در تایید تغییرات');
      }
    });
  }

  // ─── 4. Work Periods ───────────────────────────────────────
  loadWorkPeriods(): void {
    this.isLoading = true;
    this.api.getAttendanceMonthlySummary(this.selectedWarehouseId, this.fiscalYear + '/04').subscribe({
      next: (res: any) => {
        this.workPeriods = [{
          id: 1,
          warehouse_name: 'سراسری شرکت',
          year_month: res.year_month || (this.fiscalYear + '/04'),
          status: res.period_status || 'OPEN',
          status_display: res.period_status === 'LOCKED' ? 'قفل شده' : 'باز',
          submitted_at: new Date()
        }];
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.isLoading = false; }
    });
  }

  submitPeriodForFinance(wp: any): void {
    this.api.periodWorkflowAction({
      warehouse_id: this.selectedWarehouseId,
      year_month: wp.year_month,
      action: 'submit'
    }).subscribe({
      next: (res: any) => {
        this.toast.show('success', res.message || 'دوره کارکرد جهت بررسی مالی با موفقیت ارسال شد.');
        this.loadWorkPeriods();
      },
      error: (err: any) => {
        this.toast.show('error', err?.error?.error || 'خطا در ارسال دوره کارکرد');
      }
    });
  }

  reopenPeriod(wp: any): void {
    this.api.periodWorkflowAction({
      warehouse_id: this.selectedWarehouseId,
      year_month: wp.year_month,
      action: 'unlock'
    }).subscribe({
      next: (res: any) => {
        this.toast.show('info', res.message || 'دوره کارکرد جهت ویرایش بازگشایی شد.');
        this.loadWorkPeriods();
      },
      error: (err: any) => {
        this.toast.show('error', err?.error?.error || 'خطا در بازگشایی دوره');
      }
    });
  }

  // ─── Reject / Revision Modal ──────────────────────────────
  openProfileRejectModal(id: number, name: string, type: 'personnel' | 'vehicle' | 'personnel_cr' | 'vehicle_cr', action: 'reject' | 'revision'): void {
    this.rejectTargetId = id;
    this.rejectTargetName = name;
    this.rejectTargetType = type;
    this.rejectActionType = action;
    this.rejectReasonText = '';
    this.isRejectModalOpen = true;
  }

  confirmProfileRejectOrRevision(): void {
    if (!this.rejectTargetId) return;
    if (this.rejectActionType === 'revision' && !this.rejectReasonText.trim()) {
      this.toast.show('warning', 'ثبت دلیل برای ارجاع به بازنگری الزامی است.');
      return;
    }

    const id = this.rejectTargetId;
    const reason = this.rejectReasonText.trim();
    const action = this.rejectActionType;
    const type = this.rejectTargetType;

    let req$: any;
    if (type === 'personnel') {
      req$ = action === 'reject' ? this.api.rejectPersonnel(id, reason) : this.api.requestPersonnelRevision(id, reason);
    } else if (type === 'vehicle') {
      req$ = action === 'reject' ? this.api.rejectVehicle(id, reason) : this.api.requestVehicleRevision(id, reason);
    } else if (type === 'personnel_cr') {
      req$ = this.api.rejectPersonnelChangeRequest(id, reason);
    } else if (type === 'vehicle_cr') {
      req$ = this.api.rejectVehicleChangeRequest(id, reason);
    }

    if (req$) {
      req$.subscribe({
        next: (res: any) => {
          this.toast.show('info', res.message || 'عملیات با موفقیت انجام شد.');
          this.isRejectModalOpen = false;
          this.isDiffModalOpen = false;
          this.refreshCurrentTabData();
        },
        error: (err: any) => {
          this.toast.show('error', err?.error?.error || 'خطا در اجرای عملیات');
        }
      });
    }
  }

  // ─── Edit Personnel Modal ─────────────────────────────────
  openEditPersonnelModal(p: PersonnelProfile): void {
    this.editingPersonnel = JSON.parse(JSON.stringify(p));
    this.personnelModalTab = 'identity';
    this.isPersonnelModalOpen = true;
  }

  setPersonnelTab(tab: 'identity' | 'contract' | 'insurance' | 'allowances' | 'contact'): void {
    this.personnelModalTab = tab;
  }

  savePersonnelProfile(): void {
    if (!this.editingPersonnel.id) return;
    this.isSaving = true;
    this.api.updatePersonnelProfile(this.editingPersonnel.id, this.editingPersonnel).subscribe({
      next: (res: any) => {
        this.isSaving = false;
        this.isPersonnelModalOpen = false;
        this.toast.show('success', res.message || 'اطلاعات پرسنل با موفقیت ثبت شد.');
        this.loadPersonnel();
      },
      error: (err: any) => {
        this.isSaving = false;
        this.toast.show('error', err?.error?.error || 'خطا در ویرایش پرسنل');
      }
    });
  }

  // ─── Edit Vehicle Modal ───────────────────────────────────
  openEditVehicleModal(v: VehicleDriverProfile): void {
    this.editingVehicle = JSON.parse(JSON.stringify(v));
    this.isVehicleModalOpen = true;
  }

  saveVehicleProfile(): void {
    if (!this.editingVehicle.id) return;
    this.isSaving = true;
    this.api.updateVehicleProfile(this.editingVehicle.id, this.editingVehicle).subscribe({
      next: (res: any) => {
        this.isSaving = false;
        this.isVehicleModalOpen = false;
        this.toast.show('success', res.message || 'اطلاعات ناوگان با موفقیت ثبت شد.');
        this.loadVehicles();
      },
      error: (err: any) => {
        this.isSaving = false;
        this.toast.show('error', err?.error?.error || 'خطا در ویرایش ناوگان');
      }
    });
  }

  // ─── Helper Formatting ────────────────────────────────────
  getApprovalBadgeClass(status?: string): string {
    switch (status) {
      case 'approved': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'manager_approved': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'draft': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'revision_required': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'rejected': return 'bg-rose-50 text-rose-700 border-rose-200';
      default: return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  }

  getApprovalStatusTitle(status?: string): string {
    switch (status) {
      case 'approved': return 'تایید نهایی';
      case 'manager_approved': return 'تایید مدیر (در انتظار حسابدار)';
      case 'draft': return 'پیش‌نویس (در انتظار تایید مدیر)';
      case 'revision_required': return 'نیازمند بازنگری و اصلاح';
      case 'rejected': return 'رد شده';
      default: return status || '—';
    }
  }
}
