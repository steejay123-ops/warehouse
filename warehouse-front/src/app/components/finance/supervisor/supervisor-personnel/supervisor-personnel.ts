import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { StateService } from '../../../../services/state.service';
import { ToastService } from '../../../../shared/components/toast/toast.component';
import { PersonnelApiService } from '../../../../core/api/personnel-api.service';
import { ProjectSection, PersonnelProfile, PersonnelChangeRequest } from '../../../../core/models/personnel.model';
import { WebSocketService } from '../../../../core/http/websocket.service';

export type SupervisorPersonnelSubTab = 'new' | 'attendance' | 'changes' | 'all';

@Component({
  selector: 'app-supervisor-personnel-hub',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './supervisor-personnel.html',
  styleUrl: './supervisor-personnel.css'
})
export class SupervisorPersonnelHubComponent implements OnInit, OnDestroy {
  activeSubTab: SupervisorPersonnelSubTab = 'new';

  mySections: ProjectSection[] = [];
  selectedSectionId: number | null = null;
  selectedSection: ProjectSection | null = null;
  isLoadingSections = false;

  searchQuery = '';
  selectedDateShamsi = '';
  fiscalYear = '1405';
  isLoading = false;

  // لیست‌های داده
  newPersonnelList: PersonnelProfile[] = [];
  attendanceList: any[] = [];
  changeRequestsList: PersonnelChangeRequest[] = [];
  allPersonnelList: PersonnelProfile[] = [];

  // شمارنده‌های زنده کارتابل
  statusCounters = {
    newCount: 0,
    attendanceCount: 0,
    changesCount: 0,
    allCount: 0
  };

  // پنجره ثبت یادداشت تایید (Approval Modal)
  isApprovalModalOpen = false;
  approvalTarget: { type: 'new' | 'attendance' | 'changes'; item: any; title: string } | null = null;
  approvalNote = '';
  isApproving = false;

  // پنجره ثبت علت عودت یا رد (Reject / Revision Modal)
  isRejectModalOpen = false;
  rejectTarget: { type: 'new' | 'attendance' | 'changes'; item: any; action: 'reject' | 'revision'; title: string } | null = null;
  rejectReason = '';
  isRejecting = false;

  // پنجره مقایسه تغییرات (Diff Viewer Modal)
  isDiffModalOpen = false;
  selectedDiffCR: PersonnelChangeRequest | null = null;
  diffFieldRows: Array<{
    field_name: string;
    field_label: string;
    old_value: any;
    new_value: any;
    is_changed: boolean;
  }> = [];

  copiedId: number | null = null;

  private routeSub?: Subscription;
  private wsSub?: Subscription;

