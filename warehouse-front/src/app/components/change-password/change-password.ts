import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ToastService } from '../../shared/components/toast/toast.component';

@Component({
  selector: 'app-change-password',
  imports: [CommonModule, FormsModule],
  templateUrl: './change-password.html'
})
export class ChangePassword implements OnInit {
  oldPassword = '';
  newPassword = '';
  confirmPassword = '';
  oldPasswordFieldType = 'password';
  newPasswordFieldType = 'password';
  confirmPasswordFieldType = 'password';
  isSubmitting = false;
  errorMessage = '';
  isMandatory = true;

  constructor(
    private auth: AuthService,
    private router: Router,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private toast: ToastService
  ) {}

  ngOnInit() {
    const user = this.auth.user();
    if (user) {
      this.isMandatory = !!user.requires_password_change;
    }
  }

  toggleOldPassword() {
    this.oldPasswordFieldType = this.oldPasswordFieldType === 'password' ? 'text' : 'password';
    this.cdr.detectChanges();
  }

  toggleNewPassword() {
    this.newPasswordFieldType = this.newPasswordFieldType === 'password' ? 'text' : 'password';
    this.cdr.detectChanges();
  }

  toggleConfirmPassword() {
    this.confirmPasswordFieldType = this.confirmPasswordFieldType === 'password' ? 'text' : 'password';
    this.cdr.detectChanges();
  }

  handleChangePassword() {
    this.errorMessage = '';

    if (!this.oldPassword || !this.newPassword || !this.confirmPassword) {
      this.errorMessage = 'لطفا تمام فیلدها را پر کنید.';
      this.cdr.detectChanges();
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage = 'رمز عبور جدید و تکرار آن مطابقت ندارند.';
      this.cdr.detectChanges();
      return;
    }
    
    if (this.newPassword.length < 6) {
      this.errorMessage = 'رمز عبور جدید باید حداقل 6 کاراکتر باشد.';
      this.cdr.detectChanges();
      return;
    }

    if (this.newPassword === '123456') {
      this.errorMessage = 'استفاده از رمز عبور پیش‌فرض (123456) مجاز نیست.';
      this.cdr.detectChanges();
      return;
    }

    this.isSubmitting = true;
    this.cdr.detectChanges();

    this.http.post(`${environment.apiUrl}/auth/users/change_password/`, {
      old_password: this.oldPassword,
      new_password: this.newPassword
    }).subscribe({
      next: (res: any) => {
        this.isSubmitting = false;
        this.cdr.detectChanges();
        this.toast.success('رمز عبور با موفقیت تغییر پیدا کرد.');
        
        setTimeout(() => {
          const user = this.auth.user();
          if (user) {
            const updatedUser = { ...user, requires_password_change: false };
            this.auth.refreshToken().subscribe({
              next: () => {
                this.auth.logout();
              },
              error: () => {
                this.auth.logout();
              }
            });
          }
        }, 1500);
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errorMessage = err.error?.error || 'خطایی رخ داد. لطفا دوباره تلاش کنید.';
        this.cdr.detectChanges();
      }
    });
  }

  logout() {
    this.auth.logout();
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }
}
