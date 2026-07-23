// =========================================================================
// ====== VIEW: DISPATCH (تخصیص، برچسب‌گذاری و ارجاعات موازی) ======
// =========================================================================

// تعریف ستون‌های پیشرفته و اختصاصی این ویو (جایگزین ستون‌های ساده قبلی)
const ADVANCED_DISPATCH_COLUMNS = [
  { key: 'mesc', label: 'کد کالا (MESC)' },
  { key: 'desc', label: 'شرح کالا' },
  { key: 'loc', label: 'لوکیشن فیزیکی' },
  { key: 'tag', label: 'تگ / محموله' },
  { key: 'labelStatus', label: 'وضعیت لیبل' },
  { key: 'fieldAssignee', label: 'تیم شمارش (میدان)' },
  { key: 'fieldStatus', label: 'فاز میدانی' },
  { key: 'docAssignee', label: 'تیم مدارک (مالی)' },
  { key: 'docStatus', label: 'فاز اسناد' }
];

function getDispatch() {
  let activeWhName = 'تجمیعی کل سایت‌ها (همه انبارها)';
  if (appState.activeWarehouseId !== 'ALL') {
    const wh = appState.projects.find(p => p.id === appState.activeWarehouseId);
    if (wh) activeWhName = wh.name;
  }

  // فیلتر هوشمند پرسنل بر اساس تخصص
  const fieldWorkers = appState.users.filter(u => (u.roleId === 'R3' || u.roleId === 'R5'));
  const docWorkers = appState.users.filter(u => (u.roleId === 'R4'));

  return `
  <div class="space-y-6 fade-in pb-10">
    
    <!-- هدر ماژول -->
    <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
      <div>
        <h3 class="font-black text-slate-800 text-sm flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2.5"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
          تخصیص و هدایت هوشمند رکوردها (محیط: ${activeWhName})
        </h3>
        <p class="text-[11px] text-slate-500 mt-1.5">مدیریت چاپ لیبل، ارجاع موازی به تیم‌های میدانی و مدارک، و رهگیری مغایرت‌ها</p>
      </div>
      <div class="bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-lg flex items-center gap-2">
         <span class="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
         <span class="text-[10px] font-bold text-indigo-700">شمارش کور (Blind Count) فعال است</span>
      </div>
    </div>

    <!-- پنل کنترل عملیات گروهی (Control Panel) -->
    <div class="grid grid-cols-1 xl:grid-cols-12 gap-4">
      
      <!-- بلوک ۱: مدیریت تگ و لیبل -->
      <div class="xl:col-span-5 bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between">
        <h4 class="text-[11px] font-black text-slate-700 mb-3 border-b border-slate-100 pb-2">۱. سازمان‌دهی و لیبلینگ</h4>
        
        <div class="space-y-3">
          <div class="relative tag-dropdown-container w-full">
            <button onclick="toggleTagDropdown()" class="w-full bg-slate-50 border border-slate-200 px-3 py-2.5 rounded-xl text-xs text-right flex justify-between items-center outline-none hover:border-indigo-300 transition-colors">
              <span id="tag-dropdown-label" class="text-slate-500 font-bold truncate ml-2">اختصاص تگ گروهی به منتخب‌ها...</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="shrink-0 text-slate-400"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>
            <div id="tag-dropdown-menu" class="hidden absolute top-full right-0 mt-1 w-full bg-white rounded-xl shadow-xl border border-slate-200 z-[60] flex flex-col overflow-hidden">
              <div class="p-2 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                <input type="text" id="new-tag-input" placeholder="ایجاد تگ جدید..." class="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-indigo-400">
                <button onclick="addNewTag()" class="bg-indigo-600 text-white px-3 py-2 rounded-lg font-bold hover:bg-indigo-700 transition-colors">+</button>
              </div>
              <div class="p-2 max-h-40 overflow-y-auto space-y-1" id="tag-checkbox-list"></div>
              <button onclick="applyBatchTags()" class="w-full bg-slate-100 text-slate-700 py-2 text-[10px] font-bold border-t border-slate-200 hover:bg-slate-200">اعمال تگ‌ها</button>
            </div>
          </div>
          
          <button onclick="executeBatchLabelPrint()" class="w-full py-2.5 rounded-xl bg-slate-800 text-white text-xs font-bold shadow-md hover:bg-slate-900 transition-all flex justify-center items-center gap-2 active:scale-[0.98]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
            چاپ لیبل (QR) رکوردهای منتخب
          </button>
        </div>
      </div>

      <!-- بلوک ۲: ارجاع به میدان (وابسته به لیبل) -->
      <div class="xl:col-span-4 bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between relative overflow-hidden">
        <div class="absolute top-0 right-0 w-1 h-full bg-blue-500"></div>
        <h4 class="text-[11px] font-black text-blue-800 mb-3 border-b border-slate-100 pb-2 pr-2">۲. ارجاع میدانی (عملیات شمارش)</h4>
        <p class="text-[9px] text-slate-500 mb-3 pr-2 font-medium leading-relaxed">فقط رکوردهایی که لیبل آنها <span class="text-blue-600 font-bold">«چاپ شده»</span> است، قابل ارجاع به تبلت شمارشگران هستند.</p>
        
        <div class="flex flex-col gap-2 pr-2">
          <select id="field-worker-select" class="w-full bg-slate-50 border border-slate-200 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 outline-none appearance-none cursor-pointer focus:border-blue-400">
            <option value="">-- انتخاب تیم / شمارشگر --</option>
            ${fieldWorkers.map(w => `<option value="${w.firstName} ${w.lastName}">${w.firstName} ${w.lastName}</option>`).join('')}
          </select>
          <button onclick="executeFieldDispatch()" class="w-full py-2.5 bg-blue-600 text-white text-xs font-bold rounded-xl shadow-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 active:scale-[0.98]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            ارسال به کارتابل میدان
          </button>
        </div>
      </div>

      <!-- بلوک ۳: ارجاع اسناد (موازی) -->
      <div class="xl:col-span-3 bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between relative overflow-hidden">
        <div class="absolute top-0 right-0 w-1 h-full bg-amber-500"></div>
        <h4 class="text-[11px] font-black text-amber-800 mb-3 border-b border-slate-100 pb-2 pr-2">۳. ارجاع اسناد (عملیات دفتری)</h4>
        <p class="text-[9px] text-slate-500 mb-3 pr-2 font-medium leading-relaxed">این فرآیند مستقل از چاپ لیبل بوده و به صورت موازی انجام می‌شود.</p>
        
        <div class="flex flex-col gap-2 pr-2">
          <select id="doc-worker-select" class="w-full bg-slate-50 border border-slate-200 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 outline-none appearance-none cursor-pointer focus:border-amber-400">
            <option value="">-- کارشناس مدارک --</option>
            ${docWorkers.map(w => `<option value="${w.firstName} ${w.lastName}">${w.firstName} ${w.lastName}</option>`).join('')}
          </select>
          <button onclick="executeDocDispatch()" class="w-full py-2.5 bg-amber-500 text-white text-xs font-bold rounded-xl shadow-sm hover:bg-amber-600 transition-colors flex items-center justify-center gap-2 active:scale-[0.98]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            ارسال به کارتابل اسناد
          </button>
        </div>
      </div>

    </div>

    <!-- جدول داده‌ها -->
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
      <div class="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 flex-wrap gap-3">
        <div class="flex items-center gap-3">
          <h4 class="font-bold text-slate-700 text-xs">لیست یکپارچه رکوردها</h4>
          <span id="table-record-count" class="bg-indigo-100 text-indigo-700 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-indigo-200">0 رکورد</span>
        </div>
        
        <!-- Action سریع برای بازشماری -->
        <button onclick="requestRecount()" class="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 rounded-lg text-[10px] font-bold transition-colors">
           <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
           درخواست بازشماری (مغایرت)
        </button>
      </div>
      
      <div id="dispatch-table-container" class="overflow-x-auto min-h-[300px]"></div>
    </div>
  </div>`;
}

