# -*- coding: utf-8 -*-
"""
Comprehensive Monthly Payroll Calculation Engine.
Calculates all 58 columns matching sheet `تیر` and `Settings` in company Excel blueprint (`حقوق تیر ماه انبارداری.xlsm`).
Includes dynamic insurance days optimization and parametric surplus allocation.
"""
from decimal import Decimal, ROUND_HALF_UP
from django.db import transaction
from django.db.models import Q
from .models import (
    MonthlyWorkPeriod,
    MonthlyPayrollRecord,
    PersonnelProfile,
    PayrollYearlySettings,
    JobGradeTier,
    DailyAttendance
)


class PayrollCalculationEngine:
    """
    موتور جامع محاسبات حقوق، دستمزد و مالیات بر اساس الگوریتم مرجع شرکت
    """

    def __init__(self, period: MonthlyWorkPeriod = None):
        self.period = period

    def calculate_single_employee(
        self,
        personnel: PersonnelProfile,
        period: MonthlyWorkPeriod,
        settings: PayrollYearlySettings,
        job_grades: dict,
        month_days: int,
        existing_record: MonthlyPayrollRecord = None
    ) -> dict:
        """
        محاسبه تمام ۵۸ ستون برای یک پرسنل بر اساس قوانین و فرمول‌های اکسل
        """
        p = personnel
        # ── 1. Job Grade & Base Wage ──────────────────────────────
        grade_key = str(p.job_grade or '19').strip()
        if grade_key in job_grades:
            daily_wage, daily_seniority = job_grades[grade_key]
        else:
            daily_wage = p.daily_base_wage or Decimal(0)
            daily_seniority = p.daily_seniority_bonus or Decimal(0)

        years_exp = p.base_years_experience or 0
        base_daily_rate = daily_wage + (years_exp * daily_seniority)
        contract_hours = Decimal(p.contract_hours or 230)
        contract_salary = Decimal(p.contract_base_salary or 0)

        # ── 2. Attendance Aggregation ─────────────────────────────
        attendances = DailyAttendance.objects.filter(
            personnel=p,
            date_shamsi__startswith=period.year_month,
            is_deleted=False
        )

        if attendances.exists():
            worked_hours = sum(Decimal(a.effective_hours or 0) for a in attendances)
            manual_overtime_hours = sum(Decimal(a.overtime_hours or 0) for a in attendances)
            friday_work_days = sum(1 for a in attendances if a.is_friday_work or a.status == 'FRIDAY_WORK')
            mission_days = sum(1 for a in attendances if a.is_mission or a.status == 'MISSION')
            adv_deduction = sum(Decimal(a.advance_payment or 0) for a in attendances)
            raw_att_days = min(len(attendances), month_days)
        else:
            # Default standard full attendance
            worked_hours = contract_hours
            manual_overtime_hours = Decimal(0)
            friday_work_days = Decimal(0)
            mission_days = Decimal(0)
            adv_deduction = Decimal(0)
            raw_att_days = month_days

        # ── 3. Gross Salary (حقوق ناخالص) ───────────────────────────
        # Formula: ROUND((ساعت کارکرد / کارکرد قرارداد شده) * حقوق قرارداد شده, 0)
        if contract_hours > 0 and contract_salary > 0:
            gross_salary = Decimal(round((worked_hours / contract_hours) * contract_salary))
        else:
            gross_salary = Decimal(round(base_daily_rate * raw_att_days))

        # Allowances constants from settings
        monthly_food = Decimal(settings.monthly_food_allowance if settings else 22000000)
        monthly_housing = Decimal(settings.monthly_housing_allowance if settings else 30000000)
        monthly_spouse = Decimal(settings.monthly_spouse_allowance if settings else 5000000)
        monthly_child = Decimal(settings.monthly_child_allowance if settings else 16625549)
        travel_cost_day = Decimal(settings.travel_cost_per_day if settings else 8736600)
        transport_fixed = Decimal(settings.transport_fixed_amount if settings else 2388728)
        transport_help_pct = Decimal(settings.transport_help_percent if settings else 0)
        attraction_pct = Decimal(settings.specialist_attraction_percent if settings else 0)
        bad_weather_pct = Decimal(settings.bad_weather_percent if settings else 0)
        remote_hardship_pct = Decimal(settings.remote_hardship_percent if settings else 0)
        south_pars_pct = Decimal(settings.south_pars_percent if settings else 0)
        surplus_overtime_pct = (Decimal(settings.surplus_overtime_percent if settings else 50.00) / Decimal(100.0))

        is_married = p.marital_status == 'married'
        children_count = p.children_count or 0

        # ── 4. Smart Insurance Days Optimization ─────────────────
        # سیستم بررسی می‌کند که آیا حقوق ناخالص کفاف حداقل دستمزد و مزایای قانونی کل ماه را می‌دهد یا خیر
        def compute_statutory_base(days: int):
            d_ratio = Decimal(days) / Decimal(month_days)
            b_sal = Decimal(round(Decimal(days) * base_daily_rate))
            f_all = Decimal(round(monthly_food * d_ratio))
            h_all = Decimal(round(monthly_housing * d_ratio))
            m_all = Decimal(round(monthly_spouse * d_ratio)) if is_married else Decimal(0)
            c_all = Decimal(round(Decimal(children_count) * monthly_child * d_ratio))
            t_all = Decimal(round(transport_fixed * Decimal(days) * transport_help_pct))
            mkt_all = Decimal(round(attraction_pct * daily_wage * Decimal(days)))
            bw_all = Decimal(round(bad_weather_pct * daily_wage * Decimal(days)))
            rh_all = Decimal(round(remote_hardship_pct * daily_wage * Decimal(days)))
            sp_all = Decimal(round(south_pars_pct * daily_wage * Decimal(days)))
            bon_all = Decimal(round(Decimal(5) * base_daily_rate * d_ratio))
            
            s_base_weather = bw_all + rh_all + sp_all + b_sal
            sen_all = Decimal(round((Decimal('2.5') * s_base_weather) / Decimal(month_days)))
            
            if days > 0 and friday_work_days > 0:
                fri_all = Decimal(round(((Decimal('0.4') * s_base_weather) / Decimal(days)) * Decimal(friday_work_days)))
            else:
                fri_all = Decimal(0)
                
            total_stat = b_sal + f_all + h_all + m_all + c_all + t_all + mkt_all + bw_all + rh_all + sp_all + bon_all + sen_all + fri_all
            return {
                'days': days,
                'days_ratio': d_ratio,
                'base_salary': b_sal,
                'food_allowance': f_all,
                'housing_allowance': h_all,
                'marital_allowance': m_all,
                'child_allowance': c_all,
                'transport_allowance': t_all,
                'market_attraction_allowance': mkt_all,
                'bad_weather_allowance': bw_all,
                'remote_hardship_allowance': rh_all,
                'south_pars_allowance': sp_all,
                'bonus_amount': bon_all,
                'seniority_allowance': sen_all,
                'friday_work_amount': fri_all,
                'total_statutory': total_stat
            }

        # Determine optimal insurance days
        best_days = raw_att_days
        stat_eval = compute_statutory_base(best_days)
        if gross_salary < stat_eval['total_statutory'] and raw_att_days > 1:
            for test_d in range(raw_att_days, 0, -1):
                stat_eval = compute_statutory_base(test_d)
                if gross_salary >= stat_eval['total_statutory']:
                    best_days = test_d
                    break
            else:
                best_days = 1
                stat_eval = compute_statutory_base(1)

        insurance_days = best_days
        base_salary = stat_eval['base_salary']
        food_allowance = stat_eval['food_allowance']
        housing_allowance = stat_eval['housing_allowance']
        marital_allowance = stat_eval['marital_allowance']
        child_allowance = stat_eval['child_allowance']
        transport_allowance = stat_eval['transport_allowance']
        market_attraction_allowance = stat_eval['market_attraction_allowance']
        bad_weather_allowance = stat_eval['bad_weather_allowance']
        remote_hardship_allowance = stat_eval['remote_hardship_allowance']
        south_pars_allowance = stat_eval['south_pars_allowance']
        bonus_amount = stat_eval['bonus_amount']
        seniority_allowance = stat_eval['seniority_allowance']
        friday_work_amount = stat_eval['friday_work_amount']
        leave_amount = Decimal(0)
        other_allowances = Decimal(0)

        # ── 5. Surplus Allocation (تسهیم مازاد) ─────────────────────
        # مازاد = حقوق ناخالص - جمع اقلام قانونی شناخته‌شده
        statutory_sum = stat_eval['total_statutory']
        surplus = gross_salary - statutory_sum

        if surplus > 0:
            surplus_overtime = Decimal(round(surplus * surplus_overtime_pct))
            surplus_travel_mission = surplus - surplus_overtime
            overtime_amount = surplus_overtime

            hourly_rate = base_daily_rate / Decimal(10)
            if hourly_rate > 0:
                overtime_hours = Decimal(round(overtime_amount / (hourly_rate * Decimal('1.4')), 2))
            else:
                overtime_hours = manual_overtime_hours

            # Distribute remainder between Travel and Mission weighted by daily travel cost & base wage
            travel_weight = travel_cost_day
            mission_weight = base_daily_rate
            total_weight = travel_weight + mission_weight

            if total_weight > 0 and surplus_travel_mission > 0:
                travel_cost_amount = Decimal(round(surplus_travel_mission * (travel_weight / total_weight)))
                mission_amount = surplus_travel_mission - travel_cost_amount
            else:
                travel_cost_amount = Decimal(0)
                mission_amount = Decimal(0)
        else:
            overtime_amount = Decimal(0)
            overtime_hours = manual_overtime_hours
            travel_cost_amount = Decimal(0)
            mission_amount = Decimal(0)

        # ── 6. Subtotals & Tax/Insurance Calculations ──────────────
        total_taxable_allowances = Decimal(round(
            other_allowances + overtime_amount + marital_allowance + housing_allowance +
            food_allowance + transport_allowance + market_attraction_allowance +
            bad_weather_allowance + remote_hardship_allowance + south_pars_allowance + friday_work_amount
        ))

        total_non_continuous_taxable_allowances = Decimal(round(other_allowances + overtime_amount + friday_work_amount))
        
        continuous_taxable_allowances = Decimal(round(
            child_allowance + marital_allowance + housing_allowance + food_allowance +
            transport_allowance + market_attraction_allowance + bad_weather_allowance +
            remote_hardship_allowance + south_pars_allowance
        ))

        total_non_taxable_allowances = Decimal(round(
            mission_amount + travel_cost_amount + leave_amount + bonus_amount + seniority_allowance + child_allowance
        ))

        total_seniority_accumulated = Decimal(round(Decimal(insurance_days) * daily_seniority * Decimal(years_exp)))

        # Insurance calculations (7% worker, 20% employer, 3% unemployment)
        if p.include_in_insurance:
            total_insurable_salary_allowances = base_salary + total_taxable_allowances
        else:
            total_insurable_salary_allowances = Decimal(0)

        w_rate = (settings.worker_insurance_rate if settings else Decimal('7.00')) / Decimal(100.0)
        e_rate = (settings.employer_insurance_rate if settings else Decimal('20.00')) / Decimal(100.0)
        u_rate = (settings.unemployment_insurance_rate if settings else Decimal('3.00')) / Decimal(100.0)

        worker_insurance = Decimal(round(total_insurable_salary_allowances * w_rate))
        employer_insurance = Decimal(round(total_insurable_salary_allowances * e_rate))
        unemployment_insurance = Decimal(round(total_insurable_salary_allowances * u_rate))
        total_insurance = worker_insurance + employer_insurance + unemployment_insurance

        continuous_taxable_salary_allowances = base_salary + continuous_taxable_allowances

        # ── 7. Income Tax Logic (حفظ مقدار ایمپورت‌شده یا محاسبه هوشمند) ────
        tax_source_type = 'MANUAL'
        tax_exemption_months = 1
        has_multiple_employers = False
        is_tax_imported = False

        if existing_record and existing_record.is_tax_imported:
            # Preserve uploaded/imported tax from Tax Excel file
            income_tax = existing_record.income_tax
            tax_source_type = existing_record.tax_source_type or 'IMPORTED_EXCEL'
            tax_exemption_months = existing_record.tax_exemption_months or 1
            has_multiple_employers = existing_record.has_multiple_employers
            is_tax_imported = True
        elif p.include_in_tax:
            # Progressive tax brackets (ماده ۸۴ قانون مالیات‌های مستقیم)
            # Exemption limit e.g. 140,000,000 Rials / month
            taxable_base = continuous_taxable_salary_allowances + overtime_amount
            exemption_limit = Decimal(140000000)
            if taxable_base > exemption_limit:
                income_tax = Decimal(round((taxable_base - exemption_limit) * Decimal('0.10')))
            else:
                income_tax = Decimal(0)
            tax_source_type = 'CALCULATED_BRACKET'
        else:
            income_tax = Decimal(0)

        total_deductions = worker_insurance
        net_salary = gross_salary - worker_insurance - income_tax
        payable_amount = net_salary - adv_deduction

        # ── 8. Tax Discrepancy Check (چک مالیات - ستون ۵۸) ───────────
        # Formula: (ستون ۵۱ + ستون ۲۸ + ستون ۲۷ + ستون ۲۹ + ستون ۲۴ + ستون ۲۶ + ستون ۴۰ + ستون ۲۵) - ستون ۵۳
        sum_tax_check = (
            continuous_taxable_salary_allowances + mission_amount + travel_cost_amount +
            bonus_amount + other_allowances + overtime_amount + seniority_allowance + friday_work_amount
        )
        tax_check_discrepancy = sum_tax_check - gross_salary

        return {
            'status_category': p.status_category or 'نفرات شرکتی',
            'include_in_tax': p.include_in_tax,
            'include_in_insurance': p.include_in_insurance,
            'include_in_bank': p.include_in_bank,
            'national_code': p.national_code,
            'full_name': p.full_name,
            'marital_status': 'متاهل' if is_married else 'مجرد',
            'children_count': children_count,
            'contract_hours': contract_hours,
            'contract_salary': contract_salary,
            'job_grade': grade_key,
            'daily_wage': daily_wage,
            'daily_seniority': daily_seniority,
            'years_of_service': years_exp,
            'base_daily_rate': base_daily_rate,
            'worked_hours': worked_hours,
            'insurance_days': insurance_days,
            'overtime_hours': overtime_hours,
            'friday_work_days': friday_work_days,
            'mission_days': mission_days,
            'income_tax': income_tax,
            'tax_source_type': tax_source_type,
            'tax_exemption_months': tax_exemption_months,
            'has_multiple_employers': has_multiple_employers,
            'is_tax_imported': is_tax_imported,
            'advance_payment_deduction': adv_deduction,
            'other_allowances': other_allowances,
            'friday_work_amount': friday_work_amount,
            'overtime_amount': overtime_amount,
            'travel_cost_amount': travel_cost_amount,
            'mission_amount': mission_amount,
            'bonus_amount': bonus_amount,
            'leave_amount': leave_amount,
            'food_allowance': food_allowance,
            'housing_allowance': housing_allowance,
            'marital_allowance': marital_allowance,
            'transport_allowance': transport_allowance,
            'market_attraction_allowance': market_attraction_allowance,
            'bad_weather_allowance': bad_weather_allowance,
            'remote_hardship_allowance': remote_hardship_allowance,
            'south_pars_allowance': south_pars_allowance,
            'child_allowance': child_allowance,
            'seniority_allowance': seniority_allowance,
            'total_taxable_allowances': total_taxable_allowances,
            'total_non_continuous_taxable_allowances': total_non_continuous_taxable_allowances,
            'continuous_taxable_allowances': continuous_taxable_allowances,
            'total_non_taxable_allowances': total_non_taxable_allowances,
            'total_seniority_accumulated': total_seniority_accumulated,
            'worker_insurance': worker_insurance,
            'employer_insurance': employer_insurance,
            'unemployment_insurance': unemployment_insurance,
            'total_insurance': total_insurance,
            'base_salary': base_salary,
            'continuous_taxable_salary_allowances': continuous_taxable_salary_allowances,
            'total_insurable_salary_allowances': total_insurable_salary_allowances,
            'gross_salary': gross_salary,
            'total_deductions': total_deductions,
            'net_salary': net_salary,
            'bank_account_number': p.account_number or p.sheba_number or '',
            'payable_amount': payable_amount,
            'tax_check_discrepancy': tax_check_discrepancy,
        }

    def calculate_period(self, period: MonthlyWorkPeriod, user=None) -> list:
        """
        محاسبه کلیه رکوردهای حقوق برای کل پرسنل یک دوره ماهانه
        """
        year_str = period.year_month.split('/')[0] if '/' in period.year_month else '1405'
        month_str = period.year_month.split('/')[1] if '/' in period.year_month else '04'
        month_num = int(month_str)
        month_days = 31 if month_num <= 6 else (30 if month_num <= 11 else 29)

        settings = PayrollYearlySettings.objects.filter(fiscal_year=year_str).first()
        if not settings:
            settings = PayrollYearlySettings.objects.filter(is_active=True).first()

        job_grades = {}
        if settings:
            for jg in settings.job_grades.all():
                job_grades[str(jg.grade_number)] = (jg.daily_base_wage, jg.daily_seniority_bonus)

        # پرسنل فعال یا پرسنلی که در این دوره کارکرد ثبت‌شده دارند
        personnel_qs = PersonnelProfile.objects.filter(
            Q(is_active=True) | Q(daily_attendances__date_shamsi__startswith=period.year_month, daily_attendances__is_deleted=False)
        ).distinct().order_by('last_name', 'first_name')
        if period.warehouse:
            wh_personnel = personnel_qs.filter(
                Q(assigned_warehouse=period.warehouse) | Q(daily_attendances__warehouse=period.warehouse, daily_attendances__date_shamsi__startswith=period.year_month)
            ).distinct()
            if wh_personnel.exists():
                personnel_qs = wh_personnel

        created_records = []

        with transaction.atomic():
            row_idx = 1
            for p in personnel_qs:
                existing = MonthlyPayrollRecord.objects.filter(period=period, personnel=p).first()
                if existing and existing.is_manually_overridden:
                    created_records.append(existing)
                    row_idx += 1
                    continue

                calc_data = self.calculate_single_employee(
                    personnel=p,
                    period=period,
                    settings=settings,
                    job_grades=job_grades,
                    month_days=month_days,
                    existing_record=existing
                )

                calc_data['row_number'] = row_idx
                calc_data['is_manually_overridden'] = False

                record, _ = MonthlyPayrollRecord.objects.update_or_create(
                    period=period,
                    personnel=p,
                    defaults=calc_data
                )
                created_records.append(record)
                row_idx += 1

        return created_records


def calculate_monthly_payroll_for_period(period: MonthlyWorkPeriod, user=None) -> list:
    """
    تابع واسط جهت حفظ سازگاری و فراخوانی از ویوها و تسک‌ها
    """
    engine = PayrollCalculationEngine(period=period)
    return engine.calculate_period(period, user=user)
