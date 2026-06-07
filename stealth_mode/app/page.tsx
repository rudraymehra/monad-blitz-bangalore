"use client";

import Link from "next/link";
import NavBar from "./components/NavBar";

const EXPLORER =
  process.env.NEXT_PUBLIC_MONAD_EXPLORER || "https://testnet.monadvision.com";
const CONTRACT = process.env.NEXT_PUBLIC_STEALTH_CONTRACT || "";

const TITLE = "UNTRACEABLE PAYMENTS FOR AGENTS";

const FEATURES = [
  {
    tag: "STEALTH META-ADDRESS",
    accent: "neon-cyan",
    body: "Publish your public meta-address once. Receive forever — no new address to share per payment.",
  },
  {
    tag: "ONE-TIME ADDRESSES",
    accent: "neon-magenta",
    body: "Every payment lands at a fresh, unlinkable on-chain address derived via ECDH. Nothing repeats.",
  },
  {
    tag: "ONLY YOU CAN SEE IT",
    accent: "neon-lime",
    body: "Your private viewing key detects which payments are yours. No one else can link them to you.",
  },
];

const CTAS = [
  { n: "①", label: "CREATE IDENTITY", href: "/identity", accent: "neon-cyan" },
  { n: "②", label: "SEND PRIVATELY", href: "/send", accent: "neon-magenta" },
  { n: "③", label: "SCAN & RECEIVE", href: "/receive", accent: "neon-lime" },
];

function truncate(addr: string) {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function Home() {
  return (
    <main className="cyber-bg scanlines min-h-screen">
      <NavBar />
      <section className="mx-auto max-w-5xl px-6 pb-24 pt-10">
        {/* Hero */}
        <p className="font-display text-xs tracking-[0.3em] neon-magenta">
          // PRIVATE PAYMENTS · MONAD
        </p>
        <h1
          className="glitch font-display mt-4 text-4xl font-black leading-tight tracking-wider text-cyan-50 sm:text-6xl"
          data-text={TITLE}
        >
          {TITLE}
        </h1>
        <div className="mt-6 max-w-2xl space-y-2 text-sm leading-relaxed text-cyan-100/80">
          <p>
            Recipients publish a single public{" "}
            <span className="neon-cyan">stealth meta-address</span>. Senders
            derive a <span className="neon-magenta">fresh one-time address</span>{" "}
            for every payment using ECDH key agreement.
          </p>
          <p>
            Only the recipient&apos;s private{" "}
            <span className="neon-lime">viewing key</span> can detect and spend
            those funds. On-chain observers can never link payments back to a
            recipient.
          </p>
        </div>

        {/* Feature cards */}
        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.tag} className="panel p-5">
              <div
                className={`font-display text-sm font-bold tracking-widest ${f.accent}`}
              >
                {f.tag}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-cyan-100/70">
                {f.body}
              </p>
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div className="mt-12">
          <p className="font-display text-xs tracking-[0.3em] text-cyan-200/50">
            // GET STARTED
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {CTAS.map((c) => (
              <Link
                key={c.href}
                href={c.href}
                className="panel group flex items-center justify-between p-5 transition hover:border-[var(--magenta)]"
              >
                <span>
                  <span className={`font-display text-2xl ${c.accent}`}>
                    {c.n}
                  </span>
                  <span className="font-display ml-3 text-sm tracking-widest text-cyan-50">
                    {c.label}
                  </span>
                </span>
                <span className="neon-magenta text-lg transition group-hover:translate-x-1">
                  →
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-16 flex flex-wrap items-center gap-3 border-t border-[var(--line)] pt-6 text-xs text-cyan-200/50">
          <span className="chip px-3 py-1 text-[10px] tracking-wider">
            ◢ MONAD TESTNET
          </span>
          <span>Stealth registry contract:</span>
          <a
            href={`${EXPLORER}/address/${CONTRACT}`}
            target="_blank"
            rel="noopener noreferrer"
            className="neon-cyan underline-offset-4 hover:underline"
          >
            {truncate(CONTRACT)}
          </a>
        </footer>
      </section>
    </main>
  );
}
