import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { StateService } from '../../../../services/state.service';
import { ToastService } from '../../../../shared/components/toast/toast.component';
import { PersonnelApiService } from '../../../../core/api/personnel-api.service';
import { ProjectSection } from '../../../../core/models/personnel.model';

export interface DisbursementQueueItem {
  id: number;
  type: 'payroll' | 'fleet';
  title: string;
  recipient_name: string;
  sheba_number: string;
  bank_name: string;
  section_name: string;
  amount: number;
  approved_by_manager: boolean;
  status: 'pending_payment' | 'paid';
  tracking_code?: string;
  payment_date?: string;
}

@Component({
  selector: 'app-treasurer-disbursements-hub',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './treasurer-disbursements.html',
  styleUrl: './treasurer-disbursements.css'
})
export class TreasurerDisbursementsComponent implements OnInit, OnDestroy {
  activeSubTab: 'pending_queue' | 'disbursed_archive' = 'pending_queue';

  // Section Isolation
  mySections: ProjectSection[] = [];
  selectedSectionId: number | null = null;
  selectedSection: ProjectSection | null = null;
  isLoadingSections = false;

  // Fiscal Context & Filters
  searchQuery = '';
  fiscalYear = '1405';
  selectedMonth = 'تیر';
  selectedPaymentType: 'all' | 'payroll' | 'fleet' = 'all';

  // State
  isLoading = false;
  items: DisbursementQueueItem[] = [
    {
      id: 1,
      type: 'payroll',
      title: 'حقوق تیر ماه ۱۴۰۵',
      recipient_name: 'علیرضا شمس',
      sheba_number: 'IR120120000000001234567890',
      bank_name: 'بانک ملت',
      section_name: 'بخش لجستیک و انبار مرکزی',
      amount: 28450000,
      approved_by_manager: true,
      status: 'pending_payment'
    },
    {
      id: 2,
      type: 'payroll',
      title: 'حقوق تیر ماه ۱۴۰۵',
      recipient_name: 'محمد مرادی',
      sheba_number: 'IR340180000000009876543210',
      bank_name: 'بانک تجارت',
      section_name: 'بخش تخلیه و بارگیری اسکله',
      amount: 23100000,
      approved_by_manager: true,
      status: 'pending_payment'
    },
    {
      id: 3,
      type: 'fleet',
      title: 'تسویه اجاره و کارکرد کشنده اسکانیا',
      recipient_name: 'حسین اسماعیلی',
      sheba_number: 'IR560170000000005544332211',
      bank_name: 'بانک ملی',
      section_name: 'بخش ترابری سنگین',
      amount: 112500000,
      approved_by_manager: true,
      status: 'pending_payment'
    },
    {
      id: 4,
      type: 'payroll',
      title: 'حقوق تیر ماه ۱۴۰۵',
      recipient_name: 'سعید رضایی',
      sheba_number: 'IR780190000000003322114455',
      bank_name: 'بانک صادرات',
      section_name: 'بخش اداری و پشتیبانی فنی',
      amount: 21800000,
      approved_by_manager: true,
      status: 'paid',
      tracking_code: 'TRK-9842105',
      payment_date: '1405/04/28'
    }
  ];

  // Pay Single Modal
  isPayModalOpen = false;
  payingItem: DisbursementQueueItem | null = null;
  paymentMethod = 'PAYA';
  trackingCodeInput = '';

  private routeSub?: Subscription;

