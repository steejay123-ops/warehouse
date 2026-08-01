import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '../../services/state.service';
import { ToastService } from '../../services/toast.service';
import { CountTaskApiService } from '../../core/api/count-task-api.service';
import { SettingsService } from '../../services/settings';

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
  isBlindCounting = false;

  constructor(
    public state: StateService, 
    private toast: ToastService,
    private countTaskApi: CountTaskApiService,
    private cdr: ChangeDetectorRef,
    private settingsService: SettingsService
  ) {}

  ngOnInit() {
    this.loadTasks();
    const whId = this.state.appState.activeWarehouseId;
    if (whId && whId !== 'ALL') {
        this.settingsService.getWarehouseSettings(Number(whId)).subscribe({
          next: (res: any) => {
            this.isBlindCounting = res?.blind_counting?.value === 'blind';
            this.cdr.detectChanges();
          }
        });
    }
  }

  loadTasks() {
    this.isLoading = true;
    this.cdr.detectChanges();
    this.countTaskApi.getAll().subscribe({
      next: (res: any) => {
        this.tasks = Array.isArray(res) ? res : (res.results || []);
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.toast.show('error', 'خطا در دریافت لیست شمارش');
        this.isLoading = false;
        this.cdr.detectChanges();
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
      counted_balance: this.countedQty?.toString() || null,
      counter_note: this.counterNote,
      status: 'COUNTED'
    }).subscribe({
      next: () => {
        this.toast.show('success', 'اطلاعات شمارش با موفقیت در سیستم ثبت شد و به سرپرست ارجاع یافت.');
        this.selectedTask = null;
        this.loadTasks();
      },
      // پیام خطا از errorInterceptor می‌آید؛ توست محلی روی آن سوار می‌شد.
      error: () => {}
    });
  }
}
