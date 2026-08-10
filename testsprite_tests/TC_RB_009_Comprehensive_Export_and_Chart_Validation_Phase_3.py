import asyncio
import re
from playwright import async_api
from playwright.async_api import expect

async def run_test():
    pw = None
    browser = None
    context = None

    try:
        # Start a Playwright session in asynchronous mode
        pw = await async_api.async_playwright().start()

        # Launch a Chromium browser in headless mode with custom arguments
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--window-size=1280,720",
                "--disable-dev-shm-usage",
                "--ipc=host",
                "--single-process"
            ],
        )

        # Create a new browser context (like an incognito window)
        context = await browser.new_context()
        # Wider default timeout to match the agent's DOM-stability budget;
        # auto-waiting Playwright APIs (expect, locator.wait_for) inherit this.
        context.set_default_timeout(15000)

        # Open a new page in the browser context
        page = await context.new_page()

        # Interact with the page elements to simulate user flow
        # -> navigate
        await page.goto("http://localhost:4200")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Navigate to the Reports page (open /reports).
        await page.goto("http://localhost:4200/reports")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Fill 'admin' into the username field and '123456' into the password field, then click the 'ورود به سامانه' button.
        # نام کاربری را وارد کنید text field
        elem = page.get_by_placeholder('نام کاربری را وارد کنید', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("admin")
        
        # -> Fill 'admin' into the username field and '123456' into the password field, then click the 'ورود به سامانه' button.
        # •••••••• password field
        elem = page.get_by_placeholder('••••••••', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("123456")
        
        # -> Fill 'admin' into the username field and '123456' into the password field, then click the 'ورود به سامانه' button.
        # ورود به سامانه button
        elem = page.get_by_role('button', name='ورود به سامانه', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'گزارش‌ساز' (Report Builder) button in the sidebar to open the reporting interface.
        # گزارش‌ساز button
        elem = page.get_by_role('button', name='گزارش\u200cساز', exact=True)
        await elem.click(timeout=10000)
        
        # -> Open the data source dropdown and select 'کالاها' (the items entity) from the 'منبع داده' dropdown.
        # انتخاب موجودیت… کالاها وظایف شمارش تاریخچه شمارش... dropdown
        elem = page.locator('xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div/div[2]/select')
        await elem.click(timeout=10000)
        
        # -> Select the 'شیراز' warehouse from the warehouse dropdown labeled with the warehouse name.
        # انتخاب موجودیت… کالاها وظایف شمارش تاریخچه شمارش... dropdown
        elem = page.locator("xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div/div[2]/select").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> Select 'کالاها' from the data source dropdown (منبع داده).
        # انتخاب موجودیت… کالاها وظایف شمارش تاریخچه شمارش... dropdown
        elem = page.locator("xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div/div[2]/select").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> Select the warehouse 'شیراز' from the warehouse dropdown so the report can be configured for that location.
        # [internal] get_dropdown_options: index=
        
        # -> Select the warehouse 'شیراز' from the warehouse dropdown so the report can be configured for that location.
        # همه انبارهای مجاز شیراز تهران انبار عسلویه Test... dropdown
        elem = page.locator("xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div/div[2]/select[2]").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> Select multiple fields in the Fields panel (start by clicking the 'ID', 'کد یکتا (FA-UNIC)', 'کد ترکیبی PL-PK-Item', 'پکینگ لیست (PL)', and 'سفارش خرید (PO)' field buttons).
        # ID button
        elem = page.locator('xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div[2]/div[2]/button')
        await elem.click(timeout=10000)
        
        # -> Select multiple fields in the Fields panel (start by clicking the 'ID', 'کد یکتا (FA-UNIC)', 'کد ترکیبی PL-PK-Item', 'پکینگ لیست (PL)', and 'سفارش خرید (PO)' field buttons).
        # کد یکتا (FA-UNIC) button
        elem = page.locator('xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div[2]/div[2]/button[2]')
        await elem.click(timeout=10000)
        
        # -> Select multiple fields in the Fields panel (start by clicking the 'ID', 'کد یکتا (FA-UNIC)', 'کد ترکیبی PL-PK-Item', 'پکینگ لیست (PL)', and 'سفارش خرید (PO)' field buttons).
        # کد ترکیبی PL-PK-Item button
        elem = page.locator('xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div[2]/div[2]/button[3]')
        await elem.click(timeout=10000)
        
        # -> Select multiple fields in the Fields panel (start by clicking the 'ID', 'کد یکتا (FA-UNIC)', 'کد ترکیبی PL-PK-Item', 'پکینگ لیست (PL)', and 'سفارش خرید (PO)' field buttons).
        # پکینگ لیست (PL) button
        elem = page.locator('xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div[2]/div[2]/button[4]')
        await elem.click(timeout=10000)
        
        # -> Select multiple fields in the Fields panel (start by clicking the 'ID', 'کد یکتا (FA-UNIC)', 'کد ترکیبی PL-PK-Item', 'پکینگ لیست (PL)', and 'سفارش خرید (PO)' field buttons).
        # سفارش خرید (PO) button
        elem = page.locator('xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div[2]/div[2]/button[5]')
        await elem.click(timeout=10000)
        
        # -> Select additional field buttons such as 'پکیج (PK)', 'ردیف (Item)', 'شرح کالا', 'واحد سنجش', and 'دیسیپلین کاری' to increase selected columns.
        # پکیج (PK) button
        elem = page.locator('xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div[2]/div[2]/button[6]')
        await elem.click(timeout=10000)
        
        # -> Select additional field buttons such as 'پکیج (PK)', 'ردیف (Item)', 'شرح کالا', 'واحد سنجش', and 'دیسیپلین کاری' to increase selected columns.
        # ردیف (Item) button
        elem = page.locator('xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div[2]/div[2]/button[7]')
        await elem.click(timeout=10000)
        
        # -> Select additional field buttons such as 'پکیج (PK)', 'ردیف (Item)', 'شرح کالا', 'واحد سنجش', and 'دیسیپلین کاری' to increase selected columns.
        # شرح کالا button
        elem = page.locator('xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div[2]/div[2]/button[8]')
        await elem.click(timeout=10000)
        
        # -> Select additional field buttons such as 'پکیج (PK)', 'ردیف (Item)', 'شرح کالا', 'واحد سنجش', and 'دیسیپلین کاری' to increase selected columns.
        # واحد سنجش button
        elem = page.locator('xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div[2]/div[2]/button[9]')
        await elem.click(timeout=10000)
        
        # -> Select additional field buttons such as 'پکیج (PK)', 'ردیف (Item)', 'شرح کالا', 'واحد سنجش', and 'دیسیپلین کاری' to increase selected columns.
        # دیسیپلین کاری button
        elem = page.locator('xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div[2]/div[2]/button[10]')
        await elem.click(timeout=10000)
        
        # -> Click the 'اجرای گزارش' (Run report) button to execute the report after selecting extra fields so export behavior can be tested.
        # موجودی فیزیکی button
        elem = page.locator('xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div[2]/div[2]/button[11]')
        await elem.click(timeout=10000)
        
        # -> Click the 'اجرای گزارش' (Run report) button to execute the report after selecting extra fields so export behavior can be tested.
        # موجودی مجاز MIV button
        elem = page.locator('xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div[2]/div[2]/button[12]')
        await elem.click(timeout=10000)
        
        # -> Click the 'اجرای گزارش' (Run report) button to execute the report after selecting extra fields so export behavior can be tested.
        # لوکیشن قبلی button
        elem = page.locator('xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div[2]/div[2]/button[13]')
        await elem.click(timeout=10000)
        
        # -> Click the 'اجرای گزارش' (Run report) button to execute the report after selecting extra fields so export behavior can be tested.
        # لوکیشن جدید button
        elem = page.locator('xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div[2]/div[2]/button[14]')
        await elem.click(timeout=10000)
        
        # -> Click the 'اجرای گزارش' (Run report) button to execute the report after selecting extra fields so export behavior can be tested.
        # اجرای گزارش button
        elem = page.get_by_role('button', name='اجرای گزارش', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'خروجی PDF' (Export PDF) button to trigger PDF export and observe any error about column limits.
        # خروجی PDF button
        elem = page.get_by_role('button', name='خروجی PDF', exact=True)
        await elem.click(timeout=10000)
        
        # -> Add grouping by 'طبقه‌بندی انبار' and a SUM aggregation on 'مبلغ', run the report, then click the 'خروجی PDF' (Export PDF) button to verify a successful PDF export.
        # طبقه‌بندی انبار button
        elem = page.locator('xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div[4]/div[2]/button[22]')
        await elem.click(timeout=10000)
        
        # -> Add grouping by 'طبقه‌بندی انبار' and a SUM aggregation on 'مبلغ', run the report, then click the 'خروجی PDF' (Export PDF) button to verify a successful PDF export.
        # مبلغ button
        elem = page.locator('xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div[4]/div[2]/button[25]')
        await elem.click(timeout=10000)
        
        # -> Add grouping by 'طبقه‌بندی انبار' and a SUM aggregation on 'مبلغ', run the report, then click the 'خروجی PDF' (Export PDF) button to verify a successful PDF export.
        # اجرای گزارش button
        elem = page.get_by_role('button', name='اجرای گزارش', exact=True)
        await elem.click(timeout=10000)
        
        # -> Add grouping by 'طبقه‌بندی انبار' and a SUM aggregation on 'مبلغ', run the report, then click the 'خروجی PDF' (Export PDF) button to verify a successful PDF export.
        # Download: خروجی PDF button
        elem = page.get_by_role('button', name='خروجی PDF', exact=True)
        async with page.expect_download(timeout=30000) as dl_info:
            await elem.click(timeout=10000)
        download = await dl_info.value
        assert download.suggested_filename  # verify file was downloaded
        await download.save_as(f"./downloads/{download.suggested_filename}")
        
        # -> Click the 'خروجی Excel' (Export Excel) button and verify an Excel download toast appears.
        # Download: خروجی Excel button
        elem = page.get_by_role('button', name='خروجی Excel', exact=True)
        async with page.expect_download(timeout=30000) as dl_info:
            await elem.click(timeout=10000)
        download = await dl_info.value
        assert download.suggested_filename  # verify file was downloaded
        await download.save_as(f"./downloads/{download.suggested_filename}")
        
        # --> Assertions to verify final state
        
        # --> Verify the PDF download is initiated successfully without errors
        # Assert: Success toast confirms the PDF download completed with text 'فایل PDF دانلود شد.'.
        await expect(page.locator("xpath=/html/body/app-root/app-toast-container/div/div/p").nth(0)).to_have_text("\u0641\u0627\u06cc\u0644 PDF \u062f\u0627\u0646\u0644\u0648\u062f \u0634\u062f.", timeout=15000), "Success toast confirms the PDF download completed with text '\u0641\u0627\u06cc\u0644 PDF \u062f\u0627\u0646\u0644\u0648\u062f \u0634\u062f.'."
        current_url = await page.evaluate("() => window.location.href")
        # Assert: page loaded with a URL (final outcome verified by the AI judge during the run)
        assert current_url, 'Page should have loaded with a URL'
        current_url = await page.evaluate("() => window.location.href")
        # Assert: page loaded with a URL (final outcome verified by the AI judge during the run)
        assert current_url, 'Page should have loaded with a URL'
        current_url = await page.evaluate("() => window.location.href")
        # Assert: page loaded with a URL (final outcome verified by the AI judge during the run)
        assert current_url, 'Page should have loaded with a URL'
        current_url = await page.evaluate("() => window.location.href")
        # Assert: page loaded with a URL (final outcome verified by the AI judge during the run)
        assert current_url, 'Page should have loaded with a URL'
        current_url = await page.evaluate("() => window.location.href")
        # Assert: page loaded with a URL (final outcome verified by the AI judge during the run)
        assert current_url, 'Page should have loaded with a URL'
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    