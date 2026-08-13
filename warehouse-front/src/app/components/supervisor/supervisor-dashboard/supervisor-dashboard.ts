import { Component, OnInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription, filter } from 'rxjs';
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
import { HasPermissionDirective } from '../../../shared';
import { WarehouseSelectorComponent } from '../../../shared/components/warehouse-selector/warehouse-selector.component';
import { OfflinePendingBadgeComponent } from '../../../shared/components/offline-pending-badge/offline-pending-badge.component';
import { AuthStore } from '../../../core/stores/auth.store';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-supervisor-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, HasPermissionDirective, WarehouseSelectorComponent, OfflinePendingBadgeComponent],
  templateUrl: './supervisor-dashboard.html',
  styleUrl: './supervisor-dashboard.css'
})
export class SupervisorDashboard implements OnInit, OnDestroy {
  private wsSub?: Subscription;
  updatedTaskIds = new Set<number>();
  flashTimeout: any;
  private routerSub?: Subscription;
  authStore = inject(AuthStore);
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
    this.wsSub = this.wsService.notifications$.subscribe((data: any) => {
      if (data.type === 'count_task_update' || data.event === 'count_task_update' ||
          data.type === 'doc_task_update' || data.event === 'doc_task_update') {
        this.refreshCurrentTab();
      }
    });

    // ── URL State: خواندن تب از آدرس مرورگر ──
    this.syncTabFromUrl();
    this.routerSub = this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd)
    ).subscribe(() => this.syncTabFromUrl());
  }

  ngOnDestroy() {
    this.wsSub?.unsubscribe();
    this.routerSub?.unsubscribe();
  }

  refreshCurrentTab() {
    if (this.currentTab === 'my-tasks') this.loadTasks(false);
    else if (this.currentTab === 'pool') this.loadPoolTasks(false);
    else if (this.currentTab === 'doc') this.loadDocTasks(false);
    else this.loadDocPoolTasks(false);
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

  loadTasks(showLoading = true) {
    if (showLoading) {
      this.isLoading = true;
      this.cdr.detectChanges();
    }
    
    const params: any = { as_role: 'supervisor', status: 'COUNTED', page_size: 1000 };
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
        } catch (e) {
          console.error('Error assigning tasks:', e);
          this.tasks = [];
        }
        this.selectedTasks.clear();
        setTimeout(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        }, 600);
      },
      error: () => {
        this.toast.error('خطا در دریافت اطلاعات');
        setTimeout(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        }, 600);
      }
    });
  }

  loadPoolTasks(showLoading = true) {
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
        setTimeout(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        }, 600);
      },
      error: () => {
        this.toast.error('خطا در دریافت تسک‌های استخر');
        setTimeout(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        }, 600);
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

    this.countTaskApi.bulkApprove(Array.from(this.selectedTasks), this.approveNote).subscribe({
      next: (res) => {
        this.toast.success(res.message);
        this.showApproveDialog = false;
        this.selectedTasks = new Set();
        this.loadTasks();
      },
      error: () => {
        this.toast.error('خطا در تایید کالاها');
        this.cdr.detectChanges();
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
      this.countTaskApi.reject(this.rejectingTask.id, this.rejectNote).subscribe({
        next: (res) => {
          this.toast.success(res.message);
          this.closeRejectDialog();
          this.loadTasks();
        },
        error: () => {
          this.toast.error('خطا در انجام عملیات');
          this.cdr.detectChanges();
        }
      });
    }
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

  loadDocTasks(showLoading = true) {
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
        this.selectedDocTasks.clear();
        setTimeout(() => {
          this.isDocLoading = false;
          this.cdr.detectChanges();
        }, 600);
      },
      error: () => {
        this.toast.error('خطا در دریافت اسناد مالی');
        setTimeout(() => {
          this.isDocLoading = false;
          this.cdr.detectChanges();
        }, 600);
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
    this.docTaskApi.bulkApprove(Array.from(this.selectedDocTasks), this.docApproveNote).subscribe({
      next: (res) => {
        this.toast.success(res.message);
        this.showDocApproveDialog = false;
        this.selectedDocTasks = new Set();
        this.loadDocTasks();
      },
      error: () => { this.toast.error('خطا در تایید اسناد'); this.cdr.detectChanges(); }
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
    this.docTaskApi.reject(Array.from(this.selectedDocTasks), this.docRejectNote).subscribe({
      next: (res) => {
        this.toast.success(res.message);
        this.closeDocRejectDialog();
        this.selectedDocTasks = new Set();
        this.loadDocTasks();
      },
      error: () => { this.toast.error('خطا در رد اسناد'); this.cdr.detectChanges(); }
    });
  }

  // ════════════════════════════════════════════
  //  Doc Pool Tab
  // ════════════════════════════════════════════

  loadDocPoolTasks(showLoading = true) {
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
        setTimeout(() => {
          this.isDocPoolLoading = false;
          this.cdr.detectChanges();
        }, 600);
      },
      error: () => {
        this.toast.error('خطا در دریافت استخر اسناد');
        setTimeout(() => {
          this.isDocPoolLoading = false;
          this.cdr.detectChanges();
        }, 600);
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
}
