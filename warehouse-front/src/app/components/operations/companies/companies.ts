import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgPersianDatepickerModule } from 'ng-persian-datepicker';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { CompanyApiService } from '../../../core/api/company-api.service';
import { ActiveCompanyService } from '../../../core/services/active-company.service';
import { AccountsHttpService, User } from '../../../core/http/accounts-http.service';
import { ToastService } from '../../../shared/components/toast/toast.component';
import { Company, CompanyDocument, CompanyDocumentType, CompanyBankAccount, UserCompanyAccess } from '../../../core/models/company.model';
import {
  IRANIAN_BANKS,
  IranianBankInfo,
  validateSheba,
  ShebaValidationResult,
  cleanShebaInput,
  extractShebaDigits,
  generateShebaFromAccount,
  getBankByName,
  validateAccountNumber
} from '../../../core/utils/sheba-utils';

@Component({
  selector: 'app-companies-management',
  standalone: true,
  imports: [CommonModule, FormsModule, NgPersianDatepickerModule],
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

  // تب فعال در استودیوی مودال ۶ تبی
  activeModalTab: 'identity' | 'documents' | 'governance' | 'fiscal_insurance' | 'treasury' | 'access' = 'identity';

  // مدیریت باز/بسته بودن پاپ‌اورهای تقویم جلالی
  isRegDatePickerOpen = false;
  isBoardDatePickerOpen = false;
  isDocIssueDatePickerOpen = false;
  isDocExpiryDatePickerOpen = false;

  // فهرست انواع اسناد و مدارک رسمی
  readonly documentTypesList: { value: CompanyDocumentType; label: string }[] = [
    { value: 'statute', label: 'اساسنامه شرکت' },
    { value: 'establishment_gazette', label: 'روزنامه رسمی تأسیس' },
    { value: 'changes_gazette', label: 'روزنامه رسمی آخرین تغییرات هیئت‌مدیره' },
    { value: 'auditors_gazette', label: 'روزنامه رسمی تمدید بازرسان' },
    { value: 'capital_gazette', label: 'روزنامه رسمی تغییرات سرمایه و آدرس' },
    { value: 'vat_certificate', label: 'گواهی ثبت‌نام ارزش افزوده' },
    { value: 'tax_clearance', label: 'مفاصاحساب مالیاتی / بیمه‌ای' },
    { value: 'commercial_card', label: 'کارت بازرگانی' },
    { value: 'contractor_qualification', label: 'گواهی رتبه‌بندی / صلاحیت پیمانکاری (ساجار)' },
    { value: 'labor_safety_certificate', label: 'گواهی صلاحیت ایمنی پیمانکاران (اداره کار)' },
    { value: 'operating_license', label: 'پروانه بهره‌برداری / جواز فعالیت' },
    { value: 'lease_contract', label: 'سند مالکیت / اجاره‌نامه رسمی' },
    { value: 'master_agreement', label: 'قرارداد مادر یا تفاهم‌نامه' },
    { value: 'other', label: 'سایر مدارک و اسناد رسمی' },
  ];

  // مدیریت آرشیو مدارک شرکت
  companyDocuments: CompanyDocument[] = [];
  filteredDocuments: CompanyDocument[] = [];
  docSearchQuery = '';
  selectedDocTypeFilter = '';
  isLoadingDocuments = false;
  isUploadingDoc = false;

  // پیش‌نمایش درجا (In-Place Preview)
  previewModal = {
    isOpen: false,
    title: '',
    fileUrl: '',
    isPdf: false
  };

  newDoc: {
    document_type: CompanyDocumentType;
    title: string;
    file: File | null;
    issue_date: string;
    expiry_date: string;
    is_confidential: boolean;
    description: string;
  } = this.getEmptyDocData();

  // مدیریت چند حسابی و شماره‌های شبای شرکت
  companyBankAccounts: CompanyBankAccount[] = [];
  isLoadingBankAccounts = false;
  isSavingBankAccount = false;
  isEditingAccount = false;
  editingAccountId: number | null = null;
  shebaValidationResult: ShebaValidationResult | null = null;
  copiedShebaId: number | string | null = null;
  copiedSheba: string | null = null;
  iranianBanksList: IranianBankInfo[] = IRANIAN_BANKS;
  bankSearchQuery = '';
  isBankDropdownOpen = false;

  newAccount = this.getEmptyBankAccountData();

  // مدیریت دسترسی‌های استودیو (تب ششم)
  studioAccesses: UserCompanyAccess[] = [];
  isLoadingStudioAccesses = false;
  studioSelectedUserId: number | null = null;
  studioIsDefaultAccess = false;
  userSearchQuery = '';


  // وضعیت مدال ثبت و ویرایش
  companyModal: {
    isOpen: boolean;
    isEdit: boolean;
    isSubmitting: boolean;
    data: {
      id?: number;
      code: string;
      name: string;
      company_type: string;
      national_id: string;
      economic_code: string;
      registration_number: string;
      registration_date: string;
      registered_capital: number | null;
      shares_count: number | null;
      share_nominal_value: number | null;
      fiscal_year_start_month: number;
      phone: string;
      address: string;
      postal_code: string;
      ceo_name: string;
      board_chairman: string;
      board_vice_chairman: string;
      main_inspector: string;
      alternate_inspector: string;
      authorized_signers: string;
      board_term_expiry: string;
      workshop_code: string;
      social_security_branch_code: string;
      social_security_branch_name: string;
      contract_row: string;
      employer_name: string;
      tax_memory_id: string;
      tax_economic_code: string;
      primary_bank_name: string;
      primary_account_number: string;
      primary_iban: string;
      articles_of_association?: string | null;
      latest_gazette?: string | null;
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
    this.loadSystemUsers();
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
      error: () => {
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
        (c.ceo_name && c.ceo_name.toLowerCase().includes(q)) ||
        (c.workshop_code && c.workshop_code.includes(q))
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

  setModalTab(tab: 'identity' | 'documents' | 'governance' | 'fiscal_insurance' | 'treasury' | 'access'): void {
    this.activeModalTab = tab;
    if (this.companyModal.data.id) {
      if (tab === 'treasury' && this.companyBankAccounts.length === 0) {
        this.loadCompanyBankAccounts(this.companyModal.data.id);
      } else if (tab === 'access' && this.studioAccesses.length === 0) {
        this.loadStudioAccesses(this.companyModal.data.id);
      }
    }
    this.cdr.markForCheck();
  }

  // انتخاب تاریخ‌های تقویم شمسی جلالی
  onRegDateSelect(event: any): void {
    this.companyModal.data.registration_date = typeof event === 'string' ? event : (event?.shamsi || event?.gregorian || '');
    this.isRegDatePickerOpen = false;
    this.cdr.markForCheck();
  }

  onBoardExpiryDateSelect(event: any): void {
    this.companyModal.data.board_term_expiry = typeof event === 'string' ? event : (event?.shamsi || event?.gregorian || '');
    this.isBoardDatePickerOpen = false;
    this.cdr.markForCheck();
  }

  onDocIssueDateSelect(event: any): void {
    this.newDoc.issue_date = typeof event === 'string' ? event : (event?.shamsi || event?.gregorian || '');
    this.isDocIssueDatePickerOpen = false;
    this.cdr.markForCheck();
  }

  onDocExpiryDateSelect(event: any): void {
    this.newDoc.expiry_date = typeof event === 'string' ? event : (event?.shamsi || event?.gregorian || '');
    this.isDocExpiryDatePickerOpen = false;
    this.cdr.markForCheck();
  }

  openCreateModal(): void {
    this.selectedLogoFile = null;
    this.logoPreviewUrl = null;
    this.activeModalTab = 'identity';
    this.companyDocuments = [];
    this.filteredDocuments = [];
    this.companyBankAccounts = [];
    this.studioAccesses = [];
    this.newAccount = this.getEmptyBankAccountData();
    this.isEditingAccount = false;
    this.editingAccountId = null;
    this.shebaValidationResult = null;
    this.newDoc = this.getEmptyDocData();
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
    this.activeModalTab = 'identity';
    this.newDoc = this.getEmptyDocData();
    this.newAccount = this.getEmptyBankAccountData();
    this.isEditingAccount = false;
    this.editingAccountId = null;
    this.shebaValidationResult = null;

    this.companyModal = {
      isOpen: true,
      isEdit: true,
      isSubmitting: false,
      data: {
        id: company.id,
        code: company.code,
        name: company.name,
        company_type: company.company_type || 'private_joint_stock',
        national_id: company.national_id || '',
        economic_code: company.economic_code || '',
        registration_number: company.registration_number || '',
        registration_date: company.registration_date || '',
        registered_capital: company.registered_capital || null,
        shares_count: company.shares_count || null,
        share_nominal_value: company.share_nominal_value || null,
        fiscal_year_start_month: company.fiscal_year_start_month || 1,
        phone: company.phone || '',
        address: company.address || '',
        postal_code: company.postal_code || '',
        ceo_name: company.ceo_name || '',
        board_chairman: company.board_chairman || '',
        board_vice_chairman: company.board_vice_chairman || '',
        main_inspector: company.main_inspector || '',
        alternate_inspector: company.alternate_inspector || '',
        authorized_signers: company.authorized_signers || '',
        board_term_expiry: company.board_term_expiry || '',
        workshop_code: company.workshop_code || '',
        social_security_branch_code: company.social_security_branch_code || '',
        social_security_branch_name: company.social_security_branch_name || '',
        contract_row: company.contract_row || '',
        employer_name: company.employer_name || '',
        tax_memory_id: company.tax_memory_id || '',
        tax_economic_code: company.tax_economic_code || '',
        primary_bank_name: company.primary_bank_name || '',
        primary_account_number: company.primary_account_number || '',
        primary_iban: company.primary_iban || '',
        articles_of_association: company.articles_of_association || null,
        latest_gazette: company.latest_gazette || null,
        is_active: company.is_active,
        has_warehouse_module: company.has_warehouse_module !== false,
        logo: company.logo || null
      },
      errors: {}
    };

    if (company.id) {
      this.loadCompanyDocuments(company.id);
      this.loadCompanyBankAccounts(company.id);
      this.loadStudioAccesses(company.id);
    }

    this.cdr.markForCheck();
  }

  closeCompanyModal(): void {
    this.companyModal.isOpen = false;
    this.selectedLogoFile = null;
    this.logoPreviewUrl = null;
    this.companyDocuments = [];
    this.filteredDocuments = [];
    this.companyBankAccounts = [];
    this.studioAccesses = [];
    this.isRegDatePickerOpen = false;
    this.isBoardDatePickerOpen = false;
    this.isDocIssueDatePickerOpen = false;
    this.isDocExpiryDatePickerOpen = false;
    this.isBankDropdownOpen = false;
    this.cdr.markForCheck();
  }

  // بارگذاری اسناد آرشیو شرکت
  loadCompanyDocuments(companyId: number): void {
    this.isLoadingDocuments = true;
    this.api.getDocuments({ company_id: companyId }).subscribe({
      next: (res) => {
        this.isLoadingDocuments = false;
        if (Array.isArray(res)) {
          this.companyDocuments = res;
        } else if (res && Array.isArray((res as any).results)) {
          this.companyDocuments = (res as any).results;
        } else {
          this.companyDocuments = [];
        }
        this.applyDocumentFilters();
        this.cdr.markForCheck();
      },
      error: () => {
        this.isLoadingDocuments = false;
        this.toast.error('خطا در دریافت اسناد شرکت');
        this.cdr.markForCheck();
      }
    });
  }

  // فیلتر زنده مدارک بر اساس جستجو و نوع مدرک
  applyDocumentFilters(): void {
    let docs = [...this.companyDocuments];
    if (this.selectedDocTypeFilter) {
      docs = docs.filter(d => d.document_type === this.selectedDocTypeFilter);
    }
    if (this.docSearchQuery.trim()) {
      const q = this.docSearchQuery.trim().toLowerCase();
      docs = docs.filter(d =>
        (d.title && d.title.toLowerCase().includes(q)) ||
        (d.description && d.description.toLowerCase().includes(q)) ||
        (d.document_type_display && d.document_type_display.toLowerCase().includes(q))
      );
    }
    this.filteredDocuments = docs;
    this.cdr.markForCheck();
  }

  onDocFilterChange(): void {
    this.applyDocumentFilters();
  }

  clearDocFilter(): void {
    this.docSearchQuery = '';
    this.selectedDocTypeFilter = '';
    this.applyDocumentFilters();
  }

  // پیش‌نمایش درجا (In-Place Preview)
  openPreview(doc: CompanyDocument): void {
    const url = doc.file_url || doc.file;
    if (!url) {
      this.toast.warning('فایل مدرک در دسترس نیست.');
      return;
    }
    const isPdf = url.toLowerCase().includes('.pdf') || doc.title.toLowerCase().includes('.pdf');
    this.previewModal = {
      isOpen: true,
      title: doc.title,
      fileUrl: url,
      isPdf
    };
    this.cdr.markForCheck();
  }

  closePreview(): void {
    this.previewModal = {
      isOpen: false,
      title: '',
      fileUrl: '',
      isPdf: false
    };
    this.cdr.markForCheck();
  }

  // ═════════════════════════════════════════════════════════════════════
  // مدیریت حساب‌های بانکی و شبای شرکت (چند حسابی)
  // ═════════════════════════════════════════════════════════════════════
  loadCompanyBankAccounts(companyId: number): void {
    this.isLoadingBankAccounts = true;
    this.api.getBankAccounts(companyId).subscribe({
      next: (res) => {
        this.isLoadingBankAccounts = false;
        if (Array.isArray(res)) {
          this.companyBankAccounts = res;
        } else if (res && Array.isArray((res as any).results)) {
          this.companyBankAccounts = (res as any).results;
        } else {
          this.companyBankAccounts = [];
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.isLoadingBankAccounts = false;
        this.toast.error('خطا در دریافت حساب‌های بانکی شرکت');
        this.cdr.markForCheck();
      }
    });
  }

  onShebaInput(val: string): void {
    const cleaned = cleanShebaInput(val);
    this.newAccount.sheba_number = cleaned;
    if (!cleaned) {
      this.shebaValidationResult = null;
      return;
    }

    const digits = extractShebaDigits(cleaned);
    this.shebaValidationResult = validateSheba(digits);

    if (this.shebaValidationResult?.bank) {
      this.newAccount.bank_name = this.shebaValidationResult.bank.name;
    }
    if (this.shebaValidationResult?.accountNumber) {
      this.newAccount.account_number = this.shebaValidationResult.accountNumber;
    }
    this.cdr.markForCheck();
  }

  selectBankForAccount(bank: IranianBankInfo): void {
    this.newAccount.bank_name = bank.name;
    this.isBankDropdownOpen = false;
    this.onAccountNumberInput();
    this.cdr.markForCheck();
  }

  filterBanks(): IranianBankInfo[] {
    if (!this.bankSearchQuery.trim()) {
      return this.iranianBanksList;
    }
    const q = this.bankSearchQuery.trim().toLowerCase();
    return this.iranianBanksList.filter(b =>
      b.name.toLowerCase().includes(q) ||
      b.shortName.toLowerCase().includes(q) ||
      b.code.includes(q)
    );
  }

  onAccountNumberInput(): void {
    if (this.newAccount.bank_name && this.newAccount.account_number) {
      const bankInfo = getBankByName(this.newAccount.bank_name);
      if (bankInfo) {
        const generated = generateShebaFromAccount(bankInfo.code, this.newAccount.account_number);
        if (generated) {
          this.newAccount.sheba_number = generated;
          this.shebaValidationResult = validateSheba(generated);
        }
      }
    }
    this.cdr.markForCheck();
  }

  copySheba(sheba: string, id?: number | string): void {
    if (!sheba) return;
    navigator.clipboard.writeText(sheba).then(() => {
      this.copiedShebaId = id ?? null;
      this.copiedSheba = sheba;
      this.toast.success('شماره شبا در حافظه کپی شد.');
      setTimeout(() => {
        this.copiedShebaId = null;
        this.copiedSheba = null;
        this.cdr.markForCheck();
      }, 2500);
      this.cdr.markForCheck();
    }).catch(() => {
      this.toast.error('امکان کپی در حافظه وجود ندارد.');
    });
  }

  saveBankAccount(): void {
    if (!this.companyModal.data.id) {
      this.toast.warning('لطفاً ابتدا شرکت را ذخیره فرمایید.');
      return;
    }
    if (!this.newAccount.sheba_number.trim()) {
      this.toast.warning('لطفاً شماره شبا را وارد فرمایید.');
      return;
    }

    const shebaVal = validateSheba(this.newAccount.sheba_number);
    if (!shebaVal.isValid) {
      this.toast.error(shebaVal.errorMessage || 'شماره شبا نامعتبر است.');
      return;
    }

    this.isSavingBankAccount = true;
    const payload: Partial<CompanyBankAccount> = {
      company: this.companyModal.data.id,
      bank_name: this.newAccount.bank_name.trim() || (shebaVal.bank?.name || 'نامشخص'),
      account_number: this.newAccount.account_number.trim() || shebaVal.accountNumber || null,
      sheba_number: shebaVal.formattedSheba.replace(/\s+/g, ''),
      account_title: this.newAccount.account_title?.trim() || null,
      is_primary: this.newAccount.is_primary,
      is_active: true
    };

    if (this.isEditingAccount && this.editingAccountId) {
      this.api.updateBankAccount(this.editingAccountId, payload).subscribe({
        next: (saved) => {
          this.isSavingBankAccount = false;
          this.toast.success(`حساب بانکی «${saved.bank_name}» با موفقیت ویرایش شد.`);
          this.cancelEditAccount();
          this.loadCompanyBankAccounts(this.companyModal.data.id!);
          this.loadCompanies();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.isSavingBankAccount = false;
          const msg = err.error?.detail || err.error?.sheba_number?.[0] || 'خطا در ویرایش حساب بانکی';
          this.toast.error(msg);
          this.cdr.markForCheck();
        }
      });
    } else {
      this.api.createBankAccount(payload).subscribe({
        next: (created) => {
          this.isSavingBankAccount = false;
          this.toast.success(`حساب بانکی «${created.bank_name}» با موفقیت افزوده شد.`);
          this.cancelEditAccount();
          this.loadCompanyBankAccounts(this.companyModal.data.id!);
          this.loadCompanies();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.isSavingBankAccount = false;
          const msg = err.error?.detail || err.error?.sheba_number?.[0] || 'خطا در ثبت حساب بانکی';
          this.toast.error(msg);
          this.cdr.markForCheck();
        }
      });
    }
  }

  editAccount(acc: CompanyBankAccount): void {
    this.isEditingAccount = true;
    this.editingAccountId = acc.id || null;
    this.newAccount = {
      id: acc.id,
      bank_name: acc.bank_name,
      account_number: acc.account_number || '',
      sheba_number: acc.sheba_number,
      account_title: acc.account_title || '',
      is_primary: acc.is_primary
    };
    this.shebaValidationResult = validateSheba(acc.sheba_number);
    this.cdr.markForCheck();
  }

  cancelEditAccount(): void {
    this.isEditingAccount = false;
    this.editingAccountId = null;
    this.newAccount = this.getEmptyBankAccountData();
    this.shebaValidationResult = null;
    this.cdr.markForCheck();
  }

  deleteBankAccount(acc: CompanyBankAccount): void {
    if (!acc.id) return;
    if (!confirm(`آیا از حذف حساب بانکی «${acc.bank_name}» با شماره شبای «${acc.sheba_number}» اطمینان دارید؟`)) return;
    this.api.deleteBankAccount(acc.id).subscribe({
      next: () => {
        this.toast.success('حساب بانکی با موفقیت حذف شد.');
        if (this.companyModal.data.id) {
          this.loadCompanyBankAccounts(this.companyModal.data.id);
        }
        this.loadCompanies();
      },
      error: () => this.toast.error('خطا در حذف حساب بانکی')
    });
  }

  setPrimaryAccount(acc: CompanyBankAccount): void {
    if (!acc.id) return;
    this.api.setPrimaryBankAccount(acc.id).subscribe({
      next: () => {
        this.toast.success(`حساب «${acc.bank_name}» به عنوان حساب اصلی شرکت تنظیم شد.`);
        if (this.companyModal.data.id) {
          this.loadCompanyBankAccounts(this.companyModal.data.id);
        }
        this.loadCompanies();
      },
      error: () => this.toast.error('خطا در تنظیم حساب اصلی')
    });
  }

  private getEmptyBankAccountData() {
    return {
      id: undefined as number | undefined,
      bank_name: '',
      account_number: '',
      sheba_number: '',
      account_title: '',
      is_primary: false
    };
  }

  // ═════════════════════════════════════════════════════════════════════
  // مدیریت دسترسی‌های کاربران در استودیو (تب ششم)
  // ═════════════════════════════════════════════════════════════════════
  loadStudioAccesses(companyId: number): void {
    this.isLoadingStudioAccesses = true;
    this.api.getUserAccesses({ company_id: companyId }).subscribe({
      next: (res) => {
        this.isLoadingStudioAccesses = false;
        this.studioAccesses = res;
        this.cdr.markForCheck();
      },
      error: () => {
        this.isLoadingStudioAccesses = false;
        this.toast.error('خطا در بارگذاری دسترسی‌های کاربران شرکت');
        this.cdr.markForCheck();
      }
    });
  }

  addStudioAccess(): void {
    if (!this.companyModal.data.id || !this.studioSelectedUserId) {
      this.toast.warning('لطفاً کاربر مورد نظر را انتخاب نمایید.');
      return;
    }
    this.api.createUserAccess({
      user: this.studioSelectedUserId,
      company: this.companyModal.data.id,
      is_default: this.studioIsDefaultAccess
    }).subscribe({
      next: () => {
        this.studioSelectedUserId = null;
        this.toast.success('دسترسی کاربر با موفقیت اضافه شد.');
        this.loadStudioAccesses(this.companyModal.data.id!);
      },
      error: (err) => {
        const msg = err.error?.detail || err.error?.non_field_errors?.[0] || 'خطا در ثبت دسترسی کاربر';
        this.toast.error(msg);
      }
    });
  }

  removeStudioAccess(accessId?: number): void {
    if (!accessId) return;
    if (!confirm('آیا از لغو دسترسی این کاربر اطمینان دارید؟')) return;
    this.api.deleteUserAccess(accessId).subscribe({
      next: () => {
        this.toast.success('دسترسی کاربر لغو شد.');
        if (this.companyModal.data.id) {
          this.loadStudioAccesses(this.companyModal.data.id);
        }
      },
      error: () => this.toast.error('خطا در لغو دسترسی')
    });
  }

  filterSystemUsers(): User[] {
    if (!this.userSearchQuery.trim()) {
      return this.systemUsers;
    }
    const q = this.userSearchQuery.trim().toLowerCase();
    return this.systemUsers.filter(u =>
      (u.username && u.username.toLowerCase().includes(q)) ||
      (u.first_name && u.first_name.toLowerCase().includes(q)) ||
      (u.last_name && u.last_name.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q))
    );
  }

  onDocFileSelected(event: any): void {
    const file = event.target?.files?.[0];
    if (file) {
      this.newDoc.file = file;
    }
  }

  uploadNewDocument(): void {
    if (!this.companyModal.data.id) {
      this.toast.warning('لطفاً ابتدا شرکت را ذخیره فرمایید.');
      return;
    }
    if (!this.newDoc.file) {
      this.toast.warning('لطفاً فایل مدرک را انتخاب فرمایید.');
      return;
    }
    if (!this.newDoc.title.trim()) {
      this.toast.warning('لطفاً عنوان مدرک را وارد فرمایید.');
      return;
    }

    this.isUploadingDoc = true;
    const formData = new FormData();
    formData.append('company', String(this.companyModal.data.id));
    formData.append('document_type', this.newDoc.document_type);
    formData.append('title', this.newDoc.title.trim());
    formData.append('file', this.newDoc.file);
    if (this.newDoc.issue_date) formData.append('issue_date', this.newDoc.issue_date);
    if (this.newDoc.expiry_date) formData.append('expiry_date', this.newDoc.expiry_date);
    formData.append('is_confidential', String(this.newDoc.is_confidential));
    if (this.newDoc.description) formData.append('description', this.newDoc.description);

    this.api.createDocument(formData).subscribe({
      next: (created) => {
        this.isUploadingDoc = false;
        this.toast.success(`مدرک «${created.title}» با موفقیت در آرشیو ثبت شد.`);
        this.newDoc = this.getEmptyDocData();
        this.loadCompanyDocuments(this.companyModal.data.id!);
        this.loadCompanies();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isUploadingDoc = false;
        const msg = err.error?.detail || err.error?.file?.[0] || 'خطا در بارگذاری مدرک';
        this.toast.error(msg);
        this.cdr.markForCheck();
      }
    });
  }

  deleteCompanyDocument(doc: CompanyDocument): void {
    if (!confirm(`آیا از حذف مدرک «${doc.title}» اطمینان دارید؟`)) return;
    this.api.deleteDocument(doc.id).subscribe({
      next: () => {
        this.toast.success('مدرک با موفقیت حذف شد.');
        if (this.companyModal.data.id) {
          this.loadCompanyDocuments(this.companyModal.data.id);
        }
        this.loadCompanies();
      },
      error: () => this.toast.error('خطا در حذف مدرک')
    });
  }

  onCoreDocSelected(event: any, docType: 'articles_of_association' | 'latest_gazette'): void {
    const file = event.target?.files?.[0];
    if (!file || !this.companyModal.data.id) return;

    this.api.uploadCoreDoc(this.companyModal.data.id, docType, file).subscribe({
      next: (res) => {
        const title = docType === 'articles_of_association' ? 'اساسنامه' : 'روزنامه رسمی';
        this.toast.success(`فایل ${title} با موفقیت بارگذاری شد.`);
        if (docType === 'articles_of_association') {
          this.companyModal.data.articles_of_association = res.articles_of_association;
        } else {
          this.companyModal.data.latest_gazette = res.latest_gazette;
        }
        this.loadCompanies();
        this.cdr.markForCheck();
      },
      error: () => this.toast.error('خطا در بارگذاری فایل')
    });
  }

  formatBytes(bytes?: number): string {
    if (!bytes || bytes === 0) return '—';
    const k = 1024;
    const sizes = ['بایت', 'کیلوبایت', 'مگابایت', 'گیگابایت'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  getDocStatusClass(status?: string): string {
    switch (status) {
      case 'valid': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'expiring_soon': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'expired': return 'bg-rose-50 text-rose-700 border-rose-200';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  }

  getDocStatusLabel(status?: string): string {
    switch (status) {
      case 'valid': return 'معتبر';
      case 'expiring_soon': return 'نزدیک انقضا';
      case 'expired': return 'منقضی شده';
      default: return 'بدون سررسید';
    }
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
    const d = this.companyModal.data;
    const payload = {
      code: d.code.trim().toUpperCase(),
      name: d.name.trim(),
      company_type: d.company_type || 'private_joint_stock',
      national_id: d.national_id?.trim() || null,
      economic_code: d.economic_code?.trim() || null,
      registration_number: d.registration_number?.trim() || null,
      registration_date: d.registration_date || null,
      registered_capital: d.registered_capital || null,
      shares_count: d.shares_count || null,
      share_nominal_value: d.share_nominal_value || null,
      fiscal_year_start_month: Number(d.fiscal_year_start_month) || 1,
      phone: d.phone?.trim() || null,
      address: d.address?.trim() || null,
      postal_code: d.postal_code?.trim() || null,
      ceo_name: d.ceo_name?.trim() || null,
      board_chairman: d.board_chairman?.trim() || null,
      board_vice_chairman: d.board_vice_chairman?.trim() || null,
      main_inspector: d.main_inspector?.trim() || null,
      alternate_inspector: d.alternate_inspector?.trim() || null,
      authorized_signers: d.authorized_signers?.trim() || null,
      board_term_expiry: d.board_term_expiry || null,
      workshop_code: d.workshop_code?.trim() || null,
      social_security_branch_code: d.social_security_branch_code?.trim() || null,
      social_security_branch_name: d.social_security_branch_name?.trim() || null,
      contract_row: d.contract_row?.trim() || null,
      employer_name: d.employer_name?.trim() || null,
      tax_memory_id: d.tax_memory_id?.trim() || null,
      tax_economic_code: d.tax_economic_code?.trim() || null,
      primary_bank_name: d.primary_bank_name?.trim() || null,
      primary_account_number: d.primary_account_number?.trim() || null,
      primary_iban: d.primary_iban?.trim() || null,
      is_active: d.is_active,
      has_warehouse_module: d.has_warehouse_module
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
    this.api.exportExcel().subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `companies_${new Date().getTime()}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        this.toast.success('فایل اکسل با موفقیت دانلود شد.');
      },
      error: () => {
        this.toast.error('خطا در دریافت خروجی اکسل شرکت‌ها');
      }
    });
  }

  importExcel(): void {
    this.toast.info('امکان ورود اطلاعات شرکت‌ها از اکسل در این نسخه آماده است.');
  }

  // مدیریت دسترسی کاربران (UserCompanyAccess)
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
    this.cdr.markForCheck();
  }

  closeUserAccessModal(): void {
    this.userAccessModal.isOpen = false;
    this.userAccessModal.company = null;
    this.userAccessModal.accesses = [];
    this.cdr.markForCheck();
  }

  private loadSystemUsers(): void {
    if (this.accountsHttp) {
      this.accountsHttp.getUsers().subscribe({
        next: (users) => {
          this.systemUsers = users;
        },
        error: () => {}
      });
    }
  }

  private loadUserAccesses(companyId: number): void {
    this.userAccessModal.isLoading = true;
    this.api.getUserAccesses({ company_id: companyId }).subscribe({
      next: (res) => {
        this.userAccessModal.isLoading = false;
        this.userAccessModal.accesses = res;
        this.cdr.markForCheck();
      },
      error: () => {
        this.userAccessModal.isLoading = false;
        this.toast.error('خطا در بارگذاری دسترسی‌های کاربران');
      }
    });
  }

  addUserAccess(): void {
    if (!this.userAccessModal.company || !this.userAccessModal.selectedUserId) {
      this.toast.warning('لطفاً کاربر مورد نظر را انتخاب نمایید.');
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
      company_type: 'private_joint_stock',
      national_id: '',
      economic_code: '',
      registration_number: '',
      registration_date: '',
      registered_capital: null,
      shares_count: null,
      share_nominal_value: null,
      fiscal_year_start_month: 1,
      phone: '',
      address: '',
      postal_code: '',
      ceo_name: '',
      board_chairman: '',
      board_vice_chairman: '',
      main_inspector: '',
      alternate_inspector: '',
      authorized_signers: '',
      board_term_expiry: '',
      workshop_code: '',
      social_security_branch_code: '',
      social_security_branch_name: '',
      contract_row: '',
      employer_name: '',
      tax_memory_id: '',
      tax_economic_code: '',
      primary_bank_name: '',
      primary_account_number: '',
      primary_iban: '',
      articles_of_association: null,
      latest_gazette: null,
      is_active: true,
      has_warehouse_module: true
    };
  }

  private getEmptyDocData(): {
    document_type: CompanyDocumentType;
    title: string;
    file: File | null;
    issue_date: string;
    expiry_date: string;
    is_confidential: boolean;
    description: string;
  } {
    return {
      document_type: 'statute',
      title: '',
      file: null,
      issue_date: '',
      expiry_date: '',
      is_confidential: false,
      description: ''
    };
  }
}
