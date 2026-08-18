import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy, ViewChild, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CountTaskApiService } from '../../../core/api/count-task-api.service';
import { ItemApiService } from '../../../core/api/item-api.service';
import { DynamicFieldApiService } from '../../../core/api/dynamic-field-api.service';
import { SettingsService } from '../../../services/settings';
import { CountTask, CountTaskStatus, CountTaskHistory } from '../../../core/models/count-task.model';
import { ToastService } from '../../../services/toast.service';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { StateService } from '../../../services/state.service';
import { WarehouseSelectorComponent } from '../../../shared/components/warehouse-selector/warehouse-selector.component';
import { OfflinePendingBadgeComponent } from '../../../shared/components/offline-pending-badge/offline-pending-badge.component';
import { AuthService } from '../../../core/auth/auth.service';
import { AuthStore } from '../../../core/stores/auth.store';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { Subject, Subscription, filter } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { CountTaskStore } from '../../../core/services/count-task-store';
import { offlineDb } from '../../../core/services/offline-db';
import { OfflineSyncService } from '../../../core/services/offline-sync.service';
import { BarcodeScannerComponent } from '../../../shared/components/barcode-scanner/barcode-scanner.component';
import { WebSocketService } from '../../../core/http/websocket.service';
import { 
  FieldPermissionConfig, 
  mergeFieldPermissions 
} from '../../../core/models/field-config.model';