  constructor(
    public auth: AuthService,
    public state: StateService,
    private toast: ToastService,
    private personnelApi: PersonnelApiService,
    private ws: WebSocketService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.routeSub = this.route.queryParams.subscribe(params => {
      if (params['tab'] && ['new', 'attendance', 'changes', 'all'].includes(params['tab'])) {
        this.activeSubTab = params['tab'] as SupervisorPersonnelSubTab;
      }
      if (params['section_id']) {
        this.selectedSectionId = Number(params['section_id']);
      }
      if (params['q']) {
        this.searchQuery = params['q'];
      }
    });

    this.wsSub = this.ws.notifications$.subscribe((msg: any) => {
      if (msg && (msg.type_str === 'personnel_updated' || msg.type === 'personnel_updated')) {
        if (!this.selectedSectionId || msg.section_id === this.selectedSectionId) {
          this.fetchData();
        }
      }
    });

    this.loadSections();
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    this.wsSub?.unsubscribe();
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
              this.fetchData();
            }
          });
          return;
        }
        this.pickDefaultSection();
      },
      error: () => {
        this.isLoadingSections = false;
        this.fetchData();
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
    this.fetchData();
  }

  onSectionChanged(): void {
    this.selectedSection = this.mySections.find(s => s.id === Number(this.selectedSectionId)) || null;
    this.syncUrlParams();
    this.fetchData();
  }

  switchSubTab(tab: SupervisorPersonnelSubTab): void {
    this.activeSubTab = tab;
    this.syncUrlParams();
    this.fetchData();
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

  fetchData(): void {
    this.isLoading = true;
    const baseParams: any = {};
    if (this.selectedSectionId) {
      baseParams.section_id = this.selectedSectionId;
    }
    if (this.searchQuery.trim()) {
      baseParams.search = this.searchQuery.trim();
    }

    // ۱. پرونده‌های جدید پرسنل در انتظار تایید سرپرست
    this.personnelApi.getPersonnelProfiles({ ...baseParams, approval_status: 'pending_supervisor,draft' }).subscribe({
      next: (pList: any[]) => {
        this.newPersonnelList = pList || [];
        this.statusCounters.newCount = this.newPersonnelList.length;
      },
      error: () => {
        this.newPersonnelList = [];
      }
    });

    // ۲. کارکرد روزانه پرسنل
    const attParams: any = { ...baseParams };
    if (this.selectedDateShamsi) {
      attParams.date_shamsi = this.selectedDateShamsi;
    }
    this.personnelApi.getDailyAttendance(attParams).subscribe({
      next: (attList: any[]) => {
        this.attendanceList = attList || [];
        this.statusCounters.attendanceCount = this.attendanceList.filter(a => a.supervisor_approved === false || a.status === 'pending').length;
      },
      error: () => {
        this.attendanceList = [];
      }
    });

    // ۳. درخواست‌های تغییرات پرسنل
    this.personnelApi.getPersonnelChangeRequests(baseParams).subscribe({
      next: (crList: any[]) => {
        this.changeRequestsList = crList || [];
        this.statusCounters.changesCount = this.changeRequestsList.filter(c => c.status === 'pending_supervisor').length;
      },
      error: () => {
        this.changeRequestsList = [];
      }
    });

    // ۴. تمام پرسنل بخش
    this.personnelApi.getPersonnelProfiles(baseParams).subscribe({
      next: (allList: any[]) => {
        this.allPersonnelList = allList || [];
        this.statusCounters.allCount = this.allPersonnelList.length;
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.allPersonnelList = [];
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  // ─── اکشن‌های تایید ───
  openApproveModal(type: 'new' | 'attendance' | 'changes', item: any): void {
    const title = type === 'new' 
      ? `تایید اولیه پرسنل: ${item.first_name || ''} ${item.last_name || ''}`
      : type === 'attendance'
      ? `تایید کارکرد روزانه: ${item.personnel_name || ''} (${item.date_shamsi || ''})`
      : `تایید درخواست تغییرات: ${item.personnel_name || ''}`;
    this.approvalTarget = { type, item, title };
    this.approvalNote = '';
    this.isApprovalModalOpen = true;
  }

  closeApproveModal(): void {
    this.isApprovalModalOpen = false;
    this.approvalTarget = null;
    this.approvalNote = '';
  }

  submitApproval(): void {
    if (!this.approvalTarget) return;
    this.isApproving = true;
    const { type, item } = this.approvalTarget;

    if (type === 'new') {
      this.personnelApi.approvePersonnelSupervisor(item.id, this.approvalNote).subscribe({
        next: () => {
          this.toast.showSuccess(`پرونده ${item.first_name || ''} ${item.last_name || ''} تایید و به حسابداری ارسال شد.`);
          this.isApproving = false;
          this.closeApproveModal();
          this.fetchData();
        },
        error: (err: any) => {
          this.isApproving = false;
          this.toast.showError(err?.error?.detail || 'خطا در ثبت تایید سرپرست');
        }
      });
    } else if (type === 'attendance') {
      this.personnelApi.patchDailyAttendance(item.id, { notes: this.approvalNote ? `${item.notes || ''} | تایید سرپرست: ${this.approvalNote}` : 'تایید سرپرست' }).subscribe({
        next: () => {
          this.toast.showSuccess('کارکرد روزانه با موفقیت تایید شد.');
          this.isApproving = false;
          this.closeApproveModal();
          this.fetchData();
        },
        error: (err: any) => {
          this.isApproving = false;
          this.toast.showError(err?.error?.detail || 'خطا در تایید کارکرد');
        }
      });
    } else if (type === 'changes') {
      this.personnelApi.approvePersonnelChangeRequestSupervisor(item.id, this.approvalNote).subscribe({
        next: () => {
          this.toast.showSuccess('درخواست تغییرات با موفقیت تایید شد.');
          this.isApproving = false;
          this.closeApproveModal();
          this.fetchData();
        },
        error: (err: any) => {
          this.isApproving = false;
          this.toast.showError(err?.error?.detail || 'خطا در تایید تغییرات');
        }
      });
    }
  }

  // ─── اکشن‌های عودت و رد ───
  openRejectModal(type: 'new' | 'attendance' | 'changes', item: any, action: 'reject' | 'revision'): void {
    const actionTitle = action === 'revision' ? 'عودت به بازنگری' : 'رد قطعی پرونده';
    const title = `${actionTitle}: ${item.first_name || item.personnel_name || ''} ${item.last_name || ''}`;
    this.rejectTarget = { type, item, action, title };
    this.rejectReason = '';
    this.isRejectModalOpen = true;
  }

  closeRejectModal(): void {
    this.isRejectModalOpen = false;
    this.rejectTarget = null;
    this.rejectReason = '';
  }

  submitReject(): void {
    if (!this.rejectTarget || !this.rejectReason.trim()) {
      this.toast.showWarning('لطفاً دلیل مستند عودت یا رد را وارد فرمایید.');
      return;
    }
    this.isRejecting = true;
    const { type, item, action } = this.rejectTarget;

    if (action === 'revision') {
      this.personnelApi.requestPersonnelRevision(item.id, this.rejectReason.trim()).subscribe({
        next: () => {
          this.toast.showSuccess('پرونده جهت بازنگری و اصلاح مدارک عودت داده شد.');
          this.isRejecting = false;
          this.closeRejectModal();
          this.fetchData();
        },
        error: (err: any) => {
          this.isRejecting = false;
          this.toast.showError(err?.error?.detail || 'خطا در عودت پرونده');
        }
      });
    } else {
      this.personnelApi.rejectPersonnel(item.id, this.rejectReason.trim()).subscribe({
        next: () => {
          this.toast.showSuccess('پرونده با موفقیت رد شد.');
          this.isRejecting = false;
          this.closeRejectModal();
          this.fetchData();
        },
        error: (err: any) => {
          this.isRejecting = false;
          this.toast.showError(err?.error?.detail || 'خطا در رد پرونده');
        }
      });
    }
  }

  // ─── پنجره مقایسه تغییرات (Diff Viewer) ───
  openDiffModal(cr: PersonnelChangeRequest): void {
    this.selectedDiffCR = cr;
    this.diffFieldRows = [];
    const proposed = (cr.proposed_changes || {}) as Record<string, any>;
    const current = (cr.previous_values || {}) as Record<string, any>;

    const allKeys = Array.from(new Set([...Object.keys(proposed), ...Object.keys(current)]));
    for (const key of allKeys) {
      if (['id', 'created_at', 'updated_at', 'personnel'].includes(key)) continue;
      const oldVal = current[key];
      const newVal = proposed[key];
      const isChanged = JSON.stringify(oldVal) !== JSON.stringify(newVal);
      this.diffFieldRows.push({
        field_name: key,
        field_label: this.getFieldLabel(key),
        old_value: oldVal ?? '—',
        new_value: newVal ?? '—',
        is_changed: isChanged
      });
    }
    this.isDiffModalOpen = true;
  }

  closeDiffModal(): void {
    this.isDiffModalOpen = false;
    this.selectedDiffCR = null;
    this.diffFieldRows = [];
  }

  getFieldLabel(field: string): string {
    const dict: Record<string, string> = {
      first_name: 'نام',
      last_name: 'نام خانوادگی',
      national_code: 'کد ملی',
      mobile: 'شماره موبایل',
      sheba_number: 'شماره شبا',
      bank_name: 'نام بانک',
      account_number: 'شماره حساب',
      contract_type: 'نوع قرارداد',
      job_title: 'عنوان شغلی',
      insurance_number: 'شماره بیمه'
    };
    return dict[field] || field;
  }

  copyToClipboard(text: string, id: number): void {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      this.copiedId = id;
      this.toast.showSuccess('در حافظه کپی شد: ' + text);
      setTimeout(() => {
        if (this.copiedId === id) this.copiedId = null;
        this.cdr.markForCheck();
      }, 2000);
    });
  }
}
