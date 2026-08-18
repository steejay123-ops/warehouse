import { Injectable } from '@angular/core';
import { offlineDb, SyncQueueEntry, SyncErrorEntry } from './offline-db';
import { SyncPullService } from './sync-pull.service';
import { NetworkStatusService } from './network-status.service';
import { isServerUnreachable } from './server-reachability';
import { BehaviorSubject, Subject, Subscription, filter } from 'rxjs';
import { environment } from '../../../environments/environment';

/**
 * نتیجه یک عملیات همگام‌سازی
 *
 * تفاوت کلیدی: «آفلاین بودن» شکست نیست — هیچ تلاشی انجام نشده است.
 * شکست فقط وقتی معنا دارد که واقعاً به سرور وصل شده باشیم.
 */
export type SyncOutcome =
  /** مرورگر آفلاین است — هیچ درخواستی ارسال نشد */
  | { status: 'offline' }
  /** مرورگر آنلاین است ولی سرور پاسخ نمی‌دهد — داده‌ها دست‌نخورده در صف ماندند */
  | { status: 'server-unreachable'; synced: number }
  /** نشست منقضی شده — نیاز به ورود مجدد */
  | { status: 'auth-required'; synced: number }
  /** صف خالی بود */
  | { status: 'nothing-to-sync' }
  /** همه چیز با موفقیت ارسال شد */
  | { status: 'completed'; synced: number }
  /** بخشی ارسال شد؛ بخشی رد شد یا باقی ماند */
  | { status: 'partial'; synced: number; rejected: number; remaining: number };

/**
 * نتیجه ارسال یک رکورد از صف
 *
 * • sent             → سرور پذیرفت (۲xx) → از صف حذف شد
 * • rejected         → سرور صریحاً رد کرد (۴xx) → به صندوق خطاها رفت
 * • auth-failed      → نشست منقضی → در صف ماند
 * • server-error     → خطای ۵xx → در صف ماند
 * • transport-failed → اصلاً به سرور نرسید → در صف ماند (بدون افزایش شمارنده تلاش)
 */
type EntryResult = 'sent' | 'rejected' | 'auth-failed' | 'server-error' | 'transport-failed';

/**
 * OfflineSyncService — سرویس پیشرفته همگام‌سازی آفلاین
 *
 * وظایف:
 * 1. درخواست‌های تغییری (POST/PATCH/PUT/DELETE) را در صف ذخیره می‌کند
 * 2. پاسخ‌های GET را در کش ذخیره می‌کند (با TTL قابل تنظیم)
 * 3. به محض آنلاین شدن، صف را پردازش می‌کند
 * 4. همگام‌سازی خودکار با اینتروال قابل تنظیم
 * 5. همگام‌سازی دستی (forceSync)
 * 6. انتقال خطاهای 4xx به صندوق خطا (syncErrors)
 */

export interface DeepUpdateSummary {
  warehouseName: string;
  records: number;
  bytes: number;
}

@Injectable({
  providedIn: 'root',
})
export class OfflineSyncService {
  private static instance: OfflineSyncService;
  private network = NetworkStatusService.getInstance();
  private subscription: Subscription | null = null;
  private autoSyncTimer: any = null;

  /** حداکثر تعداد تلاش مجدد برای هر درخواست */
  private readonly MAX_RETRIES = 3;

  /** مدت زمان پیش‌فرض اعتبار کش (۱ ساعت) */
  private readonly DEFAULT_CACHE_TTL = 60 * 60 * 1000;

  /** فاصله پیش‌فرض همگام‌سازی خودکار (۱۵ دقیقه) */
  private readonly DEFAULT_SYNC_INTERVAL = 15 * 60 * 1000;

  // ─── Observables عمومی ───

  /** آیا الان در حال همگام‌سازی هست؟ */
  private _isSyncing$ = new BehaviorSubject<boolean>(false);
  readonly isSyncing$ = this._isSyncing$.asObservable();

  /** تعداد درخواست‌های در صف انتظار */
  private _pendingCount$ = new BehaviorSubject<number>(0);
  readonly pendingCount$ = this._pendingCount$.asObservable();

  /** تعداد خطاهای خوانده‌نشده در صندوق */
  private _errorCount$ = new BehaviorSubject<number>(0);
  readonly errorCount$ = this._errorCount$.asObservable();

  /** آخرین زمان همگام‌سازی موفقیت‌آمیز */
  private _lastSyncTime$ = new BehaviorSubject<number | null>(null);
  readonly lastSyncTime$ = this._lastSyncTime$.asObservable();

  /**
   * نتیجه هر دور پردازش صف — شامل دورهای خودکار (پس از بازگشت اتصال) که
   * کاربر دکمه‌ای نزده و بدون این جریان هیچ بازخوردی نمی‌گرفت.
   */
  private _syncOutcome$ = new Subject<SyncOutcome>();
  readonly syncOutcome$ = this._syncOutcome$.asObservable();

