import { NextRequest, NextResponse } from "next/server";
import { summarize } from "@/lib/summarize";
import { recordReceipt } from "@/lib/record";
import { PAY_TO, PRICE_USDC_FALLBACK } from "@/lib/server";
import { USDC_ADDRESS, X402_NETWORK, txUrl } from "@/lib/monad";

export const runtime = "nodejs";

/**
 * The paid AI endpoint. In x402 terms this is a "resource server" route.
 * MVP gate (mock-first): a paid request carries an `x-payer` header (the agent's
 * address). Without it we return HTTP 402 with the payment requirements — exactly
 * what a real x402 client reads before paying. Swapping in real x402 = wrapping
 * this handler with `withX402` (the body below stays the same).
 */
export async function POST(req: NextRequest) {
  const payer = req.headers.get("x-payer") as `0x${string}` | null;

  if (!payer) {
    // 402 Payment Required — advertise how to pay (x402-shaped).
    return NextResponse.json(
      {
        error: "payment_required",
        message: `Pay $${PRICE_USDC_FALLBACK} USDC to use this endpoint.`,
        accepts: [
          {
            scheme: "exact",
            network: X402_NETWORK,
            asset: USDC_ADDRESS,
            payTo: PAY_TO,
            price: `$${PRICE_USDC_FALLBACK}`,
          },
        ],
      },
      { status: 402 }
    );
  }

  const { text } = await req.json().catch(() => ({ text: "" }));
  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "bad_request", message: "Provide { text }" }, { status: 400 });
  }

  // Do the paid work.
  const { summary, model } = await summarize(text);

  // Anchor a tamper-evident usage receipt on Monad (best-effort; null pre-deploy).
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
    receipt: receipt
      ? { txHash: receipt.txHash, explorer: txUrl(receipt.txHash) }
      : null,
    receiptError,
  });
}
