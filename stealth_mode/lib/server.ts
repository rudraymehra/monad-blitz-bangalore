import "server-only";
import { privateKeyToAccount } from "viem/accounts";
import { PRICE_USDC } from "./monad";

export const PRICE_USDC_FALLBACK = PRICE_USDC;

export const PAY_TO = (process.env.PAY_TO_ADDRESS ?? "") as `0x${string}`;

/** The demo "agent" account that pays per call (server-side). */
export function payerAccount() {
  const pk = process.env.PAYER_PRIVATE_KEY;
  if (!pk) return null;
  return privateKeyToAccount(pk.startsWith("0x") ? (pk as `0x${string}`) : (`0x${pk}` as `0x${string}`));
}
