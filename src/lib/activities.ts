/**
 * Serviço de Log de Atividades.
 * Este arquivo contém a lógica para registrar ações importantes realizadas pelos usuários no sistema.
 */

import { supabase } from './supabase';

/**
 * Define os tipos de atividades que podem ser registradas no log de auditoria.
 */
export type ActivityType =
  | 'patient_created'                 // Novo paciente cadastrado
  | 'patient_updated'                 // Dados de paciente atualizados
  | 'treatment_created'               // Novo tratamento/orçamento criado
  | 'treatment_updated'               // Tratamento atualizado
  | 'treatment_cancelled'             // Tratamento cancelado
  | 'treatment_permanently_deleted'   // Tratamento excluído permanentemente
  | 'installment_generated'           // Parcelas geradas para um tratamento
  | 'installment_recalculated'        // Parcelas recalculadas para um tratamento
  | 'payment_plan_synced'             // Plano recalculado automaticamente após edição do tratamento
  | 'payment_registered'              // Pagamento de parcela registrado
  | 'procedure_created'               // Novo procedimento adicionado ao catálogo
  | 'reminder_sent';                  // Lembrete de cobrança enviado

/**
 * Registra uma atividade no banco de dados Supabase.
 * @param type O tipo da atividade (ActivityType).
 * @param description Uma descrição amigável do que ocorreu.
 * @param metadata Dados adicionais opcionais relacionados à atividade (ex: entity_id).
 */
export async function logActivity(
  type: ActivityType,
  description: string,
  metadata: any = {}
) {
  try {
    // Obtém o usuário autenticado atual para associar ao log
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return; // Se não houver usuário, não registra o log

    // Insere o registro na tabela 'audit_logs'
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: type,
      // Tenta inferir o tipo da entidade a partir do prefixo do tipo da atividade
      entity_type: type.split('_')[0],
      entity_id: metadata.entity_id || null,
      description: description,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    // Registra erros no console para depuração, mas não interrompe o fluxo principal
    console.error('Error logging activity:', error);
  }
}
