import type { Address } from "viem";
import { robinhood, robinhoodTestnet } from "../chains.js";
import { EvmAdapter } from "./evm.js";

export interface RobinhoodChainAdapterConfig {
  /** "mainnet" (chainId 4663, default) or "testnet" (chainId 46630). */
  network?: "mainnet" | "testnet";
  /**
   * RPC URL. Defaults to the network's public RPC, which Robinhood documents as rate-limited
   * and not for production — pass a provider URL (Alchemy, QuickNode, …) in prod.
   */
  rpcUrl?: string;
  registry: Address;
  attestations: Address;
  /** 0x-prefixed private key of the HB backend signer (needs ETH for gas). Omit for read-only. */
  privateKey?: `0x${string}`;
}

/**
 * Robinhood Chain (Arbitrum Orbit L2, ETH gas) implementation of {@link ChainAdapter}.
 * Same contracts and same report → hash → anchor flow as peaq; only the chain differs.
 */
export class RobinhoodChainAdapter extends EvmAdapter {
  constructor(cfg: RobinhoodChainAdapterConfig) {
    const preset = cfg.network === "testnet" ? robinhoodTestnet : robinhood;
    super({
      rpcUrl: cfg.rpcUrl ?? preset.rpcUrl,
      chainId: preset.chainId,
      registry: cfg.registry,
      attestations: cfg.attestations,
      privateKey: cfg.privateKey,
      chainName: preset.name,
      nativeCurrency: preset.nativeCurrency,
    });
  }
}
