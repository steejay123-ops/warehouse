import { Component, OnInit, ChangeDetectorRef, OnDestroy, DoCheck } from '@angular/core';
import { HttpEventType } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { StateService } from '../../services/state.service';
import { ToastService } from '../../services/toast.service';
import { FileUploadComponent } from '../../shared';
import { ModalComponent } from '../../shared';
import { ItemApiService } from '../../core/api/item-api.service';
import { ImportService } from '../../core/services/import.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-docs',
  standalone: true,
  imports: [CommonModule, FormsModule, FileUploadComponent, ModalComponent],
  templateUrl: './docs.html',
  styleUrl: './docs.css'
})
export class Docs implements OnInit, OnDestroy, DoCheck {
  isDeleteModalOpen: boolean = false;
  deleteMode: 'all' | 'excel' = 'all';
  deleteCountdown: number = 10;
  private deleteInterval: any;
  existingTags: string[] = [];
  expandedSection: string | null = null;
  
  showLeaveModal: boolean = false;
  private leavePromiseResolver: ((value: boolean) => void) | null = null;

  confirmLeave(): Promise<boolean> | boolean {
    if (this.importService.currentState.isSimulating) {
      this.showLeaveModal = true;
      return new Promise<boolean>((resolve) => {
        this.leavePromiseResolver = resolve;
      });
    }
    return true;
  }

  resolveLeave(choice: 'continue' | 'cancel' | 'stay') {
    if (!this.leavePromiseResolver) return;

    if (choice === 'continue') {
      this.leavePromiseResolver(true);
    } else if (choice === 'cancel') {
      this.importService.cancelProcess();
      this.leavePromiseResolver(true);
    } else if (choice === 'stay') {
      this.leavePromiseResolver(false);
    }

    this.showLeaveModal = false;
    this.leavePromiseResolver = null;
  }

  ALL_FIELDS = [
    {id: 'id', name: 'شناسه (ID)'},
    {id: 'fa_unic_code', name: 'کد سیستم (FA-UNIC CODE)'},
    {id: 'plpkitem', name: 'کد ترکیبی (plpkitem)'},
    {id: 'pl', name: 'پکینگ لیست (PL)'},
    {id: 'po', name: 'سفارش خرید (PO)'},
    {id: 'pk_number', name: 'پکیج (PK)'},
    {id: 'item_no', name: 'ردیف (Item)'},
    {id: 'description', name: 'شرح کالا (Description)'},
    {id: 'unit', name: 'واحد سنجش (Unit)'},
    {id: 'scope_discipline', name: 'دیسیپلین کاری (Scope-Desipline)'},
    {id: 'balance', name: 'موجودی فیزیکی (Balance)'},
    {id: 'bal4miv', name: 'موجودی مجاز MIV (Bal4MIV)'},
    {id: 'old_location', name: 'لوکیشن قبلی (OLD Location)'},
    {id: 'new_location', name: 'لوکیشن جدید (NEW Location)'},
    {id: 'hov_no', name: 'شماره (HOVNo)'},
    {id: 'hov_date', name: 'تاریخ (HOVDate)'},
    {id: 'msr_status', name: 'وضعیت (MSRStatus)'},
    {id: 'vendor', name: 'سازنده (Vendor)'},
    {id: 'supplier', name: 'تامین کننده (Supplier)'},
    {id: 'irn_no', name: 'شماره (IRNNo)'},
    {id: 'item2', name: 'ردیف فرعی (ITEM2)'},
    {id: 'inventory_status', name: 'طبقه‌بندی انبار (INVENTORY)'},
    {id: 'indent', name: 'تقاضای خرید (INDENT)'},
    {id: 'remark', name: 'ملاحظات (Remark)'},
    {id: 'price_amount', name: 'مبلغ (Price Amount)'},
    {id: 'currency', name: 'ارز (Currency)'},
    {id: 'invoice_file', name: 'آدرس فایل فاکتور (Invoice File)'},
    {id: 'invoice_page', name: 'صفحه فاکتور (Invoice Page)'},
    {id: 'customs_field', name: 'فیلد گمرکی (Customs Field)'},
    {id: 'customs_file', name: 'آدرس فایل گمرکی (Customs File)'},
    {id: 'customs_file_page', name: 'صفحه گمرک (Customs File Page)'},
    {id: 'price_remark', name: 'توضیحات قیمت (PriceRemark)'},
    {id: 'issue_remark', name: 'ملاحظات صدور (Issue Remark)'},
    {id: 'created_at', name: 'تاریخ ایجاد (createAt)'},
    {id: 'updated_at', name: 'تاریخ ویرایش (updateAt)'},
    {id: 'created_by', name: 'ایجاد کننده (createdBy)'},
    {id: 'modified_by', name: 'ویرایش کننده (modifyBy)'},
    {id: 'warehouse', name: 'انبار (Warehouse)'},
    {id: 'tag', name: 'تگ‌ها (Tag)'}
  ];

