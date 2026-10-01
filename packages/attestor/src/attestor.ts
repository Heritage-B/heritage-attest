import { padHex, stringToHex } from "viem";
import { reportHash, vinHash, type VehicleReport } from "./canonicalize.js";
import type { ChainAdapter } from "./adapters/types.js";

export interface AnchorResult {
  tokenId: bigint;
  reportHash: `0x${string}`;
  tx: `0x${string}`;
}

/**
 * End-to-end: ensure the vehicle exists, hash the report, and anchor it on-chain.
 * The chain is abstracted behind {@link ChainAdapter} — pass a `PeaqAdapter`
 * (or any other) and this same flow works everywhere.
 */
export async function anchorReport(
  adapter: ChainAdapter,
  report: VehicleReport,
  reportType = "health",
): Promise<AnchorResult> {
  const vh = vinHash(report.vin);
  let tokenId = await adapter.tokenForVin(vh);
  if (tokenId === 0n) tokenId = await adapter.registerVehicle(vh);

  const hash = reportHash(report);
  const typeBytes = padHex(stringToHex(reportType), { size: 32 });
  const tx = await adapter.anchor(tokenId, hash, typeBytes);

  return { tokenId, reportHash: hash, tx };
}

export type ChainAnchorOutcome =
  | { chain: string; ok: true; result: AnchorResult }
  | { chain: string; ok: false; error: string };

/**
 * Anchor the same report on several chains at once (e.g. peaq + Robinhood Chain).
 * Chains are independent: one failing (RPC down, signer out of gas) never fails the others.
 * The report hash is identical everywhere — it only depends on the report, not the chain.
 * Outcomes come back in the order of `adapters`.
 */
export async function anchorReportMulti(
  adapters: Record<string, ChainAdapter>,
  report: VehicleReport,
  reportType = "health",
): Promise<ChainAnchorOutcome[]> {
  const entries = Object.entries(adapters);
  const settled = await Promise.allSettled(entries.map(([, a]) => anchorReport(a, report, reportType)));
  return settled.map((s, i) => {
    const chain = entries[i]![0];
    return s.status === "fulfilled"
      ? { chain, ok: true as const, result: s.value }
      : { chain, ok: false as const, error: String(s.reason instanceof Error ? s.reason.message : s.reason) };
  });
}

/**
 * Verify that a given report was anchored for its VIN — recomputes the hash and
 * checks it against the chain. Returns false if the vehicle was never registered.
 */
export async function verifyReport(adapter: ChainAdapter, report: VehicleReport): Promise<boolean> {
  const tokenId = await adapter.tokenForVin(vinHash(report.vin));
  if (tokenId === 0n) return false;
  return adapter.verify(tokenId, reportHash(report));
}
