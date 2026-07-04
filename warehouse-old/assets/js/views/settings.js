// =========================================================================
// ====== VIEW: SYSTEM SETTINGS (پیکربندی کلان و رفتار سامانه) ======
// =========================================================================

// State موقت برای مدیریت در لحظه تنظیمات قبل از ذخیره نهایی
let tempSettingsState = {
  blindCount: true,
  printQtyOnLabel: false
};

function getSettings() {
  const lbl = appState.labelSettings || { printMesc: true, printKey: true, printDesc: true, printLoc: true, printQty: false, printCond: true, printTag: true, printProject: true, printQr: true };
  
  // سینک کردن استیت موقت با استیت اصلی سیستم
  tempSettingsState.blindCount = true; // فرض بر روشن بودن شمارش کور در تنظیمات پایه
  tempSettingsState.printQtyOnLabel = lbl.printQty;

  return `
  <div class="max-w-6xl mx-auto space-y-6 fade-in text-right pb-10">
    
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm sticky top-0 z-20">
      <div>
        <h3 class="font-black text-slate-800 text-sm flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          پیکربندی کلان و معماری رفتار سامانه
        </h3>
        <p class="text-[11px] text-slate-500 mt-1.5">مدیریت قوانین انبارگردانی، لاگ‌ها، یکپارچگی داده‌ها (MT) و تنظیمات پیش‌فرض چاپ</p>
      </div>
      <button onclick="saveGlobalSettings()" class="px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 hover:shadow-indigo-200" style="background:linear-gradient(135deg,#4f46e5,#7c3aed)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        ذخیره و اعمال تنظیمات
      </button>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      
      <div class="space-y-6">
        
        <div class="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="bg-slate-50 border-b border-slate-100 p-4">
            <h4 class="font-black text-slate-800 text-sm flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              قوانین عملیاتی و انبارگردانی فیزیکی
            </h4>
          </div>
          <div class="p-5 space-y-4">
            ${renderLogicToggle('set_blind_count', 'شمارش کور (Blind Count)', 'مخفی کردن موجودی سیستمی (دفتری) از دید انباردار میدانی در اپلیکیشن برای جلوگیری از تقلب.', tempSettingsState.blindCount, 'handleBlindCountToggle(this)')}
            ${renderSettingToggle('set_offline_mode', 'کش آفلاین (Offline Mode)', 'ذخیره داده‌ها در حافظه تبلت هنگام قطعی شبکه سایت و سینک خودکار پس از اتصال مجدد.', true)}
            ${renderSettingToggle('set_gps_tag', 'ثبت اجباری لوکیشن (GPS Tagging)', 'ثبت اتوماتیک مختصات جغرافیایی انباردار در لحظه ثبت رکورد جهت کنترل حضور در محل.', false)}
            ${renderSettingToggle('set_img_compress', 'فشرده‌سازی خودکار تصاویر الصاقی', 'کاهش سایز و رزولوشن عکس‌های گرفته شده از کالاها پیش از آپلود، جهت صرفه‌جویی در پهنای باند.', true)}
            
            <div class="flex items-start gap-3 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 opacity-90">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2" class="mt-0.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <div>
                <h5 class="text-[11px] font-black text-indigo-900">پیش‌نیاز اجباری چاپ لیبل (Hard Rule)</h5>
                <p class="text-[10px] text-indigo-700/80 mt-1.5 leading-relaxed">بر اساس سیاست‌های معماری سیستم، ارجاع هیچ رکوردی به کارتابل شمارشگر میدانی پیش از <b>چاپ موفقیت‌آمیز لیبل QR</b> امکان‌پذیر نمی‌باشد. این سیاست قفل شده است.</p>
              </div>
            </div>
          </div>
        </div>

        <div class="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="bg-slate-50 border-b border-slate-100 p-4">
            <h4 class="font-black text-slate-800 text-sm flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
              یکپارچگی داده‌ها و تغذیه MT26/49
            </h4>
          </div>
          <div class="p-5 space-y-5">
            <div>
              <label class="block text-[11px] font-bold text-slate-700 mb-2">رفتار پیش‌فرض در برابر تداخل رکوردهای اکسل پایه</label>
              <select class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 outline-none focus:border-indigo-400 appearance-none cursor-pointer">
                <option value="ignore" selected>نادیده گرفتن رکوردهای تکراری (حفظ داده فعلی)</option>
                <option value="replace">جایگزینی اجباری (Over-write)</option>
                <option value="log">توقف فرآیند و ثبت در لاگ Audit</option>
              </select>
            </div>
            
            <div class="border-t border-slate-100 pt-5">
              <label class="block text-[11px] font-bold text-slate-700 mb-2">فرمت خروجی پیش‌فرض سامانه‌های مرکزی</label>
              <div class="grid grid-cols-2 gap-3">
                <label class="flex items-center gap-2 p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-indigo-300 transition-colors">
                  <input type="radio" name="mt_format" value="excel" checked class="text-indigo-600 focus:ring-indigo-500">
                  <span class="text-xs font-bold text-slate-600">Excel (XLSX) استاندارد</span>
                </label>
                <label class="flex items-center gap-2 p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-indigo-300 transition-colors">
                  <input type="radio" name="mt_format" value="csv" class="text-indigo-600 focus:ring-indigo-500">
                  <span class="text-xs font-bold text-slate-600">CSV (برای سیستم‌های Legacy)</span>
                </label>
              </div>
            </div>
          </div>
        </div>

      </div>

      <div class="space-y-6">

        <div class="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="bg-slate-50 border-b border-slate-100 p-4">
            <h4 class="font-black text-slate-800 text-sm flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
              محتوای پیش‌فرض برچسب‌های حرارتی
            </h4>
            <p class="text-[10px] text-slate-500 mt-1.5 leading-relaxed">فیلدهایی که در سیستم به عنوان پایه روی ساختار لیبل‌ها و بارکدها نقش می‌بندند. (برای شخصی‌سازی ابعاد به طراح لیبل مراجعه کنید)</p>
          </div>
          
          <div class="p-5">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              ${renderSettingCheckbox('set_lbl_key', 'کد سیستم (ID)', lbl.printKey)}
              ${renderSettingCheckbox('set_lbl_mesc', 'کد استاندارد کالا (MESC)', lbl.printMesc)}
              ${renderSettingCheckbox('set_lbl_loc', 'موقعیت فیزیکی (LOC)', lbl.printLoc)}
              ${renderSettingCheckbox('set_lbl_desc', 'شرح کالا (DESC)', lbl.printDesc)}
              ${renderSettingCheckbox('set_lbl_cond', 'وضعیت فیزیکی (COND)', lbl.printCond)}
              ${renderSettingCheckbox('set_lbl_proj', 'نام کارگاه / انبار', lbl.printProject)}
              ${renderSettingCheckbox('set_lbl_tag', 'تگ رهگیری گروهی', lbl.printTag)}
              ${renderSettingCheckbox('set_lbl_qr', 'بارکد دو بعدی (QR)', lbl.printQr)}
            </div>

            <div id="qty_label_container" class="p-4 rounded-xl transition-all duration-300 ${tempSettingsState.blindCount ? 'bg-rose-50 border border-rose-200' : 'bg-slate-50 border border-slate-200'}">
              <label class="flex items-start gap-3 cursor-pointer group">
                <input type="checkbox" id="set_lbl_qty" class="mt-0.5 rounded text-indigo-600 focus:ring-0 transition-all ${tempSettingsState.blindCount ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}" 
                       ${tempSettingsState.printQtyOnLabel && !tempSettingsState.blindCount ? 'checked' : ''} 
                       ${tempSettingsState.blindCount ? 'disabled' : ''}>
                <div>
                  <span class="text-[11px] font-black ${tempSettingsState.blindCount ? 'text-rose-900' : 'text-slate-700'}">چاپ تعداد دفتری (QTY) روی لیبل فیزیکی</span>
                  <p id="qty_label_warning" class="text-[9px] mt-1.5 leading-relaxed font-bold ${tempSettingsState.blindCount ? 'text-rose-600' : 'text-slate-400'}">
                    ${tempSettingsState.blindCount 
                      ? '⚠️ به دلیل فعال بودن حالت «شمارش کور» در تنظیمات عملیاتی، چاپ تعداد سیستم روی لیبل‌ها قفل شده است.' 
                      : 'فعال. تعداد سیستم روی لیبل چاپ خواهد شد (مناسب برای انبارداری عادی و مغایر با انبارگردانی).'}
                  </p>
                </div>
              </label>
            </div>

          </div>
        </div>

        <div class="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="bg-slate-50 border-b border-slate-100 p-4">
            <h4 class="font-black text-slate-800 text-sm flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              امنیت و رهگیری تغییرات (Audit)
            </h4>
          </div>
          <div class="p-5 space-y-4">
            ${renderSettingToggle('set_2step_auth', 'نیاز به تایید دو مرحله‌ای رکوردها', 'هیچ رکوردی بدون تایید سلسله‌مراتبی سرپرست مستقیماً وارد جداول اصلی دیتابیس نشود.', true)}
            
            <div class="border-t border-slate-100 pt-4 mt-2">
              <label class="block text-[11px] font-bold text-slate-700 mb-2">مدت زمان نگهداری لاگ‌های سیستمی (Retention Policy)</label>
              <select class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 outline-none focus:border-indigo-400 appearance-none cursor-pointer">
                <option value="30">۳۰ روز (پاکسازی خودکار ماهانه)</option>
                <option value="90" selected>۹۰ روز (استاندارد بازرسی)</option>
                <option value="180">۶ ماه</option>
                <option value="forever">بایگانی دائم (نیازمند فضای سرور بالا)</option>
              </select>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>`;
}

