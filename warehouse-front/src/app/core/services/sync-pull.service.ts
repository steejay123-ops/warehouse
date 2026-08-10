import { offlineDb, SyncCursorEntry } from './offline-db';
import { NetworkStatusService } from './network-status.service';
import { isServerUnreachable } from './server-reachability';
import { BehaviorSubject, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';

/**
 * SyncPullService — دانلود دلتای سرور به Dexie (نیمهٔ Pull معماری Local-First)
 *
 * قواعد کلیدی:
 * - مبنای دلتا فقط `server_time` برگشتی سرور است، نه ساعت دستگاه (Clock Skew).
 * - کلاینت خودش ۳۰ ثانیه حاشیهٔ همپوشانی از since کم می‌کند؛ upsert تکراری بی‌ضرر است.
 * - هر صفحه بلافاصله در Dexie ذخیره و cursor ثبت می‌شود → قطعی وسط دانلود یعنی
 *   دفعهٔ بعد از همان‌جا ادامه می‌یابد، نه از اول.
 * - tombstone (is_deleted) رکورد محلی را حذف می‌کند مگر تغییری از همان رکورد در صف
 *   pending باشد → نگه داشتن با پرچم _serverDeleted (داده کاربر هرگز گم نمی‌شود).
 * - پاسخ 410 یعنی cursor/since قدیمی‌تر از عمر tombstoneهاست → Full Resync همان انبار.
 */

/** همان حاشیهٔ همپوشانی که سند طراحی تعیین کرده */
const SINCE_OVERLAP_MS = 30_000;
const PAGE_LIMIT = 500;

/** نگاشت کلید مدل سرور → جدول Dexie */
const MODEL_TABLES: Record<string, 'countTasks' | 'items' | 'dynamicFields' | 'docTasks'> = {
  count_tasks: 'countTasks',
  items: 'items',
  dynamic_fields: 'dynamicFields',
  doc_tasks: 'docTasks',
};

export type PullOutcome =
  | { status: 'completed'; upserted: number; deleted: number }
  | { status: 'offline' }
  | { status: 'server-unreachable' }
  | { status: 'auth-required' }
  | { status: 'forbidden' }
  | { status: 'already-running' }
  | { status: 'error'; message: string };

export class SyncPullService {
  private static instance: SyncPullService;
  private network = NetworkStatusService.getInstance();
  private inFlight = false;

  private _isPulling$ = new BehaviorSubject<boolean>(false);
  readonly isPulling$ = this._isPulling$.asObservable();

  /** بعد از هر Pull موفق emit می‌شود — storeهای دامنه برای رفرش UI گوش می‌دهند */
  private _pullCompleted$ = new Subject<{ warehouseId: number }>();
  readonly pullCompleted$ = this._pullCompleted$.asObservable();

  private constructor() {}

  static getInstance(): SyncPullService {
    if (!SyncPullService.instance) {
      SyncPullService.instance = new SyncPullService();
    }
    return SyncPullService.instance;
  }

  // ════════════════════════════════════════════
  //  Pull اصلی
  // ════════════════════════════════════════════

  /**
   * دانلود دلتای یک انبار. امن برای فراخوانی مکرر (هم‌زمانی ندارد).
   * @param isRetryAfter410 جلوگیری از حلقهٔ بی‌نهایت Full Resync
   */
  async pullChanges(warehouseId: number, isRetryAfter410 = false): Promise<PullOutcome> {
    if (this.inFlight) return { status: 'already-running' };
    if (!this.network.isBrowserOnline) return { status: 'offline' };

    const userId = this.getCurrentUserId();
    if (userId === null) return { status: 'auth-required' };

    this.inFlight = true;
    this._isPulling$.next(true);

    let upserted = 0;
    let deleted = 0;

    try {
      const cursorKey = `${userId}:${warehouseId}`;
      let state = await offlineDb.syncCursors.get(cursorKey);
      if (!state) {
        state = {
          key: cursorKey, userId, warehouseId,
          cursor: null, inFlightSince: null, pendingServerTime: null, lastServerTime: null,
        };
      }

      // اگر دانلود قبلی نیمه‌تمام مانده، با همان since ادامه می‌دهیم؛
      // وگرنه since جدید = آخرین server_time منهای ۳۰ ثانیه همپوشانی.
      let since: string | null;
      if (state.cursor) {
        since = state.inFlightSince;
      } else {
        since = state.lastServerTime
          ? new Date(new Date(state.lastServerTime).getTime() - SINCE_OVERLAP_MS).toISOString()
          : null;
        state.inFlightSince = since;
        state.pendingServerTime = null;
      }

      let cursor: string | null = state.cursor;
      let hasMore = true;

      while (hasMore) {
        const params = new URLSearchParams({ warehouse_id: String(warehouseId), limit: String(PAGE_LIMIT) });
        if (since) params.set('since', since);
        if (cursor) params.set('cursor', cursor);

        const response = await this.fetchPage(params);

        if (response.kind === 'http') {
          const res = response.res;
          if (isServerUnreachable(res.status)) {
            this.network.reportServerUnreachable();
            return { status: 'server-unreachable' };
          }
          this.network.reportServerReachable();

          if (res.status === 401) return { status: 'auth-required' };
          if (res.status === 403) return { status: 'forbidden' };
          if (res.status === 410) {
            // کلاینت قدیمی‌تر از عمر tombstoneها → Full Resync (فقط یک بار)
            console.warn('[SyncPull] ⏳ 410 — Full Resync انبار', warehouseId);
            await offlineDb.syncCursors.delete(cursorKey);
            this.inFlight = false;
            this._isPulling$.next(false);
            if (isRetryAfter410) return { status: 'error', message: 'full_resync_loop' };
            return this.pullChanges(warehouseId, true);
          }
          if (!res.ok) {
            return { status: 'error', message: `HTTP ${res.status}` };
          }

          const data = await res.json();

          // ذخیرهٔ server_time صفحهٔ اول به‌عنوان مبنای دلتای بعدی (پس از اتمام)
          if (!state.pendingServerTime) {
            state.pendingServerTime = data.server_time;
          }

          const counts = await this.applyPage(data.results || {}, warehouseId, userId);
          upserted += counts.upserted;
          deleted += counts.deleted;

          cursor = data.next_cursor || null;
          hasMore = !!data.has_more && !!cursor;

          // ثبت پیشرفت — قطعی بعد از این نقطه یعنی ادامه از همین‌جا
          await offlineDb.syncCursors.put({
            ...state,
            cursor: hasMore ? cursor : null,
            inFlightSince: hasMore ? state.inFlightSince : null,
            pendingServerTime: hasMore ? state.pendingServerTime : null,
            lastServerTime: hasMore ? state.lastServerTime : (state.pendingServerTime || state.lastServerTime),
          });
        } else {
          // transport error — به سرور نرسیدیم؛ cursor ذخیره‌شده دست‌نخورده می‌ماند
          this.network.reportServerUnreachable();
          return { status: 'server-unreachable' };
        }
      }

      console.log(`[SyncPull] ✅ انبار ${warehouseId}: ${upserted} upsert، ${deleted} حذف`);
      this._pullCompleted$.next({ warehouseId });
      return { status: 'completed', upserted, deleted };
    } catch (error: any) {
      console.error('[SyncPull] ❌ خطا در Pull:', error);
      return { status: 'error', message: error?.message || 'unknown' };
    } finally {
      this.inFlight = false;
      this._isPulling$.next(false);
    }
  }

  /** fetch یک صفحه — خطای transport را از پاسخ HTTP جدا می‌کند */
  private async fetchPage(params: URLSearchParams): Promise<{ kind: 'http'; res: Response } | { kind: 'transport' }> {
    const token = sessionStorage.getItem('wh_access_token') || localStorage.getItem('wh_access_token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    try {
      const res = await fetch(`${environment.apiUrl}/inventory/sync/pull/?${params.toString()}`, { headers });
      return { kind: 'http', res };
    } catch {
      return { kind: 'transport' };
    }
  }

  /**
   * اعمال یک صفحه از پاسخ روی Dexie — upsert بر اساس sync_id.
   * tombstone → حذف محلی، مگر رکورد در صف pending ارجاع داشته باشد.
   */
  private async applyPage(
    results: Record<string, any[]>,
    warehouseId: number,
    userId: number
  ): Promise<{ upserted: number; deleted: number }> {
    let upserted = 0;
    let deleted = 0;

    // sync_id هایی که تغییر ارسال‌نشده در صف دارند — رکوردشان پاک نمی‌شود
    const pendingEntries = await offlineDb.syncQueue
      .where('status').anyOf(['pending', 'sending', 'failed']).toArray();
    const pendingSyncIds = new Set(
      pendingEntries.map((e) => e.entitySyncId).filter((s): s is string => !!s)
    );

    for (const [modelKey, rows] of Object.entries(results)) {
      const tableName = MODEL_TABLES[modelKey];
      if (!tableName || !Array.isArray(rows) || rows.length === 0) continue;
      const table = offlineDb[tableName];

      const toPut: any[] = [];
      const toDelete: string[] = [];

      for (const row of rows) {
        if (!row.sync_id) continue; // بدون کلید پایدار قابل upsert نیست
        if (row.is_deleted) {
          if (pendingSyncIds.has(row.sync_id)) {
            // تغییر ارسال‌نشدهٔ کاربر روی رکوردی که سرور حذف کرده — نگه بدار و علامت بزن
            const existing = await table.get(row.sync_id);
            if (existing) {
              toPut.push({ ...existing, _serverDeleted: true, updated_at: row.updated_at });
            }
          } else {
            toDelete.push(row.sync_id);
          }
        } else {
          // پرچم‌های محلی رکورد قبلی (مثل _offlinePending وقتی صف pending دارد) حفظ شوند
          const existing = await table.get(row.sync_id);
          const keepPending = existing?._offlinePending && pendingSyncIds.has(row.sync_id);
          toPut.push({
            ...row,
            warehouse_id: row.warehouse_id ?? row.warehouse ?? warehouseId,
            ...(keepPending ? { _offlinePending: true, _localDraft: existing._localDraft } : {}),
          });
        }
      }

      if (toPut.length) {
        await table.bulkPut(toPut);
        upserted += toPut.length;
      }
      if (toDelete.length) {
        await table.bulkDelete(toDelete);
        deleted += toDelete.length;
      }
    }

    return { upserted, deleted };
  }

  // ════════════════════════════════════════════
  //  ابزارها
  // ════════════════════════════════════════════

  /** شناسه کاربر لاگین‌شده از پروفایل ذخیره‌شده (صف/cursor per-user است) */
  getCurrentUserId(): number | null {
    try {
      const raw = sessionStorage.getItem('wh_user_profile') || localStorage.getItem('wh_user_profile');
      if (!raw) return null;
      const id = JSON.parse(raw)?.id;
      return typeof id === 'number' ? id : null;
    } catch {
      return null;
    }
  }

  /** زمان آخرین Pull موفق (server_time) برای نمایش در UI */
  async getLastServerTime(warehouseId: number): Promise<string | null> {
    const userId = this.getCurrentUserId();
    if (userId === null) return null;
    const state = await offlineDb.syncCursors.get(`${userId}:${warehouseId}`);
    return state?.lastServerTime ?? null;
  }
}
