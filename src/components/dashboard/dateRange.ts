export type DateRange = '7d' | '14d' | '30d' | '90d';

export function getDateRangeDays(range: DateRange): number {
  switch (range) {
    case '7d':
      return 7;
    case '14d':
      return 14;
    case '30d':
      return 30;
    case '90d':
      return 90;
  }
}
