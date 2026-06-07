import { NextRequest, NextResponse } from "next/server";
import { withX402, type RouteConfig } from "@x402/next";
import type { Network } from "@x402/core/types";
import { buildResourceServer } from "@/lib/x402-server";
import { summarize } from "@/lib/summarize";
import { recordReceipt } from "@/lib/record";
import { PAY_TO, PRICE_USDC_FALLBACK } from "@/lib/server";
import { X402_NETWORK, txUrl } from "@/lib/monad";

export const runtime = "nodejs";

const server = buildResourceServer();
const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

const routeConfig: RouteConfig = {
  accepts: {
    scheme: "exact",
    network: X402_NETWORK as Network,
    payTo: PAY_TO,
    price: `$${PRICE_USDC_FALLBACK}`,
  },
  resource: `${BASE}/api/premium`,
};

/**
 * The real x402-protected endpoint. `withX402` enforces a settled USDC payment
 * before this handler runs. The agent also sends `x-payer` so we can attribute
 * the on-chain receipt to the same address that paid.
 */
async function handler(req: NextRequest): Promise<NextResponse> {
  const payer = (req.headers.get("x-payer") ??
    "0x0000000000000000000000000000000000000000") as `0x${string}`;
  const { text } = await req.json().catch(() => ({ text: "" }));
  if (!text) {
    return NextResponse.json({ error: "bad_request", message: "Provide { text }" }, { status: 400 });
  }

  const { summary, model } = await summarize(text);

  let receipt: { txHash: string } | null = null;
  let receiptError: string | null = null;
  try {
    receipt = await recordReceipt({ payer, endpoint: "summarize", payload: text });
  } catch (e) {
    receiptError = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json({
    summary,
    model,
    payer,
    price: `$${PRICE_USDC_FALLBACK}`,
    receipt: receipt ? { txHash: receipt.txHash, explorer: txUrl(receipt.txHash) } : null,
    receiptError,
  });
}

export const POST = withX402(handler, routeConfig, server);
