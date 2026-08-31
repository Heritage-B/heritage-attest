import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  type Address,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { ChainAdapter } from "./types.js";

const registryAbi = [
  { type: "function", name: "register", stateMutability: "nonpayable", inputs: [{ name: "vinHash", type: "bytes32" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "tokenForVin", stateMutability: "view", inputs: [{ name: "vinHash", type: "bytes32" }], outputs: [{ type: "uint256" }] },
] as const;

const attestationsAbi = [
  { type: "function", name: "anchor", stateMutability: "nonpayable", inputs: [{ name: "tokenId", type: "uint256" }, { name: "reportHash", type: "bytes32" }, { name: "reportType", type: "bytes32" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "verify", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }, { name: "reportHash", type: "bytes32" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "count", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "uint256" }] },
] as const;

export interface PeaqAdapterConfig {
  rpcUrl: string;
  chainId: number;
  registry: Address;
  attestations: Address;
  /** 0x-prefixed private key of the HB backend signer. */
  privateKey: `0x${string}`;
}

/** peaq (EVM) implementation of {@link ChainAdapter}. Works in Cloudflare Workers. */
export class PeaqAdapter implements ChainAdapter {
  private readonly pub: PublicClient;
  private readonly wallet: WalletClient;
  private readonly cfg: PeaqAdapterConfig;
  private readonly account;

  constructor(cfg: PeaqAdapterConfig) {
    this.cfg = cfg;
    const chain = defineChain({
      id: cfg.chainId,
      name: `peaq-${cfg.chainId}`,
      nativeCurrency: { name: "PEAQ", symbol: "PEAQ", decimals: 18 },
      rpcUrls: { default: { http: [cfg.rpcUrl] } },
    });
    this.account = privateKeyToAccount(cfg.privateKey);
    this.pub = createPublicClient({ chain, transport: http(cfg.rpcUrl) });
    this.wallet = createWalletClient({ account: this.account, chain, transport: http(cfg.rpcUrl) });
  }

  async tokenForVin(vinHash: `0x${string}`): Promise<bigint> {
    return (await this.pub.readContract({
      address: this.cfg.registry,
      abi: registryAbi,
      functionName: "tokenForVin",
      args: [vinHash],
    })) as bigint;
  }

  async registerVehicle(vinHash: `0x${string}`): Promise<bigint> {
    const existing = await this.tokenForVin(vinHash);
    if (existing !== 0n) return existing;
    const hash = await this.wallet.writeContract({
      address: this.cfg.registry,
      abi: registryAbi,
      functionName: "register",
      args: [vinHash],
      account: this.account,
      chain: this.wallet.chain,
    });
    await this.pub.waitForTransactionReceipt({ hash });
    return this.tokenForVin(vinHash);
  }

  async anchor(tokenId: bigint, reportHash: `0x${string}`, reportType: `0x${string}`): Promise<`0x${string}`> {
    const hash = await this.wallet.writeContract({
      address: this.cfg.attestations,
      abi: attestationsAbi,
      functionName: "anchor",
      args: [tokenId, reportHash, reportType],
      account: this.account,
      chain: this.wallet.chain,
    });
    await this.pub.waitForTransactionReceipt({ hash });
    return hash;
  }

  async verify(tokenId: bigint, reportHash: `0x${string}`): Promise<boolean> {
    return (await this.pub.readContract({
      address: this.cfg.attestations,
      abi: attestationsAbi,
      functionName: "verify",
      args: [tokenId, reportHash],
    })) as boolean;
  }

  async count(tokenId: bigint): Promise<bigint> {
    return (await this.pub.readContract({
      address: this.cfg.attestations,
      abi: attestationsAbi,
      functionName: "count",
      args: [tokenId],
    })) as bigint;
  }
}