// ------ DISPATCH TABLE RENDERING ------
function renderDispatchTable() {
  const container = document.getElementById('dispatch-table-container');
  if (!container) return;

  // فیلتر انبارها
  let displayRecords = appState.activeWarehouseId === 'ALL' 
    ? [...appState.records] 
    : appState.records.filter(r => r.project === appState.activeWarehouseId);
    
  // مقداردهی اولیه فیلدهای جدید برای رکوردهای قدیمی (Data Patching)
  displayRecords.forEach(r => {
      if(!r.labelStatus) r.labelStatus = 'pending'; // pending, printed, reprint
      if(!r.fieldStatus) r.fieldStatus = r.status === 'در حال شمارش' ? 'counting' : 'waiting';
      if(!r.docStatus) r.docStatus = 'waiting';
      if(!r.fieldAssignee) r.fieldAssignee = r.assignee || 'ثبت نشده';
      if(!r.docAssignee) r.docAssignee = 'ثبت نشده';
  });

  document.getElementById('table-record-count').textContent = `${displayRecords.length.toLocaleString()} رکورد`;

  let html = `<table class="w-full text-right border-collapse text-xs">
    <thead>
      <tr class="bg-slate-100/80 text-[10px] font-bold text-slate-500 border-b-2 border-slate-200">
        <th class="py-3 px-3 text-center w-10"><input type="checkbox" class="rounded text-indigo-600 focus:ring-0" onchange="toggleSelectAllRecords(this)"></th>`;

  ADVANCED_DISPATCH_COLUMNS.forEach(col => {
    html += `<th class="py-3 px-3 whitespace-nowrap">${col.label}</th>`;
  });

  html += `</tr></thead><tbody class="divide-y divide-slate-100">`;

  if (displayRecords.length === 0) {
    html += `<tr><td colspan="${ADVANCED_DISPATCH_COLUMNS.length + 1}" class="py-12 text-center text-slate-400 font-bold">هیچ رکوردی یافت نشد.</td></tr>`;
  } else {
    displayRecords.forEach(r => {
      // تولید Badge وضعیت لیبل
      let lblBadge = '';
      if(r.labelStatus === 'pending') lblBadge = `<span class="text-[9px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 font-bold border border-slate-200">چاپ نشده ⚪</span>`;
      else if(r.labelStatus === 'printed') lblBadge = `<span class="text-[9px] px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-bold border border-blue-200">چاپ شده 🔵</span>`;
      else if(r.labelStatus === 'reprint') lblBadge = `<span class="text-[9px] px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 font-bold border border-rose-300 animate-pulse">نیاز به چاپ مجدد 🔴</span>`;

      // تولید Badge فاز میدانی
      let fieldBadge = '';
      if(r.fieldStatus === 'waiting') fieldBadge = `<span class="text-slate-400 text-[9px] font-bold">در انتظار ارجاع</span>`;
      else if(r.fieldStatus === 'counting') fieldBadge = `<span class="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-[9px] font-bold">در کارتابل شمارشگر</span>`;
      else if(r.fieldStatus === 'recount') fieldBadge = `<span class="text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded text-[9px] font-bold border border-rose-200">مغایرت (بازشماری)</span>`;
      else if(r.fieldStatus === 'done') fieldBadge = `<span class="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded text-[9px] font-bold">تایید میدانی</span>`;

      // تولید Badge فاز اسناد
      let docBadge = '';
      if(r.docStatus === 'waiting') docBadge = `<span class="text-slate-400 text-[9px] font-bold">در انتظار ارجاع</span>`;
      else if(r.docStatus === 'processing') docBadge = `<span class="text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded text-[9px] font-bold">در دست بررسی</span>`;
      else if(r.docStatus === 'done') docBadge = `<span class="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded text-[9px] font-bold">تکمیل اسناد</span>`;

      // رندر تگ‌ها
      const tagHtml = r.tag ? r.tag.split('،').map(t => `<span class="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[9px] font-bold ml-1 border border-slate-200 inline-block mb-0.5">${t.trim()}</span>`).join('') : '<span class="text-slate-300">-</span>';

      html += `
        <tr class="hover:bg-indigo-50/30 transition-colors">
          <td class="py-3 px-3 text-center"><input type="checkbox" class="record-checkbox rounded text-indigo-600 focus:ring-0" value="${r.id}"></td>
          <td class="py-3 px-3 font-mono font-black text-indigo-700">${r.mesc || '-'}</td>
          <td class="py-3 px-3 font-medium text-slate-700 max-w-[180px] truncate" title="${r.desc}">${r.desc || '-'}</td>
          <td class="py-3 px-3 font-mono text-[10px] text-slate-600">${r.loc || '-'}</td>
          <td class="py-3 px-3 max-w-[140px] truncate">${tagHtml}</td>
          <td class="py-3 px-3 text-center">${lblBadge}</td>
          <td class="py-3 px-3 font-bold text-[10px] ${r.fieldAssignee !== 'ثبت نشده' ? 'text-slate-800' : 'text-slate-400'}">${r.fieldAssignee}</td>
          <td class="py-3 px-3 text-center bg-slate-50/50">${fieldBadge}</td>
          <td class="py-3 px-3 font-bold text-[10px] ${r.docAssignee !== 'ثبت نشده' ? 'text-slate-800' : 'text-slate-400'}">${r.docAssignee}</td>
          <td class="py-3 px-3 text-center bg-slate-50/50">${docBadge}</td>
        </tr>`;
    });
  }

  html += `</tbody></table>`;
  container.innerHTML = html;
  renderTagDropdownList();
}

