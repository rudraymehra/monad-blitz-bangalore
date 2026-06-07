import { NextRequest, NextResponse } from "next/server";
import { buildPayFetch } from "@/lib/x402-client";
import { txUrl } from "@/lib/monad";

export const runtime = "nodejs";

/* eslint-disable @typescript-eslint/no-explicit-any */

const short = (s: string) => (s ? `${s.slice(0, 6)}…${s.slice(-4)}` : s);

/**
 * The REAL x402 agent: it auto-pays USDC (via the hosted facilitator on Monad)
 * to unlock the paid endpoint — actual on-chain settlement, no mock.
 */
export async function POST(req: NextRequest) {
  const { text } = await req.json().catch(() => ({ text: "" }));
  if (!text) return NextResponse.json({ error: "bad_request", message: "Provide { text }" }, { status: 400 });

  const pf = buildPayFetch();
  if (!pf) return NextResponse.json({ error: "no_payer", message: "PAYER_PRIVATE_KEY not set" }, { status: 500 });

  const endpoint = `${new URL(req.url).origin}/api/premium`;
  const steps: { label: string; status: string; detail?: string }[] = [
    { label: "Agent discovers paid API", status: "x402", detail: "endpoint replies 402 Payment Required" },
  ];

  let result: any = null;
  let settlement: { tx: string; explorer: string } | null = null;
  let error: string | null = null;

  try {
    const res = await pf.payFetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", "x-payer": pf.address },
      body: JSON.stringify({ text }),
    });
    result = await res.json().catch(() => null);

    // Best-effort: pull the settlement tx hash from the x402 payment-response header.
    const h =
      res.headers.get("x-payment-response") ||
      res.headers.get("payment-response") ||
      res.headers.get("x-payment");
    if (h) {
      try {
        const decoded = JSON.parse(
          typeof atob === "function" ? atob(h) : Buffer.from(h, "base64").toString("utf8")
        );
        const tx = decoded?.transaction || decoded?.txHash || decoded?.transactionHash;
        if (tx) settlement = { tx, explorer: txUrl(tx) };
      } catch {
        /* header not base64 json — ignore */
      }
    }

    steps.push({
      label: `Agent paid USDC as ${short(pf.address)}`,
      status: "settled on Monad",
      detail: settlement ? `settle ${short(settlement.tx)}` : "facilitator settled the USDC transfer",
    });
    steps.push({
      label: "Server returns AI answer + on-chain receipt",
      status: res.ok ? "200 OK" : `error ${res.status}`,
      detail: result?.receipt?.txHash ? `receipt ${short(result.receipt.txHash)}` : "no receipt",
    });
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    steps.push({ label: "x402 payment failed", status: "error", detail: error });
  }

  return NextResponse.json({ payer: pf.address, mode: "x402", steps, result, settlement, error });
}
