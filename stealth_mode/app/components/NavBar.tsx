"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "HOME" },
  { href: "/identity", label: "IDENTITY" },
  { href: "/send", label: "SEND" },
  { href: "/receive", label: "RECEIVE" },
  { href: "/feed", label: "FEED" },
];

export default function NavBar() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[rgba(6,7,14,0.72)] backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        {/* logo → home */}
        <Link href="/" className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center border border-[var(--line)] text-lg neon-cyan">⚡</div>
          <div className="leading-tight">
            <div className="font-display text-sm font-bold tracking-widest neon-cyan">STEALTHMODE</div>
            <div className="text-[10px] text-cyan-200/40">untraceable payments · Monad</div>
          </div>
        </Link>

        {/* tabs */}
        <nav className="flex items-center gap-1">
          {TABS.map((t) => {
            const active = path === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`font-display border-b-2 px-3 py-1.5 text-xs tracking-widest transition ${
                  active
                    ? "border-[var(--magenta)] neon-magenta"
                    : "border-transparent text-cyan-200/55 hover:text-cyan-100"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
          <span className="chip ml-3 hidden px-3 py-1 text-[10px] tracking-wider sm:inline">◢ MONAD TESTNET</span>
        </nav>
      </div>
    </header>
  );
}
