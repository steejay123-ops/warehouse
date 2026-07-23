import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettingsService } from '../../services/settings';
import { ToastService, ConfirmDialogService } from '../../shared';
import { AuthStore } from '../../core/stores/auth.store';
import { LabelDesigner } from '../label-designer/label-designer';

@Component({
  selector: 'app-wh-settings',
  imports: [CommonModule, FormsModule, LabelDesigner],
  templateUrl: './wh-settings.html',
  styleUrl: './wh-settings.css'
})
export class WhSettings implements OnInit {
  isLoading = true;
  settings: any = {};
  warehouseId: number | null = null;

  constructor(
    private settingsService: SettingsService,
    private toast: ToastService,
    private authStore: AuthStore,
    private confirm: ConfirmDialogService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.warehouseId = Number(this.authStore.activeWarehouseId());
    if (this.warehouseId) {
      this.loadSettings();
    }
  }

  loadSettings() {
    this.isLoading = true;
    this.settingsService.getWarehouseSettings(this.warehouseId!).subscribe({
      next: (res: any) => {
        this.settings = res;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.toast.show('error', 'خطا در دریافت تنظیمات انبار.');
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  saveSettings() {
    this.isLoading = true;
    
    // Convert current values to a simple dictionary for saving overrides
    const payload: any = {};
    for (const key of Object.keys(this.settings)) {
      payload[key] = this.settings[key].value;
    }
    
    this.settingsService.saveWarehouseSettings(this.warehouseId!, payload).subscribe({
      next: () => {
        this.toast.show('success', 'تنظیمات انبار با موفقیت ذخیره شد.');
        this.loadSettings();
      },
      error: () => {
        this.toast.show('error', 'خطا در ذخیره تنظیمات انبار.');
        this.isLoading = false;
      }
    });
  }

  async resetSetting(key: string) {
    const confirmed = await this.confirm.open({
      title: 'حذف تنظیم اختصاصی',
      message: 'آیا از حذف این تنظیم اختصاصی و بازگشت به مقدار پیش‌فرض کلان اطمینان دارید؟',
      confirmText: 'بله، حذف شود',
      type: 'warning'
    });
    
    if (confirmed) {
      this.isLoading = true;
      this.settingsService.resetWarehouseSettings(this.warehouseId!, [key]).subscribe({
        next: () => {
          this.toast.show('success', 'تنظیم به مقدار پیش‌فرض بازگشت.');
          this.loadSettings();
        },
        error: () => {
          this.toast.show('error', 'خطا در بازنشانی تنظیم.');
          this.isLoading = false;
        }
      });
    }
  }
}
