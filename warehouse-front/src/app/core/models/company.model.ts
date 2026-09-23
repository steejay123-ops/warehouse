export interface Company {
  id: number;
  code: string;
  name: string;
  national_id?: string | null;
  economic_code?: string | null;
  registration_number?: string | null;
  phone?: string | null;
  address?: string | null;
  ceo_name?: string | null;
  logo?: string | null;
  is_active: boolean;
  projects_count?: number;
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
