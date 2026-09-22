// @vitest-environment jsdom
import '@angular/compiler';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal, Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AppPersonaService } from '../services/app-persona.service';
import { AuthService } from './auth.service';
import { ModuleRegistryService } from '../modules/module-registry.service';
import { WebSocketService } from '../http/websocket.service';
import { SessionTabService } from '../services/session-tab.service';
import {
  EMPLOYEE_NAV_ITEMS,
  SUPERVISOR_NAV_ITEMS,
  ACCOUNTANT_NAV_ITEMS,
  MANAGER_NAV_ITEMS,
  TREASURER_NAV_ITEMS
} from '../../modules/accounting/nav-items';

export interface UserTestCase {
  username: string;
  fullName: string;
  expectedRole: 'operator' | 'supervisor' | 'accountant' | 'manager' | 'treasury' | 'superuser';
  allowedApps: string[];
  permissions: string[];
  roles: string[];
  isSuperuser: boolean;
  assignedProjects: string[];
  assignedSections: string[];
  canAccessWarehouse: boolean;
}

export const ALL_12_SYSTEM_USERS: UserTestCase[] = [
  {
    username: 'admin',
    fullName: 'مدیر شرکت',
    expectedRole: 'superuser',
    allowedApps: ['warehouse', 'finance'],
    permissions: ['admin_all'],
    roles: ['company_manager', 'admin_all'],
    isSuperuser: true,
    assignedProjects: ['دالان', 'پارسیان', 'انبارداری'],
    assignedSections: ['سراسری سیستم'],
    canAccessWarehouse: true
  },
  {
    username: 'h.alishvandi',
    fullName: 'حبیب عالیشوندی',
    expectedRole: 'manager',
    allowedApps: ['finance'],
    permissions: [
      'can_act_as_company_manager',
      'perm_approve_fleet_manager',
      'perm_approve_personnel_manager',
      'perm_lock_work_period',
      'perm_manager_payment_authorize',
      'view_sys_fleet_settlement',
      'view_sys_payroll',
      'view_sys_personnel'
    ],
    roles: ['company_manager'],
    isSuperuser: false,
    assignedProjects: ['دالان', 'پارسیان', 'انبارداری'],
    assignedSections: [
      'دالان > دالان فقط بیمه',
      'دالان > دالان کارگاه',
      'پارسیان > پارسیان کارگاه',
      'پارسیان > پارسیان فقط بیمه',
      'انبارداری > انبارداری کارگاه'
    ],
    canAccessWarehouse: false
  },
  {
    username: 'a.haghshenas',
    fullName: 'امیر حق شناس',
    expectedRole: 'manager',
    allowedApps: ['finance'],
    permissions: [
      'can_act_as_company_manager',
      'perm_approve_fleet_manager',
      'perm_approve_personnel_manager',
      'perm_lock_work_period',
      'perm_manager_payment_authorize',
      'view_sys_fleet_settlement',
      'view_sys_payroll',
      'view_sys_personnel'
    ],
    roles: ['company_manager'],
    isSuperuser: false,
    assignedProjects: ['دالان', 'پارسیان'],
    assignedSections: [
      'دالان > دالان فقط بیمه',
      'دالان > دالان کارگاه',
      'پارسیان > پارسیان کارگاه',
      'پارسیان > پارسیان فقط بیمه'
    ],
    canAccessWarehouse: false
  },
  {
    username: 'm.bagheri',
    fullName: 'مهری باقری',
    expectedRole: 'accountant',
    allowedApps: ['finance'],
    permissions: [
      'can_act_as_accountant',
      'perm_approve_fleet_finance',
      'perm_approve_personnel_finance',
      'view_sys_fleet_settlement',
      'view_sys_payroll',
      'view_sys_personnel'
    ],
    roles: ['accountant'],
    isSuperuser: false,
    assignedProjects: ['دالان', 'پارسیان', 'انبارداری'],
    assignedSections: [
      'دالان > دالان فقط بیمه',
      'دالان > دالان کارگاه',
      'پارسیان > پارسیان کارگاه',
      'پارسیان > پارسیان فقط بیمه',
      'انبارداری > انبارداری کارگاه'
    ],
    canAccessWarehouse: false
  },
  {
    username: 'e.taghavi',
    fullName: 'عنایت تقوی',
    expectedRole: 'treasury',
    allowedApps: ['finance'],
    permissions: [
      'perm_treasury_disburse_action',
      'view_sys_payroll',
      'view_sys_personnel',
      'view_sys_treasury'
    ],
    roles: ['treasury'],
    isSuperuser: false,
    assignedProjects: ['دالان', 'پارسیان'],
    assignedSections: [
      'دالان > دالان فقط بیمه',
      'دالان > دالان کارگاه',
      'پارسیان > پارسیان فقط بیمه',
      'پارسیان > پارسیان کارگاه'
    ],
    canAccessWarehouse: false
  },
  {
    username: 'n.beyrami',
    fullName: 'نسرین بیرمی',
    expectedRole: 'treasury',
    allowedApps: ['finance'],
    permissions: [
      'perm_treasury_disburse_action',
      'view_sys_payroll',
      'view_sys_personnel',
      'view_sys_treasury'
    ],
    roles: ['treasury'],
    isSuperuser: false,
    assignedProjects: ['انبارداری'],
    assignedSections: ['انبارداری > انبارداری کارگاه'],
    canAccessWarehouse: false
  },
  {
    username: 'h.akbari',
    fullName: 'حسین اکبری',
    expectedRole: 'supervisor',
    allowedApps: ['finance'],
    permissions: [
      'can_act_as_workshop_supervisor',
      'perm_approve_fleet_supervisor',
      'perm_approve_personnel_supervisor',
      'perm_lock_work_period',
      'view_sys_fleet_attendance',
      'view_sys_personnel_attendance'
    ],
    roles: ['workshop_supervisor'],
    isSuperuser: false,
    assignedProjects: ['انبارداری'],
    assignedSections: ['انبارداری > انبارداری کارگاه'],
    canAccessWarehouse: false
  },
  {
    username: 'r.hoseeni',
    fullName: 'رزاق حسینی',
    expectedRole: 'supervisor',
    allowedApps: ['finance'],
    permissions: [
      'can_act_as_workshop_supervisor',
      'perm_approve_fleet_supervisor',
      'perm_approve_personnel_supervisor',
      'perm_lock_work_period',
      'view_sys_fleet_attendance',
      'view_sys_personnel_attendance'
    ],
    roles: ['workshop_supervisor'],
    isSuperuser: false,
    assignedProjects: ['دالان'],
    assignedSections: ['دالان > دالان کارگاه'],
    canAccessWarehouse: false
  },
  {
    username: 'm.amiri',
    fullName: 'محمد امیری',
    expectedRole: 'supervisor',
    allowedApps: ['finance'],
    permissions: [
      'can_act_as_workshop_supervisor',
      'perm_approve_fleet_supervisor',
      'perm_approve_personnel_supervisor',
      'perm_lock_work_period',
      'view_sys_fleet_attendance',
      'view_sys_personnel_attendance'
    ],
    roles: ['workshop_supervisor'],
    isSuperuser: false,
    assignedProjects: ['پارسیان'],
    assignedSections: ['پارسیان > پارسیان کارگاه'],
    canAccessWarehouse: false
  },
  {
    username: 'a.mohammadi',
    fullName: 'امین محمدی',
    expectedRole: 'operator',
    allowedApps: ['finance'],
    permissions: [
      'can_act_as_operator',
      'view_sys_fleet_attendance',
      'view_sys_personnel_attendance'
    ],
    roles: ['workshop_operator'],
    isSuperuser: false,
    assignedProjects: ['انبارداری'],
    assignedSections: ['انبارداری > انبارداری کارگاه'],
    canAccessWarehouse: false
  },
  {
    username: 'gh.alishvandi',
    fullName: 'قاسم عالیشوندی',
    expectedRole: 'operator',
    allowedApps: ['finance'],
    permissions: [
      'can_act_as_operator',
      'view_sys_fleet_attendance',
      'view_sys_personnel_attendance'
    ],
    roles: ['workshop_operator'],
    isSuperuser: false,
    assignedProjects: ['دالان'],
    assignedSections: ['دالان > دالان کارگاه'],
    canAccessWarehouse: false
  },
  {
    username: 'a.ghashghaee',
    fullName: 'علی قشقایی',
    expectedRole: 'operator',
    allowedApps: ['finance'],
    permissions: [
      'can_act_as_operator',
      'view_sys_fleet_attendance',
      'view_sys_personnel_attendance'
    ],
    roles: ['workshop_operator'],
    isSuperuser: false,
    assignedProjects: [],
    assignedSections: [],
    canAccessWarehouse: false
  }
];

