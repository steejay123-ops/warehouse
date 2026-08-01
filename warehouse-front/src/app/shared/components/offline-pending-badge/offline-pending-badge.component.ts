import { Component } from '@angular/core';

/**
 * نشان «در انتظار ارسال» — روی رکوردهایی که آفلاین ساخته/ویرایش شده‌اند
 * و هنوز در صف همگام‌سازی هستند (`_offlinePending`).
 *
 * رنگ sky عمداً انتخاب شده: زرد برای ویرایش ذخیره‌نشده، کهربایی برای بنر
 * آفلاین، و ایندیگو برای انتخاب ردیف از قبل رزرو شده‌اند.
 */
@Component({
  selector: 'app-offline-pending-badge',
  standalone: true,
  template: `
    <span
      class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-sky-200 bg-sky-50 text-sky-700 text-[9px] font-bold whitespace-nowrap align-middle"
      title="این مورد هنوز به سرور ارسال نشده است. به‌محض برقراری اتصال، خودکار همگام‌سازی می‌شود."
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <line x1="1" y1="1" x2="23" y2="23"></line>
        <path d="M18.5 19H9a7 7 0 0 1-1.87-13.75"></path>
        <path d="M10.71 5.05A6 6 0 0 1 20 10h.5a4.5 4.5 0 0 1 2.62 8.16"></path>
      </svg>
      در انتظار ارسال
    </span>
  `,
})
export class OfflinePendingBadgeComponent {}
