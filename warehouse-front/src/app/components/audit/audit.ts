import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-audit',
  imports: [CommonModule, FormsModule],
  templateUrl: './audit.html',
  styleUrl: './audit.css'
})
export class Audit implements OnInit {
  mockAuditLogs = [
    { id: 101, date: '1402/08/15 10:32', user: 'سامان تقوی (Admin)', module: 'تغذیه MT', action: 'صدور فایل MT26', target: 'انبار فاز ۱۵', severity: 'info', details: { msg: 'خروجی اکسل برای 450 رکورد با تگ [محموله الف] تولید شد.' } },
    { id: 102, date: '1402/08/15 11:05', user: 'علی کریمی (اپراتور تغذیه)', module: 'لیبلینگ', action: 'چاپ مجدد لیبل', target: 'رکورد REC-1088', severity: 'warning', details: { msg: 'چاپ لیبل به دلیل خرابی فیزیکی تکرار شد.' } },
    { id: 103, date: '1402/08/15 12:40', user: 'رضا محمدی (شمارشگر)', module: 'شمارش', action: 'تغییر لوکیشن', target: 'رکورد REC-2044', severity: 'warning', before: { loc: 'WH-01-A', desc: 'ولو 8 اینچ' }, after: { loc: 'WH-02-B', desc: 'ولو 8 اینچ' } },
    { id: 104, date: '1402/08/15 14:15', user: 'سامان تقوی (Admin)', module: 'کاربران', action: 'حذف کاربر', target: 'اکانت: حامد رحیمی', severity: 'critical', before: { status: 'Active', role: 'شمارشگر' }, after: { status: 'Deleted', role: 'N/A' } },
    { id: 105, date: '1402/08/16 08:22', user: 'محمد علوی (سرپرست مدارک)', module: 'Base Data', action: 'ویرایش گروهی', target: '320 رکورد', severity: 'critical', before: { tag: 'بدون تگ', status: 'خام' }, after: { tag: 'محموله مهر', status: 'آماده شمارش' } }
  ];

  isDiffModalOpen = false;
  selectedLog: any = null;
  beforeStr = '';
  afterStr = '';

  constructor(private toast: ToastService) {}

  ngOnInit() {}

  downloadCsv() {
    this.toast.show('success', 'لاگ‌های فیلتر شده با فرمت CSV دانلود شدند.');
  }

  openAuditDiffModal(log: any) {
    this.selectedLog = log;
    if (log.before && log.after) {
      this.beforeStr = JSON.stringify(log.before, null, 2);
      this.afterStr = JSON.stringify(log.after, null, 2);
    } else {
      this.beforeStr = '';
      this.afterStr = '';
    }
    this.isDiffModalOpen = true;
  }

  closeModal() {
    this.isDiffModalOpen = false;
    this.selectedLog = null;
  }

  executeRollback(logId: number) {
    if (confirm(`آیا از بازگردانی (Rollback) تغییرات مربوط به لاگ #${logId} اطمینان دارید؟ این عملیات دیتابیس را به حالت قبل از این رویداد برمی‌گرداند.`)) {
      this.toast.show('info', 'در حال پردازش و اعمال بازگردانی در دیتابیس...');
      setTimeout(() => {
        this.toast.show('success', `تغییرات با موفقیت بازگردانی (Undo) شد.`);
      }, 1000);
    }
  }

  rollbackFromModal() {
    if (this.selectedLog) {
      const logId = this.selectedLog.id;
      this.closeModal();
      this.executeRollback(logId);
    }
  }
}
