import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Users } from './users';
import { of, Subject } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { StateService } from '../../services/state.service';
import { ToastService } from '../../services/toast.service';
import { AuthService } from '../../core/auth/auth.service';
import { AppPersonaService } from '../../core/services/app-persona.service';
import { ModuleRegistryService } from '../../core/modules/module-registry.service';
import { AccountsHttpService } from '../../core/http/accounts-http.service';
import { WarehouseHttpService } from '../../core/http/warehouse-http.service';
import { ConfirmDialogService } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { By } from '@angular/platform-browser';

describe('Users & Roles Management Comprehensive Tests (Tab 1: Users & Tab 2: Roles)', () => {
  let component: Users;
  let fixture: ComponentFixture<Users>;

  // Mock Data
  const mockPermissions = [
    { id: 1, name: 'مشاهده داشبورد انبار', codename: 'view_wh_dashboard', content_type: 1 },
    { id: 2, name: 'مشاهده پرسنل', codename: 'view_sys_personnel', content_type: 1 },
    { id: 3, name: 'مشاهده کاربران', codename: 'view_sys_users', content_type: 1 },
    { id: 4, name: 'حذف دائمی سیستم', codename: 'perm_sys_hard_delete', content_type: 1, is_sensitive: true },
  ];

  const mockRoles = [
    { id: 10, name: 'admin', title: 'مدیر ارشد', color: '#4f46e5', permissions: [1, 2, 3], user_ids: [1], parent: null, children: [] },
    { id: 11, name: 'supervisor', title: 'سرپرست انبار', color: '#059669', permissions: [1], user_ids: [2], parent: 10, children: [] },
  ];

  const mockUsers = [
    {
      id: 1,
      username: 'admin_user',
      first_name: 'مدیر',
      last_name: 'سیستم',
      national_code: '0011223344',
      phone_number: '09120000001',
      email: 'admin@test.com',
      is_active: true,
      is_superuser: true,
      groups: [10],
      assigned_warehouses: [101],
      blood_type: 'O+',
      emergency_contact: '09129999999',
      company: 'مرکزی',
      operational_zone: 'منطقه ۱',
      avatar: null,
      supervisor: null
    },
    {
      id: 2,
      username: 'worker_user',
      first_name: 'کارگر',
      last_name: 'انبار',
      national_code: '0011223345',
      phone_number: '09120000002',
      email: 'worker@test.com',
      is_active: false,
      is_superuser: false,
      groups: [11],
      assigned_warehouses: [],
      blood_type: 'A+',
      emergency_contact: '09128888888',
      company: 'پیمانکار',
      operational_zone: 'منطقه ۲',
      avatar: null,
      supervisor: 1
    }
  ];

  const mockWarehouses = [
    { id: 101, name: 'انبار مرکزی شماره ۱', code: 'WH-01' },
    { id: 102, name: 'انبار قطعات یدکی', code: 'WH-02' }
  ];

  let mockAccountsHttp: any;
  let mockWarehouseHttp: any;
  let mockToast: any;
  let mockAuth: any;
  let mockPersona: any;
  let mockRegistry: any;
  let mockConfirmDialog: any;
  let mockRouter: any;
  let queryParamsSubject: Subject<any>;

  beforeEach(async () => {
    queryParamsSubject = new Subject();

    mockAccountsHttp = {
      getPermissions: vi.fn().mockReturnValue(of(mockPermissions)),
      getRoles: vi.fn().mockReturnValue(of(mockRoles)),
      getUsers: vi.fn().mockReturnValue(of(mockUsers)),
      createUser: vi.fn().mockImplementation((u) => of({ ...u, id: 99 })),
      updateUser: vi.fn().mockImplementation((id, u) => of({ ...u, id })),
      createRole: vi.fn().mockImplementation((r) => of({ ...r, id: 88 })),
      updateRole: vi.fn().mockImplementation((id, r) => of({ ...r, id })),
      deleteUser: vi.fn().mockReturnValue(of({ success: true })),
      deleteRole: vi.fn().mockReturnValue(of({ success: true })),
      toggleUserStatus: vi.fn().mockReturnValue(of({ success: true })),
      adminResetPassword: vi.fn().mockReturnValue(of({ success: true, message: 'رمز ریست شد' })),
      exportUsersExcel: vi.fn().mockReturnValue(of(new Blob(['users-excel']))),
      exportRolesExcel: vi.fn().mockReturnValue(of(new Blob(['roles-excel']))),
      downloadUsersTemplate: vi.fn().mockReturnValue(of(new Blob(['template-users']))),
      downloadRolesTemplate: vi.fn().mockReturnValue(of(new Blob(['template-roles']))),
      uploadUserAvatar: vi.fn().mockReturnValue(of({ success: true, avatar: '/media/avatar.webp' })),
    };

    mockWarehouseHttp = {
      getAll: vi.fn().mockReturnValue(of(mockWarehouses)),
      getWarehouses: vi.fn().mockReturnValue(of(mockWarehouses))
    };

    mockToast = {
      show: vi.fn()
    };

    mockAuth = {
      hasPermission: vi.fn().mockReturnValue(true),
      isSuperUser: vi.fn().mockReturnValue(true),
      user: vi.fn().mockReturnValue(mockUsers[0]),
      currentUser: vi.fn().mockReturnValue(mockUsers[0]),
      updateUserAvatar: vi.fn()
    };

    mockPersona = {
      canPerform: vi.fn().mockReturnValue(true),
      isCurrentActive: vi.fn().mockReturnValue(true)
    };

    mockRegistry = {
      isModuleActive: vi.fn().mockReturnValue(true),
      isModuleInstalled: vi.fn().mockReturnValue(true),
      permissionMarkers: vi.fn().mockReturnValue([])
    };

    mockConfirmDialog = {
      open: vi.fn().mockResolvedValue(true)
    };

    mockRouter = {
      navigate: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [Users],
      providers: [
        StateService,
        { provide: AccountsHttpService, useValue: mockAccountsHttp },
        { provide: WarehouseHttpService, useValue: mockWarehouseHttp },
        { provide: ToastService, useValue: mockToast },
        { provide: AuthService, useValue: mockAuth },
        { provide: AppPersonaService, useValue: mockPersona },
        { provide: ModuleRegistryService, useValue: mockRegistry },
        { provide: ConfirmDialogService, useValue: mockConfirmDialog },
        { provide: Router, useValue: mockRouter },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams: queryParamsSubject.asObservable()
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(Users);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // ─────────────────────────────────────────────────────────────────
  // 1. کامپوننت و لود اولیه داده‌ها
  // ─────────────────────────────────────────────────────────────────
  describe('۱. راه‌اندازی و بارگذاری اولیه (Initialization & Data Loading)', () => {
    it('باید کامپوننت با موفقیت ساخته شود و داده‌های کاربران و نقش‌ها را لود کند', () => {
      expect(component).toBeTruthy();
      expect(mockAccountsHttp.getPermissions).toHaveBeenCalled();
      expect(mockAccountsHttp.getRoles).toHaveBeenCalled();
      expect(mockAccountsHttp.getUsers).toHaveBeenCalled();
      expect(mockWarehouseHttp.getAll).toHaveBeenCalled();
      expect(component.state.appState.users.length).toBe(2);
      expect(component.state.appState.roles.length).toBe(2);
    });

    it('باید گروه‌بندی مجوزها (Permissions Grouping) با تفکیک حساس‌ها به درستی ایجاد شود', () => {
      expect(component.systemPermissionGroups.length).toBeGreaterThan(0);
      const sensitiveGroup = component.systemPermissionGroups.find(g => g.key === 'SENSITIVE');
      expect(sensitiveGroup).toBeDefined();
      expect(sensitiveGroup?.items.some((p: any) => p.codename === 'perm_sys_hard_delete')).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // 2. مدیریت تب‌ها (Tabs Switching)
  // ─────────────────────────────────────────────────────────────────
  describe('۲. پیمایش و تغییر تب‌ها (Tabs Navigation)', () => {
    it('باید تغییر تب به نقش‌ها (roles) پارامترهای روت را به‌روز کند', () => {
      component.switchTab('roles');
      expect(mockRouter.navigate).toHaveBeenCalledWith([], {
        queryParams: { tab: 'roles' },
        queryParamsHandling: 'merge'
      });
    });

    it('باید تغییر تب به کارت‌های پرسنلی (id-cards) پارامتر روت را اعمال کند', () => {
      component.switchTab('id-cards');
      expect(mockRouter.navigate).toHaveBeenCalledWith([], {
        queryParams: { tab: 'id-cards' },
        queryParamsHandling: 'merge'
      });
    });

    it('باید با دریافت پارامتر tab از کوئری، activeTab به‌روز شود', () => {
      queryParamsSubject.next({ tab: 'roles' });
      expect(component.activeTab).toBe('roles');
      queryParamsSubject.next({ tab: 'id-cards' });
      expect(component.activeTab).toBe('id-cards');
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // 3. تب کاربران: فیلترها، جستجو و صفحه‌بندی (Users: Filter, Search, Pagination)
  // ─────────────────────────────────────────────────────────────────
  describe('۳. فیلترها و صفحه‌بندی کاربران (Users Filtering & Pagination)', () => {
    it('باید فیلتر کاربران بر اساس وضعیت (فعال/غیرفعال/کل) به درستی عمل کند', () => {
      component.setStatusFilter('active');
      expect(component.filteredUsers.every((u: any) => u.is_active)).toBe(true);
      expect(component.filteredUsers.length).toBe(1);

      component.setStatusFilter('inactive');
      expect(component.filteredUsers.every((u: any) => !u.is_active)).toBe(true);
      expect(component.filteredUsers.length).toBe(1);

      component.setStatusFilter('all');
      expect(component.filteredUsers.length).toBe(2);
    });

    it('باید فیلتر کاربران بر اساس انبار (Warehouse Filter) لیست را پالایش کند', () => {
      component.userWarehouseFilter = 101;
      expect(component.filteredUsers.every((u: any) => (u.assigned_warehouses || []).includes(101))).toBe(true);
      expect(component.filteredUsers.length).toBe(1);

      component.userWarehouseFilter = 'ALL';
      expect(component.filteredUsers.length).toBe(2);
    });

    it('باید فیلتر کاربران بر اساس نقش (Role Filter) اعمال شود', () => {
      component.userRoleFilter = 10; // admin role
      expect(component.filteredUsers.length).toBe(1);
      expect(component.filteredUsers[0].username).toBe('admin_user');
    });

    it('باید جستجوی متنی کاربر (Search Query) نتایج متناظر را برگرداند', () => {
      component.searchQuery = 'کارگر';
      expect(component.filteredUsers.length).toBe(1);
      expect(component.filteredUsers[0].username).toBe('worker_user');

      component.searchQuery = '0011223344';
      expect(component.filteredUsers.length).toBe(1);
      expect(component.filteredUsers[0].username).toBe('admin_user');
    });

    it('باید محاسبات صفحه‌بندی و تعویض صفحات با goToPage به درستی کار کند', () => {
      component.setPageSize(1);
      expect(component.totalPages).toBe(2);

      component.goToPage(2);
      expect(component.currentPage).toBe(2);

      component.goToPage(99); // Should not exceed totalPages
      expect(component.currentPage).toBe(2);

      component.goToPage(1);
      expect(component.currentPage).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // 4. انتخاب دسته‌جمعی و عملیات گروهی کاربران (Bulk Selection & Actions)
  // ─────────────────────────────────────────────────────────────────
  describe('۴. انتخاب گروهی کاربران (Bulk Operations)', () => {
    it('باید بتوان یک کاربر خاص را انتخاب یا از حالت انتخاب خارج کرد', () => {
      expect(component.isUserSelected(1)).toBe(false);

      component.toggleSelectUser(1);
      expect(component.isUserSelected(1)).toBe(true);
      expect(component.selectedUserIds.size).toBe(1);

      component.toggleSelectUser(1);
      expect(component.isUserSelected(1)).toBe(false);
      expect(component.selectedUserIds.size).toBe(0);
    });

    it('باید انتخاب همه رکوردهای صفحه جاری (Select All Current Page) کار کند', () => {
      component.toggleSelectAllCurrentPage();
      expect(component.isAllCurrentPageSelected()).toBe(true);
      expect(component.selectedUserIds.size).toBe(2);

      component.toggleSelectAllCurrentPage();
      expect(component.selectedUserIds.size).toBe(0);
    });

    it('باید عملیات تغییر وضعیت دسته‌جمعی (Bulk Toggle Status) به صورت امن اجرا شود', () => {
      component.toggleSelectUser(1);
      component.toggleSelectUser(2);

      component.bulkToggleStatus(true);

      // Only inactive user (user 2) will be sent for activation
      expect(mockAccountsHttp.toggleUserStatus).toHaveBeenCalledWith(2, true);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // 5. فرم مودال ایجاد و ویرایش کاربر (User Modal & Validation)
  // ─────────────────────────────────────────────────────────────────
  describe('۵. ایجاد، ویرایش و اعتبارسنجی کاربر (User Modal & Form)', () => {
    it('باید مودال ثبت کاربر جدید با مقادیر پیش‌فرض باز شود', () => {
      component.openUserModal();
      expect(component.isUserModalOpen).toBe(true);
      expect(component.editingUser).toBeNull();
      expect(component.userForm.username).toBe('');
      expect(component.userForm.is_active).toBe(true);
    });

    it('باید مودال ویرایش کاربر مقادیر کاربر را پر کند', () => {
      component.openUserModal(1);
      expect(component.isUserModalOpen).toBe(true);
      expect(component.editingUser).toBeTruthy();
      expect(component.userForm.username).toBe('admin_user');
      expect(component.userForm.first_name).toBe('مدیر');
    });

    it('باید ثبت کاربر بدون نام یا نام خانوادگی متوقف شده و اخطار دهد', () => {
      component.openUserModal();
      component.userForm.username = 'test_user';
      component.userForm.first_name = '';
      component.userForm.last_name = '';
      component.saveUser();
      expect(mockToast.show).toHaveBeenCalledWith('error', expect.stringContaining('الزامی'));
      expect(mockAccountsHttp.createUser).not.toHaveBeenCalled();
    });

    it('باید ثبت کاربر با شماره موبایل نامعتبر با خطا مواجه شود', () => {
      component.openUserModal();
      component.userForm.username = 'test_user';
      component.userForm.first_name = 'تست';
      component.userForm.last_name = 'تستی';
      component.userForm.phone_number = '02112345678'; // Not mobile
      component.saveUser();
      expect(mockToast.show).toHaveBeenCalledWith('error', expect.stringContaining('همراه'));
      expect(mockAccountsHttp.createUser).not.toHaveBeenCalled();
    });

    it('باید ثبت کاربر جدید با کلمه عبور کمتر از ۶ کاراکتر متوقف شود', () => {
      component.openUserModal();
      component.userForm.username = 'test_user';
      component.userForm.first_name = 'تست';
      component.userForm.last_name = 'تستی';
      component.userForm.phone_number = '09121112233';
      component.userForm.password = '123';
      component.saveUser();
      expect(mockToast.show).toHaveBeenCalledWith('error', expect.stringContaining('کلمه عبور'));
      expect(mockAccountsHttp.createUser).not.toHaveBeenCalled();
    });

    it('باید ثبت کاربر با اطلاعات معتبر با موفقیت ذخیره شود', () => {
      component.openUserModal();
      component.userForm.first_name = 'محمد';
      component.userForm.last_name = 'رضایی';
      component.userForm.username = 'm.rezaei';
      component.userForm.phone_number = '09121112233';
      component.userForm.password = 'Pass@1234';
      component.saveUser();

      expect(mockAccountsHttp.createUser).toHaveBeenCalled();
      expect(mockToast.show).toHaveBeenCalledWith('success', expect.any(String));
      expect(component.isUserModalOpen).toBe(false);
    });

    it('باید متد resetPassword پس از تایید دیالوگ رمز را ریست کند', async () => {
      await component.resetPassword(2);
      expect(mockConfirmDialog.open).toHaveBeenCalled();
      expect(mockAccountsHttp.adminResetPassword).toHaveBeenCalledWith(2);
      expect(mockToast.show).toHaveBeenCalledWith('success', expect.stringContaining('ریست'));
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // 6. تب نقش‌ها: سلسله‌مراتب، مجوزها و اعتبارسنجی حلقه (Roles Tab & Hierarchy)
  // ─────────────────────────────────────────────────────────────────
  describe('۶. تب نقش‌های سازمانی (Roles Tab Management)', () => {
    it('باید تغییر نمای نقش‌ها به درختی (tree) و جدولی (table) انجام شود', () => {
      component.setRoleViewMode('table');
      expect(component.roleViewMode).toBe('table');
      component.setRoleViewMode('tree');
      expect(component.roleViewMode).toBe('tree');
    });

    it('باید جستجوی نقش‌ها لیست را فیلتر کند', () => {
      component.onRoleSearchChange('سرپرست');
      expect(component.displayedRoles.length).toBe(1);
      expect(component.displayedRoles[0].name).toBe('supervisor');
    });

    it('باید باز کردن مودال نقش جدید فرم را ریست کند', () => {
      component.openRoleModal();
      expect(component.isRoleModalOpen).toBe(true);
      expect(component.editingRole).toBeNull();
      expect(component.roleForm.name).toBe('');
    });

    it('باید ثبت نقش بدون نام یکتا یا عنوان فارسی با خطا متوقف شود', () => {
      component.openRoleModal();
      component.roleForm.name = '';
      component.roleForm.title = '';
      component.saveRole();
      expect(mockToast.show).toHaveBeenCalledWith('error', expect.stringContaining('الزامی'));
      expect(mockAccountsHttp.createRole).not.toHaveBeenCalled();
    });

    it('باید از انتخاب نقش به عنوان والد خودش یا زیرمجموعه فرزندانش جلوگیری شود (Anti-Circular Check)', () => {
      component.openRoleModal(10); // Role 10 (admin)
      const availableParents = component.getSelectableParents();
      // Role 10 cannot be its own parent
      expect(availableParents.some((r: any) => r.id === 10)).toBe(false);
    });

    it('باید انتخاب رنگ سازمانی نقش فیلد color را تغییر دهد', () => {
      component.setRoleColor('#dc2626');
      expect(component.roleForm.color).toBe('#dc2626');
    });

    it('باید ثبت نقش معتبر با موفقیت به سرور ارسال شود', () => {
      component.openRoleModal();
      component.roleForm.name = 'accountant';
      component.roleForm.title = 'حسابدار رسمی';
      component.roleForm.permissions = [1, 2];
      component.saveRole();

      expect(mockAccountsHttp.createRole).toHaveBeenCalled();
      expect(mockToast.show).toHaveBeenCalledWith('success', expect.any(String));
      expect(component.isRoleModalOpen).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // 7. اکسپورت و ایمپورت اکسل کاربران و نقش‌ها (Excel Exporters & Templates)
  // ─────────────────────────────────────────────────────────────────
  describe('۷. خروجی و ورودی اکسل (Excel Operations)', () => {
    it('باید متد exportUsersExcel فایل اکسل کاربران را دانلود کند', () => {
      component.exportUsersExcel();
      expect(mockAccountsHttp.exportUsersExcel).toHaveBeenCalled();
      expect(mockToast.show).toHaveBeenCalledWith('success', expect.stringContaining('اکسل'));
    });

    it('باید متد exportRolesExcel فایل اکسل نقش‌ها را دانلود کند', () => {
      component.exportRolesExcel();
      expect(mockAccountsHttp.exportRolesExcel).toHaveBeenCalled();
      expect(mockToast.show).toHaveBeenCalledWith('success', expect.stringContaining('اکسل'));
    });

    it('باید متد downloadUsersTemplate قالب نمونه اکسل کاربران را فراخوانی کند', () => {
      component.downloadUsersTemplate();
      expect(mockAccountsHttp.downloadUsersTemplate).toHaveBeenCalled();
    });

    it('باید متد downloadRolesTemplate قالب نمونه اکسل نقش‌ها را فراخوانی کند', () => {
      component.downloadRolesTemplate();
      expect(mockAccountsHttp.downloadRolesTemplate).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // 8. تفویض عملکرد به ساب‌کامپوننت کارت پرسنلی (ID Cards Delegation)
  // ─────────────────────────────────────────────────────────────────
  describe('۸. ارتباط با کامپوننت کارت پرسنلی (ID Cards Delegation)', () => {
    it('باید متدهای چاپ و پیش‌نمایش در صورت فعال بودن کامپوننت به درستی اجرا شوند', () => {
      const mockIdCards = {
        executeCardPrint: vi.fn(),
        openSheetPreviewModal: vi.fn(),
        openExportModal: vi.fn(),
        printableUsers: [mockUsers[0]],
        isExportingImage: false
      };
      component.idCardsComponent = mockIdCards as any;

      component.printIdCards();
      expect(mockIdCards.executeCardPrint).toHaveBeenCalled();

      component.openIdCardsSheetPreview();
      expect(mockIdCards.openSheetPreviewModal).toHaveBeenCalled();

      component.openIdCardsExportModal();
      expect(mockIdCards.openExportModal).toHaveBeenCalled();

      expect(component.idCardsPrintableCount).toBe(1);
      expect(component.isIdCardsExporting).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // 9. اعتبارسنجی تعاملات DOM (DOM Tests)
  // ─────────────────────────────────────────────────────────────────
  describe('۹. تست عناصر DOM و ظاهر صفحه (DOM Elements & Render Testing)', () => {
    it('باید دکمه‌های ۳ تب کاربران، نقش‌ها و کارت پرسنلی در صفحه وجود داشته باشند', () => {
      const tabButtons = fixture.debugElement.queryAll(By.css('button[type="button"]'));
      const buttonTexts = tabButtons.map(b => b.nativeElement.textContent);
      expect(buttonTexts.some((t: string) => t.includes('کاربران') || t.includes('پرسنل'))).toBe(true);
    });

    it('باید تغییر نمای گرید به جدول کلاس‌های مناسب را فعال کند', () => {
      component.setViewMode('table');
      fixture.detectChanges();
      expect(component.userViewMode).toBe('table');
    });
  });
});
