import { NextResponse } from "next/server";
import { formatUnits, parseAbiItem, type Log } from "viem";
import { publicClient, RECEIPTS_CONTRACT, DEPLOY_BLOCK, USDC_DECIMALS, txUrl } from "@/lib/monad";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const usedEvent = parseAbiItem(
  "event Used(uint256 indexed id, address indexed payer, bytes32 indexed endpointId, bytes32 requestHash, uint96 amount, uint64 timestamp)"
);
type UsedLog = Log<bigint, number, false, typeof usedEvent>;

// Monad's public RPC caps eth_getLogs to a 100-block range, so we page in windows.
// We fetch windows in parallel batches and keep an in-memory cache so each poll only
// scans the NEW blocks since the last scan (fast + complete).
const SPAN = 99n; // toBlock - fromBlock must be < 100
const BATCH = 8; // concurrent getLogs per batch (retries handle transient failures)

let cache: { logs: UsedLog[]; last: bigint } | null = null;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// getLogs for one window, with retries — so a transient RPC failure never silently
// drops a window (which would under-count the leaderboard).
async function windowLogs(a: bigint, b: bigint, tries = 4): Promise<UsedLog[]> {
  for (let i = 0; i < tries; i++) {
    try {
      return (await publicClient.getLogs({
        address: RECEIPTS_CONTRACT as `0x${string}`,
        event: usedEvent,
        fromBlock: a,
        toBlock: b,
      })) as UsedLog[];
    } catch (e) {
      if (i === tries - 1) throw e;
      await sleep(150 * (i + 1));
    }
  }
  return [];
}

async function fetchWindows(from: bigint, to: bigint): Promise<UsedLog[]> {
  const ranges: [bigint, bigint][] = [];
  for (let s = from; s <= to; s += SPAN + 1n) ranges.push([s, s + SPAN > to ? to : s + SPAN]);
  const out: UsedLog[] = [];
  for (let i = 0; i < ranges.length; i += BATCH) {
    const chunk = ranges.slice(i, i + BATCH);
    const results = await Promise.all(chunk.map(([a, b]) => windowLogs(a, b)));
    for (const r of results) out.push(...r);
  }
  return out;
}

export async function GET() {
  if (!RECEIPTS_CONTRACT) {
    return NextResponse.json({ configured: false, total: 0, recent: [], byPayer: [] });
  }

  try {
    const snapshot = cache; // stable read (avoid double-merge under concurrent requests)
    const latest = await publicClient.getBlockNumber();
    // Cold scan always starts at the deploy block (contract is fresh, so this is
    // complete and bounded); after that we only scan new blocks (incremental cache).
    const from = snapshot ? snapshot.last + 1n : DEPLOY_BLOCK;

    const fresh = from <= latest ? await fetchWindows(from, latest) : [];

    // Merge with the cache and DEDUPE by receipt id (unique, sequential) — so an
    // overlapping/concurrent scan can never double-count.
    const byId = new Map<string, UsedLog>();
    for (const l of [...(snapshot?.logs ?? []), ...fresh]) {
      byId.set(String(l.args.id ?? `${l.transactionHash}-${l.logIndex}`), l);
    }
    const logs = [...byId.values()].sort((a, b) =>
      Number((a.args.id ?? 0n) - (b.args.id ?? 0n))
    );
    cache = { logs, last: latest > (snapshot?.last ?? 0n) ? latest : snapshot!.last };

    const recent = logs
      .slice(-50)
      .reverse()
      .map((l) => ({
        id: String(l.args.id ?? 0n),
        payer: (l.args.payer ?? "0x") as string,
        amount: formatUnits(l.args.amount ?? 0n, USDC_DECIMALS),
        requestHash: (l.args.requestHash ?? "0x") as string,
        timestamp: Number(l.args.timestamp ?? 0n),
        txHash: l.transactionHash,
        explorer: l.transactionHash ? txUrl(l.transactionHash) : null,
      }));

    // Leaderboard over ALL logs (not just the recent slice).
    const tally: Record<string, { calls: number; volume: number }> = {};
    for (const l of logs) {
      const payer = (l.args.payer ?? "0x") as string;
      tally[payer] ??= { calls: 0, volume: 0 };
      tally[payer].calls += 1;
      tally[payer].volume += Number(formatUnits(l.args.amount ?? 0n, USDC_DECIMALS));
    }
    const byPayer = Object.entries(tally)
      .map(([payer, v]) => ({ payer, calls: v.calls, volume: v.volume }))
      .sort((a, b) => b.calls - a.calls);

    return NextResponse.json({ configured: true, total: logs.length, recent, byPayer });
  } catch (e) {
    return NextResponse.json({
      configured: true,
      total: 0,
      recent: [],
      byPayer: [],
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
