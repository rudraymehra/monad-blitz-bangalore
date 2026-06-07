# StealthMode — untraceable payments on Monad

> **Monad Blitz Bangalore V4 · The Agent Economy**
> Public usernames, **private payments**. Publish one public handle; every payment to you lands at
> a **fresh one-time address** only *you* can detect and spend. To everyone else on-chain, they're
> unrelated random addresses. Built fresh on **Monad Testnet** with **stealth addresses (ERC-5564)**
> — and it works for many agents at once, each one's payments unlinkable.

📂 Full project code: [`./stealth_mode`](./stealth_mode) · 🎥 Demo video: _add link_ · 🌐 Live app: _deploying_

## The problem
A blockchain is a public ledger — anyone can see who paid whom, the amounts, and link a recipient's
entire history. For people and especially **autonomous agents** that hold and receive funds, that
destroys privacy. StealthMode fixes **recipient privacy**: receive funds without anyone knowing the
payments are yours or linking them together.

## How it works (ERC-5564 stealth addresses)
1. You hold a **spending key** + a **viewing key**; their public halves form your **meta-address**,
   published once like a username. *(Identity)*
2. To pay you, a sender runs **ECDH** between a random ephemeral key and your viewing public key →
   a shared secret → a **brand-new one-time stealth address** (your spend key tweaked by the
   secret). They send funds there and publish only the ephemeral pubkey + a 1-byte view tag. *(Send)*
3. You **scan** announcements, redo the ECDH with your viewing *private* key (symmetric → same
   secret), check the view tag, recompute the address → matches → it's yours. The secret also yields
   the address's private key, so you can **sweep** the funds out. *(Receive)*

Every payment uses a fresh ephemeral key → a different address each time, unlinkable to your
meta-address **without your viewing key**. Keys are generated and used **in the browser** — they
never touch a server.

## Deployed on Monad Testnet (verified)
- **Contract `StealthPay`:** `0x12536828dc40dE3f5184D202Ea0130E0B6B0A14a`
  - MonadScan (verified): https://testnet.monadscan.com/address/0x12536828dc40dE3f5184D202Ea0130E0B6B0A14a
  - MonadVision (verified): https://testnet.monadvision.com/address/0x12536828dc40dE3f5184D202Ea0130E0B6B0A14a
- Chain id **10143** · RPC `https://testnet-rpc.monad.xyz`

## What's real (not mocked)
- Real ERC-5564 stealth crypto, run client-side. Real MON transfers land at unique stealth
  addresses; **sweep** moves them out (client-signed, broadcast via a tiny relay).
- Verified by a **5-agent / 7-payment** test: each agent detects only its own payments, no agent
  sees another's, every payment is a different address, all funds landed on-chain.

## Tech
- **Contract:** Solidity + Foundry (Monad's official build), deployed to Monad Testnet.
- **App:** Next.js (App Router, TS, Tailwind) + **viem**; `@noble/secp256k1` for stealth crypto.
- **Pages:** Identity · Send · Receive (+ sweep) · live Feed. **Why Monad:** fast, cheap blocks make
  real-time stealth scanning + frequent micro-payments practical.

## Run it
```bash
cd stealth_mode
npm install
cp .env.example .env.local   # set RELAYER_PRIVATE_KEY (a funded Monad-testnet key)
npm run dev                  # http://localhost:3000

# prove a payment is real & on-chain:
node --no-warnings scripts/pay-and-prove.mjs
```
See [`stealth_mode/TEST.md`](./stealth_mode/TEST.md) (verify payments on-chain) and
[`stealth_mode/PITCH.md`](./stealth_mode/PITCH.md) (demo script + how it works + Q&A).

## Honest scope
This is **recipient** privacy (the demo's sender is one relayer). A DarkPool/ZK mixer for
sender-side anonymity is the natural v2.
