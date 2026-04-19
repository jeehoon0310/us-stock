import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { DOWNLOAD_COOKIE_NAME, isAuthorized } from "@/lib/download-auth";
import { listZips } from "@/lib/download-fs";
import { getDownloadCounts } from "@/lib/board-db";

export const dynamic = "force-dynamic";

export async function GET() {
  const c = (await cookies()).get(DOWNLOAD_COOKIE_NAME)?.value;
  if (!isAuthorized(c)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const counts = getDownloadCounts();
  const files = listZips().map((f) => ({
    ...f,
    download_count: counts[f.filename] ?? 0,
  }));
  return NextResponse.json({ files });
}
