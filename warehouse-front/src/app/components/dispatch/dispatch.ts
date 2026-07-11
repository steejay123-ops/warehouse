import { Component, OnInit, ChangeDetectorRef, ViewChild } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '../../services/state.service';
import { ToastService } from '../../services/toast.service';
import { DataTableComponent, TableColumnDirective } from '../../shared';
import { ItemApiService } from '../../core/api/item-api.service';
import { AuthService } from '../../core/auth/auth.service';
import { ConfirmDialogService, ConfirmDialogComponent } from '../../shared';

@Component({
  selector: 'app-dispatch',
  imports: [CommonModule, FormsModule, DataTableComponent, TableColumnDirective, ConfirmDialogComponent],
  templateUrl: './dispatch.html',
  styleUrl: './dispatch.css'
})
export class Dispatch implements OnInit {
  @ViewChild(DataTableComponent) dataTable!: DataTableComponent;

  newTagInput = '';
  
  fieldWorkers: any[] = [];
  supervisors: any[] = [];
  docWorkers: any[] = [];
  
  selectedFieldWorker = '';
  selectedSupervisor = '';
  selectedDocWorker = '';

  selectedItemIds: Set<string> = new Set();
  availableTagsList: {label: string, value: string}[] = [];

  isTagModalOpen = false;
  selectedItemsTags: string[] = [];

  // Server-side state
  items: any[] = [];
  totalItems = 0;
  currentPage = 1;
  pageSize = 100;
  isLoading = false;

  constructor(
    public state: StateService, 
    private toast: ToastService,
    private itemApi: ItemApiService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef,
    private confirmDialog: ConfirmDialogService
  ) {}

  ngOnInit() {
    // Field Workers (Counters)
    this.fieldWorkers = this.state.appState.users.filter((u: any) => u.roles?.includes('counter'));
    // Supervisors
    this.supervisors = this.state.appState.users.filter((u: any) => u.roles?.includes('supervisor'));
    // Doc and Price workers (combined team)
    this.docWorkers = this.state.appState.users.filter((u: any) => u.roles?.includes('document_expert') || u.roles?.includes('feeding_operator'));
    
    // Load column preferences
    const prefs = this.auth.user()?.ui_preferences?.dispatchSettings;
    if (prefs) {
      if (prefs.visibleCols) {
        // Validate columns against known defaults to prevent empty tables from old preferences
        const validCols = this.state.appState.dispatchSettings.visibleCols;
        const filteredCols = prefs.visibleCols.filter((c: string) => validCols.includes(c) || ['fa_unic_code', 'description', 'balance', 'old_location', 'labelStatus', 'fieldAssignee', 'fieldStatus', 'docAssignee', 'docStatus', 'tag', 'has_conflict', 'is_fragile', 'is_heavy', 'needs_qc', 'plpkitem', 'pl', 'po', 'pk_number', 'item_no', 'unit', 'scope_discipline', 'bal4miv', 'new_location', 'hov_no', 'hov_date', 'msr_status', 'vendor', 'supplier', 'irn_no', 'item2', 'inventory_status', 'indent', 'remark', 'price_amount', 'currency', 'invoice_file', 'invoice_page', 'customs_field', 'customs_file', 'customs_file_page', 'price_remark', 'issue_remark', 'created_at', 'updated_at', 'created_by_name', 'modified_by_name'].includes(c));
        if (filteredCols.length > 0) {
          this.state.appState.dispatchSettings.visibleCols = filteredCols;
        }
      }
      if (prefs.filters) this.state.appState.dispatchSettings.filters = prefs.filters;
      if (prefs.sort) this.state.appState.dispatchSettings.sort = prefs.sort;
    }

    this.loadItems();
  }

