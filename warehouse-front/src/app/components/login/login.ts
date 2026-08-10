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
    const network = NetworkStatusService.getInstance();
    this.connectionState = network.state;
    this.stateSub = network.state$.subscribe((state) => {
      this.connectionState = state;
      this.cdr.detectChanges();
    });

    this.configApi.getPublicConfig().subscribe({
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

  handleLogin() {
    this.isLoggingIn = true;
    this.loginErrorMessage = null;

    this.auth.login(this.username, this.password).subscribe({
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
        this.router.navigate(['/dashboard']).then(() => {
          if (this.router.url === '/login' || this.router.url === '/') {
              this.auth.logout();
              this.loginErrorMessage = 'شما دسترسی ورود به هیچ‌کدام از بخش‌های سامانه را ندارید.';
          }
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.isLoggingIn = false;
        const detail = err?.error?.detail || err?.detail;
        if (detail === 'No active account found with the given credentials') {
          this.loginErrorMessage = 'نام کاربری یا رمز عبور اشتباه است.';
        } else {
          this.loginErrorMessage = detail || 'نام کاربری یا رمز عبور نادرست است.';
        }
        this.cdr.detectChanges();
      },
    });
  }
}
