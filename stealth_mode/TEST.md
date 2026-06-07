# StealthMode — Payment Test (prove payments are real & on-chain)

One command sends a **real private payment** on Monad and verifies it landed on the blockchain,
then gives you links to confirm with your own eyes.

## Run it
```
cd /Users/rudraym/agentmeter
node --no-warnings scripts/pay-and-prove.mjs
```
(The `--no-warnings` just hides a harmless Node "module type" notice — the test runs the same without it.)
(The app must be running. If it isn't: open a second terminal → `cd /Users/rudraym/agentmeter` →
`npm run dev`, wait for "Ready", then run the command above.)

## What "pass" looks like
It ends with **`✅ PAYMENT IS REAL AND ON-CHAIN.`** after printing:
- **PAYMENT SENT** — amount, the one-time stealth address, and the payment tx hash
- **ON-CHAIN PROOF** (read straight from Monad) — tx **status ✅ success** + the **MON balance
  actually sitting at the stealth address** (amount matches)
- **PRIVACY** — recipient detects it · a stranger does not
- **VERIFY IT YOURSELF** — explorer links

## 👉 Verify with your own eyes
Open the two links the script prints, on `https://testnet.monadvision.com`:
- **payment tx** → a real, confirmed transaction
- **stealth address** → the MON balance really sitting at that fresh address

That's the proof: the payment **exists on-chain and is real**. Each run uses a brand-new unlinkable
address, so you also see the privacy in action.

## Variations
- Bigger amount: `AMOUNT=0.05 node scripts/pay-and-prove.mjs`
- Run it several times to create multiple payments.

## If a payment fails
The sender wallet is low on gas. Top it up: go to `https://faucet.monad.xyz`, paste
`0x6E5f7269f261259662Df2DBFB6aff4d27343880D`, and claim MON. Check the balance anytime:
```
export PATH="$HOME/.foundry/bin:$PATH"
cast balance 0x6E5f7269f261259662Df2DBFB6aff4d27343880D --rpc-url https://testnet-rpc.monad.xyz --ether
```

Contract on the explorer: https://testnet.monadvision.com/address/0x12536828dc40dE3f5184D202Ea0130E0B6B0A14a
