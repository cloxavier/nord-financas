/**
 * Definições de Tipos e Interfaces do Banco de Dados.
 * Este arquivo contém as interfaces que representam a estrutura das tabelas do Supabase.
 */

/**
 * Papel legado ainda existente no sistema.
 * Mantido temporariamente por compatibilidade com partes antigas do código.
 */
export type LegacyUserRole = 'admin' | 'financeiro' | 'dentista' | 'recepcao' | null;

/**
 * Status de acesso do usuário.
 * Define se a pessoa pode usar o sistema, aguarda liberação ou está bloqueada.
 */
export type AccessStatus = 'pending' | 'active' | 'blocked';

/**
 * Interface AccessRole: representa um cargo do sistema.
 * Esta será a base para cargos editáveis e permissões futuras.
 */
export interface AccessRole {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  is_system_role: boolean;
  is_active: boolean;
  permissions_json: Record<string, any>;
  financial_scope_json: Record<string, any>;
  created_at: string;
  updated_at: string;
}

/**
 * Interface Profile: representa o perfil do usuário autenticado.
 * Agora ela já contempla o novo modelo com status de acesso e cargo via role_id.
 */
export interface Profile {
  id: string;
  full_name: string;
  role: LegacyUserRole;
  access_status: AccessStatus | null;
  role_id: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  created_at: string;
  updated_at?: string;

  /**
   * Relação com a tabela access_roles.
   * Vem do select com join no AuthContext.
   */
  access_role?: AccessRole | null;

  /**
   * Campos derivados para facilitar o frontend.
   */
  resolved_role_name?: string;
  resolved_role_slug?: string | null;
}

/**
 * Interface Patient: Representa um paciente cadastrado na clínica.
 */
export interface Patient {
  id: string;
  full_name: string;
  cpf: string;
  phone: string;
  email: string;
  birth_date: string;
  address: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

/**
 * Interface Procedure: Representa um procedimento/serviço oferecido pela clínica.
 */
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

/**
 * Interface Treatment: Representa um plano de tratamento ou orçamento.
 */
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
  payment_method_preference: string;
  notes: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/**
 * Interface Installment: Representa uma parcela financeira de um tratamento.
 */
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