  private _deepUpdateState$ = new BehaviorSubject<{
    isActive: boolean;
    mode: 'current' | 'all';
    totalWarehouses: number;
    currentIndex: number;
    currentWarehouseName: string;
  } | null>(null);
  readonly deepUpdateState$ = this._deepUpdateState$.asObservable();

  /**
   * رد صریح سرور (4xx/409) — storeهای دامنه برای reconciliation گوش می‌دهند:
   * رکورد محلی خوش‌بینانه باید به آخرین نسخهٔ سروری برگردد.
   */
  private _rejected$ = new Subject<SyncErrorEntry>();
  readonly rejected$ = this._rejected$.asObservable();

  /**
   * جریان اطلاع‌رسانی بروزرسانی زنده داده‌ها از سرور در پس‌زمینه (Stale-While-Revalidate)
   */
  private _liveDataUpdates$ = new Subject<{ url: string; data: any; timestamp: number }>();
  readonly liveDataUpdates$ = this._liveDataUpdates$.asObservable();

  /** انتشار تغییرات داده‌ای دریافت شده از استعلام پس‌زمینه */
  notifyDataUpdated(url: string, data: any): void {
    this._liveDataUpdates$.next({ url, data, timestamp: Date.now() });
  }

  private constructor() {}

  /** دریافت نمونه سینگلتون */
  static getInstance(): OfflineSyncService {
    if (!OfflineSyncService.instance) {
      OfflineSyncService.instance = new OfflineSyncService();
    }
    return OfflineSyncService.instance;
  }

  get pullProgress$() { return SyncPullService.getInstance().pullProgress$; }
  get isPulling$() { return SyncPullService.getInstance().isPulling$; }

  // ─── مقادیر لحظه‌ای ───
  get isSyncing(): boolean { return this._isSyncing$.value; }
  get pendingCount(): number { return this._pendingCount$.value; }
  get errorCount(): number { return this._errorCount$.value; }

  /**
   * راه‌اندازی اولیه — در app initializer فراخوانی می‌شود
   */
  initialize(): void {
    // رکوردهای گیرکرده در وضعیت sending (مثلا بسته شدن برنامه وسط ارسال) را آزاد کن
    offlineDb.syncQueue
      .where('status')
      .equals('sending')
      .modify({ status: 'pending' })
      .catch(() => {});

    // وقتی اتصال کامل (مرورگر + سرور) برقرار شد، صف را پردازش کن
    this.subscription = this.network.state$
      .pipe(filter((state) => state === 'online'))
      .subscribe(() => {
        this.processQueue();
      });

    // اگر الان آنلاین هستیم، صف باقی‌مانده را پردازش کن
    if (this.network.isBrowserOnline) {
      this.processQueue();
    }

    // راه‌اندازی تایمر همگام‌سازی خودکار
    this.startAutoSync();

    // به‌روزرسانی شمارنده‌ها
    this.refreshCounts();

    // پاکسازی دادهٔ دامنهٔ خیلی قدیمی (نگهداری ۶ ماه) — روزی یک‌بار
    this.pruneOldLocalData().catch(() => {});

    console.log('[OfflineSync] ✅ سرویس همگام‌سازی آفلاین راه‌اندازی شد');
  }

  /**
   * حذف رکوردهای دامنهٔ محلی قدیمی‌تر از ۶ ماه (updated_at) که هیچ تغییر
   * ارسال‌نشده‌ای در صف ندارند. صف و صندوق خطا هرگز prune نمی‌شوند.
   */
  private async pruneOldLocalData(): Promise<void> {
    const PRUNE_KEY = 'wh_last_prune';
    const ONE_DAY = 24 * 60 * 60 * 1000;
    const last = parseInt(localStorage.getItem(PRUNE_KEY) || '0', 10);
    if (Date.now() - last < ONE_DAY) return;
    localStorage.setItem(PRUNE_KEY, String(Date.now()));

    const cutoffIso = new Date(Date.now() - 180 * ONE_DAY).toISOString();
    const pendingEntries = await offlineDb.syncQueue.toArray();
    const protectedIds = new Set(pendingEntries.map((e) => e.entitySyncId).filter(Boolean));

    let pruned = 0;
    for (const table of [offlineDb.countTasks, offlineDb.items, offlineDb.dynamicFields]) {
      const old = await table.where('updated_at').below(cutoffIso).primaryKeys();
      const deletable = old.filter((k) => !protectedIds.has(k as string));
      if (deletable.length) {
        await table.bulkDelete(deletable as string[]);
        pruned += deletable.length;
      }
    }
    if (pruned > 0) {
      console.log(`[OfflineSync] 🧹 ${pruned} رکورد محلی قدیمی‌تر از ۶ ماه پاک شد`);
    }
  }

