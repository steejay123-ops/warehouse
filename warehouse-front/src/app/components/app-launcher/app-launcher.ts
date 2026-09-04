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
    this.store.setWarehouseContext(false);
    this.persona.switchApp('warehouse');
  }

  enterFinance(): void {
    if (!this.hasFinance) return;
    this.store.setWarehouseContext(false);
    this.persona.switchApp('personnel');
  }

  logout(): void {
    this.auth.logout();
  }
}
