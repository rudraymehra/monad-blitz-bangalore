"use client";

import { useEffect, useState } from "react";
import NavBar from "../components/NavBar";

type Recent = {
  id: string;
  payer: string;
  amount: string;
  requestHash: string;
  timestamp: number;
  txHash: string | null;
  explorer: string | null;
};
type Data = {
  configured: boolean;
  total: number;
  recent: Recent[];
  byPayer: { payer: string; calls: number; volume: number }[];
  error?: string;
};

const short = (s: string) => (s ? `${s.slice(0, 6)}…${s.slice(-4)}` : s);

export default function Dashboard() {
  const [data, setData] = useState<Data | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/receipts", { cache: "no-store" });
      setData(await res.json());
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <main className="cyber-bg scanlines min-h-screen">
      <NavBar />

      <section className="mx-auto max-w-5xl px-6 pb-24 pt-10">
        <p className="font-display text-xs tracking-[0.35em] neon-magenta">// ON-CHAIN TELEMETRY</p>
        <h1 className="font-display mt-3 text-3xl font-black uppercase tracking-tight neon-cyan">Usage leaderboard</h1>
        <p className="mt-2 text-sm text-cyan-200/60">
          Read straight from the <span className="neon-cyan">UsageReceipts</span> contract on Monad — every row is a paid call.
        </p>

        {!data && (
          <div className="panel mt-8 animate-pulse p-5 font-display text-sm tracking-widest neon-cyan">
            ▮▮▮ READING RECEIPTS FROM MONAD…
          </div>
        )}

        {data && !data.configured && (
          <div className="panel panel-magenta mt-8 p-5 text-magenta neon-magenta">
            Contract not deployed yet. Set <code>NEXT_PUBLIC_RECEIPTS_CONTRACT</code> to light this up.
          </div>
        )}

        {data?.configured && (
          <>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <Stat label="TOTAL PAID CALLS" value={String(data.total)} accent="cyan" />
              <Stat label="UNIQUE PAYERS" value={String(data.byPayer.length)} accent="magenta" />
              <Stat label="USDC METERED" value={`$${data.byPayer.reduce((s, p) => s + p.volume, 0).toFixed(3)}`} accent="lime" />
            </div>

            <h2 className="font-display mt-10 text-xs tracking-widest neon-magenta">▍TOP PAYERS</h2>
            <div className="panel mt-3">
              {data.byPayer.length === 0 && <Empty />}
              {data.byPayer.map((p, i) => (
                <div key={p.payer} className="flex items-center justify-between border-b border-[var(--line)]/40 px-4 py-3 last:border-0">
                  <span className="flex items-center gap-3">
                    <span className="neon-magenta">#{i + 1}</span>
                    <span className="text-sm text-cyan-100">{short(p.payer)}</span>
                  </span>
                  <span className="text-sm text-cyan-200/60">
                    {p.calls} calls · <span className="neon-lime">${p.volume.toFixed(3)}</span>
                  </span>
                </div>
              ))}
            </div>

            <h2 className="font-display mt-10 text-xs tracking-widest neon-cyan">▍RECENT RECEIPTS</h2>
            <div className="panel mt-3">
              {data.recent.length === 0 && <Empty />}
              {data.recent.map((r) => (
                <div key={r.id} className="flex items-center justify-between border-b border-[var(--line)]/40 px-4 py-3 last:border-0">
                  <span className="flex items-center gap-3">
                    <span className="text-cyan-200/40">#{r.id}</span>
                    <span className="text-sm text-cyan-100">{short(r.payer)}</span>
                    <span className="text-xs text-cyan-200/30">{new Date(r.timestamp * 1000).toLocaleTimeString()}</span>
                  </span>
                  <span className="flex items-center gap-3 text-sm">
                    <span className="neon-lime">${r.amount}</span>
                    {r.explorer && (
                      <a href={r.explorer} target="_blank" className="text-cyan-200/60 hover:neon-magenta">
                        tx ↗
                      </a>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: "cyan" | "magenta" | "lime" }) {
  const cls = accent === "cyan" ? "neon-cyan" : accent === "magenta" ? "neon-magenta" : "neon-lime";
  return (
    <div className="panel p-5">
      <div className="font-display text-[10px] tracking-widest text-cyan-200/50">{label}</div>
      <div className={`mt-1 font-display text-3xl font-black ${cls}`}>{value}</div>
    </div>
  );
}

function Empty() {
  return <div className="px-4 py-6 text-sm text-cyan-200/40">No paid calls yet — run the agent on the home page.</div>;
}
