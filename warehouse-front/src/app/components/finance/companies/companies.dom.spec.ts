// @vitest-environment jsdom
import '@angular/compiler';
import { describe, it, expect, beforeEach, beforeAll, afterEach, vi } from 'vitest';
import { ComponentFixture, TestBed, getTestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { ɵresolveComponentResources } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { of } from 'rxjs';
import * as fs from 'fs';
import * as path from 'path';

import { CompaniesManagementComponent } from './companies';
import { CompanyApiService } from '../../../core/api/company-api.service';
import { ActiveCompanyService } from '../../../core/services/active-company.service';
import { ToastService } from '../../../shared/components/toast/toast.component';
import { Company } from '../../../core/models/company.model';

try {
  getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
} catch {}

describe('CompaniesManagementComponent DOM & Browser Unit Test (Type 1 Vitest + JSDOM)', () => {
  let fixture: ComponentFixture<CompaniesManagementComponent>;
  let component: CompaniesManagementComponent;
  let mockCompanyApi: any;
  let mockActiveCompanyService: any;
  let mockToast: any;

  const sampleCompanies: Company[] = [
    {
      id: 1,
      code: 'PTS',
      name: 'پاینده توان ساینا',
      national_id: '10101234567',
      economic_code: '4111222333',
      registration_number: '12345',
      phone: '02188889999',
      address: 'تهران، خیابان ولیعصر',
      ceo_name: 'مهندس پاینده',
      projects_count: 2,
      is_active: true,
      created_at: '2026-09-23T10:00:00Z',
      updated_at: '2026-09-23T10:00:00Z'
    },
    {
      id: 2,
      code: 'FA',
      name: 'فارس عالیش',
      national_id: '10207654321',
      economic_code: '4222333444',
      registration_number: '67890',
      phone: '07133334444',
      address: 'شیراز، شهرک صنعتی',
      ceo_name: 'مهندس عالیشوندی',
      projects_count: 1,
      is_active: true,
      created_at: '2026-09-23T10:00:00Z',
      updated_at: '2026-09-23T10:00:00Z'
    }
  ];

  beforeAll(async () => {
    let localStore: Record<string, string> = {};
    const mockLocalStorage = {
      getItem: (key: string) => localStore[key] || null,
      setItem: (key: string, val: string) => { localStore[key] = String(val); },
      removeItem: (key: string) => { delete localStore[key]; },
      clear: () => { localStore = {}; }
    };
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
      configurable: true
    });
    if (typeof globalThis !== 'undefined') {
      Object.defineProperty(globalThis, 'localStorage', {
        value: mockLocalStorage,
        writable: true,
        configurable: true
      });
    }

    await ɵresolveComponentResources(async (url) => {
      const filename = path.basename(url);
      const localPath = path.resolve(__dirname, filename);
      if (fs.existsSync(localPath)) {
        return fs.readFileSync(localPath, 'utf-8');
      }
      return '';
    });
  });

  beforeEach(async () => {
    mockCompanyApi = {
      getAll: vi.fn().mockReturnValue(of([...sampleCompanies])),
      getById: vi.fn().mockImplementation((id: number) => of(sampleCompanies.find(c => c.id === id))),
      create: vi.fn().mockImplementation((data: any) => of({ id: 3, ...data, projects_count: 0 })),
      update: vi.fn().mockImplementation((id: number, data: any) => of({ id, ...data })),
      delete: vi.fn().mockReturnValue(of(void 0)),
      getUserAvailable: vi.fn().mockReturnValue(of({ companies: sampleCompanies, is_superuser: true }))
    };

    mockActiveCompanyService = {
      activeCompany: sampleCompanies[0],
      activeCompanyId: 1,
      activeCompany$: of(sampleCompanies[0]),
      availableCompanies: sampleCompanies,
      availableCompanies$: of(sampleCompanies),
      loadAvailableCompanies: vi.fn().mockReturnValue(of({ companies: sampleCompanies, is_superuser: true })),
      selectCompany: vi.fn(),
      openSwitchModal: vi.fn(),
      closeSwitchModal: vi.fn()
    };

    mockToast = {
      show: vi.fn(),
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [CommonModule, FormsModule, CompaniesManagementComponent],
      providers: [
        { provide: CompanyApiService, useValue: mockCompanyApi },
        { provide: ActiveCompanyService, useValue: mockActiveCompanyService },
        { provide: ToastService, useValue: mockToast }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CompaniesManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  describe('۱. ساختار هدر چسبان و استانداردهای نوار فرمان (Unified Sticky Command Center)', () => {
    it('باید عنوان ماژول «مدیریت شرکت‌ها و هلدینگ» و نشان تعداد در DOM رندر شوند', () => {
      const el: HTMLElement = fixture.nativeElement;
      const title = el.querySelector('h1');
      expect(title).not.toBeNull();
      expect(title?.textContent?.trim()).toBe('مدیریت شرکت‌ها و هلدینگ');

      const badge = el.querySelector('.bg-indigo-50.text-indigo-700');
      expect(badge).not.toBeNull();
      expect(badge?.textContent).toContain('2 شرکت');
    });

    it('باید سه دکمه آیکونی استاندارد (اکسل خروجی، اکسل ورودی، رفرش) با اندازه w-9 h-9 در هدر وجود داشته باشند', () => {
      const el: HTMLElement = fixture.nativeElement;
      const exportBtn = el.querySelector('button[title="خروجی اکسل شرکت‌ها"]');
      const importBtn = el.querySelector('button[title="ورود اطلاعات از اکسل"]');
      const refreshBtn = el.querySelector('button[title="به‌روزرسانی داده‌ها"]');

      expect(exportBtn).not.toBeNull();
      expect(exportBtn?.className).toContain('w-9');
      expect(exportBtn?.className).toContain('h-9');

      expect(importBtn).not.toBeNull();
      expect(importBtn?.className).toContain('w-9');
      expect(importBtn?.className).toContain('h-9');

      expect(refreshBtn).not.toBeNull();
      expect(refreshBtn?.className).toContain('w-9');
      expect(refreshBtn?.className).toContain('h-9');
    });

    it('کلیک روی دکمه به‌روزرسانی داده‌ها در DOM باید متد loadCompanies را فراخوانی کند', () => {
      const el: HTMLElement = fixture.nativeElement;
      const refreshBtn = el.querySelector('button[title="به‌روزرسانی داده‌ها"]') as HTMLButtonElement;
      expect(refreshBtn).not.toBeNull();

      refreshBtn.click();
      expect(mockCompanyApi.getAll).toHaveBeenCalled();
    });

    it('باید دکمه اصلی «ثبت شرکت جدید» با کلاس indigo-600 رندر شده باشد', () => {
      const el: HTMLElement = fixture.nativeElement;
      const createBtn = Array.from(el.querySelectorAll('button')).find(b => b.textContent?.includes('ثبت شرکت جدید'));
      expect(createBtn).toBeDefined();
      expect(createBtn?.className).toContain('bg-indigo-600');
    });
  });

  describe('۲. جدول داده‌ها و نمایش ستون‌های مشخصات شرکت (Data Table Card Standard)', () => {
    it('باید سطرهای جدول به تعداد شرکت‌های بارگذاری‌شده در DOM رندر شوند', () => {
      const el: HTMLElement = fixture.nativeElement;
      const rows = el.querySelectorAll('tbody tr');
      expect(rows.length).toBe(2);
    });

    it('باید کد، نام شرکت و نشان شرکت فعال جاری در ردیف اول نمایش داده شود', () => {
      const el: HTMLElement = fixture.nativeElement;
      const firstRow = el.querySelectorAll('tbody tr')[0];

      expect(firstRow.textContent).toContain('PTS');
      expect(firstRow.textContent).toContain('پاینده توان ساینا');
      expect(firstRow.textContent).toContain('فعال جاری');
    });

    it('باید ستون‌های شناسه ملی، کد اقتصادی، مدیرعامل و تعداد پروژه‌ها با فرمت صحیح رندر شوند', () => {
      const el: HTMLElement = fixture.nativeElement;
      const firstRow = el.querySelectorAll('tbody tr')[0];

      expect(firstRow.textContent).toContain('10101234567');
      expect(firstRow.textContent).toContain('4111222333');
      expect(firstRow.textContent).toContain('مهندس پاینده');
      expect(firstRow.textContent).toContain('2 پروژه');
    });

    it('ردیف دوم که شرکت فعال جاری نیست نباید نشان «فعال جاری» داشته باشد', () => {
      const el: HTMLElement = fixture.nativeElement;
      const secondRow = el.querySelectorAll('tbody tr')[1];

      expect(secondRow.textContent).toContain('FA');
      expect(secondRow.textContent).toContain('فارس عالیش');
      expect(secondRow.textContent).not.toContain('فعال جاری');
      expect(secondRow.textContent).toContain('1 پروژه');
    });
  });

  describe('۳. فیلتر جستجوی زنده درجا (In-place Live Search Bar)', () => {
    it('جستجوی نام «فارس» باید جدول را فیلتر کرده و تنها ۱ سطر نمایش دهد', () => {
      component.searchQuery = 'فارس';
      component.applyFilter();
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      const rows = el.querySelectorAll('tbody tr');
      expect(rows.length).toBe(1);
      expect(rows[0].textContent).toContain('فارس عالیش');
      expect(rows[0].textContent).not.toContain('پاینده توان ساینا');
    });

    it('جستجوی کد «PTS» باید شرکت پاینده توان ساینا را فیلتر کند', () => {
      component.searchQuery = 'PTS';
      component.applyFilter();
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      const rows = el.querySelectorAll('tbody tr');
      expect(rows.length).toBe(1);
      expect(rows[0].textContent).toContain('پاینده توان ساینا');
    });

    it('جستجوی عبارتی که وجود ندارد باید پیام خالی بودن را در DOM نمایش دهد', () => {
      component.searchQuery = 'عبارت ناموجود ۱۲۳۴۵';
      component.applyFilter();
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      const rows = el.querySelectorAll('tbody tr');
      expect(rows.length).toBe(1);
      expect(rows[0].textContent).toContain('هیچ شرکتی با معیارهای جستجو یافت نشد');
    });

    it('متد clearSearch باید عبارت جستجو را پاک کرده و تمام شرکت‌ها را بازگرداند', () => {
      component.searchQuery = 'فارس';
      component.applyFilter();
      fixture.detectChanges();
      expect(component.filteredCompanies.length).toBe(1);

      component.clearSearch();
      fixture.detectChanges();

      expect(component.searchQuery).toBe('');
      expect(component.filteredCompanies.length).toBe(2);
      const el: HTMLElement = fixture.nativeElement;
      const rows = el.querySelectorAll('tbody tr');
      expect(rows.length).toBe(2);
    });
  });

  describe('۴. مودال ثبت شرکت و اعتبارسنجی فرم (Create Company Modal & Validation)', () => {
    it('کلیک روی دکمه «ثبت شرکت جدید» باید مودال ثبت را باز کند', () => {
      const el: HTMLElement = fixture.nativeElement;
      const createBtn = Array.from(el.querySelectorAll('button')).find(b => b.textContent?.includes('ثبت شرکت جدید')) as HTMLButtonElement;
      createBtn.click();
      fixture.detectChanges();

      expect(component.companyModal.isOpen).toBe(true);
      expect(component.companyModal.isEdit).toBe(false);

      const modalTitle = el.querySelector('h3');
      expect(modalTitle?.textContent?.trim()).toBe('ثبت شرکت جدید');
    });

    it('تلاش برای ثبت با فیلدهای خالی باید خطای اعتبارسنجی را نشان دهد و از ارسال جلوگیری کند', () => {
      component.openCreateModal();
      fixture.detectChanges();

      component.submitCompanyForm();
      fixture.detectChanges();

      expect(component.companyModal.errors['code']).toBe('کد یکتای شرکت الزامی است.');
      expect(component.companyModal.errors['name']).toBe('نام کامل شرکت الزامی است.');
      expect(mockCompanyApi.create).not.toHaveBeenCalled();

      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).toContain('کد یکتای شرکت الزامی است.');
      expect(el.textContent).toContain('نام کامل شرکت الزامی است.');
    });

    it('شناسه ملی با طول غیر از ۱۱ رقم باید خطای اعتبارسنجی بدهد', () => {
      component.openCreateModal();
      component.companyModal.data.code = 'TST';
      component.companyModal.data.name = 'شرکت تستی';
      component.companyModal.data.national_id = '12345'; // کمتر از ۱۱ رقم

      component.submitCompanyForm();
      fixture.detectChanges();

      expect(component.companyModal.errors['national_id']).toBe('شناسه ملی اشخاص حقوقی باید دقیقاً ۱۱ رقم باشد.');
      expect(mockCompanyApi.create).not.toHaveBeenCalled();
    });

    it('شناسه ملی شامل حروف باید خطای عددی بودن بدهد', () => {
      component.openCreateModal();
      component.companyModal.data.code = 'TST';
      component.companyModal.data.name = 'شرکت تستی';
      component.companyModal.data.national_id = '12345ABCDEF';

      component.submitCompanyForm();
      fixture.detectChanges();

      expect(component.companyModal.errors['national_id']).toBe('شناسه ملی باید فقط شامل ارقام عددی باشد.');
      expect(mockCompanyApi.create).not.toHaveBeenCalled();
    });

    it('فرم معتبر باید با موفقیت به وب‌سرویس ارسال شده و مودال بسته شود', () => {
      component.openCreateModal();
      component.companyModal.data.code = 'NEW';
      component.companyModal.data.name = 'شرکت جدید آزمایشی';
      component.companyModal.data.national_id = '10320987654';
      component.companyModal.data.economic_code = '4999888777';

      component.submitCompanyForm();
      fixture.detectChanges();

      expect(mockCompanyApi.create).toHaveBeenCalledWith(expect.objectContaining({
        code: 'NEW',
        name: 'شرکت جدید آزمایشی',
        national_id: '10320987654',
        economic_code: '4999888777'
      }));
      expect(mockToast.success).toHaveBeenCalledWith(expect.stringContaining('شرکت جدید آزمایشی'));
      expect(component.companyModal.isOpen).toBe(false);
    });
  });

  describe('۵. ویرایش اطلاعات شرکت (Edit Company Flow)', () => {
    it('کلیک روی دکمه «ویرایش» باید داده‌های شرکت را در فرم مودال لود کند', () => {
      const el: HTMLElement = fixture.nativeElement;
      const editBtns = el.querySelectorAll('button[title="ویرایش مشخصات شرکت"]');
      (editBtns[0] as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(component.companyModal.isOpen).toBe(true);
      expect(component.companyModal.isEdit).toBe(true);
      expect(component.companyModal.data.id).toBe(1);
      expect(component.companyModal.data.code).toBe('PTS');
      expect(component.companyModal.data.name).toBe('پاینده توان ساینا');
    });

    it('ارسال فرم ویرایش شده باید متد update سرویس را فراخوانی کند', () => {
      component.openEditModal(sampleCompanies[0]);
      component.companyModal.data.name = 'پاینده توان ساینا (ویرایش‌شده)';

      component.submitCompanyForm();
      fixture.detectChanges();

      expect(mockCompanyApi.update).toHaveBeenCalledWith(1, expect.objectContaining({
        name: 'پاینده توان ساینا (ویرایش‌شده)'
      }));
      expect(mockToast.success).toHaveBeenCalled();
      expect(component.companyModal.isOpen).toBe(false);
    });
  });

  describe('۶. امنیت و گارد حذف شرکت (Delete Guard & Active Projects Invariant)', () => {
    it('تلاش برای حذف شرکتی که پروژه فعال دارد (projects_count > 0) باید با پیام خطای قرمز مسدود شود', () => {
      const companyWithProjects = sampleCompanies[0]; // projects_count: 2
      expect(companyWithProjects.projects_count).toBeGreaterThan(0);

      component.confirmDelete(companyWithProjects);
      fixture.detectChanges();

      expect(component.deleteModal.isOpen).toBe(false);
      expect(mockToast.error).toHaveBeenCalledWith('این شرکت دارای 2 پروژه فعال است و امکان حذف آن وجود ندارد.');
      expect(mockCompanyApi.delete).not.toHaveBeenCalled();
    });

    it('حذف شرکت بدون پروژه باید مودال تایید حذف را باز کند و با تایید حذف شود', () => {
      const companyWithoutProjects: Company = {
        id: 99,
        code: 'EMPTY',
        name: 'شرکت بدون پروژه',
        projects_count: 0,
        is_active: false
      };

      component.confirmDelete(companyWithoutProjects);
      fixture.detectChanges();

      expect(component.deleteModal.isOpen).toBe(true);
      expect(component.deleteModal.target?.id).toBe(99);

      component.executeDelete();
      fixture.detectChanges();

      expect(mockCompanyApi.delete).toHaveBeenCalledWith(99);
      expect(mockToast.success).toHaveBeenCalledWith(expect.stringContaining('شرکت «شرکت بدون پروژه» با موفقیت حذف شد.'));
      expect(component.deleteModal.isOpen).toBe(false);
    });
  });
});
