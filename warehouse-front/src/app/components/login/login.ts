import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../shared/components/toast/toast.component';
import { ChangeDetectorRef, OnInit, OnDestroy } from '@angular/core';
import { ConfigApiService } from '../../core/api/config-api.service';
import { OfflineSyncService } from '../../core/services/offline-sync.service';
import { NetworkStatusService, ConnectionState } from '../../core/services/network-status.service';
import { Subscription } from 'rxjs';
import { detectClientDeviceModel } from '../../core/utils/device-detector';
@Component({
  selector: 'app-login',
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login implements OnInit, OnDestroy {
  username = '';
  password = '';
  passwordFieldType = 'password';
  isLoggingIn = false;
  loginErrorMessage: string | null = null;
  showForgotModal = false;

  constructor(
    private auth: AuthService,
    private router: Router,
    private toast: ToastService,
    private cdr: ChangeDetectorRef,
    private configApi: ConfigApiService,
  ) {}

  systemVersion: string = '۱.۰';

  /**
   * وضعیت واقعی اتصال. قبلاً این نشان به‌صورت ثابت «سیستم آنلاین» بود و حتی
   * وقتی تونل Cloudflare خاموش بود (۵۳۰) هم سبز می‌ماند — یعنی درست در لحظه‌ای
   * که کاربر بیشترین نیاز را به دانستن وضعیت داشت، به او دروغ می‌گفت.
   */
  connectionState: ConnectionState = 'online';
  private stateSub?: Subscription;
  private configSub?: Subscription;

  /** متن و رنگ نشان بالای فرم ورود */
  get statusLabel(): string {
    if (this.connectionState === 'offline') return 'آفلاین — اتصال اینترنت قطع است';
    if (this.connectionState === 'server-unreachable') return 'سرور در دسترس نیست';
    return 'سیستم آنلاین';
  }

  get statusIsHealthy(): boolean {
    return this.connectionState === 'online';
  }

  ngOnInit() {
    if (typeof window !== 'undefined' && window.location.hash) {
      const hash = window.location.hash;
      const match = hash.match(/#\/?verify-card(?:\/([^/?#]+))?/);
      if (match) {
        const code = match[1];
        const targetUrl = code ? `/verify-card/${code}` : '/verify-card';
        this.router.navigateByUrl(targetUrl);
        return;
      }
    }

    const network = NetworkStatusService.getInstance();
    this.connectionState = network.state;
    this.stateSub = network.state$.subscribe((state) => {
      this.connectionState = state;
      this.cdr.detectChanges();
    });

    this.configSub = this.configApi.getPublicConfig().subscribe({
      next: (config) => {
        OfflineSyncService.getInstance().applyRemoteConfig(config);
        if (config.system_version) {
          this.systemVersion = config.system_version;
          this.cdr.detectChanges();
        }
      },
      error: (err) => console.error('Failed to load public config', err)
    });
  }

  ngOnDestroy() {
    this.stateSub?.unsubscribe();
    this.configSub?.unsubscribe();
  }

  clearError() {
    if (this.loginErrorMessage) {
      this.loginErrorMessage = null;
    }
  }

  togglePassword() {
    this.passwordFieldType = this.passwordFieldType === 'password' ? 'text' : 'password';
    this.cdr.detectChanges();
  }

  showForgotPasswordDialog(event: Event) {
    event.preventDefault();
    this.showForgotModal = true;
    this.cdr.detectChanges();
  }

  async handleLogin() {
    const trimmedUsername = this.username ? this.username.trim() : '';
    if (!trimmedUsername || !this.password) {
      this.loginErrorMessage = 'لطفاً نام کاربری و رمز عبور را وارد کنید.';
      return;
    }

    this.isLoggingIn = true;
    this.loginErrorMessage = null;

    const deviceModel = await detectClientDeviceModel();

    this.auth.login(trimmedUsername, this.password, deviceModel).subscribe({
      next: () => {
        this.isLoggingIn = false;
        
        const perms = this.auth.userPermissions();
        if (perms.length === 0) {
            this.auth.logout();
            this.loginErrorMessage = 'شما هیچ مجوزی برای دسترسی به پنل ندارید. با مدیر سیستم تماس بگیرید.';
            this.cdr.detectChanges();
            return;
        }

        this.toast.success('ورود موفقیت‌آمیز بود');
        
        let targetRoute = '/dashboard';
        if (perms.includes('admin_all') || perms.includes('view_sys_dashboard')) {
          targetRoute = '/dashboard';
        } else if (perms.includes('view_sys_counter')) {
          targetRoute = '/counter';
        } else if (perms.includes('view_sys_supervisor')) {
          targetRoute = '/supervisor';
        } else if (perms.includes('view_sys_manager_review')) {
          targetRoute = '/manager-review';
        } else if (perms.includes('view_wh_docs')) {
          targetRoute = '/docs';
        } else if (perms.includes('view_wh_dispatch')) {
          targetRoute = '/dispatch';
        } else if (perms.includes('view_wh_dashboard')) {
          targetRoute = '/dashboard';
        }

        this.router.navigate([targetRoute]).then((navigated) => {
          if (!navigated && (this.router.url === '/login' || this.router.url === '/')) {
              this.auth.logout();
              this.loginErrorMessage = 'شما دسترسی ورود به هیچ‌کدام از بخش‌های سامانه را ندارید.';
          }
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.isLoggingIn = false;
        const status = err?.status ?? 0;
        const detail = err?.error?.detail || err?.detail;

        if (status === 0 || status === 530 || (status >= 502 && status <= 504)) {
          this.loginErrorMessage = 'خطا در ارتباط با سرور. لطفاً اتصال اینترنت یا وضعیت سرور را بررسی نمایید.';
        } else if (status === 429) {
          this.loginErrorMessage = detail || 'تعداد تلاش‌های ناموفق شما بیش از حد مجاز است. لطفاً بعداً تلاش کنید.';
        } else if (detail === 'No active account found with the given credentials' || status === 401 || status === 400) {
          this.loginErrorMessage = 'نام کاربری یا رمز عبور اشتباه است.';
        } else {
          this.loginErrorMessage = detail || 'نام کاربری یا رمز عبور نادرست است.';
        }
        this.cdr.detectChanges();
      },
    });
  }
}
