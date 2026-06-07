// Proves the stealth-address math: sender-derived address == recipient-derived address,
// and the recipient's derived private key actually controls that address.
import { getPublicKey } from "@noble/secp256k1";
import { bytesToHex, keccak256, hexToBytes } from "viem";
import {
  generateMetaKeys,
  deriveStealthAddress,
  checkAnnouncement,
  deriveStealthPrivKey,
} from "../lib/stealth.js";

function addrFromPriv(privHex) {
  const pub = getPublicKey(hexToBytes(privHex), false); // uncompressed 65b
  const h = keccak256(pub.slice(1));
  return ("0x" + h.slice(-40)).toLowerCase();
}

let ok = true;
const check = (name, cond) => { console.log(`${cond ? "✅" : "❌"} ${name}`); ok = ok && cond; };

// 1. Recipient identity
const meta = generateMetaKeys();

// 2. Sender derives a one-time stealth address
const { stealthAddress, ephemeralPubKey, viewTag } = deriveStealthAddress(meta.spendPub, meta.viewPub);

// 3. Recipient detects it
const detected = checkAnnouncement(meta.viewPriv, meta.spendPub, ephemeralPubKey, viewTag);
check("recipient detects sender's stealth address", detected === stealthAddress);

// 4. viewTag prefilter rejects a wrong announcement
const otherEph = deriveStealthAddress(meta.spendPub, meta.viewPub).ephemeralPubKey;
const wrong = checkAnnouncement(meta.viewPriv, meta.spendPub, otherEph, viewTag); // mismatched tag usually
check("viewTag filters non-matching announcements (null or different)", wrong === null || wrong !== stealthAddress);

// 5. Recipient can derive the controlling private key
const stealthPriv = deriveStealthPrivKey(meta.spendPriv, meta.viewPriv, ephemeralPubKey);
check("derived stealth privkey controls the stealth address", addrFromPriv(stealthPriv) === stealthAddress);

// 6. Unlinkability: two payments to the same recipient → different stealth addresses
const a = deriveStealthAddress(meta.spendPub, meta.viewPub).stealthAddress;
const b = deriveStealthAddress(meta.spendPub, meta.viewPub).stealthAddress;
check("two payments to same recipient yield different addresses (unlinkable)", a !== b);

// 7. A different recipient cannot detect it
const stranger = generateMetaKeys();
const strangerSees = checkAnnouncement(stranger.viewPriv, stranger.spendPub, ephemeralPubKey, viewTag);
check("a stranger cannot detect the payment", strangerSees !== stealthAddress);

console.log("\nsample:", { stealthAddress, viewTag, ephemeralPubKey: ephemeralPubKey.slice(0, 18) + "…" });
process.exit(ok ? 0 : 1);
