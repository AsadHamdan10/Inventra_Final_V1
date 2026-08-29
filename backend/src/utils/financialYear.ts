export function getFinancialYear(date: Date): string {
  const istString = date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata', month: '2-digit', year: 'numeric' });
  const [monthStr, yearStr] = istString.split('/');
  const month = parseInt(monthStr, 10);
  const year = parseInt(yearStr, 10);
  
  if (month < 4) {
    const prevYear = year - 1;
    const nextYearStr = String(year).slice(-2);
    return `${prevYear}-${nextYearStr}`;
  } else {
    const nextYearStr = String(year + 1).slice(-2);
    return `${year}-${nextYearStr}`;
  }
}
