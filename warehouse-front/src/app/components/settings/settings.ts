import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettingsService } from '../../services/settings';
import { ToastService } from '../../services/toast.service';
import { LabelDesigner } from '../label-designer/label-designer';

@Component({
  selector: 'app-settings',
  imports: [CommonModule, FormsModule, LabelDesigner],
  templateUrl: './settings.html',
  styleUrl: './settings.css'
})
export class Settings implements OnInit {
  isLoading = true;
  settings: any = {};

  constructor(
    private settingsService: SettingsService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadSettings();
  }

  loadSettings() {
    this.isLoading = true;
    this.settingsService.getGlobalSettings().subscribe({
      next: (res: any) => {
        this.settings = res;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.toast.show('error', 'خطا در دریافت تنظیمات سیستم.');
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  saveGlobalSettings() {
    this.isLoading = true;
    this.settingsService.saveGlobalSettings(this.settings).subscribe({
      next: () => {
        this.toast.show('success', 'تنظیمات کلان سیستم با موفقیت ذخیره شد.');
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.toast.show('error', 'خطا در ذخیره تنظیمات سیستم.');
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }
}
