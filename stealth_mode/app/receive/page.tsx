"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import NavBar from "../components/NavBar";
import { checkAnnouncement, deriveStealthPrivKey } from "@/lib/stealth";
import { getActive, type Identity } from "@/lib/identity";
import { sweepStealth } from "@/lib/sweep";

const EXPLORER = process.env.NEXT_PUBLIC_MONAD_EXPLORER ?? "https://testnet.monadvision.com";

type Announcement = {
  stealthAddress: string;
  sender: string;
  ephemeralPubKey: string;
  viewTag: string;
  amount: string;
  txHash: string | null;
  explorer: string | null;
  block: number;
};

type Detected = Announcement & { spendable: boolean };

const short = (s: string) => (s.length > 22 ? `${s.slice(0, 12)}…${s.slice(-8)}` : s);

export default function ReceivePage() {
  const [me, setMe] = useState<Identity | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scanned, setScanned] = useState(0);
  const [mine, setMine] = useState<Detected[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const meRef = useRef<Identity | null>(null);

  // sweep state
  const [dest, setDest] = useState("");
  const [sweeps, setSweeps] = useState<Record<string, { status: "sweeping" | "done" | "error"; tx?: string; explorer?: string; msg?: string }>>({});

  async function doSweep(m: Detected) {
    const identity = meRef.current;
    if (!identity) return;
    if (!/^0x[0-9a-fA-F]{40}$/.test(dest.trim())) {
      setSweeps((s) => ({ ...s, [m.stealthAddress]: { status: "error", msg: "Enter a valid 0x destination address above" } }));
      return;
    }
    setSweeps((s) => ({ ...s, [m.stealthAddress]: { status: "sweeping" } }));
    try {
      const pk = deriveStealthPrivKey(identity.spendPriv, identity.viewPriv, m.ephemeralPubKey) as string;
      const r = await sweepStealth(pk, dest.trim());
      setSweeps((s) => ({ ...s, [m.stealthAddress]: { status: "done", tx: r.hash, explorer: r.explorer } }));
    } catch (e) {
      setSweeps((s) => ({ ...s, [m.stealthAddress]: { status: "error", msg: e instanceof Error ? e.message : String(e) } }));
    }
  }

  // resolve active identity on mount (localStorage is client-only)
  useEffect(() => {
    const active = getActive();
    meRef.current = active;
    setMe(active);
    setReady(true);
  }, []);

  const scan = useCallback(async () => {
    const identity = meRef.current;
    if (!identity) return;
    try {
      const res = await fetch("/api/announcements");
      const json = (await res.json()) as { configured: boolean; count?: number; announcements: Announcement[]; error?: string };
      if (json.error) setErr(json.error);
      else setErr(null);

      const list = json.announcements ?? [];
      setScanned(list.length);

      const detected: Detected[] = [];
      for (const a of list) {
        const got = checkAnnouncement(identity.viewPriv, identity.spendPub, a.ephemeralPubKey, a.viewTag) as string | null;
        if (got && got.toLowerCase() === a.stealthAddress.toLowerCase()) {
          // confirm we can derive the controlling key (proves spendability) — key is NEVER displayed
          let spendable = false;
          try {
            const pk = deriveStealthPrivKey(identity.spendPriv, identity.viewPriv, a.ephemeralPubKey) as string;
            spendable = typeof pk === "string" && pk.startsWith("0x") && pk.length === 66;
          } catch {
            spendable = false;
          }
          detected.push({ ...a, spendable });
        }
      }
      detected.sort((x, y) => y.block - x.block);
      setMine(detected);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  // first scan + auto-refresh every 5s
  useEffect(() => {
    if (!ready || !me) return;
    setLoading(true);
    scan();
    const id = setInterval(scan, 5000);
    return () => clearInterval(id);
  }, [ready, me, scan]);

  const total = mine.reduce((sum, m) => sum + (parseFloat(m.amount) || 0), 0);

  return (
    <main className="cyber-bg scanlines min-h-screen">
      <NavBar />

      <section className="mx-auto max-w-5xl px-6 pb-24 pt-10">
        <p className="mt-6 font-display text-xs tracking-[0.35em] text-magenta neon-magenta">// SCAN THE CHAIN</p>
        <h1
          className="glitch font-display mt-3 max-w-3xl text-4xl font-black uppercase leading-tight tracking-tight md:text-6xl neon-cyan"
          data-text="Receive privately"
        >
          Receive <span className="neon-magenta">privately</span>
        </h1>

        {/* no identity */}
        {ready && !me && (
          <div className="panel mt-10 p-6">
            <div className="font-display text-sm tracking-widest neon-magenta">⚠ NO IDENTITY YET</div>
            <p className="mt-3 text-sm text-cyan-100/70">
              You need a stealth identity (a spend + view key pair) before you can scan for private payments.
            </p>
            <Link
              href="/identity"
              className="neon-btn mt-5 inline-block px-5 py-3 text-sm font-bold"
            >
              ▶ CREATE ONE ON THE IDENTITY PAGE
            </Link>
          </div>
        )}

        {/* has identity */}
        {ready && me && (
          <>
            <p className="mt-5 max-w-2xl text-sm text-cyan-100/70 md:text-base">
              Scanning every on-chain announcement with the viewing key for{" "}
              <b className="neon-cyan">@{me.alias}</b>. Only payments meant for you will resolve — the rest stay
              unrelated random addresses.
            </p>

            {loading && mine.length === 0 ? (
              <p className="mt-10 animate-pulse font-display text-sm tracking-widest neon-cyan">
                ▮▮▮ SCANNING ANNOUNCEMENTS…
              </p>
            ) : (
              <>
                {/* header / stats */}
                <div className="panel mt-10 flex flex-wrap items-center justify-between gap-4 p-6">
                  <div>
                    <div className="font-display text-lg font-bold tracking-wide neon-cyan">
                      DETECTED {mine.length} PRIVATE PAYMENT{mine.length === 1 ? "" : "S"} FOR @{me.alias}
                    </div>
                    <div className="mt-2 text-xs text-cyan-200/50">
                      scanned {scanned} · {mine.length} {mine.length === 1 ? "is" : "are"} yours · auto-refresh 5s
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-[10px] uppercase tracking-widest text-cyan-200/50">TOTAL RECEIVED</div>
                    <div className="font-display text-3xl font-bold neon-lime">{total.toFixed(4)} MON</div>
                  </div>
                </div>

                {mine.length > 0 && (
                  <div className="panel mt-4 p-4">
                    <label className="font-display text-[10px] uppercase tracking-widest text-cyan-200/60">
                      SWEEP TO — your main wallet address
                    </label>
                    <input
                      value={dest}
                      onChange={(e) => setDest(e.target.value)}
                      placeholder="0x… destination to move the funds into"
                      className="mt-2 w-full border border-[var(--line)] bg-black/50 p-2.5 font-mono text-sm text-cyan-100 outline-none focus:border-[var(--magenta)]"
                    />
                    <p className="mt-2 text-[11px] text-cyan-200/40">
                      Signed in your browser with the one-time key — only the signed tx is broadcast. A little MON is
                      kept for gas, the rest is swept out.
                    </p>
                  </div>
                )}

                {err && <p className="mt-4 text-xs text-amber-400/80">⚠ {err}</p>}

                {/* empty state */}
                {mine.length === 0 ? (
                  <div className="panel panel-magenta mt-6 p-6">
                    <div className="font-display text-sm tracking-widest neon-magenta">⌁ NO PAYMENTS YET</div>
                    <p className="mt-3 text-sm text-cyan-100/70">
                      Nothing addressed to <b className="neon-cyan">@{me.alias}</b> on-chain so far. Have someone pay
                      your alias from the{" "}
                      <Link href="/send" className="neon-cyan hover:underline">
                        Send page
                      </Link>{" "}
                      — it&apos;ll appear here automatically within a few seconds.
                    </p>
                  </div>
                ) : (
                  <div className="mt-6 space-y-4">
                    {mine.map((m) => (
                      <div key={`${m.txHash}-${m.stealthAddress}`} className="panel p-5">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="font-display text-[10px] uppercase tracking-widest neon-cyan">STEALTH ADDRESS</div>
                            <a
                              href={`${EXPLORER}/address/${m.stealthAddress}`}
                              target="_blank"
                              className="mt-1 block break-all font-mono text-sm text-cyan-100 hover:underline"
                            >
                              {m.stealthAddress} ↗
                            </a>
                          </div>
                          <div className="text-right">
                            <div className="font-display text-[10px] uppercase tracking-widest text-cyan-200/50">AMOUNT</div>
                            <div className="font-display text-xl font-bold neon-lime">{m.amount} MON</div>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          {m.spendable && (
                            <span className="chip px-2 py-0.5 text-[10px] tracking-wider neon-lime" style={{ color: "var(--lime)" }}>
                              ✓ SPENDABLE
                            </span>
                          )}
                          {m.explorer && (
                            <a
                              href={m.explorer}
                              target="_blank"
                              className="text-xs neon-magenta hover:underline"
                            >
                              💸 tx {m.txHash ? short(m.txHash) : ""} ↗
                            </a>
                          )}
                          <span className="text-xs text-cyan-200/40">block {m.block}</span>

                          {sweeps[m.stealthAddress]?.status === "done" ? (
                            <a href={sweeps[m.stealthAddress]?.explorer} target="_blank" className="text-xs neon-lime hover:underline">
                              ✓ SWEPT → tx ↗
                            </a>
                          ) : sweeps[m.stealthAddress]?.status === "sweeping" ? (
                            <span className="animate-pulse text-xs neon-cyan">⤓ sweeping…</span>
                          ) : (
                            <button
                              onClick={() => doSweep(m)}
                              className="chip px-2 py-0.5 text-[10px] tracking-wider hover:neon-magenta"
                            >
                              ⤓ SWEEP OUT
                            </button>
                          )}
                          {sweeps[m.stealthAddress]?.status === "error" && (
                            <span className="text-xs text-amber-400/80">{sweeps[m.stealthAddress]?.msg}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <p className="mt-8 border border-[var(--line)] bg-black/40 p-4 text-sm leading-relaxed text-cyan-100/80">
                  🕶️ Only your viewing key could find these among all on-chain announcements. To everyone else they are
                  unrelated random addresses.
                </p>
              </>
            )}
          </>
        )}
      </section>
    </main>
  );
}
