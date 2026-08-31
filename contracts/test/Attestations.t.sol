// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/VehicleRegistry.sol";
import "../src/Attestations.sol";

contract AttestationsTest is Test {
    VehicleRegistry reg;
    Attestations att;

    function setUp() public {
        reg = new VehicleRegistry();
        att = new Attestations(address(reg));
    }

    function testRegisterAssignsSequentialIds() public {
        uint256 a = reg.register(keccak256("SJNFAAJ11U1234567"));
        uint256 b = reg.register(keccak256("WVGZZZ1TZJ9000001"));
        assertEq(a, 1);
        assertEq(b, 2);
    }

    function testRegisterIsIdempotentPerVin() public {
        bytes32 vin = keccak256("SJNFAAJ11U1234567");
        uint256 a = reg.register(vin);
        uint256 b = reg.register(vin); // same VIN → same id, no duplicate
        assertEq(a, b);
        assertEq(reg.tokenForVin(vin), a);
    }

    function testAnchorAndVerify() public {
        uint256 id = reg.register(keccak256("SJNFAAJ11U1234567"));
        bytes32 h1 = keccak256("report-odo-42000");
        bytes32 h2 = keccak256("report-odo-42350");

        att.anchor(id, h1, bytes32("health"));
        att.anchor(id, h2, bytes32("health"));

        assertEq(att.count(id), 2);
        assertTrue(att.verify(id, h1));
        assertTrue(att.verify(id, h2));
        assertFalse(att.verify(id, keccak256("forged")));

        Attestations.Attestation memory first = att.at(id, 0);
        assertEq(first.reportHash, h1);
        assertEq(first.signer, address(this));
    }

    function testCannotAnchorUnknownVehicle() public {
        vm.expectRevert("unknown vehicle");
        att.anchor(999, keccak256("x"), bytes32("health"));
    }

    function testCannotAnchorEmptyHash() public {
        uint256 id = reg.register(keccak256("VIN"));
        vm.expectRevert("empty hash");
        att.anchor(id, bytes32(0), bytes32("health"));
    }
}
