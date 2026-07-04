// توابع خالی (Placeholder) برای سایر بخش‌ها
function getTasks() { return `<div class="p-8 text-center text-slate-500 font-bold">بخش وظایف و پیش‌نویس‌ها در دست توسعه است...</div>`; }
function getLabels() { return `<div class="p-8 text-center text-slate-500 font-bold">بخش لیبل‌زن هوشمند در دست توسعه است...</div>`; }
//function getFeeding() { return `<div class="p-8 text-center text-slate-500 font-bold">ماژول تغذیه سامانه در دست توسعه است...</div>`; }
// =========================================================================
// ====== VIEW: SETTINGS (تنظیمات سامانه و پیکربندی لیبل‌ها) ======
// =========================================================================

// function getSettings() {
//   // خواندن مقادیر پیش‌فرض از appState (در صورت وجود)
//   const lbl = appState.labelSettings || { printMesc: true, printKey: true, printDesc: true, printLoc: true, printQty: true, printCond: true, printTag: true, printProject: true, printQr: true };

//   return `
//   <div class="max-w-5xl mx-auto space-y-6 fade-in text-right">
    
//     <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
//       <div>
//         <h3 class="font-black text-slate-800 text-sm">پیکربندی و تنظیمات سامانه</h3>
//         <p class="text-[11px] text-slate-500 mt-1">مدیریت رفتار سیستم در زمان شمارش، دسترسی‌ها و قالب چاپ کالا</p>
//       </div>
//       <button onclick="showToast('success', 'تمام تنظیمات سیستم با موفقیت در دیتابیس ذخیره شدند.')" class="px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-md active:scale-95 transition-all flex items-center justify-center gap-2" style="background:linear-gradient(135deg,#4f46e5,#7c3aed)">
//         <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
//         ذخیره تنظیمات
//       </button>
//     </div>

//     <div class="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
//       <div class="bg-slate-50 border-b border-slate-100 p-5">
//         <h4 class="font-black text-slate-800 text-sm flex items-center gap-2">
//           <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
//           تنظیمات کلی و عملیاتی سامانه
//         </h4>
//       </div>
//       <div class="p-6 space-y-4">
        
//         ${renderSettingToggle('ورود داده آفلاین (Offline Mode)', 'کش کردن داده‌ها در حافظه مرورگر/تبلت در صورت قطعی شبکه اینترنت انبار، و سینک شدن خودکار پس از اتصال مجدد.', true)}
//         ${renderSettingToggle('انبارگردانی کور (Blind Count)', 'مخفی کردن موجودی سیستمی (دفتری) از دید انباردار میدانی در زمان اسکن کالا جهت جلوگیری از تقلب و شمارش حدسی.', true)}
//         ${renderSettingToggle('ثبت موقعیت جغرافیایی اجباری (GPS Tagging)', 'ثبت اتوماتیک مختصات جغرافیایی انباردار در لحظه ثبت رکورد جهت کنترل و اثبات حضور وی در محل استقرار کالا.', false)}
//         ${renderSettingToggle('نیاز به تایید دو مرحله‌ای (سوپروایزر)', 'هیچ رکوردی بدون تایید سلسله‌مراتبی سرپرست مستقیماً وارد جداول اصلی دیتابیس مرکزی نشود.', true)}
//         ${renderSettingToggle('فشرده‌سازی خودکار تصاویر الصاقی', 'کاهش سایز و رزولوشن عکس‌های گرفته شده از کالاها پیش از آپلود، جهت صرفه‌جویی چشمگیر در پهنای باند و فضای سرور.', true)}

//       </div>
//     </div>

//     <div class="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
//       <div class="bg-slate-50 border-b border-slate-100 p-5">
//         <h4 class="font-black text-slate-800 text-sm flex items-center gap-2">
//           <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
//           تنظیمات فیلدهای لیبل چاپی کالاها
//         </h4>
//         <p class="text-[11px] text-slate-500 mt-1.5">فیلدهایی که مایلید به صورت متنی یا داخل ساختار QR Code روی برچسب حرارتی کالا نمایش داده شوند را تیک بزنید:</p>
//       </div>
      
//       <div class="p-6">
//         <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
//           ${renderSettingCheckbox('کد سیستم (ID)', lbl.printKey)}
//           ${renderSettingCheckbox('کد استاندارد کالا (MESC)', lbl.printMesc)}
//           ${renderSettingCheckbox('موقعیت فیزیکی (LOC)', lbl.printLoc)}
//           ${renderSettingCheckbox('شرح کالا (DESC)', lbl.printDesc)}
//           ${renderSettingCheckbox('وضعیت فیزیکی کالا (COND)', lbl.printCond)}
//           ${renderSettingCheckbox('تعداد دفتری (QTY)', lbl.printQty)}
//           ${renderSettingCheckbox('نام کارگاه / انبار / پروژه', lbl.printProject)}
//           ${renderSettingCheckbox('تگ رهگیری گروهی', lbl.printTag)}
//           ${renderSettingCheckbox('بارکد دو بعدی (QR Code)', lbl.printQr)}
//           ${renderSettingCheckbox('تاریخ آخرین شمارش میدانی', false)}
//         </div>
//       </div>
//     </div>
//   </div>`;
// }

// ------ توابع کمکی برای ساخت سریع المان‌های تنظیمات (Helper Functions) ------

function renderSettingToggle(title, desc, isChecked) {
  return `
    <div class="flex items-center justify-between p-4 bg-slate-50/70 rounded-2xl border border-slate-100 hover:border-indigo-100 transition-colors">
      <div class="pl-4">
        <h5 class="text-xs font-bold text-slate-800">${title}</h5>
        <p class="text-[10px] text-slate-500 mt-1.5 leading-relaxed">${desc}</p>
      </div>
      <label class="toggle-switch shrink-0 mr-auto">
        <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="showToast('info', 'تغییرات ذخیره شد')">
        <span class="toggle-slider"></span>
      </label>
    </div>
  `;
}

function renderSettingCheckbox(label, isChecked) {
  return `
    <label class="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-all group">
      <span class="text-xs font-bold text-slate-700 group-hover:text-indigo-700 transition-colors">${label}</span>
      <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="showToast('info', 'وضعیت فیلد چاپی بروزرسانی شد')" class="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-slate-300 cursor-pointer">
    </label>
  `;
}
function getField() { return `<div class="p-8 text-center text-slate-500 font-bold">میز کار میدانی انباردار در دست توسعه است...</div>`; }
function initDragDrop() {}