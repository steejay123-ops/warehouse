// =========================================================================
// ====== VIEW: AUDIT TRAIL (رهگیری تغییرات و لاگ سیستم) ======
// =========================================================================

// تولید دیتای فرضی حرفه‌ای برای نمایش امکانات ماژول (در نسخه واقعی از بک‌اند می‌آید)
const mockAuditLogs = [
  { id: 101, date: '1402/08/15 10:32', user: 'سامان تقوی (Admin)', module: 'تغذیه MT', action: 'صدور فایل MT26', target: 'انبار فاز ۱۵', severity: 'info', details: { msg: 'خروجی اکسل برای 450 رکورد با تگ [محموله الف] تولید شد.' } },
  { id: 102, date: '1402/08/15 11:05', user: 'علی کریمی (اپراتور تغذیه)', module: 'لیبلینگ', action: 'چاپ مجدد لیبل', target: 'رکورد REC-1088', severity: 'warning', details: { msg: 'چاپ لیبل به دلیل خرابی فیزیکی تکرار شد.' } },
  { id: 103, date: '1402/08/15 12:40', user: 'رضا محمدی (شمارشگر)', module: 'شمارش', action: 'تغییر لوکیشن', target: 'رکورد REC-2044', severity: 'warning', before: { loc: 'WH-01-A', desc: 'ولو 8 اینچ' }, after: { loc: 'WH-02-B', desc: 'ولو 8 اینچ' } },
  { id: 104, date: '1402/08/15 14:15', user: 'سامان تقوی (Admin)', module: 'کاربران', action: 'حذف کاربر', target: 'اکانت: حامد رحیمی', severity: 'critical', before: { status: 'Active', role: 'شمارشگر' }, after: { status: 'Deleted', role: 'N/A' } },
  { id: 105, date: '1402/08/16 08:22', user: 'محمد علوی (سرپرست مدارک)', module: 'Base Data', action: 'ویرایش گروهی', target: '320 رکورد', severity: 'critical', before: { tag: 'بدون تگ', status: 'خام' }, after: { tag: 'محموله مهر', status: 'آماده شمارش' } },
];

function getAudit() {
  return `
  <div class="space-y-6 fade-in text-right pb-10">
    
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
      <div>
        <h3 class="font-black text-slate-800 text-base flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          رهگیری تغییرات و لاگ امنیتی سیستم (Audit Trail)
        </h3>
        <p class="text-[11px] text-slate-500 mt-1">مانیتورینگ جامع رویدادها، تغییرات داده‌ها و رفتار کاربران با قابلیت بازگردانی (Rollback)</p>
      </div>
      <button onclick="showToast('success', 'لاگ‌های فیلتر شده با فرمت CSV دانلود شدند.')" class="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-all flex items-center gap-2 shadow-sm">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        خروجی گزارش (CSV)
      </button>
    </div>

    <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
      <div class="flex items-center gap-2 mb-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
        <span class="text-xs font-bold text-slate-600">فیلترهای جستجو</span>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div class="relative lg:col-span-1">
          <input type="text" placeholder="جستجوی کاربر، شناسه..." class="w-full pl-3 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 transition-all">
          <div class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </div>
        </div>

        <div class="lg:col-span-1">
          <select class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-400 cursor-pointer">
            <option value="">همه ماژول‌ها</option>
            <option value="Base Data">تزریق داده (Base Data)</option>
            <option value="لیبلینگ">لیبلینگ و QR</option>
            <option value="تغذیه MT">تغذیه سامانه‌های MT</option>
            <option value="کاربران">کاربران و گیت‌پاس</option>
          </select>
        </div>

        <div class="lg:col-span-1">
          <select class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-400 cursor-pointer">
            <option value="">همه سطوح حساسیت</option>
            <option value="info">عادی (اطلاع‌رسانی)</option>
            <option value="warning">هشدار (تغییرات محدود)</option>
            <option value="critical">بحرانی (حذف/تغییرات گروهی)</option>
          </select>
        </div>

        <div class="lg:col-span-3 flex items-center bg-slate-50 border border-slate-200 rounded-xl overflow-hidden focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-400/20 focus-within:bg-white transition-all shadow-inner">
          
          <div class="flex-1 flex items-center pr-4 pl-2 hover:bg-slate-100/50 transition-colors group">
            <span class="text-[10px] font-black text-slate-400 ml-2 shrink-0 group-hover:text-indigo-600 transition-colors">از تاریخ:</span>
            <input type="date" class="w-full bg-transparent py-2.5 text-xs font-bold text-slate-700 outline-none cursor-pointer" style="font-family: inherit;">
          </div>
          
          <div class="w-px h-6 bg-slate-300 shrink-0"></div>
          
          <div class="flex-1 flex items-center pr-4 pl-2 hover:bg-slate-100/50 transition-colors group">
            <span class="text-[10px] font-black text-slate-400 ml-2 shrink-0 group-hover:text-indigo-600 transition-colors">تا تاریخ:</span>
            <input type="date" class="w-full bg-transparent py-2.5 text-xs font-bold text-slate-700 outline-none cursor-pointer" style="font-family: inherit;">
          </div>
          
        </div>
      </div>
    </div>

    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div class="overflow-x-auto min-h-[400px]">
        <table class="w-full text-right border-collapse text-xs">
          <thead>
            <tr class="bg-slate-100/80 text-[10px] font-bold text-slate-500 border-b-2 border-slate-200">
              <th class="py-3 px-4 w-12 text-center">ردیف</th>
              <th class="py-3 px-4 w-32">تاریخ و زمان</th>
              <th class="py-3 px-4 w-40">کاربر / نقش</th>
              <th class="py-3 px-4 w-28">ماژول</th>
              <th class="py-3 px-4">شرح رویداد و تارگت</th>
              <th class="py-3 px-4 w-28 text-center">سطح اهمیت</th>
              <th class="py-3 px-4 w-24 text-center">عملیات</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${mockAuditLogs.map((log, idx) => renderAuditRow(log, idx + 1)).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>`;
}

