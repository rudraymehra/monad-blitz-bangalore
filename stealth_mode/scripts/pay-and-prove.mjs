// Make ONE real private payment, then prove it's on-chain & real.
// Prints clickable explorer links + reads the chain directly to confirm the money is there.
import { generateMetaKeys, deriveStealthAddress, checkAnnouncement } from "../lib/stealth.js";
import { createPublicClient, http, formatEther } from "viem";

const BASE = process.env.BASE || "http://localhost:3000";
const RPC = "https://testnet-rpc.monad.xyz";
const EXPLORER = "https://testnet.monadvision.com";
const AMOUNT = process.env.AMOUNT || "0.02";
const pc = createPublicClient({ transport: http(RPC) });
const j = async (r) => await r.json().catch(() => ({}));
const line = () => console.log("─".repeat(64));

// 1) recipient identity + register
const me = generateMetaKeys();
const alias = "proof-" + Math.floor(Date.now() / 1000);
console.log(`\n▶ Recipient alias: @${alias}`);
const reg = await j(await fetch(`${BASE}/api/register`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ alias, spendPub: me.spendPub, viewPub: me.viewPub }) }));
if (!reg.ok) { console.log("❌ register failed:", reg.message || reg.error); process.exit(1); }

// 2) sender derives a one-time stealth address + pays (real MON on Monad)
const stealth = deriveStealthAddress(me.spendPub, me.viewPub);
const pay = await j(await fetch(`${BASE}/api/pay`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...stealth, amount: AMOUNT }) }));
if (!pay.ok) { console.log("❌ payment failed:", pay.message || pay.error); process.exit(1); }

line(); console.log("💸 PAYMENT SENT"); line();
console.log(`  amount:          ${AMOUNT} MON`);
console.log(`  to alias:        @${alias}  (privately — never revealed on-chain)`);
console.log(`  stealth address: ${stealth.stealthAddress}`);
console.log(`  payment tx:      ${pay.txHash}`);

// 3) PROVE it on-chain (read the chain directly, not our app)
const rcpt = await pc.getTransactionReceipt({ hash: pay.txHash });
const bal = await pc.getBalance({ address: stealth.stealthAddress });
line(); console.log("🔗 ON-CHAIN PROOF (read straight from Monad)"); line();
console.log(`  tx status:            ${rcpt.status === "success" ? "✅ success" : "❌ " + rcpt.status} (block ${rcpt.blockNumber})`);
console.log(`  funds at address:     ${formatEther(bal)} MON  ${formatEther(bal) === AMOUNT ? "✅ matches" : "(check)"}`);

// 4) privacy: recipient detects it; a stranger cannot
// poll the feed until this payment's announcement is indexed (handles RPC/indexing lag)
let ann = { announcements: [] };
for (let t = 0; t < 8; t++) {
  await new Promise((r) => setTimeout(r, 2000));
  ann = await j(await fetch(`${BASE}/api/announcements`));
  if ((ann.announcements || []).some((a) => a.stealthAddress.toLowerCase() === stealth.stealthAddress.toLowerCase())) break;
}
const mine = (ann.announcements || []).some((a) => checkAnnouncement(me.viewPriv, me.spendPub, a.ephemeralPubKey, a.viewTag)?.toLowerCase() === stealth.stealthAddress.toLowerCase());
const stranger = generateMetaKeys();
const seen = (ann.announcements || []).some((a) => a.stealthAddress.toLowerCase() === stealth.stealthAddress.toLowerCase() && checkAnnouncement(stranger.viewPriv, stranger.spendPub, a.ephemeralPubKey, a.viewTag)?.toLowerCase() === a.stealthAddress.toLowerCase());
line(); console.log("🕶️  PRIVACY"); line();
console.log(`  recipient detects it:  ${mine ? "✅ yes" : "❌ no"}`);
console.log(`  stranger detects it:   ${seen ? "❌ yes (leak!)" : "✅ no"}`);

// 5) what YOU click to verify
line(); console.log("👉 VERIFY IT YOURSELF — open these in a browser:"); line();
console.log(`  payment tx:      ${EXPLORER}/tx/${pay.txHash}`);
console.log(`  stealth address: ${EXPLORER}/address/${stealth.stealthAddress}`);
console.log(`  the contract:    ${EXPLORER}/address/0x12536828dc40dE3f5184D202Ea0130E0B6B0A14a`);
console.log("");

const ok = rcpt.status === "success" && formatEther(bal) === AMOUNT && mine && !seen;
console.log(ok ? "✅ PAYMENT IS REAL AND ON-CHAIN." : "⚠ something didn't line up — see above.");
process.exit(ok ? 0 : 1);
