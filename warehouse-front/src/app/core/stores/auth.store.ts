import { Injectable, signal, computed } from '@angular/core';

/**
 * Auth Store — حالت مرکزی احراز هویت با Angular Signals
 * 
 * این store وضعیت UI مربوط به auth را نگه می‌دارد.
 * دیتای اصلی auth در AuthService مدیریت می‌شود.
 * 
 * مثال استفاده:
 *   readonly store = inject(AuthStore);
 *   // در template: {{ store.activeWarehouseId() }}
 */
@Injectable({ providedIn: 'root' })
export class AuthStore {
  /** ID انبار فعال — 'ALL' برای نمایش تجمیعی */
  private readonly _activeWarehouseId = signal<number | string | null>(
    localStorage.getItem('wh_active_id') || null
  );
  
  /** تب فعلی sidebar */
  private readonly _currentTab = signal<string>('dashboard');
  
  /** وضعیت sidebar موبایل */
  private readonly _isSidebarOpen = signal(false);

  /** آیا کاربر در محیط (Context) یک انبار خاص قرار دارد؟ */
  private readonly _isWarehouseContext = signal<boolean>(
    localStorage.getItem('wh_context') === 'true'
  );

  /** آخرین تب استفاده شده برای بازگشت هوشمند */
  private readonly _lastWarehouseTab = signal<string>(
    localStorage.getItem('wh_last_tab') || 'dashboard'
  );
  
  /** آیا در حال جابجایی بین انبارها از طریق سایدبار هستیم؟ */
  private readonly _isSwitchingWarehouse = signal<boolean>(false);

  // ── Computed ──
  readonly activeWarehouseId = this._activeWarehouseId.asReadonly();
  readonly currentTab = this._currentTab.asReadonly();
  readonly isSidebarOpen = this._isSidebarOpen.asReadonly();
  readonly isWarehouseContext = this._isWarehouseContext.asReadonly();
  readonly lastWarehouseTab = this._lastWarehouseTab.asReadonly();
  readonly isSwitchingWarehouse = this._isSwitchingWarehouse.asReadonly();
  readonly isAllWarehouses = computed(() => this._activeWarehouseId() === 'ALL');

  // ── Actions ──
  setActiveWarehouse(id: number | string | null): void {
    this._activeWarehouseId.set(id);
    if (id) {
      localStorage.setItem('wh_active_id', id.toString());
    } else {
      localStorage.removeItem('wh_active_id');
    }
  }

  setCurrentTab(tab: string): void {
    this._currentTab.set(tab);
  }

  setWarehouseContext(isContext: boolean): void {
    this._isWarehouseContext.set(isContext);
    localStorage.setItem('wh_context', isContext ? 'true' : 'false');
  }

  openSidebar(): void {
    this._isSidebarOpen.set(true);
  }

  closeSidebar(): void {
    this._isSidebarOpen.set(false);
  }

  setLastWarehouseTab(tab: string): void {
    this._lastWarehouseTab.set(tab);
    localStorage.setItem('wh_last_tab', tab);
  }

  setIsSwitchingWarehouse(isSwitching: boolean): void {
    this._isSwitchingWarehouse.set(isSwitching);
  }

  toggleSidebar(): void {
    this._isSidebarOpen.update((v) => !v);
  }
}
