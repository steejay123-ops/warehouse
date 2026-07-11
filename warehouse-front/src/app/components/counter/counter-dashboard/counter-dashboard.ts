import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CountTaskApiService } from '../../../core/api/count-task-api.service';
import { CountTask } from '../../../core/models/count-task.model';
import { ToastService } from '../../../services/toast.service';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-counter-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './counter-dashboard.html',
  styleUrl: './counter-dashboard.css'
})
export class CounterDashboard implements OnInit {
  tasks: CountTask[] = [];
  isLoading = true;
  selectedTask: CountTask | null = null;
  
  // Detail view state
  countedBalanceStr: string = '';
  counterNote: string = '';

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
    this.countTaskApi.getAll({ page_size: 1000 }).subscribe({
      next: (res: any) => {
        try {
          this.tasks = Array.isArray(res) ? res : (res.results || []);
          if (!Array.isArray(this.tasks)) {
             this.tasks = [];
          }
          console.log('Loaded tasks safely:', this.tasks);
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

  get pendingTasks() {
    return this.tasks.filter(t => t.status === 'PENDING_COUNT' || t.status === 'SUPERVISOR_REJECTED');
  }

  get readyToSubmitCount() {
    return this.tasks.filter(t => (t.status === 'PENDING_COUNT' || t.status === 'SUPERVISOR_REJECTED') && t.counted_balance !== null).length;
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

  async submitAll() {
    if (this.readyToSubmitCount === 0) {
      this.toast.error('موردی برای ارسال وجود ندارد');
      return;
    }

    const confirmed = await this.confirmDialog.open({
      title: 'ارسال به سرپرست',
      message: `آیا از ارسال ${this.readyToSubmitCount} مورد شمرده شده به کارتابل سرپرست اطمینان دارید؟ موارد ارسال شده دیگر در این صفحه قابل ویرایش نخواهند بود.`,
      confirmText: 'بله، ارسال کن',
      cancelText: 'انصراف',
      type: 'info'
    });

    if (confirmed) {
      this.countTaskApi.bulkSubmit().subscribe({
        next: (res) => {
          this.toast.success(res.message);
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
