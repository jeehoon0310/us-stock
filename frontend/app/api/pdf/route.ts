import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const src = request.nextUrl.searchParams.get("src") ?? "";
  if (!src.startsWith("/prompts/") || !src.endsWith(".html")) {
    return new NextResponse("Invalid src", { status: 400 });
  }

  const origin = request.nextUrl.origin;
  const url = `${origin}${src}`;
  const filename = path.basename(src, ".html") + ".pdf";

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });

    // Slide deck: trigger beforeprint to expand all slides
    const isSlide = await page.evaluate(
      () => typeof (window as unknown as { ALL?: unknown }).ALL !== "undefined"
    );
    if (isSlide) {
      await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
      await new Promise((r) => setTimeout(r, 600));
    }

    const pdf = await page.pdf({
      format: "A4",
      landscape: isSlide,
      printBackground: true,
      margin: isSlide
        ? { top: "8mm", bottom: "8mm", left: "8mm", right: "8mm" }
        : { top: "12mm", bottom: "12mm", left: "12mm", right: "12mm" },
    });

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-cache",
      },
    });
  } finally {
    await browser.close();
  }
}
