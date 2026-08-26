import { Component, ChangeDetectorRef, HostListener, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettingsService } from '../../../../services/settings';
import { ToastService } from '../../../../services/toast.service';
import { finalize } from 'rxjs/operators';
import { offlineDb } from '../../../../core/services/offline-db';
import { AuthService } from '../../../../core/auth/auth.service';

@Component({
  selector: 'app-settings-backup-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings-backup-tab.html'
})
export class SettingsBackupTabComponent {
  @ViewChild('confirmTextInput') confirmTextInput?: ElementRef<HTMLInputElement>;
  @ViewChild('confirmDialogContainer') confirmDialogContainer?: ElementRef<HTMLElement>;

  backupPassword = '';
  backupShowPassword = false;
  isBackupLoading = false;

  restorePassword = '';
  restoreShowPassword = false;
  restoreFile: File | null = null;
  restoreFileName = '';
  restoreConfirmInput = '';
  isRestoreLoading = false;
  showRestoreConfirm = false;

  private previousActiveElement: HTMLElement | null = null;

  canManageBackup() {
    return this.auth.hasPermission('CanManageBackup');
  }

  canRestoreDatabase() {
    return this.auth.hasPermission('CanRestoreDatabase');
  }

  constructor(
    private settingsService: SettingsService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef,
    private auth: AuthService
  ) {}

  downloadBackup() {
    if (!this.backupPassword) {
      this.toast.show('error', 'لطفاً رمز عبور بک‌آپ را وارد کنید.');
      return;
    }
    if (this.backupPassword.trim().length < 12) {
      this.toast.show('error', 'رمز عبور پشتیبان باید حداقل ۱۲ کاراکتر باشد.');
      return;
    }
    this.isBackupLoading = true;
    this.cdr.detectChanges();

    this.settingsService.downloadBackup(this.backupPassword)
      .pipe(finalize(() => {
        this.isBackupLoading = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (blob: Blob) => {
          const now = new Date();
          const pDate = new Intl.DateTimeFormat('fa-IR', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
          }).format(now).replace(/[/\s:]/g, '-');
          const fileName = `warehouse_backup_${pDate}.wbak`;

          // Firefox fix (Issue 5-5)
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
          }, 100);

          this.toast.show('success', 'نسخه پشتیبان با موفقیت ساخته و دانلود شد.');
          this.backupPassword = '';
        },
        error: (err: any) => {
          this.toast.show('error', err?.error?.error || 'خطا در دریافت نسخه پشتیبان.');
          this.backupPassword = '';
        }
      });
  }

  triggerFileInput() {
    document.getElementById('backupFileInput')?.click();
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.restoreFile = file;
      this.restoreFileName = file.name;
    }
    event.target.value = null;
  }

  async openRestoreConfirm() {
    if (!this.restoreFile) {
      this.toast.show('error', 'لطفاً فایل پشتیبان را انتخاب کنید.');
      return;
    }
    if (!this.restorePassword) {
      this.toast.show('error', 'لطفاً رمز عبور فایل را وارد کنید.');
      return;
    }

    const q = await offlineDb.syncQueue.toArray();
    if (q.length > 0) {
      this.toast.show('error', `صف آفلاین شامل ${q.length} رکورد همگام‌نشده است. جهت جلوگیری از نابودی داده‌ها، ابتدا باید آنها را به سرور ارسال کنید.`);
      return;
    }

    // Save previous active element for restoring focus (Item 5-7)
    this.previousActiveElement = (document.activeElement as HTMLElement) || null;
    this.showRestoreConfirm = true;
    this.cdr.detectChanges();

    // Autofocus confirmation input (Item 5-7)
    setTimeout(() => {
      this.confirmTextInput?.nativeElement?.focus();
    }, 50);
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeyDown(event: KeyboardEvent) {
    if (!this.showRestoreConfirm) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelRestore();
      return;
    }

    if (event.key === 'Tab') {
      this.handleFocusTrap(event);
    }
  }

  private handleFocusTrap(event: KeyboardEvent) {
    if (!this.confirmDialogContainer?.nativeElement) return;
    const focusable = this.confirmDialogContainer.nativeElement.querySelectorAll<HTMLElement>(
      'input:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable || focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey) {
      if (document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  cancelRestore() {
    this.showRestoreConfirm = false;
    this.restoreConfirmInput = '';
    this.cdr.detectChanges();

    // Restore focus to previous active element (Item 5-7)
    if (this.previousActiveElement) {
      setTimeout(() => {
        this.previousActiveElement?.focus();
        this.previousActiveElement = null;
      }, 50);
    }
  }

  restoreBackup() {
    if (this.restoreConfirmInput.trim() !== 'RESTORE_DATABASE_CONFIRM') {
      this.toast.show('error', 'متن تایید به درستی وارد نشده است.');
      return;
    }

    this.isRestoreLoading = true;
    this.cdr.detectChanges();

    this.settingsService.restoreBackup(this.restoreFile!, this.restorePassword, this.restoreConfirmInput.trim())
      .pipe(finalize(() => {
        this.isRestoreLoading = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: async (res: any) => {
          this.toast.show('success', 'بازیابی پایگاه‌داده با موفقیت انجام شد. سیستم در حال انتقال به صفحه ورود است...');
          this.showRestoreConfirm = false;
          this.restoreFile = null;
          this.restoreFileName = '';
          this.restorePassword = '';
          this.restoreConfirmInput = '';
          
          // Clear IndexedDB cache and logout cleanly (Item 3-4)
          await offlineDb.clearServerDerivedCaches();
          setTimeout(() => {
            this.auth.logout();
          }, 1500);
        },
        error: (err: any) => {
          const msg = err?.error?.error || 'خطا در بازیابی پایگاه‌داده.';
          this.toast.show('error', msg);
          if (err?.error?.rollback_state === 'failed') {
            this.toast.show('error', 'فایل نجات در سرور نگهداری شد. لطفا فورا با پشتیبانی تماس بگیرید.', 10000);
          }
          this.showRestoreConfirm = false;
          this.restorePassword = '';
          this.restoreConfirmInput = '';

          // Restore focus on error as well
          if (this.previousActiveElement) {
            setTimeout(() => {
              this.previousActiveElement?.focus();
              this.previousActiveElement = null;
            }, 50);
          }
        }
      });
  }
}
