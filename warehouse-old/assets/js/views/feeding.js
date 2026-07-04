// =========================================================================
// ====== VIEW: FEEDING MT26/49 (تغذیه سیستم‌های جامع مرکزی) ======
// =========================================================================
function getFeeding() {
  const activeWh = appState.projects.find(p => p.id === appState.activeWarehouseId) || appState.projects[0];
  
  // فیلتر رکوردهای انبار جاری که در فاز قبل تکمیل شده‌اند یا در جریان تغذیه‌اند
  let targetRecords = appState.records.filter(r => r.project === appState.activeWarehouseId && (r.status === 'تکمیل شده' || r.status === 'در جریان تغذیه' || r.status === 'آرشیو نهایی'));

  return `
  <div class="space-y-6 fade-in text-right">
    
    <!-- هدر ماژول -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
      <div>
        <h3 class="font-black text-slate-800 text-base flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
          تغذیه سامانه‌های مرکزی (MT26 & MT49)
        </h3>
        <p class="text-[11px] text-slate-500 mt-1">انبار فعال: <span class="font-bold text-slate-700">${activeWh.name}</span> | صدور و رهگیری ایزوله رکوردهای MT26 و MT49</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button onclick="executeMTExport('MT26')" class="px-4 py-2.5 rounded-xl text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 shadow-sm transition-all flex items-center gap-2 active:scale-95">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          صدور اکسل MT26
        </button>
        <button onclick="executeMTExport('MT49')" class="px-4 py-2.5 rounded-xl text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 shadow-sm transition-all flex items-center gap-2 active:scale-95">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          صدور اکسل MT49
        </button>
      </div>
    </div>

    <!-- اکشن بار گروهی و بازخورد دستی -->
    <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center gap-3 relative shadow-sm">
      <div class="flex items-center gap-2 border-l border-slate-200 pl-3 shrink-0">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-emerald-600"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        <span class="text-xs font-bold text-slate-700">ثبت بازخورد اپراتور:</span>
      </div>

      <button onclick="markAsMTCompleted('MT26')" class="px-4 py-2 bg-white border border-slate-300 text-slate-700 text-[11px] font-bold rounded-lg hover:border-indigo-400 hover:text-indigo-700 transition-colors shrink-0 shadow-sm active:scale-95">
        ثبت تیک نهایی MT26
      </button>
      <button onclick="markAsMTCompleted('MT49')" class="px-4 py-2 bg-white border border-slate-300 text-slate-700 text-[11px] font-bold rounded-lg hover:border-amber-400 hover:text-amber-700 transition-colors shrink-0 shadow-sm active:scale-95">
        ثبت تیک نهایی MT49
      </button>
      
      <div class="flex-1"></div>
      
      <!-- فیلتر تگ‌ها -->
      <div class="relative w-full sm:w-56 shrink-0">
        <div class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
        </div>
        <select class="w-full pl-3 pr-9 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 outline-none focus:border-indigo-400 appearance-none cursor-pointer">
          <option value="">فیلتر براساس تگ محموله...</option>
          <option value="اولویت الف">محموله اولویت الف</option>
          <option value="محموله مهر">محموله مهر ماه</option>
        </select>
      </div>
    </div>

    <!-- جدول داده‌ها -->
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div class="overflow-x-auto min-h-[350px]">
        <table class="w-full text-right border-collapse text-xs">
          <thead>
            <tr class="bg-slate-100/80 text-[10px] font-bold text-slate-500 border-b-2 border-slate-200">
              <th class="py-3 px-3 text-center w-10"><input type="checkbox" class="rounded text-indigo-600 focus:ring-0" onchange="toggleSelectAllMT(this)"></th>
              <th class="py-3 px-4 w-28">کد کالا (MESC)</th>
              <th class="py-3 px-4">شرح کالا</th>
              <th class="py-3 px-4 w-24">تگ / محموله</th>
              <th class="py-3 px-4 w-28 text-center border-r border-slate-200">وضعیت MT26</th>
              <th class="py-3 px-4 w-28 text-center border-r border-slate-200">وضعیت MT49</th>
              <th class="py-3 px-4 w-28 text-center border-r border-slate-200">وضعیت جامع</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${targetRecords.length === 0 ? `
              <tr><td colspan="7" class="py-12 text-center text-slate-400 font-bold text-xs">رکوردی برای تغذیه در این انبار یافت نشد.</td></tr>
            ` : targetRecords.map(r => renderMTRow(r)).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>`;
}

