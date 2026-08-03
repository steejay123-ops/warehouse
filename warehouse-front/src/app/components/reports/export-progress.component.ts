import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, interval } from 'rxjs';
import { ReportApiService } from '../../core/api/report-api.service';
import { ReportExportJob } from '../../core/models/report.model';

/**
 * نوار پیشرفت خروجی Excel بزرگ — poll هر ۲ ثانیه از /exports/<id>/
 * در پایان دکمه دانلود نشان می‌دهد (streaming از سرور).
 */
@Component({
  selector: 'app-export-progress',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bg-white rounded-xl border border-slate-200 p-3 space-y-2 shadow-sm">
      <div class="flex items-center justify-between gap-2">
        <div class="text-xs font-bold text-slate-700">
          خروجی Excel ({{ job?.total_rows ?? totalRows }} ردیف)
        </div>
        <button type="button" (click)="close.emit()" class="text-slate-400 hover:text-slate-600 text-xs">✕</button>
      </div>

      @if (job?.status === 'failed') {
        <div class="text-xs text-rose-600 font-bold">{{ job?.error_message || 'تولید فایل ناموفق بود.' }}</div>
      } @else if (job?.status === 'done') {
        <div class="flex items-center gap-2">
          <span class="text-xs text-emerald-600 font-bold">فایل آماده است ✓</span>
          <button type="button" (click)="download()"
                  class="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg">
            دانلود فایل
          </button>
        </div>
      } @else {
        <div class="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
          <div class="bg-indigo-500 h-2 rounded-full transition-all duration-500"
               [style.width.%]="job?.progress ?? 0"></div>
        </div>
        <div class="text-[10px] text-slate-500">
          در حال تولید فایل در سرور… {{ job?.progress ?? 0 }}٪
        </div>
      }
    </div>
  `,
})
export class ExportProgressComponent implements OnInit, OnDestroy {
  private api = inject(ReportApiService);

  @Input({ required: true }) jobId!: number;
  @Input() totalRows = 0;
  @Input() fileName = 'report.xlsx';
  @Output() close = new EventEmitter<void>();

  job: ReportExportJob | null = null;
  private sub: Subscription | null = null;

  ngOnInit(): void {
    this.poll();
    this.sub = interval(2000).subscribe(() => {
      if (this.job?.status === 'done' || this.job?.status === 'failed') return;
      this.poll();
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  private poll(): void {
    this.api.getExportJob(this.jobId).subscribe({
      next: (j) => (this.job = j),
      error: () => {}, // خطای گذرا — poll بعدی دوباره تلاش می‌کند
    });
  }

  download(): void {
    this.api.downloadExportFile(this.jobId).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = this.fileName;
        a.click();
        URL.revokeObjectURL(url);
      },
    });
  }
}
