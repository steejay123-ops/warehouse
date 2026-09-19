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

export interface PayableInvoiceItem {
  id: number;
  invoice_number: string;
  vendor_name: string;
  category: string;
  section_name: string;
  amount: number;
  due_date: string;
  sheba_number: string;
  status: 'pending_payment' | 'paid';
  tracking_code?: string;
}

export interface PettyCashRefillItem {
  id: number;
  custodian_name: string;
  section_name: string;
  ceiling_limit: number;
  current_balance: number;
  requested_refill_amount: number;
  card_number: string;
  status: 'pending_refill' | 'refilled';
  tracking_code?: string;
}

@Component({
  selector: 'app-treasurer-invoices-hub',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './treasurer-invoices.html',
  styleUrl: './treasurer-invoices.css'
})
export class TreasurerInvoicesComponent implements OnInit, OnDestroy {
  activeSubTab: 'payable_invoices' | 'petty_cash_refills' = 'payable_invoices';

  // Section Isolation
  mySections: ProjectSection[] = [];
  selectedSectionId: number | null = null;
  selectedSection: ProjectSection | null = null;
  isLoadingSections = false;

  // Search & Filters
  searchQuery = '';
  fiscalYear = '1405';

  // State
  isLoading = false;

  // Mock Invoices
  invoices: PayableInvoiceItem[] = [
    {
      id: 1,
      invoice_number: 'INV-1405-091',
      vendor_name: 'فروشگاه لاستیک و روانکاران البرز',
      category: 'لجستیک و تعمیرات',
      section_name: 'بخش لجستیک و انبار مرکزی',
      amount: 48500000,
      due_date: '1405/04/30',
      sheba_number: 'IR210150000000004561237890',
      status: 'pending_payment'
    },
    {
      id: 2,
      invoice_number: 'INV-1405-094',
      vendor_name: 'پارس هیدرولیک جنوب',
      category: 'لوازم یدکی ماشین‌آلات',
      section_name: 'بخش ترابری سنگین',
      amount: 32000000,
      due_date: '1405/05/02',
      sheba_number: 'IR890180000000001122334455',
      status: 'pending_payment'
    }
  ];

  // Mock Petty Cash Refills
  refills: PettyCashRefillItem[] = [
    {
      id: 101,
      custodian_name: 'امیر حسینی (مسئول تن‌خواه انبار)',
      section_name: 'بخش لجستیک و انبار مرکزی',
      ceiling_limit: 50000000,
      current_balance: 4200000,
      requested_refill_amount: 45000000,
      card_number: '۶۰۳۷-۹۹۷۵-۱۲۳۴-۵۶۷۸',
      status: 'pending_refill'
    },
    {
      id: 102,
      custodian_name: 'فرشید نوری (مسئول تن‌خواه کارگاه)',
      section_name: 'بخش تخلیه و بارگیری اسکله',
      ceiling_limit: 40000000,
      current_balance: 6800000,
      requested_refill_amount: 33000000,
      card_number: '۶۲۱۹-۸۶۱۰-۹۸۷۶-۵۴۳۲',
      status: 'pending_refill'
    }
  ];

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
      if (params['tab'] && ['payable_invoices', 'petty_cash_refills'].includes(params['tab'])) {
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

  switchSubTab(tab: 'payable_invoices' | 'petty_cash_refills'): void {
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

  payInvoice(item: PayableInvoiceItem): void {
    item.status = 'paid';
    item.tracking_code = 'BNK-' + Math.floor(100000 + Math.random() * 900000);
    this.toast.success(`فاکتور ${item.invoice_number} به مبلغ ${item.amount.toLocaleString()} تومان تسویه گردید.`);
  }

  refillPettyCash(item: PettyCashRefillItem): void {
    item.status = 'refilled';
    item.tracking_code = 'REF-' + Math.floor(100000 + Math.random() * 900000);
    this.toast.success(`شارژ تن‌خواه به مبلغ ${item.requested_refill_amount.toLocaleString()} تومان به حساب ${item.custodian_name} واریز شد.`);
  }

  exportExcel(): void {
    this.toast.success('فایل اکسل تسویه فاکتورها و تن‌خواه صادر گردید.');
  }

  refreshData(): void {
    this.isLoading = true;
    setTimeout(() => {
      this.isLoading = false;
      this.toast.info('لیست فاکتورها و تن‌خواه‌ها همگام شد.');
      this.cdr.detectChanges();
    }, 300);
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.syncUrlParams();
  }
}
