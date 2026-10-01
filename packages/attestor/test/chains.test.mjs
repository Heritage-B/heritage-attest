import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CHAINS, chainById, txUrl, addressUrl, anchorReport, anchorReportMulti, reportHash,
  EvmAdapter, PeaqAdapter, RobinhoodChainAdapter,
} from "../dist/index.js";

// Dummy, publicly-known anvil key #0 — never a real wallet.
const ANVIL_PK = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const ZERO = "0x0000000000000000000000000000000000000001";

test("chain presets: peaq mainnet + Robinhood Chain mainnet/testnet", () => {
  assert.equal(CHAINS.peaq.chainId, 3338);
  assert.equal(CHAINS.robinhood.chainId, 4663);
  assert.equal(CHAINS.robinhoodTestnet.chainId, 46630);
  assert.equal(CHAINS.robinhood.nativeCurrency.symbol, "ETH");
  assert.equal(CHAINS.robinhood.rpcUrl, "https://rpc.mainnet.chain.robinhood.com");
  assert.equal(CHAINS.robinhoodTestnet.rpcUrl, "https://rpc.testnet.chain.robinhood.com");
  assert.equal(chainById(4663), CHAINS.robinhood);
  assert.equal(chainById(1), undefined);
  assert.ok(CHAINS.peaq.deployment, "peaq mainnet deployment is live");
});

test("explorer links", () => {
  const tx = "0x" + "ab".repeat(32);
  assert.equal(txUrl(CHAINS.robinhood, tx), `https://robinhoodchain.blockscout.com/tx/${tx}`);
  assert.equal(txUrl(CHAINS.robinhoodTestnet, tx), `https://explorer.testnet.chain.robinhood.com/tx/${tx}`);
  assert.equal(addressUrl(CHAINS.peaq, ZERO), `https://peaq.subscan.io/account/${ZERO}`);
  assert.equal(addressUrl(CHAINS.robinhood, ZERO), `https://robinhoodchain.blockscout.com/address/${ZERO}`);
});

test("adapters construct offline; Robinhood adapter picks the right chain id", () => {
  assert.equal(new RobinhoodChainAdapter({ registry: ZERO, attestations: ZERO, privateKey: ANVIL_PK }).chainId, 4663);
  assert.equal(new RobinhoodChainAdapter({ network: "testnet", registry: ZERO, attestations: ZERO }).chainId, 46630);
  assert.equal(new PeaqAdapter({ rpcUrl: "http://127.0.0.1:8545", chainId: 3338, registry: ZERO, attestations: ZERO, privateKey: ANVIL_PK }).chainId, 3338);
});

test("read-only adapter refuses to write (no key, no network call)", async () => {
  const ro = new EvmAdapter({ rpcUrl: "http://127.0.0.1:1", chainId: 46630, registry: ZERO, attestations: ZERO });
  await assert.rejects(ro.anchor(1n, "0x" + "11".repeat(32), "0x" + "00".repeat(32)), /read-only adapter/);
});

/** In-memory ChainAdapter — the same contract semantics, no chain. */
function fakeAdapter({ fail = false } = {}) {
  const vins = new Map();
  const log = new Map();
  let tx = 0;
  return {
    calls: 0,
    async tokenForVin(vh) { return vins.get(vh) ?? 0n; },
    async registerVehicle(vh) { if (fail) throw new Error("rpc down"); if (!vins.has(vh)) vins.set(vh, BigInt(vins.size + 1)); return vins.get(vh); },
    async anchor(id, h) { this.calls++; if (fail) throw new Error("rpc down"); log.set(id, [...(log.get(id) ?? []), h]); return `0x${(++tx).toString(16).padStart(64, "0")}`; },
    async verify(id, h) { return (log.get(id) ?? []).includes(h); },
    async count(id) { return BigInt((log.get(id) ?? []).length); },
  };
}

const report = { vin: "SJNFAAJ11U1234567", odometerKm: 142000, recordedAt: "2026-09-01T16:50:00Z", health: 72, dtcCodes: ["C0300"], tamperFlags: [] };

test("anchorReportMulti: same hash on every chain, outcomes in order", async () => {
  const out = await anchorReportMulti({ peaq: fakeAdapter(), robinhood: fakeAdapter() }, report);
  assert.deepEqual(out.map((o) => [o.chain, o.ok]), [["peaq", true], ["robinhood", true]]);
  assert.equal(out[0].result.reportHash, reportHash(report));
  assert.equal(out[1].result.reportHash, out[0].result.reportHash);
});

test("anchorReportMulti: one chain failing never fails the other", async () => {
  const good = fakeAdapter();
  const out = await anchorReportMulti({ peaq: good, robinhood: fakeAdapter({ fail: true }) }, report);
  assert.equal(out[0].ok, true);
  assert.deepEqual([out[1].chain, out[1].ok, out[1].error], ["robinhood", false, "rpc down"]);
  assert.equal(await good.verify(out[0].result.tokenId, reportHash(report)), true);
  // single-chain path is unchanged
  const single = await anchorReport(fakeAdapter(), report);
  assert.equal(single.tokenId, 1n);
});
