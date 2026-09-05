import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SystemHealthService } from '../../../core/services/system-health.service';
import { SettingsService } from '../../../services/settings';
import { ToastService } from '../../../shared/components/toast/toast.component';
import { downloadLocalDatabaseSnapshotFile } from '../../../core/services/offline-db';

@Component({
  selector: 'app-operations-cockpit',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './operations-cockpit.html',
  styleUrl: './operations-cockpit.css'
})
export class OperationsCockpitComponent implements OnInit {
  private router = inject(Router);
  public healthService = inject(SystemHealthService);
  private settingsService = inject(SettingsService);
  private toast = inject(ToastService);

  public isCreatingSnapshot = signal<boolean>(false);
  public snapshotCount = signal<number>(0);
  public lastSnapshotTime = signal<string>('نامشخص');
  public lastSnapshotSize = signal<string>('۰ مگابایت');

  ngOnInit(): void {
    this.loadSnapshotSummary();
    this.healthService.runFullDiagnostic(false).catch(() => {});
  }

  public loadSnapshotSummary(): void {
    this.settingsService.getSnapshotSummary().subscribe({
      next: (summary: any) => {
        this.snapshotCount.set(summary.total_count || 0);
        this.lastSnapshotTime.set(summary.latest_created_at_jalali || 'ثبت‌نشده');
        this.lastSnapshotSize.set(summary.latest_file_size || '۰ مگابایت');
      },
      error: () => {
        // Fallback gracefully
      }
    });
  }

  public createInstantSnapshot(): void {
    if (this.isCreatingSnapshot()) return;
    this.isCreatingSnapshot.set(true);
    this.settingsService.createSnapshot('اسنپ‌شات فوری از اتاق فرماندهی مرکز عملیات').subscribe({
      next: (res: any) => {
        this.isCreatingSnapshot.set(false);
        this.toast.success(res.message || 'اسنپ‌شات جدید در سرور با موفقیت ایجاد شد.');
        this.loadSnapshotSummary();
      },
      error: (err: any) => {
        this.isCreatingSnapshot.set(false);
        this.toast.error(err?.error?.error || 'خطا در ساخت اسنپ‌شات لحظه‌ای');
      }
    });
  }

  public async exportIndexedDB(): Promise<void> {
    try {
      const res = await downloadLocalDatabaseSnapshotFile();
      this.toast.success(`فایل پشتیبان محلی مرورگر (${res.fileName}) با موفقیت دانلود شد.`);
    } catch {
      this.toast.error('خطا در استخراج نسخه پشتیبان کلاینت');
    }
  }

  public navigateTo(path: string): void {
    this.router.navigate([path]);
  }
}
