export interface NavItem {
  id: string;
  label: string;
  icon: string;
  permission: string;
  module?: 'warehouse' | 'accounting' | 'platform';
  isAccounting?: boolean;
}

export const ACCOUNTING_NAV_ITEMS: NavItem[] = [
  { id: 'projects-and-sections', label: '🏢 پروژه‌ها و بخش‌ها', icon: 'briefcase', permission: 'view_sys_projects', module: 'accounting', isAccounting: true },
  { id: 'employee-portal', label: '👤 پنل ثبت کارمند (بخش‌ها)', icon: 'clipboard', permission: 'view_sys_personnel_attendance', module: 'accounting', isAccounting: true },
  { id: 'attendance', label: '📋 ثبت کارکرد پرسنل و ناوگان', icon: 'check-square', permission: 'view_sys_personnel_attendance', module: 'accounting', isAccounting: true },
  { id: 'manager-approvals', label: '👑 کارتابل تاییدات مدیر', icon: 'check-circle', permission: 'view_sys_personnel', module: 'accounting', isAccounting: true },
  { id: 'finance-cartable', label: '💳 کارتابل مالی و حقوق', icon: 'dollar-sign', permission: 'view_sys_payroll', module: 'accounting', isAccounting: true },
  { id: 'treasury-cartable', label: '🏦 کارتابل خزانه‌داری و پرداخت', icon: 'dollar-sign', permission: 'view_sys_treasury', module: 'accounting', isAccounting: true },
  { id: 'counterparties', label: '🤝 مدیریت طرف‌حساب‌های مالی', icon: 'briefcase', permission: 'view_sys_payroll', module: 'accounting', isAccounting: true },
  { id: 'profiles', label: '👥 بانک پرونده‌های پرسنل و ناوگان', icon: 'users', permission: 'view_sys_personnel', module: 'accounting', isAccounting: true },
  { id: 'base-settings', label: '⚙️ تنظیمات پایه حقوق و سیستم', icon: 'settings', permission: 'view_sys_personnel', module: 'accounting', isAccounting: true },
  { id: 'finance-audit', label: '🔍 رهگیری و ممیزی مالی', icon: 'file-text', permission: 'view_sys_payroll', module: 'accounting', isAccounting: true },
  { id: 'finance-health', label: '🩺 سلامت و تاب‌آوری سامانه', icon: 'activity', permission: 'view_sys_payroll', module: 'accounting', isAccounting: true },
];

export const EMPLOYEE_NAV_ITEMS: NavItem[] = [
  { id: 'employee-attendance', label: '📋 کارکرد پرسنل', icon: 'check-square', permission: 'can_act_as_operator', module: 'accounting', isAccounting: true },
  { id: 'employee-fleet', label: '🚚 کارکرد ماشین‌آلات', icon: 'truck', permission: 'can_act_as_operator', module: 'accounting', isAccounting: true },
  { id: 'employee-invoices', label: '🧾 ثبت فاکتور هزینه', icon: 'dollar-sign', permission: 'can_act_as_operator', module: 'accounting', isAccounting: true },
  { id: 'employee-petty-cash', label: '💰 مدیریت تن‌خواه', icon: 'credit-card', permission: 'can_act_as_operator', module: 'accounting', isAccounting: true },
  { id: 'employee-new-vehicle', label: '🚗 تعریف خودرو (پیش‌نویس)', icon: 'truck', permission: 'can_act_as_operator', module: 'accounting', isAccounting: true },
  { id: 'employee-new-personnel', label: '👥 تعریف پرسنل (پیش‌نویس)', icon: 'users', permission: 'can_act_as_operator', module: 'accounting', isAccounting: true },
];

