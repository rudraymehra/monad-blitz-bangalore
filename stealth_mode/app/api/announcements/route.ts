import { NextResponse } from "next/server";
import { formatEther, parseAbiItem, type Log } from "viem";
import { publicClient, STEALTH_CONTRACT, STEALTH_DEPLOY_BLOCK, txUrl } from "@/lib/monad";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ev = parseAbiItem(
  "event Announcement(uint256 indexed schemeId, address indexed stealthAddress, address indexed sender, bytes ephemeralPubKey, bytes1 viewTag, uint256 amount)"
);
type Ann = Log<bigint, number, false, typeof ev>;

const SPAN = 99n;
const BATCH = 8;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let cache: { logs: Ann[]; last: bigint } | null = null;

async function windowLogs(a: bigint, b: bigint, tries = 4): Promise<Ann[]> {
  for (let i = 0; i < tries; i++) {
    try {
      return (await publicClient.getLogs({
        address: STEALTH_CONTRACT as `0x${string}`,
        event: ev,
        fromBlock: a,
        toBlock: b,
      })) as Ann[];
    } catch (e) {
      if (i === tries - 1) throw e;
      await sleep(150 * (i + 1));
    }
  }
  return [];
}

async function fetchWindows(from: bigint, to: bigint): Promise<Ann[]> {
  const ranges: [bigint, bigint][] = [];
  for (let s = from; s <= to; s += SPAN + 1n) ranges.push([s, s + SPAN > to ? to : s + SPAN]);
  const out: Ann[] = [];
  for (let i = 0; i < ranges.length; i += BATCH) {
    const res = await Promise.all(ranges.slice(i, i + BATCH).map(([a, b]) => windowLogs(a, b)));
    for (const r of res) out.push(...r);
  }
  return out;
}

/**
 * Returns ALL Announcement events (public data only — stealth address, ephemeral
 * pubkey, viewTag, amount). The viewing key never touches the server: the client
 * filters these to find its own payments. Windowed + cached for Monad's 100-block cap.
 */
export async function GET() {
  if (!STEALTH_CONTRACT) return NextResponse.json({ configured: false, announcements: [] });
  try {
    const snapshot = cache;
    const latest = await publicClient.getBlockNumber();
    const from = snapshot ? snapshot.last + 1n : STEALTH_DEPLOY_BLOCK;
    const fresh = from <= latest ? await fetchWindows(from, latest) : [];

    const byKey = new Map<string, Ann>();
    for (const l of [...(snapshot?.logs ?? []), ...fresh]) {
      byKey.set(`${l.transactionHash}-${l.logIndex}`, l);
    }
    const logs = [...byKey.values()];
    cache = { logs, last: latest > (snapshot?.last ?? 0n) ? latest : snapshot!.last };

    const announcements = logs
      .map((l) => ({
        stealthAddress: l.args.stealthAddress as string,
        sender: l.args.sender as string,
        ephemeralPubKey: l.args.ephemeralPubKey as string,
        viewTag: l.args.viewTag as string,
        amount: formatEther(l.args.amount ?? 0n),
        txHash: l.transactionHash,
        explorer: l.transactionHash ? txUrl(l.transactionHash) : null,
        block: Number(l.blockNumber ?? 0n),
      }))
      .sort((a, b) => a.block - b.block);

    return NextResponse.json({ configured: true, count: announcements.length, announcements });
  } catch (e) {
    return NextResponse.json({ configured: true, count: 0, announcements: [], error: e instanceof Error ? e.message : String(e) });
  }
}
