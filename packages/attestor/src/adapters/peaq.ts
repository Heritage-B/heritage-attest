import type { Address } from "viem";
import { EvmAdapter } from "./evm.js";

export interface PeaqAdapterConfig {
  rpcUrl: string;
  chainId: number;
  registry: Address;
  attestations: Address;
  /** 0x-prefixed private key of the HB backend signer. */
  privateKey: `0x${string}`;
}

/** peaq (EVM) implementation of {@link ChainAdapter}. Works in Cloudflare Workers. */
export class PeaqAdapter extends EvmAdapter {
  constructor(cfg: PeaqAdapterConfig) {
    super({
      ...cfg,
      chainName: `peaq-${cfg.chainId}`,
      nativeCurrency: { name: "PEAQ", symbol: "PEAQ", decimals: 18 },
    });
  }
}
