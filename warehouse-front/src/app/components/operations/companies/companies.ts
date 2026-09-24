import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { CompanyApiService } from '../../../core/api/company-api.service';
import { ActiveCompanyService } from '../../../core/services/active-company.service';
import { AccountsHttpService, User } from '../../../core/http/accounts-http.service';
import { ToastService } from '../../../shared/components/toast/toast.component';
import { Company, UserCompanyAccess } from '../../../core/models/company.model';

@Component({
  selector: 'app-companies-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './companies.html',
  styleUrls: ['./companies.css']
})
export class CompaniesManagementComponent implements OnInit, OnDestroy {
  private api = inject(CompanyApiService);
  public activeCompanyService = inject(ActiveCompanyService);
  private accountsHttp = inject(AccountsHttpService, { optional: true });
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();

  companies: Company[] = [];
  filteredCompanies: Company[] = [];
  systemUsers: User[] = [];
  isLoading = false;

  // فیلتر جستجوی زنده درجا
  searchQuery = '';
  private searchSubject = new Subject<string>();

  // مدیریت آپلود لوگو
  selectedLogoFile: File | null = null;
  logoPreviewUrl: string | null = null;

  // وضعیت مدال ثبت و ویرایش
  companyModal: {
    isOpen: boolean;
    isEdit: boolean;
    isSubmitting: boolean;
    data: {
      id?: number;
      code: string;
      name: string;
      national_id: string;
      economic_code: string;
      registration_number: string;
      phone: string;
      address: string;
      ceo_name: string;
      is_active: boolean;
      has_warehouse_module: boolean;
      logo?: string | null;
    };
    errors: { [key: string]: string };
  } = {
    isOpen: false,
    isEdit: false,
    isSubmitting: false,
    data: this.getEmptyCompanyData(),
    errors: {}
  };

  // وضعیت مدال مدیریت دسترسی کاربران (UserCompanyAccess)
  userAccessModal: {
    isOpen: boolean;
    company: Company | null;
    accesses: UserCompanyAccess[];
    isLoading: boolean;
    selectedUserId: number | null;
    isDefault: boolean;
    isSubmitting: boolean;
  } = {
    isOpen: false,
    company: null,
    accesses: [],
    isLoading: false,
    selectedUserId: null,
    isDefault: false,
    isSubmitting: false
  };

  // وضعیت مدال تایید حذف
  deleteModal: {
    isOpen: boolean;
    target: Company | null;
    isDeleting: boolean;
  } = {
    isOpen: false,
    target: null,
    isDeleting: false
  };

  ngOnInit(): void {
    this.setupSearch();
    this.loadCompanies();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupSearch(): void {
    this.searchSubject
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => {
        this.applyFilter();
      });
  }

  onSearchChange(): void {
    this.searchSubject.next(this.searchQuery);
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.applyFilter();
  }

  loadCompanies(): void {
    this.isLoading = true;
    this.api.getAll().subscribe({
      next: (res) => {
        this.isLoading = false;
        if (Array.isArray(res)) {
          this.companies = res;
        } else if (res && Array.isArray(res.results)) {
          this.companies = res.results;
        } else {
          this.companies = [];
        }
        this.applyFilter();
      },
      error: (err) => {
        this.isLoading = false;
        this.toast.error('خطا در دریافت فهرست شرکت‌ها');
      }
    });
  }

