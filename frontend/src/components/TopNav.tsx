"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n";
import { useEffect, useState } from "react";

export function TopNav() {
  const pathname = usePathname();
  const t = useT();
  const isBoard = pathname.startsWith("/board");
  const isDownload = pathname.startsWith("/download");
  const isAdmin = pathname.startsWith("/admin");
  const isTools = !isBoard && !isDownload && !isAdmin;

  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    fetch("/auth/me", { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.is_admin) setAdmin(true); })
      .catch(() => {});
  }, []);

  const cls = (active: boolean) =>
    active
      ? "text-primary font-bold"
      : "text-on-surface/60 hover:text-on-surface transition-colors";

  return (
    <nav className="hidden md:flex items-center gap-8 text-xs font-medium uppercase tracking-widest">
      <Link href="/" className={cls(isTools)}>
        {t("top.tools")}
      </Link>
      <Link href="/board" className={cls(isBoard)}>
        {t("top.board")}
      </Link>
      <Link href="/download" className={cls(isDownload)}>
        {t("top.download")}
      </Link>
      {admin && (
        <Link href="/admin" className={cls(isAdmin)}>
          ADMIN
        </Link>
      )}
    </nav>
  );
}
