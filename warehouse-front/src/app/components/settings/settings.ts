import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '../../services/state.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-settings',
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.css'
})
export class Settings implements OnInit {
  blindCount = true;
  offlineMode = true;
  gpsTag = false;
  imgCompress = true;
  twoStepAuth = true;

  conflictAction = 'ignore';
  mtFormat = 'excel';
  logRetention = '90';

  lblSettings = {
    printKey: true,
    printMesc: true,
    printLoc: true,
    printDesc: true,
    printCond: true,
    printProject: true,
    printTag: true,
    printQr: true,
    printQty: false
  };

  constructor(public state: StateService, private toast: ToastService) {}

  ngOnInit() {
    if (this.state.appState.labelSettings) {
      this.lblSettings = { ...this.state.appState.labelSettings };
    }
  }

  handleToggleChange(settingName: string) {
    this.toast.show('info', 'تغییرات به صورت موقت ثبت شد. برای اعمال، ذخیره نهایی را بزنید.');
  }

  handleBlindCountToggle() {
    if (this.blindCount) {
      this.lblSettings.printQty = false;
      this.toast.show('warning', 'حالت شمارش کور فعال شد. چاپ تعداد دفتری روی لیبل مسدود گردید.');
    } else {
      this.toast.show('info', 'شمارش کور غیرفعال شد. اکنون می‌توانید چاپ تعداد روی لیبل را فعال کنید.');
    }
  }

  saveGlobalSettings() {
    if (this.state.appState.labelSettings) {
      this.state.appState.labelSettings = { ...this.lblSettings };
      if (this.blindCount) {
        this.state.appState.labelSettings.printQty = false;
      }
    }
    
    alert('پیکربندی کلان سیستم، قوانین تداخل داده‌ها و پیش‌فرض‌های لیبل در پایگاه داده مرکزی ذخیره و در سراسر شبکه یکپارچه اعمال گردید.');
  }
}
