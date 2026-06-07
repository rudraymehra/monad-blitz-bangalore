"use client";

import { useEffect, useState } from "react";
import NavBar from "../components/NavBar";
import { generateMetaKeys } from "@/lib/stealth";
import {
  listIdentities,
  saveIdentity,
  getActive,
  setActiveAlias,
  type Identity,
} from "@/lib/identity";

const EXPLORER =
  process.env.NEXT_PUBLIC_MONAD_EXPLORER || "https://testnet.monadvision.com";

type Status =
  | { kind: "idle" }
  | { kind: "working"; msg: string }
  | { kind: "error"; msg: string }
  | { kind: "ok"; msg: string; txHash?: string };

function truncate(s: string) {
  if (!s) return "—";
  if (s.length <= 14) return s;
  return `${s.slice(0, 10)}…${s.slice(-6)}`;
}

export default function IdentityPage() {
  const [alias, setAlias] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [busy, setBusy] = useState(false);
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [active, setActive] = useState<Identity | null>(null);

  // Hydrate from localStorage on mount (client only).
  function refresh() {
    setIdentities(listIdentities());
    setActive(getActive());
  }
  useEffect(() => {
    refresh();
  }, []);

  function selectIdentity(a: string) {
    setActiveAlias(a);
    refresh();
  }

  async function handleGenerate() {
    const clean = alias.trim().toLowerCase();
    if (!clean) {
      setStatus({ kind: "error", msg: "Alias is required." });
      return;
    }
    if (!/^[a-z0-9._-]+$/.test(clean)) {
      setStatus({
        kind: "error",
        msg: "Alias must be alphanumeric (letters, digits, . _ - only).",
      });
      return;
    }

    setBusy(true);
    setStatus({ kind: "working", msg: "Generating keys & registering…" });
    try {
      const keys = generateMetaKeys();
      const id: Identity = { alias: clean, ...keys };
      // Persist locally FIRST — private keys never leave the browser.
      saveIdentity(id);
      refresh();

      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alias: clean,
          spendPub: keys.spendPub,
          viewPub: keys.viewPub,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus({
          kind: "error",
          msg: data?.message || data?.error || "Registration failed.",
        });
      } else {
        setStatus({
          kind: "ok",
          msg: "✓ registered on Monad",
          txHash: data?.txHash,
        });
        setAlias("");
        refresh();
      }
    } catch (e) {
      setStatus({
        kind: "error",
        msg: e instanceof Error ? e.message : "Unexpected error.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="cyber-bg scanlines min-h-screen">
      <NavBar />
      <section className="mx-auto max-w-5xl px-6 pb-24 pt-10">
        <p className="font-display text-xs tracking-[0.3em] neon-magenta">
          // STEALTH IDENTITY
        </p>
        <h1
          className="glitch font-display mt-4 text-4xl font-black tracking-wider text-cyan-50 sm:text-5xl"
          data-text="CREATE YOUR IDENTITY"
        >
          CREATE YOUR IDENTITY
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-cyan-100/75">
          Generate a stealth meta-address and register its public half on Monad
          so anyone can pay you privately.
        </p>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {/* Generate / register panel */}
          <div className="panel p-6">
            <label className="font-display block text-xs tracking-widest neon-cyan">
              ALIAS
            </label>
            <input
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !busy) handleGenerate();
              }}
              placeholder="e.g. agent-007"
              spellCheck={false}
              className="mt-2 w-full border border-[var(--line)] bg-black/50 p-3 text-sm text-cyan-100 outline-none focus:border-[var(--magenta)]"
            />

            <button
              onClick={handleGenerate}
              disabled={busy}
              className="neon-btn mt-4 w-full px-5 py-3 text-sm"
            >
              {busy ? "Registering…" : "Generate & Register"}
            </button>

            {/* Status */}
            {status.kind === "error" && (
              <p className="mt-4 text-sm neon-magenta">✗ {status.msg}</p>
            )}
            {status.kind === "working" && (
              <p className="mt-4 text-sm text-cyan-200/70">{status.msg}</p>
            )}
            {status.kind === "ok" && (
              <div className="mt-4 text-sm">
                <p className="neon-lime">{status.msg}</p>
                {status.txHash && (
                  <a
                    href={`${EXPLORER}/tx/${status.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="neon-cyan underline-offset-4 hover:underline"
                  >
                    view tx {truncate(status.txHash)} →
                  </a>
                )}
              </div>
            )}

            {/* Privacy note */}
            <div className="panel-magenta mt-6 p-4 text-xs leading-relaxed text-cyan-100/85">
              <span className="font-display neon-magenta">🔒 PRIVACY</span>{" "}
              <span className="ml-1">
                Your spend/view PRIVATE keys are generated and stored in THIS
                browser only — they are never sent to the server. Only the
                public meta-address is registered on-chain.
              </span>
            </div>
          </div>

          {/* Identities list + active meta-address */}
          <div className="panel p-6">
            <div className="font-display text-xs tracking-widest neon-cyan">
              YOUR IDENTITIES
            </div>

            {identities.length === 0 ? (
              <p className="mt-4 text-sm text-cyan-200/55">
                No identities yet. Generate one to publish your stealth
                meta-address.
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {identities.map((id) => {
                  const isActive = active?.alias === id.alias;
                  return (
                    <li key={id.alias}>
                      <button
                        onClick={() => selectIdentity(id.alias)}
                        className={`flex w-full items-center justify-between border p-3 text-left text-sm transition ${
                          isActive
                            ? "border-[var(--magenta)] neon-magenta"
                            : "border-[var(--line)] text-cyan-100/75 hover:border-[var(--cyan)]"
                        }`}
                      >
                        <span className="font-display tracking-wider">
                          {id.alias}
                        </span>
                        {isActive && (
                          <span className="chip px-2 py-0.5 text-[10px] tracking-wider">
                            ACTIVE
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {active && (
              <div className="mt-6 border-t border-[var(--line)] pt-4">
                <div className="font-display text-xs tracking-widest neon-lime">
                  PUBLIC META-ADDRESS · {active.alias}
                </div>
                <dl className="mt-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-cyan-200/55">spendPub</dt>
                    <dd className="text-cyan-100" title={active.spendPub}>
                      {truncate(active.spendPub)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-cyan-200/55">viewPub</dt>
                    <dd className="text-cyan-100" title={active.viewPub}>
                      {truncate(active.viewPub)}
                    </dd>
                  </div>
                </dl>
                <p className="mt-3 text-[11px] text-cyan-200/45">
                  Share this public meta-address — senders use it to derive
                  one-time addresses for you.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
