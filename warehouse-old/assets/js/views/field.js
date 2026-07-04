// ==========================================
// فایل کامل و اصلاح شده: assets/js/views/field.js
// ==========================================

function getFieldDashboard() {
  return `
    <div class="max-w-md mx-auto bg-slate-50 min-h-[85vh] rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
        <div class="bg-gradient-to-r from-indigo-600 to-violet-600 text-white p-6 rounded-b-3xl shadow-lg">
            <h2 class="text-lg font-black text-center">اسکنر و شمارش میدانی</h2>
            <p class="text-xs text-center opacity-80 mt-1">اپراتور: ${appState.currentUser?.name || 'کاربر'} | انبار فعال</p>
        </div>

        <div class="px-5 mt-6" id="scanner-section">
            <div class="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 text-center relative">
                <div onclick="simulateQRScan()" class="w-24 h-24 mx-auto bg-indigo-50 rounded-full flex items-center justify-center border-2 border-dashed border-indigo-400 mb-4 cursor-pointer hover:bg-indigo-100 transition-colors animate-pulse">
                    <span class="material-icons-round text-5xl text-indigo-500">qr_code_scanner</span>
                </div>
                <h3 class="text-sm font-bold text-slate-700">برای اسکن بارکد کلیک کنید</h3>
                <p class="text-[10px] text-slate-400 mt-2">دوربین تبلت یا دستگاه بارکدخوان</p>
                
                <div class="mt-5 flex items-center gap-2">
                  <input type="text" id="manual_barcode" placeholder="یا کلید رکورد را وارد کنید..." class="flex-1 text-center px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:border-indigo-500 outline-none">
                  <button onclick="simulateQRScan(document.getElementById('manual_barcode').value)" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-xl shadow-md transition-colors">
                     <span class="material-icons-round text-[18px]">search</span>
                  </button>
                </div>
            </div>
        </div>

        <div class="px-5 mt-4 pb-10 hidden" id="count-form-section">
           </div>
    </div>
  `;
}

// شبیه‌ساز اسکن و نمایش فرم
function simulateQRScan(tagId = 'TAG-123') {
  if(!tagId) return showToast('error', 'لطفا کد را وارد کنید');
  
  showToast('info', 'در حال واکشی اطلاعات کالا از سرور...');
  
  setTimeout(() => {
    document.getElementById('scanner-section').classList.add('hidden');
    const formSection = document.getElementById('count-form-section');
    formSection.classList.remove('hidden');
    
    // 🔴 بررسی سطح دسترسی کاربر برای دیدن موجودی سیستمی (اگر تیک را در ماتریس خورده باشد)
    const canViewSysQty = typeof hasPerm === 'function' ? hasPerm('can_view_sys_qty') : false;
    
    const record = { partNo: 'VAL-099-B', desc: 'شیر فلکه کشویی 4 اینچ فولادی', location: 'Rack A-12', sysQty: 100 };

    formSection.innerHTML = `
      <div class="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
        <div class="flex justify-between items-start mb-4 border-b border-slate-100 pb-4">
          <div>
            <span class="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-bold">شناسه: ${tagId}</span>
            <h4 class="text-sm font-black text-slate-800 mt-2">${record.desc}</h4>
            <p class="text-[11px] text-slate-500 mt-1 flex items-center gap-1"><span class="material-icons-round text-[14px]">place</span> لوکیشن سیستم: ${record.location}</p>
          </div>
        </div>

        ${canViewSysQty ? `
          <div class="mb-4 bg-orange-50 border border-orange-200 text-orange-800 p-3 rounded-xl flex justify-between items-center">
            <span class="text-xs font-bold">موجودی سیستمی (صرفاً جهت اطلاع):</span>
            <span class="text-lg font-black">${record.sysQty} <span class="text-[10px]">عدد</span></span>
          </div>
        ` : `
          <div class="mb-4 bg-slate-50 border border-slate-200 text-slate-500 p-3 rounded-xl text-center">
            <span class="text-[10px] font-bold"><span class="material-icons-round text-[12px] align-middle">visibility_off</span> شمارش کور (Blind Count) فعال است</span>
          </div>
        `}

        <div class="space-y-4">
          <div>
            <label class="block text-[11px] font-bold text-slate-700 mb-1">تعداد دقیق شمارش شده (عدد)</label>
            <input type="number" id="counted_qty" class="w-full text-center px-4 py-3 bg-indigo-50 border-2 border-indigo-200 rounded-xl text-xl font-black text-indigo-700 focus:border-indigo-500 outline-none" placeholder="0">
          </div>
          
          <div>
            <label class="block text-[11px] font-bold text-slate-700 mb-1">وضعیت فیزیکی کالا</label>
            <select class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:border-indigo-400 outline-none">
              <option value="ok">سالم و استاندارد</option>
              <option value="damaged">آسیب دیده / زنگ زده</option>
              <option value="wrong_loc">مغایرت لوکیشن (جابجا شده)</option>
            </select>
          </div>

          <div class="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center cursor-pointer hover:bg-slate-50 transition-colors">
            <span class="material-icons-round text-3xl text-slate-400">add_a_photo</span>
            <p class="text-[10px] text-slate-500 mt-1 font-bold">آپلود عکس از کالا (الزامی)</p>
          </div>

          <div class="flex gap-2 pt-2">
            <button onclick="submitCount()" class="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-xs py-3.5 rounded-xl shadow-lg active:scale-95 transition-all">ثبت نهایی شمارش</button>
            <button onclick="resetScanner()" class="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-4 py-3.5 rounded-xl transition-all">لغو</button>
          </div>
        </div>
      </div>
    `;
  }, 800);
}

function resetScanner() {
  document.getElementById('count-form-section').classList.add('hidden');
  document.getElementById('scanner-section').classList.remove('hidden');
  document.getElementById('manual_barcode').value = '';
}

function submitCount() {
  const val = document.getElementById('counted_qty').value;
  if(!val || val <= 0) return showToast('error', 'لطفاً تعداد شمارش شده را به درستی وارد کنید.');
  showToast('success', 'اطلاعات شمارش با موفقیت در سیستم ثبت شد.');
  resetScanner();
}