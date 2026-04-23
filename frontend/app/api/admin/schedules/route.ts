import { getDataDb } from "@/lib/db";

export const dynamic = "force-dynamic";

interface ScheduleRow {
  id: string;
  name: string;
  name_en: string;
  cron_kst: string;
  cron_desc: string;
  category: string;
  enabled: number;
  last_run_at: string | null;
  last_status: string | null;
  last_duration_sec: number | null;
  next_run_at: string | null;
  run_count: number;
  history_json: string;
}

const STATIC_SCHEDULES = [
  { id: "main_pipeline",   name: "메인 분석 파이프라인", name_en: "Main Analysis Pipeline",  cron_kst: "0 7 * * 1-5",       cron_desc: "평일 매일 07:00 KST",             category: "daily",     enabled: true  },
  { id: "sp500_update",    name: "S&P500 구성종목 갱신",  name_en: "S&P 500 List Update",     cron_kst: "0 8 1 * *",          cron_desc: "매월 1일 08:00 KST",             category: "monthly",   enabled: false },
  { id: "holdings_13f",    name: "13F 홀딩스 업데이트",   name_en: "13F Holdings Update",     cron_kst: "0 8 1 2,5,8,11 *",  cron_desc: "분기별 1일 08:00 KST (2/5/8/11월)", category: "quarterly", enabled: false },
  { id: "ml_retrain",      name: "ML 모델 재훈련",        name_en: "ML Model Retrain",        cron_kst: "0 8 * * 0",          cron_desc: "매주 일요일 08:00 KST",           category: "weekly",    enabled: false },
  { id: "backtest_verify", name: "성능 검증 (백테스트)",  name_en: "Backtest Verification",   cron_kst: "0 18 * * 5",         cron_desc: "매주 금요일 18:00 KST",           category: "weekly",    enabled: false },
  { id: "research_agent",  name: "리서치 에이전트",        name_en: "Research Agent",          cron_kst: "0 9 * * 1",          cron_desc: "매주 월요일 09:00 KST",           category: "weekly",    enabled: false },
  { id: "system_health",   name: "시스템 상태 점검",       name_en: "System Health Check",     cron_kst: "30 9 * * 1",         cron_desc: "매주 월요일 09:30 KST",           category: "weekly",    enabled: false },
].map((s) => ({ ...s, last_run_at: null, last_status: null, last_duration_sec: null, next_run_at: null, run_count: 0, history: [] }));

export async function GET() {
  const db = getDataDb();
  console.log("[schedules] db:", db ? "ok" : "null");
  if (!db) return Response.json(STATIC_SCHEDULES);

  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='data_schedules'").all();
    console.log("[schedules] table check:", JSON.stringify(tables));

    const rows = db
      .prepare(
        `SELECT * FROM data_schedules
         ORDER BY CASE category
           WHEN 'daily'     THEN 1
           WHEN 'weekly'    THEN 2
           WHEN 'monthly'   THEN 3
           WHEN 'quarterly' THEN 4
           ELSE 5
         END, id`
      )
      .all() as ScheduleRow[];

    console.log("[schedules] row count:", rows.length, "first:", JSON.stringify(rows[0]));
    if (rows.length === 0) return Response.json(STATIC_SCHEDULES);

    const schedules = rows.map((r) => ({
      id: r.id,
      name: r.name,
      name_en: r.name_en,
      cron_kst: r.cron_kst,
      cron_desc: r.cron_desc,
      category: r.category,
      enabled: r.enabled === 1,
      last_run_at: r.last_run_at,
      last_status: r.last_status,
      last_duration_sec: r.last_duration_sec,
      next_run_at: r.next_run_at,
      run_count: r.run_count,
      history: (() => {
        try { return JSON.parse(r.history_json || "[]"); }
        catch { return []; }
      })(),
    }));

    return Response.json(schedules);
  } catch (e) {
    // data_schedules table may not exist yet on older DB
    console.error("[schedules] DB query error:", e);
    return Response.json(STATIC_SCHEDULES);
  }
}