function renderMTRow(r) {
  // شبیه‌سازی وضعیت ماشین‌های حالت مستقل برای MT26 و MT49
  // (آماده صدور: ready | در جریان: exported | تکمیل شده: completed)
  const mt26State = r.mt26State || 'ready';
  const mt49State = r.mt49State || 'ready';
  
  // تولید لیبل‌های وضعیت برای هر کدام به صورت ایزوله
  const mt26Badge = getMTStatusBadge(mt26State, 'MT26', 'indigo');
  const mt49Badge = getMTStatusBadge(mt49State, 'MT49', 'amber');

  // وضعیت جامع رکورد
  let generalStatusHtml = `<span class="bg-slate-100 text-slate-600 px-2 py-1 rounded text-[9px] font-bold">آماده صدور</span>`;
  if (mt26State === 'completed' && mt49State === 'completed') {
    generalStatusHtml = `<span class="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-[9px] font-bold border border-emerald-200">✅ آرشیو نهایی</span>`;
  } else if (mt26State !== 'ready' || mt49State !== 'ready') {
    generalStatusHtml = `<span class="bg-sky-100 text-sky-700 px-2 py-1 rounded text-[9px] font-bold">در جریان تغذیه</span>`;
  }

  // رندر تگ‌ها
  const tagHtml = r.tag ? r.tag.split('،').map(t => `<span class="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[9px] font-bold border border-slate-200 ml-1 mb-1 inline-block">${t.trim()}</span>`).join('') : '<span class="text-slate-400">-</span>';

  // اگر هر دو تایید نهایی شده باشند، ردیف کمرنگ می‌شود
  const isFullyCompleted = mt26State === 'completed' && mt49State === 'completed';

  return `
    <tr class="hover:bg-slate-50 transition-colors ${isFullyCompleted ? 'opacity-50 bg-slate-50/50' : ''}">
      <td class="py-3 px-3 text-center">
        <input type="checkbox" class="mt-checkbox rounded text-indigo-600 focus:ring-0" value="${r.id}" ${isFullyCompleted ? 'disabled' : ''}>
      </td>
      <td class="py-3 px-4 font-mono font-bold text-slate-700">${r.mesc || '-'}</td>
      <td class="py-3 px-4 text-slate-700 font-medium max-w-[200px] truncate" title="${r.desc}">${r.desc || '-'}</td>
      <td class="py-3 px-4">${tagHtml}</td>
      <td class="py-3 px-4 text-center border-r border-slate-100">${mt26Badge}</td>
      <td class="py-3 px-4 text-center border-r border-slate-100">${mt49Badge}</td>
      <td class="py-3 px-4 text-center border-r border-slate-100">${generalStatusHtml}</td>
    </tr>
  `;
}

function getMTStatusBadge(state, label, color) {
  if (state === 'completed') {
    return `<span class="text-emerald-600 flex items-center justify-center gap-1 text-[9px] font-bold"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg> تایید نهایی</span>`;
  }
  if (state === 'exported') {
    return `<span class="bg-${color}-100 text-${color}-700 px-2 py-0.5 rounded text-[9px] font-bold animate-pulse">در جریان تغذیه ${label}</span>`;
  }
  return `<span class="text-slate-400 text-[9px] font-bold border border-slate-200 px-2 py-0.5 rounded border-dashed">آماده صدور</span>`;
}

// ------ Helper Functions for Feeding Module ------

function toggleSelectAllMT(source) {
  document.querySelectorAll('.mt-checkbox:not([disabled])').forEach(cb => cb.checked = source.checked);
}

function executeMTExport(mtType) {
  const cbs = document.querySelectorAll('.mt-checkbox:checked');
  if (cbs.length === 0) return showToast('warning', `حداقل یک رکورد را برای صدور فایل ${mtType} انتخاب کنید.`);
  
  cbs.forEach(cb => {
    const rec = appState.records.find(r => r.id === cb.value);
    if (rec) {
      if (mtType === 'MT26' && rec.mt26State !== 'completed') rec.mt26State = 'exported';
      if (mtType === 'MT49' && rec.mt49State !== 'completed') rec.mt49State = 'exported';
      updateGeneralStatus(rec);
    }
  });

  showToast('success', `فایل خروجی ${mtType} تولید شد. وضعیت رکوردها به "در جریان تغذیه ${mtType}" تغییر یافت.`);
  switchTab('feeding');
}

function markAsMTCompleted(mtType) {
  const cbs = document.querySelectorAll('.mt-checkbox:checked');
  if (cbs.length === 0) return showToast('warning', `رکوردی برای ثبت بازخورد ${mtType} انتخاب نشده است.`);
  
  let hasError = false;

  cbs.forEach(cb => {
    const rec = appState.records.find(r => r.id === cb.value);
    if (rec) {
      // اعمال قانون: مادامی که خروجی گرفته نشده، اجازه تایید نده!
      if (mtType === 'MT26') {
        if (rec.mt26State === 'exported') rec.mt26State = 'completed';
        else if (rec.mt26State === 'ready') hasError = true;
      }
      if (mtType === 'MT49') {
        if (rec.mt49State === 'exported') rec.mt49State = 'completed';
        else if (rec.mt49State === 'ready') hasError = true;
      }
      updateGeneralStatus(rec);
    }
  });

  if (hasError) {
    showToast('error', `عملیات روی برخی رکوردها انجام نشد! ابتدا باید فایل خروجی ${mtType} را صادر کنید.`);
  } else {
    showToast('success', `بازخورد ثبت نهایی در سیستم ${mtType} با موفقیت اعمال شد.`);
  }
  
  const checkAll = document.querySelector('th input[type="checkbox"]');
  if(checkAll) checkAll.checked = false;
  
  switchTab('feeding');
}

function updateGeneralStatus(rec) {
  if (rec.mt26State === 'completed' && rec.mt49State === 'completed') rec.status = 'آرشیو نهایی';
  else rec.status = 'در جریان تغذیه';
}