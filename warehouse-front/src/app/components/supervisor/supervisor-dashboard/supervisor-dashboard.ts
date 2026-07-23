import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CountTaskApiService } from '../../../core/api/count-task-api.service';
import { CountTask } from '../../../core/models/count-task.model';
import { ToastService } from '../../../services/toast.service';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { StateService } from '../../../services/state.service';
import { HasPermissionDirective } from '../../../shared';
import { WarehouseSelectorComponent } from '../../../shared/components/warehouse-selector/warehouse-selector.component';
import { AuthStore } from '../../../core/stores/auth.store';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-supervisor-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, HasPermissionDirective, WarehouseSelectorComponent],
  templateUrl: './supervisor-dashboard.html',
  styleUrl: './supervisor-dashboard.css'
})
export class SupervisorDashboard implements OnInit {
  authStore = inject(AuthStore);
  tasks: CountTask[] = [];
  poolTasks: CountTask[] = [];
  isLoading = true;
  selectedTasks: Set<number> = new Set();
  selectedPoolTasks: Set<number> = new Set();
  currentTab: 'my-tasks' | 'pool' = 'my-tasks';
  
  // Reject Dialog State
  showRejectDialog = false;
  rejectingTask: CountTask | null = null;
  rejectNote: string = '';

  // Approve Dialog State
  showApproveDialog = false;
  approveNote: string = '';

  // History Dialog State
  showHistoryDialog = false;
  historyTask: CountTask | null = null;

  constructor(
    private countTaskApi: CountTaskApiService,
    private toast: ToastService,
    private confirmDialog: ConfirmDialogService,
    private cdr: ChangeDetectorRef,
    public state: StateService,
    private http: HttpClient
  ) {}

  ngOnInit() {
    this.loadTasks();
  }

  loadTasks() {
    this.isLoading = true;
    this.cdr.detectChanges();
    
    const params: any = { as_role: 'supervisor', status: 'COUNTED', page_size: 1000 };
    const whId = this.state.appState.activeWarehouseId;
    if (whId && whId !== 'ALL' && whId !== -1) {
      params.warehouse_id = whId;
    }

    this.countTaskApi.getAll(params).subscribe({
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

  loadPoolTasks() {
    this.isLoading = true;
    this.cdr.detectChanges();
    
    const params: any = { as_role: 'supervisor' };
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
    this.selectedPoolTasks = new Set(this.selectedPoolTasks);
    this.cdr.detectChanges();
  }

  async claimSelectedTasks() {
    if (this.selectedPoolTasks.size === 0) return;
    
    const payload = {
      task_ids: Array.from(this.selectedPoolTasks),
      as_role: 'supervisor'
    };

    this.http.post(`${environment.apiUrl}/inventory/count-tasks/claim_tasks/`, payload).subscribe({
      next: (res: any) => {
        this.toast.success(`${res.claimed_count} کالا با موفقیت به عهده گرفته شد`);
        this.setTab('my-tasks');
      },
      error: (err: any) => {
        const errorMsg = err?.error?.error || 'خطا در عملیات';
        this.toast.error(errorMsg);
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

    this.countTaskApi.bulkApprove(Array.from(this.selectedTasks), this.approveNote).subscribe({
      next: (res) => {
        this.toast.success(res.message);
        this.showApproveDialog = false;
        this.selectedTasks = new Set();
        this.loadTasks();
      },
      error: () => {
        this.toast.error('خطا در تایید کالاها');
        this.cdr.detectChanges();
      }
    });
  }

  approveSingle(task: CountTask) {
    this.selectedTasks = new Set([task.id]);
    this.openApproveDialog();
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
