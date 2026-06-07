import { NextRequest, NextResponse } from "next/server";
import { publicClient, STEALTH_CONTRACT } from "@/lib/monad";
import { stealthAbi } from "@/lib/stealthAbi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Look up a public alias → stealth meta-address (spend + view pubkeys). */
export async function GET(req: NextRequest) {
  const alias = req.nextUrl.searchParams.get("alias");
  if (!alias) return NextResponse.json({ error: "bad_request", message: "?alias= required" }, { status: 400 });
  if (!STEALTH_CONTRACT) return NextResponse.json({ error: "not_configured" }, { status: 500 });
  try {
    const [spendPub, viewPub, set] = (await publicClient.readContract({
      address: STEALTH_CONTRACT,
      abi: stealthAbi,
      functionName: "getMeta",
      args: [alias],
    })) as [`0x${string}`, `0x${string}`, boolean];
    return NextResponse.json({ alias, set, spendPub, viewPub });
  } catch (e) {
    return NextResponse.json({ error: "lookup_failed", message: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
