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

/**
 * Verify that a given report was anchored for its VIN — recomputes the hash and
 * checks it against the chain. Returns false if the vehicle was never registered.
 */
export async function verifyReport(adapter: ChainAdapter, report: VehicleReport): Promise<boolean> {
  const tokenId = await adapter.tokenForVin(vinHash(report.vin));
  if (tokenId === 0n) return false;
  return adapter.verify(tokenId, reportHash(report));
}
