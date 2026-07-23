import { Component, OnInit, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '../../services/state.service';
import { ToastService } from '../../services/toast.service';
import { AuthService } from '../../core/auth/auth.service';
import { AccountsHttpService, User, Role, Permission } from '../../core/http/accounts-http.service';
import { WarehouseHttpService } from '../../core/http/warehouse-http.service';
import { ClickOutsideDirective } from '../../shared/directives/click-outside.directive';
import { IdCards } from '../id-cards/id-cards';

@Component({
  selector: 'app-users',
  imports: [CommonModule, FormsModule, ClickOutsideDirective, IdCards],
  templateUrl: './users.html',
  styleUrl: './users.css'
})
export class Users implements OnInit {
  activeTab = 'users';
  activeRoleTab = 'custom';
  searchQuery = '';
  
  openMenuId: string | null = null;
  
  isUserModalOpen = false;
  isRoleModalOpen = false;
  isDeleteConfirmModalOpen = false;
  roleToDelete: any = null;
  usersCountToDelete: number = 0;
  activePermTab = 'MAIN_MENU';

  // Role Form
  editingRole: any = null;
  roleForm = {
    id: null as number | null, title: '', permissions: [] as number[]
  };

  // User Form
  editingUser: any = null;
  userForm = {
    id: null as number | null, first_name: '', last_name: '', national_code: '', username: '', phone_number: '', 
    operational_zone: '', supervisor: null as number | null, address: '', company: '', groups: [] as number[], assigned_warehouses: [] as string[], expiry_date: '',
    date_joined: '', last_login: '', is_active: true, is_superuser: false, expiryMode: 'default', expiryDays: 90
  };

  systemPermissions: Permission[] = [];
  systemPermissionGroups: { key: string, title: string, items: Permission[] }[] = [];
  isLoading = false;

  constructor(
    public state: StateService,
    public auth: AuthService,
    private toast: ToastService, 
    private accountsService: AccountsHttpService, 
    private whService: WarehouseHttpService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.accountsService.getPermissions().subscribe(res => {
      this.systemPermissions = res;
      
      const mainMenuPerms = res.filter((p: any) => p.codename.startsWith('view_sys_'));
      const warehouseMenuPerms = res.filter((p: any) => p.codename.startsWith('view_wh_'));
      const backendPerms = res.filter((p: any) => !p.codename.startsWith('view_sys_') && !p.codename.startsWith('view_wh_'));

      this.systemPermissionGroups = [
        {
          key: 'MAIN_MENU',
          title: 'دسترسی‌های منوی اصلی',
          items: mainMenuPerms
        },
        {
          key: 'WH_MENU',
          title: 'دسترسی‌های منوی انبار',
          items: warehouseMenuPerms
        },
        {
          key: 'BACKEND',
          title: 'دسترسی‌های عملیاتی و بک‌اند',
          items: backendPerms
        }
      ];
    });

    this.accountsService.getRoles().subscribe(res => {
      this.state.appState.roles = res;
    });

    this.isLoading = true;
    this.accountsService.getUsers().subscribe(res => {
      this.state.appState.users = res;
      this.isLoading = false;
      this.cdr.detectChanges();
    }, error => {
      this.isLoading = false;
      this.cdr.detectChanges();
    });
    
    this.whService.getAll().subscribe((res: any) => {
        this.state.appState.projects = res;
    });
  }

  get filteredUsers() {
    const q = this.searchQuery.toLowerCase();
    return this.state.appState.users.filter((u: any) => {
      const fullName = `${u.first_name} ${u.last_name}`.toLowerCase();
      return fullName.includes(q) || 
             (u.username && u.username.toLowerCase().includes(q)) || 
             (u.national_code && u.national_code.includes(q));
    });
  }

  get rootRoles() {
    return this.state.appState.roles;
  }

  get systemRoles() {
    const sys = ['admin', 'manager', 'supervisor', 'counter'];
    return this.rootRoles.filter((r: any) => sys.includes(r.name));
  }

  get customRoles() {
    const sys = ['admin', 'manager', 'supervisor', 'counter'];
    return this.rootRoles.filter((r: any) => !sys.includes(r.name));
  }

  getRoleChildren(parentId: string) {
    return [];
  }

  getUsersInRoleCount(roleId: number) {
    return this.state.appState.users.filter((u: any) => u.groups && u.groups.includes(roleId)).length;
  }

  getPrimaryRole(u: any) {
    const userRolesArr = u.groups || [];
    const r = this.state.appState.roles?.find((r: any) => r.id === userRolesArr[0]);
    if (!r) return {name: 'نامشخص', color: '#94a3b8'};
    const mapInfo = this.state.appState.rolesMap[r.name];
    return { name: mapInfo?.title || r.name, color: mapInfo?.color || '#94a3b8' };
  }

  getUserRoles(u: any) {
    const userRolesArr = u.groups || [];
    return userRolesArr.map((rId: any) => {
      const r = this.state.appState.roles?.find((r: any) => r.id === rId);
      if (!r) return {name: 'نامشخص', color: '#94a3b8'};
      const mapInfo = this.state.appState.rolesMap[r.name];
      return { name: mapInfo?.title || r.name, color: mapInfo?.color || '#94a3b8' };
    });
  }

  getProjectName(id: any) {
    const p = this.state.appState.projects.find((proj: any) => proj.id === id);
    return p ? p.name : id;
  }

  switchTab(tab: string) {
    this.activeTab = tab;
    this.openMenuId = null;
  }

  toggleMenu(event: Event, menuId: string) {
    event.stopPropagation();
    if (this.openMenuId === menuId) this.openMenuId = null;
    else this.openMenuId = menuId;
    this.cdr.detectChanges();
  }

  closeMenus() {
    this.openMenuId = null;
    this.cdr.detectChanges();
  }

  trackById(index: number, item: any) {
    return item.id;
  }

  toggleUserStatus(id: number) {
    this.closeMenus();
    this.accountsService.toggleUserStatus(id).subscribe(res => {
      const u = this.state.appState.users.find((x: any) => x.id === id);
      if (u) {
        u.is_active = res.is_active;
        if (res.is_active) {
            this.toast.show('success', `حساب کاربری از تعلیق خارج و مجدداً فعال شد.`);
        } else {
            this.toast.show('warning', `حساب کاربری مسدود و دسترسی وی قطع شد.`);
        }
        this.cdr.detectChanges();
      }
    });
  }

  resetPassword(id: number) {
    this.closeMenus();
    const u = this.state.appState.users.find((x: any) => x.id === id);
    if (confirm(`آیا مطمئن هستید که می‌خواهید رمز عبور ${u.first_name} ${u.last_name} را به حالت پیش‌فرض (123456) بازنشانی کنید؟`)) {
        this.accountsService.adminResetPassword(id).subscribe(res => {
            this.toast.show('success', res.message || 'رمز عبور با موفقیت به مقدار پیش‌فرض تغییر یافت و کاربر برای حفظ امنیت از سیستم خارج شد.');
        });
    }
  }

  openUserModal(id: number | null = null) {
    this.closeMenus();
    if (id) {
      const u = this.state.appState.users.find((x: any) => x.id === id);
      this.editingUser = u;
      this.userForm = { ...u };
      if (!this.userForm.groups) this.userForm.groups = [];
      if (!this.userForm.assigned_warehouses) this.userForm.assigned_warehouses = [];
    } else {
      this.editingUser = null;
      this.userForm = {
        id: null, first_name: '', last_name: '', national_code: '', username: '', phone_number: '', 
        operational_zone: '', supervisor: null, address: '', company: '', groups: [], assigned_warehouses: [], expiry_date: '',
        date_joined: '', last_login: '', is_active: true, is_superuser: false, expiryMode: 'default', expiryDays: 90
      };
    }
    this.isUserModalOpen = true;
    this.cdr.detectChanges();
  }

  toggleUserRoleCheckbox(roleId: number, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) this.userForm.groups.push(roleId);
    else this.userForm.groups = this.userForm.groups.filter((id: number) => id !== roleId);
  }

  toggleUserProjCheckbox(projId: string, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) this.userForm.assigned_warehouses.push(projId);
    else this.userForm.assigned_warehouses = this.userForm.assigned_warehouses.filter((id: string) => id !== projId);
  }

  saveUser() {
    if (!this.userForm.first_name || !this.userForm.last_name || !this.userForm.username) {
      return this.toast.show('error', 'وارد کردن نام، نام خانوادگی و شناسه ورود الزامی است.');
    }

    const payload: any = { ...this.userForm };
    if (!payload.national_code) payload.national_code = null;
    if (!payload.supervisor) payload.supervisor = null;

    if (this.editingUser) {
      this.accountsService.updateUser(this.editingUser.id, payload).subscribe(res => {
        Object.assign(this.editingUser, res);
        this.toast.show('success', 'اطلاعات کاربر با موفقیت بروزرسانی شد.');
        this.isUserModalOpen = false;
        this.cdr.detectChanges();
      });
    } else {
      (payload as any).password = payload.national_code || '123456';
      this.accountsService.createUser(payload).subscribe(res => {
        this.state.appState.users.push(res);
        this.toast.show('success', 'کاربر جدید با موفقیت ایجاد شد.');
        this.isUserModalOpen = false;
        this.cdr.detectChanges();
      });
    }
  }

  openRoleModal(id: number | null = null) {
    this.closeMenus();
    if (id) {
      const r = this.state.appState.roles.find((x: any) => x.id === id);
      this.editingRole = r;
      this.roleForm = { ...r, title: r.name };
      if (!this.roleForm.permissions) this.roleForm.permissions = [];
    } else {
      this.editingRole = null;
      this.roleForm = { id: null, title: '', permissions: [] };
    }
    this.activePermTab = 'MAIN_MENU';
    this.isRoleModalOpen = true;
    this.cdr.detectChanges();
  }

  toggleRolePermission(permId: number, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) this.roleForm.permissions.push(permId);
    else this.roleForm.permissions = this.roleForm.permissions.filter((id: number) => id !== permId);
  }

  toggleAllPermissions() {
    const allPerms = this.systemPermissions.map(p => p.id);
    if (this.roleForm.permissions.length === allPerms.length) {
      this.roleForm.permissions = [];
    } else {
      this.roleForm.permissions = [...allPerms];
    }
  }

  toggleGroupPermissions(groupKey: string) {
    const group = this.systemPermissionGroups.find(g => g.key === groupKey);
    if (!group) return;
    
    const groupPermIds = group.items.map((p: any) => p.id);
    const hasAll = groupPermIds.every((id: number) => this.roleForm.permissions.includes(id));
    
    if (hasAll) {
      this.roleForm.permissions = this.roleForm.permissions.filter((id: number) => !groupPermIds.includes(id));
    } else {
      const newPerms = new Set([...this.roleForm.permissions, ...groupPermIds]);
      this.roleForm.permissions = Array.from(newPerms);
    }
  }

  saveRole() {
    const payload = {
        name: this.roleForm.title,
        permissions: this.roleForm.permissions
    };

    if (!payload.name) return this.toast.show('error', 'عنوان نقش الزامی است.');

    if (this.editingRole) {
      this.accountsService.updateRole(this.editingRole.id, payload).subscribe(res => {
        Object.assign(this.editingRole, res);
        this.toast.show('success', 'نقش و دسترسی‌های آن با موفقیت بروزرسانی شد.');
        this.isRoleModalOpen = false;
      });
    } else {
      this.accountsService.createRole(payload).subscribe(res => {
        this.state.appState.roles.push(res);
        this.toast.show('success', 'نقش جدید به همراه ماتریس دسترسی ایجاد شد.');
        this.isRoleModalOpen = false;
      });
    }
  }

  deleteRole(id: number) {
    const role = this.state.appState.roles.find((r: any) => r.id === id);
    if (!role) return;
    
    const keyRoles = ['admin', 'manager', 'supervisor', 'counter'];
    if (keyRoles.includes(role.name)) {
        return this.toast.show('error', 'امکان حذف نقش‌های سیستمی و کلیدی وجود ندارد.');
    }
    
    this.roleToDelete = role;
    this.usersCountToDelete = this.getUsersInRoleCount(id);
    this.isDeleteConfirmModalOpen = true;
    this.cdr.detectChanges();
  }

  confirmDeleteRole() {
    if (!this.roleToDelete) return;
    const id = this.roleToDelete.id;
    
    this.accountsService.deleteRole(id).subscribe(() => {
        this.state.appState.roles = this.state.appState.roles.filter((r: any) => r.id !== id);
        
        // Remove this role from all users in frontend state automatically
        this.state.appState.users.forEach((u: any) => {
            if (u.groups && u.groups.includes(id)) {
                u.groups = u.groups.filter((gId: number) => gId !== id);
            }
        });
        
        this.toast.show('success', 'نقش مورد نظر حذف و دسترسی کاربران مرتبط بروزرسانی شد.');
        this.isDeleteConfirmModalOpen = false;
        this.roleToDelete = null;
        this.cdr.detectChanges();
    });
  }

  cancelDeleteRole() {
      this.isDeleteConfirmModalOpen = false;
      this.roleToDelete = null;
  }

  formatDate(dStr: string) {
    if (!dStr) return '';
    try {
      return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(dStr));
    } catch {
      return dStr;
    }
  }
  getRoleTitleForForm(r: any) {
    return this.state.appState.rolesMap[r.name]?.title || r.name;
  }
}