@Component({
  selector: 'app-counter-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, WarehouseSelectorComponent, OfflinePendingBadgeComponent, BarcodeScannerComponent],
  templateUrl: './counter-dashboard.html',
  styleUrl: './counter-dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CounterDashboard implements OnInit {
  tasks: CountTask[] = [];
  poolTasks: CountTask[] = [];
  isLoading = true;
  selectedTask: CountTask | null = null;
  selectedTasks = new Set<number>();
  selectedPoolTasks = new Set<number>();
  currentTab: 'my-tasks' | 'pool' = 'my-tasks';
  isSubmitting = false;
  
  // Detail view state
  countedBalanceStr: string = '';
  counterNote: string = '';

  // ── Dynamic Field Permissions State ────────────────────────────────────────
  fieldConfigs: FieldPermissionConfig[] = [];
  editableValues: Record<string, any> = {};
  dynamicFieldsList: any[] = [];

  // Stats & Filters
  totalTasksCount = 0;
  completedTasksCount = 0;
  remainingTasksCount = 0;
  filteredTasks: CountTask[] = [];
  pendingTasks: CountTask[] = [];
  readyToSubmitCount = 0;

  // New Filters & Defaults
  dateFilter: 'today' | 'yesterday' | 'week' | 'all' = 'all';
  statusFilter: 'pending' | 'initial' | 'completed' | 'recount' | 'all' = 'all';
  searchQuery: string = '';
  searchSubject = new Subject<string>();
  private initialLoadDone = false;

  // Smart Sorting
  sortField: 'created_at' | 'updated_at' | 'location' | 'recount_first' | 'code' | 'title' = 'updated_at';
  sortDirection: 'asc' | 'desc' = 'desc';
  isSortMenuOpen = false;

  // Status Counts for Chips
  statusCounts = {
    all: 0,
    pending: 0,
    initial: 0,
    recount: 0,
    completed: 0
  };

  updatedTaskIds = new Set<number>();
  flashTimeout: any;

  private pushSub?: Subscription;
  private pullSub?: Subscription;
  private wsSub?: Subscription;
  private routerSub?: Subscription;
  private swrSub?: Subscription;
  private offlineSync = OfflineSyncService.getInstance();

  @ViewChild(BarcodeScannerComponent) scanner?: BarcodeScannerComponent;
  private scanBusy = false;
  private barcodeBuffer = '';
  private lastKeyTime = 0;

  // Export Modal State
  isExportModalOpen = false;
  exportDataScope: 'all' | 'selected' = 'all';
  exportColumnScope: 'all_db' | 'visible' | 'custom' = 'all_db';
  selectedExportColumns: Set<string> = new Set();
  isExporting = false;
  exportSubscription?: Subscription;
  availableExportColumns: {key: string, label: string}[] = [];

  constructor(
    private countTaskApi: CountTaskApiService,
    private itemApi: ItemApiService,
    private dynamicFieldApi: DynamicFieldApiService,
    private settingsService: SettingsService,
    private toast: ToastService,
    private confirmDialog: ConfirmDialogService,
    private cdr: ChangeDetectorRef,
    public state: StateService,
    public authStore: AuthStore,
    private auth: AuthService,
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute,
    private store: CountTaskStore,
    private wsService: WebSocketService
  ) {
    this.searchSubject.pipe(debounceTime(400), distinctUntilChanged()).subscribe(() => {
      this.updateUrlState();
    });
  }

  // ─── Local-First ───

  /** انبار فعال به‌صورت عددی؛ null یعنی «همه/نامشخص» → مسیر Local-First غیرفعال */
  private get activeWarehouseId(): number | null {
    const whId = this.state.appState.activeWarehouseId;
    if (whId && whId !== 'ALL' && Number(whId) !== -1) return Number(whId);
    return null;
  }

  /** Local-First فقط با feature flag روشن + انبار مشخص + کاربر شناخته‌شده */
  private get localFirst(): boolean {
    return (
      (environment as any).useLocalFirstCounting === true &&
      this.activeWarehouseId !== null &&
      this.currentUserId !== null
    );
  }

  private get currentUserId(): number | null {
    const id = this.auth.user()?.id;
    return typeof id === 'number' ? id : null;
  }

  ngOnInit() {
    this.loadFieldPermissions();

    // پس از هر Pull موفق (خودکار یا دستی)، لیست از Dexie تازه شود
    this.pullSub = this.store.pull.pullCompleted$.subscribe(({ warehouseId }) => {
      if (this.localFirst && warehouseId === this.activeWarehouseId && !this.selectedTask) {
        this.readFromLocal(false);
      }
    });

    this.wsService.connect();
    this.wsSub = this.wsService.notifications$.subscribe((data: any) => {
      if (data.type === 'count_task_update' || data.event === 'count_task_update') {
        this.refreshCurrentTab();
        if (this.currentTab !== 'pool') {
          this.fetchPoolTasksSilently();
        }
      }
    });

    // ── URL State: خواندن پارامترها از آدرس مرورگر ──
    this.syncStateFromUrl();
    this.routerSub = this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd)
    ).subscribe(() => this.syncStateFromUrl());

    // ─── SWR Live Revalidation: دریافت داده‌های جدیدتر سرور در پس‌زمینه با تطبیق دقیق نقش شمارشگر ───
    this.swrSub = this.offlineSync.liveDataUpdates$.subscribe(({ url, data }) => {
      const isCounterUrl = url.includes('/api/inventory/count-tasks/') &&
        (url.includes('as_role=counter') || (!url.includes('as_role=supervisor') && !url.includes('as_role=manager') && !url.includes('as_role=tracking')));
      if (isCounterUrl && data) {
        const freshList = Array.isArray(data) ? data : data.results || [];
        if (freshList.length > 0 && this.currentTab === 'my-tasks' && !this.selectedTask) {
          this.trackUpdates(this.tasks, freshList);
          this.tasks = freshList;
          this.applyFilters();
          this.cdr.detectChanges();
          console.log('[CounterDashboard] ⚡ داده‌های انبارگردان با استعلام پس‌زمینه SWR به‌روزرسانی شد.');
        }
      }
    });
  }

  ngOnDestroy() {
    this.pushSub?.unsubscribe();
    this.pullSub?.unsubscribe();
    this.wsSub?.unsubscribe();
    this.routerSub?.unsubscribe();
    this.swrSub?.unsubscribe();
  }

  refreshCurrentTab() {
    if (this.currentTab === 'my-tasks') this.loadTasks(false);
    else if (this.currentTab === 'pool') this.loadPoolTasks(false);
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
    const hasCountedVal = (t: CountTask) => t.counted_balance !== null && t.counted_balance !== undefined;
    const isPending = (t: CountTask) => t.status === 'PENDING_COUNT' && !hasCountedVal(t);
    const isInitial = (t: CountTask) => t.status === 'INITIAL_COUNT' || (t.status === 'PENDING_COUNT' && hasCountedVal(t));
    const isRecount = (t: CountTask) => t.status === 'SUPERVISOR_REJECTED' || t.status === 'MANAGER_REJECTED';
    const isCompleted = (t: CountTask) => t.status !== 'PENDING_COUNT' && t.status !== 'INITIAL_COUNT' && t.status !== 'SUPERVISOR_REJECTED' && t.status !== 'MANAGER_REJECTED';
    const isRemaining = (t: CountTask) => !isCompleted(t);

    this.totalTasksCount = this.tasks.length;
    this.completedTasksCount = this.tasks.filter(isCompleted).length;
    this.remainingTasksCount = this.tasks.filter(isRemaining).length;
    this.pendingTasks = this.tasks.filter(isRemaining);
    this.readyToSubmitCount = this.pendingTasks.filter(t => t.status === 'INITIAL_COUNT' || (t.status === 'PENDING_COUNT' && hasCountedVal(t))).length;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = today - 86400000;
    const week = today - 7 * 86400000;

    const query = (this.searchQuery || '').toLowerCase().trim();
    const normQuery = this.normalizeDigits(query);

    // فیلتر اولیه بر اساس زمان و متن جستجو جهت شمارش زنده چیپ‌ها
    const matchesSearchAndDate = (t: CountTask) => {
      // Date Filter: مقایسه با آخرین زمان فعالیت (updated_at) یا زمان ایجاد
      let matchDate = true;
      const dateStr = (t as any).updated_at || t.created_at;
      if (dateStr && this.dateFilter !== 'all') {
        const taskDate = new Date(dateStr).getTime();
        if (this.dateFilter === 'today') matchDate = taskDate >= today;
        else if (this.dateFilter === 'yesterday') matchDate = taskDate >= yesterday && taskDate < today;
        else if (this.dateFilter === 'week') matchDate = taskDate >= week;
      }
      if (!matchDate) return false;

      // Search Filter
      if (query) {
        return (t.item_details?.fa_unic_code?.toLowerCase().includes(query) || false) || 
               (t.item_details?.fa_unic_code?.toLowerCase().includes(normQuery) || false) ||
               (t.item_details?.description?.toLowerCase().includes(query) || false) ||
               (t.item_details?.po?.toLowerCase().includes(query) || false) ||
               (t.item_details?.new_location?.toLowerCase().includes(query) || false) ||
               (t.item_details?.old_location?.toLowerCase().includes(query) || false);
      }
      return true;
    };

    const contextTasks = this.tasks.filter(matchesSearchAndDate);

    // به‌روزرسانی زنده شمارنده تمام چیپ‌ها بر اساس نتایج جستجو
    this.statusCounts = {
      all: contextTasks.length,
      pending: contextTasks.filter(isPending).length,
      initial: contextTasks.filter(isInitial).length,
      recount: contextTasks.filter(isRecount).length,
      completed: contextTasks.filter(isCompleted).length
    };

    this.filteredTasks = contextTasks.filter(t => {
      if (this.statusFilter === 'pending') return isPending(t);
      if (this.statusFilter === 'initial') return isInitial(t);
      if (this.statusFilter === 'recount') return isRecount(t);
      if (this.statusFilter === 'completed') return isCompleted(t);
      return true;
    });

    // Apply Smart Sorting
    this.filteredTasks.sort((a, b) => {
      let result = 0;
      if (this.sortField === 'created_at') {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : (a.id || 0);
        const timeB = b.created_at ? new Date(b.created_at).getTime() : (b.id || 0);
        result = timeA - timeB;
      } else if (this.sortField === 'updated_at') {
        const timeA = (a as any).updated_at ? new Date((a as any).updated_at).getTime() : (a.created_at ? new Date(a.created_at).getTime() : (a.id || 0));
        const timeB = (b as any).updated_at ? new Date((b as any).updated_at).getTime() : (b.created_at ? new Date(b.created_at).getTime() : (b.id || 0));
        result = timeA - timeB;
      } else if (this.sortField === 'location') {
        const locA = a.item_details?.new_location || a.item_details?.old_location || '';
        const locB = b.item_details?.new_location || b.item_details?.old_location || '';
        result = locA.localeCompare(locB, undefined, { numeric: true, sensitivity: 'base' });
      } else if (this.sortField === 'recount_first') {
        const isRecountA = (a.status === 'SUPERVISOR_REJECTED' || a.status === 'MANAGER_REJECTED') ? 0 : 1;
        const isRecountB = (b.status === 'SUPERVISOR_REJECTED' || b.status === 'MANAGER_REJECTED') ? 0 : 1;
        if (isRecountA !== isRecountB) {
          result = isRecountA - isRecountB;
        } else {
          const locA = a.item_details?.new_location || '';
          const locB = b.item_details?.new_location || '';
          result = locA.localeCompare(locB, undefined, { numeric: true, sensitivity: 'base' });
        }
      } else if (this.sortField === 'code') {
        const codeA = a.item_details?.fa_unic_code || '';
        const codeB = b.item_details?.fa_unic_code || '';
        result = codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
      } else if (this.sortField === 'title') {
        const titleA = a.item_details?.description || '';
        const titleB = b.item_details?.description || '';
        result = titleA.localeCompare(titleB, 'fa', { sensitivity: 'base' });
      }

      return this.sortDirection === 'asc' ? result : -result;
    });
  }

  setDateFilter(filter: 'today' | 'yesterday' | 'week' | 'all') {
    this.dateFilter = filter;
    this.applyFilters();
    this.updateUrlState();
    this.cdr.detectChanges();
  }

  setStatusFilter(filter: 'pending' | 'initial' | 'completed' | 'recount' | 'all') {
    this.statusFilter = filter;
    this.applyFilters();
    this.updateUrlState();
    this.cdr.detectChanges();
  }

  setSort(field: 'created_at' | 'updated_at' | 'location' | 'recount_first' | 'code' | 'title') {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = (field === 'created_at' || field === 'updated_at') ? 'desc' : 'asc';
    }
    this.isSortMenuOpen = false;
    this.applyFilters();
    this.updateUrlState();
    this.cdr.detectChanges();
  }

  toggleSortDirection() {
    this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    this.applyFilters();
    this.updateUrlState();
    this.cdr.detectChanges();
  }

  toggleSortMenu(event?: Event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.isSortMenuOpen = !this.isSortMenuOpen;
    this.cdr.detectChanges();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    if (this.isSortMenuOpen) {
      this.isSortMenuOpen = false;
      this.cdr.detectChanges();
    }
  }

  getSortLabel(): string {
    switch (this.sortField) {
      case 'updated_at': return 'آخرین تغییر';
      case 'created_at': return 'زمان تخصیص';
      case 'location': return 'مسیر لوکیشن';
      case 'recount_first': return 'اولویت بازشماری';
      case 'code': return 'کد کالا';
      case 'title': return 'شرح کالا';
      default: return 'مرتب‌سازی';
    }
  }

  trackByTaskId(index: number, task: CountTask): number {
    return task.id ?? (task as any)._offlineId ?? index;
  }

  /**
   * Local-First: خواندن فوری از Dexie (حتی آفلاین) — سپس Pull دلتا در پس‌زمینه.
   */
  private async readFromLocal(showLoading = true) {
    const whId = this.activeWarehouseId!;
    const userId = this.currentUserId!;
    if (showLoading) {
      this.isLoading = true;
      this.cdr.detectChanges();
    }
    try {
      if (this.currentTab === 'my-tasks') {
        const newTasks = await this.store.getMyTasks(whId, userId);
        this.trackUpdates(this.tasks, newTasks);
        this.tasks = newTasks;
        this.applyFilters();
      } else {
        const newPoolTasks = await this.store.getPoolTasks(whId);
        this.trackUpdates(this.poolTasks, newPoolTasks);
        this.poolTasks = newPoolTasks;
      }
    } catch (e) {
      console.error('[CounterDashboard] خطا در خواندن از Dexie:', e);
    }
    this.isLoading = false;
    this.cdr.detectChanges();
  }

  loadTasks(showLoading = true) {
    if (this.localFirst) {
      this.readFromLocal(showLoading);
      this.store.refresh(this.activeWarehouseId!);
      return;
    }
    if (showLoading) {
      this.isLoading = true;
      this.cdr.detectChanges();
    }
    const params: any = { as_role: 'counter', page_size: 1000 };
    const whId = this.state.appState.activeWarehouseId;
    if (whId && whId !== 'ALL' && whId !== -1) {
      params.warehouse_id = whId;
    }
    
    this.countTaskApi.getAll(params).subscribe({
      next: (res: any) => {
        try {
          let newTasks = Array.isArray(res) ? res : (res.results || []);
          if (!Array.isArray(newTasks)) {
             newTasks = [];
          }
          this.trackUpdates(this.tasks, newTasks);
          this.tasks = newTasks;
          this.applyFilters();
        } catch (e) {
          console.error('Error assigning tasks:', e);
          this.tasks = [];
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.toast.error('خطا در دریافت اطلاعات');
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadPoolTasks(showLoading = true) {
    if (this.localFirst) {
      this.readFromLocal(showLoading);
      this.store.refresh(this.activeWarehouseId!);
      return;
    }
    if (showLoading) {
      this.isLoading = true;
      this.cdr.detectChanges();
    }
    const params: any = { as_role: 'counter', page_size: 1000 };
    const whId = this.state.appState.activeWarehouseId;
    if (whId && whId !== 'ALL' && whId !== -1) {
      params.warehouse_id = whId;
    }
    
    this.http.get<CountTask[]>(`${environment.apiUrl}/inventory/count-tasks/pool_tasks/`, { params }).subscribe({
      next: (res: any) => {
        const newPoolTasks = Array.isArray(res) ? res : (res.results || []);
        this.trackUpdates(this.poolTasks, newPoolTasks);
        this.poolTasks = newPoolTasks;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.toast.error('خطا در دریافت تسک‌های استخر');
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  /** به‌روزرسانی پارامترهای آدرس مرورگر */
  private updateUrlState() {
    const defaultSortDir = (this.sortField === 'created_at' || this.sortField === 'updated_at') ? 'desc' : 'asc';
    const queryParams: any = {
      tab: this.currentTab !== 'my-tasks' ? this.currentTab : null,
      q: this.searchQuery ? this.searchQuery : null,
      status: this.statusFilter !== 'pending' ? this.statusFilter : null,
      date: this.dateFilter !== 'all' ? this.dateFilter : null,
      sort: this.sortField !== 'updated_at' ? this.sortField : null,
      sortDir: this.sortDirection !== defaultSortDir ? this.sortDirection : null
    };
    this.router.navigate([], { queryParams, queryParamsHandling: 'merge', replaceUrl: true });
  }

  /** خواندن وضعیت فیلترها از پارامترهای آدرس مرورگر */
  private syncStateFromUrl() {
    if (!this.router.url.split('?')[0].includes('/counter')) return;
    const params = this.router.parseUrl(this.router.url).queryParams;
    
    // 1. Sync Tab
    const tab = params['tab'] as typeof this.currentTab;
    const validTabs: typeof this.currentTab[] = ['my-tasks', 'pool'];
    const resolvedTab = validTabs.includes(tab) ? tab : 'my-tasks';
    let tabChanged = false;
    if (resolvedTab !== this.currentTab) {
      this.currentTab = resolvedTab;
      this.selectedTasks.clear();
      this.selectedPoolTasks.clear();
      tabChanged = true;
    }

    // 2. Status Filter
    const status = params['status'];
    const validStatuses = ['all', 'pending', 'initial', 'recount', 'completed'];
    this.statusFilter = validStatuses.includes(status) ? (status as any) : 'pending';

    // 3. Date Filter
    const date = params['date'];
    const validDates = ['all', 'today', 'yesterday', 'week'];
    this.dateFilter = validDates.includes(date) ? (date as any) : 'all';

    // 4. Sort Field
    const sort = params['sort'];
    const validSorts = ['created_at', 'updated_at', 'location', 'recount_first', 'code', 'title'];
    this.sortField = validSorts.includes(sort) ? (sort as any) : 'updated_at';

    // 5. Sort Direction
    const sortDir = params['sortDir'];
    if (sortDir === 'asc' || sortDir === 'desc') {
      this.sortDirection = sortDir;
    } else {
      this.sortDirection = (this.sortField === 'created_at' || this.sortField === 'updated_at') ? 'desc' : 'asc';
    }

    // 6. Search Query
    const q = params['q'] || '';
    this.searchQuery = q;

    this.applyFilters();

    if (tabChanged || !this.initialLoadDone) {
      this.initialLoadDone = true;
      this.refreshCurrentTab();
    }
  }

  setTab(tab: 'my-tasks' | 'pool') {
    this.currentTab = tab;
    this.updateUrlState();
    this.refreshCurrentTab();
  }

  onSearchChange(val: string) {
    this.searchQuery = val;
    this.applyFilters();
    this.searchSubject.next(val);
  }

  clearSearch() {
    this.searchQuery = '';
    this.applyFilters();
    this.updateUrlState();
    this.cdr.detectChanges();
  }

  onSearchEnter() {
    if (this.searchQuery && this.searchQuery.trim().length >= 3) {
      const q = this.searchQuery.trim();
      this.searchQuery = '';
      this.applyFilters();
      this.updateUrlState();
      this.onBarcodeScanned(q);
    }
  }

  triggerCameraScan() {
    this.scanner?.openCamera();
  }

  onWarehouseChange(whId: any) {
    this.authStore.setActiveWarehouse(whId);
    this.state.appState.activeWarehouseId = whId;
    this.loadFieldPermissions();
    if (this.currentTab === 'my-tasks') {
      this.loadTasks();
    } else {
      this.loadPoolTasks();
    }
  }

  private normalizeDigits(str: any): string {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/[۰-۹]/g, d => '0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(d)])
      .replace(/[٠-٩]/g, d => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)])
      .replace(/[/،]/g, '.')
      .trim();
  }

  private convertPersianKeyboardToEnglish(str: string): string {
    if (!str) return '';
    const faToEn: Record<string, string> = {
      'ض': 'q', 'ص': 'w', 'ث': 'e', 'ق': 'r', 'ف': 't', 'غ': 'y', 'ع': 'u', 'ه': 'i', 'خ': 'o', 'ح': 'p', 'ج': '[', 'چ': ']',
      'ش': 'a', 'س': 's', 'ی': 'd', 'ب': 'f', 'ل': 'g', 'ا': 'h', 'ت': 'j', 'ن': 'k', 'م': 'l', 'ک': ';', 'گ': "'",
      'ظ': 'z', 'ط': 'x', 'ز': 'c', 'ر': 'v', 'ذ': 'b', 'د': 'n', 'پ': 'm', 'و': ',', 'ئ': 'm'
    };
    return str.split('').map(char => faToEn[char] || faToEn[char.toLowerCase()] || char).join('');
  }

  togglePoolSelection(taskId: number) {
    if (this.selectedPoolTasks.has(taskId)) {
      this.selectedPoolTasks.delete(taskId);
    } else {
      this.selectedPoolTasks.add(taskId);
    }
    this.cdr.detectChanges();
  }

  async claimSelectedTasks() {
    if (this.selectedPoolTasks.size === 0) return;
    
    const payload = {
      task_ids: Array.from(this.selectedPoolTasks),
      as_role: 'counter'
    };

    this.http.post(`${environment.apiUrl}/inventory/count-tasks/claim_tasks/`, payload).subscribe({
      next: async (res: any) => {
        if (res.claimed_count === 0) {
          this.toast.error(res.message || 'این کالا(ها) قبلاً توسط انبارگردان دیگری بر عهده گرفته شده است');
          this.selectedPoolTasks.clear();
          this.loadPoolTasks(false);
          return;
        }

        this.toast.success(`${res.claimed_count} کالا با موفقیت به عهده گرفته شد`);
        this.selectedPoolTasks.clear();
        if (this.localFirst) {
          await this.store.refresh(this.activeWarehouseId!);
        }
        this.setTab('my-tasks');
      },
      error: (err) => {
        const errorMsg = err?.error?.error || 'خطا در عملیات';
        this.toast.error(errorMsg);
      }
    });
  }

  // ════════════════════════════════════════════
  //  اسکنر بارکد و دریافت رویدادها
  // ════════════════════════════════════════════

  async onBarcodeScanned(code: string) {
    if (this.scanBusy || this.selectedTask) return;
    this.scanBusy = true;
    try {
      const rawQ = (code || '').trim().toLowerCase();
      const convertedQ = this.convertPersianKeyboardToEnglish(rawQ).toLowerCase();
      const normQ = this.normalizeDigits(rawQ).toLowerCase();
      const normConvertedQ = this.normalizeDigits(convertedQ).toLowerCase();

      const match = (t: CountTask) => {
        const unic = (t.item_details?.fa_unic_code || '').trim().toLowerCase();
        const normUnic = this.normalizeDigits(unic).toLowerCase();
        const itemNo = (t.item_details?.item_no || '').trim().toLowerCase();
        const itemId = String(t.item_details?.id || t.item || '').trim();
        const po = (t.item_details?.po || '').trim().toLowerCase();
        const plpk = (t.item_details?.plpkitem || '').trim().toLowerCase();
        const pl = (t.item_details?.pl || '').trim().toLowerCase();
        const pk = (t.item_details?.pk_number || '').trim().toLowerCase();

        const matchesAny = (val: string) => {
          if (!val) return false;
          return val === rawQ || val === convertedQ || val === normQ || val === normConvertedQ;
        };

        return (
          matchesAny(unic) ||
          matchesAny(normUnic) ||
          matchesAny(itemNo) ||
          matchesAny(itemId) ||
          matchesAny(po) ||
          matchesAny(plpk) ||
          matchesAny(pl) ||
          matchesAny(pk)
        );
      };

      // گردآوری کارتابل و استخر — Local-First از Dexie
      let myTasks: CountTask[];
      let pool: CountTask[];
      if (this.localFirst) {
        [myTasks, pool] = await Promise.all([
          this.store.getMyTasks(this.activeWarehouseId!, this.currentUserId!),
          this.store.getPoolTasks(this.activeWarehouseId!),
        ]);
      } else {
        myTasks = this.tasks;
        pool = this.poolTasks.length > 0 ? this.poolTasks : await this.fetchPoolTasks();
      }

      // ۱) کارتابل خودم — اولویت با تسک‌های در انتظار شمارش
      const mine = myTasks.filter(match);
      const target =
        mine.find((t) => t.status === 'PENDING_COUNT' || t.status === 'SUPERVISOR_REJECTED') ??
        mine[0];
      if (target) {
        this.openDetail(target);
        return;
      }

      // ۲) استخر — تأیید بر عهده گرفتن
      const poolTask = pool.find(match);
      if (poolTask) {
        await this.claimScannedTask(poolTask);
        return;
      }

      // ۳) هیچ‌کدام
      this.toast.error(`کالایی با کد «${code}» در کارتابل یا استخر شما یافت نشد`);
    } finally {
      this.scanBusy = false;
      this.cdr.detectChanges();
    }
  }

  fetchPoolTasksSilently() {
    this.fetchPoolTasks().then(tasks => {
      this.poolTasks = tasks;
      this.cdr.detectChanges();
    });
  }

  /** استخر در حالت سرور-محور */
  private fetchPoolTasks(): Promise<CountTask[]> {
    const params: any = { as_role: 'counter', page_size: 1000 };
    const whId = this.state.appState.activeWarehouseId;
    if (whId && whId !== 'ALL' && whId !== -1) params.warehouse_id = whId;
    return new Promise((resolve) => {
      this.http
        .get<CountTask[]>(`${environment.apiUrl}/inventory/count-tasks/pool_tasks/`, { params })
        .subscribe({
          next: (res: any) => resolve(Array.isArray(res) ? res : res.results || []),
          error: () => resolve([]),
        });
    });
  }

  private async claimScannedTask(task: CountTask): Promise<void> {
    const codeHtml = `<b dir="ltr">${task.item_details?.fa_unic_code || ''}</b>`;
    const desc = task.item_details?.description || '';
    const confirmed = await this.confirmDialog.open({
      title: 'بر عهده گرفتن کالا',
      message: `کالای ${codeHtml}<br>${desc}<br>در استخر است. آیا آن را بر عهده می‌گیرید؟`,
      confirmText: 'بله، بر عهده می‌گیرم',
      cancelText: 'انصراف',
      type: 'info',
    });
    if (confirmed !== true) return;

    if (!navigator.onLine) {
      this.toast.error('بر عهده گرفتن کالا نیاز به اتصال اینترنت دارد');
      return;
    }

    await new Promise<void>((resolve) => {
      this.http
        .post(`${environment.apiUrl}/inventory/count-tasks/claim_tasks/`, {
          task_ids: [task.id],
          as_role: 'counter',
        })
        .subscribe({
          next: async (res: any) => {
            if (res.claimed_count === 0) {
              this.toast.error(res.message || 'این کالا قبلاً توسط کاربر دیگری بر عهده گرفته شده است');
              resolve();
              return;
            }
            this.toast.success('کالا با موفقیت به عهده گرفته شد');
            this.currentTab = 'my-tasks';
            if (this.localFirst) {
              await this.store.refresh(this.activeWarehouseId!);
              await this.readFromLocal(false);
              const fresh = (
                await this.store.getMyTasks(this.activeWarehouseId!, this.currentUserId!)
              ).find((t) => (task.sync_id ? t.sync_id === task.sync_id : t.id === task.id));
              if (fresh) this.openDetail(fresh);
            } else {
              this.loadTasks(false);
              this.openDetail(task);
            }
            this.cdr.detectChanges();
            resolve();
          },
          error: (err) => {
            this.toast.error(err?.error?.error || 'خطا در عملیات');
            resolve();
          },
        });
    });
  }

  loadFieldPermissions() {
    const whId = this.activeWarehouseId;
    const numWhId = whId ? Number(whId) : undefined;

    this.dynamicFieldApi.getFields(numWhId).subscribe({
      next: (dfRes: any) => {
        this.dynamicFieldsList = Array.isArray(dfRes) ? dfRes : (dfRes?.results || []);
        this.fetchFieldSettings(numWhId);
      },
      error: () => {
        this.dynamicFieldsList = [];
        this.fetchFieldSettings(numWhId);
      }
    });
  }

  private fetchFieldSettings(whId?: number) {
    if (whId) {
      this.settingsService.getWarehouseSettings(whId).subscribe({
        next: (res: any) => {
          const savedPerms = res?.field_permissions_counter?.value;
          this.fieldConfigs = mergeFieldPermissions(savedPerms, this.dynamicFieldsList);
          this.cdr.detectChanges();
        },
        error: () => {
          this.fieldConfigs = mergeFieldPermissions(null, this.dynamicFieldsList);
          this.cdr.detectChanges();
        }
      });
    } else {
      this.settingsService.getGlobalSettings().subscribe({
        next: (res: any) => {
          const savedPerms = res?.field_permissions_counter;
          this.fieldConfigs = mergeFieldPermissions(savedPerms, this.dynamicFieldsList);
          this.cdr.detectChanges();
        },
        error: () => {
          this.fieldConfigs = mergeFieldPermissions(null, this.dynamicFieldsList);
          this.cdr.detectChanges();
        }
      });
    }
  }

  get visibleInfoFields(): FieldPermissionConfig[] {
    return this.fieldConfigs.filter(f => 
      f.visible && 
      !f.editable && 
      f.key !== 'counted_qty' && 
      f.key !== 'counter_note' &&
      (!this.selectedTask?.is_blind || (f.key !== 'inventory' && f.key !== 'bal4miv' && f.key !== 'balance'))
    );
  }

  get editableFormFields(): FieldPermissionConfig[] {
    return this.fieldConfigs.filter(f => 
      f.visible && 
      f.editable && 
      f.key !== 'counted_qty' && 
      f.key !== 'counter_note'
    );
  }

  getFieldLabel(field: FieldPermissionConfig): string {
    return field.custom_label?.trim() || field.default_label;
  }

  getFieldDisplayValue(field: FieldPermissionConfig, item: any): string {
    if (!item) return '-';
    let val: any;
    if (field.is_dynamic) {
      const realKey = field.key.replace(/^dyn_/, '');
      val = item.dynamic_data?.[realKey];
    } else {
      val = item[field.key];
    }
    if (val === null || val === undefined || val === '') return '-';
    if (typeof val === 'boolean') return val ? 'بله' : 'خیر';
    return String(val);
  }

  isReadOnly(task: CountTask | null): boolean {
    if (!task) return false;
    return task.status !== 'PENDING_COUNT' && task.status !== 'INITIAL_COUNT' && task.status !== 'SUPERVISOR_REJECTED' && task.status !== 'MANAGER_REJECTED';
  }

  getActionTypeLabel(actionType: string): string {
    const map: Record<string, string> = {
      'PENDING_COUNT': 'در انتظار',
      'INITIAL_COUNT': 'آماده ارسال (ثبت موقت)',
      'COUNTED': 'شمارش شده (ارسال به سرپرست)',
      'SUPERVISOR_APPROVED': 'تایید سرپرست',
      'SUPERVISOR_REJECTED': 'رد شده توسط سرپرست (نیاز به بازشماری)',
      'MANAGER_REVIEW': 'در حال بررسی مدیر',
      'MANAGER_REJECTED': 'رد شده توسط مدیر',
      'FINAL_APPROVED': 'تایید نهایی',
      'CLAIMED': 'به عهده گرفته شده',
      'DISPATCHED': 'تخصیص اولیه'
    };
    return map[actionType] || actionType;
  }

  // --- Long Press & Multi-Select UX ---
  pressTimeout: any;
  justLongPressed = false;
  initialTouchY = 0;
  initialTouchX = 0;

  onTaskPressStart(task: CountTask, event: PointerEvent) {
    if (this.isReadOnly(task) || task.counted_balance === null) return;
    this.initialTouchY = event.clientY;
    this.initialTouchX = event.clientX;
    
    this.pressTimeout = setTimeout(() => {
      this.pressTimeout = null;
      this.justLongPressed = true;
      if (!this.selectedTasks.has(task.id)) {
        this.selectedTasks.add(task.id);
      } else {
        this.selectedTasks.delete(task.id);
      }
      this.cdr.markForCheck();
      if (navigator.vibrate) navigator.vibrate(50);
    }, 450);
  }

  onTaskPressMove(event: PointerEvent) {
    if (this.pressTimeout) {
      if (Math.abs(event.clientY - this.initialTouchY) > 10 || Math.abs(event.clientX - this.initialTouchX) > 10) {
        clearTimeout(this.pressTimeout);
        this.pressTimeout = null;
      }
    }
  }

  onTaskPressEnd() {
    if (this.pressTimeout) {
      clearTimeout(this.pressTimeout);
      this.pressTimeout = null;
    }
  }

  onTaskClick(task: CountTask, event: Event) {
    if (this.justLongPressed) {
      this.justLongPressed = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    
    // اگر در حالت انتخاب گروهی هستیم، مانع باز شدن ناخواسته Detail می‌شویم
    if (this.selectedTasks.size > 0) {
      if (!this.isReadOnly(task) && task.counted_balance !== null) {
        if (this.selectedTasks.has(task.id)) {
          this.selectedTasks.delete(task.id);
        } else {
          this.selectedTasks.add(task.id);
        }
      }
      this.cdr.detectChanges();
      return;
    }

    this.openDetail(task);
  }


  openDetail(task: CountTask) {
    this.selectedTask = task;
    this.countedBalanceStr = (task.counted_balance !== null && task.counted_balance !== undefined) ? String(task.counted_balance) : '';
    this.counterNote = task.counter_note || '';

    this.editableValues = {};
    const item: any = task.item_details || {};
    this.editableFormFields.forEach(f => {
      if (f.is_dynamic) {
        const realKey = f.key.replace(/^dyn_/, '');
        const rawVal = item.dynamic_data?.[realKey];
        if (f.data_type === 'boolean') {
          this.editableValues[f.key] = rawVal === true || rawVal === 'true';
        } else {
          this.editableValues[f.key] = rawVal ?? '';
        }
      } else {
        const rawVal = item[f.key];
        if (f.data_type === 'boolean') {
          this.editableValues[f.key] = rawVal === true || rawVal === 'true';
        } else {
          this.editableValues[f.key] = rawVal ?? '';
        }
      }
    });

    this.cdr.detectChanges();
  }

  closeDetail() {
    this.selectedTask = null;
    this.editableValues = {};
    this.cdr.detectChanges();
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    const isInsideInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

    // Escape: close modal / detail / sort menu
    if (event.key === 'Escape') {
      if (this.isSortMenuOpen) {
        event.preventDefault();
        this.isSortMenuOpen = false;
        this.cdr.detectChanges();
        return;
      }
      if (this.isExportModalOpen) {
        event.preventDefault();
        this.closeExportModal();
        return;
      }
      if (this.selectedTask) {
        event.preventDefault();
        this.closeDetail();
        return;
      }
    }

    // Close sort menu on clicking outside or keyboard
    if (this.isSortMenuOpen && event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
      this.isSortMenuOpen = false;
      this.cdr.detectChanges();
    }

    // Ctrl+Enter: Save draft in detail view, or Export in export modal, or Submit selected in dashboard
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      if (this.selectedTask && !this.isReadOnly(this.selectedTask)) {
        event.preventDefault();
        this.saveDraft();
        return;
      } else if (this.isExportModalOpen && !this.isExporting) {
        event.preventDefault();
        this.executeExport();
        return;
      } else if (!this.selectedTask && !this.isExportModalOpen) {
        if (this.currentTab === 'my-tasks' && this.selectedTasks.size > 0 && !this.isSubmitting) {
          event.preventDefault();
          this.submitSelected();
          return;
        } else if (this.currentTab === 'pool' && this.selectedPoolTasks.size > 0 && !this.isLoading) {
          event.preventDefault();
          this.claimSelectedTasks();
          return;
        }
      }
    }

    // Alt+1: My tasks tab, Alt+2: Pool tab
    if (event.altKey && !event.ctrlKey && !event.shiftKey && !event.metaKey) {
      if (event.key === '1' || event.key === '۱') {
        event.preventDefault();
        this.setTab('my-tasks');
        return;
      } else if (event.key === '2' || event.key === '۲') {
        event.preventDefault();
        this.setTab('pool');
        return;
      }
    }

    // Hardware Keyboard Wedge Barcode Scanner Listener
    if (!this.selectedTask && !this.isExportModalOpen && !isInsideInput) {
      const now = Date.now();
      if (now - this.lastKeyTime > 500) {
        this.barcodeBuffer = '';
      }
      this.lastKeyTime = now;

      if (event.key === 'Enter') {
        if (this.barcodeBuffer.length >= 3) {
          const code = this.barcodeBuffer;
          this.barcodeBuffer = '';
          event.preventDefault();
          this.onBarcodeScanned(code);
        }
      } else if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
        this.barcodeBuffer += event.key;
      }
    }
  }

  async saveDraft() {
    if (!this.selectedTask) return;

    if (this.isReadOnly(this.selectedTask)) {
      this.closeDetail();
      return;
    }

    const task = this.selectedTask;

    // تبدیل ارقام فارسی و اعتبارسنجی
    const rawVal = this.normalizeDigits(this.countedBalanceStr);
    this.countedBalanceStr = rawVal;

    if (rawVal !== '') {
      const num = Number(rawVal);
      if (isNaN(num) || num < 0) {
        this.toast.error('مقدار شمارش شده نمی‌تواند منفی یا نامعتبر باشد');
        return;
      }
    }

    // تعیین وضعیت جدید: اگر مقدار وارد شده باشد و در انتظار شمارش یا رد شده بود -> INITIAL_COUNT
    // اگر مقدار پاک شده باشد و قبلاً INITIAL_COUNT بود -> بازگشت به وضعیت اصلی
    let newStatus = task.status;
    if (rawVal !== '') {
      if (task.status === 'PENDING_COUNT' || task.status === 'SUPERVISOR_REJECTED' || task.status === 'MANAGER_REJECTED') {
        newStatus = 'INITIAL_COUNT';
      }
    } else {
      if (task.status === 'INITIAL_COUNT') {
        if (task.history && task.history.length > 0) {
          const prevRecord = task.history.find(h => h.action_type === 'SUPERVISOR_REJECTED' || h.action_type === 'MANAGER_REJECTED' || h.action_type === 'PENDING_COUNT');
          if (prevRecord) {
            newStatus = prevRecord.action_type as CountTaskStatus;
          } else if (task.manager_note) {
            newStatus = 'MANAGER_REJECTED';
          } else if (task.supervisor_note) {
            newStatus = 'SUPERVISOR_REJECTED';
          } else {
            newStatus = 'PENDING_COUNT';
          }
        } else if (task.manager_note) {
          newStatus = 'MANAGER_REJECTED';
        } else if (task.supervisor_note) {
          newStatus = 'SUPERVISOR_REJECTED';
        } else {
          newStatus = 'PENDING_COUNT';
        }
      }
    }

    const payload: any = {
      counted_balance: rawVal !== '' ? rawVal : null,
      counter_note: this.counterNote,
      status: newStatus
    };

    const newHistoryRecord: CountTaskHistory = {
      id: Date.now(),
      task: task.id,
      action_by: this.auth.user()?.id || null,
      action_by_name: this.auth.user()?.first_name ? `${this.auth.user()?.first_name} ${this.auth.user()?.last_name}`.trim() : (this.auth.user()?.username || 'شما'),
      action_type: newStatus,
      counted_balance: rawVal !== '' ? rawVal : null,
      note: this.counterNote || null,
      created_at: new Date().toISOString()
    };

    if (this.localFirst && task.sync_id) {
      try {
        await this.store.saveDraft(task, payload, this.currentUserId!);
        Object.assign(task, payload, { _offlinePending: true });
        if (!task.history) task.history = [];
        task.history = [newHistoryRecord, ...task.history];
        await this.saveExtraEditedFields(task);
        this.applyFilters();
        this.toast.success(rawVal !== '' ? 'مقدار ذخیره شد (آماده ارسال)' : 'مقدار شمارش پاک شد');
        this.closeDetail();
      } catch (e) {
        console.error('[CounterDashboard] خطا در ذخیره محلی:', e);
        this.toast.error('خطا در ذخیره اطلاعات');
      }
      this.cdr.detectChanges();
      return;
    }

    this.countTaskApi.update(task.id, payload).subscribe({
      next: async (res) => {
        Object.assign(task, res);
        if (!task.history) task.history = [];
        task.history = [newHistoryRecord, ...task.history];
        await this.saveExtraEditedFields(task);
        this.applyFilters();
        this.toast.success(rawVal !== '' ? 'مقدار ذخیره شد (آماده ارسال)' : 'مقدار شمارش پاک شد');
        this.closeDetail();
        this.cdr.detectChanges();
      },
      error: () => {
        this.toast.error('خطا در ذخیره اطلاعات');
        this.cdr.detectChanges();
      }
    });
  }

  /** بازگرداندن هوشمند کالا از آماده ارسال به وضعیت پیشین (دست‌نخورده یا بازشماری) */
  async revertTaskStatus(task: CountTask, event?: Event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (!task || this.isReadOnly(task)) return;

    // تعیین وضعیت بازگشت بر اساس منشأ تسک و تاریخچه
    let previousStatus: CountTaskStatus = 'PENDING_COUNT';
    let statusLabel = 'در انتظار شمارش';
    if (task.history && task.history.length > 0) {
      const prevRecord = task.history.find(h => h.action_type === 'SUPERVISOR_REJECTED' || h.action_type === 'MANAGER_REJECTED' || h.action_type === 'PENDING_COUNT');
      if (prevRecord) {
        if (prevRecord.action_type === 'SUPERVISOR_REJECTED') {
          previousStatus = 'SUPERVISOR_REJECTED';
          statusLabel = 'مغایرت و بازشماری (سرپرست)';
        } else if (prevRecord.action_type === 'MANAGER_REJECTED') {
          previousStatus = 'MANAGER_REJECTED';
          statusLabel = 'مغایرت و بازشماری (مدیر)';
        } else {
          previousStatus = 'PENDING_COUNT';
          statusLabel = 'در انتظار شمارش';
        }
      } else if (task.manager_note) {
        previousStatus = 'MANAGER_REJECTED';
        statusLabel = 'مغایرت و بازشماری';
      } else if (task.supervisor_note) {
        previousStatus = 'SUPERVISOR_REJECTED';
        statusLabel = 'مغایرت و بازشماری';
      }
    } else if (task.manager_note) {
      previousStatus = 'MANAGER_REJECTED';
      statusLabel = 'مغایرت و بازشماری';
    } else if (task.supervisor_note) {
      previousStatus = 'SUPERVISOR_REJECTED';
      statusLabel = 'مغایرت و بازشماری';
    }

    const confirmed = await this.confirmDialog.open({
      title: 'بازگرداندن وضعیت کالا',
      message: `آیا از لغو پیش‌نویس و بازگرداندن این کالا به وضعیت «${statusLabel}» اطمینان دارید؟`,
      confirmText: 'بله، بازگردان',
      cancelText: 'انصراف',
      type: 'warning'
    });
    if (!confirmed) return;

    const payload: any = {
      counted_balance: null,
      counter_note: task.counter_note || '',
      status: previousStatus
    };

    // اگر در مودال جزئیات باز است، فیلدهای لوکال را هم ریست کنیم
    if (this.selectedTask && this.selectedTask.id === task.id) {
      this.countedBalanceStr = '';
    }

    // اگر در لیست انتخاب‌شده‌ها بود، حذف شود
    this.selectedTasks.delete(task.id);

    if (this.localFirst && task.sync_id) {
      try {
        await this.store.saveDraft(task, payload, this.currentUserId!);
        Object.assign(task, payload, { _offlinePending: true });
        this.applyFilters();
        this.toast.success(`کالا به وضعیت «${statusLabel}» بازگردانده شد`);
        if (this.selectedTask && this.selectedTask.id === task.id) {
          this.closeDetail();
        }
      } catch (e) {
        console.error('[CounterDashboard] خطا در بازگرداندن وضعیت محلی:', e);
        this.toast.error('خطا در بازگرداندن وضعیت کالا');
      }
      this.cdr.detectChanges();
      return;
    }

    this.countTaskApi.update(task.id, payload).subscribe({
      next: (res) => {
        Object.assign(task, res);
        this.applyFilters();
        this.toast.success(`کالا به وضعیت «${statusLabel}» بازگردانده شد`);
        if (this.selectedTask && this.selectedTask.id === task.id) {
          this.closeDetail();
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.toast.error('خطا در بازگرداندن وضعیت کالا');
        this.cdr.detectChanges();
      }
    });
  }

  /** ثبت و ارسال مستقیم یک کالا به سرپرست/مدیر از نمای Detail */
  async submitDirectlyToSupervisor() {
    if (!this.selectedTask) return;
    if (this.isReadOnly(this.selectedTask)) {
      this.closeDetail();
      return;
    }

    const rawVal = this.normalizeDigits(this.countedBalanceStr);
    this.countedBalanceStr = rawVal;
    if (rawVal === '') {
      this.toast.error('لطفاً ابتدا مقدار شمارش شده را وارد نمایید');
      return;
    }

    const num = Number(rawVal);
    if (isNaN(num) || num < 0) {
      this.toast.error('مقدار شمارش شده نمی‌تواند منفی یا نامعتبر باشد');
      return;
    }

    this.isSubmitting = true;
    this.cdr.detectChanges();

    const task = this.selectedTask;
    const draftPayload: any = {
      counted_balance: rawVal,
      counter_note: this.counterNote,
      status: 'INITIAL_COUNT'
    };

    const submitHistoryRecord: CountTaskHistory = {
      id: Date.now(),
      task: task.id,
      action_by: this.auth.user()?.id || null,
      action_by_name: this.auth.user()?.first_name ? `${this.auth.user()?.first_name} ${this.auth.user()?.last_name}`.trim() : (this.auth.user()?.username || 'شما'),
      action_type: task.skip_supervisor ? 'MANAGER_REVIEW' : 'COUNTED',
      counted_balance: rawVal,
      note: this.counterNote || null,
      created_at: new Date().toISOString()
    };

    if (this.localFirst && task.sync_id) {
      try {
        await this.store.saveDraft(task, draftPayload, this.currentUserId!);
        Object.assign(task, draftPayload, { _offlinePending: true });
        if (!task.history) task.history = [];
        task.history = [submitHistoryRecord, ...task.history];
        await this.saveExtraEditedFields(task);
        await this.store.submitTasks([task], this.currentUserId!);
        this.toast.success(task.skip_supervisor ? 'کالا با موفقیت مستقیم به مدیر ارسال شد' : 'کالا با موفقیت به سرپرست ارسال شد');
        this.isSubmitting = false;
        this.closeDetail();
        this.readFromLocal(false);
      } catch (e) {
        console.error('[CounterDashboard] خطا در ارسال مستقیم محلی:', e);
        this.toast.error('خطا در ارسال اطلاعات');
        this.isSubmitting = false;
        this.cdr.detectChanges();
      }
      return;
    }

    // حالت سرور-محور (Online)
    this.countTaskApi.update(task.id, draftPayload).subscribe({
      next: async (updatedTask) => {
        Object.assign(task, updatedTask);
        if (!task.history) task.history = [];
        task.history = [submitHistoryRecord, ...task.history];
        await this.saveExtraEditedFields(task);

        const whId = this.state.appState.activeWarehouseId;
        const submitPayload: any = { task_ids: [task.id] };
        if (whId && whId !== 'ALL' && whId !== -1) {
          submitPayload.warehouse_id = whId;
        }

        this.countTaskApi.bulkSubmit(submitPayload).subscribe({
          next: (res) => {
            this.toast.success(res.message || (task.skip_supervisor ? 'کالا با موفقیت مستقیم به مدیر ارسال شد' : 'کالا با موفقیت به سرپرست ارسال شد'));
            this.isSubmitting = false;
            this.closeDetail();
            this.loadTasks(false);
          },
          error: () => {
            this.toast.error(task.skip_supervisor ? 'خطا در ارسال مستقیم به مدیر' : 'خطا در ارسال به سرپرست');
            this.isSubmitting = false;
            this.cdr.detectChanges();
          }
        });
      },
      error: () => {
        this.toast.error('خطا در ثبت اطلاعات');
        this.isSubmitting = false;
        this.cdr.detectChanges();
      }
    });
  }

  private async saveExtraEditedFields(task: CountTask) {
    if (this.editableFormFields.length === 0 || !task?.item) {
      return;
    }

    const item: any = task.item_details || {};
    const itemPayload: Record<string, any> = {};
    const dynamicDataUpdates: Record<string, any> = {};
    let hasChanges = false;

    // بررسی دقیق فیلدهای تغییر یافته واقعی (Dirty Check)
    this.editableFormFields.forEach(f => {
      const newVal = this.editableValues[f.key];
      if (f.is_dynamic) {
        const realKey = f.key.replace(/^dyn_/, '');
        const oldVal = item.dynamic_data?.[realKey];
        if (newVal !== oldVal && (newVal !== '' || (oldVal !== null && oldVal !== undefined))) {
          dynamicDataUpdates[realKey] = newVal;
          hasChanges = true;
        }
      } else {
        const oldVal = item[f.key];
        if (newVal !== oldVal && (newVal !== '' || (oldVal !== null && oldVal !== undefined))) {
          itemPayload[f.key] = newVal;
          hasChanges = true;
        }
      }
    });

    if (Object.keys(dynamicDataUpdates).length > 0) {
      const existingDyn = item.dynamic_data || {};
      itemPayload['dynamic_data'] = { ...existingDyn, ...dynamicDataUpdates };
    }

    if (hasChanges && Object.keys(itemPayload).length > 0) {
      // به‌روزرسانی حافظه محلی کلاینت
      Object.assign(item, itemPayload);
      if (Object.keys(dynamicDataUpdates).length > 0) {
        item.dynamic_data = itemPayload['dynamic_data'];
      }

      const itemId = String(item.id || task.item);
      const itemSyncId = item.sync_id || `item_${itemId}`;

      // به‌روزرسانی پایگاه داده محلی IndexedDB
      try {
        if (task.sync_id) {
          await offlineDb.countTasks.update(task.sync_id, {
            item_details: { ...item },
            _offlinePending: true
          });
        }
        if (item.sync_id) {
          await offlineDb.items.update(item.sync_id, {
            ...itemPayload,
            _offlinePending: true
          });
        }
      } catch (dbErr) {
        console.warn('[CounterDashboard] خطا در ذخیره محلی فیلدهای کالا:', dbErr);
      }

      // درج در صف ارسال آفلاین و همگام‌سازی خودکار
      try {
        await OfflineSyncService.getInstance().enqueue(
          'PATCH',
          `${environment.apiUrl}/inventory/items/${itemId}/`,
          { ...itemPayload, base_updated_at: item.updated_at },
          {
            userId: this.currentUserId || undefined,
            entityType: 'item',
            entitySyncId: itemSyncId,
            baseUpdatedAt: item.updated_at
          }
        );
        OfflineSyncService.getInstance().processQueue();
      } catch (syncErr) {
        console.error('[CounterDashboard] خطا در افزودن فیلدهای کالا به صف همگام‌سازی:', syncErr);
        if (navigator.onLine) {
          this.itemApi.update(itemId, itemPayload).subscribe({
            next: () => {},
            error: (err) => console.error('Error updating item fields:', err)
          });
        }
      }
    }
  }

  toggleSelection(taskId: number) {
    if (this.selectedTasks.has(taskId)) {
      this.selectedTasks.delete(taskId);
    } else {
      this.selectedTasks.add(taskId);
    }
    this.cdr.detectChanges();
  }

  onSelectionChange(selectedIds: Set<any>) {
    this.selectedTasks = new Set(Array.from(selectedIds).map(id => Number(id)));
    this.cdr.detectChanges();
  }

  toggleAll() {
    const readyTasks = this.filteredTasks.filter(t => t.counted_balance !== null && !this.isReadOnly(t));
    if (this.selectedTasks.size === readyTasks.length && readyTasks.length > 0) {
      this.selectedTasks.clear();
    } else {
      readyTasks.forEach(t => this.selectedTasks.add(t.id));
    }
    this.cdr.detectChanges();
  }

  clearAllSelections() {
    this.selectedTasks.clear();
    this.selectedPoolTasks.clear();
    this.cdr.detectChanges();
  }

  submitSelected() {
    this.submitAll();
  }

  async submitAll() {
    const isPartial = this.selectedTasks.size > 0;
    const countToSubmit = isPartial ? this.selectedTasks.size : this.readyToSubmitCount;

    if (countToSubmit === 0) {
      this.toast.error('موردی برای ارسال وجود ندارد');
      return;
    }

    const confirmed = await this.confirmDialog.open({
      title: isPartial ? 'ارسال موارد انتخابی' : 'ارسال همه موارد',
      message: `آیا از ارسال ${countToSubmit} مورد شمرده شده جهت بررسی و تایید اطمینان دارید؟ موارد ارسال شده دیگر در این صفحه قابل ویرایش نخواهند بود.`,
      confirmText: 'بله، ارسال کن',
      cancelText: 'انصراف',
      type: 'info'
    });

    if (confirmed) {
      this.isSubmitting = true;
      this.cdr.detectChanges();

      if (this.localFirst) {
        const eligible = this.pendingTasks.filter(t => t.counted_balance !== null);
        const toSubmit = isPartial
          ? eligible.filter(t => this.selectedTasks.has(t.id))
          : eligible;
        try {
          await this.store.submitTasks(toSubmit, this.currentUserId!);
          this.toast.success(`${toSubmit.length} مورد در صف ارسال قرار گرفت و به‌محض اتصال ارسال می‌شود`);
          this.selectedTasks.clear();
          this.isSubmitting = false;
          this.readFromLocal(false);
        } catch (e) {
          console.error('[CounterDashboard] خطا در ارسال محلی:', e);
          this.toast.error('خطا در ارسال اطلاعات');
          this.isSubmitting = false;
          this.cdr.detectChanges();
        }
        return;
      }

      const whId = this.state.appState.activeWarehouseId;
      const payload: any = isPartial ? { task_ids: Array.from(this.selectedTasks) } : {};
      if (whId && whId !== 'ALL' && whId !== -1) {
        payload.warehouse_id = whId;
      }

      this.countTaskApi.bulkSubmit(payload).subscribe({
        next: (res) => {
          this.toast.success(res.message);
          this.selectedTasks.clear();
          this.isSubmitting = false;
          this.loadTasks();
        },
        error: () => {
          this.toast.error('خطا در ارسال اطلاعات');
          this.isSubmitting = false;
          this.cdr.detectChanges();
        }
      });
    }
  }

  // Export Methods
  openExportModal() {
    this.isExportModalOpen = true;
    this.exportDataScope = this.selectedTasks.size > 0 ? 'selected' : 'all';
    this.exportColumnScope = 'all_db';
    this.selectedExportColumns.clear();
    
    if (this.availableExportColumns.length === 0) {
      this.countTaskApi.getExportColumns().subscribe({
        next: (cols) => {
          this.availableExportColumns = cols;
          this.cdr.detectChanges();
        }
      });
    }
  }

  closeExportModal() {
    this.isExporting = false;
    this.isExportModalOpen = false;
    if (this.exportSubscription) {
      this.exportSubscription.unsubscribe();
      this.exportSubscription = undefined;
    }
    this.cdr.detectChanges();
  }

  onDataScopeChange(scope: string) {
    if (scope === 'all') {
      this.exportColumnScope = 'all_db';
    } else if (scope === 'selected') {
      this.exportColumnScope = 'visible';
    }
  }

  executeExport() {
    this.isExporting = true;
    
    const payload: any = {
      data_scope: this.exportDataScope,
      columns_scope: this.exportColumnScope,
      as_role: 'counter',
    };
    
    if (this.exportDataScope === 'selected') {
      payload.selected_ids = Array.from(this.selectedTasks);
    }
    
    if (this.exportColumnScope === 'custom') {
      payload.columns_list = Array.from(this.selectedExportColumns);
    } else if (this.exportColumnScope === 'visible') {
      payload.columns_list = this.fieldConfigs.filter(f => f.visible).map(f => f.key);
    }
    
    const params: any = { as_role: 'counter', page_size: 100000 };
    const whId = this.state.appState.activeWarehouseId;
    if (whId && whId !== 'ALL' && whId !== -1) {
      params.warehouse_id = whId;
    }

    this.exportSubscription = this.countTaskApi.exportExcel({ ...payload, ...params }).subscribe({
      next: (blob) => {
        try {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `export_counter_${new Date().getTime()}.xlsx`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        } catch(e) {
          console.error('File download error', e);
        }
        
        this.isExporting = false;
        this.closeExportModal();
        this.toast.success('خروجی اکسل با موفقیت دانلود شد.');
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Export error:', err);
        this.toast.error('خطا در دریافت فایل خروجی');
        this.isExporting = false;
        this.cdr.detectChanges();
      }
    });
  }

}
