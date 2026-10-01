import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  type Address,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import type { ChainAdapter } from "./types.js";

export const registryAbi = [
  { type: "function", name: "register", stateMutability: "nonpayable", inputs: [{ name: "vinHash", type: "bytes32" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "tokenForVin", stateMutability: "view", inputs: [{ name: "vinHash", type: "bytes32" }], outputs: [{ type: "uint256" }] },
] as const;

export const attestationsAbi = [
  { type: "function", name: "anchor", stateMutability: "nonpayable", inputs: [{ name: "tokenId", type: "uint256" }, { name: "reportHash", type: "bytes32" }, { name: "reportType", type: "bytes32" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "verify", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }, { name: "reportHash", type: "bytes32" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "count", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "uint256" }] },
] as const;

export interface EvmAdapterConfig {
  rpcUrl: string;
  chainId: number;
  registry: Address;
  attestations: Address;
  /**
   * 0x-prefixed private key of the HB backend signer. Omit it for a read-only adapter
   * (verify pages, indexers): reads work, writes throw.
   */
  privateKey?: `0x${string}`;
  /** Display name for the viem chain object (cosmetic). */
  chainName?: string;
  /** Native gas token (cosmetic in viem; signing only depends on chainId). */
  nativeCurrency?: { name: string; symbol: string; decimals: number };
}

/**
 * Generic EVM implementation of {@link ChainAdapter}: the same `VehicleRegistry` +
 * `Attestations` pair on any EVM chain (peaq, Robinhood Chain, Arbitrum, a local anvil…).
 * Works in Cloudflare Workers (viem, fetch transport).
 */
export class EvmAdapter implements ChainAdapter {
  protected readonly pub: PublicClient;
  protected readonly wallet?: WalletClient;
  protected readonly account?: PrivateKeyAccount;
  protected readonly cfg: EvmAdapterConfig;

  constructor(cfg: EvmAdapterConfig) {
    this.cfg = cfg;
    const chain = defineChain({
      id: cfg.chainId,
      name: cfg.chainName ?? `evm-${cfg.chainId}`,
      nativeCurrency: cfg.nativeCurrency ?? { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [cfg.rpcUrl] } },
    });
    this.pub = createPublicClient({ chain, transport: http(cfg.rpcUrl) });
    if (cfg.privateKey) {
      this.account = privateKeyToAccount(cfg.privateKey);
      this.wallet = createWalletClient({ account: this.account, chain, transport: http(cfg.rpcUrl) });
    }
  }

  get chainId(): number {
    return this.cfg.chainId;
  }

  private signer(): { wallet: WalletClient; account: PrivateKeyAccount } {
    if (!this.wallet || !this.account) throw new Error("read-only adapter: no privateKey configured");
    return { wallet: this.wallet, account: this.account };
  }

  /** Wait for inclusion and fail loudly if the transaction reverted. */
  private async confirm(hash: `0x${string}`): Promise<void> {
    const receipt = await this.pub.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error(`transaction reverted: ${hash}`);
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
    const { wallet, account } = this.signer();
    const hash = await wallet.writeContract({
      address: this.cfg.registry,
      abi: registryAbi,
      functionName: "register",
      args: [vinHash],
      account,
      chain: wallet.chain,
    });
    await this.confirm(hash);
    return this.tokenForVin(vinHash);
  }

  async anchor(tokenId: bigint, reportHash: `0x${string}`, reportType: `0x${string}`): Promise<`0x${string}`> {
    const { wallet, account } = this.signer();
    const hash = await wallet.writeContract({
      address: this.cfg.attestations,
      abi: attestationsAbi,
      functionName: "anchor",
      args: [tokenId, reportHash, reportType],
      account,
      chain: wallet.chain,
    });
    await this.confirm(hash);
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
