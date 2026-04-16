"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function TopNav() {
  const pathname = usePathname();
  const isBoard = pathname.startsWith("/board");
  const activeCls = "text-primary font-bold";
  const inactiveCls = "text-on-surface/60 hover:text-on-surface transition-colors";

  return (
    <nav className="hidden md:flex items-center gap-8 text-xs font-medium uppercase tracking-widest">
      <Link href="/" className={isBoard ? inactiveCls : activeCls}>
        Tools
      </Link>
      <Link href="/board" className={isBoard ? activeCls : inactiveCls}>
        Board
      </Link>
      <span className={`${inactiveCls} cursor-pointer`}>
        Download
      </span>
    </nav>
  );
}
