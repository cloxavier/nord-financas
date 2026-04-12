import { FinancialScopeMap } from '@/src/lib/financialScope';
import {
  getMonthsBackVisible,
  getMonthsForwardVisible,
  canViewMonthlyForecast,
  canViewOpenAmountTotal,
} from '@/src/domain/access/policies/financialScopePolicies';
import { ReceivablesHorizon } from '@/src/domain/receivables/contracts/receivablesContracts';

export function resolveReceivablesHorizon(
  financialScope: FinancialScopeMap | null | undefined
): ReceivablesHorizon {
  return {
    monthsBackVisible: getMonthsBackVisible(financialScope),
    monthsForwardVisible: getMonthsForwardVisible(financialScope),
    canViewMonthlyForecast: canViewMonthlyForecast(financialScope),
    canViewOpenAmountTotal: canViewOpenAmountTotal(financialScope),
  };
}