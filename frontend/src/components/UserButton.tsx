"use client";
import { useEffect, useRef, useState } from "react";

interface UserInfo {
  name: string;
  email: string;
  is_admin: boolean;
}

export function UserButton() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.email) setUser(d); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function logout() {
    await fetch("/auth/logout", { method: "POST", credentials: "include" });
    window.location.href = "/login";
  }

  if (!user) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        className="p-2 hover:bg-surface-container-high rounded-lg transition-colors"
        title={user.name}
      >
        <span className="material-symbols-outlined text-on-surface">account_circle</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-52 bg-surface-container-high border border-outline-variant/20 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-outline-variant/10">
            <p className="text-sm font-semibold text-on-surface truncate">{user.name}</p>
            <p className="text-xs text-on-surface-variant truncate">{user.email}</p>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
            로그아웃
          </button>
        </div>
      )}
    </div>
  );
}
