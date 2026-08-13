import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { WebSocketService } from '../../core/http/websocket.service';
import { CommonModule } from '@angular/common';
import { AuthStore } from '../../core/stores/auth.store';
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

@Component({
  selector: 'app-manager-review',
  standalone: true,
  imports: [CommonModule, FormsModule, WarehouseSelectorComponent],
  templateUrl: './manager-review.html'
})
export class ManagerReview implements OnInit, OnDestroy {
  private wsSub?: Subscription;
  updatedTaskIds = new Set<number>();
  flashTimeout: any;
  private routerSub?: Subscription;
  currentTab: 'my-tasks' | 'pool' | 'doc' | 'doc-pool' = 'my-tasks';

  // ── Count Task Tab ──
  tasks: CountTask[] = [];
  isLoading = true;
  selectedTasks: Set<number> = new Set();

  // Pool Tab
  poolTasks: CountTask[] = [];
  selectedPoolTasks: Set<number> = new Set();

  // Single Review State
  selectedTask: CountTask | null = null;
  managerNote = '';

  // Bulk Approve Dialog
  showApproveDialog = false;
  approveNote = '';

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

  constructor(
    public state: StateService,
    public authStore: AuthStore,
    private toast: ToastService,
    private countTaskApi: CountTaskApiService,
    private docTaskApi: DocTaskApiService,
    private cdr: ChangeDetectorRef,
    private http: HttpClient,
    private wsService: WebSocketService,
    private router: Router
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

  /** خواندن تب فعال از پارامترهای آدرس مرورگر */
  private syncTabFromUrl() {
    if (!this.router.url.split('?')[0].includes('/manager-review')) return;
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
      this.selectedTask = null;
    }
    this.refreshCurrentTab();
    this.loadDocTasks();
    this.loadDocPoolTasks();
    this.cdr.detectChanges();
  }

  setTab(tab: 'my-tasks' | 'pool' | 'doc' | 'doc-pool') {
    this.router.navigate([], { queryParams: { tab }, queryParamsHandling: 'merge' });
  }

  // ════════════════════════════════════════════
  //  My Tasks Tab
  // ════════════════════════════════════════════

  loadTasks(showLoading = true) {
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
        this.selectedTasks.clear();
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

  toggleAll(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) this.tasks.forEach(t => this.selectedTasks.add(t.id));
    else this.selectedTasks.clear();
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
    this.countTaskApi.bulkManagerApprove(Array.from(this.selectedTasks), this.approveNote).subscribe({
      next: (res) => {
        this.toast.show('success', res.message);
        this.showApproveDialog = false;
        this.selectedTasks = new Set();
        this.loadTasks();
      },
      error: () => { this.toast.show('error', 'خطا در تایید گروهی'); this.cdr.detectChanges(); }
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
    this.countTaskApi.bulkManagerApprove([this.selectedTask.id], this.managerNote).subscribe({
      next: (res) => {
        this.toast.show('success', res.message || 'تایید نهایی با موفقیت انجام شد');
        this.selectedTask = null;
        this.loadTasks();
      },
      error: () => { this.toast.show('error', 'خطا در ثبت اطلاعات'); this.cdr.detectChanges(); }
    });
  }

  rejectTask() {
    if (!this.managerNote.trim()) {
      return this.toast.show('error', 'لطفاً علت درخواست بازشماری (دستورات به سرپرست) را بنویسید.');
    }
    if (!this.selectedTask) return;
    this.countTaskApi.managerReject(this.selectedTask.id, this.managerNote).subscribe({
      next: (res) => {
        this.toast.show('success', res.message);
        this.selectedTask = null;
        this.loadTasks();
      },
      error: (err) => {
        this.toast.show('error', err?.error?.error || 'خطا در ثبت اطلاعات');
        this.cdr.detectChanges();
      }
    });
  }

  isMatched(task: CountTask | null): boolean {
    if (!task || !task.item_details || !task.counted_balance) return false;
    return +task.counted_balance === task.item_details.bal4miv;
  }

  // ════════════════════════════════════════════
  //  Pool Tab
  // ════════════════════════════════════════════

  loadPoolTasks(showLoading = true) {
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

  loadDocTasks(showLoading = true) {
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
        this.selectedDocTasks.clear();
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
    this.docTaskApi.bulkManagerApprove(Array.from(this.selectedDocTasks), this.docApproveNote).subscribe({
      next: (res) => {
        this.toast.show('success', res.message);
        this.showDocApproveDialog = false;
        this.selectedDocTasks = new Set();
        this.loadDocTasks();
      },
      error: () => { this.toast.show('error', 'خطا در تایید اسناد'); this.cdr.detectChanges(); }
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
    this.docTaskApi.managerReject(Array.from(this.selectedDocTasks), this.docRejectNote).subscribe({
      next: (res) => {
        this.toast.show('success', res.message);
        this.closeDocRejectDialog();
        this.selectedDocTasks = new Set();
        this.loadDocTasks();
      },
      error: () => { this.toast.show('error', 'خطا در رد اسناد'); this.cdr.detectChanges(); }
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
    const params: any = { as_role: 'manager' };
    const whId = this.state.appState.activeWarehouseId;
    if (whId && whId !== 'ALL' && whId !== -1) params.warehouse_id = whId;

    this.http.get<DocTask[]>(`${environment.apiUrl}/inventory/doc-tasks/pool_tasks/`, { params }).subscribe({
      next: (res: any) => {
        const newDocPoolTasks = Array.isArray(res) ? res : (res.results || []);
        this.trackUpdates(this.docPoolTasks, newDocPoolTasks);
        this.docPoolTasks = newDocPoolTasks;
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
}
