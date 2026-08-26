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
  // ─── فیلدهای Local-First (v3) — روی دستگاه مشترک صف هر کاربر جداست ───
  /** شناسه کاربر صاحب این تغییر */
  userId?: number;
  /** نوع موجودیت: count_task, item, ... (برای reconciliation) */
  entityType?: string;
  /** sync_id پایدار رکورد هدف (کلید idempotency و reconciliation) */
  entitySyncId?: string;
  /** updated_at نسخه‌ای که تغییر رویش اعمال شده (تشخیص تداخل 409) */
  baseUpdatedAt?: string;
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
  // ─── فیلدهای Local-First (v3) ───
  /** شناسه کاربر صاحب درخواست ردشده */
  userId?: number;
  /** نوع موجودیت (برای reconciliation) */
  entityType?: string;
  /** sync_id رکورد هدف */
  entitySyncId?: string;
  /** بدنه کامل پاسخ سرور (مثلاً server_record در 409) */
  serverResponse?: any;
}

/**
 * مدل صف آپلود عکس — فایلی که کاربر گرفته تا لحظه رسیدن به سرور اینجا می‌ماند
 *
 * چرا جدا از syncQueue: آن صف بدنه را با `JSON.stringify` می‌فرستد و یک Blob در
 * آن مسیر به `{}` تبدیل می‌شود — یعنی عکسی که کاربر در انبار بی‌آنتن گرفته
 * بی‌صدا نابود می‌شد. IndexedDB خودش Blob را بدون تبدیل نگه می‌دارد، پس فایل
 * تا لحظه ارسال دست‌نخورده می‌ماند (حتی اگر مرورگر بسته و باز شود).
 */
export interface PhotoQueueEntry {
  id?: number;
  /** شناسه کالای مقصد */
  itemId: number;
  /** sync_id تولیدشده در کلاینت — کلید idempotency سرور (ارسال دوباره ⇒ رکورد تکراری نه) */
  syncId: string;
  /** فایل فشرده‌شده؛ همان بایت‌هایی که به سرور می‌رود */
  blob: Blob;
  /** نام فایل برای FormData */
  fileName: string;
  caption?: string;
  sourceType?: 'camera' | 'gallery';
  /** تسک شمارشی که عکس در جریان آن گرفته شده */
  countTaskId?: number;
  /** آیا این عکس باید شاخص کالا شود؟ */
  isPrimary?: boolean;
  width?: number;
  height?: number;
  /** روی دستگاه مشترک، صف هر کاربر جداست */
  userId?: number;
  createdAt: number;
  retryCount: number;
  /**
   * pending  → منتظر ارسال
   * sending  → در حال ارسال (با ری‌استارت برنامه به pending برمی‌گردد)
   * failed   → خطای موقت؛ همچنان در نوبت ارسال است
   * rejected → سرور صریحاً رد کرد؛ فایل نگه داشته می‌شود تا کاربر تصمیم بگیرد
   */
  status: 'pending' | 'sending' | 'failed' | 'rejected';
  lastError?: string;
}

/**
 * cursor و زمان آخرین Pull موفق — per (کاربر، انبار)
 * lastServerTime همیشه از server_time پاسخ سرور است، نه ساعت دستگاه (رفع Clock Skew).
 */
export interface SyncCursorEntry {
  /** کلید مرکب: `${userId}:${warehouseId}` */
  key: string;
  userId: number;
  warehouseId: number;
  /** cursor مات وسط یک دانلود نیمه‌تمام؛ null یعنی دانلود قبلی کامل شد */
  cursor: string | null;
  /** since که دانلود نیمه‌تمام با آن شروع شد (باید تا پایان همان بماند) */
  inFlightSince: string | null;
  /** server_time صفحه اول دانلود نیمه‌تمام — پس از اتمام، lastServerTime می‌شود */
  pendingServerTime: string | null;
  /** مبنای دلتای بعدی (ISO) — فقط از server_time سرور */
  lastServerTime: string | null;
}

