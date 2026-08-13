import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, filter } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { DocTaskApiService } from '../../core/api/doc-task-api.service';
import { DocTaskStore } from '../../core/services/doc-task-store';
import { DocTask, INVOICE_TYPE_LABELS, CURRENCY_LABELS } from '../../core/models/doc-task.model';
import { ToastService } from '../../services/toast.service';
import { ConfirmDialogService } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { StateService } from '../../services/state.service';
import { AuthService } from '../../core/auth/auth.service';
import { AuthStore } from '../../core/stores/auth.store';
import { WarehouseSelectorComponent } from '../../shared/components/warehouse-selector/warehouse-selector.component';
import { OfflinePendingBadgeComponent } from '../../shared/components/offline-pending-badge/offline-pending-badge.component';
import { BarcodeScannerComponent } from '../../shared/components/barcode-scanner/barcode-scanner.component';
import { environment } from '../../../environments/environment';
import { Router, NavigationEnd } from '@angular/router';
import { WebSocketService } from '../../core/http/websocket.service';

@Component({
  selector: 'app-customs',
  standalone: true,
  imports: [CommonModule, FormsModule, WarehouseSelectorComponent, OfflinePendingBadgeComponent, BarcodeScannerComponent],
  templateUrl: './customs.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Customs implements OnInit, OnDestroy {
  tasks: DocTask[] = [];
  poolTasks: DocTask[] = [];
  isLoading = true;
  selectedTask: DocTask | null = null;
  selectedTasks = new Set<number>();
  selectedPoolTasks = new Set<number>();
  currentTab: 'my-tasks' | 'pool' = 'my-tasks';
  isSaving = false;

  // Filters
  statusFilter: 'pending' | 'processing' | 'all' = 'pending';
  searchQuery = '';
  filteredTasks: DocTask[] = [];
  searchSubject = new Subject<string>();
  private initialLoadDone = false;

  // Financial form fields
  f_added_rti_no = '';
  f_inv_rti_number = '';
  f_invoice_type = '';
  f_invoice_date = '';
  f_invoice_page: number | null = null;
  f_page_row: number | null = null;
  f_doc_supplier = '';
  f_total_value = '';
  f_price_amount = '';
  f_similar_unit_price = '';
  f_currency = '';
  f_folder_address = '';
  f_stamp = false;
  f_signature = false;
  f_worker_note = '';

  readonly invoiceTypes = Object.entries(INVOICE_TYPE_LABELS);
  readonly currencies = Object.entries(CURRENCY_LABELS);

  private pullSub: Subscription | null = null;
  private scanBusy = false;
  private routerSub?: Subscription;
  private wsSub?: Subscription;

  updatedTaskIds = new Set<number>();
  flashTimeout: any;
  tasksLoaded = false;
  poolTasksLoaded = false;

  @ViewChild(BarcodeScannerComponent) scanner?: BarcodeScannerComponent;

  constructor(
    private docTaskApi: DocTaskApiService,
    private toast: ToastService,
    private confirmDialog: ConfirmDialogService,
    private cdr: ChangeDetectorRef,
    public state: StateService,
    private auth: AuthService,
    public authStore: AuthStore,
    private store: DocTaskStore,
    private router: Router,
    private wsService: WebSocketService,
  ) {}

  private get activeWarehouseId(): number | null {
    const whId = this.state.appState.activeWarehouseId;
    if (whId && whId !== 'ALL' && Number(whId) !== -1) return Number(whId);
    return null;
  }

  private get localFirst(): boolean {
    return (
      (environment as any).useLocalFirstDoc === true &&
      this.activeWarehouseId !== null &&
      this.currentUserId !== null
    );
  }

  private get currentUserId(): number | null {
    const id = this.auth.user()?.id;
    return typeof id === 'number' ? id : null;
  }

  // ════════════════════════════════════════════
  //  Lifecycle
  // ════════════════════════════════════════════

  ngOnInit() {
    this.pullSub = this.store.pull.pullCompleted$.subscribe(({ warehouseId }) => {
      if (this.localFirst && warehouseId === this.activeWarehouseId && !this.selectedTask) {
        this.readFromLocal(false);
      }
    });

    // ── URL State: خواندن استیت از آدرس مرورگر ──
    this.syncStateFromUrl();
    this.routerSub = this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd)
    ).subscribe(() => this.syncStateFromUrl());

    this.wsSub = this.wsService.notifications$.subscribe((data: any) => {
      if (data.type === 'doc_task_update' || data.event === 'doc_task_update') {
        if (!this.selectedTask) {
          if (this.localFirst) {
            this.store.refresh(this.activeWarehouseId!);
          } else if (this.currentTab === 'my-tasks') {
            this.loadTasks(false);
          } else {
            this.loadPoolTasks(false);
          }
        }
      }
    });

    this.searchSubject.pipe(debounceTime(2000), distinctUntilChanged()).subscribe(q => {
      this.router.navigate([], { queryParams: { q: q || null }, queryParamsHandling: 'merge', replaceUrl: true });
    });
  }

  ngOnDestroy() {
    this.pullSub?.unsubscribe();
    this.routerSub?.unsubscribe();
    this.wsSub?.unsubscribe();
    if (this.flashTimeout) clearTimeout(this.flashTimeout);
  }

  private trackUpdates(oldList: any[], newList: any[]) {
    const oldMap = new Map(oldList.map((t: any) => [t.id, t]));
    let hasUpdates = false;

    for (const t of newList) {
      const oldItem = oldMap.get(t.id);
      if (!oldItem || oldItem.status !== t.status) {
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

  // ════════════════════════════════════════════
  //  Filters
  // ════════════════════════════════════════════

  applyFilters() {
    this.filteredTasks = this.tasks.filter(t => {
      let matchStatus = true;
      if (this.statusFilter === 'pending') {
        matchStatus = ['PENDING_DOC', 'DOC_SUPERVISOR_REJECTED', 'DOC_MANAGER_REJECTED'].includes(t.status);
      } else if (this.statusFilter === 'processing') {
        matchStatus = ['DOC_PROCESSED', 'DOC_MANAGER_REVIEW', 'DOC_FINAL_APPROVED'].includes(t.status);
      }

      let matchSearch = true;
      if (this.searchQuery) {
        const q = this.searchQuery.toLowerCase();
        matchSearch = (t.item_details?.fa_unic_code?.toLowerCase().includes(q) || false) ||
                      (t.item_details?.description?.toLowerCase().includes(q) || false) ||
                      (t.item_details?.po?.toLowerCase().includes(q) || false);
      }
      return matchStatus && matchSearch;
    });
  }


  setStatusFilter(f: 'pending' | 'processing' | 'all') {
    this.statusFilter = f;
    this.applyFilters();
    this.cdr.detectChanges();
  }

  // ════════════════════════════════════════════
  //  Local-First
  // ════════════════════════════════════════════

  private async readFromLocal(showLoading = true) {
    if (showLoading) { this.isLoading = true; this.cdr.detectChanges(); }
    try {
      if (this.currentTab === 'my-tasks') {
        const newTasks = await this.store.getMyTasks(this.activeWarehouseId!, this.currentUserId!);
        this.trackUpdates(this.tasks, newTasks);
        this.tasks = newTasks;
        this.tasksLoaded = true;
        this.applyFilters();
      } else {
        const newPoolTasks = await this.store.getPoolTasks(this.activeWarehouseId!);
        this.trackUpdates(this.poolTasks, newPoolTasks);
        this.poolTasks = newPoolTasks;
        this.poolTasksLoaded = true;
      }
    } catch (e) {
      console.error('[Customs] خطا در خواندن از Dexie:', e);
    }
    this.isLoading = false;
    this.cdr.detectChanges();
  }

  // ════════════════════════════════════════════
  //  Load (Server fallback)
  // ════════════════════════════════════════════

  loadTasks(showLoading = true) {
    if (this.localFirst) {
      this.readFromLocal(showLoading);
      this.store.refresh(this.activeWarehouseId!);
      return;
    }
    if (showLoading) { this.isLoading = true; this.cdr.detectChanges(); }
    const params: any = { as_role: 'doc_worker', page_size: 1000 };
    if (this.activeWarehouseId) params.warehouse_id = this.activeWarehouseId;

    this.docTaskApi.getAll(params).subscribe({
      next: (res: any) => {
        const newTasks = Array.isArray(res) ? res : (res.results || []);
        this.trackUpdates(this.tasks, newTasks);
        this.tasks = newTasks;
        this.tasksLoaded = true;
        this.applyFilters();
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
    if (this.localFirst) {
      this.readFromLocal(showLoading);
      this.store.refresh(this.activeWarehouseId!);
      return;
    }
    if (showLoading) { this.isLoading = true; this.cdr.detectChanges(); }
    const params: any = { as_role: 'doc_worker' };
    if (this.activeWarehouseId) params.warehouse_id = this.activeWarehouseId;

    this.docTaskApi.poolTasks(params).subscribe({
      next: (res: any) => {
        const newPoolTasks = Array.isArray(res) ? res : [];
        this.trackUpdates(this.poolTasks, newPoolTasks);
        this.poolTasks = newPoolTasks;
        this.poolTasksLoaded = true;
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
  private syncStateFromUrl() {
    if (!this.router.url.split('?')[0].includes('/customs')) return;
    const params = this.router.parseUrl(this.router.url).queryParams;
    
    // 1. Sync Tab
    const tab = params['tab'] as typeof this.currentTab;
    const validTabs: typeof this.currentTab[] = ['my-tasks', 'pool'];
    const resolved = validTabs.includes(tab) ? tab : 'my-tasks';
    let tabChanged = false;
    if (resolved !== this.currentTab) {
      this.currentTab = resolved;
      this.selectedTasks.clear();
      this.selectedPoolTasks.clear();
      tabChanged = true;
    }

    // 2. Sync Search Query
    const q = params['q'] || '';
    if (q !== this.searchQuery) {
      this.searchQuery = q;
      this.applyFilters();
      this.cdr.detectChanges();
    }

    // 3. Load Data only if needed
    if (tabChanged || !this.initialLoadDone) {
      this.initialLoadDone = true;
      if (resolved === 'my-tasks') this.loadTasks(!this.tasksLoaded);
      else this.loadPoolTasks(!this.poolTasksLoaded);
    }
  }

  setTab(tab: 'my-tasks' | 'pool') {
    this.router.navigate([], { queryParams: { tab }, queryParamsHandling: 'merge' });
  }

  onSearchChange(val: string) {
    this.searchQuery = val;
    this.applyFilters();
    this.searchSubject.next(val);
  }

  // ════════════════════════════════════════════
  //  Selection
  // ════════════════════════════════════════════

  toggleSelection(taskId: number) {
    if (this.selectedTasks.has(taskId)) this.selectedTasks.delete(taskId);
    else this.selectedTasks.add(taskId);
    this.cdr.detectChanges();
  }

  togglePoolSelection(taskId: number) {
    if (this.selectedPoolTasks.has(taskId)) this.selectedPoolTasks.delete(taskId);
    else this.selectedPoolTasks.add(taskId);
    this.cdr.detectChanges();
  }

  // ════════════════════════════════════════════
  //  Detail Panel
  // ════════════════════════════════════════════

  openDetail(task: DocTask) {
    this.selectedTask = task;
    this.f_added_rti_no = task.added_rti_no || '';
    this.f_inv_rti_number = task.inv_rti_number || '';
    this.f_invoice_type = task.invoice_type || '';
    this.f_invoice_date = task.invoice_date || '';
    this.f_invoice_page = task.invoice_page ?? null;
    this.f_page_row = task.page_row ?? null;
    this.f_doc_supplier = task.doc_supplier || '';
    this.f_total_value = task.total_value || '';
    this.f_price_amount = task.price_amount || '';
    this.f_similar_unit_price = task.similar_unit_price || '';
    this.f_currency = task.currency || '';
    this.f_folder_address = task.folder_address || '';
    this.f_stamp = task.stamp ?? false;
    this.f_signature = task.signature ?? false;
    this.f_worker_note = task.worker_note || '';
    this.cdr.detectChanges();
  }

  closeDetail() {
    this.selectedTask = null;
    this.cdr.detectChanges();
    this.scanner?.focusInput();
  }

  private buildPayload(): Partial<DocTask> {
    return {
      added_rti_no: this.f_added_rti_no || null,
      inv_rti_number: this.f_inv_rti_number || null,
      invoice_type: (this.f_invoice_type as any) || null,
      invoice_date: this.f_invoice_date || null,
      invoice_page: this.f_invoice_page,
      page_row: this.f_page_row,
      doc_supplier: this.f_doc_supplier || null,
      total_value: this.f_total_value || null,
      price_amount: this.f_price_amount || null,
      similar_unit_price: this.f_similar_unit_price || null,
      currency: (this.f_currency as any) || null,
      folder_address: this.f_folder_address || null,
      stamp: this.f_stamp,
      signature: this.f_signature,
      worker_note: this.f_worker_note || null,
    };
  }

  async saveDraft() {
    if (!this.selectedTask || this.isSaving) return;
    this.isSaving = true;
    const payload = this.buildPayload();

    if (this.localFirst && this.selectedTask.sync_id) {
      try {
        await this.store.saveDraft(this.selectedTask, payload, this.currentUserId!);
        Object.assign(this.selectedTask, payload, { _offlinePending: true });
        this.applyFilters();
        this.toast.success('پیش‌نویس ذخیره شد');
        this.closeDetail();
      } catch (e) {
        this.toast.error('خطا در ذخیره اطلاعات');
      }
      this.isSaving = false;
      this.cdr.detectChanges();
      return;
    }

    this.docTaskApi.update(this.selectedTask.id, payload).subscribe({
      next: (res) => {
        Object.assign(this.selectedTask!, res);
        this.applyFilters();
        this.toast.success('پیش‌نویس ذخیره شد');
        this.closeDetail();
        this.isSaving = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.toast.error('خطا در ذخیره اطلاعات');
        this.isSaving = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ════════════════════════════════════════════
  //  Submit & Claim
  // ════════════════════════════════════════════

  async submitAll() {
    const isPartial = this.selectedTasks.size > 0;
    const eligible = this.tasks.filter(t =>
      ['PENDING_DOC', 'DOC_SUPERVISOR_REJECTED', 'DOC_MANAGER_REJECTED'].includes(t.status)
    );
    const toSubmit = isPartial ? eligible.filter(t => this.selectedTasks.has(t.id)) : eligible;
    if (toSubmit.length === 0) { this.toast.error('موردی برای ارسال وجود ندارد'); return; }

    const confirmed = await this.confirmDialog.open({
      title: isPartial ? 'ارسال موارد انتخابی' : 'ارسال همه موارد',
      message: `آیا از ارسال ${toSubmit.length} مورد به سرپرست اطمینان دارید؟`,
      confirmText: 'بله، ارسال کن', cancelText: 'انصراف', type: 'info'
    });
    if (!confirmed) return;

    if (this.localFirst) {
      try {
        await this.store.submitTasks(toSubmit, this.currentUserId!);
        this.toast.success(`${toSubmit.length} مورد در صف ارسال قرار گرفت`);
        this.selectedTasks.clear();
        this.readFromLocal(false);
      } catch { this.toast.error('خطا در ارسال اطلاعات'); this.cdr.detectChanges(); }
      return;
    }

    const payload = isPartial ? { task_ids: Array.from(this.selectedTasks) } : {};
    this.docTaskApi.bulkSubmit(payload).subscribe({
      next: (res) => { this.toast.success(res.message); this.selectedTasks.clear(); this.loadTasks(); },
      error: () => { this.toast.error('خطا در ارسال اطلاعات'); this.cdr.detectChanges(); }
    });
  }

  async claimSelectedTasks() {
    if (this.selectedPoolTasks.size === 0) return;
    this.docTaskApi.claimTasks(Array.from(this.selectedPoolTasks), 'doc_worker').subscribe({
      next: async (res) => {
        this.toast.success(`${res.claimed_count} کالا با موفقیت به عهده گرفته شد`);
        if (this.localFirst) await this.store.refresh(this.activeWarehouseId!);
        this.setTab('my-tasks');
      },
      error: (err) => this.toast.error(err?.error?.error || 'خطا در عملیات')
    });
  }

  // ════════════════════════════════════════════
  //  Barcode Scanner
  // ════════════════════════════════════════════

  async onBarcodeScanned(code: string) {
    if (this.scanBusy || this.selectedTask) return;
    this.scanBusy = true;
    try {
      const q = code.trim().toLowerCase();
      const match = (t: DocTask) => (t.item_details?.fa_unic_code || '').trim().toLowerCase() === q;

      let myTasks: DocTask[];
      let pool: DocTask[];

      if (this.localFirst) {
        [myTasks, pool] = await Promise.all([
          this.store.getMyTasks(this.activeWarehouseId!, this.currentUserId!),
          this.store.getPoolTasks(this.activeWarehouseId!),
        ]);
      } else {
        myTasks = this.tasks;
        pool = this.poolTasks.length > 0 ? this.poolTasks : await this.fetchPoolOnce();
      }

      const mine = myTasks.filter(match);
      const target = mine.find(t => ['PENDING_DOC','DOC_SUPERVISOR_REJECTED','DOC_MANAGER_REJECTED'].includes(t.status)) ?? mine[0];
      if (target) { this.openDetail(target); return; }

      const poolTask = pool.find(match);
      if (poolTask) { await this.claimScannedTask(poolTask); return; }

      this.toast.error(`کالایی با کد «${code}» در کارتابل یا استخر شما یافت نشد`);
    } finally {
      this.scanBusy = false;
      if (!this.selectedTask) this.scanner?.focusInput();
      this.cdr.detectChanges();
    }
  }

  private fetchPoolOnce(): Promise<DocTask[]> {
    const params: any = { as_role: 'doc_worker' };
    if (this.activeWarehouseId) params.warehouse_id = this.activeWarehouseId;
    return new Promise(resolve => {
      this.docTaskApi.poolTasks(params).subscribe({
        next: (res: any) => resolve(Array.isArray(res) ? res : []),
        error: () => resolve([])
      });
    });
  }

  private async claimScannedTask(task: DocTask): Promise<void> {
    const confirmed = await this.confirmDialog.open({
      title: 'بر عهده گرفتن کالا',
      message: `کالای <b dir="ltr">${task.item_details?.fa_unic_code || ''}</b><br>${task.item_details?.description || ''}<br>در استخر است. آیا آن را بر عهده می‌گیرید؟`,
      confirmText: 'بله، بر عهده می‌گیرم', cancelText: 'انصراف', type: 'info'
    });
    if (!confirmed) return;
    if (!navigator.onLine) { this.toast.error('بر عهده گرفتن کالا نیاز به اتصال اینترنت دارد'); return; }

    await new Promise<void>(resolve => {
      this.docTaskApi.claimTasks([task.id], 'doc_worker').subscribe({
        next: async () => {
          this.toast.success('کالا با موفقیت به عهده گرفته شد');
          this.currentTab = 'my-tasks';
          if (this.localFirst) {
            await this.store.refresh(this.activeWarehouseId!);
            await this.readFromLocal(false);
            const fresh = (await this.store.getMyTasks(this.activeWarehouseId!, this.currentUserId!))
              .find(t => task.sync_id ? t.sync_id === task.sync_id : t.id === task.id);
            if (fresh) this.openDetail(fresh);
          } else { this.loadTasks(false); this.openDetail(task); }
          this.cdr.detectChanges(); resolve();
        },
        error: (err) => { this.toast.error(err?.error?.error || 'خطا در عملیات'); resolve(); }
      });
    });
  }

  // ════════════════════════════════════════════
  //  Helpers
  // ════════════════════════════════════════════

  trackById(_: number, t: DocTask) { return t.id ?? (t as any)._offlineId ?? _; }

  getStatusLabel(s: string): string {
    const m: Record<string,string> = {
      PENDING_DOC:'در انتظار', DOC_PROCESSED:'ارسال‌شده', DOC_SUPERVISOR_REJECTED:'رد سرپرست',
      DOC_MANAGER_REVIEW:'نزد مدیر', DOC_MANAGER_REJECTED:'رد مدیر', DOC_FINAL_APPROVED:'تأیید نهایی'
    };
    return m[s] || s;
  }

  getStatusColor(s: string): string {
    if (['PENDING_DOC'].includes(s)) return 'bg-amber-100 text-amber-800';
    if (['DOC_SUPERVISOR_REJECTED','DOC_MANAGER_REJECTED'].includes(s)) return 'bg-red-100 text-red-800';
    if (s === 'DOC_PROCESSED') return 'bg-blue-100 text-blue-800';
    if (s === 'DOC_MANAGER_REVIEW') return 'bg-purple-100 text-purple-800';
    if (s === 'DOC_FINAL_APPROVED') return 'bg-green-100 text-green-800';
    return 'bg-surface text-gray-600';
  }

  get pendingCount(): number {
    return this.tasks.filter(t => ['PENDING_DOC','DOC_SUPERVISOR_REJECTED','DOC_MANAGER_REJECTED'].includes(t.status)).length;
  }
}
