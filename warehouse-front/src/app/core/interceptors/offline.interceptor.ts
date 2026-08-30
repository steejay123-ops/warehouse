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

  // ─── مدیریت GET با الگوی Stale-While-Revalidate (SWR) ───
  const handleGetSWR = (): Observable<any> => {
    const cacheKey = req.urlWithParams;

    return from(syncService.getCachedEntry(cacheKey)).pipe(
      switchMap((entry) => {
        // ۱. اگر داده در کش محلی IndexedDB موجود باشد (تحویل فوری ۰ میلی‌ثانیه):
        if (entry !== null) {
          return from(mergeWithQueue(entry.response, req.url)).pipe(
            switchMap((merged) => {
              console.log(
                `[OfflineInterceptor] ⚡ تحویل آنی SWR از کش محلی (0ms): ${cacheKey}${entry.isStale ? ' (Stale)' : ''}`
              );

              // استعلام آرام و نامحسوس در پس‌زمینه (Background Revalidation)
              if (network.isBrowserOnline) {
                next(req)
                  .pipe(
                    timeout(10_000),
                    catchError((err) => {
                      if (err?.status && isServerUnreachable(err.status)) {
                        network.reportServerUnreachable();
                      }
                      console.log(
                        `[OfflineInterceptor] 🤫 استعلام پس‌زمینه بدون مزاحمت گذشت (سرور غیرقابل‌دسترس/آفلاین): ${req.url}`
                      );
                      return of(null);
                    })
                  )
                  .subscribe(async (event) => {
                    if (event instanceof HttpResponse && event.ok) {
                      network.reportServerReachable();
                      // به‌روزرسانی کش IndexedDB
                      await syncService.cacheResponse(cacheKey, event.body);
                      // ادغام با رکوردهای صف آفلاین
                      const freshMerged = await mergeWithQueue(event.body, req.url);
                      // اطلاع‌رسانی به کل برنامه جهت به‌روزرسانی زنده و هایلایت انیمیشنی
                      syncService.notifyDataUpdated(req.urlWithParams || req.url, freshMerged);
                      console.log(`[OfflineInterceptor] 🔄 داده‌های جدید پس‌زمینه دریافت و منتشر شد: ${req.urlWithParams || req.url}`);
                    }
                  });
              }

              return of(
                new HttpResponse({
                  body: merged,
                  status: 200,
                  statusText: entry.isStale ? 'OK (Offline SWR Cache - Stale)' : 'OK (Offline SWR Cache + Merged)',
                  url: req.url,
                })
              );
            })
          );
        }

        // ۲. اگر در کش داده‌ای نباشد (بازدید اول):
        if (network.isBrowserOnline) {
          return next(req).pipe(
            timeout(10_000),
            tap((event) => {
              if (event instanceof HttpResponse && event.ok) {
                network.reportServerReachable();
                syncService.cacheResponse(cacheKey, event.body);
              }
            }),
            catchError((error: HttpErrorResponse) => {
              if (isServerUnreachable(error.status)) {
                network.reportServerUnreachable();
                console.warn(`[OfflineInterceptor] ⚠️ سرور در دسترس نیست و کش اولیه خالی است: ${req.url}`);
                req.context.set(OFFLINE_NO_CACHE, true);
                return throwError(
                  () =>
                    new HttpErrorResponse({
                      error: {
                        detail:
                          'ارتباط با سرور برقرار نشد و داده‌ای در حافظه آفلاین موجود نیست. لطفاً اتصال شبکه را بررسی نمایید.',
                      },
                      status: 503,
                      statusText: 'Offline - No Cache',
                      url: req.url,
                    })
                );
              }
              network.reportServerReachable();
              return throwError(() => error);
            })
          );
        }

        // ۳. حالت کاملاً آفلاین و بدون کش قبلی
        console.warn(`[OfflineInterceptor] ⚠️ آفلاین کامل و کش موجود نیست: ${cacheKey}`);
        req.context.set(OFFLINE_NO_CACHE, true);
        return throwError(
          () =>
            new HttpErrorResponse({
              error: { detail: 'دستگاه در حالت آفلاین است و داده‌ای در حافظه محلی ذخیره نشده است.' },
              status: 503,
              statusText: 'Offline - No Cache',
              url: req.url,
            })
        );
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
  if (req.method === 'GET') {
    return handleGetSWR();
  }

  // ─── متدهای تغییری (POST / PUT / PATCH / DELETE) ───
  if (network.isBrowserOnline) {
    return next(req).pipe(
      tap((event) => {
        if (event instanceof HttpResponse && event.status >= 200 && event.status < 300) {
          network.reportServerReachable();
          try {
            const rawUrl = req.url.split('?')[0];
            const cleanUrl = rawUrl.replace(/\/+$/, '');
            const lastSlash = cleanUrl.lastIndexOf('/');
            if (lastSlash > 0) {
              const parentUrl = cleanUrl.substring(0, lastSlash);
              syncService.invalidateCache(parentUrl);
            }
            syncService.invalidateCache(cleanUrl);
          } catch (e) {
            console.warn('[OfflineInterceptor] Error invalidating cache on mutation:', e);
          }
        }
      }),
      catchError((error: HttpErrorResponse) => {
        if (isServerUnreachable(error.status)) {
          network.reportServerUnreachable();
          console.warn(
            `[OfflineInterceptor] 🌐 خطای اتصال در متد تغییری (${error.status})! ذخیره در صف آفلاین: ${req.method} ${req.url}`
          );
          return handleOfflineMutation();
        }
        network.reportServerReachable();
        return throwError(() => error);
      })
    );
  }

  return handleOfflineMutation();
};
