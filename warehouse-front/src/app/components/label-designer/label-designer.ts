import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '../../services/state.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-label-designer',
  imports: [CommonModule, FormsModule],
  templateUrl: './label-designer.html',
  styleUrl: './label-designer.css'
})
export class LabelDesigner implements OnInit {
  labelDesignerState = {
    dataSource: 'db', // 'db' or 'external'
    paperType: 'A4', // 'A4', 'A3', 'A2', 'A1', 'roll'
    fields: {
      mesc: true, desc: true, loc: true, qty: false, date: false, project: true
    }
  };

  showMappingSection = false;
  currentDate = '';

  constructor(public state: StateService, private toast: ToastService) {}

  ngOnInit() {
    this.updateCurrentDate();
  }

  get activeWh() {
    return this.state.appState.projects.find((p: any) => p.id === this.state.appState.activeWarehouseId) || this.state.appState.projects[0];
  }

  updateCurrentDate() {
    this.currentDate = new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date());
  }

  toggleLabelSource(type: string) {
    this.labelDesignerState.dataSource = type;
    if (type === 'db') {
        this.showMappingSection = false;
    }
  }

  simulateExcelUploadForLabels() {
    this.toast.show('info', 'در حال پردازش هدرهای فایل اکسل...');
    setTimeout(() => {
      this.showMappingSection = true;
      this.toast.show('success', 'فایل با موفقیت پارس شد. لطفاً ستون‌ها را مپ کنید.');
    }, 800);
  }

  togglePaperSettings(val: string) {
    this.labelDesignerState.paperType = val;
    if (val === 'roll') {
      this.toast.show('info', 'فرمت رول حرارتی فعال شد. ابعاد را به میلی‌متر وارد کنید.');
    }
  }

  executeLabelPrint() {
    const isExternal = this.labelDesignerState.dataSource === 'external';
    let msg = 'اطلاعات در حال پردازش و تولید فایل PDF مخصوص پرینتر می‌باشد...';
    
    if (isExternal && !this.showMappingSection) {
      return this.toast.show('warning', 'لطفاً ابتدا فایل اکسل را آپلود و ستون‌ها را مپ کنید.');
    }

    this.toast.show('success', msg);
    setTimeout(() => {
      alert(`لیبل‌ها بر اساس ${isExternal ? 'فایل اکسل آپلودی' : 'دیتابیس انبار'} با ساختار شبکه (Grid) مشخص شده، تولید و به صف پرینت سیستم عامل ارسال شدند.`);
    }, 1200);
  }
}
