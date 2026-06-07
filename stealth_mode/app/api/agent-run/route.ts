import { NextRequest, NextResponse } from "next/server";
import { payerAccount } from "@/lib/server";

export const runtime = "nodejs";

/**
 * Simulates an autonomous agent that discovers the paid API and pays per call.
 * It first hits the endpoint UNPAID (to show the 402), then "pays" and retries.
 * This is the mock-first payment flow; the real-x402 version swaps the manual
 * retry for `wrapFetchWithPayment` (the agent signs a USDC payment automatically).
 */
export async function POST(req: NextRequest) {
  const { text } = await req.json().catch(() => ({ text: "" }));
  if (!text) {
    return NextResponse.json({ error: "bad_request", message: "Provide { text }" }, { status: 400 });
  }

  const payer = payerAccount();
  if (!payer) {
    return NextResponse.json(
      { error: "no_payer", message: "PAYER_PRIVATE_KEY not configured" },
      { status: 500 }
    );
  }

  const origin = new URL(req.url).origin;
  const endpoint = `${origin}/api/summarize`;
  const steps: { label: string; status: string; detail?: string }[] = [];

  // 1) Unpaid call → expect 402.
  const unpaid = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });
  steps.push({
    label: "Agent calls API (no payment)",
    status: unpaid.status === 402 ? "402 Payment Required" : `unexpected ${unpaid.status}`,
    detail: "Server demands payment before responding",
  });

  // 2) Pay (mock) and retry with the agent's address as the payer.
  steps.push({
    label: `Agent signs micropayment as ${short(payer.address)}`,
    status: "paid",
    detail: "USDC on Monad (x402 settles via the hosted facilitator)",
  });

  const paid = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", "x-payer": payer.address },
    body: JSON.stringify({ text }),
  });
  const result = await paid.json();
  steps.push({
    label: "Server returns the AI answer + on-chain receipt",
    status: paid.ok ? "200 OK" : `error ${paid.status}`,
    detail: result?.receipt?.txHash ? `receipt ${short(result.receipt.txHash)}` : "no receipt (pre-deploy)",
  });

  return NextResponse.json({ payer: payer.address, steps, result });
}

const short = (s: string) => (s ? `${s.slice(0, 6)}…${s.slice(-4)}` : s);
