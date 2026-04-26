import { dbUnavailable, getDataDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

// NYSE 휴장일 (미국 시장 공휴일)
const US_MARKET_HOLIDAYS = new Set([
  "2025-01-01","2025-01-20","2025-02-17","2025-04-18",
  "2025-05-26","2025-07-04","2025-09-01","2025-11-27","2025-12-25",
  "2026-01-01","2026-01-19","2026-02-16","2026-04-03",
  "2026-05-25","2026-07-03","2026-09-07","2026-11-26","2026-12-25",
  "2027-01-01","2027-01-18","2027-02-15","2027-03-26",
  "2027-05-31","2027-07-05","2027-09-06","2027-11-25","2027-12-24",
]);

function isTradingDay(dateStr: string): boolean {
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDay(); // 0=일, 6=토
  return day !== 0 && day !== 6 && !US_MARKET_HOLIDAYS.has(dateStr);
}

export async function GET() {
  const db = getDataDb();
  if (!db) return dbUnavailable();

  const rows = db.prepare(
    'SELECT date FROM data_daily_reports ORDER BY date ASC'
  ).all() as { date: string }[];

  return Response.json({ dates: rows.map((r) => r.date).filter(isTradingDay) });
}
