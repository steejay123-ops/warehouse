import { Routes } from '@angular/router';

/**
 * مسیرهای خالی ماژول انبارداری برای پروفایل بیلد حسابداری‌تنها (accounting-only)
 * فاز ۶ (تسک ۶۲) — این فایل جایگزین warehouse.routes.ts می‌شود تا هیچ کامپوننت و کدی
 * از دامنه انبار وارد باندل خروجی حسابداری‌تنها نگردد.
 */
export const IS_WAREHOUSE_INSTALLED = false;

export const WAREHOUSE_ROUTES: Routes = [
  { path: '**', redirectTo: '/app/launcher' }
];
