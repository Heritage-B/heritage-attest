/**
 * Chain-agnostic surface the attestor needs. Implement this once per target
 * chain (peaq first). Keeps the grant deliverable portable: the same report →
 * hash → anchor flow works on peaq, DIMO, Base, or a local devnet.
 */
export interface ChainAdapter {
  /** Register (or return existing) the vehicle identity for a VIN hash. Returns its tokenId. */
  registerVehicle(vinHash: `0x${string}`): Promise<bigint>;

  /** Token id for a VIN hash, or 0n if not yet registered. */
  tokenForVin(vinHash: `0x${string}`): Promise<bigint>;

  /** Anchor a report hash against a vehicle. Returns the transaction hash. */
  anchor(tokenId: bigint, reportHash: `0x${string}`, reportType: `0x${string}`): Promise<`0x${string}`>;

  /** True if the report hash was ever anchored for this vehicle. */
  verify(tokenId: bigint, reportHash: `0x${string}`): Promise<boolean>;

  /** How many attestations exist for this vehicle. */
  count(tokenId: bigint): Promise<bigint>;
}
