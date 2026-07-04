import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../shared/components/toast/toast.component';
import { ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'app-login',
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {
  username = '';
  password = '';
  passwordFieldType = 'password';
  isLoggingIn = false;
  loginError = false;

  constructor(
    private auth: AuthService,
    private router: Router,
    private toast: ToastService,
    private cdr: ChangeDetectorRef,
  ) {}

  togglePassword() {
    this.passwordFieldType = this.passwordFieldType === 'password' ? 'text' : 'password';
  }

  handleLogin() {
    this.isLoggingIn = true;
    this.loginError = false;

    this.auth.login(this.username, this.password).subscribe({
      next: () => {
        this.isLoggingIn = false;
        this.toast.success('ورود موفقیت‌آمیز بود');
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.isLoggingIn = false;
        this.loginError = true;
        this.toast.error(err?.error?.detail || err?.detail || 'نام کاربری یا رمز عبور نادرست است.');
        this.cdr.detectChanges();
      },
    });
  }
}