  applyFilter(): void {
    if (!this.searchQuery.trim()) {
      this.filteredCompanies = [...this.companies];
      this.cdr.markForCheck();
      return;
    }
    const q = this.searchQuery.trim().toLowerCase();
    this.filteredCompanies = this.companies.filter(
      (c) =>
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.code && c.code.toLowerCase().includes(q)) ||
        (c.national_id && c.national_id.includes(q)) ||
        (c.economic_code && c.economic_code.includes(q)) ||
        (c.ceo_name && c.ceo_name.toLowerCase().includes(q))
    );
    this.cdr.markForCheck();
  }

  onLogoFileSelected(event: any): void {
    const file = event.target?.files?.[0];
    if (file) {
      this.selectedLogoFile = file;
      const reader = new FileReader();
      reader.onload = () => {
        this.logoPreviewUrl = reader.result as string;
        this.cdr.markForCheck();
      };
      reader.readAsDataURL(file);
    }
  }

  openCreateModal(): void {
    this.selectedLogoFile = null;
    this.logoPreviewUrl = null;
    this.companyModal = {
      isOpen: true,
      isEdit: false,
      isSubmitting: false,
      data: this.getEmptyCompanyData(),
      errors: {}
    };
    this.cdr.markForCheck();
  }

  openEditModal(company: Company): void {
    this.selectedLogoFile = null;
    this.logoPreviewUrl = company.logo || null;
    this.companyModal = {
      isOpen: true,
      isEdit: true,
      isSubmitting: false,
      data: {
        id: company.id,
        code: company.code,
        name: company.name,
        national_id: company.national_id || '',
        economic_code: company.economic_code || '',
        registration_number: company.registration_number || '',
        phone: company.phone || '',
        address: company.address || '',
        ceo_name: company.ceo_name || '',
        is_active: company.is_active,
        has_warehouse_module: company.has_warehouse_module !== false,
        logo: company.logo || null
      },
      errors: {}
    };
    this.cdr.markForCheck();
  }

  closeCompanyModal(): void {
    this.companyModal.isOpen = false;
    this.selectedLogoFile = null;
    this.logoPreviewUrl = null;
    this.cdr.markForCheck();
  }

  validateCompanyForm(): boolean {
    const errors: { [key: string]: string } = {};
    const d = this.companyModal.data;

    if (!d.code || !d.code.trim()) {
      errors['code'] = 'کد یکتای شرکت الزامی است.';
    }
    if (!d.name || !d.name.trim()) {
      errors['name'] = 'نام کامل شرکت الزامی است.';
    }
    if (d.national_id && d.national_id.trim()) {
      const nid = d.national_id.trim();
      if (!/^\d+$/.test(nid)) {
        errors['national_id'] = 'شناسه ملی باید فقط شامل ارقام عددی باشد.';
      } else if (nid.length !== 11) {
        errors['national_id'] = 'شناسه ملی اشخاص حقوقی باید دقیقاً ۱۱ رقم باشد.';
      }
    }

    this.companyModal = {
      ...this.companyModal,
      errors
    };
    this.cdr.markForCheck();
    return Object.keys(errors).length === 0;
  }

  submitCompanyForm(): void {
    if (!this.validateCompanyForm()) {
      return;
    }

    this.companyModal.isSubmitting = true;
    const payload = {
      code: this.companyModal.data.code.trim().toUpperCase(),
      name: this.companyModal.data.name.trim(),
      national_id: this.companyModal.data.national_id.trim() || null,
      economic_code: this.companyModal.data.economic_code.trim() || null,
      registration_number: this.companyModal.data.registration_number.trim() || null,
      phone: this.companyModal.data.phone.trim() || null,
      address: this.companyModal.data.address.trim() || null,
      ceo_name: this.companyModal.data.ceo_name.trim() || null,
      is_active: this.companyModal.data.is_active,
      has_warehouse_module: this.companyModal.data.has_warehouse_module
    };

    if (this.companyModal.isEdit && this.companyModal.data.id) {
      const companyId = this.companyModal.data.id;
      this.api.update(companyId, payload).subscribe({
        next: (updated) => {
          this.companyModal.isSubmitting = false;
          this.companyModal.isOpen = false;
          this.toast.success(`اطلاعات شرکت «${updated.name}» با موفقیت ویرایش شد.`);
          if (this.selectedLogoFile) {
            this.api.uploadLogo(companyId, this.selectedLogoFile).subscribe({
              next: () => this.loadCompanies()
            });
          } else {
            this.loadCompanies();
          }
          this.activeCompanyService.loadAvailableCompanies().subscribe();
        },
        error: (err) => {
          this.companyModal.isSubmitting = false;
          const msg = err.error?.detail || err.error?.code?.[0] || 'خطا در ثبت ویرایش شرکت';
          this.toast.error(msg);
        }
      });
    } else {
      this.api.create(payload).subscribe({
        next: (created) => {
          this.companyModal.isSubmitting = false;
          this.companyModal.isOpen = false;
          this.toast.success(`شرکت «${created.name}» با موفقیت ثبت شد.`);
          if (this.selectedLogoFile && created.id) {
            this.api.uploadLogo(created.id, this.selectedLogoFile).subscribe({
              next: () => this.loadCompanies()
            });
          } else {
            this.loadCompanies();
          }
          this.activeCompanyService.loadAvailableCompanies().subscribe();
        },
        error: (err) => {
          this.companyModal.isSubmitting = false;
          const msg = err.error?.detail || err.error?.code?.[0] || 'خطا در ایجاد شرکت جدید';
          this.toast.error(msg);
        }
      });
    }
  }

  confirmDelete(company: Company): void {
    if (company.projects_count && company.projects_count > 0) {
      this.toast.error(`این شرکت دارای ${company.projects_count} پروژه فعال است و امکان حذف آن وجود ندارد.`);
      return;
    }
    this.deleteModal = {
      isOpen: true,
      target: company,
      isDeleting: false
    };
  }

  closeDeleteModal(): void {
    this.deleteModal.isOpen = false;
    this.deleteModal.target = null;
  }

  executeDelete(): void {
    if (!this.deleteModal.target) return;
    this.deleteModal.isDeleting = true;
    this.api.delete(this.deleteModal.target.id).subscribe({
      next: () => {
        this.deleteModal.isDeleting = false;
        this.toast.success(`شرکت «${this.deleteModal.target!.name}» با موفقیت حذف شد.`);
        this.closeDeleteModal();
        this.loadCompanies();
        this.activeCompanyService.loadAvailableCompanies().subscribe();
      },
      error: (err) => {
        this.deleteModal.isDeleting = false;
        const msg = err.error?.detail || 'خطا در حذف شرکت';
        this.toast.error(msg);
      }
    });
  }

  exportExcel(): void {
    this.isLoading = true;
    this.api.exportExcel().subscribe({
      next: (blob) => {
        this.isLoading = false;
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `companies_${new Date().toISOString().slice(0, 10)}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        this.toast.success('فایل اکسل شرکت‌ها با موفقیت دانلود شد.');
        this.cdr.markForCheck();
      },
      error: () => {
        this.isLoading = false;
        this.toast.error('خطا در دریافت فایل اکسل شرکت‌ها.');
        this.cdr.markForCheck();
      }
    });
  }

  importExcel(): void {
    this.toast.info('بارگذاری دسته‌ای از اکسل برای شرکت‌ها بزودی فعال می‌شود.');
  }

  // ─── مدیریت دسترسی کاربران به شرکت (UserCompanyAccess) ───
  openUserAccessModal(company: Company): void {
    this.userAccessModal = {
      isOpen: true,
      company,
      accesses: [],
      isLoading: true,
      selectedUserId: null,
      isDefault: false,
      isSubmitting: false
    };
    this.loadUserAccesses(company.id);
    if (this.systemUsers.length === 0) {
      this.loadSystemUsers();
    }
    this.cdr.markForCheck();
  }

  closeUserAccessModal(): void {
    this.userAccessModal.isOpen = false;
    this.userAccessModal.company = null;
    this.cdr.markForCheck();
  }

  loadUserAccesses(companyId: number): void {
    this.userAccessModal.isLoading = true;
    this.api.getUserAccesses({ company_id: companyId }).subscribe({
      next: (res) => {
        this.userAccessModal.isLoading = false;
        this.userAccessModal.accesses = Array.isArray(res) ? res : (res as any)?.results || [];
        this.cdr.markForCheck();
      },
      error: () => {
        this.userAccessModal.isLoading = false;
        this.toast.error('خطا در دریافت دسترسی‌های کاربران');
        this.cdr.markForCheck();
      }
    });
  }

  loadSystemUsers(): void {
    if (!this.accountsHttp) return;
    this.accountsHttp.getUsers().subscribe({
      next: (users) => {
        this.systemUsers = users;
        this.cdr.markForCheck();
      },
      error: () => {
        this.toast.error('خطا در دریافت لیست کاربران');
      }
    });
  }

  addUserAccess(): void {
    if (!this.userAccessModal.selectedUserId || !this.userAccessModal.company) {
      this.toast.warning('لطفاً یک کاربر را انتخاب نمایید.');
      return;
    }
    this.userAccessModal.isSubmitting = true;
    this.api.createUserAccess({
      user: this.userAccessModal.selectedUserId,
      company: this.userAccessModal.company.id,
      is_default: this.userAccessModal.isDefault
    }).subscribe({
      next: () => {
        this.userAccessModal.isSubmitting = false;
        this.userAccessModal.selectedUserId = null;
        this.toast.success('دسترسی کاربر به شرکت با موفقیت ثبت شد.');
        this.loadUserAccesses(this.userAccessModal.company!.id);
      },
      error: (err) => {
        this.userAccessModal.isSubmitting = false;
        const msg = err.error?.detail || err.error?.non_field_errors?.[0] || 'خطا در ثبت دسترسی کاربر';
        this.toast.error(msg);
      }
    });
  }

  removeUserAccess(accessId?: number): void {
    if (!accessId) return;
    if (!confirm('آیا از لغو دسترسی این کاربر اطمینان دارید؟')) return;
    this.api.deleteUserAccess(accessId).subscribe({
      next: () => {
        this.toast.success('دسترسی کاربر لغو شد.');
        if (this.userAccessModal.company) {
          this.loadUserAccesses(this.userAccessModal.company.id);
        }
      },
      error: () => {
        this.toast.error('خطا در لغو دسترسی');
      }
    });
  }

  private getEmptyCompanyData() {
    return {
      code: '',
      name: '',
      national_id: '',
      economic_code: '',
      registration_number: '',
      phone: '',
      address: '',
      ceo_name: '',
      is_active: true,
      has_warehouse_module: true
    };
  }
}
