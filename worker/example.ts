/**
 * Example: how the HeritageB Cloudflare Worker anchors a report right after an
 * assessment — on every configured chain at once (peaq + Robinhood Chain). Drop this
 * call into the existing `/assess` route — everything else (raw telemetry) stays in
 * D1/R2 exactly as today.
 *
 * Secrets (wrangler secret put ...):
 *   HB_SIGNER_PK         — 0x-private key of the backend signer (needs PEAQ on peaq, ETH on Robinhood Chain)
 *   PEAQ_RPC             — peaq RPC url
 *   ROBINHOOD_RPC        — Robinhood Chain RPC url (a provider URL may embed an API key → secret)
 * Vars:
 *   REGISTRY_ADDR, ATTESTATIONS_ADDR, PEAQ_CHAIN_ID          — peaq deployment
 *   ROBINHOOD_REGISTRY, ROBINHOOD_ATTESTATIONS, ROBINHOOD_NETWORK ("mainnet" | "testnet")
 *
 * The production version of this lives in the HeritageB backend (src/chain_anchor.ts):
 * per-chain results are stored in D1 and a chain that isn't configured is skipped.
 */
import {
  anchorReportMulti,
  PeaqAdapter,
  RobinhoodChainAdapter,
  type ChainAdapter,
  type VehicleReport,
} from "@heritageb/attestor";

interface Env {
  HB_SIGNER_PK: string;
  PEAQ_RPC: string;
  REGISTRY_ADDR: string;
  ATTESTATIONS_ADDR: string;
  PEAQ_CHAIN_ID: string;
  ROBINHOOD_RPC?: string;
  ROBINHOOD_REGISTRY?: string;
  ROBINHOOD_ATTESTATIONS?: string;
  ROBINHOOD_NETWORK?: "mainnet" | "testnet";
}

export async function anchorAssessment(env: Env, report: VehicleReport) {
  const privateKey = env.HB_SIGNER_PK as `0x${string}`;
  const adapters: Record<string, ChainAdapter> = {
    peaq: new PeaqAdapter({
      rpcUrl: env.PEAQ_RPC,
      chainId: Number(env.PEAQ_CHAIN_ID),
      registry: env.REGISTRY_ADDR as `0x${string}`,
      attestations: env.ATTESTATIONS_ADDR as `0x${string}`,
      privateKey,
    }),
  };
  if (env.ROBINHOOD_REGISTRY && env.ROBINHOOD_ATTESTATIONS) {
    adapters.robinhood = new RobinhoodChainAdapter({
      network: env.ROBINHOOD_NETWORK ?? "mainnet",
      rpcUrl: env.ROBINHOOD_RPC,
      registry: env.ROBINHOOD_REGISTRY as `0x${string}`,
      attestations: env.ROBINHOOD_ATTESTATIONS as `0x${string}`,
      privateKey,
    });
  }

  // Independent per chain: peaq failing never blocks Robinhood Chain and vice versa.
  // The report hash is the same on every chain.
  const outcomes = await anchorReportMulti(adapters, report, "health");
  return outcomes.map((o) =>
    o.ok
      ? { chain: o.chain, tokenId: o.result.tokenId.toString(), reportHash: o.result.reportHash, tx: o.result.tx }
      : { chain: o.chain, error: o.error },
  );
}

// In the /assess handler, after the assessment is saved:
//
//   const anchors = await anchorAssessment(c.env, {
//     vin: input.vin!,
//     odometerKm: input.odometerKm ?? null,
//     recordedAt: new Date().toISOString(),
//     health: r.health,
//     dtcCodes: input.dtcCodes ?? [],
//     tamperFlags: input.milOn ? ["mil_on"] : [],
//   });
//   for (const a of anchors) if ("tx" in a) await c.env.DB.prepare(
//     "INSERT INTO chain_anchors (id, vehicle_id, chain, token_id, report_hash, tx) VALUES (?, ?, ?, ?, ?, ?)",
//   ).bind(crypto.randomUUID(), vehicleId, a.chain, a.tokenId, a.reportHash, a.tx).run();
