import { Component, OnInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { CountTaskApiService } from '../../core/api/count-task-api.service';
import { CountTask } from '../../core/models/count-task.model';
import { ToastService } from '../../services/toast.service';
import { ConfirmDialogService } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { StateService } from '../../services/state.service';
import { AuthStore } from '../../core/stores/auth.store';
import { DataTableComponent, TableColumnDirective, SortState } from '../../shared/components/data-table/data-table.component';
import { PersianDatePipe } from '../../shared/pipes/persian-date.pipe';
import { WarehouseSelectorComponent } from '../../shared/components/warehouse-selector/warehouse-selector.component';
import { WebSocketService } from '../../core/http/websocket.service';

@Component({
  selector: 'app-count-tracking',
  standalone: true,
  imports: [CommonModule, FormsModule, DataTableComponent, TableColumnDirective, PersianDatePipe, WarehouseSelectorComponent],
  templateUrl: './count-tracking.html',
  styleUrl: './count-tracking.css'
})
export class CountTracking implements OnInit, OnDestroy {
  tasks: any[] = [];
  filteredTasks: any[] = [];
  isLoading = true;
  showCompleted = false;
  selectedTaskIds: Set<number> = new Set();

  // ─── Mini Dashboard ───
  statTotal = 0;
  statCounted = 0;
  statDiscrepancy = 0;
  statApproved = 0;

  // ─── فیلتر مغایرت ───
  showOnlyDiscrepancies = false;

  // ─── WebSocket ───
  private wsSub?: Subscription;
  private routerSub?: Subscription;

  // ── متغیرهای جدول و صفحه‌بندی ──
  updatedTaskIds = new Set<number>();
  currentPage = 1;
  pageSize = 50;
  
  getRowClass(row: any): string {
    return this.updatedTaskIds.has(row.id) ? 'status-updated-flash' : '';
  }
  
  visibleCols: string[] = [
    'warehouse_name',
    'fa_unic_code',
    'description',
    'counter',
    'supervisor',
    'manager',
    'status',
    'counted_balance',
    'discrepancy',
    'created_at',
    'updated_at',
    'actions'
  ];

  // ─── فیلتر جدول ───
  tableSearch = '';
  tableFilters: Record<string, string> = {};

  // گزینه‌های فیلتر چک‌باکسی
  warehouseOptions: {label: string, value: string}[] = [];
  counterOptions: {label: string, value: string}[] = [];
  supervisorOptions: {label: string, value: string}[] = [];
  managerOptions: {label: string, value: string}[] = [];
  statusOptions: {label: string, value: string}[] = [
    { label: 'در حال شمارش', value: 'PENDING_COUNT' },
    { label: 'در کارتابل سرپرست', value: 'COUNTED' },
    { label: 'در کارتابل مدیر', value: 'MANAGER_REVIEW' },
    { label: 'مغایرت - ارجاع به انبارگردان', value: 'SUPERVISOR_REJECTED' },
    { label: 'مغایرت - ارجاع به سرپرست', value: 'MANAGER_REJECTED' },
    { label: 'تایید نهایی', value: 'FINAL_APPROVED' }
  ];
  
  // ─── متغیرهای مودال خروجی اکسل ───
  isExportModalOpen = false;
  exportDataScope: 'all' | 'selected' = 'all';
  exportColumnScope: 'all_db' | 'visible' | 'custom' = 'all_db';
  selectedExportColumns: Set<string> = new Set();
  isExporting = false;
  exportSubscription?: Subscription;
  availableExportColumns: {key: string, label: string}[] = [];
  flashTimeout: any;

  public authStore = inject(AuthStore);

  constructor(
    private countTaskApi: CountTaskApiService,
    private toast: ToastService,
    private confirmDialog: ConfirmDialogService,
    private cdr: ChangeDetectorRef,
    public state: StateService,
    private wsService: WebSocketService,
    private router: Router
  ) {}

  ngOnInit() {
    // ── URL State: خواندن پارامترها از آدرس مرورگر ──
    this.syncStateFromUrl();
    this.routerSub = this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd)
    ).subscribe(() => this.syncStateFromUrl());

    this.countTaskApi.getExportColumns().subscribe(cols => {
      this.availableExportColumns = cols;
    });
    // ─── WebSocket: باز کردن اتصال و دریافت خودکار تغییرات ───
    this.wsService.connect();
    this.wsSub = this.wsService.notifications$.subscribe((data: any) => {
      if (data.type === 'count_task_update' || data.event === 'count_task_update') {
        this.loadTasks(false);
      }
    });
  }

  ngOnDestroy() {
    this.wsSub?.unsubscribe();
    this.routerSub?.unsubscribe();
  }

  /** خواندن وضعیت از پارامترهای آدرس مرورگر */
  private syncStateFromUrl() {
    if (!this.router.url.split('?')[0].includes('/count-tracking')) return;
    const params = this.router.parseUrl(this.router.url).queryParams;
    this.showOnlyDiscrepancies = params['discrepancies'] === 'true';
    const page = parseInt(params['page'], 10);
    if (!isNaN(page) && page > 0) this.currentPage = page;
    this.loadTasks();
  }

  toggleCompleted() {
    this.showCompleted = !this.showCompleted;
    this.selectedTaskIds = new Set();
    this.router.navigate([], {
      queryParams: { discrepancies: this.showOnlyDiscrepancies || null, page: 1 },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  loadTasks(showLoading = true) {
    this.selectedTaskIds = new Set();
    if (showLoading) {
      this.isLoading = true;
    }
    const params: any = { as_role: 'tracking', show_completed: this.showCompleted, page_size: 1000 };
    const whId = this.authStore.activeWarehouseId();
    if (whId && whId !== 'ALL' && whId !== -1) {
      params.warehouse_id = whId;
    }
    
    this.countTaskApi.getAll(params).subscribe({
      next: (res: any) => {
        const raw = Array.isArray(res) ? res : (res.results || []);
        
        this.trackUpdates(this.tasks || [], raw);

        // ── Pre-compute: محاسبه یکباره مقادیر سنگین ──
        this.tasks = raw.map((t: any) => {
          t._computed_manager_name = this.getManagerName(t);
          t._computed_counter_dur = this.getStageDuration(t, 'counter');
          t._computed_supervisor_dur = this.getStageDuration(t, 'supervisor');
          t._computed_manager_dur = this.getStageDuration(t, 'manager');
          // ── محاسبه مغایرت ──
          const counted = parseFloat(t.counted_balance);
          const system = parseFloat(t.item_details?.inventory);
          t._discrepancy = (!isNaN(counted) && !isNaN(system)) ? (counted - system) : null;
          return t;
        });
        this.computeStats();
        this.buildFilterOptions();
        this.currentPage = 1;
        this.applyFilters();
        this.isLoading = false;
        
        this.cdr.detectChanges();
      },
      error: () => {
        this.toast.show('error', 'خطا در دریافت لیست تسک‌ها');
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  private trackUpdates(oldList: any[], newList: any[]) {
    const oldMap = new Map(oldList.map((t: any) => [t.id, t]));
    let hasUpdates = false;
    for (const t of newList) {
      const oldItem = oldMap.get(t.id);
      if (!oldItem || oldItem.status !== t.status || oldItem.counted_balance !== t.counted_balance) {
        this.updatedTaskIds.add(t.id);
        hasUpdates = true;
      }
    }
    if (hasUpdates) {
      if (this.flashTimeout) clearTimeout(this.flashTimeout);
      this.flashTimeout = setTimeout(() => {
        this.updatedTaskIds.clear();
        this.cdr.detectChanges();
      }, 4000);
    }
  }

  applyFilters() {
    const globalQ = this.tableSearch?.toLowerCase() || '';
    const filters = this.tableFilters;

    this.filteredTasks = this.tasks.filter(t => {
      // ── فیلتر مغایرت ──
      if (this.showOnlyDiscrepancies) {
        if (t._discrepancy === null || t._discrepancy === 0) return false;
      }

      // ── جستجوی سراسری ──
      if (globalQ) {
        const haystack = [
          t.item_details?.fa_unic_code,
          t.item_details?.description,
          t.counter_name,
          t.supervisor_name,
          t._computed_manager_name,
          t.item_details?.warehouse_name
        ].filter(Boolean).map((v: any) => String(v)).join(' ').toLowerCase();
        if (!haystack.includes(globalQ)) return false;
      }

      // ── فیلتر چک‌باکسی ستون‌ها ──
      // انبار
      if (filters['warehouse_name']) {
        const allowed = filters['warehouse_name'].split(',');
        const val = t.item_details?.warehouse_name || '-';
        if (!allowed.includes(val)) return false;
      }
      // انبارگردان
      if (filters['counter']) {
        const allowed = filters['counter'].split(',');
        const val = t.counter_name || 'نامشخص';
        if (!allowed.includes(val)) return false;
      }
      // سرپرست
      if (filters['supervisor']) {
        const allowed = filters['supervisor'].split(',');
        const val = t.supervisor_name || 'ندارد';
        if (!allowed.includes(val)) return false;
      }
      // مدیریت
      if (filters['manager']) {
        const allowed = filters['manager'].split(',');
        const val = t._computed_manager_name;
        if (!allowed.includes(val)) return false;
      }
      // وضعیت
      if (filters['status']) {
        const allowed = filters['status'].split(',');
        if (!allowed.includes(t.status)) return false;
      }

      // ── فیلتر بازه زمانی (آخرین تغییر) ──
      if (filters['updated_at_after'] && t.updated_at) {
        if (new Date(t.updated_at).getTime() < new Date(filters['updated_at_after']).getTime()) return false;
      }
      if (filters['updated_at_before'] && t.updated_at) {
        if (new Date(t.updated_at).getTime() > new Date(filters['updated_at_before']).getTime()) return false;
      }

      // ── فیلتر بازه زمانی (تاریخ ایجاد) ──
      if (filters['created_at_after'] && t.created_at) {
        if (new Date(t.created_at).getTime() < new Date(filters['created_at_after']).getTime()) return false;
      }
      if (filters['created_at_before'] && t.created_at) {
        if (new Date(t.created_at).getTime() > new Date(filters['created_at_before']).getTime()) return false;
      }

      // ── فیلتر بازه عددی (تعداد شمارش) ──
      if (filters['counted_balance_min']) {
        if (t.counted_balance === null || Number(t.counted_balance) < Number(filters['counted_balance_min'])) return false;
      }
      if (filters['counted_balance_max']) {
        if (t.counted_balance === null || Number(t.counted_balance) > Number(filters['counted_balance_max'])) return false;
      }

      // ── فیلترهای متنی سرستون (_search) ──
      if (filters['warehouse_name_search']) {
        const q = filters['warehouse_name_search'].toLowerCase();
        if (!(t.item_details?.warehouse_name || '').toLowerCase().includes(q)) return false;
      }
      if (filters['counter_search']) {
        const q = filters['counter_search'].toLowerCase();
        if (!(t.counter_name || 'نامشخص').toLowerCase().includes(q)) return false;
      }
      if (filters['supervisor_search']) {
        const q = filters['supervisor_search'].toLowerCase();
        if (!(t.supervisor_name || 'ندارد').toLowerCase().includes(q)) return false;
      }
      if (filters['manager_search']) {
        const q = filters['manager_search'].toLowerCase();
        if (!(t._computed_manager_name || '').toLowerCase().includes(q)) return false;
      }
      if (filters['status_search']) {
        const q = filters['status_search'].toLowerCase();
        if (!this.getStatusName(t.status).toLowerCase().includes(q)) return false;
      }
      // فیلترهای متنی ساده (کد کالا و شرح کالا)
      if (filters['fa_unic_code']) {
        const q = filters['fa_unic_code'].toLowerCase();
        if (!String(t.item_details?.fa_unic_code || '').toLowerCase().includes(q)) return false;
      }
      if (filters['description']) {
        const q = filters['description'].toLowerCase();
        if (!(t.item_details?.description || '').toLowerCase().includes(q)) return false;
      }

      return true;
    });
  }

  // ── محاسبه آمار خطی (Mini Dashboard) ──
  computeStats() {
    this.statTotal = this.tasks.length;
    this.statCounted = this.tasks.filter(t => t.status !== 'PENDING_COUNT').length;
    this.statDiscrepancy = this.tasks.filter(t => t._discrepancy !== null && t._discrepancy !== 0).length;
    this.statApproved = this.tasks.filter(t => t.status === 'FINAL_APPROVED').length;
  }

  // ── فیلتر فقط مغایرت‌ها ──
  toggleDiscrepancyFilter() {
    this.showOnlyDiscrepancies = !this.showOnlyDiscrepancies;
    this.currentPage = 1;
    this.applyFilters();
  }

  // ── سورت کلاینت‌ساید ──
  onSortChanged(sort: SortState) {
    if (!sort.key) return;
    const dir = sort.direction === 'asc' ? 1 : -1;
    const key = sort.key;

    this.filteredTasks.sort((a, b) => {
      let valA = this.resolveSortValue(a, key);
      let valB = this.resolveSortValue(b, key);

      // Handle nulls
      if (valA == null && valB == null) return 0;
      if (valA == null) return 1;
      if (valB == null) return -1;

      // Numeric comparison
      if (typeof valA === 'number' && typeof valB === 'number') {
        return (valA - valB) * dir;
      }

      // String comparison
      return String(valA).localeCompare(String(valB), 'fa') * dir;
    });
    this.currentPage = 1;
  }

  private resolveSortValue(row: any, key: string): any {
    switch (key) {
      case 'warehouse_name': return row.item_details?.warehouse_name || '';
      case 'fa_unic_code': return row.item_details?.fa_unic_code || '';
      case 'description': return row.item_details?.description || '';
      case 'counter': return row.counter_name || '';
      case 'supervisor': return row.supervisor_name || '';
      case 'manager': return row._computed_manager_name || '';
      case 'status': return row.status || '';
      case 'counted_balance': return row.counted_balance != null ? Number(row.counted_balance) : null;
      case 'discrepancy': return row._discrepancy;
      case 'created_at': return row.created_at ? new Date(row.created_at).getTime() : null;
      case 'updated_at': return row.updated_at ? new Date(row.updated_at).getTime() : null;
      default: return row[key];
    }
  }

  // ── تأیید گروهی موارد بدون مغایرت (Manager Approve) ──
  async bulkApproveGreenTasks() {
    // تسک‌هایی که وضعیتشان MANAGER_REVIEW بوده و مغایرت ندارند
    const greenTasks = this.filteredTasks.filter(t =>
      t.status === 'MANAGER_REVIEW' && t._discrepancy !== null && t._discrepancy === 0
    );

    if (greenTasks.length === 0) {
      this.toast.show('warning', 'هیچ تسکی با وضعیت «در کارتابل مدیر» و بدون مغایرت وجود ندارد.');
      return;
    }

    const confirmed = await this.confirmDialog.open({
      title: 'تأیید گروهی مدیر',
      message: `آیا از تأیید نهایی ${greenTasks.length} تسک بدون مغایرت (سبز) اطمینان دارید؟`,
      confirmText: 'بله، تأیید نهایی',
      cancelText: 'انصراف',
      type: 'info'
    });

    if (confirmed) {
      const ids = greenTasks.map((t: any) => t.id);
      this.countTaskApi.bulkManagerApprove(ids).subscribe({
        next: (res) => {
          this.toast.show('success', res.message || `${ids.length} تسک تأیید نهایی شد.`);
          this.loadTasks();
        },
        error: (err) => {
          this.toast.show('error', err?.error?.error || 'خطا در تأیید گروهی');
        }
      });
    }
  }

  // ── ساخت گزینه‌های فیلتر از داده‌های دریافتی ──
  buildFilterOptions() {
    const unique = (arr: string[]) => [...new Set(arr)].sort();

    this.warehouseOptions = unique(
      this.tasks.map(t => t.item_details?.warehouse_name || '-')
    ).map(v => ({ label: v, value: v }));

    this.counterOptions = unique(
      this.tasks.map(t => t.counter_name || 'نامشخص')
    ).map(v => ({ label: v, value: v }));

    this.supervisorOptions = unique(
      this.tasks.map(t => t.supervisor_name || 'ندارد')
    ).map(v => ({ label: v, value: v }));

    this.managerOptions = unique(
      this.tasks.map(t => t._computed_manager_name || 'استخر مشترک')
    ).map(v => ({ label: v, value: v }));
  }

  // ── صفحه‌بندی ──
  get paginatedTasks(): any[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredTasks.slice(start, start + this.pageSize);
  }

  onPageChange(event: { page: number; pageSize: number }) {
    this.currentPage = event.page;
    this.pageSize = event.pageSize;
  }

  onTableSearch(term: string) {
    this.tableSearch = term;
    this.currentPage = 1;
    this.applyFilters();
  }

  onTableFilter(filters: Record<string, string>) {
    this.tableFilters = filters;
    this.currentPage = 1;
    this.applyFilters();
  }

  onFiltersCleared() {
    this.tableSearch = '';
    this.tableFilters = {};
    this.currentPage = 1;
    this.applyFilters();
  }

  onSelectionChange(selectedIds: Set<any>) {
    this.selectedTaskIds = new Set(Array.from(selectedIds).map(id => Number(id)));
  }

  async cancelAllocation() {
    if (this.selectedTaskIds.size === 0) {
      this.toast.show('warning', 'هیچ رکوردی انتخاب نشده است');
      return;
    }

    // فیلتر رکوردهای مجاز (فقط PENDING_COUNT)
    const allowedStatuses = ['PENDING_COUNT'];
    const selectedTasks = this.filteredTasks.filter(t => this.selectedTaskIds.has(t.id));
    const eligibleIds = selectedTasks.filter(t => allowedStatuses.includes(t.status)).map(t => t.id);
    const ineligibleCount = selectedTasks.length - eligibleIds.length;

    if (eligibleIds.length === 0) {
      this.toast.show('warning', 'هیچ‌یک از رکوردهای انتخاب شده قابل لغو تخصیص نیستند. فقط رکوردهای «در انتظار شمارش» مجاز هستند.');
      return;
    }

    let msg = `آیا از لغو تخصیص و برگرداندن ${eligibleIds.length} رکورد به لیست در انتظار شمارش اطمینان دارید؟`;
    if (ineligibleCount > 0) {
      msg += `\n(${ineligibleCount} رکورد به دلیل وضعیت نامعتبر نادیده گرفته می‌شود.)`;
    }

    const confirmed = await this.confirmDialog.open({
      title: 'لغو تخصیص',
      message: msg,
      confirmText: 'بله، لغو تخصیص',
      cancelText: 'انصراف',
      type: 'warning'
    });

    if (confirmed) {
      this.countTaskApi.bulkCancel(eligibleIds).subscribe({
        next: (res) => {
          this.toast.show('success', res.message);
          this.selectedTaskIds = new Set();
          this.loadTasks();
        },
        error: (err) => {
          this.toast.show('error', err?.error?.error || 'خطا در لغو تخصیص');
        }
      });
    }
  }

  async cancelSingleAllocation(task: any) {
    if (task.status !== 'PENDING_COUNT') {
      this.toast.show('warning', 'فقط رکوردهای «در انتظار شمارش» قابل لغو تخصیص هستند.');
      return;
    }

    const confirmed = await this.confirmDialog.open({
      title: 'لغو تخصیص',
      message: `آیا از لغو تخصیص کالای ${task.item_details?.fa_unic_code || ''} اطمینان دارید؟`,
      confirmText: 'بله، لغو تخصیص',
      cancelText: 'انصراف',
      type: 'warning'
    });

    if (confirmed) {
      this.countTaskApi.bulkCancel([task.id]).subscribe({
        next: (res) => {
          this.toast.show('success', 'تخصیص با موفقیت لغو شد');
          // If the task was selected, remove it from selection
          this.selectedTaskIds.delete(task.id);
          this.loadTasks();
        },
        error: (err) => {
          this.toast.show('error', err?.error?.error || 'خطا در لغو تخصیص');
        }
      });
    }
  }

  getStatusName(status: string): string {
    const statusMap: Record<string, string> = {
      'PENDING_COUNT': 'در حال شمارش',
      'COUNTED': 'در کارتابل سرپرست',
      'MANAGER_REVIEW': 'در کارتابل مدیر',
      'SUPERVISOR_REJECTED': 'مغایرت - ارجاع به انبارگردان',
      'MANAGER_REJECTED': 'مغایرت - ارجاع به سرپرست',
      'FINAL_APPROVED': 'تایید نهایی'
    };
    return statusMap[status] || status;
  }

  getStatusClass(status: string): string {
    const classMap: Record<string, string> = {
      'PENDING_COUNT': 'bg-blue-100 text-blue-700 border-blue-200',
      'COUNTED': 'bg-amber-100 text-amber-700 border-amber-200',
      'MANAGER_REVIEW': 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200',
      'SUPERVISOR_REJECTED': 'bg-rose-100 text-rose-700 border-rose-200',
      'MANAGER_REJECTED': 'bg-rose-100 text-rose-700 border-rose-200',
      'FINAL_APPROVED': 'bg-emerald-100 text-emerald-700 border-emerald-200'
    };
    return 'px-2 py-0.5 rounded-full text-[10px] font-bold border ' + (classMap[status] || 'bg-surface text-foreground');
  }

  getBalanceColorClass(row: any): string {
    const counted = parseFloat(row.counted_balance);
    const system = parseFloat(row.item_details?.inventory);
    
    if (isNaN(counted) || isNaN(system)) return 'text-foreground'; // پیش‌فرض
    
    if (counted === system) return 'text-emerald-600'; // بدون مغایرت (سبز)
    
    // محاسبه درصد مغایرت
    let diffPercent = 0;
    if (system === 0) {
       diffPercent = 100; // جلوگیری از تقسیم بر صفر
    } else {
       diffPercent = Math.abs((counted - system) / system) * 100;
    }

    if (diffPercent < 5) return 'text-yellow-500';
    if (diffPercent <= 20) return 'text-orange-500';
    return 'text-rose-600'; // بیشتر از ۲۰٪
  }

  formatDuration(diffMs: number): string {
    if (isNaN(diffMs) || diffMs < 0) return '-';
    
    const diffMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    
    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      if (remainingHours > 0) {
        return `${days} روز و ${remainingHours} ساعت`;
      }
      return `${days} روز`;
    }
    
    if (hours > 0) {
      return `${hours} ساعت و ${mins} دقیقه`;
    }
    
    return `${mins} دقیقه`;
  }

  getStageDuration(task: CountTask, stage: 'counter' | 'supervisor' | 'manager'): string | null {
    if (!task.history || task.history.length === 0) {
      if (stage === 'counter' && task.created_at && task.status === 'PENDING_COUNT') {
         return this.formatDuration(new Date().getTime() - new Date(task.created_at).getTime());
      }
      return null;
    }

    const sortedHistory = [...task.history].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const findDate = (type: string) => {
      const e = sortedHistory.find(h => h.action_type === type);
      return e ? new Date(e.created_at).getTime() : null;
    };

    const taskCreated = new Date(task.created_at).getTime();
    const now = new Date().getTime();

    if (stage === 'counter') {
      const counted = findDate('COUNTED');
      const start = findDate('SUPERVISOR_REJECTED') || taskCreated;
      if (counted && counted > start) return this.formatDuration(counted - start);
      if (task.status === 'PENDING_COUNT' || task.status === 'SUPERVISOR_REJECTED') return this.formatDuration(now - start);
      return null;
    }

    if (stage === 'supervisor') {
      const counted = findDate('COUNTED');
      if (!counted) return null;
      const start = findDate('MANAGER_REJECTED') || counted;
      const mgrReview = findDate('MANAGER_REVIEW');
      const supReject = findDate('SUPERVISOR_REJECTED');
      const end = Math.max(mgrReview || 0, supReject || 0);
      
      if (end && end > start) return this.formatDuration(end - start);
      if (task.status === 'COUNTED' || task.status === 'MANAGER_REJECTED') return this.formatDuration(now - start);
      return null;
    }

    if (stage === 'manager') {
      const mgrReview = findDate('MANAGER_REVIEW');
      if (!mgrReview) return null;
      const approved = findDate('FINAL_APPROVED');
      const mgrReject = findDate('MANAGER_REJECTED');
      const end = Math.max(approved || 0, mgrReject || 0);
      
      if (end && end > mgrReview) return this.formatDuration(end - mgrReview);
      if (task.status === 'MANAGER_REVIEW') return this.formatDuration(now - mgrReview);
      return null;
    }
    return null;
  }

  getManagerName(task: CountTask): string {
    if (task.assigned_manager_name) return task.assigned_manager_name;
    if (task.history && task.history.length > 0) {
      const sortedHistory = [...task.history].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const managerAction = sortedHistory.find(h => h.action_type === 'MANAGER_REVIEW' || h.action_type === 'FINAL_APPROVED' || h.action_type === 'MANAGER_REJECTED');
      if (managerAction && managerAction.action_by_name) {
        return managerAction.action_by_name;
      }
    }
    return 'استخر مشترک';
  }

  // ─── Export Excel Methods ───

  openExportModal() {
    this.isExportModalOpen = true;
    this.exportDataScope = this.selectedTaskIds.size > 0 ? 'selected' : 'all';
    this.exportColumnScope = 'all_db';
    this.selectedExportColumns.clear();
  }

  closeExportModal() {
    this.isExporting = false;
    this.isExportModalOpen = false;
    if (this.exportSubscription) {
      try { this.exportSubscription.unsubscribe(); } catch (e) {}
      this.exportSubscription = undefined;
    }
  }

  onExportDataScopeChange(scope: 'all' | 'selected') {
    this.exportDataScope = scope;
    if (scope === 'all') {
      this.exportColumnScope = 'all_db';
    } else {
      this.exportColumnScope = 'visible';
    }
  }

  toggleExportColumn(key: string) {
    if (this.selectedExportColumns.has(key)) {
      this.selectedExportColumns.delete(key);
    } else {
      this.selectedExportColumns.add(key);
    }
  }

  executeExport() {
    this.isExporting = true;

    const payload: any = {
      data_scope: this.exportDataScope,
      columns_scope: this.exportColumnScope,
      as_role: 'tracking',
      show_completed: this.showCompleted ? 'true' : 'false',
    };

    const whId = this.authStore.activeWarehouseId();
    if (whId && whId !== 'ALL' && whId !== -1) {
      payload.warehouse_id = whId;
    }

    if (this.exportDataScope === 'selected') {
      payload.selected_ids = Array.from(this.selectedTaskIds);
    }

    if (this.exportColumnScope === 'visible') {
      payload.columns_list = this.visibleCols;
    } else if (this.exportColumnScope === 'custom') {
      payload.columns_list = Array.from(this.selectedExportColumns);
    }

    this.exportSubscription = this.countTaskApi.exportExcel(payload).subscribe({
      next: (blob) => {
        try {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `count_tracking_${new Date().getTime()}.xlsx`;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 200);
        } catch (e) {
          console.error('File download error', e);
        }
        this.isExporting = false;
        this.closeExportModal();
        this.toast.show('success', 'فایل اکسل با موفقیت دانلود شد.');
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Export error:', err);
        this.toast.show('error', 'خطا در دانلود فایل اکسل');
        this.isExporting = false;
        this.cdr.detectChanges();
      }
    });
  }
}