// ------ ACTIONS ------

function toggleSelectAllRecords(source) { 
  document.querySelectorAll('.record-checkbox').forEach(cb => cb.checked = source.checked); 
}

function toggleTagDropdown() { 
  document.getElementById('tag-dropdown-menu')?.classList.toggle('hidden'); 
}

function getSelectedRecords() {
  const ids = Array.from(document.querySelectorAll('.record-checkbox:checked')).map(cb => cb.value);
  return appState.records.filter(r => ids.includes(r.id));
}

// عملیات ۱: چاپ لیبل
function executeBatchLabelPrint() {
  const selected = getSelectedRecords();
  if (selected.length === 0) return showToast('warning', 'ابتدا رکوردهایی که قصد چاپ لیبل آن‌ها را دارید انتخاب کنید.');
  
  selected.forEach(r => {
    r.labelStatus = 'printed'; // تغییر وضعیت به چاپ شده
  });
  
  showModal('چاپ گروهی لیبل', `دستور چاپ لیبل و ساخت QR Code برای <b>${selected.length}</b> رکورد به صورت گروهی صادر شد. هم‌اکنون این رکوردها برای ارجاع میدانی باز (Unlock) شدند.`, 'success'); 
  renderDispatchTable();
}

// عملیات ۲: ارجاع به میدان (با کنترل قفل لیبل)
function executeFieldDispatch() {
  const selected = getSelectedRecords();
  const worker = document.getElementById('field-worker-select').value;
  
  if (selected.length === 0) return showToast('warning', 'رکوردی انتخاب نشده است.');
  if (!worker) return showToast('error', 'لطفا تیم یا شمارشگر میدانی را انتخاب کنید.');

  // بررسی شرط منطقی: آیا همه رکوردهای انتخابی لیبل چاپ شده دارند؟
  const unprinted = selected.filter(r => r.labelStatus !== 'printed');
  if (unprinted.length > 0) {
    return showModal('خطای منطق عملیاتی', `<b>${unprinted.length}</b> مورد از رکوردهای انتخابی هنوز لیبل فیزیکی ندارند!<br><br><span class="text-xs text-rose-600">طبق دستورالعمل انبارگردانی، کالاها باید ابتدا برچسب‌گذاری شوند و سپس وارد کارتابل تبلت شمارشگر شوند. ابتدا عملیات چاپ لیبل را انجام دهید.</span>`, 'error');
  }

  selected.forEach(r => {
    r.fieldAssignee = worker;
    r.fieldStatus = 'counting'; // در کارتابل
  });
  
  showToast('success', `${selected.length} رکورد به کارتابل شمارشگر (${worker}) ارسال شد.`);
  renderDispatchTable();
}

