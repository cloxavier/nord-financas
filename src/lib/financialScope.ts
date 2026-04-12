import { FinancialAccessLevel } from '@/src/domain/access/catalog/financialScopeCatalog';

export interface FinancialScopeMap {
  financial_access_level: FinancialAccessLevel;
  months_back_visible: number;
  months_forward_visible: number;
  can_view_monthly_forecast: boolean;
  can_view_open_amount_total: boolean;
}

const defaultFinancialScope: FinancialScopeMap = {
  financial_access_level: 'none',
  months_back_visible: 0,
  months_forward_visible: 0,
  can_view_monthly_forecast: false,
  can_view_open_amount_total: false,
};

function normalizeBoolean(value: unknown): boolean {
  if (value === true) return true;
  if (value === 'true') return true;
  if (value === 1) return true;

  return false;
}

function normalizeNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);

  if (Number.isNaN(parsed) || !Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(0, Math.floor(parsed));
}

function normalizeFinancialAccessLevel(value: unknown): FinancialAccessLevel {
  if (
    value === 'none' ||
    value === 'operational' ||
    value === 'financial' ||
    value === 'executive'
  ) {
    return value;
  }

  return 'none';
}

export function normalizeFinancialScope(input: unknown): FinancialScopeMap {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return defaultFinancialScope;
  }

  const raw = input as Record<string, unknown>;

  return {
    financial_access_level: normalizeFinancialAccessLevel(raw.financial_access_level),
    months_back_visible: normalizeNumber(raw.months_back_visible, 0),
    months_forward_visible: normalizeNumber(raw.months_forward_visible, 0),
    can_view_monthly_forecast: normalizeBoolean(raw.can_view_monthly_forecast),
    can_view_open_amount_total: normalizeBoolean(raw.can_view_open_amount_total),
  };
}