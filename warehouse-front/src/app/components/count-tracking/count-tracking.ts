import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CountTaskApiService } from '../../core/api/count-task-api.service';
import { CountTask } from '../../core/models/count-task.model';
import { ToastService } from '../../services/toast.service';
import { ConfirmDialogService } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { StateService } from '../../services/state.service';
import { AuthStore } from '../../core/stores/auth.store';
import { DataTableComponent, TableColumnDirective } from '../../shared/components/data-table/data-table.component';

@Component({
  selector: 'app-count-tracking',
  standalone: true,
  imports: [CommonModule, FormsModule, DataTableComponent, TableColumnDirective],
  templateUrl: './count-tracking.html',
  styleUrl: './count-tracking.css'
})
export class CountTracking implements OnInit {
  tasks: CountTask[] = [];
  filteredTasks: CountTask[] = [];
  isLoading = true;
  showCompleted = false;
  selectedTaskIds: Set<number> = new Set();
  
  visibleCols: string[] = [
    'warehouse_name',
    'fa_unic_code',
    'description',
    'counter',
    'supervisor',
    'manager',
    'status',
    'counted_balance'
  ];

  statusFilter = '';
  searchQuery = '';
  
  private authStore = inject(AuthStore);

  constructor(
    private countTaskApi: CountTaskApiService,
    private toast: ToastService,
    private confirmDialog: ConfirmDialogService,
    private cdr: ChangeDetectorRef,
    public state: StateService
  ) {}

  ngOnInit() {
    this.loadTasks();
  }

  toggleCompleted() {
    this.showCompleted = !this.showCompleted;
    this.loadTasks();
  }

  loadTasks() {
    this.isLoading = true;
    const params: any = { as_role: 'tracking', show_completed: this.showCompleted, page_size: 1000 };
    const whId = this.authStore.activeWarehouseId();
    if (whId && whId !== 'ALL' && whId !== -1) {
      params.warehouse_id = whId;
    }
    
    this.countTaskApi.getAll(params).subscribe({
      next: (res: any) => {
        this.tasks = Array.isArray(res) ? res : (res.results || []);
        this.applyFilters();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.toast.show('error', 'خطا در دریافت لیست پیگیری');
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  applyFilters() {
    this.filteredTasks = this.tasks.filter(t => {
      const matchStatus = this.statusFilter ? t.status === this.statusFilter : true;
      const matchSearch = this.searchQuery ? 
        (t.item_details?.fa_unic_code?.includes(this.searchQuery) || 
         t.item_details?.description?.includes(this.searchQuery)) : true;
      return matchStatus && matchSearch;
    });
  }

  onSelectionChange(selectedIds: Set<any>) {
    this.selectedTaskIds = new Set(Array.from(selectedIds).map(id => Number(id)));
  }

  async cancelAllocation() {
    if (this.selectedTaskIds.size === 0) {
      this.toast.show('warning', 'هیچ رکوردی انتخاب نشده است');
      return;
    }

    const confirmed = await this.confirmDialog.open({
      title: 'لغو تخصیص',
      message: `آیا از لغو تخصیص و برگرداندن ${this.selectedTaskIds.size} رکورد به لیست در انتظار شمارش اطمینان دارید؟`,
      confirmText: 'بله، لغو تخصیص',
      cancelText: 'انصراف',
      type: 'warning'
    });

    if (confirmed) {
      this.countTaskApi.bulkCancel(Array.from(this.selectedTaskIds)).subscribe({
        next: (res) => {
          this.toast.show('success', res.message);
          this.selectedTaskIds.clear();
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
    return 'px-2 py-0.5 rounded-full text-[10px] font-bold border ' + (classMap[status] || 'bg-slate-100 text-slate-700');
  }

  formatDuration(diffMs: number): string {
    if (isNaN(diffMs) || diffMs < 0) return '-';
    
    const diffMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
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
}
