import { keccak256, toHex, stringToBytes, parseUnits } from "viem";
import { publicClient, relayerClient, RECEIPTS_CONTRACT, USDC_DECIMALS, PRICE_USDC } from "./monad";
import { receiptsAbi } from "./receiptsAbi";

export const endpointId = (name: string) => keccak256(stringToBytes(name));
export const requestHash = (payload: string) => keccak256(stringToBytes(payload));

/**
 * Append a usage receipt on-chain. Returns the tx hash, or null if the contract
 * / relayer isn't configured (so the API still works pre-deploy).
 *
 * Monad gotcha (docs.monad.xyz/developer-essentials/gas-pricing): gas is charged
 * on the gas LIMIT, not gas used — so we set an explicit, modest limit and we
 * await the receipt + check status (a tx can be included yet revert).
 */
export async function recordReceipt(opts: {
  payer: `0x${string}`;
  endpoint: string;
  payload: string;
  amountUsdc?: string;
}): Promise<{ txHash: string; receiptId?: string } | null> {
  if (!RECEIPTS_CONTRACT) return null;
  const r = relayerClient();
  if (!r) return null;

  const amount = parseUnits(opts.amountUsdc ?? PRICE_USDC, USDC_DECIMALS); // USDC 6dp
  const args = [
    opts.payer,
    endpointId(opts.endpoint),
    requestHash(opts.payload),
    amount,
  ] as const;

  const txHash = await r.wallet.writeContract({
    address: RECEIPTS_CONTRACT,
    abi: receiptsAbi,
    functionName: "record",
    args,
    gas: 800_000n, // explicit, generous-but-bounded limit (cold storage writes ~230k); Monad charges the limit
  });

  const rcpt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (rcpt.status !== "success") {
    throw new Error(`record() reverted (tx ${txHash})`);
  }
  return { txHash };
}

export const toBytes32Hex = (s: string) => toHex(stringToBytes(s));
