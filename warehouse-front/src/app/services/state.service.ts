import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class StateService {
  appState: any = {
    user: null,
    unit: 'admin',
    tab: 'dashboard',
    activeWarehouseId: (localStorage.getItem('wh_active_id') === 'ALL' ? 'ALL' : (localStorage.getItem('wh_active_id') ? Number(localStorage.getItem('wh_active_id')) : null)) as any,
    projects: [],
    rolesMap: {
      'admin': { title: 'مدیریت کل سیستم (Admin)', color: '#4f46e5' },
      'manager': { title: 'مدیریت پروژه', color: '#0891b2' },
      'supervisor': { title: 'سرپرست اجرا / شمارش', color: '#059669' },
      'document_expert': { title: 'کارشناس مدارک', color: '#7c3aed' },
      'counter': { title: 'انباردار میدانی / انبارگردان', color: '#d97706' },
      'feeding_operator': { title: 'اپراتور تغذیه MT', color: '#be123c' }
    } as any,
    users: [],
    items: [],
    dispatchSettings: {
      visibleCols: ['fa_unic_code', 'description', 'balance', 'old_location', 'labelStatus', 'fieldAssignee', 'fieldStatus', 'docAssignee', 'docStatus', 'tag', 'created_at', 'updated_at', 'created_by_name', 'modified_by_name'],
      filters: {},
      search: '',
      recentTags: ['اولویت الف', 'محموله مهر', 'سیستمی', 'تعمیری', 'اولویت ب'],
      sort: { key: null, dir: 'asc' },
      sessionTags: {}
    },
    labelSettings: { printMesc: true, printKey: true, printDesc: true, printLoc: true, printQty: true, printCond: true, printTag: true, printProject: true, printQr: true },
    drafts: [],
    tasks: [],
    changeLogs: [],
    importLogs: []
  };

  getDeptLabel(d: string): string {
    const labels: any = { admin: 'مدیریت کل سیستم', management: 'مدیر پروژه', execution: 'واحد اجرایی', documents: 'واحد مدارک', feeding: 'واحد تغذیه MT' };
    return labels[d] || d;
  }

  constructor() {}
}
