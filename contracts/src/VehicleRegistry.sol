// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title HeritageB Vehicle Registry
/// @notice Mints a unique, permanent on-chain identity per vehicle, keyed by the
///         keccak256 hash of its VIN. The raw VIN never touches the chain — only its
///         hash — so the registry is privacy-preserving while still one-per-car.
contract VehicleRegistry {
    /// @dev Incrementing token id; 0 is reserved for "does not exist".
    uint256 public nextId = 1;

    mapping(bytes32 => uint256) private _tokenOfVin; // keccak256(VIN) => tokenId
    mapping(uint256 => bytes32) public vinHashOf;    // tokenId => keccak256(VIN)
    mapping(uint256 => address) public custodianOf;  // who registered it (e.g. HB signer)

    event VehicleRegistered(uint256 indexed tokenId, bytes32 indexed vinHash, address indexed custodian);

    /// @notice Register a vehicle identity for a VIN hash. Idempotent per VIN.
    /// @param vinHash keccak256 of the uppercased, trimmed VIN.
    /// @return id the (new or existing) token id for this vehicle.
    function register(bytes32 vinHash) external returns (uint256 id) {
        require(vinHash != bytes32(0), "empty vinHash");
        id = _tokenOfVin[vinHash];
        if (id != 0) return id; // already registered — return existing id
        id = nextId++;
        _tokenOfVin[vinHash] = id;
        vinHashOf[id] = vinHash;
        custodianOf[id] = msg.sender;
        emit VehicleRegistered(id, vinHash, msg.sender);
    }

    /// @notice Token id for a VIN hash, or 0 if not registered.
    function tokenForVin(bytes32 vinHash) external view returns (uint256) {
        return _tokenOfVin[vinHash];
    }

    /// @notice True if the token id refers to a registered vehicle.
    function exists(uint256 tokenId) external view returns (bool) {
        return vinHashOf[tokenId] != bytes32(0);
    }
}
