"use client";

import { useState } from "react";
import NavBar from "../components/NavBar";
import { deriveStealthAddress } from "@/lib/stealth";

const EXPLORER = process.env.NEXT_PUBLIC_MONAD_EXPLORER ?? "https://testnet.monadvision.com";
const DEFAULT_AMOUNT = process.env.NEXT_PUBLIC_STEALTH_AMOUNT ?? "0.02";

type Meta = { alias: string; set: boolean; spendPub: string; viewPub: string };
type Step = { label: string; status: string; detail?: string };
type SendResult = {
  alias: string;
  stealthAddress: string;
  ephemeralPubKey: string;
  viewTag: string;
  amount: string;
  txHash: string;
  explorer: string;
};

const short = (s: string) => (s.length > 22 ? `${s.slice(0, 12)}…${s.slice(-8)}` : s);

export default function SendPage() {
  const [alias, setAlias] = useState("");
  const [amount, setAmount] = useState(DEFAULT_AMOUNT);
  const [loading, setLoading] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [result, setResult] = useState<SendResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function send() {
    const name = alias.trim();
    if (!name) return;
    setLoading(true);
    setErr(null);
    setResult(null);
    setSteps([{ label: `resolve meta-address for @${name}`, status: "RUNNING" }]);

    try {
      // 1 — resolve the recipient's public meta-address
      const metaRes = await fetch(`/api/meta?alias=${encodeURIComponent(name)}`);
      const meta = (await metaRes.json()) as Meta & { message?: string };
      if (!metaRes.ok) throw new Error(meta.message || "meta lookup failed");
      if (!meta.set) throw new Error(`alias @${name} is not registered`);

      setSteps([
        { label: `resolve meta-address for @${name}`, status: "OK", detail: `spendPub ${short(meta.spendPub)}` },
        { label: "derive one-time stealth address (ECDH, in your browser)", status: "RUNNING" },
      ]);

      // 2 — the magic: derive a fresh stealth address client-side. No secrets leave the browser.
      const { stealthAddress, ephemeralPubKey, viewTag } = deriveStealthAddress(meta.spendPub, meta.viewPub);

      setSteps([
        { label: `resolve meta-address for @${name}`, status: "OK", detail: `spendPub ${short(meta.spendPub)}` },
        { label: "derive one-time stealth address (ECDH, in your browser)", status: "OK", detail: short(stealthAddress) },
        { label: "pay + announce on Monad", status: "RUNNING" },
      ]);

      // 3 — relayer pays the stealth address and emits an on-chain announcement
      const payRes = await fetch("/api/pay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stealthAddress, ephemeralPubKey, viewTag, amount: amount.trim() || DEFAULT_AMOUNT }),
      });
      const pay = (await payRes.json()) as { ok?: boolean; stealthAddress: string; amount: string; txHash: string; explorer: string; message?: string };
      if (!payRes.ok || !pay.ok) throw new Error(pay.message || "payment failed");

      setSteps([
        { label: `resolve meta-address for @${name}`, status: "OK", detail: `spendPub ${short(meta.spendPub)}` },
        { label: "derive one-time stealth address (ECDH, in your browser)", status: "OK", detail: short(stealthAddress) },
        { label: "pay + announce on Monad", status: "OK", detail: short(pay.txHash) },
      ]);

      setResult({
        alias: name,
        stealthAddress: pay.stealthAddress,
        ephemeralPubKey,
        viewTag,
        amount: pay.amount,
        txHash: pay.txHash,
        explorer: pay.explorer,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setSteps((prev) => prev.map((s) => (s.status === "RUNNING" ? { ...s, status: "FAIL" } : s)));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="cyber-bg scanlines min-h-screen">
      <NavBar />

      <section className="mx-auto max-w-5xl px-6 pb-24 pt-10">
        <p className="mt-6 font-display text-xs tracking-[0.35em] text-magenta neon-magenta">// PAY IN THE SHADOWS</p>
        <h1
          className="glitch font-display mt-3 max-w-3xl text-4xl font-black uppercase leading-tight tracking-tight md:text-6xl neon-cyan"
          data-text="Send privately"
        >
          Send <span className="neon-magenta">privately</span>
        </h1>
        <p className="mt-5 max-w-2xl text-sm text-cyan-100/70 md:text-base">
          Pay anyone by their public alias. Your browser derives a{" "}
          <b className="neon-cyan">brand-new, untraceable stealth address</b> for this payment — on-chain it looks like
          a random wallet. Only the recipient&apos;s viewing key can ever link it back to them.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {/* INPUT */}
          <div className="panel p-5">
            <label className="font-display text-xs tracking-widest text-cyan-200/70">▍RECIPIENT // alias</label>
            <input
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder="e.g. neo"
              className="mt-3 w-full border border-[var(--line)] bg-black/50 p-3 text-sm text-cyan-100 outline-none focus:border-[var(--magenta)]"
            />

            <label className="mt-5 block font-display text-xs tracking-widest text-cyan-200/70">▍AMOUNT // MON</label>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={DEFAULT_AMOUNT}
              inputMode="decimal"
              className="mt-3 w-full border border-[var(--line)] bg-black/50 p-3 text-sm text-cyan-100 outline-none focus:border-[var(--magenta)]"
            />

            <button
              onClick={send}
              disabled={loading || !alias.trim()}
              className="neon-btn mt-6 w-full px-4 py-3 text-sm font-bold disabled:cursor-not-allowed"
            >
              {loading ? "◤ DERIVING & PAYING… ◥" : "▶ SEND PRIVATELY"}
            </button>

            {err && <p className="mt-4 text-sm text-red-400">⚠ {err}</p>}

            <p className="mt-4 text-xs text-cyan-200/40">
              ▸ The recipient never shares a wallet address. They publish a public meta-address; you derive a unique
              destination locally via ECDH.
            </p>
          </div>

          {/* TRACE */}
          <div className="panel panel-magenta p-5">
            <div className="font-display text-xs tracking-widest text-magenta neon-magenta">▍TRACE // resolve → derive → pay</div>

            {steps.length === 0 && !result && (
              <p className="mt-3 text-sm text-cyan-200/50">
                Enter an alias and hit <b className="neon-cyan">SEND PRIVATELY</b>. Watch the address get derived
                <b className="neon-magenta"> in your browser</b>, then paid + announced on Monad.
              </p>
            )}

            {steps.length > 0 && (
              <ol className="mt-3 space-y-2">
                {steps.map((s, i) => (
                  <li key={i} className="border border-[var(--line)] bg-black/40 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-cyan-100">
                        <span className="neon-magenta">{String(i + 1).padStart(2, "0")}</span> {s.label}
                      </span>
                      <span
                        className={`chip shrink-0 px-2 py-0.5 text-[10px] tracking-wider ${
                          s.status === "RUNNING" ? "animate-pulse" : ""
                        }`}
                      >
                        {s.status}
                      </span>
                    </div>
                    {s.detail && <div className="mt-1 break-all font-mono text-xs text-cyan-200/40">{s.detail}</div>}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        {/* RESULT */}
        {result && (
          <div className="panel mt-8 p-6">
            <div className="font-display text-xs tracking-widest neon-lime">✓ PAYMENT SENT // one-time stealth address</div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="border border-[var(--line)] bg-black/40 p-4">
                <div className="font-display text-[10px] uppercase tracking-widest neon-cyan">STEALTH ADDRESS</div>
                <a
                  href={`${EXPLORER}/address/${result.stealthAddress}`}
                  target="_blank"
                  className="mt-2 block break-all font-mono text-sm text-cyan-100 hover:underline"
                >
                  {result.stealthAddress} ↗
                </a>
              </div>

              <div className="border border-[var(--line)] bg-black/40 p-4">
                <div className="font-display text-[10px] uppercase tracking-widest neon-cyan">AMOUNT</div>
                <div className="mt-2 font-display text-2xl font-bold neon-lime">{result.amount} MON</div>
              </div>
            </div>

            <a
              href={result.explorer}
              target="_blank"
              className="mt-4 block break-all border border-[rgba(255,61,240,0.4)] bg-[rgba(255,61,240,0.06)] p-3 text-sm neon-magenta hover:bg-[rgba(255,61,240,0.12)]"
            >
              💸 PAYMENT TX → {short(result.txHash)} ↗
            </a>

            <p className="mt-5 border border-[var(--line)] bg-black/40 p-4 text-sm leading-relaxed text-cyan-100/80">
              🕶️ This is a brand-new address derived just for this payment. On-chain it looks random — nobody can link
              it to <b className="neon-magenta">{result.alias}</b>. Only{" "}
              <b className="neon-magenta">{result.alias}</b>&apos;s viewing key can detect it.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
