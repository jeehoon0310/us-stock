import { getDataDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(searchParams.get("offset") ?? "0");

  const db = getDataDb();
  if (!db) {
    return Response.json({ posts: [], total: 0 }, { status: 200 });
  }

  try {
    const tableExists = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='data_mpva_posts'")
      .get();

    if (!tableExists) {
      return Response.json({ posts: [], total: 0 });
    }

    const total = (
      db.prepare("SELECT COUNT(*) as cnt FROM data_mpva_posts").get() as { cnt: number }
    ).cnt;

    const rows = db
      .prepare(
        `SELECT ntt_no, title, author, department, contact, content,
                date, views, url, files_json, fetched_at, created_at
         FROM data_mpva_posts
         ORDER BY date DESC, ntt_no DESC
         LIMIT ? OFFSET ?`
      )
      .all(limit, offset) as Array<{
        ntt_no: string;
        title: string;
        author: string;
        department: string;
        contact: string;
        content: string;
        date: string;
        views: number;
        url: string;
        files_json: string;
        fetched_at: string;
        created_at: string;
      }>;

    const posts = rows.map((r) => ({
      ...r,
      files: (() => { try { return JSON.parse(r.files_json || "[]"); } catch { return []; } })(),
    }));

    return Response.json({ posts, total });
  } catch (e) {
    console.error("[mpva] DB error:", e);
    return Response.json({ posts: [], total: 0 });
  }
}
