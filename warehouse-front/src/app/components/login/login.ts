import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../shared/components/toast/toast.component';
import { ChangeDetectorRef, OnInit } from '@angular/core';
import { ConfigApiService } from '../../core/api/config-api.service';
@Component({
  selector: 'app-login',
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login implements OnInit {
  username = '';
  password = '';
  passwordFieldType = 'password';
  rememberMe = false;
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

  ngOnInit() {
    this.configApi.getPublicConfig().subscribe({
      next: (config) => {
        if (config.system_version) {
          this.systemVersion = config.system_version;
          this.cdr.detectChanges();
        }
      },
      error: (err) => console.error('Failed to load public config', err)
    });
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

    this.auth.login(this.username, this.password, this.rememberMe).subscribe({
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
