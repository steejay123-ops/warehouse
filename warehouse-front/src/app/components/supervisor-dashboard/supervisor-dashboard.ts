import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '../../services/state.service';
import { ToastService } from '../../services/toast.service';
import { CountTaskApiService } from '../../core/api/count-task-api.service';

@Component({
  selector: 'app-supervisor-dashboard',
  imports: [CommonModule, FormsModule],
  templateUrl: './supervisor-dashboard.html'
})
export class SupervisorDashboard implements OnInit {
  tasks: any[] = [];
  isLoading = true;
  
  selectedTask: any = null;
  supervisorNote = '';

  constructor(
    public state: StateService, 
    private toast: ToastService,
    private countTaskApi: CountTaskApiService
  ) {}

  ngOnInit() {
    this.loadTasks();
  }

  loadTasks() {
    this.isLoading = true;
    this.countTaskApi.getAll().subscribe({
      next: (res) => {
        this.tasks = res.results;
        this.isLoading = false;
      },
      error: () => {
        this.toast.show('error', 'خطا در دریافت لیست وظایف');
        this.isLoading = false;
      }
    });
  }

  selectTask(task: any) {
    this.selectedTask = task;
    this.supervisorNote = task.supervisor_note || '';
  }

  cancelReview() {
    this.selectedTask = null;
    this.supervisorNote = '';
  }

  approveTask() {
    this.updateTaskStatus('MANAGER_REVIEW', 'تایید و ارسال به مدیر');
  }

  rejectTask() {
    if (!this.supervisorNote.trim()) {
      return this.toast.show('error', 'لطفاً علت رد کردن (توضیحات سرپرست) را بنویسید.');
    }
    this.updateTaskStatus('SUPERVISOR_REJECTED', 'رد شمارش و ارجاع مجدد به شمارشگر');
  }

  private updateTaskStatus(status: string, successMessage: string) {
    this.countTaskApi.update(this.selectedTask.id, {
      status: status,
      supervisor_note: this.supervisorNote
    }).subscribe({
      next: () => {
        this.toast.show('success', successMessage);
        this.selectedTask = null;
        this.loadTasks();
      },
      error: () => this.toast.show('error', 'خطا در ثبت اطلاعات')
    });
  }
}
