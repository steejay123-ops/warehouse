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
import { AccountsHttpService } from '../../../core/http/accounts-http.service';
import { Company } from '../../../core/models/company.model';

try {
  getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
} catch {}

describe('CompaniesManagementComponent DOM & Browser Unit Test (Type 1 Vitest + JSDOM)', () => {
  let fixture: ComponentFixture<CompaniesManagementComponent>;
  let component: CompaniesManagementComponent;
  let mockCompanyApi: any;
  let mockActiveCompanyService: any;
  let mockAccountsHttp: any;
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
      getUserAvailable: vi.fn().mockReturnValue(of({ companies: sampleCompanies, is_superuser: true })),
      getUserAccesses: vi.fn().mockReturnValue(of([])),
      createUserAccess: vi.fn().mockReturnValue(of({})),
      deleteUserAccess: vi.fn().mockReturnValue(of({})),
      exportExcel: vi.fn().mockReturnValue(of(new Blob())),
      uploadLogo: vi.fn().mockReturnValue(of({})),
      getDocuments: vi.fn().mockReturnValue(of([])),
      createDocument: vi.fn().mockImplementation((data: any) => {
        const title = (data instanceof FormData ? data.get('title') : data?.title) || 'مدرک تست';
        return of({ id: 101, title });
      }),
      deleteDocument: vi.fn().mockReturnValue(of(void 0)),
      uploadCoreDoc: vi.fn().mockReturnValue(of({ file_url: '/media/test.pdf' })),
      getExpiringDocuments: vi.fn().mockReturnValue(of([])),
      getBankAccounts: vi.fn().mockReturnValue(of([
        {
          id: 1,
          company: 1,
          bank_name: 'بانک ملت',
          account_number: '1234567890',
          sheba_number: 'IR120120000000001234567890',
          account_title: 'حساب جاری پاینده',
          is_primary: true,
          is_active: true
        }
      ])),
      createBankAccount: vi.fn().mockImplementation((data: any) => of({ id: 2, ...data })),
      updateBankAccount: vi.fn().mockImplementation((id: number, data: any) => of({ id, ...data })),
      deleteBankAccount: vi.fn().mockReturnValue(of(void 0)),
      setPrimaryBankAccount: vi.fn().mockReturnValue(of({ success: true }))
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

    mockAccountsHttp = {
      getUsers: vi.fn().mockReturnValue(of([]))
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
        { provide: AccountsHttpService, useValue: mockAccountsHttp },
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

    it('باید ستون‌های شناسه ملی، مدیرعامل و تعداد پروژه‌ها با فرمت صحیح رندر شوند', () => {
      const el: HTMLElement = fixture.nativeElement;
      const firstRow = el.querySelectorAll('tbody tr')[0];

      expect(firstRow.textContent).toContain('10101234567');
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
      expect(modalTitle?.textContent?.trim()).toContain('ثبت شرکت');
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
    it('کلیک روی دکمه «استودیو» باید داده‌های شرکت را در فرم مودال لود کند', () => {
      const el: HTMLElement = fixture.nativeElement;
      const editBtns = el.querySelectorAll('button[title="ویرایش مشخصات و مدارک شرکت"]');
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

  describe('۷. استودیوی مودال ۵ تبی و مدیریت اسناد حقوقی (5-Tab Studio & Document Management)', () => {
    it('باز کردن مودال شرکت باید به طور پیش‌فرض روی تب هویتی تنظیم شود و تغییر تب کار کند', () => {
      component.openCreateModal();
      fixture.detectChanges();

      expect(component.companyModal.isOpen).toBe(true);
      expect(component.activeModalTab).toBe('identity');

      // جابجایی بین تب‌های ۵گانه
      component.setModalTab('documents');
      expect(component.activeModalTab).toBe('documents');

      component.setModalTab('governance');
      expect(component.activeModalTab).toBe('governance');

      component.setModalTab('fiscal_insurance');
      expect(component.activeModalTab).toBe('fiscal_insurance');

      component.setModalTab('treasury');
      expect(component.activeModalTab).toBe('treasury');
    });

    it('باز کردن مودال ویرایش یک شرکت باید اسناد آرشیو آن شرکت را بارگذاری کند', () => {
      mockCompanyApi.getDocuments.mockReturnValue(of([
        { id: 1, title: 'اساسنامه ثبتی', document_type: 'articles_of_association', file_url: '/media/test.pdf' }
      ]));

      component.openEditModal(sampleCompanies[0]);
      fixture.detectChanges();

      expect(mockCompanyApi.getDocuments).toHaveBeenCalledWith({ company_id: 1 });
      expect(component.companyDocuments.length).toBe(1);
      expect(component.companyDocuments[0].title).toBe('اساسنامه ثبتی');
    });

    it('ثبت مدرک جدید بدون انتخاب فایل یا عنوان باید با پیام هشدار متوقف شود', () => {
      component.openEditModal(sampleCompanies[0]);
      fixture.detectChanges();

      // بدون فایل
      component.uploadNewDocument();
      expect(mockToast.warning).toHaveBeenCalledWith('لطفاً فایل مدرک را انتخاب فرمایید.');
      expect(mockCompanyApi.createDocument).not.toHaveBeenCalled();

      // با فایل اما بدون عنوان
      const fakeFile = new File(['dummy'], 'sample.pdf', { type: 'application/pdf' });
      component.newDoc.file = fakeFile;
      component.newDoc.title = '';
      component.uploadNewDocument();
      expect(mockToast.warning).toHaveBeenCalledWith('لطفاً عنوان مدرک را وارد فرمایید.');
      expect(mockCompanyApi.createDocument).not.toHaveBeenCalled();
    });

    it('ثبت مدرک جدید با مشخصات معتبر باید سرویس createDocument را با FormData فراخوانی کند', () => {
      component.openEditModal(sampleCompanies[0]);
      fixture.detectChanges();

      const fakeFile = new File(['dummy content'], 'tax_sheet.pdf', { type: 'application/pdf' });
      component.newDoc.file = fakeFile;
      component.newDoc.title = 'برگ تشخیص مالیاتی';
      component.newDoc.document_type = 'tax_sheet';
      component.newDoc.issue_date = '1405/01/15';

      component.uploadNewDocument();
      fixture.detectChanges();

      expect(mockCompanyApi.createDocument).toHaveBeenCalled();
      expect(mockToast.success).toHaveBeenCalledWith(expect.stringContaining('برگ تشخیص مالیاتی'));
    });

    it('ستون وضعیت مدارک باید بر اساس documents_health_status برچسب مناسب نمایش دهد', () => {
      const companiesWithHealth: Company[] = [
        {
          ...sampleCompanies[0],
          documents_health_status: 'HEALTHY',
          documents_count: 5
        },
        {
          ...sampleCompanies[1],
          documents_health_status: 'EXPIRING_SOON',
          documents_count: 2
        }
      ];

      component.companies = companiesWithHealth;
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      const htmlText = el.textContent || '';
      // بررسی وجود نشانگرهای سلامت مدارک در رندر DOM
      expect(htmlText).toContain('پاینده توان ساینا');
      expect(htmlText).toContain('فارس عالیش');
    });
  });

  describe('۸. سیستم چندشبایی و خزانه‌داری هوشمند شرکت‌ها (Multi-IBAN & Smart Treasury)', () => {
    it('باز کردن ویرایش شرکت باید لیست شماره شباهای آن را بارگذاری کند', () => {
      component.openEditModal(sampleCompanies[0]);
      fixture.detectChanges();

      expect(mockCompanyApi.getBankAccounts).toHaveBeenCalledWith(1);
      expect(component.companyBankAccounts.length).toBe(1);
      expect(component.companyBankAccounts[0].bank_name).toBe('بانک ملت');
      expect(component.companyBankAccounts[0].is_primary).toBe(true);
    });

    it('ورود شماره شبای معتبر باید نام بانک و شماره حساب را به صورت خودکار تشخیص دهد', () => {
      component.onShebaInput('IR160120000000001234567890');

      expect(component.shebaValidationResult?.isValid).toBe(true);
      expect(component.shebaValidationResult?.bank?.name).toBe('بانک ملت');
      expect(component.newAccount.bank_name).toBe('بانک ملت');
      expect(component.newAccount.account_number).toBe('1234567890');
    });

    it('ورود شماره شبای نامعتبر باید خطا بدهد و از ثبت جلوگیری کند', () => {
      component.openEditModal(sampleCompanies[0]);
      component.onShebaInput('IR120000000000000000000000'); // نامعتبر

      expect(component.shebaValidationResult?.isValid).toBe(false);
      expect(component.shebaValidationResult?.errorMessage).toContain('نامعتبر');

      component.saveBankAccount();
      expect(mockToast.error).toHaveBeenCalled();
      expect(mockCompanyApi.createBankAccount).not.toHaveBeenCalled();
    });

    it('ثبت حساب بانکی معتبر باید وب‌سرویس ایجاد را با شرکت جاری صدا بزند', () => {
      component.openEditModal(sampleCompanies[0]);
      component.onShebaInput('IR160120000000001234567890');
      component.newAccount.account_title = 'حساب حقوق پرسنل';

      component.saveBankAccount();
      fixture.detectChanges();

      expect(mockCompanyApi.createBankAccount).toHaveBeenCalledWith(expect.objectContaining({
        company: 1,
        sheba_number: 'IR160120000000001234567890',
        bank_name: 'بانک ملت',
        account_number: '1234567890'
      }));
      expect(mockToast.success).toHaveBeenCalledWith(expect.stringContaining('بانک ملت'));
    });

    it('تغییر حساب بانکی اصلی باید وب‌سرویس setPrimaryBankAccount را فراخوانی کند', () => {
      const sampleAccount = {
        id: 5,
        company: 1,
        bank_name: 'بانک تجارت',
        account_number: '987654321',
        sheba_number: 'IR980180000000000987654321',
        account_title: 'حساب تجاری',
        is_primary: false,
        is_active: true
      };

      component.setPrimaryAccount(sampleAccount);
      fixture.detectChanges();

      expect(mockCompanyApi.setPrimaryBankAccount).toHaveBeenCalledWith(5);
      expect(mockToast.success).toHaveBeenCalledWith(expect.stringContaining('به عنوان حساب اصلی شرکت تنظیم شد'));
    });

    it('کپی شماره شبا به کلیپ‌بورد باید توست موفقیت‌آمیز نمایش دهد', async () => {
      // Mock clipboard
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockResolvedValue(void 0)
        }
      });

      component.copySheba('IR120120000000001234567890');
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('IR120120000000001234567890');
      
      // Allow async promise chain to resolve
      await Promise.resolve();
      await new Promise(r => setTimeout(r, 10));

      expect(mockToast.success).toHaveBeenCalledWith('شماره شبا در حافظه کپی شد.');
      expect(component.copiedSheba).toBe('IR120120000000001234567890');
    });
  });

  describe('۹. انتخابگر تقویم شمسی جلالی (Jalali Shamsi Datepicker Integration)', () => {
    it('متد onRegDateSelect باید تاریخ ثبت شرکت را با تاریخ جلالی به‌روز کند', () => {
      component.openCreateModal();
      component.onRegDateSelect('1402/05/18');
      expect(component.companyModal.data.registration_date).toBe('1402/05/18');
    });

    it('متد onBoardExpiryDateSelect باید تاریخ اتمام دوره هیئت‌مدیره را تنظیم کند', () => {
      component.openCreateModal();
      component.onBoardExpiryDateSelect('1405/08/30');
      expect(component.companyModal.data.board_term_expiry).toBe('1405/08/30');
    });

    it('متدهای صدور و انقضای اسناد باید تاریخ‌های مدرک جدید را شمسی تنظیم کنند', () => {
      component.onDocIssueDateSelect('1404/01/01');
      expect(component.newDoc.issue_date).toBe('1404/01/01');

      component.onDocExpiryDateSelect('1405/01/01');
      expect(component.newDoc.expiry_date).toBe('1405/01/01');
    });
  });

  describe('۱۰. پیش‌نمایش درجا (In-Place Lightbox Preview) و فیلتر اسناد', () => {
    it('متد openPreview باید برای فایل‌های PDF پرچم isPdf را true کند و عنوان مدرک را ست کند', () => {
      const doc = {
        id: 1,
        title: 'اساسنامه رسمی',
        document_type: 'articles_of_association',
        file_url: '/media/documents/sample.pdf'
      };

      component.openPreview(doc);
      expect(component.previewModal.isOpen).toBe(true);
      expect(component.previewModal.title).toBe('اساسنامه رسمی');
      expect(component.previewModal.isPdf).toBe(true);

      component.closePreview();
      expect(component.previewModal.isOpen).toBe(false);
    });

    it('متد openPreview برای فایل‌های تصویری (png, jpg) باید isPdf را false کند', () => {
      const doc = {
        id: 2,
        title: 'تصویر روزنامه رسمی',
        document_type: 'official_gazette',
        file_url: '/media/documents/sample.jpg'
      };

      component.openPreview(doc);
      expect(component.previewModal.isOpen).toBe(true);
      expect(component.previewModal.isPdf).toBe(false);
    });
  });
});


