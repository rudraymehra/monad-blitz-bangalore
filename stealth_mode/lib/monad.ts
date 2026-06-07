import { createPublicClient, createWalletClient, defineChain, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

// ---- Monad Testnet (verified: docs.monad.xyz/developer-essentials/testnets) ----
export const MONAD_CHAIN_ID = Number(process.env.NEXT_PUBLIC_MONAD_CHAIN_ID ?? 10143);
export const MONAD_RPC = process.env.NEXT_PUBLIC_MONAD_RPC ?? "https://testnet-rpc.monad.xyz";
export const EXPLORER = process.env.NEXT_PUBLIC_MONAD_EXPLORER ?? "https://testnet.monadvision.com";

export const monadTestnet = defineChain({
  id: MONAD_CHAIN_ID,
  name: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [MONAD_RPC] } },
  blockExplorers: { default: { name: "MonadVision", url: EXPLORER } },
  testnet: true,
});

// ---- Agent-economy constants ----
export const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC ??
  "0x534b2f3A21130d7a60830c2Df862319e593943A3") as `0x${string}`;
export const USDC_DECIMALS = 6;
export const X402_FACILITATOR =
  process.env.NEXT_PUBLIC_X402_FACILITATOR ?? "https://x402-facilitator.molandak.org";
export const X402_NETWORK = process.env.NEXT_PUBLIC_X402_NETWORK ?? "eip155:10143";
export const PRICE_USDC = process.env.NEXT_PUBLIC_PRICE_USDC ?? "0.001";

export const RECEIPTS_CONTRACT = (process.env.NEXT_PUBLIC_RECEIPTS_CONTRACT ??
  "") as `0x${string}` | "";
export const DEPLOY_BLOCK = BigInt(process.env.NEXT_PUBLIC_DEPLOY_BLOCK || "0");

// StealthPay
export const STEALTH_CONTRACT = (process.env.NEXT_PUBLIC_STEALTH_CONTRACT ??
  "") as `0x${string}` | "";
export const STEALTH_DEPLOY_BLOCK = BigInt(process.env.NEXT_PUBLIC_STEALTH_DEPLOY_BLOCK || "0");
export const STEALTH_AMOUNT = process.env.NEXT_PUBLIC_STEALTH_AMOUNT ?? "0.02"; // MON per private payment

export const txUrl = (hash: string) => `${EXPLORER}/tx/${hash}`;
export const addrUrl = (a: string) => `${EXPLORER}/address/${a}`;

// ---- Read client (public) ----
export const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(MONAD_RPC),
});

// ---- Write client (server relayer) — used to record() receipts on-chain ----
export function relayerClient() {
  const pk = process.env.RELAYER_PRIVATE_KEY;
  if (!pk) return null;
  const account = privateKeyToAccount(pk.startsWith("0x") ? (pk as `0x${string}`) : (`0x${pk}` as `0x${string}`));
  const wallet = createWalletClient({ account, chain: monadTestnet, transport: http(MONAD_RPC) });
  return { wallet, account };
}

/**
 * Robust relayer write: fetches the pending nonce explicitly and retries on
 * nonce races / transient RPC errors (Monad's fast blocks can lag the pending
 * nonce after a tx confirms). Awaits the receipt and asserts success.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function relayWrite(opts: any): Promise<`0x${string}`> {
  const r = relayerClient();
  if (!r) throw new Error("Relayer not configured");
  let lastErr: unknown;
  for (let i = 0; i < 4; i++) {
    try {
      const nonce = await publicClient.getTransactionCount({ address: r.account.address, blockTag: "pending" });
      const hash = await r.wallet.writeContract({ account: r.account, chain: monadTestnet, nonce, ...opts });
      const rcpt = await publicClient.waitForTransactionReceipt({ hash });
      if (rcpt.status !== "success") throw new Error(`reverted ${hash}`);
      return hash;
    } catch (e) {
      lastErr = e;
      await new Promise((s) => setTimeout(s, 500 * (i + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
