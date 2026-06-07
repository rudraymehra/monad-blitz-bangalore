import "server-only";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import type { Network } from "@x402/core/types";
import { USDC_ADDRESS, X402_FACILITATOR, X402_NETWORK, USDC_DECIMALS } from "./monad";

const NETWORK = X402_NETWORK as Network;

/** Build the x402 resource server (facilitator + EVM "exact" scheme for Monad USDC). */
export function buildResourceServer() {
  const facilitatorClient = new HTTPFacilitatorClient({ url: X402_FACILITATOR });
  const server = new x402ResourceServer(facilitatorClient);

  const scheme = new ExactEvmScheme();
  scheme.registerMoneyParser(async (amount: number, network: string) => {
    if (network === NETWORK) {
      return {
        amount: Math.floor(amount * 10 ** USDC_DECIMALS).toString(),
        asset: USDC_ADDRESS,
        extra: { name: "USDC", version: "2" },
      };
    }
    return null;
  });

  server.register(NETWORK, scheme);
  return server;
}
