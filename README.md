# heritage-attest

**Verifiable vehicle provenance for the machine economy.**
An open-source module that turns every scanned car into a Machine RWA: an on-chain
vehicle identity with **tamper-evident, hash-anchored health & provenance attestations**.

Part of [HeritageB](https://heritage-b.club) — an OBD/BLE app that reads 36+ live vehicle
parameters, computes a health score, detects misfires, flags cleared/reset diagnostic codes
(a tamper signal) and cross-checks odometer across ECU modules. This repo is the on-chain
layer: it anchors a signed hash of each report so that **odometer and code-reset history
cannot be retroactively forged**, and is portable across owners, dealers and borders.

> **Chain-agnostic, dual-chain:** the same contracts and the same report hash are anchored on
> **peaq** (machine-economy L1, live on mainnet since 2026-09-02) and **Robinhood Chain**
> (Arbitrum Orbit L2, ETH gas — see [Deployments](#deployments)). Two independent ledgers holding the same hash = proof that
> doesn't depend on any single chain. Started as the peaq Ecosystem Grant deliverable.
> The product does not need a blockchain — the single useful on-chain feature is
> **anchoring report hashes** so provenance can't be rewritten after the fact.

## What's on-chain vs off-chain

```
 HeritageB backend (Cloudflare Worker)
   report {vin, odometer, timestamp, health, dtcCodes, tamperFlags}
        │
        ├─ canonicalize → keccak256  ─────────────►  reportHash (32 bytes)
        │                                            signed tx from the HB signer
        ▼
   raw scan  ──►  OFF-CHAIN (D1 / R2)     hash  ──┬──►  ON-CHAIN: peaq            Attestations.anchor(tokenId, hash)
                  (never leaves us)               └──►  ON-CHAIN: Robinhood Chain  Attestations.anchor(tokenId, hash)
                                                  (independent: one chain failing never blocks the other)
```

Only 32-byte hashes + signatures go on-chain. Raw, personal telemetry stays off-chain —
privacy-first by design.

## Packages

| Path | What |
|---|---|
| `contracts/` | Solidity: `VehicleRegistry` (one identity per VIN) + `Attestations` (append-only signed report hashes). Foundry, zero external deps. |
| `packages/attestor/` | TypeScript lib: canonicalize a report → `keccak256` → anchor. Chain-agnostic `ChainAdapter`; `EvmAdapter` for any EVM chain, with `PeaqAdapter` and `RobinhoodChainAdapter` presets; `anchorReportMulti` anchors on several chains independently (viem). Runs in Cloudflare Workers. |
| `apps/verify/` | Public **"verify by VIN"** page — reads every configured chain in parallel and shows a car's anchored provenance timeline per chain. |
| `worker/` | How HeritageB's backend calls the attestor after each assessment (dual-chain). |
| `docs/` | [Robinhood Chain deploy guide](docs/DEPLOY_ROBINHOOD.md) + the peaq grant application. |

## Deployments

| Chain | Chain ID | VehicleRegistry | Attestations |
|---|---|---|---|
| peaq mainnet | 3338 | [`0x99065e9801C6416E542C6D129d18c82d51f08475`](https://peaq.subscan.io/account/0x99065e9801C6416E542C6D129d18c82d51f08475) | [`0x9aa2ed63403400aB7Cdeb44f933729fB3AF5f46d`](https://peaq.subscan.io/account/0x9aa2ed63403400aB7Cdeb44f933729fB3AF5f46d) |
| Robinhood Chain Testnet | 46630 | [`0x99065e9801C6416E542C6D129d18c82d51f08475`](https://explorer.testnet.chain.robinhood.com/address/0x99065e9801C6416E542C6D129d18c82d51f08475) ✓ verified | [`0x9aa2ed63403400aB7Cdeb44f933729fB3AF5f46d`](https://explorer.testnet.chain.robinhood.com/address/0x9aa2ed63403400aB7Cdeb44f933729fB3AF5f46d) ✓ verified |
| Robinhood Chain | 4663 | _pending deploy_ | _pending deploy_ |

Same source, same compiler settings (`evm_version = "london"`, pinned in `foundry.toml`) →
same bytecode on every chain.
Same deployer and nonces → the same contract addresses on peaq and Robinhood Chain Testnet.

Robinhood Chain Testnet smoke test (2026-10-01, dummy VIN `HBTESTVIN00000001`, not a customer car):
[register](https://explorer.testnet.chain.robinhood.com/tx/0x3a96e17d47d6d3d2952712b8436d5430fc2a639bc6d739d11dddf7287ae86a16) →
[anchor](https://explorer.testnet.chain.robinhood.com/tx/0x2ff7c65df9b046c1028304b0a04259129b089f2b0f5d1cfe83efa1c92f8ae587) →
`verify(original) = true`, `verify(tampered) = false`, `count = 1`.

```ts
import { anchorReportMulti, PeaqAdapter, RobinhoodChainAdapter } from "@heritageb/attestor";

const outcomes = await anchorReportMulti({
  peaq: new PeaqAdapter({ rpcUrl, chainId: 3338, registry, attestations, privateKey }),
  robinhood: new RobinhoodChainAdapter({ network: "mainnet", registry: rhRegistry, attestations: rhAttestations, privateKey }),
}, report);
// → [{ chain: "peaq", ok: true, result: { tokenId, reportHash, tx } }, { chain: "robinhood", ok: true, … }]
```

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

Deploy to a live chain — the signer comes from an encrypted Foundry keystore
(`cast wallet import hb-deployer --interactive`), never from the repo:

```bash
cd contracts
# Robinhood Chain testnet (chainId 46630) — full walkthrough: docs/DEPLOY_ROBINHOOD.md
export ROBINHOOD_TESTNET_RPC=https://rpc.testnet.chain.robinhood.com
forge script script/Deploy.s.sol --rpc-url robinhood_testnet \
  --account hb-deployer --sender $(cast wallet address --account hb-deployer) \
  --broadcast --gas-estimate-multiplier 200 \
  --verify --verifier blockscout --verifier-url https://explorer.testnet.chain.robinhood.com/api/

# peaq (chainId 3338)
export PEAQ_RPC=https://peaq.api.onfinality.io/public
forge script script/Deploy.s.sol --rpc-url peaq --account hb-deployer \
  --sender $(cast wallet address --account hb-deployer) --broadcast
```

## Status

MVP. Roadmap tracks the grant milestones:

- **M1** — contracts on peaq, attestor lib, demo anchoring a real report. ✅ (peaq mainnet, 2026-09-02)
- **M2** — wired into the HeritageB app ("Seal on-chain") + public verify page. ✅
- **Robinhood Chain** — second chain: `RobinhoodChainAdapter`, multi-chain anchoring, multi-chain
  verify page, Foundry deploy config. Built for Arbitrum Open House Singapore (Sept–Oct 2026).
  ✅ Live on Robinhood Chain Testnet (2026-10-01). When an owner seals a report in the HeritageB app,
  the backend anchors the same hash on peaq and Robinhood Chain in parallel.
  Public verify page: https://heritage-b.github.io/heritage-attest/
- **M3** — 50 vehicles, 5 paid pilot inspections, fraud-flag hit-rate report.

## License

MIT — see [LICENSE](./LICENSE).
