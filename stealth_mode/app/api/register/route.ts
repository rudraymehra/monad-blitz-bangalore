import { NextRequest, NextResponse } from "next/server";
import { relayWrite, STEALTH_CONTRACT, txUrl } from "@/lib/monad";
import { stealthAbi } from "@/lib/stealthAbi";

export const runtime = "nodejs";

/** Register a public alias → stealth meta-address. Relayer pays gas. */
export async function POST(req: NextRequest) {
  const { alias, spendPub, viewPub } = await req.json().catch(() => ({}));
  if (!alias || !spendPub || !viewPub) {
    return NextResponse.json({ error: "bad_request", message: "alias, spendPub, viewPub required" }, { status: 400 });
  }
  if (!STEALTH_CONTRACT) return NextResponse.json({ error: "not_configured" }, { status: 500 });

  try {
    const tx = await relayWrite({
      address: STEALTH_CONTRACT,
      abi: stealthAbi,
      functionName: "register",
      args: [alias, spendPub as `0x${string}`, viewPub as `0x${string}`],
      gas: 400_000n,
    });
    return NextResponse.json({ ok: true, alias, txHash: tx, explorer: txUrl(tx) });
  } catch (e) {
    return NextResponse.json({ error: "register_failed", message: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
