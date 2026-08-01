import Dexie, { Table } from 'dexie';

/**
 * مدل صف همگام‌سازی — هر تغییر آفلاین یک رکورد در این صف ذخیره می‌شود
 */
export interface SyncQueueEntry {
  id?: number;
  /** متد HTTP: POST, PATCH, PUT, DELETE */
  method: string;
  /** مسیر API (endpoint) */
  url: string;
  /** بدنه درخواست */
  body: any;
  /** زمان ایجاد (Unix timestamp) */
  createdAt: number;
  /** تعداد دفعات تلاش ارسال */
  retryCount: number;
  /** وضعیت: pending, sending, failed */
  status: 'pending' | 'sending' | 'failed';
  /** پیام خطای آخرین تلاش */
  lastError?: string;
}

/**
 * مدل کش API — پاسخ‌های GET از سرور برای دسترسی آفلاین ذخیره می‌شوند
 */
export interface ApiCacheEntry {
  /** کلید یکتا: URL + params */
  url: string;
  /** بدنه پاسخ */
  response: any;
  /** زمان ذخیره‌سازی */
  cachedAt: number;
  /** زمان انقضا */
  expiresAt: number;
}

/**
 * مدل خطاهای همگام‌سازی — درخواست‌هایی که سرور با خطای 4xx رد کرده
 * این رکوردها برای بررسی کاربر در «صندوق خطای همگام‌سازی» نگه‌داری می‌شوند
 */
export interface SyncErrorEntry {
  id?: number;
  /** متد HTTP اصلی */
  method: string;
  /** مسیر API */
  url: string;
  /** بدنه درخواست اصلی */
  body: any;
  /** کد وضعیت HTTP (4xx) */
  statusCode: number;
  /** پیام خطا از سرور */
  serverMessage: string;
  /** زمان رد شدن درخواست */
  failedAt: number;
  /** آیا کاربر این خطا را خوانده؟ (0 = خیر، 1 = بله — boolean در IndexedDB قابل ایندکس نیست) */
  dismissed: 0 | 1;
}

/**
 * OfflineDatabase — دیتابیس IndexedDB برنامه با استفاده از Dexie.js
 * شامل سه جدول:
 * 1. syncQueue: صف درخواست‌های آفلاین (POST/PATCH/PUT/DELETE)
 * 2. apiCache: کش پاسخ‌های GET برای خواندن آفلاین
 * 3. syncErrors: صندوق خطاهایی که سرور رد کرده (4xx)
 */
export class OfflineDatabase extends Dexie {
  syncQueue!: Table<SyncQueueEntry, number>;
  apiCache!: Table<ApiCacheEntry, string>;
  syncErrors!: Table<SyncErrorEntry, number>;

  constructor() {
    super('WarehouseOfflineDB');

    // نسخه ۱ — جداول اولیه
    this.version(1).stores({
      syncQueue: '++id, status, createdAt',
      apiCache: 'url, expiresAt',
    });

    // نسخه ۲ — اضافه کردن جدول syncErrors
    this.version(2).stores({
      syncQueue: '++id, status, createdAt',
      apiCache: 'url, expiresAt',
      syncErrors: '++id, failedAt, dismissed',
    });
  }
}

/** نمونه سینگلتون از دیتابیس — در کل اپلیکیشن استفاده می‌شود */
export const offlineDb = new OfflineDatabase();
