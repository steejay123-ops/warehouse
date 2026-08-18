import { Component, OnInit, OnDestroy, ChangeDetectorRef, HostListener } from '@angular/core';
import { Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { Subscription, Subject, filter, debounceTime, distinctUntilChanged } from 'rxjs';
import { WebSocketService } from '../../core/http/websocket.service';
import { CommonModule } from '@angular/common';
import { AuthStore } from '../../core/stores/auth.store';
import { AuthService } from '../../core/auth/auth.service';
import { FormsModule } from '@angular/forms';
import { StateService } from '../../services/state.service';
import { ToastService } from '../../services/toast.service';
import { CountTaskApiService } from '../../core/api/count-task-api.service';
import { CountTask } from '../../core/models/count-task.model';
import { DocTaskApiService } from '../../core/api/doc-task-api.service';
import { DocTask } from '../../core/models/doc-task.model';
import { HasPermissionDirective } from '../../shared';
import { WarehouseSelectorComponent } from '../../shared/components/warehouse-selector/warehouse-selector.component';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { OfflineSyncService } from '../../core/services/offline-sync.service';

@Component({
  selector: 'app-manager-review',
  standalone: true,
  imports: [CommonModule, FormsModule, WarehouseSelectorComponent],
  templateUrl: './manager-review.html',
  styleUrl: './manager-review.css'
})
export class ManagerReview implements OnInit, OnDestroy {
  private wsSub?: Subscription;
  private swrSub?: Subscription;
  private wsUpdateSubject = new Subject<any>();
  private wsDebounceSub?: Subscription;
  private offlineSync = OfflineSyncService.getInstance();
  updatedTaskIds = new Set<number>();
  flashTimeout: any;
  private routerSub?: Subscription;
  currentTab: 'my-tasks' | 'pool' | 'doc' | 'doc-pool' = 'my-tasks';

  // ─── Search & Filters State ───
  searchQuery = '';
  private searchSubject = new Subject<string>();
  statusFilter: 'all' | 'pending' | 'recount' | 'initial' | 'completed' = 'pending';
  dateFilter: 'all' | 'today' | 'yesterday' | 'week' = 'all';

  // ─── Performance Metrics & Status Counts ───
  totalTasksCount = 0;
  matchedTasksCount = 0;
  mismatchedTasksCount = 0;
  completedTasksCount = 0;
  remainingTasksCount = 0;

  statusCounts = {
    pending: 0,
    recount: 0,
    initial: 0,
    completed: 0,
    all: 0
  };

  // ─── Filtered Data Lists ───
  filteredTasks: CountTask[] = [];
  filteredDocTasks: DocTask[] = [];
  filteredPoolTasks: CountTask[] = [];
  filteredDocPoolTasks: DocTask[] = [];

  get activeSection(): 'counting' | 'financial' {
    return (this.currentTab === 'doc' || this.currentTab === 'doc-pool') ? 'financial' : 'counting';
  }

  // Export Modal State
  isExportModalOpen = false;
  exportDataScope: 'all' | 'selected' = 'all';
  exportColumnScope: 'all_db' | 'visible' | 'custom' = 'all_db';
  selectedExportColumns: Set<string> = new Set();
  isExporting = false;
  exportSubscription?: Subscription;
  availableExportColumns: {key: string, label: string}[] = [];

  get currentSelectedTasks() {
    if (this.currentTab === 'my-tasks') return this.selectedTasks;
    if (this.currentTab === 'pool') return this.selectedPoolTasks;
    if (this.currentTab === 'doc') return this.selectedDocTasks;
    if (this.currentTab === 'doc-pool') return this.selectedDocPoolTasks;
    return new Set<number>();
  }

  // ── Count Task Tab ──
  tasks: CountTask[] = [];
  isLoading = true;
  selectedTasks: Set<number> = new Set();

  // Pool Tab
  poolTasks: CountTask[] = [];
  selectedPoolTasks: Set<number> = new Set();

  // Single Detail Inspection Modal State
  selectedDetailTask: CountTask | null = null;
  detailManagerNote = '';

  // Single Quick Reject Dialog State
  singleRejectTask: CountTask | null = null;
  singleRejectNote = '';

  // Single Review State (Legacy fallback if needed)
  selectedTask: CountTask | null = null;
  managerNote = '';

  // Bulk Approve Dialog
  showApproveDialog = false;
  approveNote = '';

  // Bulk Reject Dialog
  showBulkRejectDialog = false;
  bulkRejectNote = '';

  // Doc Pool Tab
  docPoolTasks: DocTask[] = [];
  isDocPoolLoading = false;
  selectedDocPoolTasks = new Set<number>();

  // ── Doc Task Tab ──
  docTasks: DocTask[] = [];
  isDocLoading = false;
  selectedDocTasks = new Set<number>();
  showDocApproveDialog = false;
  docApproveNote = '';
  showDocRejectDialog = false;
  docRejectNote = '';
  // Doc Detail Modal State
  selectedDocDetailTask: DocTask | null = null;

  openDocDetail(task: DocTask) {
    this.selectedDocDetailTask = task;
    this.cdr.detectChanges();
  }

  closeDocDetail() {
    this.selectedDocDetailTask = null;
    this.cdr.detectChanges();
  }

  getInvoiceTypeLabel(val: string | null | undefined): string {
    const map: Record<string, string> = {
      'formal': 'رسمی/مالیاتی',
      'domestic': 'داخلی',
      'foreign': 'خارجی',
      'consignment': 'امانی'
    };
    return val ? (map[val] || val) : '-';
  }

  getCurrencyLabel(val: string | null | undefined): string {
    const map: Record<string, string> = {
      'IRR': 'ریال',
      'USD': 'دلار',
      'EUR': 'یورو',
      'OTHER': 'سایر'
    };
    return val ? (map[val] || val) : '-';
  }

  formatNumberWithCommas(val: any): string {
    if (val === null || val === undefined || val === '') return '-';
    const parts = String(val).replace(/,/g, '').split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  }

  getItemDetail(task: DocTask | null, key: string): any {
    if (!task || !task.item_details) return '-';
    const item = task.item_details as any;
    return item[key] !== undefined && item[key] !== null && item[key] !== '' ? item[key] : '-';
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    const isInsideInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

    // Escape: close any open dialog or review modal
    if (event.key === 'Escape') {
      if (this.selectedDetailTask) {
        event.preventDefault();
        this.closeTaskDetail();
      } else if (this.singleRejectTask) {
        event.preventDefault();
        this.closeRejectDialog();
      } else if (this.selectedTask) {
        event.preventDefault();
        this.cancelReview();
      } else if (this.showApproveDialog) {
        event.preventDefault();
        this.cancelApprove();
      } else if (this.showBulkRejectDialog) {
        event.preventDefault();
        this.cancelBulkReject();
      } else if (this.showDocRejectDialog) {
        event.preventDefault();
        this.closeDocRejectDialog();
      } else if (this.showDocApproveDialog) {
        event.preventDefault();
        this.cancelDocApprove();
      } else if (this.selectedDocDetailTask) {
        event.preventDefault();
        this.closeDocDetail();
      } else if (this.isExportModalOpen) {
        event.preventDefault();
        this.closeExportModal();
      }
    }

    // Ctrl+Enter: confirm active action dialog
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      if (this.selectedDetailTask) {
        event.preventDefault();
        this.approveDetailTask();
      } else if (this.singleRejectTask) {
        event.preventDefault();
        this.confirmSingleReject();
      } else if (this.showApproveDialog) {
        event.preventDefault();
        this.confirmApprove();
      } else if (this.showBulkRejectDialog) {
        event.preventDefault();
        this.confirmBulkReject();
      } else if (this.showDocRejectDialog) {
        event.preventDefault();
        this.confirmDocReject();
      } else if (this.showDocApproveDialog) {
        event.preventDefault();
        this.confirmDocApprove();
      } else if (this.isExportModalOpen && !this.isExporting) {
        event.preventDefault();
        this.executeExport();
      }
    }

    // Quick Action A (Approve) when tasks selected and not inside text input
    if (!isInsideInput && !event.ctrlKey && !event.metaKey && !event.altKey) {
      if (event.key === 'a' || event.key === 'A' || event.key === 'ش') {
        if (this.activeSection === 'counting' && this.selectedTasks.size > 0 && !this.showApproveDialog && !this.selectedTask && !this.selectedDetailTask) {
          event.preventDefault();
          this.openApproveDialog();
        } else if (this.activeSection === 'financial' && this.selectedDocTasks.size > 0 && !this.showDocApproveDialog && !this.showDocRejectDialog && !this.selectedDocDetailTask) {
          event.preventDefault();
          this.openDocApproveDialog();
        }
      }
    }

    // Tab switching Alt+1, Alt+2, Alt+3, Alt+4
    if (event.altKey && !event.ctrlKey && !event.shiftKey && !event.metaKey) {
      if (event.key === '1' || event.key === '۱') {
        event.preventDefault();
        this.setTab('my-tasks');
      } else if (event.key === '2' || event.key === '۲') {
        event.preventDefault();
        this.setTab('pool');
      } else if (event.key === '3' || event.key === '۳') {
        event.preventDefault();
        this.setTab('doc');
      } else if (event.key === '4' || event.key === '۴') {
        event.preventDefault();
        this.setTab('doc-pool');
      }
    }
  }

  constructor(
    public state: StateService,
    public authStore: AuthStore,
    public auth: AuthService,
    private toast: ToastService,
    private countTaskApi: CountTaskApiService,
    private docTaskApi: DocTaskApiService,
    private cdr: ChangeDetectorRef,
    private http: HttpClient,
    private wsService: WebSocketService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.searchSubject.pipe(debounceTime(350), distinctUntilChanged()).subscribe(() => {
      this.applyFilters();
      this.updateUrlState();
    });
  }

  ngOnInit() {
    this.wsService.connect();

    this.wsDebounceSub = this.wsUpdateSubject.pipe(debounceTime(600)).subscribe(() => {
      this.refreshCurrentTab(false, true);
    });

    this.wsSub = this.wsService.notifications$.subscribe((data: any) => {
      if (data.type === 'count_task_update' || data.event === 'count_task_update') {
        if (data.task && data.task.id) {
          this.updateCountTaskInPlace(data.task);
        } else if (data.task_id) {
          this.fetchSingleCountTask(data.task_id);
        } else {
          this.wsUpdateSubject.next(data);
        }
      } else if (data.type === 'doc_task_update' || data.event === 'doc_task_update') {
        if (data.task && data.task.id) {
          this.updateDocTaskInPlace(data.task);
        } else if (data.task_id) {
          this.fetchSingleDocTask(data.task_id);
        } else {
          this.wsUpdateSubject.next(data);
        }
      }
    });

    // ── URL State: خواندن پارامترها از آدرس مرورگر ──
    this.syncStateFromUrl();
    this.routerSub = this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd)
    ).subscribe(() => this.syncStateFromUrl());

    // ─── SWR Live Revalidation: دریافت داده‌های جدیدتر سرور در پس‌زمینه با فیلتر دقیق نقش مدیر ───
    this.swrSub = this.offlineSync.liveDataUpdates$.subscribe(({ url }) => {
      const isManagerCount = url.includes('/api/inventory/count-tasks/') && url.includes('as_role=manager');
      const isManagerDoc = url.includes('/api/inventory/doc-tasks/') && url.includes('as_role=manager');
      if (isManagerCount || isManagerDoc) {
        this.refreshCurrentTab(false, true);
        console.log('[ManagerReview] ⚡ تب فعال مدیر با استعلام پس‌زمینه SWR به‌روزرسانی شد.');
      }
    });
  }

  ngOnDestroy() {
    this.wsSub?.unsubscribe();
    this.wsDebounceSub?.unsubscribe();
    this.routerSub?.unsubscribe();
    this.swrSub?.unsubscribe();
    this.searchSubject.complete();
    if (this.flashTimeout) clearTimeout(this.flashTimeout);
  }

  refreshCurrentTab(showLoading = true, preserveState = false) {
    if (this.currentTab === 'my-tasks') this.loadTasks(showLoading, preserveState);
    else if (this.currentTab === 'pool') this.loadPoolTasks(showLoading, preserveState);
    else if (this.currentTab === 'doc') this.loadDocTasks(showLoading, preserveState);
    else this.loadDocPoolTasks(showLoading, preserveState);
  }

  private triggerFlash(id: number) {
    this.updatedTaskIds.add(id);
    if (this.flashTimeout) clearTimeout(this.flashTimeout);
    this.flashTimeout = setTimeout(() => {
      this.updatedTaskIds.clear();
      this.cdr.detectChanges();
    }, 4000);
  }

  updateCountTaskInPlace(taskData: any) {
    if (!taskData || !taskData.id) return;
    const id = taskData.id;

    if (taskData._deleted) {
      this.tasks = this.tasks.filter(t => t.id !== id);
      this.poolTasks = this.poolTasks.filter(t => t.id !== id);
      this.selectedTasks.delete(id);
      this.selectedPoolTasks.delete(id);
      this.applyFilters();
      return;
    }

    const isManagerStatus = taskData.status === 'MANAGER_REVIEW';

    if (!isManagerStatus) {
      // تسک از کارتابل بررسی مدیر خارج شده است (مثلاً تایید نهایی شده یا به بازشماری رفته)
      this.tasks = this.tasks.filter(t => t.id !== id);
      this.poolTasks = this.poolTasks.filter(t => t.id !== id);
      this.selectedTasks.delete(id);
      this.selectedPoolTasks.delete(id);
      this.applyFilters();
      return;
    }

    const currentUserId = this.auth.user()?.id;
    const isMyTask = taskData.assigned_manager === currentUserId ||
      (taskData.assigned_manager && typeof taskData.assigned_manager === 'object' && taskData.assigned_manager.id === currentUserId);
    const isPool = !taskData.assigned_manager;

    if (isMyTask || (!taskData.assigned_manager && this.currentTab === 'my-tasks')) {
      const idx = this.tasks.findIndex(t => t.id === id);
      if (idx !== -1) {
        this.tasks[idx] = { ...this.tasks[idx], ...taskData };
      } else {
        this.tasks = [taskData, ...this.tasks];
      }
      this.poolTasks = this.poolTasks.filter(t => t.id !== id);
      this.triggerFlash(id);
    } else if (isPool) {
      const idx = this.poolTasks.findIndex(t => t.id === id);
      if (idx !== -1) {
        this.poolTasks[idx] = { ...this.poolTasks[idx], ...taskData };
      } else {
        this.poolTasks = [taskData, ...this.poolTasks];
      }
      this.tasks = this.tasks.filter(t => t.id !== id);
      this.triggerFlash(id);
    }
    this.applyFilters();
  }

  updateDocTaskInPlace(taskData: any) {
    if (!taskData || !taskData.id) return;
    const id = taskData.id;

    if (taskData._deleted) {
      this.docTasks = this.docTasks.filter(t => t.id !== id);
      this.docPoolTasks = this.docPoolTasks.filter(t => t.id !== id);
      this.selectedDocTasks.delete(id);
      this.selectedDocPoolTasks.delete(id);
      this.applyFilters();
      return;
    }

    const isManagerDocStatus = taskData.status === 'DOC_MANAGER_REVIEW';

    if (!isManagerDocStatus) {
      this.docTasks = this.docTasks.filter(t => t.id !== id);
      this.docPoolTasks = this.docPoolTasks.filter(t => t.id !== id);
      this.selectedDocTasks.delete(id);
      this.selectedDocPoolTasks.delete(id);
      this.applyFilters();
      return;
    }

    const currentUserId = this.auth.user()?.id;
    const isMyDoc = taskData.assigned_manager === currentUserId ||
      (taskData.assigned_manager && typeof taskData.assigned_manager === 'object' && taskData.assigned_manager.id === currentUserId);
    const isPool = !taskData.assigned_manager;

    if (isMyDoc || (!taskData.assigned_manager && this.currentTab === 'doc')) {
      const idx = this.docTasks.findIndex(t => t.id === id);
      if (idx !== -1) {
        this.docTasks[idx] = { ...this.docTasks[idx], ...taskData };
      } else {
        this.docTasks = [taskData, ...this.docTasks];
      }
      this.docPoolTasks = this.docPoolTasks.filter(t => t.id !== id);
      this.triggerFlash(id);
    } else if (isPool) {
      const idx = this.docPoolTasks.findIndex(t => t.id === id);
      if (idx !== -1) {
        this.docPoolTasks[idx] = { ...this.docPoolTasks[idx], ...taskData };
      } else {
        this.docPoolTasks = [taskData, ...this.docPoolTasks];
      }
      this.docTasks = this.docTasks.filter(t => t.id !== id);
      this.triggerFlash(id);
    }
    this.applyFilters();
  }

  fetchSingleCountTask(taskId: number) {
    this.countTaskApi.getById(String(taskId)).subscribe({
      next: (task) => {
        if (task) this.updateCountTaskInPlace(task);
      },
      error: () => {
        this.wsUpdateSubject.next(taskId);
      }
    });
  }

  fetchSingleDocTask(taskId: number) {
    this.docTaskApi.getById(taskId).subscribe({
      next: (task) => {
        if (task) this.updateDocTaskInPlace(task);
      },
      error: () => {
        this.wsUpdateSubject.next(taskId);
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

  normalizeDigits(str: string): string {
    if (!str) return '';
    return str
      .replace(/[۰-۹]/g, d => '0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(d)])
      .replace(/[٠-٩]/g, d => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)]);
  }

  // ── URL State Persistence ──
  private syncStateFromUrl() {
    if (!this.router.url.split('?')[0].includes('/manager-review')) return;
    const params = this.router.parseUrl(this.router.url).queryParams;
    
    // 1. Tab
    const tab = params['tab'] as typeof this.currentTab;
    const validTabs: typeof this.currentTab[] = ['my-tasks', 'pool', 'doc', 'doc-pool'];
    const resolved = validTabs.includes(tab) ? tab : 'my-tasks';
    if (resolved !== this.currentTab) {
      this.currentTab = resolved;
      this.selectedTasks.clear();
      this.selectedPoolTasks.clear();
      this.selectedDocTasks.clear();
      this.selectedDocPoolTasks.clear();
      this.selectedTask = null;
      this.selectedDetailTask = null;
      this.singleRejectTask = null;
    }

    // 2. Search Query
    if (params['q'] !== undefined && params['q'] !== this.searchQuery) {
      this.searchQuery = params['q'] || '';
    }

    // 3. Status Filter
    const st = params['status'] as typeof this.statusFilter;
    const validStatuses: typeof this.statusFilter[] = ['all', 'pending', 'recount', 'initial', 'completed'];
    if (st && validStatuses.includes(st)) {
      this.statusFilter = st;
    }

    // 4. Date Filter
    const df = params['date'] as typeof this.dateFilter;
    const validDates: typeof this.dateFilter[] = ['all', 'today', 'yesterday', 'week'];
    if (df && validDates.includes(df)) {
      this.dateFilter = df;
    }

    this.refreshCurrentTab();
    if (this.currentTab === 'my-tasks' || this.currentTab === 'pool') {
      this.loadDocTasks();
      this.loadDocPoolTasks();
    }
    this.cdr.detectChanges();
  }

  private updateUrlState() {
    const queryParams: any = { tab: this.currentTab };
    if (this.searchQuery && this.searchQuery.trim()) queryParams.q = this.searchQuery.trim();
    if (this.statusFilter && this.statusFilter !== 'pending') queryParams.status = this.statusFilter;
    if (this.dateFilter && this.dateFilter !== 'all') queryParams.date = this.dateFilter;

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      replaceUrl: true
    });
  }

  setTab(tab: 'my-tasks' | 'pool' | 'doc' | 'doc-pool') {
    this.currentTab = tab;
    this.clearAllSelections();
    this.selectedDetailTask = null;
    this.singleRejectTask = null;
    this.updateUrlState();
    this.refreshCurrentTab();
  }

  onSearchChange(val: string) {
    this.searchQuery = val;
    this.searchSubject.next(val);
  }

  onSearchEnter() {
    this.applyFilters();
    this.updateUrlState();
  }

  clearSearch() {
    this.searchQuery = '';
    this.applyFilters();
    this.updateUrlState();
  }

  setStatusFilter(filter: 'all' | 'pending' | 'recount' | 'initial' | 'completed') {
    this.statusFilter = filter;
    this.applyFilters();
    this.updateUrlState();
  }

  setDateFilter(filter: 'all' | 'today' | 'yesterday' | 'week') {
    this.dateFilter = filter;
    this.applyFilters();
    this.updateUrlState();
  }

  // ── Smart Selection Actions ──
  selectMatchedTasks() {
    const matched = this.filteredTasks.filter(t => this.isMatched(t));
    if (matched.length === 0) {
      this.toast.show('info', 'هیچ کالای منطبقی در این لیست وجود ندارد.');
      return;
    }
    matched.forEach(t => this.selectedTasks.add(t.id));
    this.selectedTasks = new Set(this.selectedTasks);
    this.toast.show('success', `${matched.length} کالای منطبق (بدون مغایرت) انتخاب شدند.`);
    this.cdr.detectChanges();
  }

  clearAllSelections() {
    this.selectedTasks.clear();
    this.selectedPoolTasks.clear();
    this.selectedDocTasks.clear();
    this.selectedDocPoolTasks.clear();
    this.cdr.detectChanges();
  }

  // ── Filter Application & Live Stats Calculation ──
  applyFilters() {
    const query = (this.searchQuery || '').toLowerCase().trim();
    const normQuery = this.normalizeDigits(query);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = today - 86400000;
    const week = today - 7 * 86400000;

    // 1. Filter and Stats for My Tasks
    const allCountTasks = this.tasks;
    this.totalTasksCount = allCountTasks.length;
    this.matchedTasksCount = allCountTasks.filter(t => this.isMatched(t)).length;
    this.mismatchedTasksCount = allCountTasks.filter(t => !this.isMatched(t)).length;
    this.remainingTasksCount = allCountTasks.length;
    this.completedTasksCount = 0; // manager review shows pending tasks

    // Live counts for status chips
    this.statusCounts = {
      pending: allCountTasks.length,
      recount: this.mismatchedTasksCount,
      initial: this.matchedTasksCount,
      completed: 0,
      all: allCountTasks.length
    };

    this.filteredTasks = allCountTasks.filter(t => {
      // Date Filter
      let matchDate = true;
      const dateStr = (t as any).updated_at || t.created_at;
      if (dateStr && this.dateFilter !== 'all') {
        const taskDate = new Date(dateStr).getTime();
        if (this.dateFilter === 'today') matchDate = taskDate >= today;
        else if (this.dateFilter === 'yesterday') matchDate = taskDate >= yesterday && taskDate < today;
        else if (this.dateFilter === 'week') matchDate = taskDate >= week;
      }
      if (!matchDate) return false;

      // Status Filter
      if (this.statusFilter === 'recount' && this.isMatched(t)) return false;
      if (this.statusFilter === 'initial' && !this.isMatched(t)) return false;

      // Text Search Filter
      if (query) {
        const faCode = (t.item_details?.fa_unic_code || '').toLowerCase();
        const desc = (t.item_details?.description || '').toLowerCase();
        const newLoc = (t.item_details?.new_location || '').toLowerCase();
        const oldLoc = (t.item_details?.old_location || '').toLowerCase();
        const counter = (t.counter_name || '').toLowerCase();
        const supervisor = ((t as any).supervisor_name || '').toLowerCase();
        const counterNote = (t.counter_note || '').toLowerCase();
        const managerNote = (t.manager_note || '').toLowerCase();

        const match = faCode.includes(query) || faCode.includes(normQuery) ||
                      desc.includes(query) ||
                      newLoc.includes(query) ||
                      oldLoc.includes(query) ||
                      counter.includes(query) ||
                      supervisor.includes(query) ||
                      counterNote.includes(query) ||
                      managerNote.includes(query);

        if (!match) return false;
      }

      return true;
    });

    // 2. Filter for Pool Tasks
    this.filteredPoolTasks = this.poolTasks.filter(t => {
      if (!query) return true;
      const faCode = (t.item_details?.fa_unic_code || '').toLowerCase();
      const desc = (t.item_details?.description || '').toLowerCase();
      const loc = (t.item_details?.new_location || t.item_details?.old_location || '').toLowerCase();
      return faCode.includes(query) || faCode.includes(normQuery) || desc.includes(query) || loc.includes(query);
    });

    // 3. Filter for Doc Tasks
    this.filteredDocTasks = this.docTasks.filter(t => {
      if (!query) return true;
      const faCode = (t.item_details?.fa_unic_code || '').toLowerCase();
      const desc = (t.item_details?.description || '').toLowerCase();
      const supplier = (t.doc_supplier || '').toLowerCase();
      const note = (t.worker_note || t.supervisor_note || t.manager_note || '').toLowerCase();
      return faCode.includes(query) || faCode.includes(normQuery) || desc.includes(query) || supplier.includes(query) || note.includes(query);
    });

    // 4. Filter for Doc Pool Tasks
    this.filteredDocPoolTasks = this.docPoolTasks.filter(t => {
      if (!query) return true;
      const faCode = (t.item_details?.fa_unic_code || '').toLowerCase();
      const desc = (t.item_details?.description || '').toLowerCase();
      return faCode.includes(query) || faCode.includes(normQuery) || desc.includes(query);
    });

    this.cdr.detectChanges();
  }

  // ════════════════════════════════════════════
  //  My Tasks Tab
  // ════════════════════════════════════════════

  loadTasks(showLoading = true, preserveState = false) {
    if (!preserveState) {
      this.selectedTasks.clear();
    }
    if (showLoading) {
      this.isLoading = true;
      this.cdr.detectChanges();
    }
    const params: any = { as_role: 'manager', status: 'MANAGER_REVIEW' };
    const whId = this.state.appState.activeWarehouseId;
    if (whId && whId !== 'ALL' && whId !== -1) params.warehouse_id = whId;

    this.countTaskApi.getAll(params).subscribe({
      next: (res: any) => {
        const all = Array.isArray(res) ? res : (res.results || []);
        const newTasks = all.filter((t: CountTask) => t.status === 'MANAGER_REVIEW');
        this.trackUpdates(this.tasks, newTasks);
        this.tasks = newTasks;
        if (preserveState) {
          const validIds = new Set(this.tasks.map(t => t.id));
          this.selectedTasks = new Set(Array.from(this.selectedTasks).filter(id => validIds.has(id)));
        }
        this.applyFilters();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.toast.show('error', 'خطا در دریافت لیست بررسی');
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  toggleSelection(taskId: number) {
    if (this.selectedTasks.has(taskId)) this.selectedTasks.delete(taskId);
    else this.selectedTasks.add(taskId);
    this.selectedTasks = new Set(this.selectedTasks);
    this.cdr.detectChanges();
  }

  toggleAll(event?: Event) {
    if (event) {
      const checked = (event.target as HTMLInputElement).checked;
      if (checked) this.filteredTasks.forEach(t => this.selectedTasks.add(t.id));
      else this.selectedTasks.clear();
    } else {
      if (this.selectedTasks.size === this.filteredTasks.length && this.filteredTasks.length > 0) {
        this.selectedTasks.clear();
      } else {
        this.filteredTasks.forEach(t => this.selectedTasks.add(t.id));
      }
    }
    this.selectedTasks = new Set(this.selectedTasks);
    this.cdr.detectChanges();
  }

  isAllSelected() {
    return this.filteredTasks.length > 0 && this.selectedTasks.size === this.filteredTasks.length;
  }

  // ── Single & Detail Action Methods ──
  openTaskDetail(task: CountTask) {
    this.selectedDetailTask = task;
    this.detailManagerNote = task.manager_note || '';
    this.cdr.detectChanges();
  }

  closeTaskDetail() {
    this.selectedDetailTask = null;
    this.detailManagerNote = '';
    this.cdr.detectChanges();
  }

  approveDetailTask() {
    if (!this.selectedDetailTask) return;
    const task = this.selectedDetailTask;
    const taskId = task.id;

    // اعمال خوش‌بینانه
    this.tasks = this.tasks.filter(t => t.id !== taskId);
    this.selectedTasks.delete(taskId);
    this.closeTaskDetail();
    this.applyFilters();

    this.countTaskApi.bulkManagerApprove([taskId], this.detailManagerNote).subscribe({
      next: (res: any) => {
        const isOffline = res?._offlinePending || !navigator.onLine;
        if (isOffline) {
          this.toast.show('info', 'تایید نهایی کالا در صف ارسال آفلاین قرار گرفت.');
        } else {
          this.toast.show('success', res?.message || 'تایید نهایی با موفقیت ثبت شد');
        }
        this.loadTasks(false, true);
      },
      error: () => {
        this.toast.show('error', 'خطا در تایید کالا');
        this.loadTasks(false, true);
      }
    });
  }

  rejectDetailTask() {
    if (!this.selectedDetailTask) return;
    if (!this.detailManagerNote.trim()) {
      return this.toast.show('error', 'لطفاً علت رد (دستورات به سرپرست) را در یادداشت مدیر بنویسید.');
    }
    const task = this.selectedDetailTask;
    const taskId = task.id;

    // اعمال خوش‌بینانه
    this.tasks = this.tasks.filter(t => t.id !== taskId);
    this.selectedTasks.delete(taskId);
    this.closeTaskDetail();
    this.applyFilters();

    this.countTaskApi.managerReject(taskId, this.detailManagerNote).subscribe({
      next: (res: any) => {
        const isOffline = res?._offlinePending || !navigator.onLine;
        if (isOffline) {
          this.toast.show('info', 'ارجاع به بازشماری در صف آفلاین ذخیره شد.');
        } else {
          this.toast.show('success', res?.message || 'کالا جهت بازشماری ارجاع داده شد.');
        }
        this.loadTasks(false, true);
      },
      error: (err) => {
        this.toast.show('error', err?.error?.error || 'خطا در ثبت رد کالا');
        this.loadTasks(false, true);
      }
    });
  }

  approveSingle(task: CountTask) {
    const taskId = task.id;
    // اعمال خوش‌بینانه
    this.tasks = this.tasks.filter(t => t.id !== taskId);
    this.selectedTasks.delete(taskId);
    this.applyFilters();

    this.countTaskApi.bulkManagerApprove([taskId], '').subscribe({
      next: (res: any) => {
        const isOffline = res?._offlinePending || !navigator.onLine;
        if (isOffline) {
          this.toast.show('info', 'تایید کالا در صف آفلاین ذخیره شد.');
        } else {
          this.toast.show('success', res?.message || `${task.item_details?.fa_unic_code} تایید شد`);
        }
        this.loadTasks(false, true);
      },
      error: () => {
        this.toast.show('error', 'خطا در تایید کالا');
        this.loadTasks(false, true);
      }
    });
  }

  openRejectDialog(task: CountTask) {
    this.singleRejectTask = task;
    this.singleRejectNote = '';
    this.cdr.detectChanges();
  }

  closeRejectDialog() {
    this.singleRejectTask = null;
    this.singleRejectNote = '';
    this.cdr.detectChanges();
  }

  confirmSingleReject() {
    if (!this.singleRejectTask) return;
    if (!this.singleRejectNote.trim()) {
      return this.toast.show('error', 'لطفاً علت درخواست بازشماری را بنویسید.');
    }
    const taskId = this.singleRejectTask.id;

    // اعمال خوش‌بینانه
    this.tasks = this.tasks.filter(t => t.id !== taskId);
    this.selectedTasks.delete(taskId);
    this.closeRejectDialog();
    this.applyFilters();

    this.countTaskApi.managerReject(taskId, this.singleRejectNote).subscribe({
      next: (res: any) => {
        const isOffline = res?._offlinePending || !navigator.onLine;
        if (isOffline) {
          this.toast.show('info', 'ارجاع به بازشماری در صف آفلاین ذخیره شد.');
        } else {
          this.toast.show('success', res?.message || 'کالا جهت بازشماری ارجاع داده شد.');
        }
        this.loadTasks(false, true);
      },
      error: (err) => {
        this.toast.show('error', err?.error?.error || 'خطا در ثبت اطلاعات');
        this.loadTasks(false, true);
      }
    });
  }

  openApproveDialog() {
    if (this.selectedTasks.size === 0) return;
    this.approveNote = '';
    this.showApproveDialog = true;
    this.cdr.detectChanges();
  }

  cancelApprove() {
    this.showApproveDialog = false;
    this.approveNote = '';
    this.cdr.detectChanges();
  }

  confirmApprove() {
    if (this.selectedTasks.size === 0) return;
    const taskIds = Array.from(this.selectedTasks);
    const count = taskIds.length;

    // اعمال خوش‌بینانه
    this.tasks = this.tasks.filter(t => !taskIds.includes(t.id));
    this.selectedTasks.clear();
    this.showApproveDialog = false;
    this.applyFilters();

    this.countTaskApi.bulkManagerApprove(taskIds, this.approveNote).subscribe({
      next: (res: any) => {
        const isOffline = res?._offlinePending || !navigator.onLine;
        if (isOffline) {
          this.toast.show('info', `تایید نهایی ${count} کالا در صف آفلاین ذخیره شد.`);
        } else {
          this.toast.show('success', res?.message || `${count} کالا با موفقیت تایید نهایی شدند.`);
        }
        this.loadTasks(false, true);
      },
      error: () => {
        this.toast.show('error', 'خطا در تایید گروهی');
        this.loadTasks(false, true);
      }
    });
  }

  selectTask(task: CountTask) {
    this.selectedTask = task;
    this.managerNote = task.manager_note || '';
    this.cdr.detectChanges();
  }

  cancelReview() {
    this.selectedTask = null;
    this.managerNote = '';
    this.cdr.detectChanges();
  }

  approveTask() {
    if (!this.selectedTask) return;
    const taskId = this.selectedTask.id;

    // اعمال خوش‌بینانه
    this.tasks = this.tasks.filter(t => t.id !== taskId);
    this.selectedTasks.delete(taskId);
    this.selectedTask = null;
    this.applyFilters();

    this.countTaskApi.bulkManagerApprove([taskId], this.managerNote).subscribe({
      next: (res: any) => {
        const isOffline = res?._offlinePending || !navigator.onLine;
        if (isOffline) {
          this.toast.show('info', 'تایید نهایی در صف آفلاین ذخیره شد.');
        } else {
          this.toast.show('success', res?.message || 'تایید نهایی با موفقیت انجام شد');
        }
        this.loadTasks(false, true);
      },
      error: () => {
        this.toast.show('error', 'خطا در ثبت اطلاعات');
        this.loadTasks(false, true);
      }
    });
  }

  rejectTask() {
    if (!this.managerNote.trim()) {
      return this.toast.show('error', 'لطفاً علت درخواست بازشماری (دستورات به سرپرست) را بنویسید.');
    }
    if (!this.selectedTask) return;
    const taskId = this.selectedTask.id;

    // اعمال خوش‌بینانه
    this.tasks = this.tasks.filter(t => t.id !== taskId);
    this.selectedTasks.delete(taskId);
    this.selectedTask = null;
    this.applyFilters();

    this.countTaskApi.managerReject(taskId, this.managerNote).subscribe({
      next: (res: any) => {
        const isOffline = res?._offlinePending || !navigator.onLine;
        if (isOffline) {
          this.toast.show('info', 'ارجاع به بازشماری در صف آفلاین ذخیره شد.');
        } else {
          this.toast.show('success', res?.message || 'کالا با موفقیت جهت بازشماری ارجاع داده شد.');
        }
        this.loadTasks(false, true);
      },
      error: (err) => {
        this.toast.show('error', err?.error?.error || 'خطا در ثبت اطلاعات');
        this.loadTasks(false, true);
      }
    });
  }

  openBulkRejectDialog() {
    if (this.selectedTasks.size === 0) return;
    this.bulkRejectNote = '';
    this.showBulkRejectDialog = true;
    this.cdr.detectChanges();
  }

  cancelBulkReject() {
    this.showBulkRejectDialog = false;
    this.bulkRejectNote = '';
    this.cdr.detectChanges();
  }

  confirmBulkReject() {
    if (this.selectedTasks.size === 0) return;
    if (!this.bulkRejectNote.trim()) {
      return this.toast.show('error', 'لطفاً علت درخواست بازشماری (دستورات به سرپرست) را بنویسید.');
    }
    const taskIds = Array.from(this.selectedTasks);
    const count = taskIds.length;

    // اعمال خوش‌بینانه
    this.tasks = this.tasks.filter(t => !taskIds.includes(t.id));
    this.selectedTasks.clear();
    this.showBulkRejectDialog = false;
    this.applyFilters();

    this.countTaskApi.bulkManagerReject(taskIds, this.bulkRejectNote).subscribe({
      next: (res: any) => {
        const isOffline = res?._offlinePending || !navigator.onLine;
        if (isOffline) {
          this.toast.show('info', `ارجاع ${count} کالا به بازشماری در صف آفلاین ذخیره شد.`);
        } else {
          this.toast.show('success', res?.message || `${count} کالا با موفقیت جهت بازشماری ارجاع داده شدند.`);
        }
        this.loadTasks(false, true);
      },
      error: (err) => {
        this.toast.show('error', err?.error?.error || 'خطا در ثبت اطلاعات');
        this.loadTasks(false, true);
      }
    });
  }

  isMatched(task: CountTask | null): boolean {
    if (!task || !task.item_details || task.counted_balance === null || task.counted_balance === undefined) return false;
    const counted = parseFloat(String(task.counted_balance));
    const system = task.item_details.bal4miv !== undefined && task.item_details.bal4miv !== null 
      ? parseFloat(String(task.item_details.bal4miv)) 
      : (task.item_details.inventory !== undefined && task.item_details.inventory !== null ? parseFloat(String(task.item_details.inventory)) : null);
    if (isNaN(counted) || system === null || isNaN(system)) return false;
    return Math.abs(counted - system) < 0.0001;
  }

  // ════════════════════════════════════════════
  //  Pool Tab
  // ════════════════════════════════════════════

  loadPoolTasks(showLoading = true, preserveState = false) {
    if (!preserveState) {
      this.selectedPoolTasks.clear();
    }
    if (showLoading) {
      this.isLoading = true;
      this.cdr.detectChanges();
    }
    const params: any = { as_role: 'manager' };
    const whId = this.state.appState.activeWarehouseId;
    if (whId && whId !== 'ALL' && whId !== -1) params.warehouse_id = whId;

    this.http.get<CountTask[]>(`${environment.apiUrl}/inventory/count-tasks/pool_tasks/`, { params }).subscribe({
      next: (res: any) => {
        const newPoolTasks = Array.isArray(res) ? res : (res.results || []);
        this.trackUpdates(this.poolTasks, newPoolTasks);
        this.poolTasks = newPoolTasks;
        if (preserveState) {
          const validIds = new Set(this.poolTasks.map(t => t.id));
          this.selectedPoolTasks = new Set(Array.from(this.selectedPoolTasks).filter(id => validIds.has(id)));
        }
        this.applyFilters();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.toast.show('error', 'خطا در دریافت استخر تسک‌ها');
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  togglePoolSelection(taskId: number) {
    if (this.selectedPoolTasks.has(taskId)) this.selectedPoolTasks.delete(taskId);
    else this.selectedPoolTasks.add(taskId);
    this.selectedPoolTasks = new Set(this.selectedPoolTasks);
    this.cdr.detectChanges();
  }

  claimSelectedTasks() {
    if (this.selectedPoolTasks.size === 0) return;
    this.http.post(`${environment.apiUrl}/inventory/count-tasks/claim_tasks/`, {
      task_ids: Array.from(this.selectedPoolTasks),
      as_role: 'manager'
    }).subscribe({
      next: (res: any) => {
        this.toast.show('success', `${res.claimed_count} کالا با موفقیت به عهده گرفته شد`);
        this.setTab('my-tasks');
      },
      error: (err: any) => {
        this.toast.show('error', err?.error?.error || 'خطا در عملیات');
        this.cdr.detectChanges();
      }
    });
  }

  // ════════════════════════════════════════════
  //  Doc Task Tab
  // ════════════════════════════════════════════

  loadDocTasks(showLoading = true, preserveState = false) {
    if (!preserveState) {
      this.selectedDocTasks.clear();
    }
    if (showLoading) {
      this.isDocLoading = true;
      this.cdr.detectChanges();
    }
    const params: any = { as_role: 'manager', page_size: 1000 };
    const whId = this.state.appState.activeWarehouseId;
    if (whId && whId !== 'ALL' && whId !== -1) params.warehouse_id = whId;

    this.docTaskApi.getAll(params).subscribe({
      next: (res: any) => {
        const all: DocTask[] = Array.isArray(res) ? res : (res.results || []);
        const newDocTasks = all.filter(t => t.status === 'DOC_MANAGER_REVIEW' && t.assigned_manager !== null);
        this.trackUpdates(this.docTasks, newDocTasks);
        this.docTasks = newDocTasks;
        if (preserveState) {
          const validIds = new Set(this.docTasks.map(t => t.id));
          this.selectedDocTasks = new Set(Array.from(this.selectedDocTasks).filter(id => validIds.has(id)));
        }
        this.applyFilters();
        this.isDocLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.toast.show('error', 'خطا در دریافت اسناد مالی');
        this.isDocLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  toggleDocSelection(id: number) {
    if (this.selectedDocTasks.has(id)) this.selectedDocTasks.delete(id);
    else this.selectedDocTasks.add(id);
    this.selectedDocTasks = new Set(this.selectedDocTasks);
    this.cdr.detectChanges();
  }

  toggleAllDoc(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) this.docTasks.forEach(t => this.selectedDocTasks.add(t.id));
    else this.selectedDocTasks.clear();
    this.selectedDocTasks = new Set(this.selectedDocTasks);
    this.cdr.detectChanges();
  }

  isAllDocSelected() {
    return this.docTasks.length > 0 && this.selectedDocTasks.size === this.docTasks.length;
  }

  openDocApproveDialog() {
    if (this.selectedDocTasks.size === 0) return;
    this.docApproveNote = '';
    this.showDocApproveDialog = true;
    this.cdr.detectChanges();
  }

  cancelDocApprove() {
    this.showDocApproveDialog = false;
    this.docApproveNote = '';
    this.cdr.detectChanges();
  }

  confirmDocApprove() {
    if (this.selectedDocTasks.size === 0) return;
    const taskIds = Array.from(this.selectedDocTasks);
    const count = taskIds.length;

    // اعمال خوش‌بینانه
    this.docTasks = this.docTasks.filter(t => !taskIds.includes(t.id));
    this.selectedDocTasks.clear();
    this.showDocApproveDialog = false;
    this.applyFilters();

    this.docTaskApi.bulkManagerApprove(taskIds, this.docApproveNote).subscribe({
      next: (res: any) => {
        const isOffline = res?._offlinePending || !navigator.onLine;
        if (isOffline) {
          this.toast.show('info', `تایید نهایی ${count} سند در صف آفلاین ذخیره شد.`);
        } else {
          this.toast.show('success', res?.message || `${count} سند با موفقیت تایید شد`);
        }
        this.loadDocTasks(false, true);
      },
      error: () => {
        this.toast.show('error', 'خطا در تایید اسناد');
        this.loadDocTasks(false, true);
      }
    });
  }

  openDocRejectDialog() {
    if (this.selectedDocTasks.size === 0) return;
    this.docRejectNote = '';
    this.showDocRejectDialog = true;
    this.cdr.detectChanges();
  }

  closeDocRejectDialog() {
    this.showDocRejectDialog = false;
    this.docRejectNote = '';
    this.cdr.detectChanges();
  }

  confirmDocReject() {
    if (!this.docRejectNote.trim()) { this.toast.show('error', 'لطفاً دلیل رد را بنویسید'); return; }
    const taskIds = Array.from(this.selectedDocTasks);
    const count = taskIds.length;

    // اعمال خوش‌بینانه
    this.docTasks = this.docTasks.filter(t => !taskIds.includes(t.id));
    this.selectedDocTasks.clear();
    this.closeDocRejectDialog();
    this.applyFilters();

    this.docTaskApi.managerReject(taskIds, this.docRejectNote).subscribe({
      next: (res: any) => {
        const isOffline = res?._offlinePending || !navigator.onLine;
        if (isOffline) {
          this.toast.show('info', `رد ${count} سند در صف آفلاین ذخیره شد.`);
        } else {
          this.toast.show('success', res?.message || `${count} سند با موفقیت رد شد`);
        }
        this.loadDocTasks(false, true);
      },
      error: () => {
        this.toast.show('error', 'خطا در رد اسناد');
        this.loadDocTasks(false, true);
      }
    });
  }

  // ════════════════════════════════════════════
  //  Doc Pool Tab
  // ════════════════════════════════════════════

  loadDocPoolTasks(showLoading = true, preserveState = false) {
    if (!preserveState) {
      this.selectedDocPoolTasks.clear();
    }
    if (showLoading) {
      this.isDocPoolLoading = true;
      this.cdr.detectChanges();
    }
    const params: any = { as_role: 'manager' };
    const whId = this.state.appState.activeWarehouseId;
    if (whId && whId !== 'ALL' && whId !== -1) params.warehouse_id = whId;

    this.http.get<DocTask[]>(`${environment.apiUrl}/inventory/doc-tasks/pool_tasks/`, { params }).subscribe({
      next: (res: any) => {
        const newDocPoolTasks = Array.isArray(res) ? res : (res.results || []);
        this.trackUpdates(this.docPoolTasks, newDocPoolTasks);
        this.docPoolTasks = newDocPoolTasks;
        if (preserveState) {
          const validIds = new Set(this.docPoolTasks.map(t => t.id));
          this.selectedDocPoolTasks = new Set(Array.from(this.selectedDocPoolTasks).filter(id => validIds.has(id)));
        }
        this.applyFilters();
        this.isDocPoolLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.toast.show('error', 'خطا در دریافت استخر اسناد');
        this.isDocPoolLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  toggleDocPoolSelection(id: number) {
    if (this.selectedDocPoolTasks.has(id)) this.selectedDocPoolTasks.delete(id);
    else this.selectedDocPoolTasks.add(id);
    this.selectedDocPoolTasks = new Set(this.selectedDocPoolTasks);
    this.cdr.detectChanges();
  }

  toggleAllDocPool(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) this.docPoolTasks.forEach(t => this.selectedDocPoolTasks.add(t.id));
    else this.selectedDocPoolTasks.clear();
    this.selectedDocPoolTasks = new Set(this.selectedDocPoolTasks);
    this.cdr.detectChanges();
  }

  isAllDocPoolSelected() {
    return this.docPoolTasks.length > 0 && this.selectedDocPoolTasks.size === this.docPoolTasks.length;
  }

  claimSelectedDocTasks() {
    if (this.selectedDocPoolTasks.size === 0) return;
    this.http.post(`${environment.apiUrl}/inventory/doc-tasks/claim_tasks/`, {
      task_ids: Array.from(this.selectedDocPoolTasks),
      as_role: 'manager'
    }).subscribe({
      next: (res: any) => {
        this.toast.show('success', `${res.claimed_count} سند با موفقیت به عهده گرفته شد`);
        this.setTab('doc');
      },
      error: (err: any) => {
        this.toast.show('error', err?.error?.error || 'خطا در عملیات');
        this.cdr.detectChanges();
      }
    });
  }

  // Export Methods
  openExportModal() {
    this.isExportModalOpen = true;
    this.exportDataScope = this.currentSelectedTasks.size > 0 ? 'selected' : 'all';
    this.exportColumnScope = 'all_db';
    this.selectedExportColumns.clear();
    
    // We fetch columns dynamically based on the active section (Count vs Doc)
    const api = this.activeSection === 'counting' ? this.countTaskApi : this.docTaskApi;
    api.getExportColumns().subscribe({
      next: (cols) => {
        this.availableExportColumns = cols;
        this.cdr.detectChanges();
      }
    });
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
    
    const isCount = this.activeSection === 'counting';
    const role = 'manager';
    const api = isCount ? this.countTaskApi : this.docTaskApi;

    const payload: any = {
      data_scope: this.exportDataScope,
      columns_scope: this.exportColumnScope,
      as_role: role,
    };
    
    if (this.exportDataScope === 'selected') {
      payload.selected_ids = Array.from(this.currentSelectedTasks);
    }
    
    if (this.exportColumnScope === 'custom') {
      payload.columns_list = Array.from(this.selectedExportColumns);
    }
    
    const params: any = { as_role: role, page_size: 100000 };
    const whId = this.state.appState.activeWarehouseId;
    if (whId && whId !== 'ALL' && whId !== -1) {
      params.warehouse_id = whId;
    }

    this.exportSubscription = api.exportExcel({ ...payload, ...params }).subscribe({
      next: (blob) => {
        try {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `export_manager_${new Date().getTime()}.xlsx`;
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
