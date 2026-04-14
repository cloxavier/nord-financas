export type PaymentPlanIntervalType = 'monthly' | 'biweekly' | 'weekly';

/**
 * Estado do formulário usado na tela de detalhes do tratamento
 * para gerar ou recalcular parcelas.
 */
export interface PaymentPlanFormValues {
  count: number;
  firstDueDate: string;
  interval: PaymentPlanIntervalType;
  adjustLast: boolean;
}

/**
 * Entrada normalizada do domínio de parcelamento.
 * Nesta fase, o plano passa a nascer do saldo parcelável,
 * e não mais do total contratado do tratamento.
 */
export interface PaymentPlanGenerationInput {
  amountToFinance: number;
  installmentCount: number;
  firstDueDate: string;
  intervalType: PaymentPlanIntervalType;
  adjustLastInstallment: boolean;
}

export interface GeneratedInstallmentDraft {
  installmentNumber: number;
  dueDate: string;
  amount: number;
  status: 'pending';
}

export interface PaymentPlanGenerationPreview {
  baseInstallmentAmount: number;
  totalGeneratedAmount: number;
  installments: GeneratedInstallmentDraft[];
}

export interface ReplaceTreatmentPaymentPlanInput
  extends PaymentPlanGenerationInput {
  treatmentId: string;
}

export interface SyncExistingPaymentPlanResult {
  status: 'no_plan' | 'synced' | 'blocked';
  message?: string;
}