  constructor(
    public auth: AuthService,
    public state: StateService,
    private toast: ToastService,
    private personnelApi: PersonnelApiService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.routeSub = this.route.queryParams.subscribe(params => {
      if (params['tab'] && ['pending_queue', 'disbursed_archive'].includes(params['tab'])) {
        this.activeSubTab = params['tab'];
      }
      if (params['section_id']) {
        this.selectedSectionId = Number(params['section_id']);
      }
      if (params['q']) {
        this.searchQuery = params['q'];
      }
    });

    this.loadSections();
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  loadSections(): void {
    this.isLoadingSections = true;
    this.personnelApi.getMySections().subscribe({
      next: (sections: ProjectSection[]) => {
        this.mySections = sections || [];
        if (this.mySections.length === 0) {
          this.personnelApi.getProjectSections({ is_active: true }).subscribe({
            next: (allSecs: ProjectSection[]) => {
              this.mySections = allSecs || [];
              this.pickDefaultSection();
            },
            error: () => {
              this.isLoadingSections = false;
            }
          });
          return;
        }
        this.pickDefaultSection();
      },
      error: () => {
        this.isLoadingSections = false;
      }
    });
  }

  private pickDefaultSection(): void {
    if (this.mySections.length > 0) {
      if (!this.selectedSectionId || !this.mySections.some(s => s.id === this.selectedSectionId)) {
        this.selectedSectionId = this.mySections[0]?.id ?? null;
      }
      this.selectedSection = this.mySections.find(s => s.id === this.selectedSectionId) || null;
    }
    this.isLoadingSections = false;
  }

  onSectionChanged(): void {
    this.selectedSection = this.mySections.find(s => s.id === Number(this.selectedSectionId)) || null;
    this.syncUrlParams();
  }

  switchSubTab(tab: 'pending_queue' | 'disbursed_archive'): void {
    this.activeSubTab = tab;
    this.syncUrlParams();
  }

  syncUrlParams(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        tab: this.activeSubTab,
        section_id: this.selectedSectionId || null,
        q: this.searchQuery ? this.searchQuery : null
      },
      queryParamsHandling: 'merge'
    });
  }

  get filteredItems(): DisbursementQueueItem[] {
    let list = this.items;
    if (this.activeSubTab === 'pending_queue') {
      list = list.filter(x => x.status === 'pending_payment');
    } else {
      list = list.filter(x => x.status === 'paid');
    }

    if (this.selectedPaymentType !== 'all') {
      list = list.filter(x => x.type === this.selectedPaymentType);
    }

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.trim().toLowerCase();
      list = list.filter(x =>
        x.recipient_name.toLowerCase().includes(q) ||
        x.sheba_number.toLowerCase().includes(q) ||
        x.title.toLowerCase().includes(q)
      );
    }
    return list;
  }

  get pendingTotalAmount(): number {
    return this.items
      .filter(x => x.status === 'pending_payment')
      .reduce((sum, item) => sum + item.amount, 0);
  }

  openPayModal(item: DisbursementQueueItem): void {
    this.payingItem = item;
    this.trackingCodeInput = 'TRK-' + Math.floor(1000000 + Math.random() * 9000000);
    this.isPayModalOpen = true;
  }

  closePayModal(): void {
    this.isPayModalOpen = false;
    this.payingItem = null;
  }

  confirmDisbursement(): void {
    if (!this.payingItem) return;
    this.payingItem.status = 'paid';
    this.payingItem.tracking_code = this.trackingCodeInput;
    this.payingItem.payment_date = '1405/04/29';
    this.toast.success(`پرداخت مبلغ ${this.payingItem.amount.toLocaleString()} تومان به حساب شبا ${this.payingItem.recipient_name} ثبت و قطعی شد.`);
    this.closePayModal();
  }

  generateBatchPayaFile(): void {
    this.toast.success('فایل انتقال وجه بین‌بانکی پایا (فرمت شتاب/شبا) با موفقیت تولید و بارگیری شد.');
  }

  exportExcel(): void {
    this.toast.success('فایل اکسل ۲ ردیفه پرداخت‌های خزانه‌داری صادر گردید.');
  }

  refreshData(): void {
    this.isLoading = true;
    setTimeout(() => {
      this.isLoading = false;
      this.toast.info('صف دستور پرداخت‌های مصوب خزانه‌داری به‌روزرسانی شد.');
      this.cdr.detectChanges();
    }, 300);
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.syncUrlParams();
  }
}
