import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '../../services/state.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-field',
  imports: [CommonModule, FormsModule],
  templateUrl: './field.html',
  styleUrl: './field.css'
})
export class Field implements OnInit {
  manualBarcode = '';
  isScanning = true;
  
  record: any = null;
  countedQty: number | null = null;
  physCondition = 'ok';

  constructor(public state: StateService, private toast: ToastService) {}

  ngOnInit() {}

  get currentUser() {
    return this.state.appState.currentUser;
  }

  get canViewSysQty() {
    // Check if user has permission to view sys qty, or use offline mode/blind count setting from state
    if (this.state.appState.labelSettings && this.state.appState.labelSettings.printQty === false) {
      return false; // Assuming false printQty means blind count is active
    }
    return true; // Default behavior
  }

  simulateQRScan(tagId?: string) {
    const idToScan = tagId || this.manualBarcode || 'TAG-123';
    if (!idToScan) {
      return this.toast.show('error', 'لطفا کد را وارد کنید');
    }
    
    this.toast.show('info', 'در حال واکشی اطلاعات کالا از سرور...');
    
    setTimeout(() => {
      this.isScanning = false;
      this.record = { partNo: 'VAL-099-B', desc: 'شیر فلکه کشویی 4 اینچ فولادی', location: 'Rack A-12', sysQty: 100, tagId: idToScan };
      this.countedQty = null;
      this.physCondition = 'ok';
    }, 800);
  }

  resetScanner() {
    this.isScanning = true;
    this.record = null;
    this.manualBarcode = '';
  }

  submitCount() {
    if (!this.countedQty || this.countedQty <= 0) {
      return this.toast.show('error', 'لطفاً تعداد شمارش شده را به درستی وارد کنید.');
    }
    this.toast.show('success', 'اطلاعات شمارش با موفقیت در سیستم ثبت شد.');
    this.resetScanner();
  }
}
