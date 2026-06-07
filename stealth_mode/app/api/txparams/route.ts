import { NextRequest, NextResponse } from "next/server";
import { publicClient, MONAD_CHAIN_ID } from "@/lib/monad";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Read-only tx params for a stealth address so the client can sign a sweep locally. */
export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address") as `0x${string}` | null;
  if (!address) return NextResponse.json({ error: "address required" }, { status: 400 });
  try {
    const [balance, nonce, gasPrice] = await Promise.all([
      publicClient.getBalance({ address }),
      publicClient.getTransactionCount({ address, blockTag: "pending" }),
      publicClient.getGasPrice(),
    ]);
    const maxPriorityFeePerGas = gasPrice / 10n > 0n ? gasPrice / 10n : 1_000_000_000n;
    const maxFeePerGas = gasPrice * 2n + maxPriorityFeePerGas;
    return NextResponse.json({
      balance: balance.toString(),
      nonce,
      maxFeePerGas: maxFeePerGas.toString(),
      maxPriorityFeePerGas: maxPriorityFeePerGas.toString(),
      chainId: MONAD_CHAIN_ID,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
