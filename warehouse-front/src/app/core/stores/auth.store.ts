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
  private readonly _activeWarehouseId = signal<number | string>('ALL');
  
  /** تب فعلی sidebar */
  private readonly _currentTab = signal<string>('dashboard');
  
  /** وضعیت sidebar موبایل */
  private readonly _isSidebarOpen = signal(false);

  // ── Computed ──
  readonly activeWarehouseId = this._activeWarehouseId.asReadonly();
  readonly currentTab = this._currentTab.asReadonly();
  readonly isSidebarOpen = this._isSidebarOpen.asReadonly();
  readonly isAllWarehouses = computed(() => this._activeWarehouseId() === 'ALL');

  // ── Actions ──
  setActiveWarehouse(id: number | string): void {
    this._activeWarehouseId.set(id);
  }

  setCurrentTab(tab: string): void {
    this._currentTab.set(tab);
  }

  openSidebar(): void {
    this._isSidebarOpen.set(true);
  }

  closeSidebar(): void {
    this._isSidebarOpen.set(false);
  }

  toggleSidebar(): void {
    this._isSidebarOpen.update((v) => !v);
  }
}