export const SUPERVISOR_NAV_ITEMS: NavItem[] = [
  { id: 'supervisor-attendance', label: '📋 تایید کارکرد پرسنل', icon: 'check-square', permission: 'perm_approve_personnel_supervisor', module: 'accounting', isAccounting: true },
  { id: 'supervisor-fleet', label: '🚚 تایید کارکرد ماشین‌آلات', icon: 'truck', permission: 'perm_approve_fleet_supervisor', module: 'accounting', isAccounting: true },
  { id: 'supervisor-invoices', label: '🧾 تایید فاکتورهای هزینه', icon: 'dollar-sign', permission: 'view_sys_payroll', module: 'accounting', isAccounting: true },
  { id: 'supervisor-petty-cash', label: '💰 تایید اسناد تن‌خواه', icon: 'credit-card', permission: 'view_sys_payroll', module: 'accounting', isAccounting: true },
  { id: 'supervisor-new-profiles', label: '👥 تایید پرسنل و ناوگان جدید', icon: 'users', permission: 'perm_approve_personnel_supervisor', module: 'accounting', isAccounting: true },
  { id: 'supervisor-period-lock', label: '🔒 بستن دوره کارکرد ماهانه', icon: 'briefcase', permission: 'perm_lock_work_period', module: 'accounting', isAccounting: true },
];

export const ACCOUNTANT_NAV_ITEMS: NavItem[] = [
  { id: 'accountant-payroll', label: '💳 حقوق و دستمزد ماهانه', icon: 'dollar-sign', permission: 'view_sys_payroll', module: 'accounting', isAccounting: true },
  { id: 'accountant-fleet', label: '🚚 تسویه‌حساب ناوگان', icon: 'truck', permission: 'view_sys_fleet_settlement', module: 'accounting', isAccounting: true },
  { id: 'accountant-invoices', label: '🧾 ممیزی فاکتورهای هزینه', icon: 'file-text', permission: 'view_sys_payroll', module: 'accounting', isAccounting: true },
  { id: 'accountant-petty-cash', label: '💰 کنترل تن‌خواه‌گردان', icon: 'credit-card', permission: 'view_sys_payroll', module: 'accounting', isAccounting: true },
  { id: 'accountant-diskettes', label: '📑 دیسکت‌های بیمه و مالیات', icon: 'briefcase', permission: 'view_sys_payroll', module: 'accounting', isAccounting: true },
  { id: 'accountant-counterparties', label: '🤝 معین طرف‌حساب‌های مالی', icon: 'users', permission: 'view_sys_payroll', module: 'accounting', isAccounting: true },
];

export const MANAGER_NAV_ITEMS: NavItem[] = [
  { id: 'manager-dashboard', label: '📊 داشبورد هوش مدیریتی', icon: 'bar-chart-2', permission: 'can_act_as_company_manager', module: 'accounting', isAccounting: true },
  { id: 'manager-approvals', label: '✅ کارتابل تاییدات و پرداخت', icon: 'check-circle', permission: 'can_act_as_company_manager', module: 'accounting', isAccounting: true },
  { id: 'manager-budget', label: '📉 کنترل بودجه و هزینه‌ها', icon: 'activity', permission: 'can_act_as_company_manager', module: 'accounting', isAccounting: true },
  { id: 'manager-contracts', label: '📜 تصویب احکام و قراردادها', icon: 'file-text', permission: 'can_act_as_company_manager', module: 'accounting', isAccounting: true },
  { id: 'manager-reports', label: '📑 گزارشات جامع مدیریتی', icon: 'briefcase', permission: 'can_act_as_company_manager', module: 'accounting', isAccounting: true },
];

export const TREASURER_NAV_ITEMS: NavItem[] = [
  { id: 'treasurer-disbursements', label: '💳 پرداخت حقوق و ناوگان', icon: 'dollar-sign', permission: 'view_sys_treasury', module: 'accounting', isAccounting: true },
  { id: 'treasurer-invoices', label: '🧾 تسویه فاکتور و تن‌خواه', icon: 'file-text', permission: 'view_sys_treasury', module: 'accounting', isAccounting: true },
  { id: 'treasurer-bank-accounts', label: '🏦 حساب‌های بانکی و صندوق', icon: 'database', permission: 'view_sys_treasury', module: 'accounting', isAccounting: true },
  { id: 'treasurer-cheques', label: '📜 مدیریت چک و اسناد', icon: 'clipboard', permission: 'view_sys_treasury', module: 'accounting', isAccounting: true },
  { id: 'treasurer-reconciliation', label: '⚖️ مغایرت‌گیری و نقدینگی', icon: 'activity', permission: 'view_sys_treasury', module: 'accounting', isAccounting: true },
];





