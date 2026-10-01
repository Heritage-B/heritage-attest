# Deploying heritage-attest to Robinhood Chain

The same two contracts that are live on peaq (`VehicleRegistry` + `Attestations`) go to
Robinhood Chain unchanged — same source, same compiler settings, same bytecode. This page is the
exact sequence the owner runs. **Nothing here is run by CI or by an agent: every command that
signs a transaction is typed by the owner, with the key coming from his own encrypted keystore.**

Do testnet first, then mainnet.

## Network parameters

Checked on 2026-10-01 against the docs *and* the live RPCs (`eth_chainId`, `web3_clientVersion`,
`ArbSys.arbOSVersion()`):

| | Mainnet | Testnet |
|---|---|---|
| Chain ID | **4663** (`0x1237`) | **46630** (`0xb626`) |
| Public RPC (rate-limited) | `https://rpc.mainnet.chain.robinhood.com` | `https://rpc.testnet.chain.robinhood.com` |
| Provider RPC (recommended for prod) | `https://robinhood-mainnet.g.alchemy.com/v2/<KEY>` | `https://robinhood-testnet.g.alchemy.com/v2/<KEY>` |
| Explorer (Blockscout) | https://robinhoodchain.blockscout.com | https://explorer.testnet.chain.robinhood.com |
| Verifier URL | `https://robinhoodchain.blockscout.com/api/` | `https://explorer.testnet.chain.robinhood.com/api/` |
| Gas token | ETH | ETH (test) |
| Base fee seen | ~0.02 gwei | ~0.01 gwei |
| Stack | Arbitrum Nitro v3.12, ArbOS 61 | Arbitrum Nitro v3.12, ArbOS 61 |
| Get funds | bridge from Ethereum (below) | faucet (below) |

