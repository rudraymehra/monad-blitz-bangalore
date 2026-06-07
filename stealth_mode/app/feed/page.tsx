"use client";

import { useEffect, useState } from "react";
import NavBar from "../components/NavBar";

const EXPLORER = process.env.NEXT_PUBLIC_MONAD_EXPLORER ?? "https://testnet.monadvision.com";

type Ann = {
  stealthAddress: string;
  sender: string;
  amount: string;
  txHash: string | null;
  explorer: string | null;
  block: number;
};
type Data = { configured: boolean; count: number; announcements: Ann[] };

const short = (s: string) => (s ? `${s.slice(0, 8)}…${s.slice(-6)}` : s);

export default function FeedPage() {
  const [data, setData] = useState<Data | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/announcements", { cache: "no-store" });
      setData(await res.json());
    } catch {
      /* ignore */
    }
  }
  useEffect(() => {
    load();
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, []);

  const list = [...(data?.announcements ?? [])].reverse(); // newest first
  const total = list.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);

  return (
    <main className="cyber-bg scanlines min-h-screen">
      <NavBar />
      <section className="mx-auto max-w-5xl px-6 pb-24 pt-10">
      <p className="font-display text-xs tracking-[0.35em] neon-magenta">// LIVE FROM MONAD</p>
      <h1
        className="glitch font-display mt-3 text-4xl font-black uppercase tracking-tight neon-cyan md:text-6xl"
        data-text="Payment feed"
      >
        Payment <span className="neon-magenta">feed</span>
      </h1>
      <p className="mt-4 max-w-2xl text-sm text-cyan-100/70">
        Every stealth payment on StealthMode, streaming live from the chain. Each lands at a fresh
        one-time address — <b className="neon-cyan">recipients are hidden</b>; only a recipient&apos;s
        viewing key knows which are theirs.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="panel p-5">
          <div className="font-display text-[10px] uppercase tracking-widest text-cyan-200/50">TOTAL PRIVATE PAYMENTS</div>
          <div className="font-display mt-1 text-3xl font-black neon-cyan">{data?.count ?? "…"}</div>
        </div>
        <div className="panel p-5">
          <div className="font-display text-[10px] uppercase tracking-widest text-cyan-200/50">MON MOVED (shown)</div>
          <div className="font-display mt-1 text-3xl font-black neon-lime">{total.toFixed(3)}</div>
        </div>
      </div>

      <div className="panel mt-6">
        {!data && <div className="animate-pulse p-6 font-display text-sm tracking-widest neon-cyan">▮▮▮ LOADING FEED…</div>}
        {data && list.length === 0 && (
          <div className="p-6 text-sm text-cyan-200/50">No payments yet — send one from the SEND page and watch it appear here.</div>
        )}
        {list.map((a, i) => (
          <div key={`${a.txHash}-${i}`} className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)]/40 px-4 py-3 last:border-0">
            <span className="flex items-center gap-3">
              <span className="text-cyan-200/40">#{list.length - i}</span>
              <a href={`${EXPLORER}/address/${a.stealthAddress}`} target="_blank" className="font-mono text-sm text-cyan-100 hover:neon-magenta">
                {short(a.stealthAddress)} ↗
              </a>
              <span className="text-xs text-cyan-200/30">block {a.block}</span>
            </span>
            <span className="flex items-center gap-3 text-sm">
              <span className="neon-lime">{a.amount} MON</span>
              {a.explorer && (
                <a href={a.explorer} target="_blank" className="text-xs text-cyan-200/60 hover:neon-magenta">
                  tx ↗
                </a>
              )}
            </span>
          </div>
        ))}
      </div>

      <p className="mt-6 text-xs text-cyan-200/40">Auto-refreshes every 4s · read directly from the StealthMode contract on Monad.</p>
      </section>
    </main>
  );
}