  constructor(
    public state: StateService,
    private toast: ToastService,
    private itemApi: ItemApiService,
    public importService: ImportService,
    private cdr: ChangeDetectorRef
  ) {}

  get hasWarehouse(): boolean {
    return !!this.state.appState.activeWarehouseId;
  }

  private stateSub?: Subscription;
  private lastCheckedWarehouseId: number | null = null;

  ngOnInit() {
    const tagsSet = new Set<string>();
    this.state.appState.items.forEach((r: any) => {
      if (r.tag) r.tag.split('،').forEach((t: string) => tagsSet.add(t.trim()));
    });
    this.existingTags = Array.from(tagsSet);
    
    this.stateSub = this.importService.stateUpdated.subscribe(() => {
      this.cdr.detectChanges();
    });
  }

  ngDoCheck() {
    const currentWId = this.state.appState.activeWarehouseId;
    if (currentWId && currentWId !== this.lastCheckedWarehouseId) {
      this.lastCheckedWarehouseId = currentWId;
      this.importService.checkLatestImport(currentWId);
    }
  }

  ngOnDestroy() {
    if (this.stateSub) {
      this.stateSub.unsubscribe();
    }
  }

  formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  handleFileDrop(file: File) {
    if (file) {
      this.importService.currentState.fileToUpload = file;
      this.toast.show('info', `فایل ${file.name} جهت پردازش آماده شد.`);
      
      this.importService.currentState.showErrorDetails = false;
      this.importService.currentState.foundFields = [];
      this.importService.currentState.missingFields = [];
      
      // Parse headers
      this.importService.currentState.isParsingHeaders = true;
      this.importService.currentState.uploadProgress = 0;
      this.cdr.detectChanges();
      
      this.itemApi.parseHeaders(file).subscribe({
        next: (event: any) => {
          if (event.type === HttpEventType.UploadProgress) {
            this.importService.currentState.uploadProgress = Math.round(100 * event.loaded / event.total);
            this.cdr.detectChanges();
          } else if (event.type === HttpEventType.Response) {
            this.importService.currentState.isParsingHeaders = false;
            const res = event.body;
            if (res && res.status === 'success') {
              this.importService.currentState.foundFields = res.found_fields || [];
              this.importService.currentState.missingFields = res.missing_fields || [];
            }
            this.cdr.detectChanges();
          }
        },
        error: (err) => {
          this.importService.currentState.isParsingHeaders = false;
          this.cdr.detectChanges();
          console.error('Error parsing headers', err);
          this.toast.show('error', 'خطا در خواندن فایل اکسل. لطفاً از معتبر بودن فایل اطمینان حاصل کنید.');
        }
      });
    }
  }

  resetForm() {
    this.importService.resetForm();
    this.expandedSection = null;
    this.cdr.detectChanges();
  }

