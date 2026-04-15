/**
 * Utilitários centrais para regras de multa e juros por atraso.
 * Nesta fase:
 * - as regras são contratuais/snapshot do tratamento
 * - o cálculo é exibido na visualização da parcela vencida
 * - não alteramos automaticamente os totais globais do sistema
 */

export type LateInterestPeriod = 'monthly' | 'daily';

export interface LateRuleValues {
  late_fee_enabled?: boolean | null;
  late_fee_percent?: number | null;
  interest_enabled?: boolean | null;
  interest_percent?: number | null;
  interest_period?: LateInterestPeriod | null;
  late_fee_notes?: string | null;
}

export interface InstallmentLateChargeBreakdown {
  principalOpenAmount: number;
  daysLate: number;
  lateFeeAmount: number;
  interestAmount: number;
  totalUpdatedAmount: number;
  isOverdue: boolean;
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function parseDateOnlyAsLocalDate(dateOnly: string | null | undefined): Date | null {
  if (!dateOnly) return null;

  const [year, month, day] = dateOnly.split('-').map(Number);
  if (!year || !month || !day) return null;

  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function formatPercent(value: number) {
  return `${Number(value || 0).toString().replace('.', ',')}%`;
}

/**
 * Gera uma descrição amigável das regras de atraso.
 */
export function buildLateRuleDescription(rules: LateRuleValues): string {
  const lateFeeEnabled = Boolean(rules.late_fee_enabled);
  const interestEnabled = Boolean(rules.interest_enabled);
  const lateFeePercent = Number(rules.late_fee_percent || 0);
  const interestPercent = Number(rules.interest_percent || 0);
  const interestPeriod = rules.interest_period === 'daily' ? 'ao dia' : 'ao mês';

  const parts: string[] = [];

  if (lateFeeEnabled && lateFeePercent > 0) {
    parts.push(`multa de ${formatPercent(lateFeePercent)}`);
  }

  if (interestEnabled && interestPercent > 0) {
    parts.push(`juros de ${formatPercent(interestPercent)} ${interestPeriod}`);
  }

  if (parts.length === 0) {
    return 'Sem encargos automáticos definidos para atraso.';
  }

  if (parts.length === 1) {
    return `Em caso de atraso, será aplicada ${parts[0]}.`;
  }

  return `Em caso de atraso, serão aplicados ${parts[0]} e ${parts[1]}.`;
}

/**
 * Resolve o texto final que será exibido no tratamento/parcela.
 * Se existir texto customizado, ele tem prioridade.
 */
export function resolveLateRuleNotes(rules: LateRuleValues): string {
  const customText = rules.late_fee_notes?.trim();
  if (customText) {
    return customText;
  }

  return buildLateRuleDescription(rules);
}

/**
 * Calcula o valor atualizado de uma parcela em atraso.
 * O cálculo é simples e informativo nesta fase.
 */
export function calculateInstallmentLateChargeBreakdown(args: {
  installmentAmount: number;
  amountPaid?: number | null;
  dueDate: string;
  rules: LateRuleValues;
  referenceDate?: Date;
}): InstallmentLateChargeBreakdown {
  const dueDate = parseDateOnlyAsLocalDate(args.dueDate);
  const today = args.referenceDate
    ? new Date(
        args.referenceDate.getFullYear(),
        args.referenceDate.getMonth(),
        args.referenceDate.getDate(),
        12,
        0,
        0,
        0
      )
    : new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), 12, 0, 0, 0);

  const principalOpenAmount = roundCurrency(
    Math.max(Number(args.installmentAmount || 0) - Number(args.amountPaid || 0), 0)
  );

  if (!dueDate || principalOpenAmount <= 0 || dueDate.getTime() >= today.getTime()) {
    return {
      principalOpenAmount,
      daysLate: 0,
      lateFeeAmount: 0,
      interestAmount: 0,
      totalUpdatedAmount: principalOpenAmount,
      isOverdue: false,
    };
  }

  const msPerDay = 1000 * 60 * 60 * 24;
  const daysLate = Math.max(
    0,
    Math.floor((today.getTime() - dueDate.getTime()) / msPerDay)
  );

  const lateFeeAmount =
    args.rules.late_fee_enabled && Number(args.rules.late_fee_percent || 0) > 0
      ? roundCurrency(principalOpenAmount * (Number(args.rules.late_fee_percent || 0) / 100))
      : 0;

  const interestFactor =
    args.rules.interest_period === 'daily' ? daysLate : daysLate / 30;

  const interestAmount =
    args.rules.interest_enabled && Number(args.rules.interest_percent || 0) > 0
      ? roundCurrency(
          principalOpenAmount *
            (Number(args.rules.interest_percent || 0) / 100) *
            interestFactor
        )
      : 0;

  return {
    principalOpenAmount,
    daysLate,
    lateFeeAmount,
    interestAmount,
    totalUpdatedAmount: roundCurrency(
      principalOpenAmount + lateFeeAmount + interestAmount
    ),
    isOverdue: true,
  };
}