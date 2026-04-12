import { FinancialScopeMap } from '@/src/lib/financialScope';

export function canViewMonthlyForecast(
  financialScope: FinancialScopeMap | null | undefined
): boolean {
  return financialScope?.can_view_monthly_forecast === true;
}

export function canViewOpenAmountTotal(
  financialScope: FinancialScopeMap | null | undefined
): boolean {
  return financialScope?.can_view_open_amount_total === true;
}

export function getMonthsBackVisible(
  financialScope: FinancialScopeMap | null | undefined
): number {
  return financialScope?.months_back_visible ?? 0;
}

export function getMonthsForwardVisible(
  financialScope: FinancialScopeMap | null | undefined
): number {
  return financialScope?.months_forward_visible ?? 0;
}

export function getFinancialAccessLevel(
  financialScope: FinancialScopeMap | null | undefined
) {
  return financialScope?.financial_access_level ?? 'none';
}

export function isOperationalFinancialScope(
  financialScope: FinancialScopeMap | null | undefined
): boolean {
  return getFinancialAccessLevel(financialScope) === 'operational';
}

export function isFinancialFinancialScope(
  financialScope: FinancialScopeMap | null | undefined
): boolean {
  return getFinancialAccessLevel(financialScope) === 'financial';
}

export function isExecutiveFinancialScope(
  financialScope: FinancialScopeMap | null | undefined
): boolean {
  return getFinancialAccessLevel(financialScope) === 'executive';
}