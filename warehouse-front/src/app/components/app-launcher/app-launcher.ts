import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { AppPersonaService } from '../../core/services/app-persona.service';
import { AuthStore } from '../../core/stores/auth.store';

@Component({
  selector: 'app-launcher',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app-launcher.html'
})
export class AppLauncherComponent {
  public auth = inject(AuthService);
  public persona = inject(AppPersonaService);
  private router = inject(Router);
  private store = inject(AuthStore);

  get userName(): string {
    return this.auth.userName() || this.auth.user()?.username || 'کاربر گرامی';
  }

  get userRoleTitles(): string[] {
    return this.auth.userRoleTitles();
  }

  get isSuperuser(): boolean {
    return this.persona.isSuperuser();
  }

  get hasWarehouse(): boolean {
    return this.persona.hasWarehouseAccess();
  }

  get hasFinance(): boolean {
    return this.persona.hasPersonnelAccess();
  }

  enterWarehouse(): void {
    if (!this.hasWarehouse) return;
    this.persona.activeApp.set('warehouse');
    localStorage.setItem('active_app_module', 'warehouse');
    this.store.setWarehouseContext(false);
    this.router.navigate(['/app/warehouse/dashboard']);
  }

  enterFinance(): void {
    if (!this.hasFinance) return;
    this.persona.activeApp.set('personnel');
    localStorage.setItem('active_app_module', 'personnel');
    this.store.setWarehouseContext(false);

    const perms = this.auth.userPermissions() || [];
    if (perms.includes('perm_approve_personnel_finance') || perms.includes('view_sys_payroll')) {
      this.router.navigate(['/app/finance/finance-cartable']);
    } else if (perms.includes('view_sys_treasury') || perms.includes('perm_treasury_disburse_action')) {
      this.router.navigate(['/app/finance/treasury-cartable']);
    } else if (perms.includes('perm_approve_personnel_manager')) {
      this.router.navigate(['/app/finance/manager-approvals']);
    } else {
      this.router.navigate(['/app/finance/attendance']);
    }
  }

  logout(): void {
    this.auth.logout();
  }
}
