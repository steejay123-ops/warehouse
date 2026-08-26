export interface PersonnelProfile {
  id?: number;
  user?: number | null;
  user_username?: string;
  
  // ۱. هویتی و شناسنامه‌ای
  first_name: string;
  last_name: string;
  full_name?: string;
  national_code: string;
  father_name?: string;
  id_number?: string;
  id_series?: string;
  id_serial?: string;
  birth_date?: string;
  birth_place?: string;
  issue_place?: string;
  issue_date?: string;
  gender?: string;
  nationality_code?: string;
  citizenship_country_code?: string;
  residence_country_code?: string;
  education_level?: string;
  marital_status: 'single' | 'married';
  children_count: number;

  // ۲. بیمه و مالیات
  insurance_number?: string;
  insurance_type?: string;
  insurance_name?: string;
  exemption_type?: string;
  job_category?: string;
  job_code?: string;
  job_title: string;
  employment_type?: string;
  status_category?: string;
  group_status?: string;
  include_in_insurance?: boolean;
  include_in_tax?: boolean;
  include_in_bank?: boolean;

  // فیلدهای تنظیمی جدول WHFildeTable و راهنمای رسمی مالیات دارایی (نسخه 1.7.0.4)
  tax_payment_type?: string;
  tax_service_location?: string;
  tax_exceptions?: string;
  tax_currency_type?: string;
  tax_currency_exchange_rate?: number;
  tax_housing_benefit_type?: string;
  tax_vehicle_benefit_type?: string;

  // ۳. قرارداد، دستمزد پایه و سنوات
  contract_type: 'daily' | 'hourly' | 'monthly';
  start_date?: string;
  end_date?: string;
  retirement_date?: string;
  contract_hours?: number;
  contract_base_salary?: number;
  job_grade?: string;
  daily_base_wage: number;
  daily_seniority_bonus?: number;
  base_daily_rate?: number;
  effective_daily_rate?: number;
  hourly_rate?: number;
  base_years_experience?: number;
  personnel_id_code?: string;

  // ۴. مزایای مستمر و فوق‌العاده‌ها
  housing_allowance?: number;
  food_allowance?: number;
  spouse_allowance?: number;
  weather_bonus?: number;
  asaluyeh_parsian_bonus?: number;
  remote_hardship_bonus?: number;
  market_attraction_bonus?: number;
  transport_allowance?: number;

  // ۵. حساب بانکی و نشانی
  bank_name?: string;
  account_number?: string;
  sheba_number?: string;
  card_number?: string;
  phone_number?: string;
  postal_code?: string;
  address?: string;

  assigned_warehouse?: number | null;
  assigned_warehouse_name?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface VehicleDriverProfile {
  id?: number;
  user?: number | null;
  user_username?: string;
  plate_number: string;
  vehicle_type: 'pickup' | 'nissan' | 'khavar' | 'sedan' | 'truck' | 'trailer' | 'other';
  vehicle_type_display?: string;
  ownership_type?: 'contract' | 'company' | 'personal';
  ownership_type_display?: string;
  driver_name: string;
  driver_national_code?: string;
  driver_phone?: string;
  default_service_rate: number;
  bank_name?: string;
  account_number?: string;
  sheba_number?: string;
  assigned_warehouse?: number | null;
  assigned_warehouse_name?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ImportPersonnelExcelResponse {
  message: string;
  created_count: number;
  updated_count: number;
  errors?: string[];
}

export interface AttendanceMatrixRow {
  personnel_id: number;
  full_name: string;
  national_code: string;
  job_title: string;
  attendance_id?: number | null;
  status: 'PRESENT_10H' | 'HALF_5H' | 'ABSENT' | 'LEAVE' | 'MISSION' | 'FRIDAY_WORK' | 'CUSTOM';
  effective_hours: number;
  overtime_hours: number;
  is_friday_work: boolean;
  is_mission: boolean;
  advance_payment: number;
  notes: string;
  is_existing: boolean;
}

export interface AttendanceMatrixResponse {
  warehouse_id: number;
  date_shamsi: string;
  year_month: string;
  is_locked: boolean;
  period_status: string;
  rows: AttendanceMatrixRow[];
}

export interface VehicleMatrixRow {
  vehicle_id: number;
  driver_name: string;
  plate_number: string;
  vehicle_type_display: string;
  default_rate: number;
  trip_id?: number | null;
  trip_count: number;
  unit_rate: number;
  total_amount: number;
  dispatch_reference: string;
  origin_destination: string;
  notes: string;
  is_existing: boolean;
}

export interface VehicleMatrixResponse {
  warehouse_id: number;
  date_shamsi: string;
  rows: VehicleMatrixRow[];
}

export interface AttendanceSummaryRow {
  personnel_id: number;
  full_name: string;
  national_code: string;
  job_title: string;
  contract_type: string;
  daily_base_wage: number;
  total_hours: number;
  equivalent_days: number;
  present_days: number;
  total_overtime_hours: number;
  friday_days: number;
  mission_days: number;
  absent_days: number;
  leave_days: number;
  total_advances: number;
  gross_base_pay: number;
  overtime_pay: number;
  estimated_total_pay: number;
}

export interface VehicleSummaryRow {
  vehicle_id: number;
  driver_name: string;
  plate_number: string;
  vehicle_type: string;
  default_rate: number;
  sheba_number: string;
  active_days: number;
  total_trips: number;
  total_payable: number;
}

export interface MonthlyWorkPeriod {
  id: number;
  warehouse: number;
  warehouse_name?: string;
  year_month: string;
  status: 'OPEN' | 'LOCKED' | 'FINALIZED';
  status_display?: string;
  locked_at?: string;
  locked_by_name?: string;
  notes?: string;
}

export interface JobGradeTier {
  id?: number;
  grade_number: number;
  daily_base_wage: number;
  daily_seniority_bonus: number;
}

export interface WorkshopInsuranceSettings {
  id?: number;
  workshop_code: string;
  workshop_name: string;
  employer_name: string;
  workshop_address: string;
  list_type: number;
  list_number: string;
  default_dsk_rate: number;
  default_mon_pym: string;
}

export interface TaxRuleSettings {
  id?: number;
  payment_type: string;
  service_location: string;
  exceptions: string;
  currency_type: string;
  currency_exchange_rate: number;
  housing_benefit_type: string;
  vehicle_benefit_type: string;
}

export interface BankExportSettings {
  id?: number;
  bank_name: string;
  source_account_number: string;
  default_deposit_id: string;
  deposit_description_template: string;
}

export interface PayrollYearlySettings {
  id?: number;
  fiscal_year: string;
  is_active: boolean;
  notes?: string;

  // قانون کار
  monthly_food_allowance: number;
  monthly_housing_allowance: number;
  monthly_spouse_allowance: number;
  monthly_child_allowance: number;

  // ضرایب و فوق‌العاده‌ها
  shift_percent: number;
  transport_help_percent: number;
  transport_fixed_amount: number;
  specialist_attraction_percent: number;
  bad_weather_percent: number;
  remote_hardship_percent: number;
  south_pars_percent: number;
  travel_cost_per_day: number;

  // بیمه
  worker_insurance_rate: number;
  employer_insurance_rate: number;
  unemployment_insurance_rate: number;

  // تسهیم مازاد
  surplus_overtime_percent?: number;

  // Nested
  job_grades: JobGradeTier[];
  workshop_insurance?: WorkshopInsuranceSettings;
  tax_settings?: TaxRuleSettings;
  bank_export_settings?: BankExportSettings;
}

export interface MonthlyPayrollRecord {
  id?: number;
  period: number;
  personnel: number;
  row_number: number;
  status_category: string;
  include_in_tax: boolean;
  include_in_insurance: boolean;
  include_in_bank: boolean;
  national_code: string;
  full_name: string;
  marital_status: string;
  children_count: number;
  contract_hours: number;
  contract_salary: number;
  job_grade: string;
  daily_wage: number;
  daily_seniority: number;
  years_of_service: number;
  base_daily_rate: number;
  worked_hours: number;
  insurance_days: number;
  overtime_hours: number;
  friday_work_days: number;
  mission_days: number;
  income_tax: number;
  advance_payment_deduction: number;
  other_allowances: number;
  friday_work_amount: number;
  overtime_amount: number;
  travel_cost_amount: number;
  mission_amount: number;
  bonus_amount: number;
  leave_amount: number;
  food_allowance: number;
  housing_allowance: number;
  marital_allowance: number;
  transport_allowance: number;
  market_attraction_allowance: number;
  bad_weather_allowance: number;
  remote_hardship_allowance: number;
  south_pars_allowance: number;
  child_allowance: number;
  seniority_allowance: number;
  total_taxable_allowances: number;
  total_non_continuous_taxable_allowances: number;
  continuous_taxable_allowances: number;
  total_non_taxable_allowances: number;
  total_seniority_accumulated: number;
  worker_insurance: number;
  employer_insurance: number;
  unemployment_insurance: number;
  total_insurance: number;
  base_salary: number;
  continuous_taxable_salary_allowances: number;
  total_insurable_salary_allowances: number;
  gross_salary: number;
  total_deductions: number;
  net_salary: number;
  bank_account_number: string;
  payable_amount: number;
  tax_check_discrepancy: number;
  tax_source_type?: string;
  tax_exemption_months?: number;
  has_multiple_employers?: boolean;
  is_tax_imported?: boolean;
  is_manually_overridden: boolean;
}