// عملیات ۳: ارجاع به مدارک (مستقل)
function executeDocDispatch() {
  const selected = getSelectedRecords();
  const worker = document.getElementById('doc-worker-select').value;
  
  if (selected.length === 0) return showToast('warning', 'رکوردی انتخاب نشده است.');
  if (!worker) return showToast('error', 'لطفا کارشناس اسناد و مدارک را انتخاب کنید.');

  selected.forEach(r => {
    r.docAssignee = worker;
    r.docStatus = 'processing';
  });
  
  showToast('success', `فایل ${selected.length} رکورد به طور موازی جهت تکمیل اطلاعات مالی به کارتابل (${worker}) رفت.`);
  renderDispatchTable();
}

// عملیات ۴: درخواست بازشماری (کشف مغایرت)
function requestRecount() {
  const selected = getSelectedRecords();
  if (selected.length === 0) return showToast('warning', 'رکوردی برای ثبت مغایرت انتخاب نشده است.');

  let changedCount = 0;
  selected.forEach(r => {
    // فقط رکوردهایی که در میدان هستند را می‌توان بازشماری داد
    if (r.fieldStatus === 'counting' || r.fieldStatus === 'done') {
      r.fieldStatus = 'recount';
      changedCount++;
    }
  });

  if (changedCount > 0) {
    showToast('warning', `وضعیت ${changedCount} رکورد به "مغایرت - نیازمند بازشماری کور" تغییر یافت.`);
    renderDispatchTable();
  } else {
    showToast('error', 'رکوردهای انتخابی در مرحله‌ای نیستند که بتوان دستور بازشماری صادر کرد.');
  }
}

