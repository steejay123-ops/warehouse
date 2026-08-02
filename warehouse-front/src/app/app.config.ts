import { ApplicationConfig, provideZoneChangeDetection, provideBrowserGlobalErrorListeners, isDevMode, provideAppInitializer } from '@angular/core';
import { provideRouter, RouteReuseStrategy } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { errorInterceptor } from './core/error/error.interceptor';
import { offlineInterceptor } from './core/interceptors/offline.interceptor';
import { CustomRouteReuseStrategy } from './core/strategies/custom-route-reuse-strategy';
import { OfflineSyncService } from './core/services/offline-sync.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([authInterceptor, errorInterceptor, offlineInterceptor])
    ),
    { provide: RouteReuseStrategy, useClass: CustomRouteReuseStrategy },
    provideServiceWorker('ngsw-worker.js', {
      // 'registerWhenStable:30000' یعنی تا پایدار شدن برنامه (حداکثر ۳۰ ثانیه)
      // هیچ چیزی کش نمی‌شود. برای یک PWA انبارگردانی که کاربر بلافاصله پس از
      // نصب ممکن است وارد محیط بدون شبکه شود، این پنجره خطرناک است: اگر در آن
      // فاصله اتصال قطع شود، پوسته برنامه هرگز کش نمی‌شود و دفعه بعد به‌جای
      // حالت آفلاین، صفحه خطای مرورگر بالا می‌آید.
      enabled: !isDevMode(),
      registrationStrategy: 'registerImmediately'
    }),
    provideAppInitializer(() => {
      OfflineSyncService.getInstance().initialize();
      // درخواست ماندگاری storage — بدون آن مرورگر می‌تواند تحت فشار دیسک
      // IndexedDB (صف و دادهٔ آفلاین کاربر) را پاک کند. fire-and-forget.
      navigator.storage?.persist?.().then(
        (granted) => console.log(`[Storage] persist: ${granted ? '✅ ماندگار شد' : '⚠️ رد شد (best-effort)'}`),
        () => {}
      );
    })
  ]
};
