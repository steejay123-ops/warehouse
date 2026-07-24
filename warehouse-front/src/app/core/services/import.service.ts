import { Injectable, NgZone, ApplicationRef } from '@angular/core';
import { Subject } from 'rxjs';
import { ItemApiService } from '../api/item-api.service';
import { ToastService } from '../../services/toast.service';
import { StateService } from '../../services/state.service';

export interface WarehouseImportState {
  importTag: string;
  conflictAction: string;
  logs: any[];
  latestCreatedLogs: any[];
  latestUpdatedLogs: any[];
  latestWarnLogs: any[];
  latestErrLogs: any[];
  errCount: number;
  warnCount: number;
  createdCount: number;
  updatedCount: number;
  isSimulating: boolean;
  isCanceling: boolean;
  isParsingHeaders: boolean;
  uploadProgress: number;
  fileToUpload: File | null;
  foundFields: string[];
  missingFields: string[];
  showErrorDetails: boolean;
  errorDetailsList: any[];
  importId: string;
  recentOperations: any[];
  processStartTime?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ImportService {
  private states = new Map<number, WarehouseImportState>();
  public stateUpdated = new Subject<void>();

  constructor(
    private itemApi: ItemApiService,
    private toast: ToastService,
    private stateService: StateService,
    private ngZone: NgZone,
    private appRef: ApplicationRef
  ) {
    setInterval(() => {
      this.states.forEach(state => {
        let changed = false;
        if (state.recentOperations && state.recentOperations.length > 0) {
          state.recentOperations = state.recentOperations.filter((op: any) => {
            if (op.time_remaining_seconds > 0) {
              op.time_remaining_seconds--;
              return true;
            }
            return false;
          });
          changed = true;
        }
        if (changed) {
          this.stateUpdated.next();
        }
      });
    }, 1000);
  }

  private get activeWarehouseId(): number | null {
    return this.stateService.appState.activeWarehouseId;
  }

  checkLatestImport(warehouseId: number) {
    this.itemApi.getLatestImport(warehouseId).subscribe({
      next: (res) => {
        const state = this.states.get(warehouseId);
        if (state && res.recent_imports) {
          state.recentOperations = res.recent_imports;
          this.stateUpdated.next();
        }
      },
      error: (err) => console.error(err)
    });
  }

  revertOperation(warehouseId: number, importId: string) {
    const state = this.states.get(warehouseId);
    if (!state) return;

    this.itemApi.revertImport(importId).subscribe({
      next: (res) => {
        this.toast.show('success', res.msg || 'عملیات با موفقیت لغو و داده‌ها بازگردانی شدند.');
        state.createdCount = 0;
        state.updatedCount = 0;
        state.warnCount = 0;
        state.errCount = 0;
        state.errorDetailsList = [];
        state.latestCreatedLogs = [];
        state.latestUpdatedLogs = [];
        state.latestWarnLogs = [];
        state.latestErrLogs = [];
        state.logs.unshift({ time: new Date(), type: 'info', msg: `>> بازگشت داده‌های حذف/تغییر یافته: ${res.affected_records || 0} رکورد.` });
        this.checkLatestImport(warehouseId); // Refresh operations list
      },
      error: (err) => {
        this.toast.show('error', err.error?.error || 'خطا در بازگردانی عملیات.');
      }
    });
  }

  clearWarehouseData(warehouseId: number) {
    this.itemApi.clearWarehouseData(warehouseId).subscribe({
      next: (res) => {
        this.toast.show('success', res.msg || 'اطلاعات انبار با موفقیت حذف شد.');
        const state = this.states.get(warehouseId);
        if (state) {
          state.createdCount = 0;
          state.updatedCount = 0;
          state.warnCount = 0;
          state.errCount = 0;
          state.errorDetailsList = [];
          state.latestCreatedLogs = [];
          state.latestUpdatedLogs = [];
          state.latestWarnLogs = [];
          state.latestErrLogs = [];
          state.logs.unshift({ time: new Date(), type: 'info', msg: `>> حذف اطلاعات انبار فعلی انجام شد.` });
        }
        this.checkLatestImport(warehouseId);
        this.stateUpdated.next();
      },
      error: (err) => {
        this.toast.show('error', err.error?.error || 'خطا در حذف اطلاعات انبار.');
      }
    });
  }

  get currentState(): WarehouseImportState {
    const wId = this.activeWarehouseId;
    if (!wId) {
      // Return a dummy state if no warehouse is selected, though UI prevents this
      return this.createEmptyState();
    }
    
    if (!this.states.has(wId)) {
      this.states.set(wId, this.createEmptyState());
    }
    return this.states.get(wId)!;
  }

  private createEmptyState(): WarehouseImportState {
    return {
      importTag: '',
      conflictAction: 'ignore',
      logs: [],
      latestCreatedLogs: [],
      latestUpdatedLogs: [],
      latestWarnLogs: [],
      latestErrLogs: [],
      errCount: 0,
      warnCount: 0,
      createdCount: 0,
      updatedCount: 0,
      isSimulating: false,
      isCanceling: false,
      isParsingHeaders: false,
      uploadProgress: 0,
      fileToUpload: null,
      foundFields: [],
      missingFields: [],
      showErrorDetails: false,
      errorDetailsList: [],
      importId: '',
      recentOperations: []
    };
  }

  resetForm() {
    const wId = this.activeWarehouseId;
    if (wId) {
      const oldState = this.states.get(wId);
      const newState = this.createEmptyState();
      if (oldState) {
        newState.recentOperations = oldState.recentOperations;
      }
      this.states.set(wId, newState);
    }
  }

  clearLogs() {
    const wId = this.activeWarehouseId;
    if (wId) {
      const state = this.states.get(wId);
      if (state) {
        state.logs = [];
        state.latestCreatedLogs = [];
        state.latestUpdatedLogs = [];
        state.latestWarnLogs = [];
        state.latestErrLogs = [];
        state.errorDetailsList = [];
        state.errCount = 0;
        state.warnCount = 0;
        state.createdCount = 0;
        state.updatedCount = 0;
        state.showErrorDetails = false;
        this.stateUpdated.next();
      }
    }
  }

  cancelProcess() {
    const state = this.currentState;
    if (state.isSimulating && state.importId) {
      state.isCanceling = true;
      this.itemApi.cancelImport(state.importId).subscribe({
        next: () => {
          this.toast.show('info', 'درخواست لغو ارسال شد. در حال برگشت تغییرات...');
        },
        error: () => {
          this.toast.show('error', 'خطا در ارسال درخواست لغو');
          state.isCanceling = false;
        }
      });
    }
  }

  async simulateImportProcess(warehouseId: number) {
    // get the specific state for this warehouse ID so we don't rely on the active one changing during await
    if (!this.states.has(warehouseId)) {
      this.states.set(warehouseId, this.createEmptyState());
    }
    const state = this.states.get(warehouseId)!;

    if (state.isSimulating || !state.fileToUpload) return;

    state.isSimulating = true;
    state.isCanceling = false;
    state.importId = Date.now().toString(36) + Math.random().toString(36).substring(2);
    
    // Clear counters and arrays for new run, but keep the main text logs
    state.latestCreatedLogs = [];
    state.latestUpdatedLogs = [];
    state.latestWarnLogs = [];
    state.latestErrLogs = [];
    state.errCount = 0;
    state.warnCount = 0;
    state.createdCount = 0;
    state.updatedCount = 0;
    state.errorDetailsList = [];
    
    state.logs.unshift({ time: new Date(), type: 'info', msg: '---------------------------------------------------' });
    state.logs.unshift({ time: new Date(), type: 'info', msg: '>> شروع فرآیند جدید پردازش فایل...' });
    state.processStartTime = performance.now();

    try {
      const response = await this.itemApi.bulkImportStream(
        state.fileToUpload, 
        warehouseId,
        state.conflictAction,
        state.importTag,
        state.importId
      );

      if (!response.ok) {
        throw new Error(`پاسخ خطا از سرور: ${response.status}`);
      }
      if (!response.body) {
        throw new Error("پاسخ سرور نامعتبر است");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let done = false;
      
      const processLine = (line: string) => {
        if (!line.trim()) return;
        try {
          const data = JSON.parse(line);
          if (data.type === 'summary') {
            state.isSimulating = false;
            state.isCanceling = false;
            
            if (data.status !== 'cancelled') {
              if (data.found_fields) state.foundFields = data.found_fields;
              if (data.missing_fields) state.missingFields = data.missing_fields;
            }
            if (data.error_details) state.errorDetailsList = data.error_details;
            state.createdCount = data.created !== undefined ? data.created : state.createdCount;
            state.updatedCount = data.updated !== undefined ? data.updated : state.updatedCount;
            state.warnCount = data.skipped !== undefined ? data.skipped : state.warnCount;
            state.errCount = data.failed !== undefined ? data.failed : state.errCount;

            if (data.status === 'cancelled') {
              state.logs.unshift({ time: new Date(), type: 'err', msg: '>> فرآیند توسط کاربر لغو شد. هیچ تغییری در دیتابیس ثبت نشد.' });
              if (this.activeWarehouseId === warehouseId) this.toast.show('error', 'فرآیند لغو شد و هیچ تغییری ثبت نشد.');
            } else if (data.status === 'failed') {
              state.logs.unshift({ time: new Date(), type: 'err', msg: '>> عملیات به دلیل خطاهای حیاتی متوقف شد.' });
              if (this.activeWarehouseId === warehouseId) this.toast.show('error', 'فرآیند با خطا روبرو شد.');
            } else {
              if (data.created > 0) state.logs.unshift({ time: new Date(), type: 'ok', msg: `[OK] تعداد ${data.created} رکورد جدید با موفقیت ایجاد شد.` });
              if (data.updated > 0) state.logs.unshift({ time: new Date(), type: 'ok', msg: `[OK] تعداد ${data.updated} رکورد با اطلاعات جدید به‌روزرسانی شد.` });
              if (data.skipped > 0) state.logs.unshift({ time: new Date(), type: 'warn', msg: `[WARN] تعداد ${data.skipped} رکورد تکراری نادیده گرفته شد.` });
              if (data.failed > 0) state.logs.unshift({ time: new Date(), type: 'err', msg: `[ERR] تعداد ${data.failed} رکورد دارای خطا بودند.` });

              let timeMsg = '';
              if (state.processStartTime) {
                const duration = ((performance.now() - state.processStartTime) / 1000).toFixed(1);
                timeMsg = ` (زمان: ${duration} ثانیه)`;
              }
              state.logs.unshift({ time: new Date(), type: 'success', msg: `>> فرآیند با موفقیت پایان یافت.${timeMsg}` });
              if (this.activeWarehouseId === warehouseId) {
                this.toast.show('success', 'اطلاعات با موفقیت پردازش شد.');
              }
              // Refresh the latest import to show the undo button and timer
              this.checkLatestImport(warehouseId);
            }
          } else {
            if (data.type === 'info') {
              data.time = new Date();
              state.logs.unshift(data);
              if (state.logs.length > 50) state.logs.pop();
            }
            else if (data.type === 'created') {
              state.createdCount++;
              state.latestCreatedLogs.unshift(data);
              if (state.latestCreatedLogs.length > 10) state.latestCreatedLogs.pop();
            }
            else if (data.type === 'updated') {
              state.updatedCount++;
              state.latestUpdatedLogs.unshift(data);
              if (state.latestUpdatedLogs.length > 10) state.latestUpdatedLogs.pop();
            }
            else if (data.type === 'warn') {
              state.warnCount++;
              state.latestWarnLogs.unshift(data);
              if (state.latestWarnLogs.length > 10) state.latestWarnLogs.pop();
            }
            else if (data.type === 'err') {
              state.errCount++;
              state.latestErrLogs.unshift(data);
              if (state.latestErrLogs.length > 10) state.latestErrLogs.pop();
            }
          }
        } catch (e) {}
      };

      try {
        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          
          if (value) {
            buffer += decoder.decode(value, {stream: !done});
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            
            for (const line of lines) {
              processLine(line);
            }
            this.stateUpdated.next();
          }
        }
        
        if (buffer.trim()) {
          processLine(buffer);
        }
      } catch (e) {
        console.error('Stream reading error', e);
      }
      
      state.isSimulating = false;
      state.isCanceling = false;
      this.stateUpdated.next();
    } catch (error: any) {
      console.error(error);
      state.logs.unshift({ type: 'err', msg: `[ERR] خطای سرور: ${error.message}` });
      if (this.activeWarehouseId === warehouseId) this.toast.show('error', 'خطا در پردازش اطلاعات.');
      state.isSimulating = false;
      state.isCanceling = false;
      this.stateUpdated.next();
    }
  }
}
