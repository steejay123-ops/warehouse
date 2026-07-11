import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '../../services/state.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-id-cards',
  imports: [CommonModule, FormsModule],
  templateUrl: './id-cards.html',
  styleUrl: './id-cards.css'
})
export class IdCards implements OnInit {
  idCardSettings = {
    dataSource: 'db', 
    cardType: 'pvc-vertical', 
    expiryDays: 0,
    fields: { role: true, nationalCode: true, projects: true, qr: true, expiry: true }
  };

  showMappingSection = false;

  constructor(public state: StateService, private toast: ToastService) {}

  ngOnInit() {}

  get users() {
    return this.state.appState.users || [];
  }

  get activeUser() {
    return this.state.appState.users[0] || { first_name: 'سامان', last_name: 'تقوی سوق', national_code: '1280954310', assigned_warehouses: [1, 2], avatar: 'س', roleId: '' };
  }

  get activeRole() {
    return this.state.appState.roles.find((r: any) => r.id === this.activeUser.roleId) || { title: 'مدیریت کل', color: '#4f46e5' };
  }

  get expiryText() {
    return this.calculateExpiryString(this.idCardSettings.expiryDays);
  }

  calculateExpiryString(days: number | string) {
    const d = parseInt(days as string) || 0;
    if (d === 0) return 'تا پایان پروژه';
    const future = new Date();
    future.setDate(future.getDate() + d);
    return new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(future);
  }

  toggleIdDataSource(type: string) {
    this.idCardSettings.dataSource = type;
  }

  simulateIdExcelUpload() {
    this.toast.show('info', 'در حال پردازش هدرهای فایل اکسل پرسنل...');
    setTimeout(() => {
      this.showMappingSection = true;
      this.toast.show('success', 'فایل با موفقیت پارس شد. ستون‌ها را تخصیص دهید.');
    }, 800);
  }

  updateCardFormat(format: string) {
    this.idCardSettings.cardType = format;
  }

  toggleIdPreviewField(field: keyof typeof this.idCardSettings.fields) {
    // Angular handles the live update natively
  }

  executeCardPrint() {
    this.toast.show('info', 'در حال پردازش گرید خودکار جهت تولید شیت‌های A4...');
    setTimeout(() => {
      alert('کارت‌های شناسایی بر اساس ابعاد استاندارد، به صورت خودکار در قالب شیت‌های A4 سازمان‌دهی و به درایور پرینتر ارسال شدند.');
    }, 1200);
  }
}
