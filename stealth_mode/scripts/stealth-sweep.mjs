// E2E test of the SWEEP path: pay a stealth address, then move the funds out via
// the same /api/txparams → local sign → /api/broadcast flow the browser uses.
import { generateMetaKeys, deriveStealthAddress, deriveStealthPrivKey } from "../lib/stealth.js";
import { privateKeyToAccount } from "viem/accounts";
import { createPublicClient, http, formatEther, parseEther } from "viem";

const BASE = process.env.BASE || "http://localhost:3000";
const RPC = "https://testnet-rpc.monad.xyz";
const pc = createPublicClient({ transport: http(RPC) });
const j = async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) });
let ok = true;
const check = (n, c) => { console.log(`${c ? "✅" : "❌"} ${n}`); ok = ok && c; };

// 1. recipient + payment
const me = generateMetaKeys();
const alias = "sweep-" + Math.floor(Date.now() / 1000);
await j(await fetch(`${BASE}/api/register`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ alias, spendPub: me.spendPub, viewPub: me.viewPub }) }));
const stealth = deriveStealthAddress(me.spendPub, me.viewPub);
await j(await fetch(`${BASE}/api/pay`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...stealth, amount: "0.03" }) }));
const startBal = await pc.getBalance({ address: stealth.stealthAddress });
check("stealth address funded", formatEther(startBal) === "0.03");

// 2. recipient derives the one-time private key (in "browser")
const pk = deriveStealthPrivKey(me.spendPriv, me.viewPriv, stealth.ephemeralPubKey);
const account = privateKeyToAccount(pk);
check("derived key controls the stealth address", account.address.toLowerCase() === stealth.stealthAddress.toLowerCase());

// 3. sweep: txparams → sign locally → broadcast (a fresh random destination)
const dest = privateKeyToAccount(generateMetaKeys().spendPriv).address; // empty wallet
const destBefore = await pc.getBalance({ address: dest });

const p = (await j(await fetch(`${BASE}/api/txparams?address=${account.address}`))).body;
const maxFeePerGas = BigInt(p.maxFeePerGas), maxPriorityFeePerGas = BigInt(p.maxPriorityFeePerGas);
const gas = 21000n;
const value = BigInt(p.balance) - gas * maxFeePerGas;
const signedTx = await account.signTransaction({ to: dest, value, gas, maxFeePerGas, maxPriorityFeePerGas, nonce: Number(p.nonce), chainId: Number(p.chainId), type: "eip1559" });
const bc = (await j(await fetch(`${BASE}/api/broadcast`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ signedTx }) }))).body;
check("broadcast accepted client-signed sweep tx", !!bc.ok && !!bc.hash);
console.log("   sweep tx:", bc.hash);

// 4. verify funds moved
await pc.waitForTransactionReceipt({ hash: bc.hash });
const destAfter = await pc.getBalance({ address: dest });
const stealthAfter = await pc.getBalance({ address: stealth.stealthAddress });
check("destination received the swept funds", destAfter > destBefore && destAfter === value);
// A small gas-reserve dust remains on purpose (we over-reserve so a base-fee spike can't underfund).
check("stealth address drained (only gas dust left)", stealthAfter < parseEther("0.005"));
console.log(`   destination +${formatEther(destAfter - destBefore)} MON · stealth left ${formatEther(stealthAfter)} MON`);

process.exit(ok ? 0 : 1);
