import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '../../services/state.service';
import { ToastService } from '../../services/toast.service';
import { DataTableComponent, TableColumnDirective } from '../../shared';

@Component({
  selector: 'app-dispatch',
  imports: [CommonModule, FormsModule, DataTableComponent, TableColumnDirective],
  templateUrl: './dispatch.html',
  styleUrl: './dispatch.css'
})
export class Dispatch implements OnInit {
  isTagDropdownOpen = false;
  newTagInput = '';
  
  fieldWorkers: any[] = [];
  docWorkers: any[] = [];
  
  selectedFieldWorker = '';
  selectedDocWorker = '';

  selectedRecordIds: Set<string> = new Set();
  selectedTags: Set<string> = new Set();
  availableTags: string[] = [];

  constructor(public state: StateService, private toast: ToastService) {}

  ngOnInit() {
    this.fieldWorkers = this.state.appState.users.filter((u: any) => u.roleId === 'R3' || u.roleId === 'R5');
    this.docWorkers = this.state.appState.users.filter((u: any) => u.roleId === 'R4');
    
    // Initialize properties if missing
    this.state.appState.records.forEach((r: any) => {
      if(!r.labelStatus) r.labelStatus = 'pending';
      if(!r.fieldStatus) r.fieldStatus = r.status === 'در حال شمارش' ? 'counting' : 'waiting';
      if(!r.docStatus) r.docStatus = 'waiting';
      if(!r.fieldAssignee) r.fieldAssignee = r.assignee || 'ثبت نشده';
      if(!r.docAssignee) r.docAssignee = 'ثبت نشده';
    });

    this.updateAvailableTags();
  }

  get activeWhName() {
    if (this.state.appState.activeWarehouseId === 'ALL') return 'تجمیعی کل سایت‌ها (همه انبارها)';
    const wh = this.state.appState.projects.find((p: any) => p.id === this.state.appState.activeWarehouseId);
    return wh ? wh.name : 'نامشخص';
  }