  loadItems() {
    this.isLoading = true;
    const filters: any = {};
    if (this.state.appState.activeWarehouseId !== 'ALL') {
      filters['warehouse'] = this.state.appState.activeWarehouseId;
    }

    // Add search filters
    const stateFilters = this.state.appState.dispatchSettings.filters;
    Object.keys(stateFilters).forEach(key => {
      if (stateFilters[key]) {
        // Do not send the UI label for date filters (e.g. hov_date="امروز") if it's just for display
        if (['created_at', 'updated_at', 'hov_date'].includes(key)) {
          return;
        }
        
        // For boolean filters, if both are selected ("true,false"), ignore the filter
        if (['has_conflict', 'is_fragile', 'is_heavy', 'needs_qc'].includes(key)) {
          if (stateFilters[key].includes(',')) {
            return;
          }
        }
        
        // For checkbox filters, we need to append __in
        // We know which ones are checkboxes based on if they contain commas and match certain keys
        const inFields = ['field_status', 'doc_status', 'tag_status', 'field_assignee', 'doc_assignee'];
        if (inFields.includes(key)) {
            filters[`${key}__in`] = stateFilters[key];
        } else {
            // For mapping UI keys to Backend keys if they differ
            if (key === 'fieldStatus') filters['field_status__in'] = stateFilters[key];
            else if (key === 'docStatus') filters['doc_status__in'] = stateFilters[key];
            else if (key === 'labelStatus') filters['tag_status__in'] = stateFilters[key];
            else if (key === 'fieldAssignee') filters['field_assignee__in'] = stateFilters[key];
            else if (key === 'docAssignee') filters['doc_assignee__in'] = stateFilters[key];
            else filters[key] = stateFilters[key]; 
        }
      }
    });

    // Add pagination
    filters['page'] = this.currentPage;
    filters['page_size'] = this.pageSize;

    // Add search
    const globalSearch = this.state.appState.dispatchSettings.search;
    if (globalSearch) {
      filters['search'] = globalSearch;
    }

    // Add sorting
    const sort = this.state.appState.dispatchSettings.sort;
    if (sort.key) {
      filters['ordering'] = sort.dir === 'desc' ? `-${sort.key}` : sort.key;
    }

    this.itemApi.getAll(filters).subscribe({
      next: (res) => {
        this.items = res.results.map(r => ({
          ...r,
          labelStatus: r.tag_status === 'printed' ? 'printed' : 'pending',
          fieldStatus: r.field_status === 'counting' ? 'counting' : r.field_status === 'recount' ? 'recount' : r.field_status === 'done' ? 'done' : 'waiting',
          docStatus: r.doc_status === 'processing' ? 'processing' : r.doc_status === 'done' ? 'done' : 'waiting',
          fieldAssignee: r.field_assignee || 'ثبت نشده',
          docAssignee: r.doc_assignee || 'ثبت نشده'
        }));
        this.totalItems = res.count;
        this.isLoading = false;
        this.updateAvailableTags();
        
        this.cdr.detectChanges();
      },
      error: () => {
        this.toast.show('error', 'خطا در دریافت اطلاعات');
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  get activeWhName() {
    if (this.state.appState.activeWarehouseId === 'ALL') return 'تجمیعی کل سایت‌ها (همه انبارها)';
    const wh = this.state.appState.projects.find((p: any) => p.id === this.state.appState.activeWarehouseId);
    return wh ? wh.name : 'نامشخص';
  }
  get hasActiveFilters(): boolean {
    const filters = this.state.appState.dispatchSettings?.filters;
    if (!filters) return false;
    return Object.values(filters).some((v) => {
      return typeof v === 'string' ? v.trim().length > 0 : !!v;
    });
  }

  getDisplayValue(record: any, key: string) {
    if(key === 'labelStatus') return record.labelStatus === 'printed' ? 'چاپ شده' : record.labelStatus === 'reprint' ? 'چاپ مجدد' : 'چاپ نشده';
    if(key === 'fieldStatus') return record.fieldStatus === 'counting' ? 'در کارتابل' : record.fieldStatus === 'recount' ? 'مغایرت' : record.fieldStatus === 'done' ? 'تایید میدانی' : 'در انتظار';
    if(key === 'docStatus') return record.docStatus === 'processing' ? 'در دست بررسی' : record.docStatus === 'done' ? 'تکمیل اسناد' : 'در انتظار';
    return record[key] ? String(record[key]) : '';
  }

  handleTableSort(sortData: any) {
    this.state.appState.dispatchSettings.sort.key = sortData.key;
    this.state.appState.dispatchSettings.sort.dir = sortData.direction;
    this.loadItems();
    this.savePreferences();
  }

  onSearchChanged(term: string) {
    this.state.appState.dispatchSettings.search = term;
    this.currentPage = 1;
    this.loadItems();
  }

  handleTableFilter(filters: any) {
    this.state.appState.dispatchSettings.filters = filters;
    this.currentPage = 1;
    this.loadItems();
    this.savePreferences();
  }

  handleTablePageChange(event: any) {
    this.currentPage = event.page;
    this.pageSize = event.pageSize;
    this.loadItems();
  }

  handleVisibleColumnsChanged(visibleCols: string[]) {
    this.state.appState.dispatchSettings.visibleCols = visibleCols;
    this.savePreferences();
  }

  savePreferences() {
    this.auth.updatePreferences({ dispatchSettings: this.state.appState.dispatchSettings }).subscribe();
  }

  clearAllFilters() {
    this.state.appState.dispatchSettings.filters = {};
    this.state.appState.dispatchSettings.sort = { key: null, dir: 'asc' };
    this.currentPage = 1;
    this.loadItems();
    this.savePreferences();
  }

  onSelectionChange(selectedIds: Set<string>) {
    this.selectedItemIds = selectedIds;
  }

  onBulkUpdate(changedRows: any[]) {
    if (!changedRows || changedRows.length === 0) return;

    this.isLoading = true;
    this.itemApi.bulkUpdate(changedRows).subscribe({
      next: (res) => {
        this.toast.show('success', 'تغییرات با موفقیت ذخیره شد');
        this.loadItems();
      },
      error: () => {
        this.toast.show('error', 'خطا در ذخیره تغییرات');
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  get selectedItems() {
    // Only return items from current page that are selected. For cross-page bulk actions, 
    // we would use `this.selectedItemIds` directly against the backend.
    return this.items.filter((r: any) => this.selectedItemIds.has(r.id));
  }

  executeBatchLabelPrint() {
    const selected = this.selectedItems;
    if (selected.length === 0) {
      this.toast.show('warning', 'ابتدا رکوردهایی که قصد چاپ لیبل آن‌ها را دارید انتخاب کنید.');
      return;
    }
    // Update labels via backend or just local for now if backend doesn't support it directly.
    // Assuming we have bulkTag or bulk_assign can handle label_status. But for now, we'll just show the toast and not send to backend since we don't have an endpoint for label printing status update yet.
    // Actually, wait, bulkTag exists. Let's just mock the printing or call bulk_assign with tag_status? The user didn't ask to fix printing right now. I'll leave it local to not break it.
    selected.forEach((r: any) => { r.labelStatus = 'printed'; });
    this.toast.show('success', `دستور چاپ لیبل و ساخت QR Code برای ${selected.length} رکورد صادر شد.`);
    this.selectedItemIds = new Set(this.selectedItemIds);
  }

  executeFieldDispatch() {
    if (this.selectedItemIds.size === 0) return this.toast.show('warning', 'رکوردی انتخاب نشده است.');
    if (!this.selectedFieldWorker) return this.toast.show('error', 'لطفا شمارشگر میدانی را انتخاب کنید.');
    if (!this.selectedSupervisor) return this.toast.show('error', 'لطفا سرپرست را انتخاب کنید.');

    const payload = {
      item_ids: Array.from(this.selectedItemIds),
      field_assignee: this.selectedFieldWorker,
      supervisor_assignee: this.selectedSupervisor,
      field_status: 'counting'
    };

    this.itemApi.bulkDispatch(payload).subscribe({
      next: (res) => {
        this.toast.show('success', `${res.updated} رکورد به کارتابل شمارشگر ارسال شد.`);
        this.selectedItemIds.clear();
        this.loadItems();
      },
      error: () => this.toast.show('error', 'خطا در ارجاع میدانی')
    });
  }

  executeDocDispatch() {
    if (this.selectedItemIds.size === 0) return this.toast.show('warning', 'رکوردی انتخاب نشده است.');
    if (!this.selectedDocWorker) return this.toast.show('error', 'لطفا کارشناس اسناد و قیمت را انتخاب کنید.');

    const payload = {
      item_ids: Array.from(this.selectedItemIds),
      doc_assignee: this.selectedDocWorker,
      doc_status: 'processing'
    };

    this.itemApi.bulkDispatch(payload).subscribe({
      next: (res) => {
        this.toast.show('success', `فایل ${res.updated} رکورد جهت بررسی اسناد و قیمت ارسال شد.`);
        this.selectedItemIds.clear();
        this.loadItems();
      },
      error: () => this.toast.show('error', 'خطا در ارجاع اسناد')
    });
  }

  requestRecount() {
    if (this.selectedItemIds.size === 0) return this.toast.show('warning', 'رکوردی انتخاب نشده است.');

    const payload = {
      item_ids: Array.from(this.selectedItemIds),
      field_status: 'recount'
    };

    this.itemApi.bulkDispatch(payload).subscribe({
      next: (res) => {
        this.toast.show('warning', `وضعیت ${res.updated} رکورد به "مغایرت - بازشماری کور" تغییر یافت.`);
        this.selectedItemIds.clear();
        this.loadItems();
      },
      error: () => this.toast.show('error', 'خطا در درخواست بازشماری')
    });
  }

  updateAvailableTags() {
    const tagsSet = new Set<string>();
    this.items.forEach((r: any) => {
      if (r.tag) r.tag.split('،').forEach((t: string) => tagsSet.add(t.trim()));
    });
    this.availableTagsList = Array.from(tagsSet).filter((t: string) => t).map((t: string) => ({label: t, value: t}));
  }

  applyBatchTags() {
    const val = this.newTagInput.trim();
    if (!val) return this.toast.show('warning', 'لطفاً نام تگ را وارد کنید.');
    if (this.selectedItemIds.size === 0) return this.toast.show('warning', 'رکوردی انتخاب نشده است.');

    const updates = Array.from(this.selectedItemIds).map(id => {
      const r = this.items.find(i => i.id === id);
      let currentTags = r?.tag ? r.tag.split('،').map((t: string) => t.trim()).filter((t: string) => t) : [];
      let newTagsList = [...new Set([...currentTags, val])];
      return { id, tag: newTagsList.join('، ') };
    });

    this.itemApi.bulkTag({ updates }).subscribe({
      next: (res) => {
        this.newTagInput = '';
        this.toast.show('success', `تگ "${val}" با موفقیت به ${res.updated} رکورد افزوده شد.`);
        if (this.isTagModalOpen && !this.selectedItemsTags.includes(val)) {
          this.selectedItemsTags.push(val);
        }
        this.loadItems();
      },
      error: () => this.toast.show('error', 'خطا در تگ‌گذاری')
    });
  }

  openTagModal() {
    if (this.selectedItemIds.size === 0) return this.toast.show('warning', 'رکوردی انتخاب نشده است.');
    this.updateSelectedItemsTags();
    this.isTagModalOpen = true;
  }

  closeTagModal() {
    this.isTagModalOpen = false;
    this.newTagInput = '';
  }

  updateSelectedItemsTags() {
    const tagsSet = new Set<string>();
    Array.from(this.selectedItemIds).forEach(id => {
      const r = this.items.find(i => i.id === id);
      if (r?.tag) {
        r.tag.split('،').forEach((t: string) => tagsSet.add(t.trim()));
      }
    });
    this.selectedItemsTags = Array.from(tagsSet).filter((t: string) => t);
  }

  removeTagFromSelected(tagToRemove: string) {
    if (this.selectedItemIds.size === 0) return;
    
    const updates = Array.from(this.selectedItemIds).map(id => {
      const r = this.items.find(i => i.id === id);
      let currentTags = r?.tag ? r.tag.split('،').map((t: string) => t.trim()).filter((t: string) => t) : [];
      let newTagsList = currentTags.filter((t: string) => t !== tagToRemove);
      return { id, tag: newTagsList.join('، ') };
    });

    this.itemApi.bulkTag({ updates }).subscribe({
      next: (res) => {
        this.toast.show('success', `تگ "${tagToRemove}" از رکوردهای انتخابی حذف شد.`);
        this.selectedItemsTags = this.selectedItemsTags.filter((t: string) => t !== tagToRemove);
        this.loadItems();
      },
      error: () => this.toast.show('error', 'خطا در حذف تگ')
    });
  }

  clearBatchTags() {
    if (this.selectedItemIds.size === 0) return this.toast.show('warning', 'رکوردی انتخاب نشده است.');

    const updates = Array.from(this.selectedItemIds).map(id => ({ id, tag: '' }));
    this.itemApi.bulkTag({ updates }).subscribe({
      next: (res) => {
        this.toast.show('success', `تمامی تگ‌های ${res.updated} رکورد انتخابی پاک شد.`);
        this.selectedItemsTags = [];
        this.loadItems();
      },
      error: () => this.toast.show('error', 'خطا در پاک کردن تگ‌ها')
    });
  }

  getSplitTags(tagStr: string) {
    return tagStr ? tagStr.split('،').map((t: string) => t.trim()).filter((t: string) => t) : [];
  }



  async confirmLeave(): Promise<boolean> {
    if (this.dataTable && this.dataTable.pendingChanges && this.dataTable.pendingChanges.size > 0) {
      const result = await this.confirmDialog.open({
        title: 'خروج از صفحه',
        message: 'شما تغییرات ذخیره‌نشده‌ای در جدول دارید. مایل به انجام چه کاری هستید؟',
        confirmText: 'خروج (حذف تغییرات)',
        cancelText: 'ماندن در صفحه',
        extraText: 'ذخیره و خروج',
        type: 'warning'
      });

      if (result === true) {
        return true;
      } else if (result === 'extra') {
        const changes = Array.from(this.dataTable.pendingChanges);
        this.isLoading = true;
        this.cdr.detectChanges();
        try {
          await firstValueFrom(this.itemApi.bulkUpdate(changes));
          this.toast.show('success', 'تغییرات با موفقیت ذخیره شد');
          return true;
        } catch (e) {
          this.toast.show('error', 'خطا در ذخیره تغییرات');
          this.isLoading = false;
          this.cdr.detectChanges();
          return false;
        }
      } else {
        return false;
      }
    }
    return true;
  }
}
