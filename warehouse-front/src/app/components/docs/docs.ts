import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '../../services/state.service';
import { ToastService } from '../../services/toast.service';
import { FileUploadComponent } from '../../shared';

@Component({
  selector: 'app-docs',
  imports: [CommonModule, FormsModule, FileUploadComponent],
  templateUrl: './docs.html',
  styleUrl: './docs.css'
})
export class Docs implements OnInit {
  importTag = '';
  existingTags: string[] = [];
  conflictAction = 'ignore';

  logs: any[] = [];
  errCount = 0;
  warnCount = 0;
  okCount = 0;
  isSimulating = false;

  constructor(public state: StateService, private toast: ToastService) {}

  ngOnInit() {
    const tagsSet = new Set<string>();
    this.state.appState.records.forEach((r: any) => {
      if (r.tag) r.tag.split('،').forEach((t: string) => tagsSet.add(t.trim()));
    });
    this.existingTags = Array.from(tagsSet);
  }

  handleFileDrop(file: File) {
    if (file) {
      this.toast.show('info', `فایل ${file.name} جهت پردازش آماده شد.`);
    }
  }

  downloadLog() {
    this.toast.show('success', 'لاگ فرآیند تزریق با فرمت Excel دانلود شد');
  }

  simulateImportProcess() {
    if (this.isSimulating) return;

    this.logs = [];
    this.errCount = 0;
    this.warnCount = 0;
    this.okCount = 0;
    this.isSimulating = true;

    const dummyLogs = [
      { type: 'info', msg: '>> شروع فرآیند پردازش دیتابیس...' },
      { type: 'info', msg: '>> فایل: Shiraz_Records_Batch_7.xlsx' },
      { type: 'tag', msg: this.importTag ? `>> اعمال تگ گروهی [${this.importTag}] تایید شد.` : '>> هیچ تگ گروهی اختصاص داده نشد.' },
      { type: 'ok', msg: '[OK] رکورد REC-1088: استخراج و مپ فیلدها موفق.' },
      { type: 'ok', msg: '[OK] رکورد REC-1089: استخراج و مپ فیلدها موفق.' },
      { type: 'warn', msg: '[WARN] رکورد REC-2005: از قبل داده داشت، طبق قانون نادیده گرفته شد.' },
      { type: 'err', msg: '[ERR] رکورد خط 12: فرمت کد MESC نامعتبر است. رد شد.' },
      { type: 'ok', msg: '[OK] رکورد REC-1090: استخراج و مپ فیلدها موفق.' },
      { type: 'info', msg: '>> اتمام پردازش. در حال تزریق نهایی به پایگاه داده...' },
      { type: 'success', msg: '>> فرآیند با موفقیت پایان یافت.' }
    ];

    let i = 0;
    const interval = setInterval(() => {
      if (i >= dummyLogs.length) {
        clearInterval(interval);
        this.isSimulating = false;
        
        this.errCount = 1;
        this.warnCount = 1;
        this.okCount = 3;

        alert(`رکوردهای فایل اکسل ${this.importTag ? `با تگ "${this.importTag}"` : ''} با موفقیت به دیتابیس افزوده شدند. جزئیات در پنل لاگ قابل مشاهده است.`);
        return;
      }

      this.logs.push(dummyLogs[i]);
      i++;
    }, 350);
  }
}
