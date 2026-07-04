// ====================================
// ====== VIEW: PROJECTS (WAREHOUSES) ======
// ====================================
function getProjects() {
  return `
  <div class="space-y-5">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h3 class="font-black text-slate-800 text-base">لیست انبارها (پروژه‌ها)</h3>
        <p class="text-xs text-slate-400 mt-0.5">${appState.projects.length} محیط کارگاهی انبارگردانی فعال</p>
      </div>
      
      <div class="flex flex-wrap items-center gap-2.5">
        <div class="relative">
          <div class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </div>
          <input type="text" placeholder="جستجوی انبار یا لوکیشن..." class="w-full sm:w-56 pr-9 pl-4 py-2 rounded-xl text-xs bg-white border border-slate-200 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 transition-all text-slate-700">
        </div>
        
        <select class="px-3 py-2 rounded-xl text-xs bg-white border border-slate-200 focus:outline-none focus:border-indigo-400 text-slate-600 transition-all cursor-pointer appearance-none">
          <option value="all">همه وضعیت‌ها</option>
          <option value="active">جاری</option>
          <option value="frozen">فریز شده</option>
          <option value="setup">تنظیم شده</option>
        </select>

        <button onclick="addProjectModal()" class="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-md hover:shadow-lg active:scale-95" style="background:linear-gradient(135deg,#4f46e5,#7c3aed)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          انبار جدید
        </button>
      </div>
    </div>

    <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div class="flex-1">
          <h4 class="font-bold text-slate-800 text-sm">بارگذاری فایل اکسل کالاهای اولیه</h4>
          <p class="text-xs text-slate-400 mt-1">از طریق بارگذاری الگوی اکسل مشخص شده، رکوردهای پایه انبار انتخابی را تزریق کنید.</p>
        </div>
        <div class="flex items-center gap-3">
          <a href="#" onclick="event.preventDefault(); downloadSampleTemplate()" class="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-200 shadow-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            دانلود قالب نمونه
          </a>
          <button onclick="switchTab('docs')" class="px-4 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-md" style="background:linear-gradient(135deg,#4f46e5,#7c3aed)">
            بارگذاری فایل اکسل
          </button>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      ${appState.projects.map((p, i) => {
        const isDeleted = p.status === 'حذف شده';
        const isFrozen = p.status === 'فریز شده' || p.status === 'منجمد';
        
        return `
        <div class="bg-white rounded-2xl border ${p.id === appState.activeWarehouseId ? 'border-2 ring-2 ring-offset-2' : 'border-slate-200'} ${isDeleted ? 'opacity-60 grayscale-[40%]' : ''} shadow-sm p-5 flex flex-col relative transition-all" style="--tw-ring-color: ${p.color}; border-color: ${p.id === appState.activeWarehouseId ? p.color : ''}">
          
          ${isFrozen ? `
            <div class="absolute inset-0 bg-slate-100/40 rounded-2xl pointer-events-none border-2 border-dashed border-amber-400 z-10 flex items-center justify-center">
              <div class="bg-amber-500 text-white font-bold text-[11px] px-3 py-1 rounded-full shadow-md transform rotate-3">انبار فریز شده - ثبت شمارش جدید متوقف است</div>
            </div>
          ` : ''}

          <div class="flex items-start justify-between gap-3 mb-4">
            <div class="flex items-center gap-3 min-w-0 cursor-pointer" onclick="handleWarehouseSwitch('${p.id}')">
              <div class="w-11 h-11 rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0 shadow-sm" style="background:${isDeleted ? '#cbd5e1' : p.color}">${p.id.slice(-2)}</div>
              <div class="min-w-0">
                <p class="font-black text-slate-800 text-sm leading-tight truncate">${p.name}</p>
                <p class="text-[10px] text-slate-400 mt-1 truncate">${p.location} · مدیر: ${p.manager}</p>
              </div>
            </div>
            <div class="flex flex-col items-end gap-1.5 shrink-0">
              ${statusBadge(p.status)}
              <span class="text-[9px] text-slate-400 font-medium">بروزرسانی: فعال</span>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3 mb-4 text-xs">
            <div class="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <p class="text-slate-400 text-[10px] font-medium">کل اقلام سیستمی</p>
              <p class="font-black text-slate-800 text-base mt-0.5 w-max">${p.records.toLocaleString()}</p>
            </div>
            <div class="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <p class="text-slate-400 text-[10px] font-medium">شمارش شده میدانی</p>
              <p class="font-black mt-0.5 text-base w-max" style="color:${isDeleted ? '#64748b' : p.color}">${p.done.toLocaleString()}</p>
            </div>
          </div>

          ${!isDeleted ? `
          <div class="mb-4">
            <div class="flex justify-between text-[10px] text-slate-400 mb-1.5">
              <span class="font-medium">پیشرفت انبارگردانی فیزیکی</span>
              <span class="font-black" style="color:${p.color}">${p.percent}٪</span>
            </div>
            <div class="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div class="h-full rounded-full" style="width:${p.percent}%;background:${p.color};"></div>
            </div>
          </div>
          ` : `
          <div class="mb-4 p-2 bg-rose-50 rounded-lg text-center border border-rose-100">
            <span class="text-[10px] font-bold text-rose-500">این کارگاه انبارگردانی به طور کامل حذف/بایگانی شده است</span>
          </div>
          `}

          <div class="flex gap-2 pt-3 border-t border-slate-100 mt-auto items-center relative project-action-container">
            ${isDeleted ? `
              <button onclick="restoreWarehouse('${p.id}')" class="flex-1 py-2 text-[11px] font-bold rounded-xl bg-slate-200 text-slate-500 cursor-not-allowed flex items-center justify-center gap-1.5" disabled>
                دسترسی مسدود است
              </button>
            ` : `
              <button onclick="handleWarehouseSwitch('${p.id}'); switchTab('dispatch');" class="flex-1 py-2 text-[11px] font-bold rounded-xl text-white shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5" style="background:linear-gradient(135deg, ${p.color}, #6366f1)">
                ورود و مدیریت رکوردهای کالا
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </button>
            `}
            
            <div class="relative">
              <button onclick="toggleWarehouseActions(event, '${p.id}')" class="p-2 text-slate-500 bg-slate-100 hover:bg-slate-200 hover:text-slate-800 rounded-xl transition-colors shrink-0 flex items-center justify-center z-20 relative" title="عملیات مدیریت کارگاه">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              </button>
              
              ${isDeleted ? `
                <div id="wh-dropdown-${p.id}" class="hidden wh-dropdown-menu absolute bottom-full left-0 mb-2 w-48 bg-white rounded-xl shadow-xl border border-slate-200 z-[99] py-1 text-right">
                  <button onclick="restoreWarehouse('${p.id}')" class="w-full text-right px-4 py-2.5 text-xs text-emerald-600 hover:bg-emerald-50 flex items-center gap-2 font-bold transition-colors">
                    <span>♻️</span> بازیابی و فعال‌سازی مجدد
                  </button>
                </div>
              ` : `
                <div id="wh-dropdown-${p.id}" class="hidden wh-dropdown-menu absolute bottom-full left-0 mb-2 w-48 bg-white rounded-xl shadow-xl border border-slate-200 z-[99] py-1 text-right">
                  <button onclick="openEditWarehouseModal('${p.id}')" class="w-full text-right px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-semibold">
                    <span>✏️</span> ویرایش مشخصات انبار
                  </button>
                  <button onclick="toggleFreezeWarehouse('${p.id}')" class="w-full text-right px-4 py-2 text-xs ${isFrozen ? 'text-emerald-600' : 'text-amber-600'} hover:bg-slate-50 flex items-center gap-2 font-semibold">
                    <span>❄️</span> ${isFrozen ? 'خروج از حالت فریز (فعال)' : 'فریز کردن انبار (توقف شمارش)'}
                  </button>
                  <button onclick="showToast('info','تنظیمات بارکد حرارتی فعال شد')" class="w-full text-right px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-semibold">
                    <span>📦</span> تنظیمات قالب بارکد و لیبل
                  </button>
                  <div class="border-t border-slate-100 my-1"></div>
                  <button onclick="archiveWarehouse('${p.id}')" class="w-full text-right px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-bold">
                    <span>🗑️</span> بایگانی / حذف کارگاه انبار
                  </button>
                </div>
              `}
            </div>

          </div>
        </div>
        `;
      }).join('')}
    </div>
  </div>`;
}

