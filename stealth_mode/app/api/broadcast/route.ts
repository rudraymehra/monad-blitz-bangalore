import { NextRequest, NextResponse } from "next/server";
import { publicClient, txUrl } from "@/lib/monad";

export const runtime = "nodejs";

/** Broadcast a CLIENT-SIGNED transaction. The server never sees a private key —
 *  only the already-signed transaction blob. Used by the stealth-address sweep. */
export async function POST(req: NextRequest) {
  const { signedTx } = await req.json().catch(() => ({}));
  if (!signedTx) return NextResponse.json({ error: "signedTx required" }, { status: 400 });
  try {
    const hash = await publicClient.sendRawTransaction({ serializedTransaction: signedTx as `0x${string}` });
    return NextResponse.json({ ok: true, hash, explorer: txUrl(hash) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "broadcast_failed", message: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
