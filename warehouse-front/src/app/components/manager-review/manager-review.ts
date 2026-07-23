import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthStore } from '../../core/stores/auth.store';
import { FormsModule } from '@angular/forms';
import { StateService } from '../../services/state.service';
import { ToastService } from '../../services/toast.service';
import { CountTaskApiService } from '../../core/api/count-task-api.service';
import { CountTask } from '../../core/models/count-task.model';
import { HasPermissionDirective } from '../../shared';
import { WarehouseSelectorComponent } from '../../shared/components/warehouse-selector/warehouse-selector.component';

@Component({
  selector: 'app-manager-review',
  standalone: true,
  imports: [CommonModule, FormsModule, HasPermissionDirective, WarehouseSelectorComponent],
  templateUrl: './manager-review.html'
})
export class ManagerReview implements OnInit {
  tasks: CountTask[] = [];
  isLoading = true;
  
  selectedTasks: Set<number> = new Set();
  
  // Single Review State (Legacy mode or Reject)
  selectedTask: CountTask | null = null;
  managerNote = '';

  // Bulk Approve Dialog State
  showApproveDialog = false;
  approveNote = '';

  constructor(
    public state: StateService, 
    public authStore: AuthStore,
    private toast: ToastService,
    private countTaskApi: CountTaskApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadTasks();
  }

  loadTasks() {
    this.isLoading = true;
    const params: any = { as_role: 'manager', status: 'MANAGER_REVIEW' };
    const whId = this.state.appState.activeWarehouseId;
    if (whId && whId !== 'ALL' && whId !== -1) {
      params.warehouse_id = whId;
    }
    
    this.countTaskApi.getAll(params).subscribe({
      next: (res: any) => {
        const allTasks = Array.isArray(res) ? res : (res.results || []);
        this.tasks = allTasks.filter((t: CountTask) => t.status === 'MANAGER_REVIEW');
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
    if (this.selectedTasks.has(taskId)) {
      this.selectedTasks.delete(taskId);
    } else {
      this.selectedTasks.add(taskId);
    }
    this.selectedTasks = new Set(this.selectedTasks);
    this.cdr.detectChanges();
  }

  onSelectionChange(selectedIds: Set<any>) {
    this.selectedTasks = new Set(Array.from(selectedIds).map(id => Number(id)));
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

    this.countTaskApi.bulkManagerApprove(Array.from(this.selectedTasks), this.approveNote).subscribe({
      next: (res) => {
        this.toast.show('success', res.message);
        this.showApproveDialog = false;
        this.selectedTasks = new Set();
        this.loadTasks();
      },
      error: () => {
        this.toast.show('error', 'خطا در تایید گروهی');
        this.cdr.detectChanges();
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
    this.countTaskApi.bulkManagerApprove([this.selectedTask.id], this.managerNote).subscribe({
      next: (res) => {
        this.toast.show('success', res.message || 'تایید نهایی با موفقیت انجام شد');
        this.selectedTask = null;
        this.loadTasks();
      },
      error: () => {
        this.toast.show('error', 'خطا در ثبت اطلاعات');
        this.cdr.detectChanges();
      }
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
        const errorMsg = err?.error?.error || 'خطا در ثبت اطلاعات';
        this.toast.show('error', errorMsg);
        this.cdr.detectChanges();
      }
    });
  }

  isMatched(task: CountTask | null): boolean {
    if (!task || !task.item_details || !task.counted_balance) return false;
    return +task.counted_balance === task.item_details.bal4miv;
  }
}