// ------ WAREHOUSE ACTIONS HELPERS ------
function downloadSampleTemplate() {
  const tableSample = `
    <div class="overflow-x-auto mt-2 text-right">
      <table class="w-full text-xs border border-slate-200 text-center">
        <thead>
          <tr class="bg-slate-100 text-slate-700">
            <th class="p-2 border font-bold">A (کد سیستم)</th>
            <th class="p-2 border font-bold">B (MESC)</th>
            <th class="p-2 border font-bold">C (Part No)</th>
            <th class="p-2 border font-bold">D (شرح)</th>
            <th class="p-2 border font-bold">E (دسته‌بندی)</th>
            <th class="p-2 border font-bold">F (موقعیت)</th>
          </tr>
        </thead>
        <tbody>
          <tr><td class="p-2 border font-mono">REC-1001</td><td class="p-2 border font-mono">12.04.558.11</td><td class="p-2 border font-mono">FS-202X</td><td class="p-2 border text-right">شیر برقی ابزار دقیق</td><td class="p-2 border">تجهیزات دقیق</td><td class="p-2 border">سوله A</td></tr>
        </tbody>
      </table>
    </div>
  `;
  showModal('قالب استاندارد آپلود اکسل', `برای عدم تداخل ستون‌ها، لطفا فایل خود را مطابق چیدمان زیر ذخیره و آپلود نمایید:<br>${tableSample}`, 'info');
}

