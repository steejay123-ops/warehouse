from django.test import TestCase
from rest_framework.test import APIClient
from accounts.models import CustomUser
from personnel.models import FinancialProject, ProjectSection, PersonnelProfile, DailyAttendance
from personnel.sheba_utils import generate_sheba_from_account


class PersonnelFullCycleTests(TestCase):
    """
    تست یکپارچه چرخه کامل ثبت، گردش تاییدات و کارکرد پرسنل
    پروژه دالان - بخش دالان کارگاه
    """

    def setUp(self):
        self.project, _ = FinancialProject.objects.get_or_create(
            code="1",
            defaults={"name": "دالان", "is_active": True}
        )
        self.section, _ = ProjectSection.objects.get_or_create(
            project=self.project,
            code="11",
            defaults={"name": "دالان کارگاه", "is_active": True}
        )

        self.operator, _ = CustomUser.objects.get_or_create(
            username="test_operator",
            defaults={"first_name": "قاسم", "last_name": "عالیشوندی"}
        )
        self.supervisor, _ = CustomUser.objects.get_or_create(
            username="test_supervisor",
            defaults={"first_name": "رزاق", "last_name": "حسینی"}
        )
        self.accountant, _ = CustomUser.objects.get_or_create(
            username="test_accountant",
            defaults={"first_name": "مهری", "last_name": "باقری"}
        )
        self.manager, _ = CustomUser.objects.get_or_create(
            username="test_manager",
            defaults={"first_name": "سید", "last_name": "موسوی"}
        )

        from django.contrib.auth.models import Permission
        for codename in ["perm_approve_personnel_supervisor", "perm_approve_fleet_supervisor"]:
            p = Permission.objects.filter(codename=codename).first()
            if p:
                self.supervisor.user_permissions.add(p)

        for codename in ["perm_approve_personnel_finance", "perm_approve_fleet_finance"]:
            p = Permission.objects.filter(codename=codename).first()
            if p:
                self.accountant.user_permissions.add(p)

        for codename in ["perm_approve_personnel_manager", "can_act_as_manager", "perm_approve_fleet_manager"]:
            p = Permission.objects.filter(codename=codename).first()
            if p:
                self.manager.user_permissions.add(p)

        from personnel.models import UserSectionAssignment
        UserSectionAssignment.objects.get_or_create(user=self.operator, section=self.section, defaults={"role": "employee", "is_active": True})
        UserSectionAssignment.objects.get_or_create(user=self.supervisor, section=self.section, defaults={"role": "supervisor", "is_active": True})
        UserSectionAssignment.objects.get_or_create(user=self.accountant, section=self.section, defaults={"role": "accountant", "is_active": True})
        UserSectionAssignment.objects.get_or_create(user=self.manager, section=self.section, defaults={"role": "manager", "is_active": True})

        self.client = APIClient()

    def test_complete_personnel_lifecycle_in_dalan(self):
        nat_code = "2280123452"
        valid_sheba = generate_sheba_from_account("بانک ملی ایران", "0105678901004")

        # گام ۱: ثبت توسط اپراتور
        self.client.force_authenticate(user=self.operator)
        payload = {
            "first_name": "سهراب",
            "last_name": "مرادی",
            "national_code": nat_code,
            "father_name": "محمد",
            "job_title": "استادکار تعمیرات و نگهداری",
            "contract_type": "daily",
            "daily_base_wage": 3850000,
            "daily_seniority_bonus": 70000,
            "housing_allowance": 9000000,
            "food_allowance": 14000000,
            "marital_status": "married",
            "spouse_allowance": 5000000,
            "children_count": 1,
            "phone_number": "09171234567",
            "bank_name": "بانک ملی ایران",
            "account_number": "0105678901004",
            "sheba_number": valid_sheba,
            "section": self.section.id,
            "project": self.project.id,
            "approval_status": "draft",
            "is_active": True,
        }

        resp1 = self.client.post("/api/personnel/profiles/", payload, format="json")
        self.assertEqual(resp1.status_code, 201)
        created_id = resp1.data["id"]
        self.assertEqual(resp1.data["approval_status"], "draft")

        # گام ۲: تایید مرحله اول توسط سرپرست ⬅️ ارسال به حسابداری
        self.client.force_authenticate(user=self.supervisor)
        resp2 = self.client.post(f"/api/personnel/profiles/{created_id}/approve-supervisor/", {}, format="json")
        self.assertEqual(resp2.status_code, 200)
        self.assertEqual(resp2.data["data"]["approval_status"], "pending_accountant")
        self.assertEqual(resp2.data["data"]["supervisor_approved_by"], self.supervisor.id)

        # گام ۳: تایید مرحله دوم (مالی) توسط حسابدار ⬅️ ارسال به مدیر شرکت
        self.client.force_authenticate(user=self.accountant)
        resp3 = self.client.post(f"/api/personnel/profiles/{created_id}/approve-finance/", {}, format="json")
        self.assertEqual(resp3.status_code, 200)
        self.assertEqual(resp3.data["data"]["approval_status"], "pending_manager")
        self.assertEqual(resp3.data["data"]["accountant_approved_by"], self.accountant.id)

        # گام ۴: تصویب نهایی مرحله سوم توسط مدیر شرکت ⬅️ فعال‌سازی قطعی
        self.client.force_authenticate(user=self.manager)
        resp3_mgr = self.client.post(f"/api/personnel/profiles/{created_id}/approve-manager/", {}, format="json")
        self.assertEqual(resp3_mgr.status_code, 200)
        self.assertEqual(resp3_mgr.data["data"]["approval_status"], "approved")
        self.assertEqual(resp3_mgr.data["data"]["manager_approved_by"], self.manager.id)
        self.assertTrue(resp3_mgr.data["data"]["is_active"])

        import jdatetime
        today_shamsi = jdatetime.date.today().strftime('%Y/%m/%d')

        # گام ۵: مشاهده در ماتریس کارکرد روزانه
        self.client.force_authenticate(user=self.operator)
        resp4 = self.client.get(f"/api/personnel/attendance/matrix/?section_id={self.section.id}&date_shamsi={today_shamsi}")
        self.assertEqual(resp4.status_code, 200)
        rows = resp4.data.get("rows", [])
        self.assertTrue(any(r["personnel_id"] == created_id for r in rows))

        # گام ۶: ثبت کارکرد روزانه
        payload_att = {
            "date_shamsi": today_shamsi,
            "project_id": self.project.id,
            "items": [
                {
                    "personnel_id": created_id,
                    "status": "PRESENT",
                    "effective_hours": 10.0,
                    "overtime_hours": 2.5,
                    "is_friday_work": False,
                    "is_mission": False,
                    "advance_payment": 0,
                    "notes": "کارکرد ثبت شده آزمایشی جهت تایید چرخه کامل",
                }
            ],
        }
        resp5 = self.client.post("/api/personnel/attendance/bulk-save/", payload_att, format="json")
        self.assertEqual(resp5.status_code, 200)
        self.assertEqual(resp5.data.get("saved_count"), 1)

        # گام ۷: بازیابی مجدد و تایید ذخیره شدن داده‌ها
        resp6 = self.client.get(f"/api/personnel/attendance/matrix/?section_id={self.section.id}&date_shamsi={today_shamsi}")
        self.assertEqual(resp6.status_code, 200)
        target_row = next(r for r in resp6.data.get("rows", []) if r["personnel_id"] == created_id)
        self.assertEqual(target_row["status"], "PRESENT")
        self.assertEqual(target_row["effective_hours"], 10.0)
        self.assertEqual(target_row["overtime_hours"], 2.5)

    def test_supervisor_can_request_revision_and_reject(self):
        # ایجاد پرسنل پیش‌نویس
        profile = PersonnelProfile.objects.create(
            first_name="تستی",
            last_name="عودتی",
            national_code="2280001112",
            section=self.section,
            approval_status="draft",
            is_active=True
        )

        # عودت توسط سرپرست
        self.client.force_authenticate(user=self.supervisor)
        resp_rev = self.client.post(f"/api/personnel/profiles/{profile.id}/request-revision/", {"reason": "نقص مدارک شناسایی"}, format="json")
        self.assertEqual(resp_rev.status_code, 200)
        self.assertEqual(resp_rev.data["data"]["approval_status"], "revision_required")
        self.assertEqual(resp_rev.data["data"]["rejection_reason"], "نقص مدارک شناسایی")

        # رد پرونده توسط سرپرست
        resp_rej = self.client.post(f"/api/personnel/profiles/{profile.id}/reject/", {"reason": "عدم تطابق با شرایط کارگاه"}, format="json")
        self.assertEqual(resp_rej.status_code, 200)
        self.assertEqual(resp_rej.data["data"]["approval_status"], "rejected")

    def test_job_titles_and_draft_revision_cycle(self):
        # تست ۱: دریافت عناوین شغلی
        self.client.force_authenticate(user=self.operator)
        resp_titles = self.client.get("/api/personnel/profiles/job-titles/")
        self.assertEqual(resp_titles.status_code, 200)
        self.assertIn("job_titles", resp_titles.data)
        self.assertIn("کارگر ساده انبار", resp_titles.data["job_titles"])

        # تست ۲: ثبت پرسنل با ارسال مستقیم به سرپرست
        payload = {
            "first_name": "احمد",
            "last_name": "نادری",
            "national_code": "2289988776",
            "job_title": "اپراتور لیفتراک",
            "contract_type": "daily",
            "daily_base_wage": 3500000,
            "section": self.section.id,
            "approval_status": "pending_supervisor"
        }
        resp_create = self.client.post("/api/personnel/profiles/", payload, format="json")
        self.assertEqual(resp_create.status_code, 201)
        created = resp_create.data
        self.assertEqual(created["approval_status"], "pending_supervisor")
        # بررسی انتساب خودکار پروژه
        self.assertEqual(created["project"], self.project.id)

        # تست ۳: فیلتر چندتایی وضعیت تایید (Comma-separated)
        resp_filter = self.client.get("/api/personnel/profiles/?approval_status=draft,pending_supervisor")
        self.assertEqual(resp_filter.status_code, 200)
        ids = [p["id"] for p in resp_filter.data]
        self.assertIn(created["id"], ids)

        # تست ۴: عودت توسط سرپرست
        self.client.force_authenticate(user=self.supervisor)
        self.client.post(f"/api/personnel/profiles/{created['id']}/request-revision/", {"reason": "لطفاً شماره تماس را وارد کنید"}, format="json")

        # تست ۵: ویرایش توسط اپراتور و ارسال مجدد به سرپرست
        self.client.force_authenticate(user=self.operator)
        resp_update = self.client.patch(
            f"/api/personnel/profiles/{created['id']}/",
            {"phone_number": "09171112233", "approval_status": "pending_supervisor"},
            format="json"
        )
        self.assertEqual(resp_update.status_code, 200)
        self.assertEqual(resp_update.data["approval_status"], "pending_supervisor")
        self.assertIsNone(resp_update.data["rejection_reason"])

    def test_approved_personnel_change_request_lifecycle(self):
        # ایجاد پرسنل مصوب نهایی
        profile = PersonnelProfile.objects.create(
            first_name="محسن",
            last_name="رضایی",
            national_code="2281234567",
            job_title="کارشناس انبار",
            daily_base_wage=3000000,
            section=self.section,
            project=self.project,
            approval_status="approved",
            is_active=True
        )

        # گام ۱: کارمند تغییراتی روی پرسنل مصوب اعمال می‌کند
        self.client.force_authenticate(user=self.operator)
        resp_edit = self.client.patch(
            f"/api/personnel/profiles/{profile.id}/",
            {"daily_base_wage": 4500000, "job_title": "سرپرست انبار"},
            format="json"
        )
        # باید وضعیت 202 بازگردد، پرونده اصلی تغییر نکند، و فلگ has_pending_changes فعال شود
        self.assertEqual(resp_edit.status_code, 202)
        cr_id = resp_edit.data["change_request_id"]
        profile.refresh_from_db()
        self.assertTrue(profile.has_pending_changes)
        self.assertEqual(profile.daily_base_wage, 3000000)

        # گام ۲: بررسی درخواست در کارتابل تغییرات
        from personnel.models import PersonnelChangeRequest
        cr = PersonnelChangeRequest.objects.get(pk=cr_id)
        self.assertEqual(cr.status, "pending_supervisor")

        # گام ۳: تایید مرحله اول تغییرات توسط سرپرست ⬅️ ارسال به حسابداری
        self.client.force_authenticate(user=self.supervisor)
        resp_sup = self.client.post(f"/api/personnel/personnel-change-requests/{cr_id}/approve-supervisor/", {}, format="json")
        self.assertEqual(resp_sup.status_code, 200)
        cr.refresh_from_db()
        self.assertEqual(cr.status, "pending_accountant")

        # گام ۴: تایید مرحله دوم (مالی) تغییرات توسط حسابدار ⬅️ ارسال به مدیر
        self.client.force_authenticate(user=self.accountant)
        resp_fin = self.client.post(f"/api/personnel/personnel-change-requests/{cr_id}/approve-finance/", {}, format="json")
        self.assertEqual(resp_fin.status_code, 200)
        cr.refresh_from_db()
        self.assertEqual(cr.status, "pending_manager")

        # گام ۵: تصویب نهایی تغییرات توسط مدیر شرکت ⬅️ اعمال تفاوت‌ها روی پرونده اصلی
        self.client.force_authenticate(user=self.manager)
        resp_mgr = self.client.post(f"/api/personnel/personnel-change-requests/{cr_id}/approve-manager/", {}, format="json")
        self.assertEqual(resp_mgr.status_code, 200)
        cr.refresh_from_db()
        self.assertEqual(cr.status, "approved")

        # بررسی اعمال شدن قطعی تغییرات روی پرونده اصلی
        profile.refresh_from_db()
        self.assertFalse(profile.has_pending_changes)
        self.assertEqual(profile.daily_base_wage, 4500000)
        self.assertEqual(profile.job_title, "سرپرست انبار")

    def test_change_request_rejection_clears_flag(self):
        profile = PersonnelProfile.objects.create(
            first_name="حمید",
            last_name="عباسی",
            national_code="2287654321",
            job_title="راننده لیفتراک",
            daily_base_wage=3200000,
            section=self.section,
            project=self.project,
            approval_status="approved",
            is_active=True
        )

        # کارمند درخواست ویرایش ثبت می‌کند
        self.client.force_authenticate(user=self.operator)
        resp_edit = self.client.patch(
            f"/api/personnel/profiles/{profile.id}/",
            {"daily_base_wage": 5000000},
            format="json"
        )
        self.assertEqual(resp_edit.status_code, 202)
        cr_id = resp_edit.data["change_request_id"]
        profile.refresh_from_db()
        self.assertTrue(profile.has_pending_changes)

        # سرپرست درخواست را رد می‌کند
        self.client.force_authenticate(user=self.supervisor)
        resp_rej = self.client.post(
            f"/api/personnel/personnel-change-requests/{cr_id}/reject/",
            {"reason": "مبلغ پیشنهادی خارج از چارچوب حقوقی کارگاه است"},
            format="json"
        )
        self.assertEqual(resp_rej.status_code, 200)

        # بررسی پاکسازی فلگ و عدم تغییر پرونده اصلی
        profile.refresh_from_db()
        self.assertFalse(profile.has_pending_changes)
        self.assertEqual(profile.daily_base_wage, 3200000)

    def test_complete_vehicle_lifecycle_and_change_request(self):
        from personnel.models import VehicleDriverProfile, VehicleChangeRequest
        # ۱. ثبت خودرو توسط کارمند
        self.client.force_authenticate(user=self.operator)
        v_payload = {
            "plate_number": "12ب345-67",
            "driver_name": "علی اکبری",
            "driver_national_code": "2280009988",
            "driver_phone": "09173334455",
            "vehicle_type": "pickup",
            "default_service_rate": 1800000,
            "section": self.section.id,
            "approval_status": "draft"
        }
        resp_v1 = self.client.post("/api/personnel/vehicles/", v_payload, format="json")
        self.assertEqual(resp_v1.status_code, 201)
        v_id = resp_v1.data["id"]
        self.assertEqual(resp_v1.data["approval_status"], "draft")

        # ۲. تایید سرپرست ناوگان ⬅️ ارسال به حسابداری
        self.client.force_authenticate(user=self.supervisor)
        resp_v2 = self.client.post(f"/api/personnel/vehicles/{v_id}/approve-supervisor/", {}, format="json")
        self.assertEqual(resp_v2.status_code, 200)
        self.assertEqual(resp_v2.data["data"]["approval_status"], "pending_accountant")

        # ۳. تایید مالی ناوگان ⬅️ ارسال به مدیر
        self.client.force_authenticate(user=self.accountant)
        resp_v3 = self.client.post(f"/api/personnel/vehicles/{v_id}/approve-finance/", {}, format="json")
        self.assertEqual(resp_v3.status_code, 200)
        self.assertEqual(resp_v3.data["data"]["approval_status"], "pending_manager")

        # ۴. تصویب نهایی مدیر ناوگان ⬅️ فعال‌سازی
        self.client.force_authenticate(user=self.manager)
        resp_v4 = self.client.post(f"/api/personnel/vehicles/{v_id}/approve-manager/", {}, format="json")
        self.assertEqual(resp_v4.status_code, 200)
        self.assertEqual(resp_v4.data["data"]["approval_status"], "approved")
        self.assertTrue(resp_v4.data["data"]["is_active"])

        # ۵. درخواست تغییرات توسط کارمند روی خودرو مصوب
        self.client.force_authenticate(user=self.operator)
        resp_v_edit = self.client.patch(
            f"/api/personnel/vehicles/{v_id}/",
            {"default_service_rate": 2200000, "driver_phone": "09179998877"},
            format="json"
        )
        self.assertEqual(resp_v_edit.status_code, 202)
        v_cr_id = resp_v_edit.data["change_request_id"]
        v_obj = VehicleDriverProfile.objects.get(pk=v_id)
        self.assertTrue(v_obj.has_pending_changes)
        self.assertEqual(float(v_obj.default_service_rate), 1800000.0)

        # ۶. تایید تغییرات خودرو توسط سرپرست
        self.client.force_authenticate(user=self.supervisor)
        resp_v_sup = self.client.post(f"/api/personnel/vehicle-change-requests/{v_cr_id}/approve-supervisor/", {}, format="json")
        self.assertEqual(resp_v_sup.status_code, 200)

        # ۷. تایید مالی تغییرات خودرو توسط حسابدار
        self.client.force_authenticate(user=self.accountant)
        resp_v_fin = self.client.post(f"/api/personnel/vehicle-change-requests/{v_cr_id}/approve-finance/", {}, format="json")
        self.assertEqual(resp_v_fin.status_code, 200)

        # ۸. تصویب نهایی تغییرات خودرو توسط مدیر شرکت
        self.client.force_authenticate(user=self.manager)
        resp_v_mgr = self.client.post(f"/api/personnel/vehicle-change-requests/{v_cr_id}/approve-manager/", {}, format="json")
        self.assertEqual(resp_v_mgr.status_code, 200)

        # بررسی اعمال شدن روی رکورد ناوگان
        v_obj.refresh_from_db()
        self.assertFalse(v_obj.has_pending_changes)
        self.assertEqual(float(v_obj.default_service_rate), 2200000.0)
        self.assertEqual(v_obj.driver_phone, "09179998877")

    def test_personnel_destroy_lifecycle_and_cascade_prevention(self):
        # سناریو ۱: اپراتور می‌تواند پرونده پیش‌نویس فاقد کارکرد را کاملاً حذف فیزیکی کند
        p_draft = PersonnelProfile.objects.create(
            first_name="پیش‌نویس",
            last_name="حذفی",
            national_code="2280009999",
            section=self.section,
            approval_status="draft",
            is_active=True
        )
        self.client.force_authenticate(user=self.operator)
        res_del_draft = self.client.delete(f"/api/personnel/profiles/{p_draft.id}/")
        self.assertEqual(res_del_draft.status_code, 200)
        self.assertFalse(PersonnelProfile.objects.filter(id=p_draft.id).exists())

        # سناریو ۲: اپراتور عادی نمی‌تواند پرونده مصوب را حذف کند
        p_approved = PersonnelProfile.objects.create(
            first_name="مصوب",
            last_name="غیرقابل‌حذف",
            national_code="2280008888",
            section=self.section,
            approval_status="approved",
            is_active=True
        )
        res_del_appr = self.client.delete(f"/api/personnel/profiles/{p_approved.id}/")
        self.assertEqual(res_del_appr.status_code, 400)
        self.assertTrue(PersonnelProfile.objects.filter(id=p_approved.id).exists())

        # سناریو ۳: پرونده دارای کارکرد (حتی سافت‌دیلیت شده) فیزیکی حذف نمی‌شود بلکه غیرفعال نرم می‌شود
        p_with_att = PersonnelProfile.objects.create(
            first_name="دارای",
            last_name="کارکرد",
            national_code="2280007777",
            section=self.section,
            approval_status="draft",
            is_active=True
        )
        DailyAttendance.objects.create(
            personnel=p_with_att,
            project=self.project,
            section=self.section,
            date_shamsi="1405/01/01",
            is_deleted=True  # حتی سابقه سافت‌دیلیت شده نباید فیزیکاً Cascade Delete شود
        )
        res_del_att = self.client.delete(f"/api/personnel/profiles/{p_with_att.id}/")
        self.assertEqual(res_del_att.status_code, 200)
        p_with_att.refresh_from_db()
        self.assertFalse(p_with_att.is_active)  # سافت غیرفعال شده
        self.assertTrue(PersonnelProfile.objects.filter(id=p_with_att.id).exists())  # فیزیکی حذف نشده
        self.assertTrue(DailyAttendance.objects.filter(personnel=p_with_att).exists())  # سوابق کارکرد حفظ شده




