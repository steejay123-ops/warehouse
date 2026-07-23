// =========================================================================
// ====== VIEW: IMPORT RECORDS (بارگذاری و تزریق رکوردها) ======
// =========================================================================
function getDocs() {
  // استخراج تگ‌های موجود در سیستم برای پیشنهاد خودکار در فیلد تگ
  let existingTags = new Set();
  appState.records.forEach(r => {
    if (r.tag) r.tag.split('،').forEach(t => existingTags.add(t.trim()));
  });
  const tagOptions = Array.from(existingTags).map(t => `<option value="${t}">`).join('');

  return `
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-5 fade-in">
    <div class="lg:col-span-2 space-y-5">
      
      <!-- پنل اصلی آپلود و تنظیمات -->
      <div class="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 md:p-8">
        <h3 class="font-black text-slate-800 text-base mb-6">آپلود و تزریق رکوردهای انبار</h3>
        
        <!-- درگ اند دراپ فایل -->
        <div id="drag-zone" class="border-2 border-dashed border-slate-300 rounded-2xl p-10 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition-all group" onclick="showToast('info','در حال باز کردن پنجره انتخاب فایل...')">
          <div class="flex flex-col items-center gap-4">
            <div class="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500 group-hover:scale-110 group-hover:text-indigo-600 transition-all">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 12 15 15"/></svg>
            </div>
            <div>
              <p class="text-sm font-bold text-slate-700">فایل اکسل یا Access را اینجا رها کنید</p>
              <p class="text-[11px] text-slate-400 mt-1.5">یا روی این ناحیه کلیک کنید · فرمت‌های مجاز: xlsx, csv, accdb.</p>
            </div>
            <span class="text-xs bg-indigo-50 text-indigo-600 border border-indigo-200 px-5 py-1.5 rounded-full font-bold shadow-sm">انتخاب فایل</span>
          </div>
        </div>

        <!-- NEW: تخصیص تگ در لحظه آپلود (Tag-on-Import) -->
        <div class="mt-6 p-5 bg-indigo-50/40 border border-indigo-100 rounded-2xl">
          <div class="flex items-start gap-3">
            <div class="mt-1">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
            </div>
            <div class="flex-1">
              <label class="block text-xs font-bold text-indigo-900 mb-1.5">تگ‌گذاری گروهی محموله (Tag-on-Import)</label>
              <p class="text-[10px] text-indigo-600/70 mb-3 leading-relaxed">با وارد کردن تگ در این بخش، تمامی رکوردهای موجود در فایل اکسل به صورت خودکار با این شناسه نشانه‌گذاری می‌شوند تا در مراحل بعدی (تخصیص به شمارشگر یا خروجی MT) به راحتی فیلتر شوند.</p>
              
              <div class="relative max-w-sm">
                <input type="text" id="import-tag-input" list="existing-tags" placeholder="مثلاً: محموله فاز ۱، ترخیص مهرماه..." class="w-full px-4 py-2.5 rounded-xl bg-white border border-indigo-200 text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-sm transition-all">
                <datalist id="existing-tags">
                  ${tagOptions}
                </datalist>
              </div>
            </div>
          </div>
        </div>

        <!-- کنترل تداخلات -->
        <div class="mt-6">
          <p class="text-xs font-bold text-slate-700 mb-3">رفتار در صورت تداخل رکوردها (Conflict Control)</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label class="flex items-center gap-3 bg-slate-50 border border-slate-200 p-3.5 rounded-xl cursor-pointer hover:border-indigo-300 transition-colors">
              <input type="radio" name="conflict" value="ignore" checked class="w-4 h-4 text-indigo-600 focus:ring-indigo-500 cursor-pointer">
              <span class="text-xs font-semibold text-slate-700">نادیده گرفتن رکوردهای تکراری</span>
            </label>
            <label class="flex items-center gap-3 bg-slate-50 border border-slate-200 p-3.5 rounded-xl cursor-pointer hover:border-indigo-300 transition-colors">
              <input type="radio" name="conflict" value="replace" class="w-4 h-4 text-indigo-600 focus:ring-indigo-500 cursor-pointer">
              <span class="text-xs font-semibold text-slate-700">جایگزینی مقادیر قدیمی با جدید</span>
            </label>
            <label class="flex items-center gap-3 bg-slate-50 border border-slate-200 p-3.5 rounded-xl cursor-pointer hover:border-indigo-300 transition-colors">
              <input type="radio" name="conflict" value="ask" class="w-4 h-4 text-indigo-600 focus:ring-indigo-500 cursor-pointer">
              <span class="text-xs font-semibold text-slate-700">سوال از کاربر برای هر مورد</span>
            </label>
            <label class="flex items-center gap-3 bg-slate-50 border border-slate-200 p-3.5 rounded-xl cursor-pointer hover:border-indigo-300 transition-colors">
              <input type="radio" name="conflict" value="log" class="w-4 h-4 text-indigo-600 focus:ring-indigo-500 cursor-pointer">
              <span class="text-xs font-semibold text-slate-700">ثبت تداخل در لاگ و ادامه</span>
            </label>
          </div>
        </div>

        <!-- دکمه اکشن -->
        <button onclick="simulateImportProcess()" class="w-full mt-6 py-4 rounded-xl text-sm font-bold text-white transition-all shadow-lg flex items-center justify-center gap-2 active:scale-[0.98]" style="background:linear-gradient(135deg,#4f46e5,#7c3aed)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
          شروع فرآیند پردازش و تزریق به دیتابیس
        </button>
      </div>

      <!-- راهنمای فیلدها -->
      <div class="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 md:p-8">
        <h4 class="font-bold text-slate-800 text-sm mb-5">فیلدهای قابل شناسایی از فایل اکسل</h4>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
          ${['کد سیستم (ID)','کد کالا (MESC)','شماره فنی (Part No)','شرح کالا (Description)','دسته‌بندی (Category)','موقعیت فیزیکی (Location)','تعداد اولیه (Qty)','واحد (Unit)','وضعیت (Condition)'].map(f=>`
            <div class="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-[11px] font-semibold text-slate-600">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              ${f}
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- پنل ترمینال و لاگ سیستم -->
    <div class="lg:col-span-1">
      <div class="bg-slate-900 rounded-3xl p-6 shadow-xl flex flex-col h-full border border-slate-800 min-h-[450px]">
        <div class="flex items-center justify-between mb-6 pb-4 border-b border-slate-800/80">
          <h4 class="font-black text-white text-sm">لاگ فرآیند آخرین تزریق</h4>
          <button onclick="showToast('success','لاگ فرآیند تزریق با فرمت Excel دانلود شد')" class="text-[11px] font-bold text-slate-400 hover:text-white transition-colors flex items-center gap-1.5">
            دانلود لاگ
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </button>
        </div>
        
        <div id="import-log-terminal" class="flex-1 space-y-3 font-mono text-[11px] leading-relaxed overflow-y-auto pr-2 text-slate-300" style="scrollbar-width: thin; scrollbar-color: #334155 transparent;">
          <p class="text-slate-500">>> منتظر دریافت فایل و فرمان تزریق...</p>
        </div>
        
        <div class="mt-6 pt-5 border-t border-slate-800 grid grid-cols-3 gap-3 text-center shrink-0">
          <div class="bg-slate-800/40 rounded-xl p-2.5">
            <p id="log-err-count" class="text-base font-black text-rose-500">0</p>
            <p class="text-[10px] font-bold text-slate-400 mt-1">خطا</p>
          </div>
          <div class="bg-slate-800/40 rounded-xl p-2.5">
            <p id="log-warn-count" class="text-base font-black text-amber-500">0</p>
            <p class="text-[10px] font-bold text-slate-400 mt-1">تداخل</p>
          </div>
          <div class="bg-slate-800/40 rounded-xl p-2.5">
            <p id="log-ok-count" class="text-base font-black text-emerald-500">0</p>
            <p class="text-[10px] font-bold text-slate-400 mt-1">موفق</p>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

// ------ Helper function to simulate the import process visually ------
function simulateImportProcess() {
  const tagValue = document.getElementById('import-tag-input')?.value.trim();
  const terminal = document.getElementById('import-log-terminal');
  
  if (!terminal) return;
  
  terminal.innerHTML = '';
  document.getElementById('log-err-count').innerText = '0';
  document.getElementById('log-warn-count').innerText = '0';
  document.getElementById('log-ok-count').innerText = '0';

  const logs = [
    { type: 'info', msg: '>> شروع فرآیند پردازش دیتابیس...' },
    { type: 'info', msg: '>> فایل: Shiraz_Records_Batch_7.xlsx' },
    { type: 'tag', msg: tagValue ? `>> اعمال تگ گروهی [${tagValue}] تایید شد.` : '>> هیچ تگ گروهی اختصاص داده نشد.' },
    { type: 'ok', msg: '[OK] رکورد REC-1088: استخراج و مپ فیلدها موفق.' },
    { type: 'ok', msg: '[OK] رکورد REC-1089: استخراج و مپ فیلدها موفق.' },
    { type: 'warn', msg: '[WARN] رکورد REC-2005: از قبل داده داشت، طبق قانون نادیده گرفته شد.' },
    { type: 'err', msg: '[ERR] رکورد خط 12: فرمت کد MESC نامعتبر است. رد شد.' },
    { type: 'ok', msg: '[OK] رکورد REC-1090: استخراج و مپ فیلدها موفق.' },
    { type: 'info', msg: '>> اتمام پردازش. در حال تزریق نهایی به پایگاه داده...' },
    { type: 'success', msg: '>> فرآیند با موفقیت پایان یافت.' }
  ];

  let i = 0;
  const interval = setInterval(() => {
    if (i >= logs.length) {
      clearInterval(interval);
      showModal('فرآیند تزریق کامل شد', `رکوردهای فایل اکسل ${tagValue ? `با تگ "${tagValue}"` : ''} با موفقیت به دیتابیس افزوده شدند. جزئیات در پنل لاگ قابل مشاهده است.`, 'success');
      
      // Update counters at the end
      document.getElementById('log-err-count').innerText = '1';
      document.getElementById('log-warn-count').innerText = '1';
      document.getElementById('log-ok-count').innerText = '3';
      return;
    }

    const log = logs[i];
    let colorClass = 'text-slate-400';
    if (log.type === 'ok') colorClass = 'text-emerald-400';
    if (log.type === 'warn') colorClass = 'text-amber-400';
    if (log.type === 'err') colorClass = 'text-rose-400';
    if (log.type === 'tag') colorClass = 'text-indigo-400 font-bold';
    if (log.type === 'success') colorClass = 'text-white font-black';

    terminal.innerHTML += `<p class="${colorClass}">${log.msg}</p>`;
    terminal.scrollTop = terminal.scrollHeight;
    i++;
  }, 350); // شبیه‌سازی دیلی پردازش
}

function initDragDrop() {
  // این تابع از قبل در app.js فراخوانی می‌شود، در صورت نیاز به پیاده‌سازی لاجیک دراپ زون، کدهای آن اینجا قرار می‌گیرد.
}