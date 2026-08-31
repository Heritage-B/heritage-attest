# heritage-attest

**Verifiable vehicle provenance for the machine economy.**
An open-source module that turns every scanned car into a Machine RWA: an on-chain
vehicle identity with **tamper-evident, hash-anchored health & provenance attestations**.

Part of [HeritageB](https://heritage-b.club) — an OBD/BLE app that reads 36+ live vehicle
parameters, computes a health score, detects misfires, flags cleared/reset diagnostic codes
(a tamper signal) and cross-checks odometer across ECU modules. This repo is the on-chain
layer: it anchors a signed hash of each report so that **odometer and code-reset history
cannot be retroactively forged**, and is portable across owners, dealers and borders.

> Grant deliverable for the **peaq Ecosystem Grant** (chain-agnostic; peaq is the first target).
> The product does not need a blockchain — the single useful on-chain feature is
> **anchoring report hashes** so provenance can't be rewritten after the fact.

## What's on-chain vs off-chain

```
 HeritageB backend (Cloudflare Worker)
   report {vin, odometer, timestamp, health, dtcCodes, tamperFlags}
        │
        ├─ canonicalize → keccak256  ─────────────►  reportHash (32 bytes)
        │                                            EIP-712 signature
        ▼
   raw scan  ──►  OFF-CHAIN (D1 / R2)     hash + sig  ──►  ON-CHAIN (peaq)
                  (never leaves us)                        Attestations.anchor(tokenId, hash)
```

Only 32-byte hashes + signatures go on-chain. Raw, personal telemetry stays off-chain —
privacy-first by design.

## Packages

| Path | What |
|---|---|
| `contracts/` | Solidity: `VehicleRegistry` (one identity per VIN) + `Attestations` (append-only signed report hashes). Foundry, zero external deps. |
| `packages/attestor/` | TypeScript lib: canonicalize a report → `keccak256` → sign → anchor. Chain-agnostic `ChainAdapter` + `PeaqAdapter` (viem). Runs in Cloudflare Workers. |
| `apps/verify/` | Public **"verify by VIN"** page — reads the chain and shows a car's anchored provenance timeline. |
| `worker/` | How HeritageB's backend calls the attestor after each assessment. |
| `docs/` | Architecture + the peaq grant application. |

## Quickstart

```bash
# Contracts
cd contracts
forge install foundry-rs/forge-std --no-commit
forge test -vvv

# Attestor library
npm install
npm run build
npm test
```

Prove the whole flow end-to-end on a local chain (no funds, no external RPC):

```bash
bash scripts/e2e-local.sh
# ▸ starts anvil → deploys → mint vehicle → anchor report hash → verify → tamper-reject
# ✅ E2E PASSED — verify(original)=true, verify(forged)=false, idempotent VIN
```

Deploy to a live chain (peaq Agung testnet, or mainnet):

```bash
cd contracts
DEPLOYER_PK=0x... forge script script/Deploy.s.sol \
  --rpc-url <PEAQ_RPC> --broadcast
```

## Status

MVP. Roadmap tracks the grant milestones:

- **M1** — contracts on peaq testnet, attestor lib, demo anchoring a real report. *(this repo)*
- **M2** — mainnet + wired into HeritageB assess flow + 25 vehicles + public verify page.
- **M3** — 50 vehicles, 5 paid pilot inspections, fraud-flag hit-rate report.

## License

MIT — see [LICENSE](./LICENSE).
