import { Component, signal, effect, inject, ApplicationRef } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { ToastContainerComponent } from './shared/components/toast/toast.component';
import { ConfirmDialogComponent, ConfirmDialogService } from './shared/components/confirm-dialog/confirm-dialog.component';
import { AuthService } from './core/auth/auth.service';
import { WebSocketService } from './core/http/websocket.service';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { interval, concat, fromEvent } from 'rxjs';
import { first, filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastContainerComponent, ConfirmDialogComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('warehouse-app');
  private router = inject(Router);
  private auth = inject(AuthService);
  private ws = inject(WebSocketService);
  private swUpdate = inject(SwUpdate);
  private confirmDialog = inject(ConfirmDialogService);
  private appRef = inject(ApplicationRef);

  constructor() {
    // پشتیبانی از لینک‌های دارای هش استعلام
    if (typeof window !== 'undefined' && window.location.hash) {
      const hash = window.location.hash;
      const match = hash.match(/#\/?verify-card(?:\/([^/?#]+))?/);
      if (match) {
        const code = match[1];
        const targetUrl = code ? `/verify-card/${code}` : '/verify-card';
        this.router.navigateByUrl(targetUrl);
      }
    }

    effect(() => {
      if (this.auth.isLoggedIn()) {
        this.ws.connect();
        this.auth.sendDailyHeartbeat();
      } else {
        this.ws.disconnect();
      }
    });

    this.setupPwaUpdate();
  }

  private setupPwaUpdate() {
    if (!this.swUpdate.isEnabled) return;

    // Listen to the version ready event to prompt the user
    this.swUpdate.versionUpdates
      .pipe(filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY'))
      .subscribe(async (evt) => {
        const confirmed = await this.confirmDialog.open({
          title: 'بروزرسانی برنامه',
          message: 'نسخه جدیدی از برنامه دریافت شده است. آیا می‌خواهید برای اعمال تغییرات، برنامه را هم‌اکنون بروزرسانی کنید؟',
          confirmText: 'بروزرسانی',
          type: 'info'
        });

        if (confirmed) {
          await this.swUpdate.activateUpdate();
          document.location.reload();
        }
      });

    // Check for updates every 1 hour (3600000 ms) after the app is stable
    const appIsStable$ = this.appRef.isStable.pipe(first(isStable => isStable === true));
    const everyHour$ = interval(60 * 60 * 1000);
    const everyHourOnceAppIsStable$ = concat(appIsStable$, everyHour$);

    everyHourOnceAppIsStable$.subscribe(async () => {
      try {
        await this.swUpdate.checkForUpdate();
      } catch (err) {
        console.error('Failed to check for updates', err);
      }
    });

    // Check for updates when the browser comes online
    if (typeof window !== 'undefined') {
      fromEvent(window, 'online').subscribe(async () => {
        try {
          await this.swUpdate.checkForUpdate();
        } catch (err) {
          console.error('Failed to check for updates on online event', err);
        }
      });
    }
  }
}
