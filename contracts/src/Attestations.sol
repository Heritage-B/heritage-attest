// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IVehicleRegistry {
    function vinHashOf(uint256 tokenId) external view returns (bytes32);
}

/// @title HeritageB Attestations
/// @notice Append-only, tamper-evident log of report hashes anchored per vehicle.
///         Each entry proves that a given report (odometer + health + tamper flags)
///         existed at a block timestamp and was signed by a known signer. History
///         cannot be rewritten: entries are push-only and never mutated or deleted.
contract Attestations {
    IVehicleRegistry public immutable registry;

    struct Attestation {
        bytes32 reportHash; // keccak256 of the canonical report
        uint64 timestamp;   // block time of anchoring
        address signer;     // msg.sender that anchored (HB backend signer)
        bytes32 reportType; // short label, e.g. "health" / "provenance"
    }

    mapping(uint256 => Attestation[]) private _byToken;

    event Anchored(
        uint256 indexed tokenId,
        uint256 indexed index,
        bytes32 reportHash,
        bytes32 reportType,
        address signer
    );

    constructor(address registry_) {
        require(registry_ != address(0), "registry=0");
        registry = IVehicleRegistry(registry_);
    }

    /// @notice Anchor a report hash against a registered vehicle.
    /// @return index position of the new attestation in the vehicle's log.
    function anchor(uint256 tokenId, bytes32 reportHash, bytes32 reportType) external returns (uint256 index) {
        require(registry.vinHashOf(tokenId) != bytes32(0), "unknown vehicle");
        require(reportHash != bytes32(0), "empty hash");
        index = _byToken[tokenId].length;
        _byToken[tokenId].push(Attestation(reportHash, uint64(block.timestamp), msg.sender, reportType));
        emit Anchored(tokenId, index, reportHash, reportType, msg.sender);
    }

    /// @notice Number of attestations anchored for a vehicle.
    function count(uint256 tokenId) external view returns (uint256) {
        return _byToken[tokenId].length;
    }

    /// @notice Read a single attestation by index.
    function at(uint256 tokenId, uint256 index) external view returns (Attestation memory) {
        return _byToken[tokenId][index];
    }

    /// @notice True if a report hash was ever anchored for this vehicle.
    function verify(uint256 tokenId, bytes32 reportHash) external view returns (bool) {
        Attestation[] storage log = _byToken[tokenId];
        for (uint256 i = 0; i < log.length; i++) {
            if (log[i].reportHash == reportHash) return true;
        }
        return false;
    }
}
