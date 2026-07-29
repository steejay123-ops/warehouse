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
  activeTab: 'operations' | 'label' | 'backup' = 'operations';

  // ── Backup State ────────────────────────────────────────────────────────────
  backupPassword = '';
  backupShowPassword = false;
  isBackupLoading = false;

  // ── Restore State ───────────────────────────────────────────────────────────
  restorePassword = '';
  restoreShowPassword = false;
  restoreFile: File | null = null;
  restoreFileName = '';
  isRestoreLoading = false;
  showRestoreConfirm = false;

  constructor(
    private settingsService: SettingsService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadSettings();
  }

  setTab(tab: 'operations' | 'label' | 'backup') {
    this.activeTab = tab;
    this.cdr.detectChanges();
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

  // ── Backup Methods ──────────────────────────────────────────────────────────
  downloadBackup() {
    if (!this.backupPassword) {
      this.toast.show('error', 'لطفاً رمز عبور بک‌آپ را وارد کنید.');
      return;
    }
    this.isBackupLoading = true;
    this.cdr.detectChanges();

    this.settingsService.downloadBackup(this.backupPassword).subscribe({
      next: (blob: Blob) => {
        const now = new Date();
        const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
        const filename = `warehouse_backup_${timestamp}.wbak`;

        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        anchor.click();
        URL.revokeObjectURL(url);

        this.toast.show('success', 'فایل پشتیبان با موفقیت دانلود شد.');
        this.backupPassword = '';
        this.isBackupLoading = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.toast.show('error', 'خطا در ایجاد فایل پشتیبان.');
        this.isBackupLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ── Restore Methods ─────────────────────────────────────────────────────────
  onRestoreFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      if (!file.name.endsWith('.wbak')) {
        this.toast.show('error', 'فقط فایل‌های .wbak مجاز هستند.');
        input.value = '';
        return;
      }
      this.restoreFile = file;
      this.restoreFileName = file.name;
      this.cdr.detectChanges();
    }
  }

  openRestoreConfirm() {
    if (!this.restoreFile) {
      this.toast.show('error', 'لطفاً فایل پشتیبان را انتخاب کنید.');
      return;
    }
    if (!this.restorePassword) {
      this.toast.show('error', 'لطفاً رمز عبور فایل پشتیبان را وارد کنید.');
      return;
    }
    this.showRestoreConfirm = true;
    this.cdr.detectChanges();
  }

  cancelRestore() {
    this.showRestoreConfirm = false;
    this.cdr.detectChanges();
  }

  confirmRestore() {
    if (!this.restoreFile || !this.restorePassword) return;
    this.showRestoreConfirm = false;
    this.isRestoreLoading = true;
    this.cdr.detectChanges();

    this.settingsService.restoreBackup(this.restoreFile, this.restorePassword).subscribe({
      next: () => {
        this.toast.show('success', 'بازیابی اطلاعات با موفقیت انجام شد. صفحه مجدداً بارگذاری می‌شود...');
        this.isRestoreLoading = false;
        this.restoreFile = null;
        this.restoreFileName = '';
        this.restorePassword = '';
        this.cdr.detectChanges();
        setTimeout(() => window.location.reload(), 2000);
      },
      error: (err: any) => {
        const msg = err?.error?.error || 'خطا در بازیابی اطلاعات. سیستم به حالت قبل بازگردانده شد.';
        this.toast.show('error', msg);
        this.isRestoreLoading = false;
        this.cdr.detectChanges();
      }
    });
  }
}
