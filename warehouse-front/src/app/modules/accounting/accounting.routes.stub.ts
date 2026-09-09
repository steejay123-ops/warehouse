import { Routes } from '@angular/router';

/**
 * مسیرهای خالی ماژول حسابداری برای پروفایل بیلد انبارداری‌تنها (warehouse-only)
 * این فایل جایگزین accounting.routes.ts می‌شود تا هیچ کامپوننت و کدی
 * از دامنه حسابداری وارد باندل خروجی انبارداری‌تنها نگردد.
 */
export const ACCOUNTING_ROUTES: Routes = [
  { path: '**', redirectTo: '/app/launcher' }
];