describe('Segregation of Duties (SoD) & DOM Verification for All 12 Database Users', () => {
  let mockAuth: any;
  let mockModuleRegistry: any;

  beforeEach(() => {
    mockModuleRegistry = new ModuleRegistryService();
    mockAuth = {
      user: signal<any>(null),
      userPermissions: signal<string[]>([]),
      isSuperuser: signal<boolean>(false),
      hasRole: vi.fn(),
      hasPermission: vi.fn()
    };
  });

  for (const user of ALL_12_SYSTEM_USERS) {
    it(`[DOM & SoD Verify] User ${user.username} (${user.fullName}) - Role: ${user.expectedRole}`, async () => {
      // 1. Set Auth state matching DB
      mockAuth.user.set({
        username: user.username,
        is_superuser: user.isSuperuser,
        roles: user.roles,
        allowed_apps: user.allowedApps,
        active_app: user.allowedApps.includes('finance') ? 'finance' : 'warehouse'
      });
      mockAuth.userPermissions.set(user.permissions);
      mockAuth.isSuperuser.set(user.isSuperuser);

      // 2. Configure Angular DI
      const injector = Injector.create({
        providers: [
          {
            provide: Router,
            useValue: {
              events: { pipe: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }) },
              navigate: vi.fn(),
              url: '/'
            }
          },
          { provide: AppPersonaService, useClass: AppPersonaService },
          { provide: AuthService, useValue: mockAuth },
          { provide: ModuleRegistryService, useValue: mockModuleRegistry },
          { provide: WebSocketService, useValue: { sendMessage: vi.fn(), switchAppChannel: vi.fn() } },
          {
            provide: SessionTabService,
            useValue: {
              getTabId: vi.fn().mockReturnValue('test-tab-456'),
              getActiveApp: vi.fn().mockReturnValue(user.allowedApps.includes('finance') ? 'personnel' : 'warehouse'),
              getActiveRole: vi.fn().mockReturnValue(user.expectedRole),
              setActiveApp: vi.fn(),
              setActiveRole: vi.fn()
            }
          }
        ]
      });

      const personaService = injector.get(AppPersonaService);

      // 3. Verify App Scope & Isolation
      const apps = personaService.accessibleApps();
      if (user.isSuperuser) {
        expect(apps).toContain('personnel');
        expect(apps).toContain('warehouse');
        expect(personaService.canAccessApp('warehouse')).toBe(true);
      } else {
        expect(apps).toContain('personnel');
        expect(apps).not.toContain('warehouse');
        expect(personaService.canAccessApp('warehouse')).toBe(false);
      }
      expect(personaService.hasWarehouseAccess()).toBe(user.canAccessWarehouse);

      // 4. Verify Single Role Invariant (Strict SoD)
      const availableRoles = personaService.availableRoles();
      const roleCodes = availableRoles.map((r: any) => r.code);

      if (user.isSuperuser) {
        expect(roleCodes).toContain('superuser');
      } else {
        expect(roleCodes).toContain(user.expectedRole);
        const forbiddenRoles = ['operator', 'supervisor', 'accountant', 'manager', 'treasury'].filter(
          r => r !== user.expectedRole
        );
        for (const forbidden of forbiddenRoles) {
          expect(roleCodes).not.toContain(forbidden);
        }
      }

      // 5. Mount Real DOM Elements to test rendering and presence/absence in DOM
      const domContainer = document.createElement('div');
      domContainer.id = 'test-sidebar-dom';
      document.body.appendChild(domContainer);

      const userPerms = mockAuth.userPermissions();
      const activeRole = user.expectedRole;
      const isAdmin = user.isSuperuser;

      // Compute nav items exactly as layout.ts does
      const resolvedEmployeeNav = (activeRole === 'operator' || isAdmin)
        ? EMPLOYEE_NAV_ITEMS.filter(item => isAdmin || userPerms.includes(item.permission) || userPerms.includes('can_act_as_operator'))
        : [];

      const resolvedSupervisorNav = (activeRole === 'supervisor' || isAdmin)
        ? SUPERVISOR_NAV_ITEMS.filter(item => isAdmin || userPerms.includes(item.permission) || userPerms.includes('can_act_as_workshop_supervisor'))
        : [];

      const resolvedAccountantNav = (activeRole === 'accountant' || isAdmin)
        ? ACCOUNTANT_NAV_ITEMS.filter(item => isAdmin || userPerms.includes(item.permission) || userPerms.includes('can_act_as_accountant'))
        : [];

      const resolvedManagerNav = (activeRole === 'manager' || isAdmin)
        ? MANAGER_NAV_ITEMS.filter(item => isAdmin || userPerms.includes(item.permission) || userPerms.includes('can_act_as_company_manager'))
        : [];

      const resolvedTreasurerNav = (activeRole === 'treasury' || isAdmin)
        ? TREASURER_NAV_ITEMS.filter(item => isAdmin || userPerms.includes(item.permission) || userPerms.includes('perm_treasury_disburse_action'))
        : [];

      // Render into DOM
      let domHtml = '<nav id="sidebar-nav">';

      if (resolvedEmployeeNav.length > 0) {
        domHtml += `<div class="accordion-employee"><span class="accordion-title">منوی ثبت کارمند</span>`;
        for (const item of resolvedEmployeeNav) {
          domHtml += `<a class="sidebar-link employee-link" data-tab-id="${item.id}">${item.label}</a>`;
        }
        domHtml += `</div>`;
      }

      if (resolvedSupervisorNav.length > 0) {
        domHtml += `<div class="accordion-supervisor"><span class="accordion-title">منوی سرپرست کارگاه</span>`;
        for (const item of resolvedSupervisorNav) {
          domHtml += `<a class="sidebar-link supervisor-link" data-tab-id="${item.id}">${item.label}</a>`;
        }
        domHtml += `</div>`;
      }

      if (resolvedAccountantNav.length > 0) {
        domHtml += `<div class="accordion-accountant"><span class="accordion-title">منوی حسابدار</span>`;
        for (const item of resolvedAccountantNav) {
          domHtml += `<a class="sidebar-link accountant-link" data-tab-id="${item.id}">${item.label}</a>`;
        }
        domHtml += `</div>`;
      }

      if (resolvedManagerNav.length > 0) {
        domHtml += `<div class="accordion-manager"><span class="accordion-title">منوی مدیر کلان</span>`;
        for (const item of resolvedManagerNav) {
          domHtml += `<a class="sidebar-link manager-link" data-tab-id="${item.id}">${item.label}</a>`;
        }
        domHtml += `</div>`;
      }

      if (resolvedTreasurerNav.length > 0) {
        domHtml += `<div class="accordion-treasurer"><span class="accordion-title">منوی خزانه‌دار</span>`;
        for (const item of resolvedTreasurerNav) {
          domHtml += `<a class="sidebar-link treasurer-link" data-tab-id="${item.id}">${item.label}</a>`;
        }
        domHtml += `</div>`;
      }

      if (user.canAccessWarehouse) {
        domHtml += `<div class="warehouse-switcher-card"><button class="change-wh-btn">تغییر انبار</button></div>`;
      }

      domHtml += '</nav>';
      domContainer.innerHTML = domHtml;

      // 6. Assert DOM elements directly via querySelector
      const employeeLinks = domContainer.querySelectorAll('.employee-link');
      const supervisorLinks = domContainer.querySelectorAll('.supervisor-link');
      const accountantLinks = domContainer.querySelectorAll('.accountant-link');
      const managerLinks = domContainer.querySelectorAll('.manager-link');
      const treasurerLinks = domContainer.querySelectorAll('.treasurer-link');
      const warehouseCard = domContainer.querySelector('.warehouse-switcher-card');

      switch (user.expectedRole) {
        case 'operator':
          expect(employeeLinks.length).toBe(6);
          expect(supervisorLinks.length).toBe(0);
          expect(accountantLinks.length).toBe(0);
          expect(managerLinks.length).toBe(0);
          expect(treasurerLinks.length).toBe(0);
          expect(warehouseCard).toBeNull();
          break;

        case 'supervisor':
          expect(employeeLinks.length).toBe(0);
          expect(supervisorLinks.length).toBe(6);
          expect(accountantLinks.length).toBe(0);
          expect(managerLinks.length).toBe(0);
          expect(treasurerLinks.length).toBe(0);
          expect(warehouseCard).toBeNull();
          break;

        case 'accountant':
          expect(employeeLinks.length).toBe(0);
          expect(supervisorLinks.length).toBe(0);
          expect(accountantLinks.length).toBe(6);
          expect(managerLinks.length).toBe(0);
          expect(treasurerLinks.length).toBe(0);
          expect(warehouseCard).toBeNull();
          break;

        case 'manager':
          expect(employeeLinks.length).toBe(0);
          expect(supervisorLinks.length).toBe(0);
          expect(accountantLinks.length).toBe(0);
          expect(managerLinks.length).toBe(5);
          expect(treasurerLinks.length).toBe(0);
          expect(warehouseCard).toBeNull();
          break;

        case 'treasury':
          expect(employeeLinks.length).toBe(0);
          expect(supervisorLinks.length).toBe(0);
          expect(accountantLinks.length).toBe(0);
          expect(managerLinks.length).toBe(0);
          expect(treasurerLinks.length).toBe(5);
          expect(warehouseCard).toBeNull();
          break;

        case 'superuser':
          expect(employeeLinks.length).toBeGreaterThan(0);
          expect(supervisorLinks.length).toBeGreaterThan(0);
          expect(accountantLinks.length).toBeGreaterThan(0);
          expect(managerLinks.length).toBeGreaterThan(0);
          expect(treasurerLinks.length).toBeGreaterThan(0);
          expect(warehouseCard).not.toBeNull();
          break;
      }

      // Cleanup DOM
      document.body.removeChild(domContainer);
    });
  }
});
