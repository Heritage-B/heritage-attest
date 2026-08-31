// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/VehicleRegistry.sol";
import "../src/Attestations.sol";

/// @notice Deploys the registry + attestations pair.
/// Usage:
///   DEPLOYER_PK=0x... forge script script/Deploy.s.sol \
///     --rpc-url https://rpcpc1-qa.agung.peaq.network --broadcast
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PK");
        vm.startBroadcast(pk);

        VehicleRegistry registry = new VehicleRegistry();
        Attestations attestations = new Attestations(address(registry));

        vm.stopBroadcast();

        console2.log("VehicleRegistry:", address(registry));
        console2.log("Attestations:  ", address(attestations));
    }
}
