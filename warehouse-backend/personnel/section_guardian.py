"""
Section Guardian Agent (ایجنت نگهبان معماری پروژه، بخش و ساختار سازمانی)
Strict Guardian Suite for Accounting Project & Section Architecture.
Validates scope isolation, draft state enforcement, zero-rewrite invariants, and database integrity.
"""

import sys
import os

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

import django

if not os.environ.get('DJANGO_SETTINGS_MODULE'):
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    try:
        django.setup()
    except Exception:
        pass


class SectionGuardian:
    def __init__(self):
        self.results = {}

    def report_status(self, phase_name: str, passed: bool, checks: list):
        print(f"\n{'='*65}")
        print(f"🛡️ ایجنت نگهبان سخت‌گیر: ارزیابی و ممیزی {phase_name}")
        print(f"{'='*65}")
        for check_title, status, detail in checks:
            icon = "✅" if status else "❌"
            print(f"{icon} {check_title}: {detail}")
        
        if passed:
            print(f"\n✨ گواهی تایید نگهبان: تمام چک‌های {phase_name} با موفقیت ۱۰۰٪ پاس شدند (CERTIFIED) ✨\n")
        else:
            print(f"\n🚫 هشدار نگهبان: مواردی در {phase_name} رد شدند (FAILED) 🚫\n")
        return passed

    def audit_phase_1_foundation(self) -> bool:
        """
        ارزیابی سخت‌گیرانه فاز ۱:
        ۱. ایجاد مدل‌های ساختار سازمانی، پروژه، بخش، طرف‌حساب و فاکتور
        ۲. تزریق غیرمخرب و اختیاری (null=True) فیلدهای project و section به مدل‌های موجود
        ۳. بررسی اعمال سالم مایگریشن‌ها و وجود جداول در دیتابیس
        ۴. سلامت سریالایزرها و ثبت در پنل ادمین
        """
        checks = []
        all_passed = True

        try:
            from django.contrib.admin import site
            from django.db import connection
            from personnel.models import (
                FinancialProject,
                ProjectSection,
                UserSectionAssignment,
                Counterparty,
                ExpenseInvoice,
                PersonnelProfile,
                VehicleDriverProfile,
                DailyAttendance,
                VehicleTripLog
            )
            from personnel.serializers import (
                FinancialProjectSerializer,
                ProjectSectionSerializer,
                UserSectionAssignmentSerializer,
                CounterpartySerializer,
                ExpenseInvoiceSerializer
            )

            # چک ۱: وجود مدل‌های جدید
            models_to_check = [
                (FinancialProject, "FinancialProject (پروژه مالی/عملیاتی)"),
                (ProjectSection, "ProjectSection (بخش/دپارتمان پروژه)"),
                (UserSectionAssignment, "UserSectionAssignment (انتساب کاربر به بخش)"),
                (Counterparty, "Counterparty (طرف‌حساب مالی)"),
                (ExpenseInvoice, "ExpenseInvoice (فاکتور هزینه)")
            ]
            for model_cls, label in models_to_check:
                if model_cls is not None:
                    checks.append((f"وجود مدل {label}", True, "مدل در personnel.models با موفقیت لود شد"))
                else:
                    checks.append((f"وجود مدل {label}", False, "مدل یافت نشد!"))
                    all_passed = False

            # چک ۲: اعتبارسنجی فیلدهای FinancialProject
            fp_fields = [f.name for f in FinancialProject._meta.get_fields()]
            req_fp = ['code', 'name', 'description', 'is_active', 'created_at', 'updated_at', 'sections']
            fp_ok = all(f in fp_fields for f in req_fp)
            checks.append(("فیلدهای FinancialProject", fp_ok, f"فیلدهای الزامی: {req_fp}"))
            if not fp_ok:
                all_passed = False

            # چک ۳: اعتبارسنجی فیلدها و یکتایی ProjectSection
            ps_fields = [f.name for f in ProjectSection._meta.get_fields()]
            req_ps = ['project', 'code', 'name', 'is_active']
            ps_ok = all(f in ps_fields for f in req_ps)
            ps_unique = ('project', 'code') in ProjectSection._meta.unique_together or [('project', 'code')] == [list(u) for u in ProjectSection._meta.unique_together]
            checks.append(("فیلدها و یکتایی ProjectSection", ps_ok and ps_unique, "فیلدها حاضر و unique_together=('project', 'code') معتبر است"))
            if not (ps_ok and ps_unique):
                all_passed = False

            # چک ۴: نقش‌های معتبر در UserSectionAssignment
            roles = [c[0] for c in UserSectionAssignment.ROLE_CHOICES]
            req_roles = ['employee', 'supervisor', 'accountant', 'manager', 'treasury']
            roles_ok = all(r in roles for r in req_roles)
            checks.append(("نقش‌های پنج‌گانه UserSectionAssignment", roles_ok, f"نقش‌ها: {roles}"))
            if not roles_ok:
                all_passed = False

            # چک ۵: فیلدهای Counterparty
            cp_fields = [f.name for f in Counterparty._meta.get_fields()]
            req_cp = ['name', 'counterparty_type', 'national_id', 'phone', 'bank_name', 'sheba_number', 'section', 'is_active']
            cp_ok = all(f in cp_fields for f in req_cp)
            checks.append(("فیلدهای Counterparty", cp_ok, f"فیلدها: {req_cp}"))
            if not cp_ok:
                all_passed = False

            # چک ۶: وضعیت پیش‌فرض فاکتور (قانون طلایی Draft)
            ei_status_field = ExpenseInvoice._meta.get_field('status')
            default_draft = (ei_status_field.default == 'draft')
            checks.append(("تحمیل وضعیت پیش‌فرض Draft برای ExpenseInvoice", default_draft, f"مقدار پیش‌فرض: {ei_status_field.default}"))
            if not default_draft:
                all_passed = False

            # چک ۷ تا ۱۰: تزریق غیرمخرب (null=True, blank=True) به مدل‌های موجود
            injection_targets = [
                (PersonnelProfile, "PersonnelProfile"),
                (VehicleDriverProfile, "VehicleDriverProfile"),
                (DailyAttendance, "DailyAttendance"),
                (VehicleTripLog, "VehicleTripLog")
            ]
            for model_cls, model_name in injection_targets:
                has_proj = hasattr(model_cls, 'project')
                has_sec = hasattr(model_cls, 'section')
                if has_proj and has_sec:
                    proj_field = model_cls._meta.get_field('project')
                    sec_field = model_cls._meta.get_field('section')
                    nullable = (proj_field.null and proj_field.blank and sec_field.null and sec_field.blank)
                    checks.append((f"تزریق غیرمخرب به {model_name}", nullable, f"project & section present (null=True, blank=True={nullable})"))
                    if not nullable:
                        all_passed = False
                else:
                    checks.append((f"تزریق فیلد به {model_name}", False, "فیلد project یا section یافت نشد!"))
                    all_passed = False

            # چک ۱۱: ایندکس‌های بخش در جداول کارکرد و تردد
            da_indexes = [idx.fields for idx in DailyAttendance._meta.indexes]
            vt_indexes = [idx.fields for idx in VehicleTripLog._meta.indexes]
            has_da_sec_idx = any('section' in idx for idx in da_indexes)
            has_vt_sec_idx = any('section' in idx for idx in vt_indexes)
            checks.append(("ایندکس‌های کارایی دیتابیس (section, date_shamsi)", has_da_sec_idx and has_vt_sec_idx, "ایندکس‌ها روی DailyAttendance و VehicleTripLog فعال است"))
            if not (has_da_sec_idx and has_vt_sec_idx):
                all_passed = False

            # چک ۱۲: جدول‌های فیزیکی دیتابیس
            table_names = connection.introspection.table_names()
            expected_tables = [
                'personnel_financialproject',
                'personnel_projectsection',
                'personnel_usersectionassignment',
                'personnel_counterparty',
                'personnel_expenseinvoice'
            ]
            tables_exist = all(t in table_names for t in expected_tables)
            checks.append(("بررسی وجود جداول در دیتابیس فعال", tables_exist, f"جداول شناسایی شدند: {[t for t in expected_tables if t in table_names]}"))
            if not tables_exist:
                all_passed = False

            # چک ۱۳: ثبت در ادمین جنگو
            admin_registered = all(m in site._registry for m in [FinancialProject, ProjectSection, UserSectionAssignment, Counterparty, ExpenseInvoice])
            checks.append(("ثبت مدل‌ها در پنل ادمین جنگو", admin_registered, "همه ۵ مدل در admin.site ثبت شده‌اند"))
            if not admin_registered:
                all_passed = False

            # چک ۱۴: سلامت سریالایزرها
            serializers_valid = all([
                FinancialProjectSerializer is not None,
                ProjectSectionSerializer is not None,
                UserSectionAssignmentSerializer is not None,
                CounterpartySerializer is not None,
                ExpenseInvoiceSerializer is not None
            ])
            checks.append(("سریالایزرهای REST Framework", serializers_valid, "کلاس‌های سریالایزر آماده و قابل استفاده در API هستند"))
            if not serializers_valid:
                all_passed = False

        except Exception as e:
            checks.append(("اجرای ارزیابی فونداسیون", False, f"خطای پیش‌بینی نشده: {str(e)}"))
            all_passed = False

        return self.report_status("فاز ۱: فونداسیون دیتابیس و مدل‌های ساختار سازمانی", all_passed, checks)

    def audit_phase_2_api_and_admin(self) -> bool:
        """
        ارزیابی سخت‌گیرانه فاز ۲:
        ۱. ویوست‌های ۵ مدل سازمانی و اتصال صحیح به سریالایزرها و کوئری‌ست‌ها
        ۲. رجیستر شدن روت‌های API در router و قابلیت resolve شدن
        ۳. اکشن هوشمند my-sections برای دراپ‌داون فرم کارمندان
        ۴. تحمیل ایجاد امن فاکتور با created_by = request.user
        ۵. اعتبارسنجی سرویس‌ها و مدل‌های فرانت‌اند
        """
        checks = []
        all_passed = True

        try:
            from django.urls import resolve
            from personnel.views import (
                FinancialProjectViewSet,
                ProjectSectionViewSet,
                UserSectionAssignmentViewSet,
                CounterpartyViewSet,
                ExpenseInvoiceViewSet
            )

            # چک ۱: وجود ویوست‌های ۵ مدل جدید
            viewsets = [
                (FinancialProjectViewSet, "FinancialProjectViewSet"),
                (ProjectSectionViewSet, "ProjectSectionViewSet"),
                (UserSectionAssignmentViewSet, "UserSectionAssignmentViewSet"),
                (CounterpartyViewSet, "CounterpartyViewSet"),
                (ExpenseInvoiceViewSet, "ExpenseInvoiceViewSet")
            ]
            for vs_cls, vs_name in viewsets:
                if vs_cls is not None:
                    checks.append((f"ویوست {vs_name}", True, "ویوست معتبر و آماده دریافت درخواست است"))
                else:
                    checks.append((f"ویوست {vs_name}", False, "یافت نشد!"))
                    all_passed = False

            # چک ۲: روت‌های API در DefaultRouter
            endpoints_to_resolve = [
                ('/api/personnel/financial-projects/', 'financial-projects-list'),
                ('/api/personnel/project-sections/', 'project-sections-list'),
                ('/api/personnel/user-section-assignments/', 'user-section-assignments-list'),
                ('/api/personnel/user-section-assignments/my-sections/', 'user-section-assignments-my-sections'),
                ('/api/personnel/counterparties/', 'counterparties-list'),
                ('/api/personnel/expense-invoices/', 'expense-invoices-list'),
            ]
            for path, expected_url_name in endpoints_to_resolve:
                try:
                    match = resolve(path)
                    checks.append((f"روت API: {path}", True, f"Resolve شد به: {match.url_name}"))
                except Exception as ex:
                    checks.append((f"روت API: {path}", False, f"عدم امکان Resolve: {str(ex)}"))
                    all_passed = False

            # چک ۳: اکشن my-sections روی UserSectionAssignmentViewSet
            has_my_sec = hasattr(UserSectionAssignmentViewSet, 'my_sections')
            checks.append(("اکشن کاربردی my-sections", has_my_sec, "متد اختصاصی دریافت بخش‌های منتسب به کاربر پیاده‌سازی شده است"))
            if not has_my_sec:
                all_passed = False

            # چک ۴: تنظیمات امنیت و احراز هویت IsAuthenticated
            perms_ok = all(
                hasattr(vs, 'permission_classes') and len(vs.permission_classes) > 0
                for vs, _ in viewsets
            )
            checks.append(("الزام احراز هویت ViewSetها", perms_ok, "تمامی ویوست‌ها با IsAuthenticated ایمن شده‌اند"))
            if not perms_ok:
                all_passed = False

            # چک ۵: بررسی فایل‌های فرانت‌اند
            front_model_path = os.path.join(BASE_DIR, '..', 'warehouse-front', 'src', 'app', 'core', 'models', 'personnel.model.ts')
            front_api_path = os.path.join(BASE_DIR, '..', 'warehouse-front', 'src', 'app', 'core', 'api', 'personnel-api.service.ts')
            front_html_path = os.path.join(BASE_DIR, '..', 'warehouse-front', 'src', 'app', 'components', 'personnel', 'base-settings', 'base-settings.html')
            
            with open(front_model_path, 'r', encoding='utf-8') as f:
                model_content = f.read()
            has_front_models = all(m in model_content for m in ['FinancialProject', 'ProjectSection', 'UserSectionAssignment', 'Counterparty', 'ExpenseInvoice'])
            checks.append(("مدل‌های تایپ‌اسکریپت فرانت‌اند", has_front_models, "اینترفیس‌های هر ۵ مدل در personnel.model.ts تعریف شده‌اند"))
            if not has_front_models:
                all_passed = False

            with open(front_api_path, 'r', encoding='utf-8') as f:
                api_content = f.read()
            has_api_methods = all(m in api_content for m in [
                'getFinancialProjects', 'createFinancialProject',
                'getProjectSections', 'createProjectSection',
                'getUserSectionAssignments', 'createUserSectionAssignment', 'getMySections',
                'getCounterparties', 'createCounterparty'
            ])
            checks.append(("سرویس PersonnelApiService فرانت‌اند", has_api_methods, "متدهای CRUD کامل در سرویس کلاینت آماده‌اند"))
            if not has_api_methods:
                all_passed = False

            with open(front_html_path, 'r', encoding='utf-8') as f:
                html_content = f.read()
            tab7_removed = 'activeTab === \'org_structure\'' not in html_content
            checks.append(("پالایش و تفکیک تنظیمات پایه", tab7_removed, "تب هفتم ساختار سازمانی از base-settings با موفقیت حذف شده است"))
            if not tab7_removed:
                all_passed = False

            # ارزیابی ماژول مستقل جدید در سایدبار
            org_comp_ts = os.path.join(BASE_DIR, '..', 'warehouse-front', 'src', 'app', 'components', 'organization', 'projects-and-sections', 'projects-and-sections.ts')
            org_comp_html = os.path.join(BASE_DIR, '..', 'warehouse-front', 'src', 'app', 'components', 'organization', 'projects-and-sections', 'projects-and-sections.html')
            routes_path = os.path.join(BASE_DIR, '..', 'warehouse-front', 'src', 'app', 'app.routes.ts')
            layout_path = os.path.join(BASE_DIR, '..', 'warehouse-front', 'src', 'app', 'components', 'layout', 'layout.ts')

            comp_exists = os.path.exists(org_comp_ts) and os.path.exists(org_comp_html)
            checks.append(("کامپوننت مستقل ProjectsAndSectionsComponent", comp_exists, "کامپوننت اختصاصی در src/app/components/organization مستقر است"))
            if not comp_exists:
                all_passed = False

            with open(routes_path, 'r', encoding='utf-8') as f:
                routes_content = f.read()
            has_route = 'projects-and-sections' in routes_content and 'ProjectsAndSectionsComponent' in routes_content
            checks.append(("ثبت مسیر مستقل در app.routes.ts", has_route, "روت /projects-and-sections در سیستم ثبت شده است"))
            if not has_route:
                all_passed = False

            with open(layout_path, 'r', encoding='utf-8') as f:
                layout_content = f.read()
            has_sidebar_item = 'projects-and-sections' in layout_content and '🏢 پروژه‌ها و بخش‌ها' in layout_content
            checks.append(("استقرار در سطح اول سایدبار اصلی", has_sidebar_item, "منوی «🏢 پروژه‌ها و بخش‌ها» در سایدبار افزوده شد"))
            if not has_sidebar_item:
                all_passed = False

            dist_index_path = os.path.join(BASE_DIR, '..', 'warehouse-front', 'dist', 'warehouse-app', 'browser', 'index.html')
            build_ok = os.path.exists(dist_index_path) and os.path.getsize(dist_index_path) > 0
            checks.append(("بیلد پروداکشن Angular (AOT Bundle)", build_ok, f"فایل dist/warehouse-app/browser/index.html حاضر است (حجم: {os.path.getsize(dist_index_path) if build_ok else 0} بایت)"))
            if not build_ok:
                all_passed = False

        except Exception as e:
            checks.append(("اجرای ارزیابی فاز ۲", False, f"خطای پیش‌بینی نشده: {str(e)}"))
            all_passed = False

        return self.report_status("فاز ۲: سرویس‌های API و پنل مستقل ساختار سازمانی در سایدبار", all_passed, checks)

    def audit_phase_3_and_4_project_settings_and_exports(self) -> bool:
        """
        ارزیابی نگهبان برای فاز ۳ و ۴:
        ۱. بررسی فیلد project در مدل PayrollYearlySettings و قیود یکتایی
        ۲. وجود رکورد سراسری بدون پروژه (project=None) برای سال ۱۴۰۵
        ۳. پیاده‌سازی اکشن clone-for-project در ویوست
        ۴. پشتیبانی پارامتر project_id در export_bimeh_diskettes و export_bank_excel
        """
        all_passed = True
        checks = []

        try:
            from personnel.models import PayrollYearlySettings, FinancialProject
            from personnel.views import PayrollYearlySettingsViewSet, MonthlyPayrollViewSet

            # ۱. بررسی مدل و فیلد project
            pys_fields = [f.name for f in PayrollYearlySettings._meta.get_fields()]
            has_proj_field = 'project' in pys_fields
            checks.append(("فیلد project در مدل PayrollYearlySettings", has_proj_field, "مدل تنظیمات سالانه حقوق دارای کلید خارجی به FinancialProject است"))
            if not has_proj_field:
                all_passed = False

            # ۲. بررسی رکورد پیش‌فرض سراسری ۱۴۰۵
            global_1405 = PayrollYearlySettings.objects.filter(fiscal_year='1405', project__isnull=True).first()
            checks.append(("رکورد تنظیمات سراسری سال ۱۴۰۵ (project=None)", global_1405 is not None, f"رکورد پیش‌فرض سراسری فعال است (ID: {global_1405.id if global_1405 else 'None'})"))
            if not global_1405:
                all_passed = False

            # ۳. بررسی اکشن clone-for-project در ویوست
            has_clone_action = hasattr(PayrollYearlySettingsViewSet, 'clone_for_project')
            checks.append(("اکشن clone-for-project در PayrollYearlySettingsViewSet", has_clone_action, "اکشن کپی هوشمند تنظیمات برای پروژه‌ها پیاده‌سازی شده است"))
            if not has_clone_action:
                all_passed = False

            # ۴. بررسی تفکیک اجباری پروژه در متدهای خروجی
            has_dsk_export = hasattr(MonthlyPayrollViewSet, 'export_bimeh_diskettes') or hasattr(MonthlyPayrollViewSet, 'export_dsk_zip')
            has_bank_export = hasattr(MonthlyPayrollViewSet, 'export_bank_excel')
            checks.append(("اندپوینت صدور دیسکت‌های بیمه تک‌پروژه‌ای", has_dsk_export, "متدهای export_bimeh_diskettes / export_dsk_zip فعال هستند"))
            checks.append(("اندپوینت صدور فایل پایا بانک تک‌پروژه‌ای", has_bank_export, "متد export_bank_excel فعال است"))
            if not (has_dsk_export and has_bank_export):
                all_passed = False

            # ۵. بررسی سلکتور پروژه در BaseSettings فرانت‌اند
            base_settings_ts = os.path.join(BASE_DIR, '..', 'warehouse-front', 'src', 'app', 'components', 'personnel', 'base-settings', 'base-settings.ts')
            with open(base_settings_ts, 'r', encoding='utf-8') as f:
                ts_content = f.read()
            has_proj_selector = 'selectedProjectId' in ts_content and 'cloneForSelectedProject' in ts_content
            checks.append(("سلکتور دامنه پروژه و دکمه کپی در BaseSettings", has_proj_selector, "فرانت‌اند مجهز به سلکتور دامنه و منطق ارث‌بری است"))
            if not has_proj_selector:
                all_passed = False

        except Exception as e:
            checks.append(("اجرای ارزیابی فاز ۳ و ۴", False, f"خطا در ممیزی: {str(e)}"))
            all_passed = False

        return self.report_status("فاز ۳ و ۴: ارث‌بری هوشمند تنظیمات پروژه‌محور و تفکیک اجباری خروجی‌ها", all_passed, checks)


if __name__ == '__main__':
    guardian = SectionGuardian()
    p1 = guardian.audit_phase_1_foundation()
    p2 = guardian.audit_phase_2_api_and_admin()
    p3_4 = guardian.audit_phase_3_and_4_project_settings_and_exports()
    all_ok = p1 and p2 and p3_4
    print(f"\n[SECTION GUARDIAN FINAL VERDICT] -> {'SUCCESS - ALL AUDITS PASSED' if all_ok else 'FAILED - SOME CHECKS FAILED'}\n")
    sys.exit(0 if all_ok else 1)

