import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CountTaskApiService } from '../../../core/api/count-task-api.service';
import { CountTask } from '../../../core/models/count-task.model';
import { ToastService } from '../../../services/toast.service';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { StateService } from '../../../services/state.service';
import { WarehouseSelectorComponent } from '../../../shared/components/warehouse-selector/warehouse-selector.component';
import { AuthService } from '../../../core/auth/auth.service';
import { AuthStore } from '../../../core/stores/auth.store';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-counter-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, WarehouseSelectorComponent],
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
  refreshInterval: any;
  currentTab: 'my-tasks' | 'pool' = 'my-tasks';
  
  // Detail view state
  countedBalanceStr: string = '';
  counterNote: string = '';


  // Stats & Filters
  totalTasksCount = 0;
  completedTasksCount = 0;
  remainingTasksCount = 0;
  filteredTasks: CountTask[] = [];
  pendingTasks: CountTask[] = [];
  readyToSubmitCount = 0;

  // New Filters
  dateFilter: 'today' | 'yesterday' | 'week' | 'all' = 'today';
  statusFilter: 'pending' | 'completed' | 'recount' | 'all' = 'pending';
  searchQuery: string = '';
  searchSubject = new Subject<string>();
  locationSort: 'asc' | 'desc' | '' = '';

  constructor(
    private countTaskApi: CountTaskApiService,
    private toast: ToastService,
    private confirmDialog: ConfirmDialogService,
    private cdr: ChangeDetectorRef,
    public state: StateService,
    public authStore: AuthStore,
    private auth: AuthService,
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadTasks();
    this.refreshInterval = setInterval(() => {
      if (!this.selectedTask) {
        if (this.currentTab === 'my-tasks') {
          this.loadTasks(false); // background refresh
        } else {
          this.loadPoolTasks(false);
        }
      }
    }, 20000);

    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(query => {
      this.searchQuery = query;
      this.applyFilters();
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  applyFilters() {
    this.totalTasksCount = this.tasks.length;
    this.completedTasksCount = this.tasks.filter(t => t.status !== 'PENDING_COUNT' && t.status !== 'SUPERVISOR_REJECTED').length;
    this.remainingTasksCount = this.tasks.filter(t => t.status === 'PENDING_COUNT' || t.status === 'SUPERVISOR_REJECTED').length;
    this.pendingTasks = this.tasks.filter(t => t.status === 'PENDING_COUNT' || t.status === 'SUPERVISOR_REJECTED');
    this.readyToSubmitCount = this.pendingTasks.filter(t => t.counted_balance !== null).length;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = today - 86400000;
    const week = today - 7 * 86400000;

    this.filteredTasks = this.tasks.filter(t => {
      // Status Filter
      let matchStatus = true;
      if (this.statusFilter === 'pending') matchStatus = t.status === 'PENDING_COUNT';
      else if (this.statusFilter === 'recount') matchStatus = t.status === 'SUPERVISOR_REJECTED';
      else if (this.statusFilter === 'completed') matchStatus = t.status !== 'PENDING_COUNT' && t.status !== 'SUPERVISOR_REJECTED';
      
      // Date Filter
      let matchDate = true;
      if (t.created_at && this.dateFilter !== 'all') {
        const taskDate = new Date(t.created_at).getTime();
        if (this.dateFilter === 'today') matchDate = taskDate >= today;
        else if (this.dateFilter === 'yesterday') matchDate = taskDate >= yesterday && taskDate < today;
        else if (this.dateFilter === 'week') matchDate = taskDate >= week;
      }
      
      // Search Filter
      let matchSearch = true;
      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase();
        matchSearch = (t.item_details?.fa_unic_code?.toLowerCase().includes(query) || false) || 
                      (t.item_details?.description?.toLowerCase().includes(query) || false) ||
                      (t.item_details?.po?.toLowerCase().includes(query) || false) ||
                      (t.item_details?.new_location?.toLowerCase().includes(query) || false);
      }
      
      return matchStatus && matchDate && matchSearch;
    });

    // Apply Sorting
    if (this.locationSort) {
      this.filteredTasks.sort((a, b) => {
        const locA = a.item_details?.new_location || '';
        const locB = b.item_details?.new_location || '';
        if (this.locationSort === 'asc') return locA.localeCompare(locB);
        else return locB.localeCompare(locA);
      });
    }
  }

  onSearchChange(event: any) {
    this.searchSubject.next(event.target.value);
  }

  setDateFilter(filter: 'today' | 'yesterday' | 'week' | 'all') {
    this.dateFilter = filter;
    this.applyFilters();
    this.cdr.detectChanges();
  }

  setStatusFilter(filter: 'pending' | 'completed' | 'recount' | 'all') {
    this.statusFilter = filter;
    this.applyFilters();
    this.cdr.detectChanges();
  }

  toggleLocationSort() {
    if (this.locationSort === '') this.locationSort = 'asc';
    else if (this.locationSort === 'asc') this.locationSort = 'desc';
    else this.locationSort = '';
    this.applyFilters();
    this.cdr.detectChanges();
  }

  trackByTaskId(index: number, task: CountTask): number {
    return task.id;
  }


  loadTasks(showLoading = true) {
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
          this.tasks = Array.isArray(res) ? res : (res.results || []);
          if (!Array.isArray(this.tasks)) {
             this.tasks = [];
          }
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
    if (showLoading) {
      this.isLoading = true;
      this.cdr.detectChanges();
    }
    const params: any = { as_role: 'counter' };
    const whId = this.state.appState.activeWarehouseId;
    if (whId && whId !== 'ALL' && whId !== -1) {
      params.warehouse_id = whId;
    }
    
    this.http.get<CountTask[]>(`${environment.apiUrl}/inventory/count-tasks/pool_tasks/`, { params }).subscribe({
      next: (res: any) => {
        this.poolTasks = Array.isArray(res) ? res : (res.results || []);
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

  setTab(tab: 'my-tasks' | 'pool') {
    this.currentTab = tab;
    this.selectedTasks.clear();
    this.selectedPoolTasks.clear();
    if (tab === 'my-tasks') {
      this.loadTasks();
    } else {
      this.loadPoolTasks();
    }
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
      next: (res: any) => {
        this.toast.success(`${res.claimed_count} کالا با موفقیت به عهده گرفته شد`);
        this.setTab('my-tasks');
      },
      error: (err) => {
        const errorMsg = err?.error?.error || 'خطا در عملیات';
        this.toast.error(errorMsg);
      }
    });
  }



  openDetail(task: CountTask) {
    this.selectedTask = task;
    // Fix: If counted_balance is 0, we should preserve it as '0' instead of ''
    this.countedBalanceStr = (task.counted_balance !== null && task.counted_balance !== undefined) ? String(task.counted_balance) : '';
    this.counterNote = task.counter_note || '';
    this.cdr.detectChanges();
  }

  closeDetail() {
    this.selectedTask = null;
    this.cdr.detectChanges();
  }

  saveDraft() {
    if (!this.selectedTask) return;
    
    // We only save it as draft, status remains PENDING_COUNT or whatever it was
    const payload = {
      counted_balance: this.countedBalanceStr || null,
      counter_note: this.counterNote
    };

    this.countTaskApi.update(this.selectedTask.id, payload).subscribe({
      next: (res) => {
        Object.assign(this.selectedTask!, res);
        this.applyFilters();
        this.toast.success('مقدار موقتاً ذخیره شد');
        this.closeDetail();
        this.cdr.detectChanges();
      },
      error: () => {
        this.toast.error('خطا در ذخیره اطلاعات');
        this.cdr.detectChanges();
      }
    });
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
    const readyTasks = this.tasks.filter(t => t.counted_balance !== null);
    if (this.selectedTasks.size === readyTasks.length && readyTasks.length > 0) {
      this.selectedTasks.clear();
    } else {
      readyTasks.forEach(t => this.selectedTasks.add(t.id));
    }
    this.cdr.detectChanges();
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
      message: `آیا از ارسال ${countToSubmit} مورد شمرده شده به کارتابل سرپرست اطمینان دارید؟ موارد ارسال شده دیگر در این صفحه قابل ویرایش نخواهند بود.`,
      confirmText: 'بله، ارسال کن',
      cancelText: 'انصراف',
      type: 'info'
    });

    if (confirmed) {
      const payload = isPartial ? { task_ids: Array.from(this.selectedTasks) } : {};
      this.countTaskApi.bulkSubmit(payload).subscribe({
        next: (res) => {
          this.toast.success(res.message);
          this.selectedTasks.clear();
          this.loadTasks();
        },
        error: () => {
          this.toast.error('خطا در ارسال اطلاعات');
          this.cdr.detectChanges();
        }
      });
    }
  }
}