Sources:
[Connecting](https://docs.robinhood.com/chain/connecting) ·
[Deploy smart contracts](https://docs.robinhood.com/chain/deploy-smart-contracts) ·
[Bridging](https://docs.robinhood.com/chain/bridging) ·
[Overview](https://docs.robinhood.com/chain) ·
faucet listed in the Arbitrum Open House buildathon resources on HackQuest.

### Caveats that matter for this repo

- **EVM version.** `contracts/foundry.toml` pins `evm_version = "london"` — that is what the
  live peaq contracts were compiled with (checked byte-for-byte), so both chains run the same
  artifact. Robinhood Chain runs ArbOS 61, which supports Shanghai/Cancun opcodes (PUSH0 etc.)
  anyway, so there is no PUSH0 problem either way.
- **Gas limits with `forge script`.** Foundry 1.8 does not know chain ids 4663/46630
  (`cast chain` → `unknown`), so `forge script` sizes gas from its local simulation. On an
  Arbitrum chain the L1 data cost is charged as extra L2 gas, which the local simulation does not
  see. Measured for `VehicleRegistry`: 220,353 gas locally vs 250,454 (testnet) / 223,269
  (mainnet) from the node. Pass `--gas-estimate-multiplier 200` — at ~0.02 gwei the headroom
  costs nothing, and a too-low limit is rejected before inclusion ("intrinsic gas too low"), not
  burned.
- **Public RPCs are rate-limited** and Robinhood says not for production. Fine for a deploy;
  give the backend a provider URL (Alchemy/QuickNode/…) for steady anchoring.
- **Canonical bridge withdrawals take ~7 days** (Arbitrum challenge period). Only bridge in what
  the signer needs.
- **Contracts are permissionless** (same as on peaq): anyone can `register` a VIN hash or
  `anchor` a hash; each attestation records `signer = msg.sender`. Anything that trusts an
  attestation should check the signer is the HB backend address.

### Cost

At ~0.02 gwei: deploying both contracts ≈ 0.56 M gas ≈ 0.000012 ETH; a first-time seal
(register + anchor, two txs) ≈ 0.25 M gas ≈ 0.000005 ETH; a repeat seal (anchor only) about half. **0.002 ETH covers the deploy plus several
hundred seals.** Testnet ETH from the faucet is plenty.

## 0. Prerequisites

```bash
curl -L https://foundry.paradigm.xyz | bash && foundryup
cd contracts
[ -d lib/forge-std ] || forge install foundry-rs/forge-std
forge test            # 5 passing
```

## 1. Deployer key — encrypted keystore, never in the repo or shell history

```bash
# Paste the private key at the hidden prompt and choose a password.
# Stored encrypted in ~/.foundry/keystores/hb-deployer.
cast wallet import hb-deployer --interactive

export DEPLOYER=$(cast wallet address --account hb-deployer)
echo $DEPLOYER
```

Using the same key as the peaq deployment / backend `HB_SIGNER_PK` keeps one HB signer address
on both chains. Any funded key works for deploying — the contracts don't care who deploys.

## 2. Fund the deployer

**Testnet** — any of:
- official faucet: https://faucet.testnet.chain.robinhood.com
- Alchemy: https://www.alchemy.com/faucets/robinhood-testnet
- QuickNode: https://faucet.quicknode.com/robinhood/testnet

**Mainnet** — bridge ETH from Ethereum:
- canonical (trustless, ~10 min in, ~7 days out):
  https://portal.arbitrum.io/bridge?destinationChain=robinhood-chain&sourceChain=ethereum
- fast bridges listed in the Robinhood docs: Relay, Across (seconds), Stargate, Chainlink
  Transporter (minutes).

```bash
export ROBINHOOD_TESTNET_RPC=https://rpc.testnet.chain.robinhood.com
export ROBINHOOD_RPC=https://rpc.mainnet.chain.robinhood.com
cast balance $DEPLOYER --ether --rpc-url robinhood_testnet
cast balance $DEPLOYER --ether --rpc-url robinhood
```

## 3. Deploy — testnet

```bash
cd contracts

# Dry run (simulation only, nothing is sent):
forge script script/Deploy.s.sol --rpc-url robinhood_testnet \
  --account hb-deployer --sender $DEPLOYER

# Deploy + verify on Blockscout:
forge script script/Deploy.s.sol --rpc-url robinhood_testnet \
  --account hb-deployer --sender $DEPLOYER \
  --broadcast --gas-estimate-multiplier 200 \
  --verify --verifier blockscout \
  --verifier-url https://explorer.testnet.chain.robinhood.com/api/
```

The script prints:

```
VehicleRegistry: 0x…
Attestations:    0x…
chainId:         46630
```

and saves the run to `contracts/broadcast/Deploy.s.sol/46630/run-latest.json` (gitignored).

```bash
export REGISTRY=0x...      # from the output
export ATTESTATIONS=0x...
```

## 4. Deploy — mainnet

Same command, mainnet alias and verifier:

```bash
forge script script/Deploy.s.sol --rpc-url robinhood \
  --account hb-deployer --sender $DEPLOYER \
  --broadcast --gas-estimate-multiplier 200 \
  --verify --verifier blockscout \
  --verifier-url https://robinhoodchain.blockscout.com/api/
```

## 5. Verify on the explorer (if `--verify` was skipped or failed)

`forge verify-contract` reads `evm_version = "london"` and the optimizer settings from
`foundry.toml`, so the bytecode reproduces.

```bash
# testnet: chain id 46630 + testnet verifier; mainnet: 4663 + https://robinhoodchain.blockscout.com/api/
forge verify-contract $REGISTRY src/VehicleRegistry.sol:VehicleRegistry \
  --chain-id 46630 --rpc-url robinhood_testnet \
  --verifier blockscout --verifier-url https://explorer.testnet.chain.robinhood.com/api/

forge verify-contract $ATTESTATIONS src/Attestations.sol:Attestations \
  --chain-id 46630 --rpc-url robinhood_testnet \
  --verifier blockscout --verifier-url https://explorer.testnet.chain.robinhood.com/api/ \
  --constructor-args $(cast abi-encode "constructor(address)" $REGISTRY)
```

If the mainnet explorer API answers with a browser challenge (it did on 2026-10-01: Cloudflare
"Just a moment…" / HTTP 403 for scripts), verify on Sourcify instead — it supports chain 4663 and the
live contracts are verified there as `exact_match`:

```bash
forge verify-contract $REGISTRY src/VehicleRegistry.sol:VehicleRegistry \
  --chain-id 4663 --rpc-url robinhood --verifier sourcify
forge verify-contract $ATTESTATIONS src/Attestations.sol:Attestations \
  --chain-id 4663 --rpc-url robinhood --verifier sourcify \
  --constructor-args $(cast abi-encode "constructor(address)" $REGISTRY)
```

Or retry later, or verify in the explorer UI with the standard JSON input:
`forge verify-contract $REGISTRY src/VehicleRegistry.sol:VehicleRegistry --show-standard-json-input > registry.json`.

## 6. Smoke test (testnet) — one real register + anchor, signed from the keystore

Uses a dummy VIN, not a customer car.

```bash
VH=$(cast keccak "HBTESTVIN00000001")
cast send $REGISTRY "register(bytes32)" $VH --account hb-deployer --rpc-url robinhood_testnet
TOKEN=$(cast call $REGISTRY "tokenForVin(bytes32)(uint256)" $VH --rpc-url robinhood_testnet)
RH=$(cast keccak "heritage-attest smoke test")
cast send $ATTESTATIONS "anchor(uint256,bytes32,bytes32)" $TOKEN $RH \
  $(cast format-bytes32-string smoke) --account hb-deployer --rpc-url robinhood_testnet
cast call $ATTESTATIONS "verify(uint256,bytes32)(bool)" $TOKEN $RH --rpc-url robinhood_testnet   # true
cast call $ATTESTATIONS "count(uint256)(uint256)" $TOKEN --rpc-url robinhood_testnet            # 1
```

The `cast send` output has the tx hash → `https://explorer.testnet.chain.robinhood.com/tx/<hash>`.
On mainnet, skip the smoke test: the backend's first real seal is the proof.

## 7. Record the addresses

1. `packages/attestor/src/chains.ts` → `deployment: { registry, attestations }` on
   `robinhoodTestnet` / `robinhood`.
2. `apps/verify/index.html` → the matching entry in `NETWORKS` (empty addresses are skipped).
3. README → "Deployments" table.
4. HeritageB backend (Cloudflare Worker) — same pattern as the peaq secrets:

   ```bash
   cd HeritageB/backend
   npx wrangler secret put ROBINHOOD_CHAIN_ID       # 46630 (testnet) or 4663 (mainnet)
   npx wrangler secret put ROBINHOOD_REGISTRY
   npx wrangler secret put ROBINHOOD_ATTESTATIONS
   npx wrangler secret put ROBINHOOD_RPC            # optional: empty → public RPC for 4663/46630
   npx wrangler secret put ROBINHOOD_SIGNER_PK      # optional: empty → HB_SIGNER_PK signs on Robinhood too
   ```

   Robinhood anchoring switches on when `ROBINHOOD_CHAIN_ID`, `ROBINHOOD_REGISTRY`,
   `ROBINHOOD_ATTESTATIONS` and a signer key are present; otherwise it's skipped and peaq works
   exactly as before. The signer's address needs ETH on the chain you point it at.
   A provider RPC URL with an API key in it must be a secret, never a `[vars]` entry.
