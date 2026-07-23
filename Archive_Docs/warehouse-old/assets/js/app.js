// ====== CORE APP LOGIC ======

const NAV_ITEMS = {
  // ۱. مدیریت کل سیستم
  admin: [
    {id:'dashboard', label:'داشبورد مانیتورینگ کلی', icon:'grid'},
    {id:'users', label:'مدیریت کاربران و ساختار سازمانی', icon:'users'},
    {id:'projects', label:'مدیریت انبارها و لوکیشن‌ها', icon:'archive'},
    {id:'docs', label:'تزریق دیتابیس اولیه (Base Data)', icon:'upload-cloud'},
    {id:'label_designer', label:'طراحی و کانفیگ لیبل/QR', icon:'printer'}, // ماژول اختصاصی و جدید
    {id:'dispatch', label:'تگ‌گذاری و تخصیص به تیم‌ها', icon:'clipboard'},
    {id:'feeding', label:'تغذیه سامانه‌های مرکزی (MT)', icon:'database'}, // <-- این خط اضافه شد
    {id:'id_cards', label:'صدور کارت پرسنلی و گیت‌پاس', icon:'badge'}, // ماژول جدید اضافه شد 
    {id:'audit', label:'رهگیری تغییرات (Audit Trail)', icon:'file-text'},
    {id:'settings', label:'تنظیمات سیستم', icon:'settings'}
  ],

  // ۲. مدیر پروژه (نظارت عملکرد، بررسی مغایرت‌ها و تایید نهایی)
  management: [
    {id:'dashboard', label:'داشبورد عملکرد و مغایرت‌ها', icon:'grid'},
    {id:'projects', label:'وضعیت پیشرفت انبارها', icon:'archive'},
    {id:'approvals', label:'تایید نهایی رکوردها (فاز ۳)', icon:'check-circle'}, 
    {id:'export', label:'صدور فایل برای تغذیه', icon:'download'} 
  ],

  // ۳. تیم اجرا و سرپرست میدانی (فاز ۲ - شمارش فیزیکی)
  execution: [
    {id:'dashboard', label:'وضعیت پیشرفت میدانی', icon:'grid'},
    {id:'labels', label:'چاپ مجدد و اسکن لیبل', icon:'tag'}, 
    {id:'field', label:'میزکار شمارش کور', icon:'clipboard'}, 
    {id:'recounts', label:'بررسی مغایرت و بازشماری', icon:'alert-triangle'} 
  ],

  // ۴. تیم مدارک و سرپرست اسناد (فاز ۳ - اطلاعات مالی/گمرکی)
  documents: [
    {id:'dashboard', label:'خلاصه وضعیت اسناد', icon:'grid'},
    {id:'customs', label:'تکمیل فیلدهای مالی/گمرکی', icon:'folder'}, 
    {id:'doc_approvals', label:'کارتابل تاییدات سرپرست', icon:'check-square'} 
  ],

  // ۵. تیم تغذیه سیستم‌های جامع (فاز ۴ - دستی)
  // feeding: [
  //   {id:'dashboard', label:'داشبورد عملکرد تغذیه', icon:'grid'},
  //   {id:'mt26', label:'کارتابل رکوردهای MT26', icon:'database'}, 
  //   {id:'mt49', label:'کارتابل رکوردهای MT49', icon:'database'}, 
  //   {id:'feed_approvals', label:'تاییدات سرپرست تغذیه', icon:'check-square', isPending: true} 
  // ]
  feeding: [
    {id:'dashboard', label:'داشبورد عملکرد تغذیه', icon:'grid'},
    {id:'feeding', label:'مدیریت و تغذیه MT26/49', icon:'database'}, // <-- دو منوی قبلی به یک منوی یکپارچه تبدیل شد
    {id:'feed_approvals', label:'تاییدات سرپرست تغذیه', icon:'check-square', isPending: true} 
  ]
};