function toggleWarehouseActions(event, whId) {
  event.stopPropagation();
  const menu = document.getElementById(`wh-dropdown-${whId}`);
  const isOpen = !menu.classList.contains('hidden');
  document.querySelectorAll('.wh-dropdown-menu').forEach(m => m.classList.add('hidden'));
  if (!isOpen) menu.classList.remove('hidden');
}

function toggleFreezeWarehouse(whId) {
  const p = appState.projects.find(proj => proj.id === whId);
  if (p) {
    if (p.status === 'فریز شده' || p.status === 'منجمد') {
      p.status = 'جاری';
      showToast('success', `انبار ${p.name} از حالت انجماد خارج شد و آماده شمارش است.`);
    } else {
      p.status = 'فریز شده';
      showToast('warning', `انبار ${p.name} با موفقیت فریز شد. موجودی‌های فیزیکی قفل شدند.`);
    }
    switchTab('projects');
  }
}

function archiveWarehouse(whId) {
  const p = appState.projects.find(proj => proj.id === whId);
  if (p) {
    p.status = 'حذف شده';
    showToast('error', `انبار ${p.name} بایگانی و از چرخه عملیاتی خارج گردید.`);
    switchTab('projects');
  }
}

function restoreWarehouse(whId) {
  const p = appState.projects.find(proj => proj.id === whId);
  if (p) {
    p.status = 'تنظیم شده';
    showToast('success', `انبار ${p.name} با موفقیت بازیابی شد و مجدداً در چرخه قرار گرفت.`);
    switchTab('projects');
  }
}

function openEditWarehouseModal(whId) {
  const p = appState.projects.find(proj => proj.id === whId);
  if (!p) return;

  const formHTML = `
    <form id="edit-warehouse-form" class="mt-4 text-right" onsubmit="event.preventDefault();">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-[11px] font-bold text-slate-600 mb-1.5">کد انبار (Warehouse Code)</label>
          <input type="text" id="edit_wh_code" value="${p.id}" readonly class="w-full px-3 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-500 outline-none">
        </div>
        <div>
          <label class="block text-[11px] font-bold text-slate-600 mb-1.5">نام انبار (Warehouse Name)</label>
          <input type="text" id="edit_wh_name" value="${p.name}" class="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-indigo-400 text-xs text-slate-800 transition-all outline-none">
        </div>
        <div>
          <label class="block text-[11px] font-bold text-slate-600 mb-1.5">لوکیشن پروژه (Location)</label>
          <input type="text" id="edit_wh_loc" value="${p.location}" class="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-indigo-400 text-xs text-slate-800 transition-all outline-none">
        </div>
        <div>
          <label class="block text-[11px] font-bold text-slate-600 mb-1.5">مسئول انبار / انباردار (Manager/Keeper)</label>
          <input type="text" id="edit_wh_manager" value="${p.manager}" class="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-indigo-400 text-xs text-slate-800 transition-all outline-none">
        </div>
      </div>
    </form>
  `;

  showModal(
    `ویرایش مشخصات انبار: ${p.name}`, 
    formHTML, 
    'info',
    `<button onclick="saveWarehouseEdit('${p.id}')" class="px-5 py-2 rounded-xl text-xs font-bold text-white shadow-md transition-all" style="background:linear-gradient(135deg,#4f46e5,#7c3aed)">ذخیره تغییرات</button>
     <button onclick="closeModal()" class="px-5 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl">انصراف</button>`,
    'max-w-xl'
  );
}

