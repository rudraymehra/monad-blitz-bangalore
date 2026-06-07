# StealthMode — judge brief, demo script & Q&A

## 🎤 The 30-second pitch (memorize this)
> "On every blockchain, payments are **public** — anyone can see who paid whom, how much, and link
> someone's whole payment history. **StealthMode brings private receiving to Monad using stealth
> addresses (ERC-5564).** You publish one public handle, but every payment to you lands at a
> brand-new one-time address that only *you* can detect and spend. To everyone else on-chain,
> they're unrelated random addresses. We deployed it fresh on Monad, and it works for many agents
> at once — each one's incoming payments are unlinkable."

## The problem (why it matters)
A normal blockchain is a public ledger. If your address is known, the world sees every payment you
receive, your balance, and can link all your activity. For people — and especially **autonomous
agents** that need to hold funds and get paid — that's a privacy disaster. We fix **recipient
privacy**: receive money without anyone knowing the payments are yours or connecting them.

## How it works (so YOU can explain it)
The magic is **stealth addresses (ERC-5564)**. Plain-English mechanics:

1. **You have two keypairs:** a **spending key** and a **viewing key**. The public halves together
   form your **meta-address** — you publish it once (like a username). *(Identity page)*
2. **To pay you, a sender** picks a random throwaway ("ephemeral") key and does **ECDH key
   agreement** (Diffie–Hellman) between that and your **viewing public key** → a **shared secret**.
   They use the secret to "tweak" your spend public key into a **brand-new one-time address**, send
   funds there, and publish only the ephemeral *public* key + a 1-byte "view tag" as an
   **announcement**. *(Send page)*
3. **You detect it:** you scan announcements, redo the same ECDH with your viewing *private* key
   (Diffie–Hellman is symmetric, so you get the **same secret**), check the cheap view-tag filter,
   recompute the address — if it matches, that payment is yours. The same secret lets you derive
   the **private key** for that stealth address, so you can spend it. *(Receive page)*

**Why it's private:** the stealth address is derived from a *random* ephemeral key each time, so
every payment goes to a **different** address, and nobody can link an address back to your
meta-address **without your viewing key**. Unlinkable + undetectable to outsiders.

## What we built (the pieces)
- **Smart contract `StealthMode.sol`** — deployed + verifying on **Monad Testnet**
  (`0x12536828dc40dE3f5184D202Ea0130E0B6B0A14a`). Two jobs: a **registry** (alias → meta-address)
  and **`payStealth`** which forwards MON to a stealth address and emits an `Announcement` event.
- **Stealth crypto** — real ERC-5564 on secp256k1 + keccak, done **in the browser** (keys never
  leave your device). `@noble/secp256k1` for the EC math, `viem` for hashing/addresses.
- **App (Next.js)** — Identity (make + register your meta-address), Send (derive a one-time address
  + pay), Receive (scan announcements, detect & prove you can spend yours).
- **Why Monad:** scanning many announcements + frequent small payments needs a fast, cheap chain —
  Monad's high throughput + sub-second finality make real-time stealth scanning practical.

## What's actually real (not mocked)
- The contract is deployed on Monad and MON **really transfers** to the stealth addresses.
- The crypto is real and **verified**: a single-flow test + a **5-agent / 7-payment** test proved
  each agent detects exactly its own payments, **no agent can see another's**, every payment is a
  different address, and all funds landed on-chain.

## 🎬 3-minute live demo script
1. **(15s) Hook:** "Blockchain payments are public — here's how we make *receiving* private on Monad."
2. **(30s) Identity:** register an alias, e.g. `alice`. "This meta-address is public, like a username."
3. **(45s) Send:** pay `alice`. Point at the **fresh stealth address**: "brand-new, never existed
   before — on-chain it's unlinkable to alice." Send again → **different** address. Open one on
   MonadVision: "looks random; the explorer can't tell it's alice's."
4. **(45s) Receive:** as alice, scan. "Out of *all* announcements on-chain, only my **viewing key**
   finds mine — scanned N, X are mine." Show the detected payments + amounts + ✓ spendable.
5. **(30s) Multiple agents:** register `bob` too. "bob can't see alice's payments and vice-versa —
   each agent receives privately." (We tested this with 5 agents.)
6. **(15s) Close:** "ERC-5564 stealth addresses, a custom contract deployed + verified on Monad,
   keys never leave the browser, fast enough for live scanning because it's Monad. Fresh build today."

## 🙋 Likely judge questions + answers
- **"Is this real on-chain or a mock?"** Real. Deployed + verified contract; MON transfers land at
  the stealth addresses (open MonadVision). Crypto is ERC-5564, tested across 5 agents.
- **"How is the recipient hidden if the meta-address is public?"** The meta-address never receives
  funds directly. Each payment goes to a *derived* one-time address. Linking it back requires the
  **viewing private key**, which never leaves the recipient's browser.
- **"What does the view tag do?"** A 1-byte hint so recipients can skip ~255/256 of announcements
  cheaply before doing the full check — makes scanning fast.
- **"Why Monad specifically?"** Stealth scanning + frequent micro-payments need throughput and
  sub-second finality; Monad makes it practical and cheap. Also EVM-compatible, so ERC-5564 works.
- **"Can the recipient actually spend the funds?"** Yes — they derive the stealth address's private
  key (spendKey + sharedSecret). We assert this in tests (the derived key controls the address).
- **"Is the sender private too?"** Our focus is **recipient** privacy. The sender (a relayer in the
  demo) is visible; per-sender privacy (fresh sender addresses / a pool) is the natural next step.

## Honest limitations / what's next (devs respect honesty)
- **Recipient privacy, not sender privacy** (yet) — the demo's sender is one relayer wallet.
- **No "sweep" UI** — funds sit at the stealth address; we proved the key is derivable, but moving
  them out needs a relayer/meta-tx (stealth addresses hold no gas). Clear next step.
- **Linear scanning** — fine with the view-tag filter for a demo; production would use an indexer
  (Envio HyperIndex) and client-side scanning at scale.
- **Testnet**, single payment amount in the demo, keys in localStorage (fine for a hackathon).

## One-liner if you forget everything
> "Public usernames, private payments: every payment to you lands at a fresh address only your key
> can find — stealth addresses (ERC-5564), live on Monad."