function renderAuditRow(log, index) {
  // تنظیمات رنگی بر اساس سطح حساسیت (Severity)
  let severityBadge = '';
  let rowHighlight = '';
  
  if (log.severity === 'info') {
    severityBadge = `<span class="bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded text-[9px] font-bold">عادی (Info)</span>`;
  } else if (log.severity === 'warning') {
    severityBadge = `<span class="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded text-[9px] font-bold">هشدار (Warn)</span>`;
  } else if (log.severity === 'critical') {
    severityBadge = `<span class="bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded text-[9px] font-bold">بحرانی (Critical)</span>`;
    rowHighlight = 'bg-rose-50/20'; // هایلایت ملایم برای ردیف‌های بحرانی
  }

  // فرار از نقل‌قول‌ها برای ارسال دیتای JSON به توابع
  const safeData = encodeURIComponent(JSON.stringify(log));

  return `
    <tr class="hover:bg-slate-50 transition-colors ${rowHighlight}">
      <td class="py-3 px-4 text-center font-bold text-slate-400">${index}</td>
      <td class="py-3 px-4 font-mono text-[10px] font-bold text-slate-500" dir="ltr">${log.date}</td>
      <td class="py-3 px-4 text-slate-700 font-bold">${log.user}</td>
      <td class="py-3 px-4"><span class="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[9px] font-bold border border-slate-200">${log.module}</span></td>
      <td class="py-3 px-4">
        <p class="font-bold text-slate-800 text-[11px]">${log.action}</p>
        <p class="text-[10px] text-slate-500 mt-0.5">${log.target}</p>
      </td>
      <td class="py-3 px-4 text-center">${severityBadge}</td>
      <td class="py-3 px-4">
        <div class="flex items-center justify-center gap-2">
          <button onclick="openAuditDiffModal('${safeData}')" class="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors tooltip" title="مشاهده جزئیات تغییرات">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          
          ${log.severity !== 'info' ? `
            <button onclick="executeRollback(${log.id})" class="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors tooltip" title="بازگردانی این تغییر (Undo)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" opacity="0.3"/><polyline points="9 22 9 12 15 12 15 22" opacity="0.3"/><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
            </button>
          ` : `
            <span class="p-1.5 text-slate-300"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg></span>
          `}
        </div>
      </td>
    </tr>
  `;
}

// =========================================================================
// ====== MODAL & ACTIONS ======
// =========================================================================

