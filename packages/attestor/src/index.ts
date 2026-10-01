export { canonicalize, reportHash, vinHash, type VehicleReport } from "./canonicalize.js";
export {
  anchorReport,
  anchorReportMulti,
  verifyReport,
  type AnchorResult,
  type ChainAnchorOutcome,
} from "./attestor.js";
export type { ChainAdapter } from "./adapters/types.js";
export { EvmAdapter, registryAbi, attestationsAbi, type EvmAdapterConfig } from "./adapters/evm.js";
export { PeaqAdapter, type PeaqAdapterConfig } from "./adapters/peaq.js";
export { RobinhoodChainAdapter, type RobinhoodChainAdapterConfig } from "./adapters/robinhood.js";
export {
  CHAINS,
  peaq,
  robinhood,
  robinhoodTestnet,
  chainById,
  txUrl,
  addressUrl,
  type ChainPreset,
  type Deployment,
} from "./chains.js";
