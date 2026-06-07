// Client-side stealth identities (kept in localStorage). The private spend/view keys
// NEVER leave the browser — only the public meta-address is registered on-chain.
export type Identity = {
  alias: string;
  spendPriv: string;
  viewPriv: string;
  spendPub: string;
  viewPub: string;
};

const KEY = "stealthpay-identities";
const ACTIVE = "stealthpay-active";

export function listIdentities(): Identity[] {
  if (typeof localStorage === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveIdentity(id: Identity) {
  const all = listIdentities().filter((i) => i.alias !== id.alias);
  all.push(id);
  localStorage.setItem(KEY, JSON.stringify(all));
  setActiveAlias(id.alias);
}

export function setActiveAlias(alias: string) {
  if (typeof localStorage !== "undefined") localStorage.setItem(ACTIVE, alias);
}

export function getActiveAlias(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(ACTIVE);
}

export function getActive(): Identity | null {
  const list = listIdentities();
  const a = getActiveAlias();
  return list.find((i) => i.alias === a) || list[0] || null;
}
