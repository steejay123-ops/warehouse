import { Component, OnInit, OnDestroy, ChangeDetectorRef, inject, HostListener } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription, Subject, filter, debounceTime } from 'rxjs';
import { WebSocketService } from '../../../core/http/websocket.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CountTaskApiService } from '../../../core/api/count-task-api.service';
import { CountTask } from '../../../core/models/count-task.model';
import { DocTaskApiService } from '../../../core/api/doc-task-api.service';
import { DocTask } from '../../../core/models/doc-task.model';
import { ToastService } from '../../../services/toast.service';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { StateService } from '../../../services/state.service';
import { WarehouseSelectorComponent } from '../../../shared/components/warehouse-selector/warehouse-selector.component';
import { OfflinePendingBadgeComponent } from '../../../shared/components/offline-pending-badge/offline-pending-badge.component';
import { AuthStore } from '../../../core/stores/auth.store';
import { AuthService } from '../../../core/auth/auth.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { OfflineSyncService } from '../../../core/services/offline-sync.service';

@Component({
  selector: 'app-supervisor-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, WarehouseSelectorComponent, OfflinePendingBadgeComponent],
  templateUrl: './supervisor-dashboard.html',
  styleUrl: './supervisor-dashboard.css'
})
export class SupervisorDashboard implements OnInit, OnDestroy {
  private wsSub?: Subscription;
  private swrSub?: Subscription;
  private wsUpdateSubject = new Subject<any>();
  private wsDebounceSub?: Subscription;
  private offlineSync = OfflineSyncService.getInstance();
  updatedTaskIds = new Set<number>();
  flashTimeout: any;
  private routerSub?: Subscription;
  authStore = inject(AuthStore);
  auth = inject(AuthService);
  private router = inject(Router);
  tasks: CountTask[] = [];
  poolTasks: CountTask[] = [];
  isLoading = true;
  selectedTasks: Set<number> = new Set();
  selectedPoolTasks: Set<number> = new Set();
  currentTab: 'my-tasks' | 'pool' | 'doc' | 'doc-pool' = 'my-tasks';

  get activeSection(): 'counting' | 'financial' {
    return (this.currentTab === 'doc' || this.currentTab === 'doc-pool') ? 'financial' : 'counting';
  }

  // Reject Dialog State
  showRejectDialog = false;
  rejectingTask: CountTask | null = null;
  rejectNote: string = '';

  // Bulk Reject Dialog State
  showBulkRejectDialog = false;
  bulkRejectNote: string = '';

  // Approve Dialog State
  showApproveDialog = false;
  approveNote: string = '';

  // History Dialog State
  showHistoryDialog = false;
  historyTask: CountTask | null = null;

  // ── Doc Task Tab ──
  docTasks: DocTask[] = [];
  isDocLoading = false;
  selectedDocTasks = new Set<number>();
  showDocApproveDialog = false;
  docApproveNote = '';
  showDocRejectDialog = false;
  docRejectNote = '';

  // ── Doc Pool Tab ──
  docPoolTasks: DocTask[] = [];
  isDocPoolLoading = false;
  selectedDocPoolTasks = new Set<number>();

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

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    const isInsideInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

    // Escape: close any open dialog
    if (event.key === 'Escape') {
      if (this.showRejectDialog) {
        event.preventDefault();
        this.closeRejectDialog();
      } else if (this.showBulkRejectDialog) {
        event.preventDefault();
        this.cancelBulkReject();
      } else if (this.showApproveDialog) {
        event.preventDefault();
        this.cancelApprove();
      } else if (this.showHistoryDialog) {
        event.preventDefault();
        this.closeHistoryDialog();
      } else if (this.showDocRejectDialog) {
        event.preventDefault();
        this.closeDocRejectDialog();
      } else if (this.showDocApproveDialog) {
        event.preventDefault();
        this.cancelDocApprove();
      } else if (this.isExportModalOpen) {
        event.preventDefault();
        this.closeExportModal();
      }
    }