// ------ Helper Functions & Logic Handlers ------

function renderLogicToggle(id, title, desc, isChecked, onChangeEvent) {
  return `
    <div class="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-200 hover:border-indigo-200 transition-colors shadow-sm">
      <div class="pl-4">
        <h5 class="text-xs font-black text-slate-800">${title}</h5>
        <p class="text-[9px] text-slate-500 mt-1.5 leading-relaxed font-medium">${desc}</p>
      </div>
      <label class="toggle-switch shrink-0 mr-auto">
        <input type="checkbox" id="${id}" ${isChecked ? 'checked' : ''} onchange="${onChangeEvent}">
        <span class="toggle-slider"></span>
      </label>
    </div>
  `;
}

function renderSettingToggle(id, title, desc, isChecked) {
  return renderLogicToggle(id, title, desc, isChecked, "showToast('info', 'تغییرات به صورت موقت ثبت شد. برای اعمال، ذخیره نهایی را بزنید.')");
}

function renderSettingCheckbox(id, label, isChecked) {
  return `
    <label class="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-all group">
      <span class="text-[11px] font-bold text-slate-700 group-hover:text-indigo-700 transition-colors">${label}</span>
      <input type="checkbox" id="${id}" ${isChecked ? 'checked' : ''} class="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-slate-300 cursor-pointer">
    </label>
  `;
}

