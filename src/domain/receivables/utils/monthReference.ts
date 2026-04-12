export interface MonthReference {
  year: number;
  month: number; // 1 a 12
  reference: string; // YYYY-MM
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

export function buildMonthReference(year: number, month: number): MonthReference {
  const normalizedMonth = Math.min(12, Math.max(1, month));
  const start = new Date(year, normalizedMonth - 1, 1);
  const end = new Date(year, normalizedMonth, 0);

  return {
    year,
    month: normalizedMonth,
    reference: `${year}-${pad(normalizedMonth)}`,
    startDate: `${year}-${pad(normalizedMonth)}-01`,
    endDate: `${year}-${pad(normalizedMonth)}-${pad(end.getDate())}`,
  };
}

export function getCurrentMonthReference(date = new Date()): MonthReference {
  return buildMonthReference(date.getFullYear(), date.getMonth() + 1);
}

export function addMonthsToReference(reference: MonthReference, offset: number): MonthReference {
  const base = new Date(reference.year, reference.month - 1, 1);
  const shifted = new Date(base.getFullYear(), base.getMonth() + offset, 1);

  return buildMonthReference(shifted.getFullYear(), shifted.getMonth() + 1);
}