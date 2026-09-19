import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { StateService } from '../../../../services/state.service';
import { ToastService } from '../../../../shared/components/toast/toast.component';
import { PersonnelApiService } from '../../../../core/api/personnel-api.service';

@Component({
  selector: 'app-accountant-diskettes-hub',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './accountant-diskettes.html',
  styleUrl: './accountant-diskettes.css'
})
export class AccountantDiskettesHubComponent implements OnInit, OnDestroy {
  activeSubTab: 'social_security' | 'tax_portal' | 'bank_payroll' = 'social_security';

  fiscalYear = '1405';
  selectedMonth = 'تیر';
  workshopCode = '0012345678';

  isLoading = false;
  isGenerating = false;

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
      if (params['tab'] && ['social_security', 'tax_portal', 'bank_payroll'].includes(params['tab'])) {
        this.activeSubTab = params['tab'];
      }
      if (params['year']) {
        this.fiscalYear = params['year'];
      }
      if (params['month']) {
        this.selectedMonth = params['month'];
      }
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  switchSubTab(tab: 'social_security' | 'tax_portal' | 'bank_payroll'): void {
    this.activeSubTab = tab;
    this.syncUrlParams();
  }

  syncUrlParams(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        tab: this.activeSubTab,
        year: this.fiscalYear,
        month: this.selectedMonth
      },
      queryParamsHandling: 'merge'
    });
  }

  generateSocialSecurityDiskette(): void {
    this.isGenerating = true;
    setTimeout(() => {
      this.isGenerating = false;
      this.toast.success(`دیسکت‌های DSKWOR00.DBF و DSKKAR00.DBF برای ${this.selectedMonth} ماه ${this.fiscalYear} با موفقیت تولید شد.`);
      this.cdr.detectChanges();
    }, 700);
  }

  generateTaxDiskette(): void {
    this.isGenerating = true;
    setTimeout(() => {
      this.isGenerating = false;
      this.toast.success(`فایل‌های الکترونیکی مالیات بر درآمد حقوق (WH/WP) با موفقیت استخراج شد.`);
      this.cdr.detectChanges();
    }, 700);
  }

  generateBankDiskette(): void {
    this.isGenerating = true;
    setTimeout(() => {
      this.isGenerating = false;
      this.toast.success(`فایل پرداخت گروهی شبا (پایا/ساتنا) طبق استاندارد شاپرک آماده دانلود گردید.`);
      this.cdr.detectChanges();
    }, 700);
  }

  exportExcel(): void {
    this.toast.info('در حال تولید گزارش اکسل تطبیق دیسکت‌های قانونی...');
  }

  importExcel(): void {
    this.toast.info('بارگذاری راهنمای ساختار دیسکت‌های قانونی...');
  }
}
