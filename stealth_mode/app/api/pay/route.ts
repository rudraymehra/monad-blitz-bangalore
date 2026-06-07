import { NextRequest, NextResponse } from "next/server";
import { parseEther } from "viem";
import { relayWrite, STEALTH_CONTRACT, STEALTH_AMOUNT, txUrl } from "@/lib/monad";
import { stealthAbi } from "@/lib/stealthAbi";

export const runtime = "nodejs";

/** Send MON to a one-time stealth address and announce it on-chain. Relayer is the sender/bank. */
export async function POST(req: NextRequest) {
  const { stealthAddress, ephemeralPubKey, viewTag, amount } = await req.json().catch(() => ({}));
  if (!stealthAddress || !ephemeralPubKey || !viewTag) {
    return NextResponse.json({ error: "bad_request", message: "stealthAddress, ephemeralPubKey, viewTag required" }, { status: 400 });
  }
  if (!STEALTH_CONTRACT) return NextResponse.json({ error: "not_configured" }, { status: 500 });

  try {
    const value = parseEther(String(amount || STEALTH_AMOUNT));
    const tx = await relayWrite({
      address: STEALTH_CONTRACT,
      abi: stealthAbi,
      functionName: "payStealth",
      args: [stealthAddress as `0x${string}`, ephemeralPubKey as `0x${string}`, viewTag as `0x${string}`],
      value,
      gas: 200_000n,
    });
    return NextResponse.json({
      ok: true,
      stealthAddress,
      amount: String(amount || STEALTH_AMOUNT),
      txHash: tx,
      explorer: txUrl(tx),
    });
  } catch (e) {
    return NextResponse.json({ error: "pay_failed", message: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
