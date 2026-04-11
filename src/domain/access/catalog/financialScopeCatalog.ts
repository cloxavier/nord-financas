export type FinancialAccessLevel =
  | 'none'
  | 'operational'
  | 'financial'
  | 'executive';

export interface FinancialScopeDefinition {
  key: FinancialAccessLevel;
  label: string;
  description: string;
  order: number;
}

export const financialScopeCatalog: FinancialScopeDefinition[] = [
  {
    key: 'none',
    label: 'Sem acesso financeiro',
    description: 'Não deve visualizar dados financeiros sensíveis.',
    order: 10,
  },
  {
    key: 'operational',
    label: 'Operacional',
    description: 'Acesso restrito ao acompanhamento operacional de parcelas e cobranças.',
    order: 20,
  },
  {
    key: 'financial',
    label: 'Financeiro',
    description: 'Acesso a visão financeira de trabalho, com escopo intermediário.',
    order: 30,
  },
  {
    key: 'executive',
    label: 'Executivo',
    description: 'Acesso amplo à visão financeira estratégica e previsões.',
    order: 40,
  },
];

export function getFinancialScopeCatalog() {
  return financialScopeCatalog;
}

export function getFinancialScopeDefinition(key: FinancialAccessLevel) {
  return financialScopeCatalog.find((item) => item.key === key) ?? null;
}