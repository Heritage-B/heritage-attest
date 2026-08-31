/**
 * Example: how the HeritageB Cloudflare Worker anchors a report right after an
 * AI assessment. Drop this call into the existing `/assess` route — everything
 * else (raw telemetry) stays in D1/R2 exactly as today.
 *
 * Secrets (wrangler secret put ...):
 *   HB_SIGNER_PK   — 0x-private key of the backend signer
 *   PEAQ_RPC       — peaq RPC url
 * Vars (wrangler.toml):
 *   REGISTRY_ADDR, ATTESTATIONS_ADDR, PEAQ_CHAIN_ID
 */
import { anchorReport, PeaqAdapter, type VehicleReport } from "@heritageb/attestor";

interface Env {
  HB_SIGNER_PK: string;
  PEAQ_RPC: string;
  REGISTRY_ADDR: string;
  ATTESTATIONS_ADDR: string;
  PEAQ_CHAIN_ID: string;
}

export async function anchorAssessment(env: Env, report: VehicleReport) {
  const adapter = new PeaqAdapter({
    rpcUrl: env.PEAQ_RPC,
    chainId: Number(env.PEAQ_CHAIN_ID),
    registry: env.REGISTRY_ADDR as `0x${string}`,
    attestations: env.ATTESTATIONS_ADDR as `0x${string}`,
    privateKey: env.HB_SIGNER_PK as `0x${string}`,
  });

  // Anchor and store the tx + tokenId next to the assessment row in D1.
  const { tokenId, reportHash, tx } = await anchorReport(adapter, report, "health");
  return { tokenId: tokenId.toString(), reportHash, tx };
}

// In the /assess handler, after the assessment is saved:
//
//   const anchor = await anchorAssessment(c.env, {
//     vin: input.vin!,
//     odometerKm: input.odometerKm ?? null,
//     recordedAt: new Date().toISOString(),
//     health: r.health,
//     dtcCodes: input.dtcCodes ?? [],
//     tamperFlags: input.milOn ? ["mil_on"] : [],
//   });
//   await c.env.DB.prepare(
//     "UPDATE garage_assessments SET chain_tx = ?, token_id = ? WHERE id = ?",
//   ).bind(anchor.tx, anchor.tokenId, assessmentId).run();
//
// The verifiedRecordCard in the app then shows a real peaq tx link.
