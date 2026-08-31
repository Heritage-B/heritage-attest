// End-to-end проверка всего on-chain флоу против локального anvil (или любого EVM):
// deploy (снаружи) → register vehicle → anchor report hash → verify → tamper check.
// Запуск:
//   1) anvil --silent &
//   2) forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast   (в contracts/)
//   3) REGISTRY=0x.. ATTESTATIONS=0x.. RPC=http://127.0.0.1:8545 CHAIN_ID=31337 PK=0x.. \
//      node scripts/e2e-anvil.mjs
import assert from "node:assert/strict";
import { anchorReport, verifyReport, reportHash, PeaqAdapter } from "../dist/index.js";

const {
  RPC = "http://127.0.0.1:8545",
  CHAIN_ID = "31337",
  REGISTRY, ATTESTATIONS,
  PK = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // anvil #0
} = process.env;

if (!REGISTRY || !ATTESTATIONS) {
  console.error("Set REGISTRY and ATTESTATIONS (deployed addresses).");
  process.exit(2);
}

const adapter = new PeaqAdapter({
  rpcUrl: RPC, chainId: Number(CHAIN_ID),
  registry: REGISTRY, attestations: ATTESTATIONS, privateKey: PK,
});

const report = {
  vin: "SJNFAAJ11U1234567", odometerKm: 142000,
  recordedAt: "2026-09-01T16:50:00Z", health: 72,
  dtcCodes: ["C0300"], tamperFlags: [],
};

console.log("→ anchoring report for VIN", report.vin, "…");
const res = await anchorReport(adapter, report, "health");
console.log("  tokenId :", res.tokenId.toString());
console.log("  hash    :", res.reportHash);
console.log("  tx      :", res.tx);

const ok = await verifyReport(adapter, report);
const forged = await verifyReport(adapter, { ...report, odometerKm: 999999 });
const count = await adapter.count(res.tokenId);

console.log("→ verify(original) :", ok);
console.log("→ verify(forged)   :", forged);
console.log("→ attestation count:", count.toString());

assert.equal(ok, true, "original report must verify true");
assert.equal(forged, false, "a forged/edited report must verify false");
assert.equal(count, 1n, "exactly one attestation expected");

// Второй якорь той же машины (VIN идемпотентен → тот же tokenId, count растёт).
const res2 = await anchorReport(adapter, { ...report, odometerKm: 142350, recordedAt: "2026-09-02T08:00:00Z" }, "health");
assert.equal(res2.tokenId.toString(), res.tokenId.toString(), "same VIN → same tokenId");
const count2 = await adapter.count(res.tokenId);
assert.equal(count2, 2n, "two attestations after second anchor");
console.log("→ second anchor tokenId:", res2.tokenId.toString(), "count:", count2.toString());

console.log("\n✅ E2E PASSED — mint, anchor, verify, tamper-reject, idempotent VIN all work.");
