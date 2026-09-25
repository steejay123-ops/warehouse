export type CompanyDocumentType =
  | 'statute'
  | 'establishment_gazette'
  | 'changes_gazette'
  | 'auditors_gazette'
  | 'capital_gazette'
  | 'vat_certificate'
  | 'tax_clearance'
  | 'commercial_card'
  | 'contractor_qualification'
  | 'labor_safety_certificate'
  | 'operating_license'
  | 'lease_contract'
  | 'master_agreement'
  | 'other';

export interface CompanyDocument {
  id: number;
  company: number;
  company_name?: string;
  document_type: CompanyDocumentType;
  document_type_display?: string;
  title: string;
  file: string;
  file_url?: string;
  file_size: number;
  issue_date?: string | null;
  expiry_date?: string | null;
  expiry_status?: 'permanent' | 'expired' | 'expiring_soon' | 'valid';
  days_until_expiry?: number | null;
  is_confidential: boolean;
  description?: string | null;
  uploaded_by?: number | null;
  uploaded_by_name?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ExpiringDocumentsResponse {
  count: number;
  results: CompanyDocument[];
}

export interface Company {
  id: number;
  code: string;
  name: string;
  company_type?: string;
  national_id?: string | null;
  economic_code?: string | null;
  registration_number?: string | null;
  registration_date?: string | null;
  registered_capital?: number | null;
  shares_count?: number | null;
  share_nominal_value?: number | null;
  fiscal_year_start_month?: number;
  phone?: string | null;
  address?: string | null;
  postal_code?: string | null;
  ceo_name?: string | null;
  board_chairman?: string | null;
  board_vice_chairman?: string | null;
  main_inspector?: string | null;
  alternate_inspector?: string | null;
  authorized_signers?: string | null;
  board_term_expiry?: string | null;
  workshop_code?: string | null;
  social_security_branch_code?: string | null;
  social_security_branch_name?: string | null;
  contract_row?: string | null;
  employer_name?: string | null;
  tax_memory_id?: string | null;
  tax_economic_code?: string | null;
  primary_bank_name?: string | null;
  primary_account_number?: string | null;
  primary_iban?: string | null;
  articles_of_association?: string | null;
  latest_gazette?: string | null;
  logo?: string | null;
  is_active: boolean;
  has_warehouse_module?: boolean;
  projects_count?: number;
  documents_count?: number;
  documents_health_status?: 'valid' | 'expiring_soon' | 'expired' | 'no_documents';
  bank_accounts?: CompanyBankAccount[];
  created_at?: string;
  updated_at?: string;
}

export interface CompanyBankAccount {
  id?: number;
  company: number;
  company_name?: string;
  bank_name: string;
  account_number?: string | null;
  sheba_number: string;
  account_title?: string | null;
  is_primary: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface UserAvailableCompaniesResponse {
  companies: Company[];
  is_superuser: boolean;
  count: number;
}

export interface UserCompanyAccess {
  id?: number;
  user: number;
  username?: string;
  user_full_name?: string | null;
  company: number;
  company_name?: string;
  company_code?: string;
  is_default: boolean;
  created_at?: string;
}

