import { Component, OnInit, computed, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { filter } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { AuthStore } from '../../core/stores/auth.store';
import { StateService } from '../../services/state.service';
import { ConfirmDialogService } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { WarehouseHttpService } from '../../core/http/warehouse-http.service';

@Component({
  selector: 'app-layout',
  imports: [CommonModule, RouterOutlet],
  templateUrl: './layout.html',
  styleUrl: './layout.css'
})
export class Layout implements OnInit {

  currentTitle = 'داشبورد مانیتورینگ';
  isUserMenuOpen = false;

  toggleUserMenu() {
    this.isUserMenuOpen = !this.isUserMenuOpen;
    this.cdr.detectChanges();
  }

  closeUserMenu() {
    this.isUserMenuOpen = false;
    this.cdr.detectChanges();
  }

  /** لیست پروژه‌ها از StateService خوانده می‌شود */

  private rawIcons: any = {
    grid:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
    archive:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`,
    badge: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><circle cx="12" cy="11" r="3"></circle><path d="M17 18c0-2.2-2.2-4-5-4s-5 1.8-5 4"></path></svg>`,
    users:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    'file-text':`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
    tag:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`,
    folder:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
    'upload-cloud':`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>`,
    settings:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
    clipboard:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>`,
    printer: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>`,
    'check-circle': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    download: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
    'alert-triangle': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    'check-square': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
    database: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`
  };

  icons: any = {};

  private SYSTEM_NAV_ITEMS: any[] = [
    {id:'dashboard', label:'داشبورد مانیتورینگ کلی', icon:'grid', permission: 'view_sys_dashboard'},
    {id:'users', label:'کاربران و نقش ها', icon:'users', permission: 'view_sys_users'},
    {id:'projects', label:'انبارها', icon:'archive', permission: 'view_sys_projects'},
    {id:'counter', label:'کارتابل انبارگردان', icon:'clipboard', permission: 'view_sys_counter'},
    {id:'customs', label:'کارتابل مالی', icon:'folder', permission: 'view_wh_customs'},
    {id:'supervisor', label:'کارتابل سرپرست', icon:'check-square', permission: 'view_sys_supervisor'},
    {id:'manager-review', label:'بررسی نهایی مدیر', icon:'check-circle', permission: 'view_sys_manager_review'},
    {id:'count-tracking', label:'پیگیری وضعیت شمارش', icon:'activity', permission: 'view_sys_manager_review'},
    {id:'export', label:'صدور فایل برای تغذیه', icon:'download', permission: 'view_sys_export'},
    {id:'settings', label:'تنظیمات سیستم', icon:'settings', permission: 'view_sys_settings'}
  ];

  private WAREHOUSE_NAV_ITEMS: any[] = [
    {id:'dashboard', label:'داشبورد انبار', icon:'grid', permission: 'view_wh_dashboard'},
    {id:'docs', label:'مدیریت کالا', icon:'upload-cloud', permission: 'view_wh_docs'},
    {id:'dispatch', label:'تخصیص کالا', icon:'clipboard', permission: 'view_wh_dispatch'},
    {id:'counter', label:'کارتابل انبارگردان', icon:'clipboard', permission: 'view_sys_counter'},
    {id:'customs', label:'کارتابل مالی', icon:'folder', permission: 'view_wh_customs'},
    {id:'supervisor', label:'کارتابل سرپرست', icon:'check-square', permission: 'view_sys_supervisor'},
    {id:'manager-review', label:'بررسی نهایی مدیر', icon:'check-circle', permission: 'view_sys_manager_review'},
    {id:'count-tracking', label:'پیگیری وضعیت شمارش', icon:'activity', permission: 'view_sys_manager_review'},

    {id:'feeding', label:'مدیریت و تغذیه MT26/49', icon:'database', permission: 'view_wh_feeding'},
    {id:'export', label:'صدور فایل برای تغذیه', icon:'download', permission: 'view_wh_export'},
    {id:'audit', label:'رهگیری تغییرات (Audit Trail)', icon:'file-text', permission: 'view_wh_audit'},
    {id:'wh-settings', label:'تنظیمات انبار', icon:'settings', permission: 'view_wh_settings'}
  ];

  constructor(
    public auth: AuthService,
    public store: AuthStore,
    public state: StateService,
    private confirmDialog: ConfirmDialogService,
    private router: Router,
    private sanitizer: DomSanitizer,
    private whService: WarehouseHttpService,
    private cdr: ChangeDetectorRef
  ) {
    // Sanitize icons
    for (const k in this.rawIcons) {
      this.icons[k] = this.sanitizer.bypassSecurityTrustHtml(this.rawIcons[k]);
    }

    // Track current tab from URL
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd)
    ).subscribe((e) => {
      const tab = e.url.split('/')[1] || 'dashboard';
      this.store.setCurrentTab(tab);
      this.updateTitle(tab);
    });
  }

  ngOnInit() {
    // دریافت لیست انبارها از بک‌اند
    this.whService.getAll().subscribe({
      next: (data) => {
        this.state.appState.projects = data as any;
        
        const storedId = this.store.activeWarehouseId();
        if (data.length > 0 && !storedId) {
          // اگر انباری انتخاب نشده بود، اولین انبار را انتخاب کن
          this.onWarehouseChanged(data[0].id);
        } else if (storedId) {
          // اگر در استور موجود بود (مثلا از localStorage) حتماً سینک کن
          this.state.appState.activeWarehouseId = storedId === 'ALL' ? 'ALL' : Number(storedId);
        }
      }
    });
  }

  /** ──── Sidebar ──── */
  readonly navItems = computed(() => {
    const userPerms = this.auth.userPermissions();
    const isAdmin = userPerms.includes('admin_all');
    
    let items = this.store.isWarehouseContext() ? this.WAREHOUSE_NAV_ITEMS : this.SYSTEM_NAV_ITEMS;
    
    // Filter items based on permissions
    return items.filter(item => {
      if (isAdmin) return true;
      return userPerms.includes(item.permission);
    });
  });
  
  get isSidebarOpen() { return this.store.isSidebarOpen(); }
  get currentTab() { return this.store.currentTab(); }
  get userAvatar() { return this.auth.userAvatar(); }
  get userName() { return this.auth.userName(); }
  get userRole() { return this.auth.userRoleTitles()[0] || ''; }

  openSidebar() { this.store.openSidebar(); }
  closeSidebar() { this.store.closeSidebar(); }

  switchTab(tabId: string) {
    this.closeSidebar();
    this.router.navigate(['/' + tabId]);
  }

  /** ──── Warehouse Selector ──── */
  get warehouseSwitcherValue() { return this.store.activeWarehouseId(); }

  get currentWarehouse() {
    const activeId = this.store.activeWarehouseId();
    return this.state.appState.projects.find((x: any) => x.id === Number(activeId));
  }

  onWarehouseChanged(id: number | string | null): void {
    this.store.setActiveWarehouse(id);
    this.state.appState.activeWarehouseId = id as any;
  }

  exitWarehouseMode(fromSidebarSwitch = false) {
    if (fromSidebarSwitch) {
      this.store.setLastWarehouseTab(this.currentTab);
      this.store.setIsSwitchingWarehouse(true);
    } else {
      this.store.setIsSwitchingWarehouse(false);
    }
    this.store.setWarehouseContext(false);
    this.router.navigate(['/projects']);
  }

  get progressStats() {
    const isWh = this.store.isWarehouseContext();
    const projects = this.state.appState.projects || [];
    
    let total = 0;
    let counted = 0;
    
    if (isWh) {
      const activeId = this.store.activeWarehouseId();
      const current = projects.find((x: any) => x.id === Number(activeId));
      if (current) {
        total = current.total_quantity || 0;
        counted = current.counted_quantity || 0;
      }
    } else {
      total = projects.reduce((sum: number, p: any) => sum + (p.total_quantity || 0), 0);
      counted = projects.reduce((sum: number, p: any) => sum + (p.counted_quantity || 0), 0);
    }
    
    const percent = total > 0 ? Math.round((counted / total) * 100) : 0;
    
    let colorClass = 'bg-indigo-600';
    if (percent === 100) colorClass = 'bg-emerald-500';
    else if (percent > 70) colorClass = 'bg-blue-500';
    else if (percent > 30) colorClass = 'bg-indigo-500';
    else if (percent > 0) colorClass = 'bg-amber-500';
    else colorClass = 'bg-slate-400';
    
    return {
      total,
      counted,
      percent,
      colorClass,
      label: isWh ? 'پیشرفت انبار:' : 'پیشرفت کل پروژه:',
      tooltip: `شمارش شده: ${counted} از ${total} ردیف`
    };
  }

  /** ──── Logout & Settings ──── */
  goToChangePassword() {
    this.closeSidebar();
    this.router.navigate(['/change-password']);
  }

  async logout() {
    const confirmed = await this.confirmDialog.open({
      title: 'خروج از حساب',
      message: 'آیا مطمئنید می‌خواهید از حساب کاربری خارج شوید؟',
      confirmText: 'بله، خروج',
      cancelText: 'انصراف',
      type: 'warning',
    });
    if (confirmed) {
      this.auth.logout();
    }
  }

  /** ──── Private ──── */
  private updateTitle(tab: string) {
    const titles: any = {
      dashboard: 'داشبورد مانیتورینگ',
      projects: 'انبارها',
      dispatch: 'تخصیص کالا',
      users: 'کاربران و نقش‌ها',
      tasks: 'وظایف و اسناد',
      labels: 'لیبل‌زن هوشمند',
      docs: 'انبار',
      'id-cards': 'صدور کارت پرسنلی و گیت‌پاس',
      feeding: 'تغذیه سامانه MT',
      settings: 'تنظیمات',
      counter: 'کارتابل انبارگردان',
      customs: 'کارتابل مالی',
      supervisor: 'کارتابل سرپرست شمارش',
      'manager-review': 'بررسی نهایی رکوردها',
      'label-designer': 'طراحی و کانفیگ لیبل/QR',
      audit: 'رهگیری تغییرات'
    };
    this.currentTitle = titles[tab] || tab;
  }
}