// Interlocking Logic Function (قفل کردن فیلد تعداد در صورت روشن بودن شمارش کور)
window.handleBlindCountToggle = function(el) {
  const isBlind = el.checked;
  tempSettingsState.blindCount = isBlind;
  
  const qtyCheckbox = document.getElementById('set_lbl_qty');
  const qtyContainer = document.getElementById('qty_label_container');
  const qtyWarning = document.getElementById('qty_label_warning');
  const qtyTitle = qtyContainer.querySelector('span');

  if (isBlind) {
    // اجبار به خاموش شدن و قفل شدن
    qtyCheckbox.checked = false;
    qtyCheckbox.disabled = true;
    qtyCheckbox.classList.add('opacity-50', 'cursor-not-allowed');
    qtyCheckbox.classList.remove('cursor-pointer');
    
    qtyContainer.classList.replace('bg-slate-50', 'bg-rose-50');
    qtyContainer.classList.replace('border-slate-200', 'border-rose-200');
    
    qtyTitle.classList.replace('text-slate-700', 'text-rose-900');
    qtyWarning.classList.replace('text-slate-400', 'text-rose-600');
    qtyWarning.innerHTML = '⚠️ به دلیل فعال بودن حالت «شمارش کور» در تنظیمات عملیاتی، چاپ تعداد سیستم روی لیبل‌ها قفل شده است.';
    
    showToast('warning', 'حالت شمارش کور فعال شد. چاپ تعداد دفتری روی لیبل مسدود گردید.');
  } else {
    // آزادسازی فیلد
    qtyCheckbox.disabled = false;
    qtyCheckbox.classList.remove('opacity-50', 'cursor-not-allowed');
    qtyCheckbox.classList.add('cursor-pointer');
    
    qtyContainer.classList.replace('bg-rose-50', 'bg-slate-50');
    qtyContainer.classList.replace('border-rose-200', 'border-slate-200');
    
    qtyTitle.classList.replace('text-rose-900', 'text-slate-700');
    qtyWarning.classList.replace('text-rose-600', 'text-slate-400');
    qtyWarning.innerHTML = 'فعال. تعداد سیستم روی لیبل چاپ خواهد شد (مناسب برای انبارداری عادی و مغایر با انبارگردانی).';
    
    showToast('info', 'شمارش کور غیرفعال شد. اکنون می‌توانید چاپ تعداد روی لیبل را فعال کنید.');
  }
}

window.saveGlobalSettings = function() {
  // ذخیره مقادیر در appState (در پروژه واقعی اینجا API Call انجام می‌شود)
  if (appState.labelSettings) {
    appState.labelSettings.printKey = document.getElementById('set_lbl_key').checked;
    appState.labelSettings.printMesc = document.getElementById('set_lbl_mesc').checked;
    appState.labelSettings.printLoc = document.getElementById('set_lbl_loc').checked;
    appState.labelSettings.printDesc = document.getElementById('set_lbl_desc').checked;
    appState.labelSettings.printCond = document.getElementById('set_lbl_cond').checked;
    appState.labelSettings.printProject = document.getElementById('set_lbl_proj').checked;
    appState.labelSettings.printTag = document.getElementById('set_lbl_tag').checked;
    appState.labelSettings.printQr = document.getElementById('set_lbl_qr').checked;
    
    // ذخیره QTY فقط در صورتی که شمارش کور خاموش باشد
    appState.labelSettings.printQty = tempSettingsState.blindCount ? false : document.getElementById('set_lbl_qty').checked;
  }
  
  showModal(
    'تنظیمات با موفقیت اعمال شد',
    'پیکربندی کلان سیستم، قوانین تداخل داده‌ها و پیش‌فرض‌های لیبل در پایگاه داده مرکزی ذخیره و در سراسر شبکه یکپارچه اعمال گردید.',
    'success'
  );
}