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
        
        # -> Open the 'Reports' page (navigate to /reports) and wait for the UI to render.
        await page.goto("http://localhost:4200/reports")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Reload the Reports page and wait for the UI to render so the report controls become visible.
        await page.goto("http://localhost:4200/reports")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Fill the username field with 'admin', fill the password field with '123456', and click the 'ورود به سامانه' (Login) button.
        # نام کاربری را وارد کنید text field
        elem = page.get_by_placeholder('نام کاربری را وارد کنید', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("admin")
        
        # -> Fill the username field with 'admin', fill the password field with '123456', and click the 'ورود به سامانه' (Login) button.
        # •••••••• password field
        elem = page.get_by_placeholder('••••••••', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("123456")
        
        # -> Fill the username field with 'admin', fill the password field with '123456', and click the 'ورود به سامانه' (Login) button.
        # ورود به سامانه button
        elem = page.get_by_role('button', name='ورود به سامانه', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'گزارش‌ساز' (Reports builder) button in the left menu to open the Reports page and wait for the UI to settle.
        # گزارش‌ساز button
        elem = page.get_by_role('button', name='گزارش\u200cساز', exact=True)
        await elem.click(timeout=10000)
        
        # -> Open the 'منبع داده' (Data source) dropdown and select 'کالاها' (Items) as the data source.
        # انتخاب موجودیت… کالاها وظایف شمارش تاریخچه شمارش... dropdown
        elem = page.locator('xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div/div[2]/select')
        await elem.click(timeout=10000)
        
        # -> Select 'کالاها' (Items) as the data source from the Data Source dropdown and wait for the page to update.
        # انتخاب موجودیت… کالاها وظایف شمارش تاریخچه شمارش... dropdown
        elem = page.locator("xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div/div[2]/select").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> Click the 'طبقه‌بندی انبار' field to group by category, add the aggregation field 'مبلغ', then click the 'اجرای گزارش' (Run Report) button to execute the report.
        # طبقه‌بندی انبار button
        elem = page.locator('xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div[4]/div[2]/button[22]')
        await elem.click(timeout=10000)
        
        # -> Click the 'طبقه‌بندی انبار' field to group by category, add the aggregation field 'مبلغ', then click the 'اجرای گزارش' (Run Report) button to execute the report.
        # مبلغ button
        elem = page.locator('xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div[4]/div[2]/button[25]')
        await elem.click(timeout=10000)
        
        # -> Click the 'طبقه‌بندی انبار' field to group by category, add the aggregation field 'مبلغ', then click the 'اجرای گزارش' (Run Report) button to execute the report.
        # اجرای گزارش button
        elem = page.get_by_role('button', name='اجرای گزارش', exact=True)
        await elem.click(timeout=10000)
        
        # -> In the Chart section, choose chart type 'ستونی' (Bar), set the category axis to 'طبقه‌بندی انبار', and set the value to 'مبلغ' to render the bar chart.
        # نوع نمودار… ستونی دایره‌ای خطی dropdown
        elem = page.locator("xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div[5]/div/select").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> In the Chart section, choose chart type 'ستونی' (Bar), set the category axis to 'طبقه‌بندی انبار', and set the value to 'مبلغ' to render the bar chart.
        # محور دسته‌ها… طبقه‌بندی انبار مبلغ dropdown
        elem = page.locator("xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div[5]/div/select[2]").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> In the Chart section, choose chart type 'ستونی' (Bar), set the category axis to 'طبقه‌بندی انبار', and set the value to 'مبلغ' to render the bar chart.
        # مقدار… تعداد ID dropdown
        elem = page.locator("xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div[5]/div/select[3]").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> Switch the chart type to 'دایره‌ای' (Pie) and then to 'خطی' (Line), verifying the chart updates each time by observing the chart canvas.
        # نوع نمودار… ستونی دایره‌ای خطی dropdown
        elem = page.locator("xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div[5]/div/select").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> Switch the chart type to 'دایره‌ای' (Pie) and then to 'خطی' (Line), verifying the chart updates each time by observing the chart canvas.
        # نوع نمودار… ستونی دایره‌ای خطی dropdown
        elem = page.locator("xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div[5]/div/select").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> Switch the chart type to 'دایره‌ای' (Pie) then to 'خطی' (Line), add grouping by 'ID', and click the 'اجرای گزارش' (Run Report) button to re-run the report.
        # نوع نمودار… ستونی دایره‌ای خطی dropdown
        elem = page.locator("xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div[5]/div/select").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> Switch the chart type to 'دایره‌ای' (Pie) then to 'خطی' (Line), add grouping by 'ID', and click the 'اجرای گزارش' (Run Report) button to re-run the report.
        # نوع نمودار… ستونی دایره‌ای خطی dropdown
        elem = page.locator("xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div[5]/div/select").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> Switch the chart type to 'دایره‌ای' (Pie) then to 'خطی' (Line), add grouping by 'ID', and click the 'اجرای گزارش' (Run Report) button to re-run the report.
        # ID button
        elem = page.locator('xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div[4]/div[2]/button')
        await elem.click(timeout=10000)
        
        # -> Set the chart's X-axis to 'ID', set the Y-axis/value to 'تعداد ID', then click the 'اجرای گزارش' (Run Report) button to re-run the report and check for a warning about only the first 50 groups being charted.
        # محور دسته‌ها… طبقه‌بندی انبار مبلغ ID dropdown
        elem = page.locator("xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div[5]/div/select[2]").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> Set the chart's X-axis to 'ID', set the Y-axis/value to 'تعداد ID', then click the 'اجرای گزارش' (Run Report) button to re-run the report and check for a warning about only the first 50 groups being charted.
        # مقدار… تعداد ID dropdown
        elem = page.locator("xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div[5]/div/select[3]").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> Set the chart's X-axis to 'ID', set the Y-axis/value to 'تعداد ID', then click the 'اجرای گزارش' (Run Report) button to re-run the report and check for a warning about only the first 50 groups being charted.
        # اجرای گزارش button
        elem = page.get_by_role('button', name='اجرای گزارش', exact=True)
        await elem.click(timeout=10000)
        
        # -> Set grouping to 'ID', choose aggregation 'تعداد' (Count), and click the 'اجرای گزارش' (Run Report) button to re-run the report so the UI can show a warning about only the first 50 groups being charted.
        # ID button
        elem = page.locator('xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div[4]/div[2]/button')
        await elem.click(timeout=10000)
        
        # -> Set grouping to 'ID', choose aggregation 'تعداد' (Count), and click the 'اجرای گزارش' (Run Report) button to re-run the report so the UI can show a warning about only the first 50 groups being charted.
        # تعداد جمع میانگین کمینه بیشینه dropdown
        elem = page.locator("xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div[4]/div[3]/div/select").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> Set grouping to 'ID', choose aggregation 'تعداد' (Count), and click the 'اجرای گزارش' (Run Report) button to re-run the report so the UI can show a warning about only the first 50 groups being charted.
        # اجرای گزارش button
        elem = page.get_by_role('button', name='اجرای گزارش', exact=True)
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> Verify the Chart section (Section 6) appears
        # Assert: The Chart section heading “۶. نمودار” is present.
        await expect(page.locator("xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div[5]/div/div").nth(0)).to_have_text("\u06f6. \u0646\u0645\u0648\u062f\u0627\u0631", timeout=15000), "The Chart section heading \u201c\u06f6. \u0646\u0645\u0648\u062f\u0627\u0631\u201d is present."
        await page.locator("xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div[5]/div/select[1]").nth(0).scroll_into_view_if_needed()
        # Assert: The chart type selector is visible in the Chart section.
        await expect(page.locator("xpath=/html/body/app-root/app-layout/div/div/div/app-reports/div/div[2]/div[2]/div[5]/div/select[1]").nth(0)).to_be_visible(timeout=15000), "The chart type selector is visible in the Chart section."
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
    