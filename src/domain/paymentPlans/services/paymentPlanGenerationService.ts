import { supabase } from '../../../lib/supabase';
import { parseDateOnlyAsLocalDate } from '../../../lib/utils';
import {
  PaymentPlanGenerationInput,
  PaymentPlanGenerationPreview,
  PaymentPlanIntervalType,
  ReplaceTreatmentPaymentPlanInput,
  SyncExistingPaymentPlanResult,
} from '../contracts/paymentPlanContracts';

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function floorCurrency(value: number) {
  return Math.floor((value + Number.EPSILON) * 100) / 100;
}

function formatAsDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildDueDate(
  baseDate: Date,
  intervalType: PaymentPlanIntervalType,
  installmentIndexZeroBased: number
) {
  const nextDate = new Date(baseDate.getTime());

  if (intervalType === 'monthly') {
    nextDate.setMonth(nextDate.getMonth() + installmentIndexZeroBased);
    return nextDate;
  }

  if (intervalType === 'biweekly') {
    nextDate.setDate(nextDate.getDate() + installmentIndexZeroBased * 14);
    return nextDate;
  }

  nextDate.setDate(nextDate.getDate() + installmentIndexZeroBased * 7);
  return nextDate;
}

export function getPaymentPlanValidationError(
  input: PaymentPlanGenerationInput
): string | null {
  if (!Number.isFinite(input.totalAmount) || input.totalAmount <= 0) {
    return 'O valor total do tratamento deve ser maior que zero.';
  }

  if (!Number.isFinite(input.installmentCount) || input.installmentCount <= 0) {
    return 'Quantidade de parcelas deve ser maior que zero.';
  }

  if (!input.firstDueDate) {
    return 'Informe a primeira data de vencimento.';
  }

  const parsedDate = parseDateOnlyAsLocalDate(input.firstDueDate);
  if (!parsedDate) {
    return 'A primeira data de vencimento é inválida.';
  }

  if (!['monthly', 'biweekly', 'weekly'].includes(input.intervalType)) {
    return 'O intervalo selecionado é inválido.';
  }

  return null;
}

export function generatePaymentPlanPreview(
  input: PaymentPlanGenerationInput
): PaymentPlanGenerationPreview {
  const validationError = getPaymentPlanValidationError(input);
  if (validationError) {
    throw new Error(validationError);
  }

  const parsedFirstDueDate = parseDateOnlyAsLocalDate(input.firstDueDate);
  if (!parsedFirstDueDate) {
    throw new Error('A primeira data de vencimento é inválida.');
  }

  const safeTotalAmount = roundCurrency(input.totalAmount);
  const safeInstallmentCount = Math.max(1, Math.floor(input.installmentCount));
  const baseInstallmentAmount = floorCurrency(safeTotalAmount / safeInstallmentCount);

  const installments = [];
  let accumulatedAmount = 0;

  for (let index = 0; index < safeInstallmentCount; index++) {
    const installmentNumber = index + 1;
    const dueDate = buildDueDate(parsedFirstDueDate, input.intervalType, index);

    let amount = baseInstallmentAmount;

    if (installmentNumber === safeInstallmentCount && input.adjustLastInstallment) {
      amount = roundCurrency(safeTotalAmount - accumulatedAmount);
    }

    accumulatedAmount += amount;

    installments.push({
      installmentNumber,
      dueDate: formatAsDateOnly(dueDate),
      amount,
      status: 'pending' as const,
    });
  }

  return {
    baseInstallmentAmount,
    totalGeneratedAmount: roundCurrency(
      installments.reduce((sum, installment) => sum + installment.amount, 0)
    ),
    installments,
  };
}

export async function replaceTreatmentPaymentPlan(
  input: ReplaceTreatmentPaymentPlanInput
) {
  const validationError = getPaymentPlanValidationError(input);
  if (validationError) {
    throw new Error(validationError);
  }

  const preview = generatePaymentPlanPreview(input);

  const { error } = await supabase.rpc('replace_treatment_payment_plan', {
    p_treatment_id: input.treatmentId,
    p_total_amount: input.totalAmount,
    p_installment_count: input.installmentCount,
    p_first_due_date: input.firstDueDate,
    p_interval_type: input.intervalType,
    p_adjust_last_installment: input.adjustLastInstallment,
  });

  if (error) throw error;

  return preview;
}

export async function syncExistingPaymentPlanAfterTreatmentChange(args: {
  treatmentId: string;
  totalAmount: number;
}): Promise<SyncExistingPaymentPlanResult> {
  const { data: existingPlan, error } = await supabase
    .from('payment_plans')
    .select(
      'installment_count, first_due_date, interval_type, total_value, adjust_last_installment'
    )
    .eq('treatment_id', args.treatmentId)
    .maybeSingle();

  if (error) throw error;

  if (!existingPlan) {
    return { status: 'no_plan' };
  }

  try {
    await replaceTreatmentPaymentPlan({
      treatmentId: args.treatmentId,
      totalAmount: args.totalAmount,
      installmentCount: existingPlan.installment_count,
      firstDueDate: existingPlan.first_due_date,
      intervalType: existingPlan.interval_type,
      adjustLastInstallment: existingPlan.adjust_last_installment ?? true,
    });

    return { status: 'synced' };
  } catch (error: any) {
    const message =
      error?.message || 'Não foi possível recalcular automaticamente o plano.';

    if (
      message.includes('parcela paga/baixada') ||
      message.includes('não pode ser substituído automaticamente')
    ) {
      return {
        status: 'blocked',
        message:
          'Tratamento salvo, mas o plano de pagamento não foi recalculado automaticamente porque já possui parcela paga/baixada. Revise o plano manualmente.',
      };
    }

    throw error;
  }
}