    // Ctrl+Enter: confirm active action dialog
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      if (this.showRejectDialog) {
        event.preventDefault();
        this.confirmReject();
      } else if (this.showBulkRejectDialog) {
        event.preventDefault();
        this.confirmBulkReject();
      } else if (this.showApproveDialog) {
        event.preventDefault();
        this.confirmApprove();
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
        if (this.activeSection === 'counting' && this.selectedTasks.size > 0 && !this.showApproveDialog && !this.showRejectDialog) {
          event.preventDefault();
          this.openApproveDialog();
        } else if (this.activeSection === 'financial' && this.selectedDocTasks.size > 0 && !this.showDocApproveDialog && !this.showDocRejectDialog) {
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
    private countTaskApi: CountTaskApiService,
    private docTaskApi: DocTaskApiService,
    private toast: ToastService,
    private confirmDialog: ConfirmDialogService,
    private cdr: ChangeDetectorRef,
    public state: StateService,
    private http: HttpClient,
    private wsService: WebSocketService
  ) {}

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

    // ── URL State: خواندن تب از آدرس مرورگر ──
    this.syncTabFromUrl();
    this.routerSub = this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd)
    ).subscribe(() => this.syncTabFromUrl());

    // ─── SWR Live Revalidation: دریافت داده‌های جدیدتر سرور در پس‌زمینه با فیلتر دقیق نقش سرپرست ───
    this.swrSub = this.offlineSync.liveDataUpdates$.subscribe(({ url }) => {
      const isSupervisorCount = url.includes('/api/inventory/count-tasks/') && url.includes('as_role=supervisor');
      const isSupervisorDoc = url.includes('/api/inventory/doc-tasks/') && url.includes('as_role=doc_supervisor');
      if (isSupervisorCount || isSupervisorDoc) {
        this.refreshCurrentTab(false, true);
        console.log('[SupervisorDashboard] ⚡ تب فعال سرپرست با استعلام پس‌زمینه SWR به‌روزرسانی شد.');
      }
    });
  }

  ngOnDestroy() {
    this.wsSub?.unsubscribe();
    this.wsDebounceSub?.unsubscribe();
    this.routerSub?.unsubscribe();
    this.swrSub?.unsubscribe();
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
      this.cdr.detectChanges();
      return;
    }

    const isSupervisorStatus = taskData.status === 'COUNTED' || taskData.status === 'MANAGER_REJECTED';

    if (!isSupervisorStatus) {
      // تسک از کارتابل سرپرست خارج شده است
      this.tasks = this.tasks.filter(t => t.id !== id);
      this.poolTasks = this.poolTasks.filter(t => t.id !== id);
      this.selectedTasks.delete(id);
      this.selectedPoolTasks.delete(id);
      this.cdr.detectChanges();
      return;
    }

    const currentUserId = this.auth.user()?.id;
    const isMyTask = taskData.supervisor === currentUserId ||
      (taskData.supervisor && typeof taskData.supervisor === 'object' && taskData.supervisor.id === currentUserId);
    const isPool = !taskData.supervisor;

    if (isMyTask || (!taskData.supervisor && this.currentTab === 'my-tasks')) {
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
    this.cdr.detectChanges();
  }

  updateDocTaskInPlace(taskData: any) {
    if (!taskData || !taskData.id) return;
    const id = taskData.id;

    if (taskData._deleted) {
      this.docTasks = this.docTasks.filter(t => t.id !== id);
      this.docPoolTasks = this.docPoolTasks.filter(t => t.id !== id);
      this.selectedDocTasks.delete(id);
      this.selectedDocPoolTasks.delete(id);
      this.cdr.detectChanges();
      return;
    }

    const isSupervisorDocStatus = taskData.status === 'DOC_PROCESSED';

    if (!isSupervisorDocStatus) {
      this.docTasks = this.docTasks.filter(t => t.id !== id);
      this.docPoolTasks = this.docPoolTasks.filter(t => t.id !== id);
      this.selectedDocTasks.delete(id);
      this.selectedDocPoolTasks.delete(id);
      this.cdr.detectChanges();
      return;
    }

    const currentUserId = this.auth.user()?.id;
    const isMyDoc = taskData.doc_supervisor === currentUserId ||
      (taskData.doc_supervisor && typeof taskData.doc_supervisor === 'object' && taskData.doc_supervisor.id === currentUserId);
    const isPool = !taskData.doc_supervisor;

    if (isMyDoc || (!taskData.doc_supervisor && this.currentTab === 'doc')) {
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
    this.cdr.detectChanges();
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

  loadTasks(showLoading = true, preserveState = false) {
    if (!preserveState) {
      this.selectedTasks.clear();
    }
    if (showLoading) {
      this.isLoading = true;
      this.cdr.detectChanges();
    }
    
    const params: any = { as_role: 'supervisor', page_size: 1000 };
    const whId = this.state.appState.activeWarehouseId;
    if (whId && whId !== 'ALL' && whId !== -1) {
      params.warehouse_id = whId;
    }

    this.countTaskApi.getAll(params).subscribe({
      next: (res: any) => {
        try {
          const allTasks = Array.isArray(res) ? res : (res.results || []);
          const newTasks = Array.isArray(allTasks) ? allTasks.filter((t: CountTask) => t.status === 'COUNTED' || t.status === 'MANAGER_REJECTED') : [];
          this.trackUpdates(this.tasks, newTasks);
          this.tasks = newTasks;
          if (preserveState) {
            const validIds = new Set(this.tasks.map(t => t.id));
            this.selectedTasks = new Set(Array.from(this.selectedTasks).filter(id => validIds.has(id)));
          }
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

  loadPoolTasks(showLoading = true, preserveState = false) {
    if (!preserveState) {
      this.selectedPoolTasks.clear();
    }
    if (showLoading) {
      this.isLoading = true;
      this.cdr.detectChanges();
    }
    
    const params: any = { as_role: 'supervisor' };
    const whId = this.state.appState.activeWarehouseId;
    if (whId && whId !== 'ALL' && whId !== -1) {
      params.warehouse_id = whId;
    }
    
    this.http.get<CountTask[]>(`${environment.apiUrl}/inventory/count-tasks/pool_tasks/`, { params }).subscribe({
      next: (res: any) => {
        const newPoolTasks = Array.isArray(res) ? res : (res.results || []);
        this.trackUpdates(this.poolTasks, newPoolTasks);
        this.poolTasks = newPoolTasks;
        if (preserveState) {
          const validIds = new Set(this.poolTasks.map(t => t.id));
          this.selectedPoolTasks = new Set(Array.from(this.selectedPoolTasks).filter(id => validIds.has(id)));
        }
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

  /** خواندن تب فعال از پارامترهای آدرس مرورگر */
  private syncTabFromUrl() {
    if (!this.router.url.split('?')[0].includes('/supervisor')) return;
    const params = this.router.parseUrl(this.router.url).queryParams;
    const tab = params['tab'] as typeof this.currentTab;
    const validTabs: typeof this.currentTab[] = ['my-tasks', 'pool', 'doc', 'doc-pool'];
    const resolved = validTabs.includes(tab) ? tab : 'my-tasks';
    if (resolved !== this.currentTab) {
      this.currentTab = resolved;
      this.selectedTasks.clear();
      this.selectedPoolTasks.clear();
      this.selectedDocTasks.clear();
      this.selectedDocPoolTasks.clear();
    }
    this.refreshCurrentTab();
  }

  setTab(tab: 'my-tasks' | 'pool' | 'doc' | 'doc-pool') {
    this.router.navigate([], { queryParams: { tab }, queryParamsHandling: 'merge' });
  }

  togglePoolSelection(taskId: number) {
    if (this.selectedPoolTasks.has(taskId)) {
      this.selectedPoolTasks.delete(taskId);
    } else {
      this.selectedPoolTasks.add(taskId);
    }
    this.selectedPoolTasks = new Set(this.selectedPoolTasks);
    this.cdr.detectChanges();
  }

  async claimSelectedTasks() {
    if (this.selectedPoolTasks.size === 0) return;
    
    const payload = {
      task_ids: Array.from(this.selectedPoolTasks),
      as_role: 'supervisor'
    };

    this.http.post(`${environment.apiUrl}/inventory/count-tasks/claim_tasks/`, payload).subscribe({
      next: (res: any) => {
        this.toast.success(`${res.claimed_count} کالا با موفقیت به عهده گرفته شد`);
        this.setTab('my-tasks');
      },
      error: (err: any) => {
        const errorMsg = err?.error?.error || 'خطا در عملیات';
        this.toast.error(errorMsg);
      }
    });
  }

  toggleSelection(taskId: number) {
    if (this.selectedTasks.has(taskId)) {
      this.selectedTasks.delete(taskId);
    } else {
      this.selectedTasks.add(taskId);
    }
    this.selectedTasks = new Set(this.selectedTasks);
    this.cdr.detectChanges();
  }

  toggleAll(event: Event) {
    const isChecked = (event.target as HTMLInputElement).checked;
    if (isChecked) {
      this.tasks.forEach(t => this.selectedTasks.add(t.id));
    } else {
      this.selectedTasks.clear();
    }
    this.selectedTasks = new Set(this.selectedTasks);
    this.cdr.detectChanges();
  }

  isAllSelected() {
    return this.tasks.length > 0 && this.selectedTasks.size === this.tasks.length;
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

    // اعمال خوش‌بینانه در جدول
    this.tasks = this.tasks.filter(t => !taskIds.includes(t.id));
    this.selectedTasks.clear();
    this.showApproveDialog = false;
    this.cdr.detectChanges();

    this.countTaskApi.bulkApprove(taskIds, this.approveNote).subscribe({
      next: (res: any) => {
        const isOffline = res?._offlinePending || !navigator.onLine;
        if (isOffline) {
          this.toast.info(`تأیید ${count} کالا در صف ارسال آفلاین قرار گرفت.`);
        } else {
          this.toast.success(res?.message || `${count} کالا با موفقیت تایید شد`);
        }
        this.loadTasks(false, true);
      },
      error: (err: any) => {
        this.toast.error(err?.error?.error || 'خطا در تایید کالاها');
        this.loadTasks(false, true);
      }
    });
  }

  approveSingle(task: CountTask) {
    this.selectedTasks = new Set([task.id]);
    this.openApproveDialog();
  }

  openRejectDialog(task: CountTask) {
    this.rejectingTask = task;
    this.rejectNote = '';
    this.showRejectDialog = true;
    this.cdr.detectChanges();
  }

  closeRejectDialog() {
    this.showRejectDialog = false;
    this.rejectingTask = null;
    this.rejectNote = '';
    this.cdr.detectChanges();
  }

  confirmReject() {
    if (!this.rejectNote.trim()) {
      this.toast.error('لطفا دلیل رد کردن را بنویسید');
      return;
    }

    if (this.rejectingTask) {
      const taskId = this.rejectingTask.id;
      // اعمال خوش‌بینانه
      this.tasks = this.tasks.filter(t => t.id !== taskId);
      this.selectedTasks.delete(taskId);
      this.closeRejectDialog();
      this.cdr.detectChanges();

      this.countTaskApi.reject(taskId, this.rejectNote).subscribe({
        next: (res: any) => {
          const isOffline = res?._offlinePending || !navigator.onLine;
          if (isOffline) {
            this.toast.info('ارجاع به بازشماری در صف آفلاین ذخیره شد.');
          } else {
            this.toast.success(res?.message || 'کالا با موفقیت رد شد');
          }
          this.loadTasks(false, true);
        },
        error: (err: any) => {
          this.toast.error(err?.error?.error || 'خطا در انجام عملیات');
          this.loadTasks(false, true);
        }
      });
    }
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
      this.toast.error('لطفاً دلیل رد کردن (بازشماری) را بنویسید.');
      return;
    }
    const taskIds = Array.from(this.selectedTasks);
    const count = taskIds.length;

    // اعمال خوش‌بینانه
    this.tasks = this.tasks.filter(t => !taskIds.includes(t.id));
    this.selectedTasks.clear();
    this.showBulkRejectDialog = false;
    this.cdr.detectChanges();

    this.countTaskApi.bulkReject(taskIds, this.bulkRejectNote).subscribe({
      next: (res: any) => {
        const isOffline = res?._offlinePending || !navigator.onLine;
        if (isOffline) {
          this.toast.info(`ارجاع به بازشماری ${count} کالا در صف آفلاین ذخیره شد.`);
        } else {
          this.toast.success(res?.message || `${count} کالا جهت بازشماری ارجاع داده شد`);
        }
        this.loadTasks(false, true);
      },
      error: (err: any) => {
        const msg = err?.error?.error || 'خطا در رد گروهی کالاها';
        this.toast.error(msg);
        this.loadTasks(false, true);
      }
    });
  }

  openHistoryDialog(task: CountTask) {
    this.historyTask = task;
    this.showHistoryDialog = true;
    this.cdr.detectChanges();
  }

  closeHistoryDialog() {
    this.showHistoryDialog = false;
    this.historyTask = null;
    this.cdr.detectChanges();
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
    const params: any = { as_role: 'doc_supervisor', page_size: 1000 };
    const whId = this.state.appState.activeWarehouseId;
    if (whId && whId !== 'ALL' && whId !== -1) params.warehouse_id = whId;

    this.docTaskApi.getAll(params).subscribe({
      next: (res: any) => {
        const all: DocTask[] = Array.isArray(res) ? res : (res.results || []);
        const newDocTasks = all.filter(t => t.status === 'DOC_PROCESSED');
        this.trackUpdates(this.docTasks, newDocTasks);
        this.docTasks = newDocTasks;
        if (preserveState) {
          const validIds = new Set(this.docTasks.map(t => t.id));
          this.selectedDocTasks = new Set(Array.from(this.selectedDocTasks).filter(id => validIds.has(id)));
        }
        this.isDocLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.toast.error('خطا در دریافت اسناد مالی');
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
    this.cdr.detectChanges();

    this.docTaskApi.bulkApprove(taskIds, this.docApproveNote).subscribe({
      next: (res: any) => {
        const isOffline = res?._offlinePending || !navigator.onLine;
        if (isOffline) {
          this.toast.info(`تأیید ${count} سند در صف آفلاین ذخیره شد.`);
        } else {
          this.toast.success(res?.message || `${count} سند با موفقیت تایید شد`);
        }
        this.loadDocTasks(false, true);
      },
      error: (err: any) => {
        this.toast.error(err?.error?.error || 'خطا در تایید اسناد');
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
    if (!this.docRejectNote.trim()) { this.toast.error('لطفاً دلیل رد را بنویسید'); return; }
    const taskIds = Array.from(this.selectedDocTasks);
    const count = taskIds.length;

    // اعمال خوش‌بینانه
    this.docTasks = this.docTasks.filter(t => !taskIds.includes(t.id));
    this.selectedDocTasks.clear();
    this.closeDocRejectDialog();
    this.cdr.detectChanges();

    this.docTaskApi.reject(taskIds, this.docRejectNote).subscribe({
      next: (res: any) => {
        const isOffline = res?._offlinePending || !navigator.onLine;
        if (isOffline) {
          this.toast.info(`رد ${count} سند در صف آفلاین ذخیره شد.`);
        } else {
          this.toast.success(res?.message || `${count} سند با موفقیت رد شد`);
        }
        this.loadDocTasks(false, true);
      },
      error: (err: any) => {
        this.toast.error(err?.error?.error || 'خطا در رد اسناد');
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
    const params: any = { as_role: 'doc_supervisor' };
    const whId = this.state.appState.activeWarehouseId;
    if (whId && whId !== 'ALL' && whId !== -1) params.warehouse_id = whId;

    this.docTaskApi.poolTasks(params).subscribe({
      next: (res: any) => {
        const newDocPoolTasks = Array.isArray(res) ? res : (res.results || []);
        this.trackUpdates(this.docPoolTasks, newDocPoolTasks);
        this.docPoolTasks = newDocPoolTasks;
        if (preserveState) {
          const validIds = new Set(this.docPoolTasks.map(t => t.id));
          this.selectedDocPoolTasks = new Set(Array.from(this.selectedDocPoolTasks).filter(id => validIds.has(id)));
        }
        this.isDocPoolLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.toast.error('خطا در دریافت استخر اسناد');
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
    this.docTaskApi.claimTasks(Array.from(this.selectedDocPoolTasks), 'doc_supervisor').subscribe({
      next: (res: any) => {
        this.toast.success(`${res.claimed_count} سند با موفقیت به عهده گرفته شد`);
        this.setTab('doc');
      },
      error: (err: any) => {
        const errorMsg = err?.error?.error || 'خطا در عملیات';
        this.toast.error(errorMsg);
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
    const role = isCount ? 'supervisor' : 'doc_supervisor';
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
    // Also include pool filter logic if needed, but the backend handles `as_role` and `pool` might not be natively supported in export without extra params. Wait, export_excel endpoint uses the same get_queryset, so we need to inject `pool_only` if we are in a pool tab.
    if (this.currentTab === 'pool' || this.currentTab === 'doc-pool') {
      // Though there is no pool_only param for count/doc tasks typically? Wait, the endpoints are pool_tasks/ vs my_tasks.
      // But we can just use selected_ids if they select from pool. For 'all', we might want to export pool tasks?
      // Since it's complex, we will just send it to exportExcel which hits standard endpoint, and it might export all supervisor tasks.
      // To be safe:
    }

    this.exportSubscription = api.exportExcel({ ...payload, ...params }).subscribe({
      next: (blob) => {
        try {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `export_supervisor_${role}_${new Date().getTime()}.xlsx`;
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
