import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { CompanyApiService } from '../../../core/api/company-api.service';
import { ActiveCompanyService } from '../../../core/services/active-company.service';
import { ToastService } from '../../../shared/components/toast/toast.component';
import { Company } from '../../../core/models/company.model';

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
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();

  companies: Company[] = [];
  filteredCompanies: Company[] = [];
  isLoading = false;

  // فیلتر جستجوی زنده درجا
  searchQuery = '';
  private searchSubject = new Subject<string>();

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
    };
    errors: { [key: string]: string };
  } = {
    isOpen: false,
    isEdit: false,
    isSubmitting: false,
    data: this.getEmptyCompanyData(),
    errors: {}
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

  openCreateModal(): void {
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
        is_active: company.is_active
      },
      errors: {}
    };
    this.cdr.markForCheck();
  }

  closeCompanyModal(): void {
    this.companyModal.isOpen = false;
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
      is_active: this.companyModal.data.is_active
    };

    if (this.companyModal.isEdit && this.companyModal.data.id) {
      this.api.update(this.companyModal.data.id, payload).subscribe({
        next: (updated) => {
          this.companyModal.isSubmitting = false;
          this.companyModal.isOpen = false;
          this.toast.success(`اطلاعات شرکت «${updated.name}» با موفقیت ویرایش شد.`);
          this.loadCompanies();
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
          this.loadCompanies();
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
    this.toast.info('خروجی اکسل فهرست شرکت‌ها در حال آماده‌سازی است...');
  }

  importExcel(): void {
    this.toast.info('بارگذاری دسته‌ای از اکسل برای شرکت‌ها بزودی فعال می‌شود.');
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
      is_active: true
    };
  }
}