const ICONS = {
  grid:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
  archive:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`,
  badge: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><circle cx="12" cy="11" r="3"></circle><path d="M17 18c0-2.2-2.2-4-5-4s-5 1.8-5 4"></path></svg>`,
  users:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  'file-text':`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
  tag:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`,
  folder:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
  'upload-cloud':`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>`,
  settings:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  clipboard:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>`,
  printer: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>`,
  'check-circle': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  download: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  'alert-triangle': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  'check-square': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
  database: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`
};

function openSidebar() { document.getElementById('sidebar').classList.remove('translate-x-full'); document.getElementById('sidebar-overlay').classList.remove('hidden'); }
function closeSidebar() { document.getElementById('sidebar').classList.add('translate-x-full'); document.getElementById('sidebar-overlay').classList.add('hidden'); }

function renderSidebar(unit) {
  const items = NAV_ITEMS[unit] || NAV_ITEMS.admin;
  const nav = document.getElementById('sidebar-nav');
  
  nav.innerHTML = items.map(item => {
    let textClass = "text-slate-400 hover:text-white hover:bg-slate-800/80";
    let labelSuffix = "";

    if (item.isPending) {
      textClass = "text-slate-600 hover:text-slate-400 hover:bg-slate-800/40 opacity-50";
      labelSuffix = " <span class='text-[9px] bg-slate-800 text-slate-400 px-1 py-0.5 rounded mr-1' style='font-size:8px;'>بزودی</span>";
    }

    return `
      <button onclick="switchTab('${item.id}')" id="nav-${item.id}" class="sidebar-link w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group ${textClass}">
        <span class="shrink-0">${ICONS[item.icon] || ''}</span>
        <span>${item.label}${labelSuffix}</span>
      </button>
    `;
  }).join('');
}

function switchTab(tabId) {
  appState.tab = tabId;
  closeSidebar();
  document.querySelectorAll('.sidebar-link').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('nav-'+tabId);
  if(btn) btn.classList.add('active');
  
  const titles = {
    dashboard: 'داشبورد مانیتورینگ',
    projects: 'مدیریت انبارها',
    dispatch: 'تخصیص و مدیریت رکوردها',
    users: 'کاربران و ساختار',
    tasks: 'وظایف و اسناد',
    labels: 'لیبل‌زن هوشمند',
    docs: 'مدارک گمرکی',
    id_cards: 'صدور کارت پرسنلی و گیت‌پاس',
    feeding: 'تغذیه سامانه MT',
    settings: 'تنظیمات',
    field: 'میز کار میدانی',
    label_designer: 'طراحی و کانفیگ لیبل/QR'
  };
  
  document.getElementById('current-view-title').textContent = titles[tabId]||tabId;
  
  const cc = document.getElementById('content-container');
  cc.classList.remove('fade-in'); void cc.offsetWidth; cc.classList.add('fade-in');
  
  const views = {
    dashboard: getDashboard,
    projects: getProjects,
    dispatch: getDispatch,
    users: getUsers,
    tasks: getTasks,
    labels: getLabels,
    docs: getDocs,
    feeding: getFeeding,
    settings: getSettings,
    field: getField,
    // ... سایر ویوها
    id_cards: typeof getIdCards === 'function' ? getIdCards : () => '<div class="text-center text-slate-400 py-16">ماژول چاپ کارت لود نشده است</div>',
    audit: typeof getAudit === 'function' ? getAudit : () => '<div class="text-center text-slate-400 py-16">ماژول رهگیری لود نشده است</div>',
    label_designer: typeof getLabelDesigner === 'function' ? getLabelDesigner : () => '<div class="text-center text-slate-400 py-16">ماژول طراح لیبل در index.html لود نشده است</div>'
  };
  
  cc.innerHTML = (views[tabId]||(() => '<div class="text-center text-slate-400 py-16">در دست ساخت</div>'))();
  
  initViewScripts(tabId);
}

function initViewScripts(tabId) {
  if(tabId==='dashboard') animateProgress();
  if(tabId==='docs') initDragDrop();
  if(tabId==='dispatch') renderDispatchTable();
}

function animateProgress() {
  setTimeout(()=>{ document.querySelectorAll('.progress-bar').forEach(b => { if(b.dataset.width) b.style.width = b.dataset.width+'%'; }); }, 100);
}

// ====== در فایل app.js جایگزین شود ======
function initWarehouseSwitchers() {
  // اضافه شدن گزینه همه انبارها به بالای لیست کشویی
  const allOption = `<option value="ALL" ${appState.activeWarehouseId === 'ALL' ? 'selected' : ''}>🌍 همه انبارها (نمایش تجمیعی)</option>`;
  const optionsHtml = allOption + appState.projects.map(p => `<option value="${p.id}" ${p.id === appState.activeWarehouseId ? 'selected' : ''}>${p.name}</option>`).join('');
  
  const pcSw = document.getElementById('header-warehouse-switcher');
  const mobSw = document.getElementById('header-warehouse-switcher-mobile');
  if(pcSw) pcSw.innerHTML = optionsHtml;
  if(mobSw) mobSw.innerHTML = optionsHtml;
}

function handleWarehouseSwitch(warehouseId) {
  appState.activeWarehouseId = warehouseId;
  
  // شناسایی حالت تجمیعی برای پیام موفقیت
  const name = warehouseId === 'ALL' ? 'تمامی انبارها (حالت تجمیعی)' : appState.projects.find(p => p.id === warehouseId)?.name;
  
  showToast('success', `محیط کاری تغییر یافت: ${name}`);
  
  // همگام‌سازی منوهای موبایل و دسکتاپ
  const pcSw = document.getElementById('header-warehouse-switcher');
  const mobSw = document.getElementById('header-warehouse-switcher-mobile');
  if (pcSw) pcSw.value = warehouseId;
  if (mobSw) mobSw.value = warehouseId;
  
  switchTab(appState.tab); // رفرش کردن تب فعلی برای اعمال دیتای انبار جدید
}

function showToast(type, msg) {
  const colors = {success:'bg-emerald-600',error:'bg-rose-600',warning:'bg-amber-500',info:'bg-indigo-600'};
  const icons = {success:'✓',error:'✕',warning:'!',info:'i'};
  const tc = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-white text-xs font-semibold max-w-xs ${colors[type]||'bg-slate-700'}`;
  el.innerHTML = `<span class="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center font-bold text-[10px] shrink-0">${icons[type]}</span><span>${msg}</span>`;
  tc.appendChild(el);
  setTimeout(()=>el.remove(), 4100);
}

