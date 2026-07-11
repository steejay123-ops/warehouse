import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CountTaskApiService } from '../../../core/api/count-task-api.service';
import { CountTask } from '../../../core/models/count-task.model';
import { ToastService } from '../../../services/toast.service';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-supervisor-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './supervisor-dashboard.html',
  styleUrl: './supervisor-dashboard.css'
})
export class SupervisorDashboard implements OnInit {
  tasks: CountTask[] = [];
  isLoading = true;
  selectedTasks: Set<number> = new Set();
  
  // Reject Dialog State
  showRejectDialog = false;
  rejectingTask: CountTask | null = null;
  rejectNote: string = '';

  // History Dialog State
  showHistoryDialog = false;
  historyTask: CountTask | null = null;

  constructor(
    private countTaskApi: CountTaskApiService,
    private toast: ToastService,
    private confirmDialog: ConfirmDialogService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadTasks();
  }

  loadTasks() {
    this.isLoading = true;
    this.cdr.detectChanges();
    this.countTaskApi.getAll({ status: 'COUNTED', page_size: 1000 }).subscribe({
      next: (res: any) => {
        try {
          const allTasks = Array.isArray(res) ? res : (res.results || []);
          this.tasks = Array.isArray(allTasks) ? allTasks.filter((t: CountTask) => t.status === 'COUNTED' || t.status === 'MANAGER_REJECTED') : [];
        } catch (e) {
          console.error('Error assigning tasks:', e);
          this.tasks = [];
        }
        this.selectedTasks.clear();
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

  toggleSelection(taskId: number) {
    if (this.selectedTasks.has(taskId)) {
      this.selectedTasks.delete(taskId);
    } else {
      this.selectedTasks.add(taskId);
    }
  }

  toggleAll(event: Event) {
    const isChecked = (event.target as HTMLInputElement).checked;
    if (isChecked) {
      this.tasks.forEach(t => this.selectedTasks.add(t.id));
    } else {
      this.selectedTasks.clear();
    }
  }

  isAllSelected() {
    return this.tasks.length > 0 && this.selectedTasks.size === this.tasks.length;
  }

  async bulkApprove() {
    if (this.selectedTasks.size === 0) return;

    const confirmed = await this.confirmDialog.open({
      title: 'تایید اقلام شمرده شده',
      message: `آیا از تایید ${this.selectedTasks.size} قلم کالا و ارسال آن‌ها برای مدیریت اطمینان دارید؟`,
      confirmText: 'بله، تایید کن',
      cancelText: 'انصراف',
      type: 'info'
    });

    if (confirmed) {
      this.countTaskApi.bulkApprove(Array.from(this.selectedTasks)).subscribe({
        next: (res) => {
          this.toast.success(res.message);
          this.loadTasks();
        },
        error: () => {
          this.toast.error('خطا در تایید کالاها');
          this.cdr.detectChanges();
        }
      });
    }
  }

  async approveSingle(task: CountTask) {
    const confirmed = await this.confirmDialog.open({
      title: 'تایید کالا',
      message: `موجودی ${task.counted_balance} برای ${task.item_details?.description} تایید شود؟`,
      confirmText: 'بله',
      cancelText: 'خیر',
      type: 'info'
    });

    if (confirmed) {
      this.countTaskApi.bulkApprove([task.id]).subscribe({
        next: (res) => {
          this.toast.success('کالا با موفقیت تایید شد');
          this.loadTasks();
        },
        error: () => {
          this.toast.error('خطا در عملیات');
          this.cdr.detectChanges();
        }
      });
    }
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
}
