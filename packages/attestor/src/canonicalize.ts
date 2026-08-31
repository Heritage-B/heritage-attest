import { keccak256, stringToBytes } from "viem";

/**
 * A vehicle report as produced by the HeritageB backend after an assessment.
 * Only the fields below are canonicalized into the on-chain hash — everything
 * else (raw telemetry, photos, personal data) stays off-chain.
 */
export interface VehicleReport {
  /** Vehicle identification number. Normalized (trim + uppercase) before hashing. */
  vin: string;
  /** Odometer in km at the time of the report, if the car reports it. */
  odometerKm?: number | null;
  /** ISO-8601 timestamp of the reading this report is based on. */
  recordedAt: string;
  /** Health score 0–100, if computed. */
  health?: number | null;
  /** Stored diagnostic trouble codes, e.g. ["C0300", "P0301"]. */
  dtcCodes?: string[];
  /** Tamper signals detected, e.g. ["codes_cleared", "odometer_mismatch"]. */
  tamperFlags?: string[];
}

/**
 * Deterministic canonical JSON of a report. Same report → same string on any
 * machine: keys are fixed and ordered, VIN and codes are normalized, and
 * unordered arrays are sorted. This string is what gets hashed.
 */
export function canonicalize(report: VehicleReport): string {
  const norm = {
    vin: report.vin.trim().toUpperCase(),
    odometerKm: report.odometerKm ?? null,
    recordedAt: report.recordedAt,
    health: report.health ?? null,
    dtcCodes: [...(report.dtcCodes ?? [])].map((c) => c.trim().toUpperCase()).sort(),
    tamperFlags: [...(report.tamperFlags ?? [])].map((f) => f.trim().toLowerCase()).sort(),
  };
  // Fixed key order — do not rely on insertion order for determinism.
  const keys: (keyof typeof norm)[] = ["vin", "odometerKm", "recordedAt", "health", "dtcCodes", "tamperFlags"];
  return JSON.stringify(norm, keys as string[]);
}

/** keccak256 of the canonical report — the value anchored on-chain. */
export function reportHash(report: VehicleReport): `0x${string}` {
  return keccak256(stringToBytes(canonicalize(report)));
}

/** keccak256 of the normalized VIN — the per-vehicle identity key. */
export function vinHash(vin: string): `0x${string}` {
  return keccak256(stringToBytes(vin.trim().toUpperCase()));
}