// تابع تولید و نمایش مودال تفاوت‌ها (JSON Diff)
window.openAuditDiffModal = function(encodedLog) {
  const log = JSON.parse(decodeURIComponent(encodedLog));
  
  // بررسی اینکه آیا تغییری در دیتا (Before/After) وجود دارد یا فقط یک پیام است
  let diffContent = '';
  
  if (log.before && log.after) {
    const beforeStr = JSON.stringify(log.before, null, 2);
    const afterStr = JSON.stringify(log.after, null, 2);
    
    diffContent = `
      <div class="grid grid-cols-2 gap-4 mt-4 text-left" dir="ltr">
        <div class="border border-rose-200 rounded-xl overflow-hidden shadow-sm">
          <div class="bg-rose-50 px-3 py-2 text-[10px] font-black text-rose-700 border-b border-rose-200 flex justify-between">
            <span>مقدار قبلی (Before)</span>
            <span class="text-rose-400">- Removed</span>
          </div>
          <pre class="p-3 text-[10px] font-mono text-rose-900 bg-white overflow-x-auto m-0 leading-relaxed">${beforeStr}</pre>
        </div>
        <div class="border border-emerald-200 rounded-xl overflow-hidden shadow-sm">
          <div class="bg-emerald-50 px-3 py-2 text-[10px] font-black text-emerald-700 border-b border-emerald-200 flex justify-between">
            <span>مقدار جدید (After)</span>
            <span class="text-emerald-500">+ Added</span>
          </div>
          <pre class="p-3 text-[10px] font-mono text-emerald-900 bg-white overflow-x-auto m-0 leading-relaxed">${afterStr}</pre>
        </div>
      </div>
    `;
  } else if (log.details && log.details.msg) {
    diffContent = `
      <div class="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 leading-loose">
        ${log.details.msg}
      </div>
    `;
  }

  // ساخت کالبد مودال اختصاصی
  const modalHtml = `
    <div id="audit-diff-modal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm fade-in text-right">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden scale-in">
        <div class="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
          <div>
            <h3 class="font-black text-slate-800 text-sm">جزئیات رویداد سیستمی (Log #${log.id})</h3>
            <p class="text-[10px] text-slate-500 font-bold mt-1">ماژول: <span class="text-indigo-600">${log.module}</span> | کاربر: ${log.user}</p>
          </div>
          <button onclick="document.getElementById('audit-diff-modal').remove()" class="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        
        <div class="p-6">
          <div class="flex items-center gap-2 mb-2">
            <span class="w-2 h-2 rounded-full ${log.severity === 'critical' ? 'bg-rose-500' : log.severity === 'warning' ? 'bg-amber-500' : 'bg-blue-500'}"></span>
            <span class="text-xs font-black text-slate-700">عملیات: ${log.action}</span>
            <span class="text-[10px] text-slate-400 font-bold mr-2">(تارگت: ${log.target})</span>
          </div>
          
          ${diffContent}
        </div>
        
        <div class="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
          <button onclick="document.getElementById('audit-diff-modal').remove()" class="px-5 py-2 rounded-xl text-xs font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 transition-all">بستن</button>
          ${log.severity !== 'info' ? `
            <button onclick="document.getElementById('audit-diff-modal').remove(); executeRollback(${log.id})" class="px-5 py-2 rounded-xl text-xs font-bold text-white bg-rose-500 hover:bg-rose-600 shadow-md shadow-rose-200 transition-all flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
              بازگردانی تغییرات (Undo)
            </button>
          ` : ''}
        </div>
      </div>
    </div>
  `;

  // تزریق مودال به بادی
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// تابع شبیه‌ساز بازگردانی تغییرات
window.executeRollback = function(logId) {
  // در واقعیت این تابع یک درخواست DELETE/POST به بک‌اند می‌فرستد
  const confirmMsg = `آیا از بازگردانی (Rollback) تغییرات مربوط به لاگ #${logId} اطمینان دارید؟ این عملیات دیتابیس را به حالت قبل از این رویداد برمی‌گرداند.`;
  
  if (confirm(confirmMsg)) {
    showToast('info', 'در حال پردازش و اعمال بازگردانی در دیتابیس...');
    
    // شبیه‌سازی دیلی سرور
    setTimeout(() => {
      showToast('success', `تغییرات با موفقیت بازگردانی (Undo) شد.`);
      // در نسخه نهایی، اینجا باید جدول رفرش شود
    }, 1000);
  }
}