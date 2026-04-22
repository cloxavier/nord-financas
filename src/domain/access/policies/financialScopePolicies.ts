import { FinancialScopeMap } from '@/src/lib/financialScope';
import { FinancialAccessLevel } from '@/src/domain/access/catalog/financialScopeCatalog';

const financialAccessRank: Record<FinancialAccessLevel, number> = {
  none: 0,
  operational: 1,
  financial: 2,
  executive: 3,
};

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
): FinancialAccessLevel {
  return financialScope?.financial_access_level ?? 'none';
}

export function hasFinancialAccessAtLeast(
  financialScope: FinancialScopeMap | null | undefined,
  minimumLevel: FinancialAccessLevel
): boolean {
  return financialAccessRank[getFinancialAccessLevel(financialScope)] >= financialAccessRank[minimumLevel];
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

export function canViewOperationalFinancialData(
  financialScope: FinancialScopeMap | null | undefined
): boolean {
  return hasFinancialAccessAtLeast(financialScope, 'operational');
}

export function canViewFinancialSummary(
  financialScope: FinancialScopeMap | null | undefined
): boolean {
  return hasFinancialAccessAtLeast(financialScope, 'financial');
}

export function canViewFinancialReports(
  financialScope: FinancialScopeMap | null | undefined
): boolean {
  return hasFinancialAccessAtLeast(financialScope, 'financial');
}
