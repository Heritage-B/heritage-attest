# peaq Ecosystem Grant — application (draft)

**Project** — HeritageB: verifiable vehicle health & provenance on peaq.

**One-liner** — We turn every scanned car into a Machine RWA: an on-chain vehicle
identity with tamper-evident, hash-anchored health & provenance attestations.

**Problem** — Odometer rollback and hidden mechanical damage are rampant in used-car
markets. Provenance today is unverifiable and non-portable — especially across borders
(US auctions → CIS/EU resale), where a buyer has no way to trust a seller's mileage claim.

**What we've built (working PoC, 7 months)** — An iOS app + Cloudflare backend that reads
36+ live OBD/BLE parameters, computes a health score, detects misfires, flags cleared/reset
diagnostic codes (a tamper signal), and cross-checks odometer across ECU modules. Real scans
on a VW T-Roc, a Nissan Qashqai and a Bentley Continental GT.

**Why peaq** — peaq is the machine-economy L1 and the grant explicitly funds vehicle dApps;
WAGOI already proves the connected-vehicle DePIN pattern here. We mint a peaq-ID per vehicle
and anchor each report's hash as an on-chain attestation — making odometer and code-reset
history impossible to retroactively forge, and portable across owners, dealers and borders.

**What we'll build with the grant (open-source)** — [`heritage-attest`](../README.md): a
"vehicle provenance attestation" module. Mint a Machine identity per VIN and write signed
report hashes against it, callable from any backend. Raw scans stay off-chain; only hashes +
signatures go on-chain. MIT-licensed.

**Live on peaq mainnet (M1 already shipped, 2026-09-02)** — the module is deployed and
proven end-to-end on peaq **mainnet** (chainId 3338), not just testnet:
- `VehicleRegistry`: [`0x99065e9801C6416E542C6D129d18c82d51f08475`](https://peaq.subscan.io/account/0x99065e9801C6416E542C6D129d18c82d51f08475)
- `Attestations`: [`0x9aa2ed63403400aB7Cdeb44f933729fB3AF5f46d`](https://peaq.subscan.io/account/0x9aa2ed63403400aB7Cdeb44f933729fB3AF5f46d)
- Demo attestation tx: `0x25f8a970667810de5dddab2711cfb9609145170694e59944b1077555ac5005b6`
- Verified end-to-end on mainnet: mint per-VIN → anchor report hash → `verify(original)=true`,
  `verify(tampered)=false`, idempotent VIN. Public verify-by-VIN page in `apps/verify`.

**Ask** — Up to $50,000, milestone-based.

**Milestones / OKRs**
- **M1 (4 wks)** — attestation module on peaq testnet (open-sourced) + demo anchoring a real
  Qashqai/T-Roc/Bentley report; public verify-by-VIN page against testnet.
- **M2 (8 wks)** — mainnet + 25 vehicles with on-chain provenance + verify page live in prod.
- **M3 (12 wks)** — 50 vehicles, 5 paid pilot inspections, a fraud-flag hit-rate report.

**Team** — Small founding team, Taipei-based, 7 months building; founder runs field
inspections personally (direct demand signals from luxury owners and cross-border resellers).

**Open-source** — This repository. Contracts + attestor library + verify app, all MIT.

**Contact** — grants@peaq.network · Typeform application.
