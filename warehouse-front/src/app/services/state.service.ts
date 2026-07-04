import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class StateService {
  appState: any = {
    user: null,
    unit: 'admin',
    tab: 'dashboard',
    activeWarehouseId: 'PRJ-01',
    projects: [
      {id:'PRJ-01',name:'انبار مرکزی گاز شیرین',manager:'مهندس احمدی',location:'عسلویه',records:45100,done:28000,status:'جاری',percent:62,color:'#4f46e5'},
      {id:'PRJ-02',name:'انبار شماره ۴ قطعات یدکی',manager:'مهندس رضایی',location:'شیراز - زاگرس',records:8200,done:3690,status:'جاری',percent:45,color:'#0891b2'},
      {id:'PRJ-03',name:'انبار ابزار دقیق فاز ۱۲',manager:'مهندس علوی',location:'کنگان',records:21000,done:2100,status:'تنظیم شده',percent:10,color:'#d97706'},
      {id:'PRJ-04',name:'انبار ضایعات مکانیزه',manager:'مهندس مهدوی',location:'بندرعباس',records:4500,done:0,status:'حذف شده',percent:0,color:'#dc2626'}
    ],
    roles: [
      { id: 'R1', title: 'مدیریت کل سیستم (Admin)', parentId: null, color: '#4f46e5' },
      { id: 'R2', title: 'مدیریت پروژه', parentId: 'R1', color: '#0891b2' },
      { id: 'R3', title: 'سرپرست اجرا', parentId: 'R2', color: '#059669' },
      { id: 'R4', title: 'کارشناس مدارک', parentId: 'R2', color: '#7c3aed' },
      { id: 'R5', title: 'انباردار میدانی (شمارشگر)', parentId: 'R3', color: '#d97706' },
      { id: 'R6', title: 'اپراتور تغذیه MT', parentId: 'R4', color: '#be123c' }
    ],
    users: [
      {id:'U01', firstName:'سامان', lastName:'تقوی سوق', nationalCode:'1280954310', username:'saman_admin', phone:'09121112233', address:'تهران، شرکت مرکزی زون الف', roleId:'R1', avatar:'س', status:'active', projects:['PRJ-01', 'PRJ-02', 'PRJ-03', 'PRJ-04']},
      {id:'U02', firstName:'ناصر', lastName:'حیدری', nationalCode:'1289944321', username:'heydari_manager', phone:'09174445566', address:'عسلویه، کمپ مرکزی صدف', roleId:'R2', avatar:'ح', status:'active', projects:['PRJ-01', 'PRJ-02']},
      {id:'U03', firstName:'علی', lastName:'قاسمی', nationalCode:'2294451025', username:'ghasemi_exec', phone:'09115556677', address:'بوشهر، خیابان ساحلی زون ۳', roleId:'R3', avatar:'ع', status:'active', projects:['PRJ-01', 'PRJ-03']},
      {id:'U04', firstName:'فاطمه', lastName:'رضایی', nationalCode:'2301145263', username:'rezaei_docs', phone:'09356667788', address:'شیراز، معالی آباد کوی زاگرس', roleId:'R4', avatar:'ف', status:'active', projects:['PRJ-02']},
      {id:'U05', firstName:'حسین', lastName:'کریمی', nationalCode:'3410025142', username:'karimi_feed', phone:'09137778899', address:'کنگان، فاز ۱۲ مسکونی', roleId:'R6', avatar:'ه', status:'active', projects:['PRJ-03']},
      {id:'U06', firstName:'مریم', lastName:'احمدی', nationalCode:'1284512630', username:'ahmadi_field', phone:'09129998877', address:'عسلویه، خوابگاه شماره ۳ پرسنلی', roleId:'R5', avatar:'م', status:'active', projects:['PRJ-01', 'PRJ-02']}
    ],
    records: [
      {id: 'REC-1001', mesc: '12.04.558.11', partNo: 'FS-202X', desc: 'شیر برقی ابزار دقیق فیشر 2 اینچ', category: 'تجهیزات دقیق', loc: 'سوله A - قفسه 14', qty: 15, unit: 'عدد', cond: 'نو', remarks: 'ترخیص جدید', project: 'PRJ-01', tag: 'اولویت الف', status: 'تعریف شده', assignee: 'علی قاسمی'},
      {id: 'REC-1002', mesc: '08.21.104.03', partNo: 'KSB-ETL-40', desc: 'پمپ سانتریفوژ KSB مدل Etaline', category: 'مکانیکال', loc: 'سوله A - قفسه 02', qty: 4, unit: 'دستگاه', cond: 'نو', remarks: '-', project: 'PRJ-01', tag: 'محموله مهر', status: 'در حال شمارش', assignee: 'مریم احمدی'},
      {id: 'REC-1003', mesc: '10.15.110.12', partNo: 'FLG-150-6', desc: 'فلنج فولادی کلاس 150 سایز 6 اینچ', category: 'پایپینگ', loc: 'محوطه B - زون 1', qty: 120, unit: 'عدد', cond: 'نو', remarks: '-', project: 'PRJ-01', tag: 'اولویت الف', status: 'تکمیل شده', assignee: 'علی قاسمی'},
      {id: 'REC-1004', mesc: '10.22.440.08', partNo: 'VLV-GT-8', desc: 'شیر دروازه‌ای (Gate Valve) 8 اینچ CS', category: 'پایپینگ', loc: 'محوطه باز زون الف', qty: 25, unit: 'عدد', cond: 'نو', remarks: '-', project: 'PRJ-01', tag: '', status: 'تعریف شده', assignee: 'ثبت نشده'},
      {id: 'REC-1005', mesc: '14.11.205.10', partNo: 'WLD-E6010', desc: 'الکترود جوشکاری E6010 آما', category: 'مصرفی', loc: 'انبار مسقف C - قفسه 5', qty: 500, unit: 'کارتن', cond: 'نو', remarks: 'تاریخ انقضا بررسی شود', project: 'PRJ-01', tag: 'مصرفی روزانه', status: 'در حال شمارش', assignee: 'مریم احمدی'},
      {id: 'REC-1006', mesc: '05.44.320.15', partNo: 'GKT-SW-4', desc: 'گسکت اسپیرال وند 4 اینچ کلاس 300', category: 'پایپینگ', loc: 'سوله A - قفسه 18', qty: 300, unit: 'عدد', cond: 'نو', remarks: '-', project: 'PRJ-01', tag: '', status: 'تکمیل شده', assignee: 'علی قاسمی'},
      {id: 'REC-1007', mesc: '18.05.990.22', partNo: 'BLT-M20-100', desc: 'استاد بولت M20 طول 100 با مهره', category: 'اتصالات', loc: 'سوله B - ردیف 3', qty: 2500, unit: 'ست', cond: 'نو', remarks: '-', project: 'PRJ-01', tag: 'اولویت ب', status: 'تعریف شده', assignee: 'ثبت نشده'},
      {id: 'REC-1008', mesc: '08.14.225.40', partNo: 'CMP-IR-55', desc: 'کمپرسور هوای اینگرسولرند 55kW', category: 'مکانیکال', loc: 'محوطه تجهیزات سنگین', qty: 2, unit: 'دستگاه', cond: 'مستعمل', remarks: 'نیاز به اورهال', project: 'PRJ-01', tag: 'تعمیراتی', status: 'در حال شمارش', assignee: 'مریم احمدی'},
      {id: 'REC-1009', mesc: '10.33.660.14', partNo: 'VLV-CH-6', desc: 'شیر یکطرفه (Check Valve) 6 اینچ', category: 'پایپینگ', loc: 'سوله A - قفسه 05', qty: 18, unit: 'عدد', cond: 'نو', remarks: '-', project: 'PRJ-01', tag: 'محموله مهر', status: 'تکمیل شده', assignee: 'علی قاسمی'},
      {id: 'REC-1010', mesc: '04.11.120.55', partNo: 'PPE-HLM-Y', desc: 'کلاه ایمنی عایق برق زرد صنعتی', category: 'ایمنی', loc: 'انبار مسقف D', qty: 150, unit: 'عدد', cond: 'نو', remarks: '-', project: 'PRJ-01', tag: 'سیستمی', status: 'تعریف شده', assignee: 'ثبت نشده'},
      {id: 'REC-2001', mesc: '22.11.305.44', partNo: 'CBL-SH-1.5', desc: 'کابل ابزار دقیق شیلددار 1.5*2 خراسان', category: 'الکتریکال', loc: 'انبار قرقره‌ها زون ۲', qty: 4500, unit: 'متر', cond: 'نو', remarks: '-', project: 'PRJ-02', tag: '', status: 'تعریف شده', assignee: 'ثبت نشده'},
      {id: 'REC-2002', mesc: '15.33.220.07', partNo: 'ABB-11KW-M3', desc: 'موتور الکتریکی ABB 11kW سه فاز', category: 'الکتریکال', loc: 'سوله B - قفسه 08', qty: 8, unit: 'دستگاه', cond: 'مستعمل', remarks: 'نیاز به تست عایق', project: 'PRJ-02', tag: 'تعمیری', status: 'در حال شمارش', assignee: 'علی قاسمی'},
      {id: 'REC-2003', mesc: '22.44.110.55', partNo: 'TRF-800KVA', desc: 'ترانسفورماتور 800kVA ایران ترانسفو', category: 'الکتریکال', loc: 'محوطه باز زاگرس', qty: 1, unit: 'دستگاه', cond: 'نو', remarks: 'روغن‌ریزی چک شود', project: 'PRJ-02', tag: 'پروژه فاز ۲', status: 'تکمیل شده', assignee: 'مریم احمدی'},
      {id: 'REC-2004', mesc: '25.10.330.12', partNo: 'RLY-OMR-24', desc: 'رله شیشه‌ای 24 ولت پین‌دار امرن', category: 'الکتریکال', loc: 'قفسه قطعات الکترونیک', qty: 120, unit: 'عدد', cond: 'نو', remarks: '-', project: 'PRJ-02', tag: 'مصرفی', status: 'تعریف شده', assignee: 'ثبت نشده'},
      {id: 'REC-2005', mesc: '08.22.450.99', partNo: 'BRG-SKF-6208', desc: 'بلبرینگ SKF 6208 اصل سوئد', category: 'قطعات یدکی', loc: 'سوله B - قفسه 12', qty: 45, unit: 'عدد', cond: 'نو', remarks: '-', project: 'PRJ-02', tag: 'سیستمی', status: 'تکمیل شده', assignee: 'علی قاسمی'},
      {id: 'REC-2006', mesc: '08.22.451.05', partNo: 'BRG-SKF-6310', desc: 'بلبرینگ هوای سنگین SKF 6310', category: 'قطعات یدکی', loc: 'سوله B - قفسه 12', qty: 30, unit: 'عدد', cond: 'نو', remarks: '-', project: 'PRJ-02', tag: 'سیستمی', status: 'تعریف شده', assignee: 'ثبت نشده'},
      {id: 'REC-2007', mesc: '22.15.660.22', partNo: 'CB-3P-63A', desc: 'کلید مینیاتوری 3 پل 63A اشنایدر', category: 'الکتریکال', loc: 'قفسه تابلوها پلاک ۴', qty: 85, unit: 'عدد', cond: 'نو', remarks: '-', project: 'PRJ-02', tag: '', status: 'در حال شمارش', assignee: 'مریم احمدی'},
      {id: 'REC-2008', mesc: '14.22.105.18', partNo: 'VBD-B-85', desc: 'تسمه V-Belt پمپ سایز B85', category: 'قطعات یدکی', loc: 'سوله C - ردیف 4', qty: 60, unit: 'عدد', cond: 'نو', remarks: '-', project: 'PRJ-02', tag: '', status: 'تکمیل شده', assignee: 'علی قاسمی'},
      {id: 'REC-2009', mesc: '22.55.880.11', partNo: 'INV-LS-5.5', desc: 'اینورتر کنترل دور 5.5kW برند LS', category: 'الکتریکال', loc: 'سوله قطعات حساس الکترونیک', qty: 4, unit: 'دستگاه', cond: 'نو', remarks: '-', project: 'PRJ-02', tag: 'اولویت الف', status: 'تعریف شده', assignee: 'ثبت نشده'},
      {id: 'REC-2010', mesc: '09.11.220.44', partNo: 'FLT-OIL-P', desc: 'فیلتر روغن پمپ هیدرولیک مرکزی', category: 'قطعات یدکی', loc: 'سوله C - ردیف 1', qty: 200, unit: 'عدد', cond: 'نو', remarks: '-', project: 'PRJ-02', tag: 'محموله مهر', status: 'در حال شمارش', assignee: 'مریم احمدی'},
      {id: 'REC-3001', mesc: '03.12.450.01', partNo: 'RSM-3051', desc: 'ترانسمیتر فشار روزمونت سری 3051', category: 'تجهیزات دقیق', loc: 'قفسه ابزار دقیق A', qty: 25, unit: 'عدد', cond: 'نو', remarks: '-', project: 'PRJ-03', tag: 'سیستمی', status: 'تکمیل شده', assignee: 'علی قاسمی'},
      {id: 'REC-3002', mesc: '03.14.220.15', partNo: 'YOK-EJA', desc: 'ترانسمیتر اختلاف فشار یوکوگاوا EJA', category: 'تجهیزات دقیق', loc: 'قفسه ابزار دقیق A', qty: 12, unit: 'عدد', cond: 'نو', remarks: '-', project: 'PRJ-03', tag: 'اولویت الف', status: 'تعریف شده', assignee: 'ثبت نشده'},
      {id: 'REC-3003', mesc: '03.22.110.40', partNo: 'WIKA-PG-100', desc: 'گیج فشار ویکا 100 بار صفحه 10 سانت', category: 'تجهیزات دقیق', loc: 'قفسه گیج‌های روغنی', qty: 80, unit: 'عدد', cond: 'نو', remarks: 'نیاز به کالیبراسیون مجدد', project: 'PRJ-03', tag: '', status: 'در حال شمارش', assignee: 'مریم احمدی'},
      {id: 'REC-3004', mesc: '03.22.110.16', partNo: 'WIKA-PG-16', desc: 'گیج فشار ویکا 16 بار استنلس استیل', category: 'تجهیزات دقیق', loc: 'قفسه گیج‌ها', qty: 45, unit: 'عدد', cond: 'نو', remarks: '-', project: 'PRJ-03', tag: '', status: 'تکمیل شده', assignee: 'علی قاسمی'},
      {id: 'REC-3005', mesc: '03.33.550.22', partNo: 'RTD-PT100', desc: 'سنسور حرارتی دما PT100 استیل', category: 'تجهیزات دقیق', loc: 'قفسه سنسورهای حرارتی', qty: 150, unit: 'عدد', cond: 'نو', remarks: '-', project: 'PRJ-03', tag: 'سیستمی', status: 'تعریف شده', assignee: 'ثبت نشده'},
      {id: 'REC-3006', mesc: '03.33.550.88', partNo: 'TC-K-TYPE', desc: 'ترموکوپل صنعتی تیپ K غلاف سرامیکی', category: 'تجهیزات دقیق', loc: 'قفسه سنسورها', qty: 60, unit: 'عدد', cond: 'نو', remarks: '-', project: 'PRJ-03', tag: 'محموله مهر', status: 'در حال شمارش', assignee: 'مریم احمدی'},
      {id: 'REC-3007', mesc: '03.44.220.10', partNo: 'FSH-MNG', desc: 'فلو سوئیچ مگنتیک خطی 2 اینچ مایعات', category: 'تجهیزات دقیق', loc: 'قفسه B - ردیف 2', qty: 8, unit: 'عدد', cond: 'نو', remarks: '-', project: 'PRJ-03', tag: '', status: 'تعریف شده', assignee: 'ثبت نشده'},
      {id: 'REC-3008', mesc: '03.55.110.05', partNo: 'LSH-MOBRY', desc: 'لول سوئیچ کنترل سطح شناوری مابری', category: 'تجهیزات دقیق', loc: 'قفسه B - ردیف 3', qty: 14, unit: 'عدد', cond: 'مستعمل', remarks: 'باز شده از خط قدیم', project: 'PRJ-03', tag: 'تعمیری', status: 'تکمیل شده', assignee: 'علی قاسمی'},
      {id: 'REC-3009', mesc: '22.11.440.50', partNo: 'CBL-TC-EX', desc: 'کابل اکستنشن شیلددار کالیبراسیون', category: 'الکتریکال', loc: 'انبار قرقره‌های فرعی', qty: 1200, unit: 'متر', cond: 'نو', remarks: '-', project: 'PRJ-03', tag: '', status: 'در حال شمارش', assignee: 'مریم احمدی'},
      {id: 'REC-3010', mesc: '03.66.990.12', partNo: 'MNF-5V-SS', desc: 'منیفولد ابزار دقیق 5 راهه استیل', category: 'تجهیزات دقیق', loc: 'قفسه متریال خاص', qty: 35, unit: 'عدد', cond: 'نو', remarks: '-', project: 'PRJ-03', tag: 'اولویت ب', status: 'تعریف شده', assignee: 'ثبت نشده'}
    ],
    dispatchSettings: {
      visibleCols: ['id', 'mesc', 'desc', 'category', 'loc', 'qty', 'cond', 'tag', 'assignee', 'status'],
      filters: {},
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
