import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '../../services/state.service';
import { ToastService } from '../../services/toast.service';
import { CountTaskApiService } from '../../core/api/count-task-api.service';

@Component({
  selector: 'app-field',
  imports: [CommonModule, FormsModule],
  templateUrl: './field.html',
  styleUrl: './field.css'
})
export class Field implements OnInit {
  tasks: any[] = [];
  isLoading = true;
  
  selectedTask: any = null;
  countedQty: number | null = null;
  counterNote = '';

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
        this.toast.show('error', 'خطا در دریافت لیست شمارش');
        this.isLoading = false;
      }
    });
  }

  selectTask(task: any) {
    this.selectedTask = task;
    this.countedQty = task.counted_balance !== null ? task.counted_balance : null;
    this.counterNote = task.counter_note || '';
  }

  cancelCount() {
    this.selectedTask = null;
    this.countedQty = null;
    this.counterNote = '';
  }

  submitCount() {
    if (this.countedQty === null || this.countedQty < 0) {
      return this.toast.show('error', 'لطفاً مقدار شمارش شده را به درستی وارد کنید.');
    }
    
    this.countTaskApi.update(this.selectedTask.id, {
      counted_balance: this.countedQty,
      counter_note: this.counterNote,
      status: 'COUNTED'
    }).subscribe({
      next: () => {
        this.toast.show('success', 'اطلاعات شمارش با موفقیت در سیستم ثبت شد و به سرپرست ارجاع یافت.');
        this.selectedTask = null;
        this.loadTasks();
      },
      error: () => this.toast.show('error', 'خطا در ثبت شمارش')
    });
  }
}
