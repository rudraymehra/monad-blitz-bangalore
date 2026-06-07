import { privateKeyToAccount } from "viem/accounts";
import { formatEther } from "viem";

/**
 * Sweep a stealth address to a destination. The one-time stealth private key is
 * used ONLY here, in the browser, to sign locally — only the signed transaction
 * is sent to the server to broadcast. We sweep (balance − gas budget) so the
 * stealth address pays its own gas from the funds it received.
 */
export async function sweepStealth(stealthPriv: string, destination: string) {
  const account = privateKeyToAccount(stealthPriv as `0x${string}`);

  const p = await (await fetch(`/api/txparams?address=${account.address}`)).json();
  if (p.error) throw new Error(p.error);

  const balance = BigInt(p.balance);
  const maxFeePerGas = BigInt(p.maxFeePerGas);
  const maxPriorityFeePerGas = BigInt(p.maxPriorityFeePerGas);
  const gas = 21000n;
  const feeBudget = gas * maxFeePerGas; // worst-case fee; leftover stays as dust
  if (balance <= feeBudget) throw new Error("Balance too low to cover gas");
  const value = balance - feeBudget;

  const signedTx = await account.signTransaction({
    to: destination as `0x${string}`,
    value,
    gas,
    maxFeePerGas,
    maxPriorityFeePerGas,
    nonce: Number(p.nonce),
    chainId: Number(p.chainId),
    type: "eip1559",
  });

  const res = await fetch("/api/broadcast", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ signedTx }),
  });
  const out = await res.json();
  if (!res.ok || !out.ok) throw new Error(out.message || out.error || "broadcast failed");
  return { hash: out.hash as string, explorer: out.explorer as string, value: formatEther(value) };
}
