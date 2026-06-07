import "server-only";
import { privateKeyToAccount } from "viem/accounts";
import { x402Client } from "@x402/core/client";
import { ExactEvmScheme } from "@x402/evm";
import { wrapFetchWithPayment } from "@x402/fetch";
import type { Network } from "@x402/core/types";
import { X402_NETWORK } from "./monad";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Build a fetch wrapped with x402 auto-payment, signing with the demo agent's
 * server-side key (PAYER_PRIVATE_KEY). The facilitator covers the agent's gas,
 * so the payer needs only USDC.
 */
export function buildPayFetch() {
  const pk = process.env.PAYER_PRIVATE_KEY;
  if (!pk) return null;
  const account = privateKeyToAccount(
    pk.startsWith("0x") ? (pk as `0x${string}`) : (`0x${pk}` as `0x${string}`)
  );

  const evmSigner = {
    address: account.address,
    signTypedData: async (m: any) =>
      account.signTypedData({
        domain: m.domain,
        types: m.types,
        primaryType: m.primaryType,
        message: m.message,
      }),
  };

  const scheme = new ExactEvmScheme(evmSigner as any);
  const client = new x402Client().register(X402_NETWORK as Network, scheme as any);
  const payFetch = wrapFetchWithPayment(fetch, client);
  return { payFetch, address: account.address };
}