  // ════════════════════════════════════════════
  //  TTL — مدت اعتبار کش (قابل تنظیم)
  // ════════════════════════════════════════════

  /** خواندن TTL از localStorage یا مقدار پیش‌فرض (صفر = بدون انقضا) */
  getCacheTTL(): number {
    const stored = localStorage.getItem('wh_cache_ttl');
    if (stored) {
      const val = parseInt(stored, 10);
      if (!isNaN(val) && val >= 0) return val;
    }
    return this.DEFAULT_CACHE_TTL;
  }

  /** تنظیم TTL (به میلی‌ثانیه) */
  setCacheTTL(ttlMs: number): void {
    localStorage.setItem('wh_cache_ttl', String(ttlMs));
  }

  // ════════════════════════════════════════════
  //  Auto Sync — همگام‌سازی خودکار
  // ════════════════════════════════════════════

  /** خواندن فاصله زمانی اتوسینک از localStorage یا مقدار پیش‌فرض */
  getSyncInterval(): number {
    const stored = localStorage.getItem('wh_sync_interval');
    if (stored) {
      const val = parseInt(stored, 10);
      if (!isNaN(val) && val > 0) return val;
    }
    return this.DEFAULT_SYNC_INTERVAL;
  }

  /** تنظیم فاصله زمانی همگام‌سازی خودکار (به میلی‌ثانیه) و ری‌استارت تایمر */
  setSyncInterval(intervalMs: number): void {
    localStorage.setItem('wh_sync_interval', String(intervalMs));
    this.stopAutoSync();
    this.startAutoSync();
  }

  /**
   * اعمال تنظیمات ادمین از public config.
   * عمداً مسدودکننده نیست: بوت آفلاین این endpoint را نمی‌گیرد و localStorage
   * آخرین مقدار شناخته‌شده را نگه می‌دارد.
   */
  applyRemoteConfig(cfg: {
    offline_sync_interval_minutes?: number;
    offline_cache_ttl_minutes?: number;
  }): void {
    const clamp = (val: unknown, low: number, high: number): number | null => {
      const num = Number(val);
      if (!Number.isFinite(num)) return null;
      return Math.max(low, Math.min(high, Math.round(num)));
    };

    const syncMinutes = clamp(cfg.offline_sync_interval_minutes, 1, 1440);
    if (syncMinutes !== null && syncMinutes * 60_000 !== this.getSyncInterval()) {
      this.setSyncInterval(syncMinutes * 60_000);
      console.log(`[OfflineSync] ⚙️ بازه همگام‌سازی خودکار: ${syncMinutes} دقیقه`);
    }

    // صفر = «هیچ‌وقت کهنه نشود»، پس کف بازه صفر است نه یک
    const ttlMinutes = clamp(cfg.offline_cache_ttl_minutes, 0, 10080);
    if (ttlMinutes !== null && ttlMinutes * 60_000 !== this.getCacheTTL()) {
      // فقط روی نوشتن‌های آینده اثر دارد؛ expiresAt لحظه نوشتن مهر می‌شود.
      this.setCacheTTL(ttlMinutes * 60_000);
      console.log(
        `[OfflineSync] ⚙️ عمر کش آفلاین: ${ttlMinutes === 0 ? 'بدون انقضا' : ttlMinutes + ' دقیقه'}`
      );
    }
  }

  /** شروع تایمر همگام‌سازی خودکار */
  private startAutoSync(): void {
    this.stopAutoSync();
    const interval = this.getSyncInterval();
    this.autoSyncTimer = setInterval(() => {
      if (this.network.isBrowserOnline && !this.isSyncing) {
        console.log('[OfflineSync] ⏰ اجرای خودکار همگام‌سازی...');
        this.processQueue();
      }
    }, interval);
    console.log(`[OfflineSync] ⏰ تایمر خودکار تنظیم شد: هر ${Math.round(interval / 60000)} دقیقه`);
  }

