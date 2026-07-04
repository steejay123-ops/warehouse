import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-change-password',
  imports: [CommonModule, FormsModule],
  templateUrl: './change-password.html'
})
export class ChangePassword implements OnInit {
  oldPassword = '';
  newPassword = '';
  confirmPassword = '';
  passwordFieldType = 'password';
  isSubmitting = false;
  errorMessage = '';
  isMandatory = true;

  constructor(
    private auth: AuthService,
    private router: Router,
    private http: HttpClient
  ) {}

  ngOnInit() {
    const user = this.auth.user();
    if (user) {
      this.isMandatory = !!user.requires_password_change;
    }
  }

  togglePassword() {
    this.passwordFieldType = this.passwordFieldType === 'password' ? 'text' : 'password';
  }

  handleChangePassword() {
    this.errorMessage = '';

    if (!this.oldPassword || !this.newPassword || !this.confirmPassword) {
      this.errorMessage = 'لطفا تمام فیلدها را پر کنید.';
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage = 'رمز عبور جدید و تکرار آن مطابقت ندارند.';
      return;
    }
    
    if (this.newPassword.length < 6) {
      this.errorMessage = 'رمز عبور جدید باید حداقل 6 کاراکتر باشد.';
      return;
    }

    this.isSubmitting = true;

    this.http.post(`${environment.apiUrl}/auth/users/change_password/`, {
      old_password: this.oldPassword,
      new_password: this.newPassword
    }).subscribe({
      next: (res: any) => {
        this.isSubmitting = false;
        // Upon success, we should refresh the token to update requires_password_change in frontend
        // But since we just need to get past the guard, we can either re-login, refresh token,
        // or manually update the local state. Manually updating is easiest.
        const user = this.auth.user();
        if (user) {
          const updatedUser = { ...user, requires_password_change: false };
          // Need to expose a way to update the user in AuthService, or just refresh token.
          // For now, refreshing the token is the safest way to get fresh user data.
          this.auth.refreshToken().subscribe({
            next: () => {
              // Now that token is refreshed, profile should be updated
              // Actually refreshToken just updates access token, we also need profile.
              // Let's just log out and ask them to log in with new password to be 100% safe.
              // Or just navigate to login. Let's do that for simplicity and security.
              this.auth.logout();
              // logout navigates to /login automatically
            },
            error: () => {
              this.auth.logout();
            }
          });
        }
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errorMessage = err.error?.error || 'خطایی رخ داد. لطفا دوباره تلاش کنید.';
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