function showModal(title, body, type='info', actions='', widthClass='max-w-md') {
  const modalBox = document.getElementById('modal-box');
  modalBox.className = `bg-white rounded-2xl shadow-2xl border border-slate-200 w-full p-6 modal-enter ${widthClass}`;
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = body; 
  document.getElementById('modal-actions').innerHTML = actions || '<button onclick="closeModal()" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors">بستن</button>';
  document.getElementById('custom-modal').classList.remove('hidden');
}

function closeModal() { document.getElementById('custom-modal').classList.add('hidden'); }
function statusBadge(s) {
  const m = {جاری:'bg-emerald-50 text-emerald-700 border border-emerald-200','تنظیم شده':'bg-amber-50 text-amber-700 border border-amber-200','حذف شده':'bg-rose-50 text-rose-700 border border-rose-200',پیش‌نویس:'bg-blue-50 text-blue-700 border border-blue-200','در حال شمارش':'bg-indigo-50 text-indigo-700 border border-indigo-200','تکمیل شده':'bg-emerald-50 text-emerald-700 border border-emerald-200','در انتظار مدارک':'bg-amber-50 text-amber-700 border border-amber-200'};
  return `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${m[s]||'bg-slate-100 text-slate-600'}">${s}</span>`;
}

document.addEventListener('keydown', e => { if(e.key==='Escape') closeModal(); });
document.getElementById('custom-modal').addEventListener('click', e => { if(e.target===document.getElementById('custom-modal')) closeModal(); });
document.addEventListener('click', (e) => {
  if (!e.target.closest('.filter-dropdown-container')) document.querySelectorAll('.filter-menu').forEach(menu => menu.remove());
  if (!e.target.closest('.col-visibility-container')) { const colMenu = document.getElementById('col-visibility-menu'); if (colMenu) colMenu.classList.add('hidden'); }
  if (!e.target.closest('.tag-dropdown-container')) { const tagMenu = document.getElementById('tag-dropdown-menu'); if (tagMenu) tagMenu.classList.add('hidden'); }
});

window.addEventListener('DOMContentLoaded', initWarehouseSwitchers);