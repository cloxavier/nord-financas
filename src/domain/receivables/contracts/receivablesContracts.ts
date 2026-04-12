export interface MonthlyReceivablesForecastItem {
  year: number;
  month: number;
  reference: string; // exemplo: 2026-04
  totalExpectedAmount: number;
  totalOpenAmount: number;
  totalReceivedAmount: number;
  totalOverdueAmount: number;
  installmentCount: number;
  patientCount: number;
}

export interface OpenReceivablesSummary {
  totalOpenAmount: number;
  totalOverdueAmount: number;
  totalToReceiveThisMonth: number;
  totalReceivedThisMonth: number;
  overdueInstallmentCount: number;
  openInstallmentCount: number;
}

export interface ReceivablesHorizon {
  monthsBackVisible: number;
  monthsForwardVisible: number;
  canViewMonthlyForecast: boolean;
  canViewOpenAmountTotal: boolean;
}