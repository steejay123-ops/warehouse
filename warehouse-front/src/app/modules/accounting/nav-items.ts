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
  { id: 'attendance', label: '📋 ثبت کارکرد پرسنل و ناوگان', icon: 'check-square', permission: 'view_sys_personnel_attendance', module: 'accounting', isAccounting: true },
  { id: 'manager-approvals', label: '👑 کارتابل تاییدات مدیر', icon: 'check-circle', permission: 'view_sys_personnel', module: 'accounting', isAccounting: true },
  { id: 'finance-cartable', label: '💳 کارتابل مالی و حقوق', icon: 'dollar-sign', permission: 'view_sys_payroll', module: 'accounting', isAccounting: true },
  { id: 'treasury-cartable', label: '🏦 کارتابل خزانه‌داری و پرداخت', icon: 'dollar-sign', permission: 'view_sys_treasury', module: 'accounting', isAccounting: true },
  { id: 'profiles', label: '👥 بانک پرونده‌های پرسنل و ناوگان', icon: 'users', permission: 'view_sys_personnel', module: 'accounting', isAccounting: true },
  { id: 'base-settings', label: '⚙️ تنظیمات پایه حقوق و سیستم', icon: 'settings', permission: 'view_sys_personnel', module: 'accounting', isAccounting: true },
  { id: 'finance-audit', label: '🔍 رهگیری و ممیزی مالی', icon: 'file-text', permission: 'view_sys_payroll', module: 'accounting', isAccounting: true },
  { id: 'finance-health', label: '🩺 سلامت و تاب‌آوری سامانه', icon: 'activity', permission: 'view_sys_payroll', module: 'accounting', isAccounting: true },
];
