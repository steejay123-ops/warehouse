import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '../../services/state.service';
import { ToastService } from '../../services/toast.service';
import { CountTaskApiService } from '../../core/api/count-task-api.service';
import { CountTaskStatus } from '../../core/models/count-task.model';

@Component({
  selector: 'app-manager-review',
  imports: [CommonModule, FormsModule],
  templateUrl: './manager-review.html'
})
export class ManagerReview implements OnInit {
  tasks: any[] = [];
  isLoading = true;
  
  selectedTask: any = null;
  managerNote = '';

  constructor(
    public state: StateService, 
    private toast: ToastService,
    private countTaskApi: CountTaskApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadTasks();
  }

  loadTasks() {
    this.isLoading = true;
    this.countTaskApi.getAll({ status: 'MANAGER_REVIEW' }).subscribe({
      next: (res) => {
        // As a manager, we see MANAGER_REVIEW tasks from the API. The API might return all if we didn't filter,
        // so we filter locally if needed, but best if the API respects the filter (we didn't explicitly implement filter in API, so we filter here to be safe).
        this.tasks = res.results.filter((t: any) => t.status === 'MANAGER_REVIEW');
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

  selectTask(task: any) {
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
    if (!this.managerNote.trim()) {
       // Note optional for approve, but maybe we want to log it
    }
    this.updateTaskStatus('FINAL_APPROVED', 'تایید نهایی با موفقیت انجام شد');
  }

  rejectTask() {
    if (!this.managerNote.trim()) {
      return this.toast.show('error', 'لطفاً علت درخواست بازشماری (دستورات به سرپرست) را بنویسید.');
    }
    this.updateTaskStatus('MANAGER_REJECTED', 'ارجاع مجدد به سرپرست برای بازشماری انجام شد');
  }

  private updateTaskStatus(status: string, successMessage: string) {
    this.countTaskApi.update(this.selectedTask.id, {
      status: status as CountTaskStatus,
      manager_note: this.managerNote
    }).subscribe({
      next: () => {
        this.toast.show('success', successMessage);
        this.selectedTask = null;
        this.loadTasks();
      },
      error: () => {
        this.toast.show('error', 'خطا در ثبت اطلاعات');
        this.cdr.detectChanges();
      }
    });
  }
}