  downloadTemplate() {
    const link = document.createElement('a');
    link.href = '/assets/template.xlsx';
    link.download = 'Warehouse_Template.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  downloadLog() {
    if (!this.importService.currentState.importId) {
      this.toast.show('error', 'شما هنوز هیچ فرآیندی را آغاز نکرده‌اید.');
      return;
    }
    
    // Check if the process was cancelled
    const isCancelled = this.importService.currentState.logs.some(l => l.type === 'err' && l.msg.includes('لغو شد'));
    if (isCancelled || this.importService.currentState.isCanceling) {
      this.toast.show('error', 'فرآیند لغو شده و هیچ لاگی وجود ندارد.');
      return;
    }

    const token = localStorage.getItem('wh_access_token');
    const url = `${environment.apiUrl}/inventory/items/download_import_log/?import_id=${this.importService.currentState.importId}&token=${token}`;
    window.open(url, '_blank');
  }

  toggleErrorDetails() {
    this.importService.currentState.showErrorDetails = !this.importService.currentState.showErrorDetails;
  }

  toggleSection(section: string) {
    if (this.expandedSection === section) {
      this.expandedSection = null;
    } else {
      this.expandedSection = section;
    }
  }

  cancelProcess() {
    this.importService.cancelProcess();
  }

  clearLogs() {
    this.importService.clearLogs();
  }

  async simulateImportProcess() {
    if (this.importService.currentState.isSimulating || !this.importService.currentState.fileToUpload) {
      if (!this.importService.currentState.fileToUpload) {
        this.toast.show('error', 'لطفا ابتدا یک فایل انتخاب کنید.');
      }
      return;
    }

    if (!this.importService.currentState.foundFields.includes('fa_unic_code') && !this.importService.currentState.foundFields.includes('id')) {
      this.toast.show('error', 'خطا: هیچ‌کدام از ستون‌های کلیدی fa_unic_code یا id در فایل اکسل شما یافت نشد. پردازش امکان‌پذیر نیست.');
      return;
    }

    if (!this.hasWarehouse) {
      this.toast.show('error', 'لطفاً ابتدا یک انبار را انتخاب کنید.');
      return;
    }

    const warehouseId = this.state.appState.activeWarehouseId;
    if (warehouseId) {
      this.importService.simulateImportProcess(warehouseId);
      this.cdr.detectChanges();
    }
  }

  // ---- Delete Confirmation Logic ----
  
  openDeleteModal(mode: 'all' | 'excel') {
    if (mode === 'excel' && !this.importService.currentState.fileToUpload) {
      this.toast.show('error', 'هیچ فایلی برای حذف انتخاب نشده است.');
      return;
    }
    
    this.deleteMode = mode;
    this.deleteCountdown = 3;
    this.isDeleteModalOpen = true;
    
    if (this.deleteInterval) clearInterval(this.deleteInterval);
    this.deleteInterval = setInterval(() => {
      this.deleteCountdown--;
      if (this.deleteCountdown <= 0) {
        clearInterval(this.deleteInterval);
      }
      this.cdr.detectChanges();
    }, 1000);
  }

  closeDeleteModal() {
    this.isDeleteModalOpen = false;
    if (this.deleteInterval) clearInterval(this.deleteInterval);
  }

  confirmDelete() {
    if (this.deleteCountdown > 0) return;
    
    const wId = this.state.appState.activeWarehouseId;
    if (!wId) return;

    if (this.deleteMode === 'all') {
      this.importService.clearWarehouseData(wId);
      this.closeDeleteModal();
    } else if (this.deleteMode === 'excel') {
      const file = this.importService.currentState.fileToUpload;
      if (file) {
        this.itemApi.deleteFromExcel(file, wId).subscribe({
          next: (res) => {
            this.toast.show('success', res.msg || 'عملیات حذف با موفقیت انجام شد.');
            this.importService.currentState.logs.unshift({ time: new Date(), type: 'info', msg: `>> حذف رکوردهای بر اساس اکسل انجام شد: ${res.msg}` });
            this.importService.checkLatestImport(wId);
          },
          error: (err) => {
            this.toast.show('error', err.error?.error || 'خطا در حذف با اکسل.');
          }
        });
      }
      this.closeDeleteModal();
    }
  }
}

