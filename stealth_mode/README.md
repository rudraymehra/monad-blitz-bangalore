# StealthMode — untraceable payments on Monad

> **Monad Blitz Bangalore V4 · Theme: The Agent Economy**
> Public usernames, **private payments**. You publish one public handle, but every payment to you
> lands at a **fresh one-time address** that only *you* can detect and spend. To everyone else
> on-chain, they're unrelated random addresses. Built with **stealth addresses (ERC-5564)**, live
> on **Monad Testnet** — and it works for many agents at once, each one's payments unlinkable.

## The problem
A blockchain is a public ledger — anyone can see who paid whom, amounts, and link a recipient's
entire history. For people and especially **autonomous agents** that hold and receive funds, that
kills privacy. StealthMode fixes **recipient privacy**: receive funds without anyone knowing the
payments are yours or connecting them to each other.

## How it works (ERC-5564 stealth addresses)
1. You hold a **spending key** and a **viewing key**; their public halves form your **meta-address**,
   which you publish once (like a username). *(Identity)*
2. To pay you, a sender does **ECDH** between a random ephemeral key and your viewing public key to
   get a shared secret, derives a **brand-new one-time stealth address** from your spend key + that
   secret, sends funds there, and publishes only the ephemeral pubkey + a 1-byte view tag. *(Send)*
3. You **scan** announcements, redo the ECDH with your viewing *private* key (it's symmetric → same
   secret), check the view tag, recompute the address — matches → it's yours. The secret also yields
   the stealth address's **private key**, so you can **sweep** the funds out. *(Receive)*

Every payment uses a fresh ephemeral key → a different address each time, and nobody can link an
address to your meta-address **without your viewing key**. Unlinkable + undetectable to outsiders.

## What's real (not mocked)
- **Contract on Monad Testnet:** `StealthPay.sol` (registry + stealth payment/announcer), deployed
  at **`0x12536828dc40dE3f5184D202Ea0130E0B6B0A14a`** (verifying on MonadVision).
- Real ERC-5564 crypto, run **in the browser** (keys never leave your device).
- Real MON transfers land at the stealth addresses; **sweep** moves them out (client-signed).
- Verified by a **5-agent / 7-payment** test: each agent detects only its own, no agent sees
  another's, every payment is a different address, all funds landed on-chain.

## Stack
- **Contract:** Solidity + Foundry (Monad's official build), deployed to Monad Testnet (chain 10143).
- **App:** Next.js (App Router, TS, Tailwind) + **viem**; `@noble/secp256k1` for stealth crypto.
- **Pages:** Identity (make + register meta-address) · Send (derive one-time address + pay) ·
  Receive (scan, detect, **sweep**).
- **Why Monad:** scanning many announcements + frequent micro-payments needs throughput + sub-second
  finality — Monad makes real-time stealth scanning practical and cheap.

## Run it
```bash
npm install
# .env.local: RELAYER_PRIVATE_KEY (sender/relayer), NEXT_PUBLIC_STEALTH_CONTRACT, NEXT_PUBLIC_MONAD_RPC …
npm run dev          # http://localhost:3000

# tests
node scripts/stealth-check.mjs    # crypto correctness (offline)
node scripts/stealth-multi.mjs    # 5 agents, privacy at scale (dev server running)
node scripts/stealth-sweep.mjs    # sweep funds out of a stealth address

# contract (Foundry / Monad build)
cd contracts && forge test
```

## Status
- ✅ Stealth contract deployed on Monad Testnet (verifying)
- ✅ ERC-5564 stealth crypto (tested) · register / send / receive / **sweep** end-to-end
- ✅ Multi-agent privacy verified at scale; funds delivered + swept on-chain
- 🔜 Hosted on Vercel · ERC-8004 agent identity · per-sender privacy (next layer)

## Honest scope
This is **recipient** privacy (not sender privacy yet — the demo's sender is one relayer). A
DarkPool/ZK mixer for sender-side anonymity is the natural v2. See `PITCH.md` for the demo script,
judge Q&A, and limitations.
