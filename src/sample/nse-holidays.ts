// NSE equity-segment trading holidays (weekdays only; weekends are always closed).
// Used to check that every seed trade falls on a trading day.
// 2026: https://upstox.com/stocks-market/nse-holidays/ (+ 15 Jan 2026, special closure for the Maharashtra municipal elections)
// 2025: NSE circular https://nsearchives.nseindia.com/content/circulars/COM65590.pdf (as listed at https://stablemoney.in/pages/nse-holidays-2025)
// 2024: NSE circular https://nsearchives.nseindia.com/content/circulars/CMTR59722.pdf (+ special closures on 22 Jan, 20 May and 20 Nov 2024)
export const NSE_HOLIDAYS: ReadonlySet<string> = new Set([
  // 2024
  '2024-01-22', // special closure (declared by separate circular)
  '2024-01-26', // Republic Day
  '2024-03-08', // Mahashivratri
  '2024-03-25', // Holi
  '2024-03-29', // Good Friday
  '2024-04-11', // Id-ul-Fitr
  '2024-04-17', // Shri Ram Navami
  '2024-05-01', // Maharashtra Day
  '2024-05-20', // General elections, Mumbai (special closure)
  '2024-06-17', // Bakri Id
  '2024-07-17', // Moharram
  '2024-08-15', // Independence Day
  '2024-10-02', // Mahatma Gandhi Jayanti
  '2024-11-01', // Diwali Laxmi Pujan
  '2024-11-15', // Gurunanak Jayanti
  '2024-11-20', // Maharashtra assembly elections (special closure)
  '2024-12-25', // Christmas
  // 2025
  '2025-02-26', // Mahashivratri
  '2025-03-14', // Holi
  '2025-03-31', // Id-ul-Fitr
  '2025-04-10', // Shri Mahavir Jayanti
  '2025-04-14', // Dr. Baba Saheb Ambedkar Jayanti
  '2025-04-18', // Good Friday
  '2025-05-01', // Maharashtra Day
  '2025-08-15', // Independence Day
  '2025-08-27', // Ganesh Chaturthi
  '2025-10-02', // Mahatma Gandhi Jayanti / Dussehra
  '2025-10-21', // Diwali Laxmi Pujan (Muhurat session only)
  '2025-10-22', // Diwali Balipratipada
  '2025-11-05', // Prakash Gurpurb Sri Guru Nanak Dev
  '2025-12-25', // Christmas
  // 2026
  '2026-01-15', // Maharashtra municipal elections (special closure)
  '2026-01-26', // Republic Day
  '2026-03-03', // Holi
  '2026-03-26', // Shri Ram Navami
  '2026-03-31', // Shri Mahavir Jayanti
  '2026-04-03', // Good Friday
  '2026-04-14', // Dr. Baba Saheb Ambedkar Jayanti
  '2026-05-01', // Maharashtra Day
  '2026-05-28', // Bakri Id
  '2026-06-26', // Muharram
  '2026-09-14', // Ganesh Chaturthi
  '2026-10-02', // Mahatma Gandhi Jayanti
  '2026-10-20', // Dussehra
  '2026-11-10', // Diwali Balipratipada
  '2026-11-24', // Prakash Gurpurb Sri Guru Nanak Dev
  '2026-12-25', // Christmas
])

/** Covered years; a date outside them can't be checked against holidays. */
export const NSE_HOLIDAY_YEARS = [2024, 2025, 2026]

export function isTradingDay(day: string): boolean {
  const [y, m, d] = day.split('-').map(Number)
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return wd !== 0 && wd !== 6 && !NSE_HOLIDAYS.has(day)
}
