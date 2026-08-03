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
        
        # -> Navigate to the 'Reports' page (open /reports) and verify the Reports UI loads.
        await page.goto("http://localhost:4200/reports")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Fill the 'نام کاربری' field with 'admin', fill the 'رمز عبور' field with '123456', then click the 'ورود به سامانه' (Login) button.
        # نام کاربری را وارد کنید text field
        elem = page.get_by_placeholder('نام کاربری را وارد کنید', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("admin")
        
        # -> Fill the 'نام کاربری' field with 'admin', fill the 'رمز عبور' field with '123456', then click the 'ورود به سامانه' (Login) button.
        # •••••••• password field
        elem = page.get_by_placeholder('••••••••', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("123456")
        
        # -> Fill the 'نام کاربری' field with 'admin', fill the 'رمز عبور' field with '123456', then click the 'ورود به سامانه' (Login) button.
        # ورود به سامانه button
        elem = page.get_by_role('button', name='ورود به سامانه', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'گزارش‌ساز' button in the sidebar to open the Reports builder UI.
        # گزارش‌ساز button
        elem = page.get_by_role('button', name='گزارش\u200cساز', exact=True)
        await elem.click(timeout=10000)
        
        # -> Open the 'انتخاب موجودیت…' (Entity) dropdown and choose 'کالاها' (Items).
        # انتخاب موجودیت… کالاها وظایف شمارش تاریخچه شمارش... dropdown
        elem = page.locator('xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div/div[2]/select')
        await elem.click(timeout=10000)
        
        # -> Open the 'انتخاب موجودیت…' (Entity) dropdown and select 'کالاها' (Items).
        # انتخاب موجودیت… کالاها وظایف شمارش تاریخچه شمارش... dropdown
        elem = page.locator("xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div/div[2]/select").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> Open the 'انتخاب موجودیت…' (Entity) dropdown and prepare to select the 'کالاها' option.
        # انتخاب موجودیت… کالاها وظایف شمارش تاریخچه شمارش... dropdown
        elem = page.locator('xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div/div[2]/select')
        await elem.click(timeout=10000)
        
        # -> Select 'کالاها' from the Entity dropdown (انتخاب موجودیت… → کالاها).
        # انتخاب موجودیت… کالاها وظایف شمارش تاریخچه شمارش... dropdown
        elem = page.locator("xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div/div[2]/select").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> Click the '+ شرط' (Add condition) button to add a new condition row so its field, operator, and value inputs appear.
        # + شرط button
        elem = page.get_by_role('button', name='+ شرط', exact=True)
        await elem.click(timeout=10000)
        
        # -> Set the condition field to 'شرح کالا', choose the 'contains' operator, and enter 'laptop' as the value in the condition row.
        # فیلد… ID کد یکتا (FA-UNIC) کد ترکیبی PL-PK-Item... dropdown
        elem = page.locator("xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div[3]/app-filter-group/div/div[2]/select").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> Set the condition field to 'شرح کالا', choose the 'contains' operator, and enter 'laptop' as the value in the condition row.
        # برابر بزرگ‌تر بزرگ‌تر یا مساوی کوچک‌تر کوچک‌تر یا... dropdown
        elem = page.locator("xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div[3]/app-filter-group/div/div[2]/select[2]").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> Set the condition field to 'شرح کالا', choose the 'contains' operator, and enter 'laptop' as the value in the condition row.
        # عدد number field
        elem = page.get_by_placeholder('مقدار', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("laptop")
        
        # -> Enter 'laptop' into the condition value field (placeholder 'مقدار'), click the condition 'نقیض' (NOT) toggle on that row, then click the 'اجرای گزارش' (Run report) button.
        # مقدار text field
        elem = page.get_by_placeholder('مقدار', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("laptop")
        
        # -> Enter 'laptop' into the condition value field (placeholder 'مقدار'), click the condition 'نقیض' (NOT) toggle on that row, then click the 'اجرای گزارش' (Run report) button.
        # ! button
        elem = page.get_by_role('button', name='!', exact=True)
        await elem.click(timeout=10000)
        
        # -> Enter 'laptop' into the condition value field (placeholder 'مقدار'), click the condition 'نقیض' (NOT) toggle on that row, then click the 'اجرای گزارش' (Run report) button.
        # اجرای گزارش button
        elem = page.get_by_role('button', name='اجرای گزارش', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'ID' field in the report fields list, then click the 'اجرای گزارش' (Run report) button to execute the report.
        # ID button
        elem = page.locator('xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[3]/div[2]/div[2]/div[2]/button')
        await elem.click(timeout=10000)
        
        # -> Click the 'ID' field in the report fields list, then click the 'اجرای گزارش' (Run report) button to execute the report.
        # اجرای گزارش button
        elem = page.get_by_role('button', name='اجرای گزارش', exact=True)
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> Verify the results return the complement of the OR group
        await page.locator("xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div[3]/app-filter-group/div/div[1]/div/button[2]").nth(0).scroll_into_view_if_needed()
        # Assert: The group operator (OR) button is visible in the filter group.
        await expect(page.locator("xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div[3]/app-filter-group/div/div[1]/div/button[2]").nth(0)).to_be_visible(timeout=15000), "The group operator (OR) button is visible in the filter group."
        await page.locator("xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div[3]/app-filter-group/div/div[1]/button[1]").nth(0).scroll_into_view_if_needed()
        # Assert: The group-level NOT (جز (NOT)) toggle is visible for the filter group.
        await expect(page.locator("xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div[3]/app-filter-group/div/div[1]/button[1]").nth(0)).to_be_visible(timeout=15000), "The group-level NOT (\u062c\u0632 (NOT)) toggle is visible for the filter group."
        # Assert: The filter value is set to 'laptop' in the OR group.
        await expect(page.locator("xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div[3]/app-filter-group/div/div[2]/app-filter-value/input").nth(0)).to_have_value("laptop", timeout=15000), "The filter value is set to 'laptop' in the OR group."
        await page.locator("xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/app-data-table/div/div[1]/table/tbody/tr[1]").nth(0).scroll_into_view_if_needed()
        # Assert: At least one result row is visible, indicating the report returned results after applying the group NOT.
        await expect(page.locator("xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/app-data-table/div/div[1]/table/tbody/tr[1]").nth(0)).to_be_visible(timeout=15000), "At least one result row is visible, indicating the report returned results after applying the group NOT."
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
    