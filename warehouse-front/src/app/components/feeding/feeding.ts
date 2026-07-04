import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '../../services/state.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-feeding',
  imports: [CommonModule, FormsModule],
  templateUrl: './feeding.html',
  styleUrl: './feeding.css'
})
export class Feeding implements OnInit {
  selectedTagFilter = '';
  selectAllChecked = false;
  selectedRecordIds = new Set<string>();

  constructor(public state: StateService, private toast: ToastService) {}

  ngOnInit() {}

  get activeWh() {
    return this.state.appState.projects.find((p: any) => p.id === this.state.appState.activeWarehouseId) || this.state.appState.projects[0];
  }

  get targetRecords() {
    let records = this.state.appState.records.filter((r: any) => 
      r.project === this.state.appState.activeWarehouseId && 
      (r.status === 'تکمیل شده' || r.status === 'در جریان تغذیه' || r.status === 'آرشیو نهایی')
    );

    if (this.selectedTagFilter) {
      records = records.filter((r: any) => r.tag && r.tag.includes(this.selectedTagFilter));
    }

    return records;
  }

  getTags(tagStr: string) {
    if (!tagStr) return [];
    return tagStr.split('،').map(t => t.trim()).filter(t => t);
  }

  isFullyCompleted(r: any) {
    return r.mt26State === 'completed' && r.mt49State === 'completed';
  }

  toggleSelectAll() {
    if (this.selectAllChecked) {
      this.targetRecords.forEach((r: any) => {
        if (!this.isFullyCompleted(r)) {
          this.selectedRecordIds.add(r.id);
        }
      });
    } else {
      this.selectedRecordIds.clear();
    }
  }

  toggleRecordSelection(id: string, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      this.selectedRecordIds.add(id);
    } else {
      this.selectedRecordIds.delete(id);
      this.selectAllChecked = false;
    }
  }

  isSelected(id: string) {
    return this.selectedRecordIds.has(id);
  }

  executeMTExport(mtType: string) {
    if (this.selectedRecordIds.size === 0) {
      return this.toast.show('warning', `حداقل یک رکورد را برای صدور فایل ${mtType} انتخاب کنید.`);
    }

    this.selectedRecordIds.forEach(id => {
      const rec = this.state.appState.records.find((r: any) => r.id === id);
      if (rec) {
        if (mtType === 'MT26' && rec.mt26State !== 'completed') rec.mt26State = 'exported';
        if (mtType === 'MT49' && rec.mt49State !== 'completed') rec.mt49State = 'exported';
        this.updateGeneralStatus(rec);
      }
    });

    this.toast.show('success', `فایل خروجی ${mtType} تولید شد. وضعیت رکوردها به "در جریان تغذیه ${mtType}" تغییر یافت.`);
  }

  markAsMTCompleted(mtType: string) {
    if (this.selectedRecordIds.size === 0) {
      return this.toast.show('warning', `رکوردی برای ثبت بازخورد ${mtType} انتخاب نشده است.`);
    }

    let hasError = false;

    this.selectedRecordIds.forEach(id => {
      const rec = this.state.appState.records.find((r: any) => r.id === id);
      if (rec) {
        if (mtType === 'MT26') {
          if (rec.mt26State === 'exported') rec.mt26State = 'completed';
          else if (!rec.mt26State || rec.mt26State === 'ready') hasError = true;
        }
        if (mtType === 'MT49') {
          if (rec.mt49State === 'exported') rec.mt49State = 'completed';
          else if (!rec.mt49State || rec.mt49State === 'ready') hasError = true;
        }
        this.updateGeneralStatus(rec);
      }
    });

    if (hasError) {
      this.toast.show('error', `عملیات روی برخی رکوردها انجام نشد! ابتدا باید فایل خروجی ${mtType} را صادر کنید.`);
    } else {
      this.toast.show('success', `بازخورد ثبت نهایی در سیستم ${mtType} با موفقیت اعمال شد.`);
    }

    this.selectAllChecked = false;
    this.selectedRecordIds.clear();
  }

  updateGeneralStatus(rec: any) {
    if (rec.mt26State === 'completed' && rec.mt49State === 'completed') {
      rec.status = 'آرشیو نهایی';
    } else {
      rec.status = 'در جریان تغذیه';
    }
  }
}
