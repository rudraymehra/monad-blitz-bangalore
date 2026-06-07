// ERC-5564-style stealth addresses on secp256k1 (scheme: secp256k1 + keccak256).
// Pure ESM JS so it runs in both Next.js and a plain Node test.
//
// Recipient publishes a META-ADDRESS = (spendPub K, viewPub V).
// Sender picks ephemeral r, R = r*G, shared secret s = keccak256( r*V ),
//   stealthPub P = K + s*G,  stealthAddr = address(P),  viewTag = s[0].
// Recipient with viewPriv v recomputes s = keccak256( v*R ), checks viewTag,
//   P = K + s*G  → same address; spends with stealthPriv = (spendPriv + s) mod n.
import { Point, getPublicKey, getSharedSecret, utils } from "@noble/secp256k1";
import { keccak256, bytesToHex, hexToBytes } from "viem";

// secp256k1 group order (well-known constant)
const N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;

const stripHex = (h) => (h.startsWith("0x") ? h.slice(2) : h);

/** address (lowercase 0x) from an uncompressed pubkey point. */
function addressFromPoint(P) {
  const uncompressed = P.toBytes(false); // 65 bytes: 0x04 || X || Y
  const xy = uncompressed.slice(1); // 64 bytes
  const h = keccak256(xy); // 0x + 64 hex
  return ("0x" + h.slice(-40)).toLowerCase();
}

/** Generate a fresh stealth meta key pair (spend + view). All values 0x-hex. */
export function generateMetaKeys() {
  const spendPriv = utils.randomSecretKey();
  const viewPriv = utils.randomSecretKey();
  return {
    spendPriv: bytesToHex(spendPriv),
    viewPriv: bytesToHex(viewPriv),
    spendPub: bytesToHex(getPublicKey(spendPriv, true)), // compressed 33b
    viewPub: bytesToHex(getPublicKey(viewPriv, true)),
  };
}

function sharedScalarAndTag(sharedPointCompressed) {
  const sHashHex = keccak256(sharedPointCompressed); // 0x + 64
  const scalar = BigInt(sHashHex) % N;
  const viewTag = ("0x" + stripHex(sHashHex).slice(0, 2)).toLowerCase(); // first byte
  return { scalar, viewTag };
}

/**
 * SENDER: derive a one-time stealth address for recipient meta (spendPub, viewPub).
 * Returns { stealthAddress, ephemeralPubKey, viewTag } — all 0x-hex.
 */
export function deriveStealthAddress(spendPubHex, viewPubHex) {
  const ephPriv = utils.randomSecretKey();
  const ephPub = getPublicKey(ephPriv, true); // R, compressed
  const shared = getSharedSecret(ephPriv, hexToBytes(viewPubHex)); // r*V, compressed
  const { scalar, viewTag } = sharedScalarAndTag(shared);
  const K = Point.fromBytes(hexToBytes(spendPubHex));
  const P = K.add(Point.BASE.multiply(scalar)); // K + s*G
  return {
    stealthAddress: addressFromPoint(P),
    ephemeralPubKey: bytesToHex(ephPub),
    viewTag,
  };
}

/**
 * RECIPIENT: does this announcement (ephemeralPub, viewTag) belong to me?
 * Returns the stealth address if yes (after the cheap viewTag prefilter), else null.
 */
export function checkAnnouncement(viewPrivHex, spendPubHex, ephemeralPubHex, viewTagHex) {
  const shared = getSharedSecret(hexToBytes(viewPrivHex), hexToBytes(ephemeralPubHex)); // v*R
  const { scalar, viewTag } = sharedScalarAndTag(shared);
  if (viewTagHex && viewTag !== viewTagHex.toLowerCase()) return null; // fast reject
  const K = Point.fromBytes(hexToBytes(spendPubHex));
  const P = K.add(Point.BASE.multiply(scalar));
  return addressFromPoint(P);
}

/** RECIPIENT: private key that controls the stealth address (to spend / sweep). */
export function deriveStealthPrivKey(spendPrivHex, viewPrivHex, ephemeralPubHex) {
  const shared = getSharedSecret(hexToBytes(viewPrivHex), hexToBytes(ephemeralPubHex));
  const { scalar } = sharedScalarAndTag(shared);
  const sp = (BigInt(spendPrivHex) + scalar) % N;
  return ("0x" + sp.toString(16).padStart(64, "0"));
}
