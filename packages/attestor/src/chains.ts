/**
 * Chain presets for heritage-attest. The attestor itself is chain-agnostic — any EVM chain
 * works through {@link EvmAdapter} — these presets only save copying chain ids, public RPCs,
 * explorers and live deployment addresses around.
 *
 * Sources (checked 2026-10-01):
 *  - peaq mainnet: live deployment of this repo (contracts/broadcast/Deploy.s.sol/3338).
 *  - Robinhood Chain (Arbitrum Orbit L2, gas token ETH):
 *    https://docs.robinhood.com/chain/connecting
 *    https://docs.robinhood.com/chain/deploy-smart-contracts
 *    Public RPCs are rate-limited and "not recommended for production" — use a provider URL
 *    (Alchemy, QuickNode, …) for anything beyond a demo.
 */

export type Hex = `0x${string}`;

export interface Deployment {
  registry: Hex;
  attestations: Hex;
}

export interface ChainPreset {
  /** Short stable key, e.g. "peaq" / "robinhood" / "robinhood-testnet". */
  key: string;
  name: string;
  chainId: number;
  testnet: boolean;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  /** Public RPC. Fine for reads and a one-off deploy; rate-limited. */
  rpcUrl: string;
  /** Block explorer base URL, no trailing slash. */
  explorerUrl: string;
  /** Live `VehicleRegistry` + `Attestations` addresses, once deployed. */
  deployment?: Deployment;
}

const ETH = { name: "Ether", symbol: "ETH", decimals: 18 } as const;

export const peaq: ChainPreset = {
  key: "peaq",
  name: "peaq",
  chainId: 3338,
  testnet: false,
  nativeCurrency: { name: "PEAQ", symbol: "PEAQ", decimals: 18 },
  rpcUrl: "https://peaq.api.onfinality.io/public",
  explorerUrl: "https://peaq.subscan.io",
  deployment: {
    registry: "0x99065e9801C6416E542C6D129d18c82d51f08475",
    attestations: "0x9aa2ed63403400aB7Cdeb44f933729fB3AF5f46d",
  },
};

export const robinhood: ChainPreset = {
  key: "robinhood",
  name: "Robinhood Chain",
  chainId: 4663,
  testnet: false,
  nativeCurrency: ETH,
  rpcUrl: "https://rpc.mainnet.chain.robinhood.com",
  explorerUrl: "https://robinhoodchain.blockscout.com",
  // deployment: filled in after `forge script` — see docs/DEPLOY_ROBINHOOD.md
};

export const robinhoodTestnet: ChainPreset = {
  key: "robinhood-testnet",
  name: "Robinhood Chain Testnet",
  chainId: 46630,
  testnet: true,
  nativeCurrency: ETH,
  rpcUrl: "https://rpc.testnet.chain.robinhood.com",
  explorerUrl: "https://explorer.testnet.chain.robinhood.com",
  // Deployed 2026-10-01, verified on Blockscout. Same addresses as on peaq: same deployer, same nonces.
  deployment: {
    registry: "0x99065e9801C6416E542C6D129d18c82d51f08475",
    attestations: "0x9aa2ed63403400aB7Cdeb44f933729fB3AF5f46d",
  },
};

export const CHAINS = { peaq, robinhood, robinhoodTestnet } as const;

/** Preset for a chain id, or undefined for chains we don't ship a preset for. */
export function chainById(chainId: number): ChainPreset | undefined {
  return Object.values(CHAINS).find((c) => c.chainId === chainId);
}

/** Explorer link for a transaction hash (Subscan for peaq, Blockscout for Robinhood Chain). */
export function txUrl(chain: ChainPreset, tx: string): string {
  return `${chain.explorerUrl}/tx/${tx}`;
}

/** Explorer link for a contract / account address. */
export function addressUrl(chain: ChainPreset, address: string): string {
  return chain.key === "peaq" ? `${chain.explorerUrl}/account/${address}` : `${chain.explorerUrl}/address/${address}`;
}
