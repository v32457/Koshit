export const INDIA_TIME_ZONE = 'Asia/Kolkata';

const FINANCIAL_YEAR_PATTERN = /^(\d{4})-(\d{2})$/;

export function isValidFinancialYear(value: string): boolean {
  const match = FINANCIAL_YEAR_PATTERN.exec(value);
  if (!match) return false;

  const startYear = Number(match[1]);
  const endYear = Number(match[2]);

  return endYear === (startYear + 1) % 100;
}

function indiaYearMonth(date: Date): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: INDIA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date);

  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);

  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    throw new Error('Could not determine the current Indian financial year.');
  }

  return { year, month };
}

export function getIndianFinancialYear(date: Date = new Date()): string {
  const { year, month } = indiaYearMonth(date);
  const startYear = month >= 4 ? year : year - 1;

  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

export function getAvailableFinancialYears(date: Date = new Date()): string[] {
  const { year, month } = indiaYearMonth(date);
  const currentStartYear = month >= 4 ? year : year - 1;

  return [0, 1, 2].map((offset) => {
    const startYear = currentStartYear - offset;
    return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
  });
}

export function getFinancialYearRange(financialYear: string): {
  startDate: string;
  endDate: string;
} | null {
  if (!isValidFinancialYear(financialYear)) return null;

  const startYear = Number(financialYear.slice(0, 4));

  return {
    startDate: `${startYear}-04-01`,
    endDate: `${startYear + 1}-03-31`,
  };
}

export function isReturnPeriodInFinancialYear(
  returnPeriod: string,
  financialYear: string,
): boolean {
  const range = getFinancialYearRange(financialYear);

  if (!range || !/^\d{4}-(0[1-9]|1[0-2])$/.test(returnPeriod)) return false;

  const periodStart = `${returnPeriod}-01`;
  return periodStart >= range.startDate && periodStart <= range.endDate;
}
