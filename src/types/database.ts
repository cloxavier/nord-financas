/**
 * Definições de Tipos e Interfaces do Banco de Dados.
 * Este arquivo contém as interfaces que representam a estrutura das tabelas do Supabase.
 */

export type LegacyUserRole = 'admin' | 'financeiro' | 'dentista' | 'recepcao' | null;
export type AccessStatus = 'pending' | 'active' | 'blocked';

export interface AccessRolePermissionMap {
  [key: string]: boolean;
}

export interface AccessRoleFinancialScopeMap {
  [key: string]: boolean;
}

export interface AccessRole {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  is_system_role: boolean;
  is_active: boolean;
  permissions_json: AccessRolePermissionMap;
  financial_scope_json: AccessRoleFinancialScopeMap;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  full_name: string;
  email?: string | null;
  role: LegacyUserRole;
  access_status: AccessStatus | null;
  role_id: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  created_at: string;
  updated_at?: string;
  access_role?: AccessRole | null;
  resolved_role_name?: string;
  resolved_role_slug?: string | null;
}

export interface Patient {
  id: string;
  full_name: string;
  cpf: string;
  phone: string;
  phone_country_code?: string | null;
  phone_area_code?: string | null;
  phone_number?: string | null;
  email: string;
  birth_date: string;
  address: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface Procedure {
  id: string;
  name: string;
  category: string;
  default_price: number;
  default_cost?: number;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Treatment {
  id: string;
  patient_id?: string;
  patient_name_snapshot: string;
  patient_phone_snapshot?: string;
  patient_email_snapshot?: string;
  status: 'draft' | 'pending' | 'in_progress' | 'completed' | 'cancelled';
  subtotal: number;
  discount_amount: number;
  total_amount: number;
  entry_amount: number;
  amount_to_finance: number;
  use_clinic_default_late_rules: boolean;
  late_fee_enabled: boolean;
  late_fee_percent: number;
  interest_enabled: boolean;
  interest_percent: number;
  interest_period: 'monthly' | 'daily';
  late_fee_notes?: string | null;
  payment_method_preference: string;
  notes: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Installment {
  id: string;
  payment_plan_id: string;
  treatment_id: string;
  installment_number: number;
  due_date: string;
  amount: number;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  amount_paid: number;
  payment_date?: string;
  payment_method_used?: string;
  reminder_sent_at?: string;
  manual_settlement: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
}