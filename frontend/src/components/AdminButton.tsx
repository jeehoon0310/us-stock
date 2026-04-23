"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

export function AdminButton() {
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    fetch("/auth/me", { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.is_admin) setIsAdmin(true); })
      .catch(() => {});
  }, []);

  if (!isAdmin) return null;

  return (
    <Link
      href="/admin"
      className="p-2 hover:bg-surface-container-high rounded-lg transition-colors"
      title="관리자 패널"
    >
      <span className="material-symbols-outlined text-on-surface">manage_accounts</span>
    </Link>
  );
}