// مدیریت تگ‌ها
function renderTagDropdownList() {
  const container = document.getElementById('tag-checkbox-list');
  if(!container) return;
  
  let currentWhTags = new Set();
  const relevantRecords = appState.activeWarehouseId === 'ALL' 
    ? appState.records 
    : appState.records.filter(r => r.project === appState.activeWarehouseId);

  relevantRecords.forEach(r => {
    if (r.tag) r.tag.split('،').forEach(t => currentWhTags.add(t.trim()));
  });

  if (!appState.dispatchSettings.sessionTags) appState.dispatchSettings.sessionTags = {};
  const targetId = appState.activeWarehouseId === 'ALL' ? 'GLOBAL' : appState.activeWarehouseId;
  if (appState.dispatchSettings.sessionTags[targetId]) {
      appState.dispatchSettings.sessionTags[targetId].forEach(t => currentWhTags.add(t));
  }

  container.innerHTML = Array.from(currentWhTags).map(tag => `<label class="flex items-center gap-2 p-1.5 hover:bg-slate-100 rounded cursor-pointer"><input type="checkbox" value="${tag}" class="batch-tag-checkbox rounded text-indigo-600 focus:ring-0"><span class="text-xs text-slate-700 font-medium">${tag}</span></label>`).join('');
}

function addNewTag() {
  const val = document.getElementById('new-tag-input').value.trim();
  if (val) { 
    if (!appState.dispatchSettings.sessionTags) appState.dispatchSettings.sessionTags = {};
    const targetId = appState.activeWarehouseId === 'ALL' ? 'GLOBAL' : appState.activeWarehouseId;
    if (!appState.dispatchSettings.sessionTags[targetId]) appState.dispatchSettings.sessionTags[targetId] = [];
    
    if(!appState.dispatchSettings.sessionTags[targetId].includes(val)) {
        appState.dispatchSettings.sessionTags[targetId].push(val);
        renderTagDropdownList(); 
    }
    document.getElementById('new-tag-input').value = '';
  }
}

function applyBatchTags() {
  const selected = getSelectedRecords();
  if (selected.length === 0) return showToast('warning', 'رکوردی انتخاب نشده است.');
  
  const tags = Array.from(document.querySelectorAll('.batch-tag-checkbox:checked')).map(cb => cb.value).join('، ');
  if (!tags) return showToast('warning', 'هیچ تگی از لیست انتخاب نکرده‌اید.');

  selected.forEach(r => {
    r.tag = tags;
  });
  
  document.getElementById('tag-dropdown-menu').classList.add('hidden');
  showToast('success', `تگ‌های انتخابی روی ${selected.length} رکورد اعمال شد.`);
  renderDispatchTable();
}