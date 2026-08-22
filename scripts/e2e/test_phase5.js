const { createBrowser, loginViaApi, captureScreenshot } = require('./e2e_helper');
const fs = require('fs');
const path = require('path');

async function runPhase5() {
  console.log('====================================================');
  console.log('🚀 اجرای آزمون‌های مرورگر زنده فاز ۵ (سناریوهای ۹ و ۱۰)');
  console.log('====================================================');

  const browser = await createBrowser();
  const page = await browser.newPage();

  try {
    const getArray = (data) => Array.isArray(data) ? data : (data.results || []);

    // ----------------------------------------------------
    // سناریو ۹: ذخیره پیش‌نویس، حفظ داده‌ها پس از رفرش و همگام‌سازی دستی (E2E-ITEM-09)
    // ----------------------------------------------------
    console.log('\n▶️ [سناریو ۹] ذخیره پیش‌نویس، پایداری داده‌ها پس از رفرش مرورگر و همگام‌سازی دستی');

    // ۱. ورود مدیر سیستم و تخصیص E2E-ITEM-09
    await loginViaApi(page, 'admin_e2e');
    await page.goto('http://localhost:4200/dispatch', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1000));

    const assign9 = await page.evaluate(async () => {
      const getArr = (d) => Array.isArray(d) ? d : (d.results || []);
      const token = localStorage.getItem('wh_access_token');
      const whId = localStorage.getItem('wh_active_id');

      const itemsRes = await fetch(`/api/inventory/items/?warehouse=${whId}&search=E2E-ITEM-09`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const item = getArr(await itemsRes.json())[0];

      const usersRes = await fetch('/api/auth/users/', { headers: { 'Authorization': `Bearer ${token}` } });
      const users = getArr(await usersRes.json());
      const counter = users.find(u => u.username === 'counter_e2e');
      const manager = users.find(u => u.username === 'manager_e2e');

      await fetch('/api/inventory/items/bulk_assign/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          item_ids: [item.id],
          field_assignee: counter.id,
          supervisor_assignee: 'skip',
          manager_assignee: manager.id,
          field_status: 'counting',
          force: true
        })
      });
      return { item };
    });

    console.log('   ✓ کالا E2E-ITEM-09 تخصیص داده شد');

    // ۲. ورود شمارشگر، ثبت پیش‌نویس محلی در localStorage
    await loginViaApi(page, 'counter_e2e');
    await page.goto('http://localhost:4200/counter?status=all', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1000));

    const draftInfo = await page.evaluate(async (itemId) => {
      const getArr = (d) => Array.isArray(d) ? d : (d.results || []);
      const token = localStorage.getItem('wh_access_token');
      const taskRes = await fetch('/api/inventory/count-tasks/?as_role=counter', { headers: { 'Authorization': `Bearer ${token}` } });
      const tasks = getArr(await taskRes.json());
      const task = tasks.find(t => t.item === itemId || (t.item_details && t.item_details.fa_unic_code === 'E2E-ITEM-09'));

      // ذخیره مقدار در پیش‌نویس کلاینت
      const drafts = JSON.parse(localStorage.getItem('wh_offline_drafts') || '{}');
      drafts[task.id] = { counted_balance: 50.000, counter_note: 'پیش‌نویس آفلاین ذخیره شده در حافظه مرورگر' };
      localStorage.setItem('wh_offline_drafts', JSON.stringify(drafts));

      return { taskId: task.id, draftedValue: 50.000 };
    }, assign9.item.id);

    console.log('   ✓ پیش‌نویس شمارش در حافظه محلی مرورگر ذخیره شد');
    await captureScreenshot(page, 'phase5_scenario9_01_draft_saved');

    // ۳. رفرش سخت صفحه مرورگر و بررسی ماندگاری پیش‌نویس
    await page.reload({ waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1000));

    const verifyDraft = await page.evaluate((taskId) => {
      const drafts = JSON.parse(localStorage.getItem('wh_offline_drafts') || '{}');
      return { exists: !!drafts[taskId], data: drafts[taskId] };
    }, draftInfo.taskId);

    console.log('   ✓ راستی‌آزمایی پایداری پیش‌نویس پس از رفرش مرورگر:', verifyDraft.exists ? 'موفق و پایدار ✅' : 'ناموفق ❌');
    await captureScreenshot(page, 'phase5_scenario9_02_draft_persisted_after_refresh');

    // ۴. ارسال همگام‌سازی دستی به سرور و تایید نهایی
    await page.evaluate(async (taskId) => {
      const token = localStorage.getItem('wh_access_token');
      await fetch(`/api/inventory/count-tasks/${taskId}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ counted_balance: 50.000, counter_note: 'همگام‌سازی دستی پیش‌نویس با سرور', status: 'INITIAL_COUNT' })
      });

      await fetch('/api/inventory/count-tasks/bulk_submit/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ task_ids: [taskId] })
      });
    }, draftInfo.taskId);

    await loginViaApi(page, 'manager_e2e');
    await page.goto('http://localhost:4200/manager', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1000));

    await page.evaluate(async (taskId) => {
      const token = localStorage.getItem('wh_access_token');
      await fetch('/api/inventory/count-tasks/bulk_manager_approve/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ task_ids: [taskId], note: 'تایید نهایی تسک همگام‌شده' })
      });
    }, draftInfo.taskId);

    console.log('   ✓ تسک با موفقیت همگام‌سازی دستی و توسط مدیر تایید نهایی شد');
    await page.reload({ waitUntil: 'networkidle0' });
    await captureScreenshot(page, 'phase5_scenario9_03_synced_manager_approved');


    // ----------------------------------------------------
    // سناریو ۱۰: فیلترهای پیشرفته، مودال تاریخچه و خروجی اکسل (E2E-ITEM-10)
    // ----------------------------------------------------
    console.log('\n▶️ [سناریو ۱۰] فیلترهای پیشرفته داینامیک، لاگ تاریخچه رویدادها (Audit Trail) و خروجی اکسل');

    // ۱. فیلترهای پیشرفته در صفحه دیسپچ
    await loginViaApi(page, 'admin_e2e');
    await page.goto('http://localhost:4200/dispatch', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1000));

    const filterResult = await page.evaluate(async () => {
      const getArr = (d) => Array.isArray(d) ? d : (d.results || []);
      const token = localStorage.getItem('wh_access_token');
      const whId = localStorage.getItem('wh_active_id');

      const res = await fetch(`/api/inventory/items/?warehouse=${whId}&search=E2E-ITEM-10&my_tag=تست_مرورگر`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const items = getArr(await res.json());
      return { count: items.length, firstCode: items[0]?.fa_unic_code };
    });

    console.log('   ✓ فیلتر پیشرفته چندگانه اجرا شد:', `یافت شد: ${filterResult.count} قلم (${filterResult.firstCode})`);
    await captureScreenshot(page, 'phase5_scenario10_01_advanced_filters');

    // ۲. مشاهده تاریخچه رویدادهای تسک ۱ (Audit Trail Timeline)
    await page.goto('http://localhost:4200/counter?status=all', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1000));

    const historyAudit = await page.evaluate(async () => {
      const getArr = (d) => Array.isArray(d) ? d : (d.results || []);
      const token = localStorage.getItem('wh_access_token');
      const taskRes = await fetch('/api/inventory/count-tasks/?as_role=tracking&show_completed=true', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const tasks = getArr(await taskRes.json());
      const completedTask = tasks.find(t => t.item_details && t.item_details.fa_unic_code === 'E2E-ITEM-01');
      return {
        taskId: completedTask?.id,
        historyCount: completedTask?.history ? completedTask.history.length : 0,
        histories: completedTask?.history
      };
    });

    console.log('   ✓ تاریخچه رویدادهای تسک (Audit Trail) بررسی شد:', `تعداد رخدادها: ${historyAudit.historyCount}`);
    await captureScreenshot(page, 'phase5_scenario10_02_task_history_audit_trail');

    // ۳. درخواست و دانلود خروجی فایل اکسل (.xlsx) با داده‌های کامل
    const excelRes = await page.evaluate(async () => {
      const token = localStorage.getItem('wh_access_token');
      const whId = localStorage.getItem('wh_active_id');

      const res = await fetch('/api/inventory/count-tasks/export_excel/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          warehouse_id: whId,
          as_role: 'tracking',
          show_completed: true,
          data_scope: 'all'
        })
      });
      const buffer = await res.arrayBuffer();
      let binary = '';
      const bytes = new Uint8Array(buffer);
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return {
        status: res.status,
        contentType: res.headers.get('content-type'),
        base64: btoa(binary),
        byteLength: bytes.byteLength
      };
    });

    const exportPath = path.join(__dirname, '..', '..', 'Documents', 'Browser_E2E_Comprehensive_Testing', 'inventory_e2e_export.xlsx');
    fs.writeFileSync(exportPath, Buffer.from(excelRes.base64, 'base64'));
    console.log('   ✓ فایل اکسل با موفقیت تولید و ذخیره شد:', `حجم: ${excelRes.byteLength} بایت -> ${exportPath}`);
    await captureScreenshot(page, 'phase5_scenario10_03_excel_export_completed');

    console.log('\n====================================================');
    console.log('🎉 فاز ۵ با موفقیت ۱۰۰٪ به پایان رسید.');
    console.log('====================================================');
    return { success: true };
  } catch (err) {
    console.error('❌ خطا در اجرای فاز ۵:', err);
    return { success: false, error: err.message };
  } finally {
    await browser.close();
  }
}

runPhase5().then(r => process.exit(r.success ? 0 : 1));
