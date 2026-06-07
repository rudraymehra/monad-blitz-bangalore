// End-to-end test of the live StealthPay flow against the running dev server + Monad.
import { generateMetaKeys, deriveStealthAddress, checkAnnouncement } from "../lib/stealth.js";

const BASE = process.env.BASE || "http://localhost:3000";
let ok = true;
const check = (n, c) => { console.log(`${c ? "✅" : "❌"} ${n}`); ok = ok && c; };
const j = async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) });

// 1. Create a recipient identity (client-side keys)
const me = generateMetaKeys();
const alias = "agent-" + Math.floor(Date.now() / 1000);
console.log("recipient alias:", alias);

// 2. Register the public meta-address
const reg = await j(await fetch(`${BASE}/api/register`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ alias, spendPub: me.spendPub, viewPub: me.viewPub }),
}));
check("register → on-chain", reg.status === 200 && reg.body.ok);
console.log("   register tx:", reg.body.txHash);

// 3. Look up the meta-address (what a sender does)
const meta = (await j(await fetch(`${BASE}/api/meta?alias=${alias}`))).body;
check("meta lookup returns the registered keys", meta.set && meta.spendPub === me.spendPub && meta.viewPub === me.viewPub);

// 4. Sender derives a one-time stealth address + pays
const stealth = deriveStealthAddress(meta.spendPub, meta.viewPub);
console.log("   derived stealth address:", stealth.stealthAddress, "viewTag", stealth.viewTag);
const pay = await j(await fetch(`${BASE}/api/pay`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ ...stealth, amount: "0.02" }),
}));
check("pay → MON forwarded + announced", pay.status === 200 && pay.body.ok);
console.log("   pay tx:", pay.body.txHash);

// 5. The announcement shows up in the public feed
await new Promise((r) => setTimeout(r, 1500));
const ann = (await j(await fetch(`${BASE}/api/announcements`))).body;
const mine = (ann.announcements || []).filter(
  (a) => checkAnnouncement(me.viewPriv, me.spendPub, a.ephemeralPubKey, a.viewTag)?.toLowerCase() === a.stealthAddress.toLowerCase()
);
check("announcement is detectable by recipient viewing key", mine.some((a) => a.stealthAddress.toLowerCase() === stealth.stealthAddress.toLowerCase()));
console.log(`   scanned ${ann.count} announcements · ${mine.length} are mine`);

// 6. A stranger cannot detect it
const stranger = generateMetaKeys();
const strangerMine = (ann.announcements || []).filter(
  (a) => checkAnnouncement(stranger.viewPriv, stranger.spendPub, a.ephemeralPubKey, a.viewTag)?.toLowerCase() === a.stealthAddress.toLowerCase()
);
check("a stranger detects NONE of my payments", !strangerMine.some((a) => a.stealthAddress.toLowerCase() === stealth.stealthAddress.toLowerCase()));

console.log(`\nstealth address to verify on-chain: ${stealth.stealthAddress}`);
process.exit(ok ? 0 : 1);