  get filteredRecords() {
    let records = this.state.appState.activeWarehouseId === 'ALL' 
      ? this.state.appState.records 
      : this.state.appState.records.filter((r: any) => r.project === this.state.appState.activeWarehouseId);

    const filters = this.state.appState.dispatchSettings.filters;
    Object.keys(filters).forEach(key => {
      const term = filters[key]?.toLowerCase().trim();
      if (term) {
        records = records.filter((r: any) => {
          const displayVal = this.getDisplayValue(r, key).toLowerCase();
          return displayVal.includes(term);
        });
      }
    });

    const sort = this.state.appState.dispatchSettings.sort;
    if (sort.key) {
      records = [...records].sort((a: any, b: any) => {
        let valA: any = this.getDisplayValue(a, sort.key).toLowerCase();
        let valB: any = this.getDisplayValue(b, sort.key).toLowerCase();
        
        const numA = parseFloat(valA.replace(/,/g, ''));
        const numB = parseFloat(valB.replace(/,/g, ''));
        if(!isNaN(numA) && !isNaN(numB)) { valA = numA; valB = numB; }

        if (valA < valB) return sort.dir === 'asc' ? -1 : 1;
        if (valA > valB) return sort.dir === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return records;
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
  }

  handleTableFilter(filters: any) {
    this.state.appState.dispatchSettings.filters = filters;
  }

  clearAllFilters() {
    this.state.appState.dispatchSettings.filters = {};
    this.state.appState.dispatchSettings.sort = { key: null, dir: 'asc' };
  }

  onSelectionChange(selectedIds: Set<string>) {
    this.selectedRecordIds = selectedIds;
  }

  get selectedRecords() {
    return this.state.appState.records.filter((r: any) => this.selectedRecordIds.has(r.id));
  }

  executeBatchLabelPrint() {
    const selected = this.selectedRecords;
    if (selected.length === 0) {
      this.toast.show('warning', 'ابتدا رکوردهایی که قصد چاپ لیبل آن‌ها را دارید انتخاب کنید.');
      return;
    }
    selected.forEach((r: any) => { r.labelStatus = 'printed'; });
    this.toast.show('success', `دستور چاپ لیبل و ساخت QR Code برای ${selected.length} رکورد صادر شد.`);
    this.selectedRecordIds = new Set(this.selectedRecordIds); // trigger change detection for table
  }

  executeFieldDispatch() {
    const selected = this.selectedRecords;
    if (selected.length === 0) return this.toast.show('warning', 'رکوردی انتخاب نشده است.');
    if (!this.selectedFieldWorker) return this.toast.show('error', 'لطفا تیم یا شمارشگر میدانی را انتخاب کنید.');

    const unprinted = selected.filter((r: any) => r.labelStatus !== 'printed');
    if (unprinted.length > 0) {
      return this.toast.show('error', `${unprinted.length} مورد از رکوردهای انتخابی هنوز لیبل فیزیکی ندارند!`);
    }

    selected.forEach((r: any) => {
      r.fieldAssignee = this.selectedFieldWorker;
      r.fieldStatus = 'counting';
    });
    this.toast.show('success', `${selected.length} رکورد به کارتابل شمارشگر ارسال شد.`);
    this.selectedRecordIds = new Set();
  }

  executeDocDispatch() {
    const selected = this.selectedRecords;
    if (selected.length === 0) return this.toast.show('warning', 'رکوردی انتخاب نشده است.');
    if (!this.selectedDocWorker) return this.toast.show('error', 'لطفا کارشناس اسناد را انتخاب کنید.');

    selected.forEach((r: any) => {
      r.docAssignee = this.selectedDocWorker;
      r.docStatus = 'processing';
    });
    this.toast.show('success', `فایل ${selected.length} رکورد جهت تکمیل مالی به کارتابل ارسال شد.`);
    this.selectedRecordIds = new Set();
  }

  requestRecount() {
    const selected = this.selectedRecords;
    if (selected.length === 0) return this.toast.show('warning', 'رکوردی انتخاب نشده است.');

    let changedCount = 0;
    selected.forEach((r: any) => {
      if (r.fieldStatus === 'counting' || r.fieldStatus === 'done') {
        r.fieldStatus = 'recount';
        changedCount++;
      }
    });

    if (changedCount > 0) {
      this.toast.show('warning', `وضعیت ${changedCount} رکورد به "مغایرت - بازشماری کور" تغییر یافت.`);
      this.selectedRecordIds = new Set(this.selectedRecordIds);
    } else {
      this.toast.show('error', 'رکوردهای انتخابی در مرحله‌ای نیستند که بتوان دستور بازشماری صادر کرد.');
    }
  }

  updateAvailableTags() {
    const tagsSet = new Set<string>();
    const records = this.state.appState.activeWarehouseId === 'ALL' 
      ? this.state.appState.records 
      : this.state.appState.records.filter((r: any) => r.project === this.state.appState.activeWarehouseId);

    records.forEach((r: any) => {
      if (r.tag) r.tag.split('،').forEach((t: string) => tagsSet.add(t.trim()));
    });

    const targetId = this.state.appState.activeWarehouseId === 'ALL' ? 'GLOBAL' : this.state.appState.activeWarehouseId;
    const sessionTags = this.state.appState.dispatchSettings.sessionTags?.[targetId] || [];
    sessionTags.forEach((t: string) => tagsSet.add(t));

    this.availableTags = Array.from(tagsSet).filter(t => t);
  }

  addNewTag() {
    const val = this.newTagInput.trim();
    if (val) {
      const targetId = this.state.appState.activeWarehouseId === 'ALL' ? 'GLOBAL' : this.state.appState.activeWarehouseId;
      if (!this.state.appState.dispatchSettings.sessionTags) this.state.appState.dispatchSettings.sessionTags = {};
      if (!this.state.appState.dispatchSettings.sessionTags[targetId]) this.state.appState.dispatchSettings.sessionTags[targetId] = [];
      
      if(!this.state.appState.dispatchSettings.sessionTags[targetId].includes(val)) {
        this.state.appState.dispatchSettings.sessionTags[targetId].push(val);
      }
      this.updateAvailableTags();
      this.newTagInput = '';
    }
  }

  toggleTagSelection(tag: string, event: Event) {
    if ((event.target as HTMLInputElement).checked) {
      this.selectedTags.add(tag);
    } else {
      this.selectedTags.delete(tag);
    }
  }

  applyBatchTags() {
    const selected = this.selectedRecords;
    if (selected.length === 0) return this.toast.show('warning', 'رکوردی انتخاب نشده است.');
    if (this.selectedTags.size === 0) return this.toast.show('warning', 'هیچ تگی از لیست انتخاب نکرده‌اید.');

    const tagsToApply = Array.from(this.selectedTags);
    selected.forEach((r: any) => {
      let currentTags = r.tag ? r.tag.split('،').map((t: string) => t.trim()).filter((t: string) => t) : [];
      let newTagsList = [...new Set([...currentTags, ...tagsToApply])];
      r.tag = newTagsList.join('، ');
    });

    this.isTagDropdownOpen = false;
    this.selectedTags.clear();
    this.toast.show('success', `تگ‌های انتخابی با موفقیت به ${selected.length} رکورد افزوده شد.`);
    this.selectedRecordIds = new Set(this.selectedRecordIds);
  }

  clearBatchTags() {
    const selected = this.selectedRecords;
    if (selected.length === 0) return this.toast.show('warning', 'رکوردی انتخاب نشده است.');

    selected.forEach((r: any) => { r.tag = ''; });
    this.isTagDropdownOpen = false;
    this.selectedTags.clear();
    this.toast.show('success', `تمامی تگ‌های ${selected.length} رکورد انتخابی پاک شد.`);
    this.selectedRecordIds = new Set(this.selectedRecordIds);
  }

  getSplitTags(tagStr: string) {
    return tagStr ? tagStr.split('،').map(t => t.trim()).filter(t => t) : [];
  }
}