  /** متوقف کردن تایمر */
  private stopAutoSync(): void {
    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = null;
    }
  }

  // ════════════════════════════════════════════
  //  Force Sync — همگام‌سازی دستی
  // ════════════════════════════════════════════

  /**
   * اجرای فوری همگام‌سازی — توسط کاربر (از دکمه UI) فراخوانی می‌شود
   *
   * بررسی پیش‌پرواز: اگر مرورگر آفلاین باشد، هیچ تلاشی انجام نمی‌شود و
   * نتیجه «offline» برمی‌گردد — این «شکست» نیست، فقط «هنوز نه».
   */
  async forceSync(): Promise<SyncOutcome> {
    if (!this.network.isBrowserOnline) {
      console.log('[OfflineSync] 📴 آفلاین — همگام‌سازی انجام نشد (داده‌ها محفوظ است)');
      return { status: 'offline' };
    }

    return this.processQueue();
  }

  // ════════════════════════════════════════════
  //  صف همگام‌سازی (Sync Queue)
  // ════════════════════════════════════════════

  /**
   * افزودن یک درخواست تغییری به صف همگام‌سازی
   * @param meta متادیتای Local-First: مالک، نوع/شناسه موجودیت، نسخهٔ مبنا (409)
   */
  async enqueue(
    method: string,
    url: string,
    body: any,
    meta?: { userId?: number; entityType?: string; entitySyncId?: string; baseUpdatedAt?: string }
  ): Promise<SyncQueueEntry> {
    const entry: SyncQueueEntry = {
      method,
      url,
      body,
      createdAt: Date.now(),
      retryCount: 0,
      status: 'pending',
      ...(meta || {}),
    };
    const id = await offlineDb.syncQueue.add(entry);
    entry.id = id;
    console.log(`[OfflineSync] 📥 درخواست ${method} ${url} به صف اضافه شد (id: ${id})`);
    await this.refreshCounts();
    return entry;
  }

  /**
   * دریافت تمام رکوردهای صف (برای ادغام با کش)
   */
  async getQueueEntries(): Promise<SyncQueueEntry[]> {
    return offlineDb.syncQueue
      .where('status')
      .anyOf(['pending', 'failed'])
      .sortBy('createdAt');
  }

  // ════════════════════════════════════════════
  //  کش API (با TTL قابل تنظیم)
  // ════════════════════════════════════════════

  /**
   * ذخیره پاسخ GET در کش.
   *
   * پاسخ تهی هرگز جایگزین کش سالم نمی‌شود: روی شبکه ضعیف ممکن است سرور
   * ۲۰۰ با بدنه خالی برگرداند و تنها نسخه‌ای که کاربر آفلاین در اختیار دارد
   * از بین برود. جایگزینی فقط با داده واقعی انجام می‌شود.
   */
  async cacheResponse(url: string, response: any): Promise<void> {
    if (response === null || response === undefined) return;

    const ttl = this.getCacheTTL();
    await offlineDb.apiCache.put({
      url,
      response,
      cachedAt: Date.now(),
      // TTL صفر یعنی «هیچ‌وقت کهنه نشود»
      expiresAt: ttl === 0 ? Number.MAX_SAFE_INTEGER : Date.now() + ttl,
    });
  }

  /**
   * خواندن رکورد کش‌شده GET.
   *
   * کش فقط در حالت آفلاین خوانده می‌شود، پس تنها نسخه‌ای است که کاربر در
   * اختیار دارد و هرگز حذف نمی‌شود — حتی وقتی از TTL گذشته باشد. گذشتن
   * از TTL فقط یعنی «کهنه است»، نه «دور انداخته شود».
   */
  async getCachedEntry(url: string): Promise<{ response: any; cachedAt: number; isStale: boolean } | null> {
    const entry = await offlineDb.apiCache.get(url);
    if (!entry) return null;
    return {
      response: entry.response,
      cachedAt: entry.cachedAt,
      isStale: entry.expiresAt < Date.now(),
    };
  }

  // ════════════════════════════════════════════
  //  صندوق خطای همگام‌سازی (Sync Error Inbox)
  // ════════════════════════════════════════════

  /** دریافت تمام خطاهای خوانده‌نشده */
  async getErrors(): Promise<SyncErrorEntry[]> {
    const errors = await offlineDb.syncErrors
      .where('dismissed')
      .equals(0)
      .sortBy('failedAt');
    return errors.reverse();
  }

  /** دریافت تمام خطاها (حتی خوانده‌شده‌ها) */
  async getAllErrors(): Promise<SyncErrorEntry[]> {
    return offlineDb.syncErrors.reverse().sortBy('failedAt');
  }

  /** حذف (Dismiss) یک خطا */
  async dismissError(id: number): Promise<void> {
    await offlineDb.syncErrors.update(id, { dismissed: 1 });
    await this.refreshCounts();
  }

  /** حذف تمام خطاها */
  async dismissAllErrors(): Promise<void> {
    await offlineDb.syncErrors.toCollection().modify({ dismissed: 1 });
    await this.refreshCounts();
  }

  /** حذف دائمی یک خطا از دیتابیس */
  async deleteError(id: number): Promise<void> {
    await offlineDb.syncErrors.delete(id);
    await this.refreshCounts();
  }

  /** حذف دائمی تمام خطاها */
  async clearAllErrors(): Promise<void> {
    await offlineDb.syncErrors.clear();
    await this.refreshCounts();
  }

  /**
   * تلاش مجدد یک درخواست ردشده — از Inbox خطاها.
   * رکورد به صف برمی‌گردد (با متادیتای اصلی) و صف بلافاصله پردازش می‌شود.
   */
  async retryError(errorId: number): Promise<void> {
    const err = await offlineDb.syncErrors.get(errorId);
    if (!err) return;
    await this.enqueue(err.method, err.url, err.body, {
      userId: err.userId,
      entityType: err.entityType,
      entitySyncId: err.entitySyncId,
    });
    await offlineDb.syncErrors.delete(errorId);
    await this.refreshCounts();
    console.log(`[OfflineSync] 🔁 خطای ${errorId} به صف برگشت (${err.method} ${err.url})`);
    this.processQueue();
  }

  /**
   * Reconciliation پس از رد صریح سرور (اصلاح ۵ طرح):
   * دادهٔ خوش‌بینانهٔ محلی نباید طوری بماند که انگار پذیرفته شده.
   * اگر سرور نسخهٔ خودش را داده (server_record در 409) همان جایگزین می‌شود؛
   * وگرنه فقط پرچم pending پاک می‌شود و نسخهٔ تازه با Pull بعدی می‌رسد.
   */
  private async reconcileRejected(err: SyncErrorEntry): Promise<void> {
    if (!err.entitySyncId || !err.entityType) return;
    const tableMap: Record<string, 'countTasks' | 'items' | 'dynamicFields'> = {
      count_task: 'countTasks',
      item: 'items',
      dynamic_field: 'dynamicFields',
    };
    const tableName = tableMap[err.entityType];
    if (!tableName) return;
    const table = offlineDb[tableName];

    try {
      // آیا تغییر دیگری از همین رکورد هنوز در صف است؟ اگر بله پرچم می‌ماند.
      const stillPending = await offlineDb.syncQueue
        .where('entitySyncId').equals(err.entitySyncId)
        .and((e) => ['pending', 'sending', 'failed'].includes(e.status))
        .count();

      const serverRecord = err.serverResponse?.server_record;
      if (serverRecord?.sync_id) {
        const existing = await table.get(err.entitySyncId);
        await table.put({
          ...serverRecord,
          warehouse_id: serverRecord.warehouse_id ?? serverRecord.warehouse ?? existing?.warehouse_id,
          ...(stillPending > 0 ? { _offlinePending: true } : {}),
        });
      } else if (stillPending === 0) {
        const existing = await table.get(err.entitySyncId);
        if (existing?._offlinePending) {
          delete existing._offlinePending;
          delete existing._localDraft;
          await table.put(existing);
        }
      }
    } catch (e) {
      console.warn('[OfflineSync] ⚠️ reconciliation ناموفق:', e);
    }
  }

  // ════════════════════════════════════════════
  //  پردازش صف (Process Queue)
  // ════════════════════════════════════════════

  /**
   * پردازش صف همگام‌سازی — درخواست‌ها را به ترتیب ارسال می‌کند
   *
   * قوانین حذف از صف (صف = کار ناتمام کاربر و مقدس است):
   * • فقط وقتی حذف می‌شود که سرور صریحاً بپذیرد (۲xx) یا صریحاً رد کند (۴xx)
   * • خطای شبکه یا ۵xx هرگز باعث از دست رفتن داده نمی‌شود
   */
  async processQueue(): Promise<SyncOutcome> {
    const outcome = await this.runQueue();
    this._syncOutcome$.next(outcome);
    return outcome;
  }

  private async runQueue(): Promise<SyncOutcome> {
    if (this.isSyncing) return { status: 'nothing-to-sync' };

    // بررسی پیش‌پرواز — آفلاین یعنی «تلاشی انجام نشد»، نه «شکست خورد»
    if (!this.network.isBrowserOnline) return { status: 'offline' };

    this._isSyncing$.next(true);
    let synced = 0;
    let rejected = 0;
    let transportAborted = false;
    let authRequired = false;

    console.log('[OfflineSync] 🔄 شروع پردازش صف همگام‌سازی...');

    try {
      const pendingEntries = await offlineDb.syncQueue
        .where('status')
        .anyOf(['pending', 'failed'])
        .sortBy('createdAt');

      if (pendingEntries.length === 0) {
        console.log('[OfflineSync] ✅ صف خالی است');
        this._lastSyncTime$.next(Date.now());
        return { status: 'nothing-to-sync' };
      }

      console.log(`[OfflineSync] 📋 ${pendingEntries.length} درخواست در صف`);

      for (const entry of pendingEntries) {
        if (!this.network.isBrowserOnline) {
          console.log('[OfflineSync] 📴 اتصال قطع شد — پردازش متوقف شد (داده‌ها محفوظ است)');
          transportAborted = true;
          break;
        }

        const result = await this.sendEntry(entry);
        await this.refreshCounts();

        if (result === 'sent') {
          synced++;
          continue;
        }
        if (result === 'rejected') {
          rejected++;
          continue;
        }
        if (result === 'auth-failed') {
          // ادامه دادن بی‌فایده است — همه درخواست‌ها با همین توکن رد می‌شوند
          authRequired = true;
          break;
        }
        // transport-failed یا server-error — سرور در دسترس نیست یا مشکل دارد؛
        // ادامه دادن فقط سرور را می‌کوبد. متوقف شو و بعداً دوباره تلاش کن.
        transportAborted = true;
        break;
      }

      // زمان آخرین همگام‌سازی فقط وقتی معنا دارد که واقعاً با سرور حرف زده باشیم
      if (!transportAborted) {
        this._lastSyncTime$.next(Date.now());
      }
    } catch (error) {
      console.error('[OfflineSync] ❌ خطا در پردازش صف:', error);
    } finally {
      this._isSyncing$.next(false);
      await this.refreshCounts();
    }

    // ─── تعیین نتیجه ───
    if (!this.network.isBrowserOnline) return { status: 'offline' };
    if (authRequired) return { status: 'auth-required', synced };
    if (transportAborted) return { status: 'server-unreachable', synced };

    const remaining = await this.getPendingCount();
    if (rejected > 0 || remaining > 0) {
      return { status: 'partial', synced, rejected, remaining };
    }
    if (synced === 0) return { status: 'nothing-to-sync' };
    return { status: 'completed', synced };
  }

  /**
   * ارسال یک درخواست از صف به سرور
   * @returns نتیجه دقیق ارسال (نگاه کنید به EntryResult)
   */
  private async sendEntry(entry: SyncQueueEntry, hasRetriedAuth = false): Promise<EntryResult> {
    if (!entry.id) return 'rejected';

    try {
      // علامت‌گذاری به عنوان در حال ارسال
      await offlineDb.syncQueue.update(entry.id, { status: 'sending' });

      // ساخت و ارسال درخواست fetch
      const token = sessionStorage.getItem('wh_access_token') || localStorage.getItem('wh_access_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const fetchOptions: RequestInit = {
        method: entry.method,
        headers,
      };

      // برای DELETE بدنه ارسال نمی‌کنیم
      if (entry.method !== 'DELETE' && entry.body) {
        fetchOptions.body = JSON.stringify(entry.body);
      }

      const response = await fetch(entry.url, fetchOptions);

      // پاسخ گرفتن با «به بک‌اند رسیدن» یکی نیست: یک 502 از Cloudflare هم یک
      // پاسخ کامل HTTP است، در حالی که origin اصلاً بالا نیست. اگر اینجا
      // reachable گزارش کنیم، رابط کاربری خود را آنلاین نشان می‌دهد در حالی
      // که هیچ درخواستی واقعاً به بک‌اند نمی‌رسد.
      if (isServerUnreachable(response.status)) {
        this.network.reportServerUnreachable();
      } else {
        this.network.reportServerReachable();
      }

      if (response.ok) {
        // موفقیت‌آمیز — حذف از صف
        await offlineDb.syncQueue.delete(entry.id);
        console.log(`[OfflineSync] ✅ ارسال موفق: ${entry.method} ${entry.url}`);
        return 'sent';
      } else if (response.status === 401) {
        // توکن منقضی — تلاش برای refresh و ارسال مجدد (فقط یک بار)
        if (!hasRetriedAuth && (await this.tryRefreshToken())) {
          return this.sendEntry(entry, true);
        }
        // refresh ناموفق — رکورد در صف بماند تا بعد از login مجدد ارسال شود
        await offlineDb.syncQueue.update(entry.id, {
          status: 'pending',
          lastError: 'نشست منقضی شده — پس از ورود مجدد ارسال می‌شود',
        });
        console.warn(`[OfflineSync] 🔒 توکن منقضی — ${entry.url} در صف ماند`);
        return 'auth-failed';
      } else if (response.status === 408 || response.status === 429) {
        // 408 (مهلت درخواست) و 429 (محدودیت نرخ) رد صریح نیستند — موقتی‌اند و
        // تلاش بعدی به احتمال زیاد موفق می‌شود. مثل 5xx در صف می‌مانند.
        await this.handleRetry(entry, `خطای موقت سرور (${response.status}) — بعداً دوباره تلاش می‌شود`);
        return 'server-error';
      } else if (response.status >= 400 && response.status < 500) {
        // خطای کلاینت (4xx شامل 409) — انتقال به صندوق خطاها
        let serverMessage = `خطای ${response.status}`;
        let errorBody: any = null;
        try {
          errorBody = await response.json();
          if (errorBody.detail) {
            serverMessage = errorBody.detail === 'conflict'
              ? 'تداخل: این رکورد هم‌زمان توسط شخص دیگری تغییر کرده است'
              : errorBody.detail;
          } else if (typeof errorBody === 'object') {
            const firstField = Object.keys(errorBody)[0];
            const firstError = errorBody[firstField];
            serverMessage = Array.isArray(firstError)
              ? `${firstField}: ${firstError[0]}`
              : String(firstError);
          }
        } catch { /* ignore JSON parse error */ }

        // ذخیره در صندوق خطاها (payload کامل حفظ می‌شود — داده کاربر گم نمی‌شود)
        const syncError: SyncErrorEntry = {
          method: entry.method,
          url: entry.url,
          body: entry.body,
          statusCode: response.status,
          serverMessage,
          failedAt: Date.now(),
          dismissed: 0,
          userId: entry.userId,
          entityType: entry.entityType,
          entitySyncId: entry.entitySyncId,
          serverResponse: errorBody,
        };
        syncError.id = await offlineDb.syncErrors.add(syncError);

        // حذف از صف — سرور صریحاً رد کرده و تکرار آن بی‌فایده است
        await offlineDb.syncQueue.delete(entry.id);
        console.error(`[OfflineSync] ❌ خطای ${response.status} برای ${entry.url} — منتقل به صندوق خطاها`);

        // Reconciliation: رکورد خوش‌بینانه محلی به وضعیت سروری برگردد
        await this.reconcileRejected(syncError);
        this._rejected$.next(syncError);
        return 'rejected';
      } else {
        // خطای سرور (5xx) — در صف می‌ماند، بعداً دوباره تلاش می‌شود
        await this.handleRetry(entry, `خطای سرور (${response.status})`);
        return 'server-error';
      }
    } catch (error: any) {
      // اصلاً به سرور نرسیدیم (قطع شبکه / سرور خاموش)
      // این «شکست همگام‌سازی» نیست — فقط هنوز فرصتش نشده است.
      this.network.reportServerUnreachable();
      await this.markTransportFailure(entry, error?.message || 'اتصال برقرار نشد');
      return 'transport-failed';
    }
  }

  /**
   * تلاش برای تازه‌سازی access token با استفاده از refresh token
   * @returns true = توکن جدید گرفته شد / false = ناموفق
   */
  private async tryRefreshToken(): Promise<boolean> {
    const refresh = localStorage.getItem('wh_refresh_token');
    if (!refresh) return false;

    try {
      const response = await fetch(`${environment.apiUrl}/auth/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh }),
      });
      if (!response.ok) return false;

      const data = await response.json();
      if (!data?.access) return false;

      // ذخیره توکن جدید در localStorage
      localStorage.setItem('wh_access_token', data.access);
      // ذخیره refresh token جدید (بعد از چرخش توکن، توکن قبلی باطل می‌شود)
      if (data.refresh) {
        localStorage.setItem('wh_refresh_token', data.refresh);
      }
      console.log('[OfflineSync] 🔑 توکن با موفقیت تازه‌سازی شد');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * مدیریت خطای سرور (۵xx) — رکورد هرگز حذف نمی‌شود
   *
   * صف، کار ناتمام کاربر است. تنها دو چیز آن را حذف می‌کند:
   * پذیرش صریح سرور (۲xx) یا رد صریح سرور (۴xx).
   * خطای موقت سرور فقط شمارنده تلاش را بالا می‌برد.
   */
  private async handleRetry(entry: SyncQueueEntry, errorMessage: string): Promise<void> {
    if (!entry.id) return;
    const newRetryCount = entry.retryCount + 1;

    await offlineDb.syncQueue.update(entry.id, {
      status: 'failed',
      retryCount: newRetryCount,
      lastError:
        newRetryCount >= this.MAX_RETRIES
          ? `${errorMessage} — پس از ${newRetryCount} تلاش هنوز ارسال نشده (داده‌ها محفوظ است)`
          : errorMessage,
    });

    console.warn(
      `[OfflineSync] ⚠️ تلاش ${newRetryCount} ناموفق: ${entry.url} — ${errorMessage} (در صف باقی ماند)`
    );
  }

  /**
   * خطای انتقال (به سرور نرسیدیم) — رکورد بدون هیچ تغییری به صف برمی‌گردد
   *
   * مهم: retryCount افزایش نمی‌یابد. قطعی اینترنت تقصیر داده نیست و
   * نباید رکورد را به سمت «سوختن» ببرد.
   */
  private async markTransportFailure(entry: SyncQueueEntry, errorMessage: string): Promise<void> {
    if (!entry.id) return;
    await offlineDb.syncQueue.update(entry.id, {
      status: 'pending',
      lastError: `در انتظار اتصال: ${errorMessage}`,
    });
    console.log(`[OfflineSync] 📴 ${entry.url} ارسال نشد — در صف ماند تا اتصال برقرار شود`);
  }

  // ════════════════════════════════════════════
  //  ابزارهای کمکی
  // ════════════════════════════════════════════

  /** به‌روزرسانی شمارنده‌های Observable */
  async refreshCounts(): Promise<void> {
    try {
      const pending = await offlineDb.syncQueue
        .where('status')
        .anyOf(['pending', 'failed'])
        .count();
      this._pendingCount$.next(pending);

      const errors = await offlineDb.syncErrors
        .where('dismissed')
        .equals(0)
        .count();
      this._errorCount$.next(errors);
    } catch (e) {
      // DB may not be ready
    }
  }

  /** دریافت تعداد درخواست‌های در صف */
  async getPendingCount(): Promise<number> {
    return offlineDb.syncQueue
      .where('status')
      .anyOf(['pending', 'failed'])
      .count();
  }

  /** تخلیه کامل صف (برای حالت‌های اضطراری) */
  async clearQueue(): Promise<void> {
    await offlineDb.syncQueue.clear();
  }

  /** 
   * بروزرسانی عمیق (Full Resync): 
   * پاک کردن کامل دیتابیس لوکال و دانلود مجدد داده‌های سرور
   */
  async performDeepUpdate(warehouseIds: number[], warehousesMap: Record<number, string>): Promise<DeepUpdateSummary[]> {
    console.log(`[OfflineSync] 🚨 شروع بروزرسانی عمیق برای انبارهای:`, warehouseIds);
    
    if (warehouseIds.length === 0) return [];

    // ۱. گارد اطمینان از سلامت سرور پیش از پاکسازی داده‌ها
    const token = sessionStorage.getItem('wh_access_token') || localStorage.getItem('wh_access_token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    try {
      // ارسال یک ریکوئست سبک فقط برای بررسی بالا بودن سرور و اعتبار نشست
      const testId = warehouseIds[0];
      const res = await fetch(`${environment.apiUrl}/inventory/sync/pull/?warehouse_id=${testId}&limit=1`, { headers });
      if (!res.ok) {
        throw new Error(res.status === 401 || res.status === 403 ? 'auth-required' : 'server-unreachable');
      }
    } catch (err: any) {
      console.error(`[OfflineSync] ❌ سرور برای بروزرسانی عمیق در دسترس نیست.`);
      const status = err.message || 'server-unreachable';
      throw new Error(status === 'auth-required' ? 'نشست شما منقضی شده است. لطفا وارد شوید.' : 'سرور در دسترس نیست');
    }

    // ۲. پاکسازی جداول داده و نشانگرها (Cursor) فقط برای انبارهای انتخاب‌شده
    const deletePromises = [];
    for (const id of warehouseIds) {
      deletePromises.push(offlineDb.items.where('warehouse_id').equals(id).delete());
      deletePromises.push(offlineDb.docTasks.where('warehouse_id').equals(id).delete());
      deletePromises.push(offlineDb.countTasks.where('warehouse_id').equals(id).delete());
      deletePromises.push(offlineDb.syncCursors.where('warehouseId').equals(id).delete());
    }
    await Promise.all(deletePromises);
    
    // ۳. دریافت و دانلود مجدد داده‌ها
    const { SyncPullService } = await import('./sync-pull.service');
    const pullService = SyncPullService.getInstance();
    
    try {
      const summaries: DeepUpdateSummary[] = [];

      this._deepUpdateState$.next({
        isActive: true, mode: 'all', totalWarehouses: warehouseIds.length, currentIndex: 0, currentWarehouseName: ''
      });

      for (let i = 0; i < warehouseIds.length; i++) {
        const id = warehouseIds[i];
        const wName = warehousesMap[id] || `انبار ${id}`;
        this._deepUpdateState$.next({ ...this._deepUpdateState$.value!, currentIndex: i + 1, currentWarehouseName: wName });
        
        const outcome = await pullService.pullChanges(id, true);
        
        if (outcome.status === 'completed') {
          summaries.push({ warehouseName: wName, records: outcome.upserted, bytes: outcome.bytes });
        } else {
          console.error(`[OfflineSync] ❌ بروزرسانی عمیق برای انبار ${id} شکست خورد:`, outcome);
          throw new Error(outcome.status === 'server-unreachable' ? 'سرور در دسترس نیست' : outcome.status);
        }
      }
      
      console.log(`[OfflineSync] ✅ بروزرسانی عمیق با موفقیت پایان یافت.`);
      return summaries;
    } finally {
      this._deepUpdateState$.next(null);
    }
  }

  destroy(): void {
    this.subscription?.unsubscribe();
    this.stopAutoSync();
  }
}
