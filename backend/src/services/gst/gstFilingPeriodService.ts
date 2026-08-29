export class GstFilingPeriodService {
  public static getPeriodBoundaries(month: number, year: number): { startDate: Date, endDate: Date } {
    if (month < 1 || month > 12) throw new Error('Invalid month');
    if (year < 2000 || year > 2100) throw new Error('Invalid year');

    const startDate = new Date(year, month - 1, 1);
    // endDate is the first day of the next month (exclusive boundary)
    const endDate = new Date(year, month, 1);

    return { startDate, endDate };
  }
}
