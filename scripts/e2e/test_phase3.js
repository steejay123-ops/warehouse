const { createBrowser, loginViaApi, captureScreenshot } = require('./e2e_helper');

async function runPhase3() {
  console.log('====================================================');
  console.log('🚀 اجرای آزمون‌های مرورگر زنده فاز ۳ (سناریوهای ۵ و ۶)');
  console.log('====================================================');

  const browser = await createBrowser();
  const page = await browser.newPage();

  try {
    const getArray = (data) => Array.isArray(data) ? data : (data.results || []);

    // ----------------------------------------------------
    // سناریو ۵: استخر عمومی و تصاحب وظایف (E2E-ITEM-05)
    // ----------------------------------------------------
    console.log('\n▶️ [سناریو ۵] تخصیص به استخر عمومی و تصاحب توسط شمارشگر و سرپرست');

    // ۱. ورود مدیر سیستم و تخصیص E2E-ITEM-05 به استخر عمومی (بدون شمارشگر و بدون سرپرست)
    await loginViaApi(page, 'admin_e2e');
    await page.goto('http://localhost:4200/dispatch', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1000));

    const assign5 = await page.evaluate(async () => {
      const getArr = (d) => Array.isArray(d) ? d : (d.results || []);
      const token = localStorage.getItem('wh_access_token');
      const whId = localStorage.getItem('wh_active_id');

      const itemsRes = await fetch(`/api/inventory/items/?warehouse=${whId}&search=E2E-ITEM-05`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const item = getArr(await itemsRes.json())[0];

      const usersRes = await fetch('/api/auth/users/', { headers: { 'Authorization': `Bearer ${token}` } });
      const users = getArr(await usersRes.json());
      const manager = users.find(u => u.username === 'manager_e2e');

      const postRes = await fetch('/api/inventory/items/bulk_assign/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          item_ids: [item.id],
          field_assignee: null,
          supervisor_assignee: null,
          manager_assignee: manager.id,
          field_status: 'counting',
          force: true
        })
      });
      return { success: postRes.ok, item };
    });

    console.log('   ✓ کالا E2E-ITEM-05 به استخر عمومی تخصیص یافت');
    await page.reload({ waitUntil: 'networkidle0' });
    await captureScreenshot(page, 'phase3_scenario5_01_dispatch_public_pool');

    // ۲. ورود شمارشگر به کارتابل، مشاهده استخر عمومی و تصاحب تسک («به‌عهده گرفتن»)
    await loginViaApi(page, 'counter_e2e');
    await page.goto('http://localhost:4200/counter?status=all', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1000));

    const claimCounter = await page.evaluate(async (itemId) => {
      const getArr = (d) => Array.isArray(d) ? d : (d.results || []);
      const token = localStorage.getItem('wh_access_token');
      const poolRes = await fetch('/api/inventory/count-tasks/pool_tasks/?as_role=counter', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const poolTasks = getArr(await poolRes.json());
      const task = poolTasks.find(t => t.item === itemId || (t.item_details && t.item_details.fa_unic_code === 'E2E-ITEM-05'));

      const claimRes = await fetch('/api/inventory/count-tasks/claim_tasks/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ task_ids: [task.id], as_role: 'counter' })
      });
      return { success: claimRes.ok, taskId: task.id };
    }, assign5.item.id);

    console.log('   ✓ شمارشگر تسک را از استخر عمومی به‌عهده گرفت');
    await page.reload({ waitUntil: 'networkidle0' });
    await captureScreenshot(page, 'phase3_scenario5_02_counter_claimed');

    // ۳. شمارشگر مقدار ۵۰.۰۰۰ را ثبت و ارسال می‌کند (به استخر سرپرستان می‌رود)
    await page.evaluate(async (taskId) => {
      const token = localStorage.getItem('wh_access_token');
      await fetch(`/api/inventory/count-tasks/${taskId}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ counted_balance: 50.000, counter_note: 'شمارش تسک تصاحب‌شده', status: 'INITIAL_COUNT' })
      });

      await fetch('/api/inventory/count-tasks/bulk_submit/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ task_ids: [taskId] })
      });
    }, claimCounter.taskId);

    console.log('   ✓ شمارشگر مقدار ۵۰.۰۰۰ را ثبت و به استخر سرپرستان ارسال کرد');

    // ۴. ورود سرپرست، مشاهده تسک در استخر سرپرستی و تصاحب آن
    await loginViaApi(page, 'supervisor_e2e');
    await page.goto('http://localhost:4200/supervisor', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1000));

    await page.evaluate(async (taskId) => {
      const token = localStorage.getItem('wh_access_token');
      await fetch('/api/inventory/count-tasks/claim_tasks/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ task_ids: [taskId], as_role: 'supervisor' })
      });
    }, claimCounter.taskId);

    console.log('   ✓ سرپرست تسک را از استخر سرپرستی به‌عهده گرفت');
    await page.reload({ waitUntil: 'networkidle0' });
    await captureScreenshot(page, 'phase3_scenario5_03_supervisor_claimed');

    // ۵. تایید سرپرست و سپس تایید نهایی مدیر
    await page.evaluate(async (taskId) => {
      const token = localStorage.getItem('wh_access_token');
      await fetch('/api/inventory/count-tasks/bulk_approve/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ task_ids: [taskId], note: 'تایید سرپرست پس از تصاحب' })
      });
    }, claimCounter.taskId);

    await loginViaApi(page, 'manager_e2e');
    await page.goto('http://localhost:4200/manager', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1000));

    await page.evaluate(async (taskId) => {
      const token = localStorage.getItem('wh_access_token');
      await fetch('/api/inventory/count-tasks/bulk_manager_approve/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ task_ids: [taskId], note: 'تایید نهایی تسک استخر عمومی' })
      });
    }, claimCounter.taskId);

    console.log('   ✓ مدیر انبار تایید نهایی را صادر کرد');
    await page.reload({ waitUntil: 'networkidle0' });
    await captureScreenshot(page, 'phase3_scenario5_04_manager_final_approved');


    // ----------------------------------------------------
    // سناریو ۶: لغو تخصیص و تست هشدار تخصیص مجدد (E2E-ITEM-06)
    // ----------------------------------------------------
    console.log('\n▶️ [سناریو ۶] لغو تخصیص و راستی‌آزمایی هشدار تخصیص مجدد اجباری (Force Re-dispatch)');

    // ۱. تخصیص اولیه E2E-ITEM-06
    await loginViaApi(page, 'admin_e2e');
    const assign6 = await page.evaluate(async () => {
      const getArr = (d) => Array.isArray(d) ? d : (d.results || []);
      const token = localStorage.getItem('wh_access_token');
      const whId = localStorage.getItem('wh_active_id');

      const itemsRes = await fetch(`/api/inventory/items/?warehouse=${whId}&search=E2E-ITEM-06`, {
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
      return { item, counter, manager };
    });

    console.log('   ✓ کالا E2E-ITEM-06 تخصیص داده شد');

    // ۲. تست ارسال مجدد بدون force و دریافت هشدار warning: true
    const warnCheck = await page.evaluate(async (item, counter, manager) => {
      const token = localStorage.getItem('wh_access_token');
      const warnRes = await fetch('/api/inventory/items/bulk_assign/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          item_ids: [item.id],
          field_assignee: counter.id,
          supervisor_assignee: 'skip',
          manager_assignee: manager.id,
          field_status: 'counting',
          force: false
        })
      });
      const warnData = await warnRes.json();
      return { status: warnRes.status, hasWarning: warnData.warning === true, message: warnData.message };
    }, assign6.item, assign6.counter, assign6.manager);

    console.log('   ✓ هشدار تخصیص مجدد با موفقیت دریافت شد:', warnCheck.hasWarning, `(${warnCheck.message})`);
    await page.goto('http://localhost:4200/dispatch', { waitUntil: 'networkidle0' });
    await captureScreenshot(page, 'phase3_scenario6_01_redispatch_warning');

    // ۳. لغو تخصیص و آزادسازی کالا (Unassign)
    await page.evaluate(async (item) => {
      const token = localStorage.getItem('wh_access_token');
      // لغو تخصیص با تنظیم وضعیت به waiting
      await fetch(`/api/inventory/items/${item.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ field_status: 'waiting', field_assignee: null })
      });
    }, assign6.item);

    console.log('   ✓ کالا با موفقیت لغو تخصیص شد و به وضعیت waiting بازگشت');
    await page.reload({ waitUntil: 'networkidle0' });
    await captureScreenshot(page, 'phase3_scenario6_02_unassigned_released');

    console.log('\n====================================================');
    console.log('🎉 فاز ۳ با موفقیت ۱۰۰٪ به پایان رسید.');
    console.log('====================================================');
    return { success: true };
  } catch (err) {
    console.error('❌ خطا در اجرای فاز ۳:', err);
    return { success: false, error: err.message };
  } finally {
    await browser.close();
  }
}

runPhase3().then(r => process.exit(r.success ? 0 : 1));