/**
 * OfflineDatabase — دیتابیس IndexedDB برنامه با استفاده از Dexie.js
 * جداول:
 * 1. syncQueue: صف درخواست‌های آفلاین (POST/PATCH/PUT/DELETE)
 * 2. apiCache: کش پاسخ‌های GET برای خواندن آفلاین
 * 3. syncErrors: صندوق خطاهایی که سرور رد کرده (4xx)
 * 4. countTasks / items / dynamicFields: دادهٔ دامنه Local-First (منبع: Pull API)
 * 5. syncCursors: cursor و server_time آخرین Pull per (کاربر، انبار)
 * 6. photoQueue: عکس‌های گرفته‌شده که هنوز به سرور نرسیده‌اند (Blob خام)
 *
 * قاعده: هیچ جدولی هرگز Clear نمی‌شود مگر صف خالی باشد و کاربر صریحاً تأیید کند.
 */
export class OfflineDatabase extends Dexie {
  syncQueue!: Table<SyncQueueEntry, number>;
  apiCache!: Table<ApiCacheEntry, string>;
  syncErrors!: Table<SyncErrorEntry, number>;
  countTasks!: Table<any, string>;
  items!: Table<any, string>;
  dynamicFields!: Table<any, string>;
  syncCursors!: Table<SyncCursorEntry, string>;
  docTasks!: Table<any, string>;
  photoQueue!: Table<PhotoQueueEntry, number>;

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

    // نسخه ۳ — Local-First: دادهٔ دامنه + cursorها؛ داده‌های v2 دست‌نخورده می‌مانند
    // (upgrade فقط ایندکس اضافه می‌کند؛ رکوردهای موجود صف/کش حفظ می‌شوند)
    this.version(3).stores({
      syncQueue: '++id, status, createdAt, userId, entitySyncId',
      apiCache: 'url, expiresAt',
      syncErrors: '++id, failedAt, dismissed, userId',
      countTasks: 'sync_id, id, warehouse_id, status, updated_at',
      items: 'sync_id, id, warehouse_id, fa_unic_code, updated_at',
      dynamicFields: 'sync_id, id, warehouse_id, updated_at',
      syncCursors: 'key, userId, warehouseId',
    });
    // نسخه ۴ — اضافه کردن جدول docTasks برای کارتابل مالی Local-First
    this.version(4).stores({
      syncQueue: '++id, status, createdAt, userId, entitySyncId',
      apiCache: 'url, expiresAt',
      syncErrors: '++id, failedAt, dismissed, userId',
      countTasks: 'sync_id, id, warehouse_id, status, updated_at',
      items: 'sync_id, id, warehouse_id, fa_unic_code, updated_at',
      dynamicFields: 'sync_id, id, warehouse_id, updated_at',
      syncCursors: 'key, userId, warehouseId',
      docTasks: 'sync_id, id, warehouse_id, status, updated_at',
    });

    // نسخه ۵ — صف آپلود عکس؛ فایل به‌صورت Blob اینجا می‌ماند تا سرور آن را
    // بپذیرد. جداول قبلی دست‌نخورده‌اند (upgrade فقط جدول جدید اضافه می‌کند).
    this.version(5).stores({
      syncQueue: '++id, status, createdAt, userId, entitySyncId',
      apiCache: 'url, expiresAt',
      syncErrors: '++id, failedAt, dismissed, userId',
      countTasks: 'sync_id, id, warehouse_id, status, updated_at',
      items: 'sync_id, id, warehouse_id, fa_unic_code, updated_at',
      dynamicFields: 'sync_id, id, warehouse_id, updated_at',
      syncCursors: 'key, userId, warehouseId',
      docTasks: 'sync_id, id, warehouse_id, status, updated_at',
      photoQueue: '++id, status, createdAt, userId, itemId, syncId',
    });
  }

  /**
   * پاک کردن جداول کش مشتق‌شده از سرور پس از بازیابی دیتابیس.
   * جداول صف (syncQueue, photoQueue, syncErrors) به هیچ عنوان پاک نمی‌شوند.
   */
  async clearServerDerivedCaches(): Promise<void> {
    await Promise.all([
      this.apiCache.clear(),
      this.countTasks.clear(),
      this.docTasks.clear(),
      this.items.clear(),
      this.dynamicFields.clear(),
      this.syncCursors.clear()
    ]);
  }
}

/** نمونه سینگلتون از دیتابیس — در کل اپلیکیشن استفاده می‌شود */
export const offlineDb = new OfflineDatabase();
