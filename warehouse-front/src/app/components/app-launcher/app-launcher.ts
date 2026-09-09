import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { AppPersonaService } from '../../core/services/app-persona.service';
import { AuthStore } from '../../core/stores/auth.store';
import { ModuleRegistryService, FrontendModuleSpec } from '../../core/modules/module-registry.service';

export interface AppLauncherCard {
  code: string;
  title: string;
  routePrefix: string;
  icon: string;
  description: string;
  hasAccess: boolean;
  tags: string[];
  themeColor: 'indigo' | 'emerald' | 'cyan';
}

@Component({
  selector: 'app-launcher',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app-launcher.html'
})
export class AppLauncherComponent {
  public auth = inject(AuthService);
  public persona = inject(AppPersonaService);
  private moduleRegistry = inject(ModuleRegistryService);
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

  /**
   * ساخت پویا و ماژولار کارت‌های برنامه‌ها بر پایه رجیستری — فاز ۶ (تسک ۵۷)
   */
  public appCards = computed<AppLauncherCard[]>(() => {
    const installed = this.moduleRegistry.getInstalledSpecs();
    return installed.map(spec => {
      const isOps = spec.code === 'operations';
      const isAcct = spec.code === 'accounting';
      const appKey = isAcct ? 'personnel' : spec.code;
      const hasAccess = this.persona.canAccessApp(appKey);

      let themeColor: 'indigo' | 'emerald' | 'cyan' = 'indigo';
      let tags: string[] = ['کارتابل', 'مدیریت'];

      if (isOps) {
        themeColor = 'cyan';
        tags = ['اسنپ‌شات‌ها', 'پایش سلامت', 'امنیت'];
      } else if (isAcct) {
        themeColor = 'emerald';
        tags = ['کارتابل مالی', 'ثبت کارکرد', 'خزانه‌داری'];
      } else {
        themeColor = 'indigo';
        tags = ['کارتابل انبارگردان', 'مدیریت کالا'];
      }

      return {
        code: appKey,
        title: spec.titleFa,
        routePrefix: spec.routePrefix,
        icon: spec.icon,
        description: spec.descriptionFa,
        hasAccess,
        tags,
        themeColor
      };
    }).filter(card => {
      // عملیات فقط برای سوپریوزر نمایش داده می‌شود
      if (card.code === 'operations' && !this.persona.isSuperuser()) return false;
      return true;
    });
  });

  enterApp(code: string): void {
    if (!this.persona.canAccessApp(code)) return;
    this.store.setWarehouseContext(false);
    this.persona.switchApp(code);
  }

  // سازگاری رو به عقب (Backward-compatibility)
  get hasWarehouse(): boolean {
    return this.persona.hasWarehouseAccess();
  }

  get hasFinance(): boolean {
    return this.persona.hasPersonnelAccess();
  }

  get hasOperations(): boolean {
    return this.persona.hasOperationsAccess();
  }

  enterWarehouse(): void {
    this.enterApp('warehouse');
  }

  enterFinance(): void {
    this.enterApp('personnel');
  }

  enterOperations(): void {
    this.enterApp('operations');
  }

  logout(): void {
    this.auth.logout();
  }
}
