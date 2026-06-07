// Multi-agent stress test for StealthPay: many agents, many private payments,
// verifying detection, cross-agent privacy, unlinkability, and on-chain delivery.
import { generateMetaKeys, deriveStealthAddress, checkAnnouncement } from "../lib/stealth.js";
import { createPublicClient, http, formatEther } from "viem";

const BASE = process.env.BASE || "http://localhost:3000";
const RPC = "https://testnet-rpc.monad.xyz";
const AMOUNT = "0.01";
const pc = createPublicClient({ transport: http(RPC) });
const j = async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) });
let ok = true;
const check = (n, c) => { console.log(`${c ? "✅" : "❌"} ${n}`); ok = ok && c; };
const tag = Math.floor(Date.now() / 1000);

// How many payments each agent should receive (one agent gets ZERO on purpose).
const PLAN = { alice: 2, bob: 1, carol: 3, dave: 1, eve: 0 };
const agents = {};

console.log(`\n=== 1. Register ${Object.keys(PLAN).length} agents ===`);
for (const name of Object.keys(PLAN)) {
  const keys = generateMetaKeys();
  const alias = `${name}-${tag}`;
  const reg = await j(await fetch(`${BASE}/api/register`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ alias, spendPub: keys.spendPub, viewPub: keys.viewPub }),
  }));
  agents[name] = { alias, keys, sentTo: [] };
  check(`register ${alias}`, reg.status === 200 && reg.body.ok);
}

console.log(`\n=== 2. Send private payments (plan: ${JSON.stringify(PLAN)}) ===`);
let totalPayments = 0;
for (const [name, count] of Object.entries(PLAN)) {
  for (let i = 0; i < count; i++) {
    const a = agents[name];
    // sender looks up the public meta + derives a fresh one-time address
    const meta = (await j(await fetch(`${BASE}/api/meta?alias=${a.alias}`))).body;
    const stealth = deriveStealthAddress(meta.spendPub, meta.viewPub);
    const pay = await j(await fetch(`${BASE}/api/pay`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...stealth, amount: AMOUNT }),
    }));
    const good = pay.status === 200 && pay.body.ok;
    a.sentTo.push(stealth.stealthAddress.toLowerCase());
    totalPayments += good ? 1 : 0;
    check(`pay #${i + 1} → ${name} (${stealth.stealthAddress.slice(0, 10)}…)`, good);
  }
}

console.log(`\n=== 3. Each agent scans the public feed ===`);
// poll until every successfully-sent address is indexed (handles RPC/indexing lag)
const wantAddrs = new Set(Object.values(agents).flatMap((a) => a.sentTo));
let ann = { count: 0, announcements: [] };
for (let tries = 0; tries < 8; tries++) {
  await new Promise((r) => setTimeout(r, 2000));
  ann = (await j(await fetch(`${BASE}/api/announcements`))).body;
  const have = new Set((ann.announcements || []).map((x) => x.stealthAddress.toLowerCase()));
  if ([...wantAddrs].every((s) => have.has(s))) break;
}
console.log(`   ${ann.count} total announcements on-chain`);

let detectedTotal = 0;
for (const [name, a] of Object.entries(agents)) {
  const mine = (ann.announcements || [])
    .filter((x) => checkAnnouncement(a.keys.viewPriv, a.keys.spendPub, x.ephemeralPubKey, x.viewTag)?.toLowerCase() === x.stealthAddress.toLowerCase())
    .map((x) => x.stealthAddress.toLowerCase());
  const expected = new Set(a.sentTo);
  const got = new Set(mine);
  const exact = expected.size === got.size && [...expected].every((s) => got.has(s));
  detectedTotal += mine.length;
  check(`${name} detects exactly its ${PLAN[name]} payment(s)`, exact);
}

console.log(`\n=== 4. Cross-agent privacy (no agent sees another's payments) ===`);
for (const [name, a] of Object.entries(agents)) {
  const othersAddrs = new Set(Object.entries(agents).filter(([n]) => n !== name).flatMap(([, o]) => o.sentTo));
  const leaked = (ann.announcements || []).some(
    (x) => othersAddrs.has(x.stealthAddress.toLowerCase()) &&
      checkAnnouncement(a.keys.viewPriv, a.keys.spendPub, x.ephemeralPubKey, x.viewTag)?.toLowerCase() === x.stealthAddress.toLowerCase()
  );
  check(`${name} canNOT see anyone else's payments`, !leaked);
}

console.log(`\n=== 5. Unlinkability + zero-payment agent ===`);
check("carol's 3 payments are 3 DIFFERENT addresses", new Set(agents.carol.sentTo).size === 3);
check("eve (0 payments) detects nothing", true === (agents.eve.sentTo.length === 0));

console.log(`\n=== 6. Unregistered alias lookup ===`);
const ghost = (await j(await fetch(`${BASE}/api/meta?alias=ghost-${tag}`))).body;
check("unregistered alias returns set:false", ghost.set === false);

console.log(`\n=== 7. On-chain: funds actually landed at each stealth address ===`);
const allStealth = Object.values(agents).flatMap((a) => a.sentTo);
let landed = 0;
for (const addr of allStealth) {
  const bal = await pc.getBalance({ address: addr });
  if (formatEther(bal) === "0.01") landed++;
}
check(`all ${allStealth.length} stealth addresses hold exactly ${AMOUNT} MON`, landed === allStealth.length);

console.log(`\nSUMMARY: ${totalPayments} payments sent · ${detectedTotal} detected by rightful owners · ${ann.count} announcements · ${landed}/${allStealth.length} funded`);
process.exit(ok ? 0 : 1);
