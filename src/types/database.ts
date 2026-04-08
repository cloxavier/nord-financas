/**
 * Definições de Tipos e Interfaces do Banco de Dados.
 * Este arquivo contém as interfaces que representam a estrutura das tabelas do Supabase.
 */

/**
 * Papéis (Roles) de usuário permitidos no sistema.
 * Define o nível de acesso e permissões de cada usuário.
 */
export type UserRole = 'admin' | 'financeiro' | 'dentista' | 'recepcao';

/**
 * Interface Profile: Representa o perfil de um usuário do sistema.
 */
export interface Profile {
  id: string;         // ID único do usuário (UUID do Supabase Auth)
  full_name: string;  // Nome completo do usuário
  role: UserRole;     // Papel atribuído ao usuário
  created_at: string; // Data de criação do perfil
}

/**
 * Interface Patient: Representa um paciente cadastrado na clínica.
 */
export interface Patient {
  id: string;         // ID único do paciente
  full_name: string;  // Nome completo
  cpf: string;        // CPF (identificação única)
  phone: string;      // Telefone de contato
  email: string;      // Endereço de e-mail
  birth_date: string; // Data de nascimento
  address: string;    // Endereço residencial
  notes: string;      // Observações clínicas ou gerais
  created_at: string; // Data de cadastro
  updated_at: string; // Data da última atualização
}

/**
 * Interface Procedure: Representa um procedimento/serviço oferecido pela clínica.
 */
export interface Procedure {
  id: string;            // ID único do procedimento
  name: string;          // Nome do serviço (ex: Limpeza, Canal)
  category: string;      // Categoria (ex: Estética, Ortodontia)
  default_price: number; // Preço padrão cobrado do paciente
  default_cost?: number; // Custo base para a clínica (opcional)
  description: string;   // Detalhes sobre o procedimento
  is_active: boolean;    // Status de disponibilidade no catálogo
  created_at: string;    // Data de criação
  updated_at: string;    // Data da última atualização
}

/**
 * Interface Treatment: Representa um plano de tratamento ou orçamento.
 */
export interface Treatment {
  id: string;                     // ID único do tratamento
  patient_id?: string;            // ID do paciente (pode ser nulo se o paciente for excluído)
  patient_name_snapshot: string;  // Nome do paciente no momento da criação (histórico)
  patient_phone_snapshot?: string;// Telefone do paciente no momento da criação
  patient_email_snapshot?: string;// E-mail do paciente no momento da criação
  status: 'draft' | 'pending' | 'in_progress' | 'completed' | 'cancelled'; // Estado atual do tratamento
  subtotal: number;               // Valor total dos itens sem desconto
  discount_amount: number;        // Valor total do desconto aplicado
  total_amount: number;           // Valor final a ser pago (subtotal - desconto)
  payment_method_preference: string; // Forma de pagamento preferencial (ex: Cartão, Boleto)
  notes: string;                  // Observações específicas deste tratamento
  created_by: string;             // ID do usuário que criou o tratamento
  created_at: string;             // Data de criação
  updated_at: string;             // Data da última atualização
}

/**
 * Interface Installment: Representa uma parcela financeira de um tratamento.
 */
export interface Installment {
  id: string;                 // ID único da parcela
  payment_plan_id: string;    // ID do plano de pagamento associado
  treatment_id: string;       // ID do tratamento ao qual pertence
  installment_number: number; // Número da parcela (ex: 1 de 12)
  due_date: string;           // Data de vencimento
  amount: number;             // Valor da parcela
  status: 'pending' | 'paid' | 'overdue' | 'cancelled'; // Status do pagamento
  amount_paid: number;        // Valor efetivamente pago
  payment_date?: string;      // Data em que o pagamento foi realizado
  payment_method_used?: string;// Método de pagamento utilizado
  reminder_sent_at?: string;  // Data/hora do último lembrete enviado
  manual_settlement: boolean; // Indica se a baixa foi feita manualmente pelo financeiro
  notes: string;              // Observações sobre o pagamento
  created_at: string;         // Data de criação do registro
  updated_at: string;         // Data da última atualização
}
