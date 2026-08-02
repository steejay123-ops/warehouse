import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpResponse, HttpContextToken, HttpErrorResponse } from '@angular/common/http';
import { from, Observable, of, throwError } from 'rxjs';
import { switchMap, tap, catchError, timeout } from 'rxjs/operators';
import { NetworkStatusService } from '../services/network-status.service';
import { OfflineSyncService } from '../services/offline-sync.service';
import { offlineDb } from '../services/offline-db';
import { isServerUnreachable } from '../services/server-reachability';
import { environment } from '../../../environments/environment';

/**
 * اگر روی یک request تنظیم شود، آن را از مدار آفلاین عبور می‌دهد
 * مثال: درخواست‌های login و refresh
 */
export const SKIP_OFFLINE = new HttpContextToken<boolean>(() => false);

/**
 * وقتی درخواستی آفلاین بوده و در کش هم چیزی نبوده، این توکن ست می‌شود تا
 * errorInterceptor به‌جای «خطای داخلی سرور» پیام درست آفلاین را نشان دهد.
 */
export const OFFLINE_NO_CACHE = new HttpContextToken<boolean>(() => false);

/**
 * وقتی یک آپلود فایل (FormData) در حالت آفلاین رد می‌شود، این توکن ست می‌شود
 * تا errorInterceptor پیام روشن «آپلود آفلاین ممکن نیست» را نشان دهد.
 */
export const OFFLINE_UPLOAD_UNSUPPORTED = new HttpContextToken<boolean>(() => false);

/**
 * سقف انتظار برای یک GET روی شبکه کند. بعد از این مهلت به کش fallback می‌کنیم
 * چون داده کهنه از اسپینر بی‌پایان بهتر است. بارگذاری فایل‌های سنگین از این
 * مسیر عبور نمی‌کند (فقط GETهای API).
 */
const SLOW_NETWORK_TIMEOUT_MS = 20_000;

/**
 * offlineInterceptor — اینترسپتور آفلاین با قابلیت Lie-Fi و ادغام کش+صف
 *
 * رفتار:
 * ─── آنلاین ───
 * • GET: ارسال به سرور + ذخیره پاسخ در کش لوکال
 *   (اگر سرور پاسخ نداد → fallback به حالت آفلاین: Lie-Fi)
 * • تغییری: ارسال عادی به سرور
 *   (اگر سرور پاسخ نداد → ذخیره در صف: Lie-Fi)
 *
 * ─── آفلاین ───
 * • GET: خواندن از کش + ادغام با داده‌های جدید در صف
 * • تغییری: ذخیره در صف + پاسخ خوش‌بینانه
 */
