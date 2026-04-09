/**
 * Serviço central de leitura e escrita das configurações da aplicação.
 * Nesta fase, ele cuida apenas dos dados de Financeiro & Pix,
 * reaproveitando a tabela app_settings já existente no Supabase.
 */

import { supabase } from './supabase';

/**
 * Estrutura do formulário de Financeiro & Pix.
 * Mantemos todos os campos como string para facilitar bind com inputs e textareas.
 */
export interface FinancialPixSettingsFormData {
  pix_key_type: string;
  pix_key: string;
  beneficiary_name: string;
  default_payment_instructions: string;
  default_contract_notes: string;
}

/**
 * Estrutura retornada ao carregar os dados.
 * Inclui o ID do registro atual, se existir.
 */
export interface FinancialPixSettingsRecord extends FinancialPixSettingsFormData {
  id: string | null;
  updated_at: string | null;
}

/**
 * Estado vazio padrão do formulário.
 */
export const EMPTY_FINANCIAL_PIX_SETTINGS: FinancialPixSettingsFormData = {
  pix_key_type: '',
  pix_key: '',
  beneficiary_name: '',
  default_payment_instructions: '',
  default_contract_notes: '',
};

/**
 * Converte strings vazias em null antes de enviar para o banco.
 * Isso evita gravar campos vazios como '' e mantém o banco mais limpo.
 */
function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * Converte null/undefined do banco em string vazia para o formulário.
 */
function nullToEmpty(value?: string | null): string {
  return value ?? '';
}

/**
 * Busca o registro mais recente de app_settings.
 * Como o projeto hoje trabalha como um único ambiente de clínica,
 * usamos o registro mais recente como fonte de verdade.
 */
export async function getFinancialPixSettings(): Promise<FinancialPixSettingsRecord> {
  const { data, error } = await supabase
    .from('app_settings')
    .select(`
      id,
      pix_key_type,
      pix_key,
      beneficiary_name,
      default_payment_instructions,
      default_contract_notes,
      updated_at
    `)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return {
      id: null,
      updated_at: null,
      ...EMPTY_FINANCIAL_PIX_SETTINGS,
    };
  }

  return {
    id: data.id,
    updated_at: data.updated_at ?? null,
    pix_key_type: nullToEmpty(data.pix_key_type),
    pix_key: nullToEmpty(data.pix_key),
    beneficiary_name: nullToEmpty(data.beneficiary_name),
    default_payment_instructions: nullToEmpty(data.default_payment_instructions),
    default_contract_notes: nullToEmpty(data.default_contract_notes),
  };
}

/**
 * Salva os dados de Financeiro & Pix.
 * Regra:
 * - se já existir um registro, atualiza;
 * - se não existir, cria o primeiro.
 *
 * Retorna o ID e a data de atualização persistidos no banco.
 */
export async function saveFinancialPixSettings(
  values: FinancialPixSettingsFormData,
  currentId?: string | null
): Promise<{ id: string; updated_at: string | null }> {
  const payload = {
    pix_key_type: emptyToNull(values.pix_key_type),
    pix_key: emptyToNull(values.pix_key),
    beneficiary_name: emptyToNull(values.beneficiary_name),
    default_payment_instructions: emptyToNull(values.default_payment_instructions),
    default_contract_notes: emptyToNull(values.default_contract_notes),
    updated_at: new Date().toISOString(),
  };

  /**
   * Se a tela já carregou um ID existente, atualiza direto esse registro.
   */
  if (currentId) {
    const { data, error } = await supabase
      .from('app_settings')
      .update(payload)
      .eq('id', currentId)
      .select('id, updated_at')
      .single();

    if (error) {
      throw error;
    }

    return {
      id: data.id,
      updated_at: data.updated_at ?? null,
    };
  }

  /**
   * Proteção adicional:
   * mesmo sem currentId, verificamos se já existe registro no banco
   * para evitar duplicidade desnecessária.
   */
  const { data: existing, error: existingError } = await supabase
    .from('app_settings')
    .select('id')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing?.id) {
    const { data, error } = await supabase
      .from('app_settings')
      .update(payload)
      .eq('id', existing.id)
      .select('id, updated_at')
      .single();

    if (error) {
      throw error;
    }

    return {
      id: data.id,
      updated_at: data.updated_at ?? null,
    };
  }

  /**
   * Se realmente não existe nenhum registro ainda, cria o primeiro.
   */
  const { data, error } = await supabase
    .from('app_settings')
    .insert(payload)
    .select('id, updated_at')
    .single();

  if (error) {
    throw error;
  }

  return {
    id: data.id,
    updated_at: data.updated_at ?? null,
  };
}