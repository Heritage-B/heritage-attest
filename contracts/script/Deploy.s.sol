// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/VehicleRegistry.sol";
import "../src/Attestations.sol";

/// @notice Deploys the registry + attestations pair. Chain-agnostic: the same script and the
///         same bytecode go to peaq, Robinhood Chain, or a local anvil.
///
/// Signer — pick one, the key never lives in this repo:
///   * keystore (recommended): `cast wallet import hb-deployer --interactive` once, then
///       forge script script/Deploy.s.sol --rpc-url robinhood_testnet --account hb-deployer \
///         --sender <deployer address> --broadcast
///   * hardware wallet: `--ledger` / `--trezor` instead of `--account`.
///   * env var (local anvil / CI only): DEPLOYER_PK=0x... forge script ... --broadcast
///
/// Full walkthrough for Robinhood Chain: docs/DEPLOY_ROBINHOOD.md.
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envOr("DEPLOYER_PK", uint256(0));
        if (pk != 0) {
            vm.startBroadcast(pk);
        } else {
            vm.startBroadcast(); // signer from the CLI: --account / --ledger / --interactive
        }

        VehicleRegistry registry = new VehicleRegistry();
        Attestations attestations = new Attestations(address(registry));

        vm.stopBroadcast();

        console2.log("VehicleRegistry:", address(registry));
        console2.log("Attestations:  ", address(attestations));
        console2.log("chainId:       ", block.chainid);
    }
}
