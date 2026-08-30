import { Injectable, OnDestroy } from '@angular/core';
import { Subject, BehaviorSubject } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { ToastService } from '../../shared';

@Injectable({
  providedIn: 'root'
})
export class WebSocketService implements OnDestroy {
  private ws: WebSocket | null = null;
  public notifications$ = new Subject<any>();
  public connected$ = new BehaviorSubject<boolean>(false);

  // شناسه یکتای تب مرورگر جهت جلوگیری از اکو روی همان تب بدون بلاک کردن سایر دستگاه‌های کاربر
  public readonly tabId: string = 'tab_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();

  private isExplicitlyClosed = false;
  private reconnectTimeout: any = null;
  private reconnectAttempts = 0;
  private pingInterval: any = null;
  private isDestroyed = false;

  // تنظیمات پایداری
  private readonly baseDelay = 1000;
  private readonly maxDelay = 20000;
  private readonly pingTimeMs = 30000;

  constructor(private auth: AuthService, private toast: ToastService) {
    this.setupBrowserLifecycleListeners();
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    this.cleanupListeners();
    this.disconnect();
  }

  private setupBrowserLifecycleListeners(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', this.onNetworkOnline);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  private cleanupListeners(): void {
    if (typeof window === 'undefined') return;

    window.removeEventListener('online', this.onNetworkOnline);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }

  private onNetworkOnline = (): void => {
    if (this.isExplicitlyClosed || this.isDestroyed) return;
    console.log('[WebSocket] 🌐 شبکه وصل شد — تلاش برای اتصال مجدد آنی...');
    this.reconnectAttempts = 0;
    this.clearReconnectTimeout();
    this.connect();
  };

  private onVisibilityChange = (): void => {
    if (this.isExplicitlyClosed || this.isDestroyed) return;
    if (document.visibilityState === 'visible') {
      if (!this.ws || this.ws.readyState === WebSocket.CLOSED || this.ws.readyState === WebSocket.CLOSING) {
        console.log('[WebSocket] 👁️ بازگشت به تب فعال — بازسازی اتصال سوکت...');
        this.clearReconnectTimeout();
        this.connect();
      }
    }
  };

  connect(): void {
    if (this.isDestroyed) return;
    this.isExplicitlyClosed = false;

    // اگر اتصال در حال باز شدن یا باز است، نیازی به اتصال مجدد نیست
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.clearReconnectTimeout();
    this.stopPing();

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const url = `${protocol}//${host}/ws/notifications/`;

      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('[WebSocket] ⚡ اتصال با موفقیت برقرار شد.');
        this.connected$.next(true);
        this.reconnectAttempts = 0;
        this.startPing();
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);

          // بسته‌های Pong مربوط به Heartbeat هستند
          if (data.type === 'pong') {
            return;
          }

          this.notifications$.next(data);

          // نمایش اعلان‌های سیستم در Toast (به جز رویدادهای بی‌صدای پس‌زمینه)
          const silentTypes = ['count_task_update', 'doc_task_update', 'pong', 'ping'];
          if (data.message && data.type && !silentTypes.includes(data.type)) {
            this.toast.show(data.type, data.message);
          }
        } catch (e) {
          console.error('[WebSocket] خطا در پارس پیام دریافتی:', e);
        }
      };

      this.ws.onerror = (err) => {
        console.warn('[WebSocket] خطای اتصال سوکت:', err);
      };

      this.ws.onclose = (event) => {
        this.connected$.next(false);
        this.stopPing();
        this.ws = null;

        if (!this.isExplicitlyClosed && !this.isDestroyed) {
          this.scheduleReconnect();
        } else {
          console.log('[WebSocket] ارتباط به صورت صریح بسته شد.');
        }
      };
    } catch (err) {
      console.error('[WebSocket] خطا در راه‌اندازی سوکت:', err);
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    this.isExplicitlyClosed = true;
    this.clearReconnectTimeout();
    this.stopPing();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected$.next(false);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout || this.isExplicitlyClosed || this.isDestroyed) return;

    // الگوریتم Exponential Backoff با شروع از 1 ثانیه تا سقف 20 ثانیه همراه با Jitter
    const delay = Math.min(
      this.maxDelay,
      this.baseDelay * Math.pow(1.5, this.reconnectAttempts)
    ) + Math.random() * 800;

    this.reconnectAttempts++;
    console.log(`[WebSocket] تلاش مجدد اتصال شماره ${this.reconnectAttempts} در ${Math.round(delay)} میلی‌ثانیه دیگر...`);

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, delay);
  }

  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  private startPing(): void {
    this.stopPing();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
        } catch (e) {
          console.warn('[WebSocket] خطا در ارسال پکت Ping:', e);
        }
      }
    }, this.pingTimeMs);
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}