function saveWarehouseEdit(whId) {
  const p = appState.projects.find(proj => proj.id === whId);
  if (p) {
    p.name = document.getElementById('edit_wh_name').value;
    p.location = document.getElementById('edit_wh_loc').value;
    p.manager = document.getElementById('edit_wh_manager').value;
    showToast('success', 'تغییرات با موفقیت ذخیره شد.');
    closeModal();
    switchTab('projects');
  }
}

// ------ COMPLETE ADD WAREHOUSE MODAL ------
function addProjectModal() {
  const formHTML = `
    <form id="new-warehouse-form" class="mt-4 text-right" onsubmit="event.preventDefault();">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-[11px] font-bold text-slate-600 mb-1.5">کد انبار (Warehouse Code)</label>
          <input type="text" id="wh_code" placeholder="مثال: WH-05" class="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-indigo-400 text-xs text-slate-800 transition-all outline-none focus:ring-1 focus:ring-indigo-400/20 placeholder-slate-400">
        </div>
        <div>
          <label class="block text-[11px] font-bold text-slate-600 mb-1.5">نام انبار (Warehouse Name)</label>
          <input type="text" id="wh_name" placeholder="مثال: انبار قطعات یدکی زاگرس" class="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-indigo-400 text-xs text-slate-800 transition-all outline-none focus:ring-1 focus:ring-indigo-400/20 placeholder-slate-400">
        </div>
        <div>
          <label class="block text-[11px] font-bold text-slate-600 mb-1.5">نوع انبار (Warehouse Type)</label>
          <select id="wh_type" class="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-indigo-400 text-xs text-slate-800 transition-all outline-none appearance-none cursor-pointer">
            <option value="raw_materials">مواد اولیه و خام</option>
            <option value="spare_parts">قطعات یدکی ماشین‌آلات</option>
            <option value="finished_goods">محصولات نهایی</option>
            <option value="scrap">ضایعات و اقلام اسقاطی</option>
          </select>
        </div>
        <div>
          <label class="block text-[11px] font-bold text-slate-600 mb-1.5">ظرفیت انبار (Capacity)</label>
          <input type="text" id="wh_capacity" placeholder="ظرفیت کل-مساحت" class="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-indigo-400 text-xs text-slate-800 transition-all outline-none focus:ring-1 focus:ring-indigo-400/20 placeholder-slate-400">
        </div>
        <div>
          <label class="block text-[11px] font-bold text-slate-600 mb-1.5">مسئول انبار / انباردار (Manager/Keeper)</label>
          <select id="wh_manager" class="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-indigo-400 text-xs text-slate-800 transition-all outline-none appearance-none cursor-pointer">
            ${appState.users.map(u => `<option value="${u.name}">${u.name} - ${u.role}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-[11px] font-bold text-slate-600 mb-1.5">انبار والد (Parent Warehouse)</label>
          <select id="wh_parent" class="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-indigo-400 text-xs text-slate-800 transition-all outline-none appearance-none cursor-pointer">
            <option value="none">-- مستقل (بدون والد) --</option>
            ${appState.projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-[11px] font-bold text-slate-600 mb-1.5">شرکت متصدی / پیمانکار انبار (Warehouse Operator)</label>
          <select id="wh_company" class="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-indigo-400 text-xs text-slate-800 transition-all outline-none appearance-none cursor-pointer">
            <option value="nioc">شرکت ملی نفت ایران (NIOC)</option>
            <option value="nigc">شرکت ملی گاز ایران (NIGC)</option>
            <option value="pogc">شرکت نفت و گاز پارس (POGC)</option>
            <option value="other">سایر پیمانکاران...</option>
          </select>
        </div>
        <div>
          <label class="block text-[11px] font-bold text-slate-600 mb-1.5">شماره تلفن (Phone Number)</label>
          <input type="tel" id="wh_phone" placeholder="077-3123456" class="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-indigo-400 text-xs text-slate-800 transition-all outline-none focus:ring-1 focus:ring-indigo-400/20 text-left placeholder-slate-400" dir="ltr">
        </div>
        <div>
          <label class="block text-[11px] font-bold text-slate-600 mb-1.5">مختصات جغرافیایی (GPS Coordinates)</label>
          <div class="flex gap-2">
            <input type="text" id="wh_gps_lat" placeholder="Lat: 27.56" class="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-indigo-400 text-xs text-slate-800 transition-all outline-none focus:ring-1 focus:ring-indigo-400/20 text-center placeholder-slate-400" dir="ltr">
            <input type="text" id="wh_gps_lng" placeholder="Lng: 52.60" class="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-indigo-400 text-xs text-slate-800 transition-all outline-none focus:ring-1 focus:ring-indigo-400/20 text-center placeholder-slate-400" dir="ltr">
          </div>
        </div>
        <div>
          <label class="block text-[11px] font-bold text-slate-600 mb-1.5">تاریخ ایجاد (Creation Date)</label>
          <input type="date" id="wh_date" class="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-indigo-400 text-xs text-slate-800 transition-all outline-none focus:ring-1 focus:ring-indigo-400/20 text-left font-sans" dir="ltr">
        </div>
        <div>
          <label class="block text-[11px] font-bold text-slate-500 mb-1.5">تعداد کل کالاها (سیستمیک)</label>
          <input type="text" id="wh_total_qty" value="محاسبه خودکار از اکسل" readonly class="w-full px-3 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-400 outline-none cursor-not-allowed">
        </div>
        <div>
          <label class="block text-[11px] font-bold text-slate-500 mb-1.5">تعداد کالاهای شمارش شده (میدانی)</label>
          <input type="text" id="wh_counted_qty" value="0" readonly class="w-full px-3 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-400 outline-none cursor-not-allowed">
        </div>
        <div class="col-span-1 md:col-span-2 flex items-center justify-between p-3.5 bg-indigo-50/50 rounded-xl border border-indigo-100/70">
          <div>
            <p class="text-[11px] font-bold text-slate-700">وضعیت فعالیت انبار (Status)</p>
            <p class="text-[9px] text-slate-500 mt-0.5">در صورت غیرفعال بودن (Inactive)، این انبار در لیست‌ها و گزارشات روزانه نمایش داده نمی‌شود.</p>
          </div>
          <label class="toggle-switch shrink-0">
            <input type="checkbox" id="wh_status" checked>
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div class="col-span-1 md:col-span-2">
          <label class="block text-[11px] font-bold text-slate-600 mb-1.5">آدرس فیزیکی (Address)</label>
          <input type="text" id="wh_address" placeholder="مثال: عسلویه، سایت ۲، منطقه ویژه پارس جنوبی، خیابان پالایشگاه..." class="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-indigo-400 text-xs text-slate-800 transition-all outline-none placeholder-slate-400">
        </div>
        <div class="col-span-1 md:col-span-2">
          <label class="block text-[11px] font-bold text-slate-600 mb-1.5">توضیحات تکمیلی (Description)</label>
          <textarea id="wh_desc" rows="2" placeholder="اطلاعات تکمیلی در مورد شرایط نگهداری، مسیرهای دسترسی و غیره..." class="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-indigo-400 text-xs text-slate-800 transition-all outline-none resize-none placeholder-slate-400"></textarea>
        </div>
      </div>
    </form>
  `;

  showModal(
    'تعریف انبار / پروژه جدید', 
    formHTML, 
    'info',
    `<button onclick="saveNewWarehouse()" class="px-5 py-2 rounded-xl text-xs font-bold text-white shadow-md transition-all active:scale-95" style="background:linear-gradient(135deg,#4f46e5,#7c3aed)">ثبت نهایی انبار</button>
     <button onclick="closeModal()" class="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors">انصراف</button>`,
    'max-w-2xl'
  );
}

function saveNewWarehouse() {
  const code = document.getElementById('wh_code').value.trim();
  const name = document.getElementById('wh_name').value.trim();
  const manager = document.getElementById('wh_manager').value;
  const loc = document.getElementById('wh_address').value.trim();

  if(!code || !name) {
    showToast('error', 'لطفا کد و نام انبار را حتما وارد کنید.');
    return;
  }

  appState.projects.push({
    id: code,
    name: name,
    manager: manager,
    location: loc ? loc.substring(0,15) + '...' : 'عسلویه',
    records: 0,
    done: 0,
    status: 'تنظیم شده',
    percent: 0,
    color: '#6366f1'
  });

  showToast('success', `انبار کارگاهی ${name} با موفقیت در سیستم ثبت گردید.`);
  closeModal();
  switchTab('projects');
}