export const offlineInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<any> => {
  // فقط درخواست‌های API را مدیریت کن
  if (!req.url.startsWith(environment.apiUrl) && !req.url.startsWith('/api')) {
    return next(req);
  }

  // اگر SKIP_OFFLINE تنظیم شده، رد شو (مثلا login)
  if (req.context.get(SKIP_OFFLINE)) {
    return next(req);
  }

  const network = NetworkStatusService.getInstance();
  const syncService = OfflineSyncService.getInstance();

  // ─── توابع کمکی ───

  /**
   * ادغام داده‌های کش با رکوردهای صف (Merge Cache + Queue)
   * برای نمایش داده‌های جدید آفلاین در لیست‌ها
   */
  const mergeWithQueue = async (cachedData: any, requestUrl: string): Promise<any> => {
    try {
      const queueEntries = await syncService.getQueueEntries();
      if (queueEntries.length === 0) return cachedData;

      // استخراج مسیر پایه از URL (بدون query params)
      const baseUrl = requestUrl.split('?')[0];

      // پیدا کردن رکوردهای صف مرتبط با این endpoint
      const relatedPosts = queueEntries.filter(
        (e) => e.method === 'POST' && e.url.split('?')[0] === baseUrl
      );
      const relatedPatches = queueEntries.filter(
        (e) => (e.method === 'PATCH' || e.method === 'PUT') && e.url.split('?')[0].startsWith(baseUrl)
      );
      const relatedDeletes = queueEntries.filter(
        (e) => e.method === 'DELETE' && e.url.split('?')[0].startsWith(baseUrl)
      );

      // استخراج ID رکوردهای حذف‌شده آفلاین: /api/items/123/ → 123
      const deletedIds = relatedDeletes
        .map((d) => {
          const parts = d.url.split('?')[0].replace(/\/$/, '').split('/');
          return parseInt(parts[parts.length - 1], 10);
        })
        .filter((id) => !isNaN(id));

      if (relatedPosts.length === 0 && relatedPatches.length === 0 && deletedIds.length === 0) return cachedData;

      // ──── ادغام: پاسخ Django REST Framework (ساختار paginated) ────
      let mergedData = JSON.parse(JSON.stringify(cachedData)); // deep clone

      if (mergedData && typeof mergedData === 'object') {
        // اگر پاسخ DRF (دارای results) باشد
        if (Array.isArray(mergedData.results)) {
          // POST — اضافه کردن رکوردهای جدید به ابتدای لیست
          for (const post of relatedPosts) {
            if (post.body && typeof post.body === 'object') {
              mergedData.results.unshift({
                ...post.body,
                _offlineId: post.id,
                _offlinePending: true,
              });
            }
          }

          // PATCH/PUT — به‌روزرسانی رکوردهای موجود
          for (const patch of relatedPatches) {
            // استخراج ID از URL: مثلا /api/items/123/ → 123
            const urlParts = patch.url.replace(/\/$/, '').split('/');
            const recordId = parseInt(urlParts[urlParts.length - 1], 10);

            if (!isNaN(recordId) && patch.body) {
              const index = mergedData.results.findIndex((r: any) => r.id === recordId);
              if (index !== -1) {
                mergedData.results[index] = {
                  ...mergedData.results[index],
                  ...patch.body,
                  _offlinePending: true,
                };
              }
            }
          }

          // DELETE — حذف رکوردهای حذف‌شده آفلاین از لیست
          let removedCount = 0;
          if (deletedIds.length > 0) {
            const before = mergedData.results.length;
            mergedData.results = mergedData.results.filter((r: any) => !deletedIds.includes(r.id));
            removedCount = before - mergedData.results.length;
          }

          // به‌روزرسانی count
          if (typeof mergedData.count === 'number') {
            mergedData.count += relatedPosts.length - removedCount;
          }
        } else if (Array.isArray(mergedData)) {
          // اگر پاسخ مستقیم آرایه باشد (بدون pagination)
          for (const post of relatedPosts) {
            if (post.body && typeof post.body === 'object') {
              mergedData.unshift({
                ...post.body,
                _offlineId: post.id,
                _offlinePending: true,
              });
            }
          }

          for (const patch of relatedPatches) {
            const urlParts = patch.url.replace(/\/$/, '').split('/');
            const recordId = parseInt(urlParts[urlParts.length - 1], 10);
            if (!isNaN(recordId) && patch.body) {
              const index = mergedData.findIndex((r: any) => r.id === recordId);
              if (index !== -1) {
                mergedData[index] = { ...mergedData[index], ...patch.body, _offlinePending: true };
              }
            }
          }

          // DELETE — حذف رکوردهای حذف‌شده آفلاین از آرایه
          if (deletedIds.length > 0) {
            mergedData = mergedData.filter((r: any) => !deletedIds.includes(r.id));
          }
        }
      }

      console.log(`[OfflineInterceptor] 🔀 ادغام: ${relatedPosts.length} POST + ${relatedPatches.length} PATCH/PUT + ${deletedIds.length} DELETE`);
      return mergedData;
    } catch (error) {
      console.error('[OfflineInterceptor] خطا در ادغام:', error);
      return cachedData;
    }
  };

  const handleOfflineGet = (): Observable<any> => {
    const cacheKey = req.urlWithParams;
    return from(syncService.getCachedEntry(cacheKey)).pipe(
      switchMap(async (entry) => {
        if (entry !== null) {
          // ادغام با داده‌های صف
          const merged = await mergeWithQueue(entry.response, req.url);
          console.log(
            `[OfflineInterceptor] 📦 خوانده شد از کش (+ ادغام): ${cacheKey}${entry.isStale ? ' — کهنه' : ''}`
          );
          return new HttpResponse({
            body: merged,
            status: 200,
            statusText: entry.isStale ? 'OK (Offline Cache - Stale)' : 'OK (Offline Cache + Merged)',
            url: req.url,
          });
        }
        // کش خالی — خطای آفلاین (به صورت error پرتاب می‌شود، نه پاسخ موفق)
        console.warn(`[OfflineInterceptor] ⚠️ کش موجود نیست: ${cacheKey}`);
        req.context.set(OFFLINE_NO_CACHE, true);
        throw new HttpErrorResponse({
          error: { detail: 'داده‌ای در حافظه آفلاین یافت نشد. لطفاً ابتدا در حالت آنلاین داده‌ها را بارگذاری کنید.' },
          status: 503,
          statusText: 'Offline - No Cache',
          url: req.url,
        });
      })
    );
  };

  const handleOfflineMutation = (): Observable<any> => {
    // FormData در IndexedDB قابل ذخیره نیست (DataCloneError) و حتی اگر بود،
    // replay با JSON.stringify بدنه را خالی می‌کرد. صف نکن؛ خطای روشن بده
    // تا کاربر بداند فایل نزد خودش مانده و باید بعد از اتصال دوباره تلاش کند.
    if (req.body instanceof FormData) {
      console.warn(`[OfflineInterceptor] 📎 آپلود فایل در حالت آفلاین پشتیبانی نمی‌شود: ${req.method} ${req.url}`);
      req.context.set(OFFLINE_UPLOAD_UNSUPPORTED, true);
      return throwError(
        () =>
          new HttpErrorResponse({
            error: { detail: 'آپلود فایل در حالت آفلاین ممکن نیست. پس از برقراری اتصال دوباره تلاش کنید.' },
            status: 503,
            statusText: 'Offline - Upload Not Supported',
            url: req.url,
          })
      );
    }

    const fullUrl = req.url;
    return from(syncService.enqueue(req.method, fullUrl, req.body)).pipe(
      switchMap((entry) => {
        console.log(`[OfflineInterceptor] 📥 ذخیره در صف آفلاین: ${req.method} ${fullUrl}`);
        // پاسخ خوش‌بینانه (Optimistic Response)
        return of(
          new HttpResponse({
            body: {
              ...(typeof req.body === 'object' && req.body !== null ? req.body : {}),
              _offlineId: entry.id,
              _offlinePending: true,
            },
            status: 200,
            statusText: 'OK (Queued Offline)',
            url: req.url,
          })
        );
      })
    );
  };

  // ─── مسیر اصلی ───
  // نکته: تصمیم بر اساس وضعیت *مرورگر* گرفته می‌شود، نه وضعیت سرور.
  // اگر سرور خاموش باشد (Lie-Fi) همین درخواست خودش probe است و
  // نتیجه‌اش به NetworkStatusService گزارش می‌شود.
  if (network.isBrowserOnline) {
    // ─── حالت آنلاین (با محافظت از Lie-Fi) ───
    //
    // روی اینترنت بسیار کند یک GET ممکن است هرگز نه موفق شود نه رد؛ کاربر فقط
    // اسپینر می‌بیند در حالی که نسخه کش‌شده آماده است. مهلت را به status 0
    // ترجمه می‌کنیم تا catchError پایین‌تر همان مسیر Lie-Fi را برود و از کش بخواند.
    //
    // فقط GET: قطع کردن یک POST/PATCH تضمین نمی‌کند سرور آن را ندیده باشد،
    // و صف‌کردنش باعث ارسال دوباره و رکورد تکراری می‌شود.
    const upstream =
      req.method === 'GET'
        ? next(req).pipe(
            timeout(SLOW_NETWORK_TIMEOUT_MS),
            catchError((error: any) => {
              if (error?.name !== 'TimeoutError') return throwError(() => error);
              console.warn(
                `[OfflineInterceptor] 🐌 شبکه کند — مهلت ${SLOW_NETWORK_TIMEOUT_MS}ms تمام شد: ${req.url}`
              );
              return throwError(
                () =>
                  new HttpErrorResponse({
                    status: 0,
                    statusText: 'Slow Network Timeout',
                    url: req.url,
                  })
              );
            })
          )
        : next(req);

    return upstream.pipe(
      tap((event) => {
        if (event instanceof HttpResponse) {
          // هر پاسخی از سرور یعنی سرور در دسترس است
          network.reportServerReachable();

          // برای GET پاسخ را کش می‌کنیم
          if (req.method === 'GET' && event.ok) {
            const cacheKey = req.urlWithParams;
            syncService.cacheResponse(cacheKey, event.body);
          }
        }
      }),
      catchError((error: HttpErrorResponse) => {
        // اگر به بک‌اند نرسیدیم (Lie-Fi: سرور قطع ولی مرورگر فکر می‌کند آنلاینیم)
        if (isServerUnreachable(error.status)) {
          network.reportServerUnreachable();
          console.warn(
            `[OfflineInterceptor] 🌐 Lie-Fi detected (status ${error.status})! ${req.method} ${req.url}. Falling back to offline.`
          );
          if (req.method === 'GET') {
            return handleOfflineGet();
          } else {
            return handleOfflineMutation();
          }
        }
        // خطای HTTP واقعی (400/403/500 و ...) یعنی سرور پاسخ داده و در دسترس است
        network.reportServerReachable();
        return throwError(() => error);
      })
    );
  }

  // ─── حالت کاملاً آفلاین ───
  if (req.method === 'GET') {
    return handleOfflineGet();
  } else {
    return handleOfflineMutation();
  }
};
