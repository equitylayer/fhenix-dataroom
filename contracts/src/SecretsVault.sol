// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {EnumerableMap} from "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";
import {Multicall} from "@openzeppelin/contracts/utils/Multicall.sol";
import {FHE, euint128} from "@fhenixprotocol/cofhe-contracts/FHE.sol";

/// @title SecretsVault
/// @notice Self-sovereign secrets management. Namespaces hold secrets, each dual-encrypted
///         with a per-secret FHE key and the namespace FHE key. Two access layers with expiry:
///         namespace-wide (read all) or per-secret (read one).
contract SecretsVault is Ownable, Multicall {
    using EnumerableSet for EnumerableSet.UintSet;
    using EnumerableSet for EnumerableSet.Bytes32Set;
    using EnumerableMap for EnumerableMap.AddressToUintMap;

    struct Namespace {
        address owner;
        string name;
    }

    struct Secret {
        string key;
        bytes value;
        bytes nsValue;
        uint256 createdAt;
        uint256 updatedAt;
    }

    uint256 public constant PERMANENT = type(uint256).max;

    uint256 public namespaceCount;
    mapping(uint256 => Namespace) private _namespaces;
    mapping(uint256 => mapping(bytes32 => Secret)) private _secrets;
    mapping(uint256 => EnumerableSet.Bytes32Set) private _secretKeys;
    mapping(uint256 => EnumerableMap.AddressToUintMap) private _nsAccess;
    mapping(uint256 => mapping(bytes32 => EnumerableMap.AddressToUintMap)) private _secretAccess;

    mapping(uint256 => euint128) private _nsKey;
    mapping(uint256 => mapping(bytes32 => euint128)) private _secretFheKey;

    mapping(address => EnumerableSet.UintSet) private _ownerNamespaces;
    mapping(address => EnumerableSet.UintSet) private _granteeNamespaces;
    mapping(address => mapping(uint256 => EnumerableSet.Bytes32Set)) private _granteeSecretKeys;

    error NamespaceNotFound(uint256 namespaceId);
    error SecretNotFound(uint256 namespaceId, string key);
    error NotNamespaceOwner(uint256 namespaceId);
    error Unauthorized();
    error InvalidAddress();
    error EmptyKey();

    event NamespaceCreated(uint256 indexed namespaceId, address indexed owner, string name);
    event SecretSet(uint256 indexed namespaceId, bytes32 indexed keyHash);
    event SecretDeleted(uint256 indexed namespaceId, bytes32 indexed keyHash);
    event NamespaceAccessGranted(uint256 indexed namespaceId, address indexed account, uint256 expiresAt);
    event NamespaceAccessRevoked(uint256 indexed namespaceId, address indexed account);
    event SecretAccessGranted(
        uint256 indexed namespaceId, bytes32 indexed keyHash, address indexed account, uint256 expiresAt
    );
    event SecretAccessRevoked(uint256 indexed namespaceId, bytes32 indexed keyHash, address indexed account);
    event NamespaceKeyRotated(uint256 indexed namespaceId);
    event SecretKeyRotated(uint256 indexed namespaceId, bytes32 indexed keyHash);

    modifier onlyNsOwner(uint256 namespaceId) {
        if (_namespaces[namespaceId].owner == address(0)) {
            revert NamespaceNotFound(namespaceId);
        }
        if (_namespaces[namespaceId].owner != msg.sender) {
            revert NotNamespaceOwner(namespaceId);
        }
        _;
    }

    constructor(address _owner) Ownable(_owner) {}

    function createNamespace(string calldata name) external returns (uint256 namespaceId) {
        namespaceId = namespaceCount++;
        _namespaces[namespaceId] = Namespace({owner: msg.sender, name: name});
        _ownerNamespaces[msg.sender].add(namespaceId);

        euint128 nsKey = FHE.randomEuint128();
        _nsKey[namespaceId] = nsKey;
        FHE.allowThis(nsKey);
        FHE.allow(nsKey, msg.sender);

        emit NamespaceCreated(namespaceId, msg.sender, name);
    }

    function setSecret(uint256 namespaceId, string calldata key, bytes calldata value, bytes calldata nsValue)
        external
        onlyNsOwner(namespaceId)
    {
        if (bytes(key).length == 0) {
            revert EmptyKey();
        }

        bytes32 keyHash = keccak256(bytes(key));
        Secret storage s = _secrets[namespaceId][keyHash];

        if (bytes(s.key).length == 0) {
            _secretKeys[namespaceId].add(keyHash);
            s.key = key;
            s.createdAt = block.timestamp;

            euint128 fheKey = FHE.randomEuint128();
            _secretFheKey[namespaceId][keyHash] = fheKey;
            FHE.allowThis(fheKey);
            FHE.allow(fheKey, msg.sender);
        }

        s.value = value;
        s.nsValue = nsValue;
        s.updatedAt = block.timestamp;

        emit SecretSet(namespaceId, keyHash);
    }

    function deleteSecret(uint256 namespaceId, string calldata key) external onlyNsOwner(namespaceId) {
        bytes32 keyHash = keccak256(bytes(key));
        if (bytes(_secrets[namespaceId][keyHash].key).length == 0) {
            revert SecretNotFound(namespaceId, key);
        }

        _secretKeys[namespaceId].remove(keyHash);

        address[] memory grantees = _secretAccess[namespaceId][keyHash].keys();
        for (uint256 i; i < grantees.length; ++i) {
            _granteeSecretKeys[grantees[i]][namespaceId].remove(keyHash);
        }

        _secretAccess[namespaceId][keyHash].clear();
        _secretFheKey[namespaceId][keyHash] = euint128.wrap(0);
        delete _secrets[namespaceId][keyHash];
        emit SecretDeleted(namespaceId, keyHash);
    }

    function grantNamespaceAccess(uint256 namespaceId, address account, uint256 expiresAt)
        external
        onlyNsOwner(namespaceId)
    {
        if (account == address(0)) {
            revert InvalidAddress();
        }
        _nsAccess[namespaceId].set(account, expiresAt);
        _granteeNamespaces[account].add(namespaceId);
        FHE.allow(_nsKey[namespaceId], account);
        emit NamespaceAccessGranted(namespaceId, account, expiresAt);
    }

    function revokeNamespaceAccess(uint256 namespaceId, address account)
        external
        onlyNsOwner(namespaceId)
    {
        _nsAccess[namespaceId].remove(account);
        _granteeNamespaces[account].remove(namespaceId);
        emit NamespaceAccessRevoked(namespaceId, account);
    }

    function grantSecretAccess(uint256 namespaceId, string calldata key, address account, uint256 expiresAt)
        external
        onlyNsOwner(namespaceId)
    {
        if (account == address(0)) {
            revert InvalidAddress();
        }
        bytes32 keyHash = keccak256(bytes(key));
        if (bytes(_secrets[namespaceId][keyHash].key).length == 0) {
            revert SecretNotFound(namespaceId, key);
        }
        _secretAccess[namespaceId][keyHash].set(account, expiresAt);
        _granteeNamespaces[account].add(namespaceId);
        _granteeSecretKeys[account][namespaceId].add(keyHash);
        FHE.allow(_secretFheKey[namespaceId][keyHash], account);
        emit SecretAccessGranted(namespaceId, keyHash, account, expiresAt);
    }

    function revokeSecretAccess(uint256 namespaceId, string calldata key, address account)
        external
        onlyNsOwner(namespaceId)
    {
        bytes32 keyHash = keccak256(bytes(key));
        _secretAccess[namespaceId][keyHash].remove(account);
        _granteeSecretKeys[account][namespaceId].remove(keyHash);
        emit SecretAccessRevoked(namespaceId, keyHash, account);
    }

    function getSecret(uint256 namespaceId, string calldata key)
        external
        view
        returns (bytes memory value, bytes memory nsValue, uint256 createdAt, uint256 updatedAt)
    {
        bytes32 keyHash = keccak256(bytes(key));
        Secret storage s = _secrets[namespaceId][keyHash];

        if (bytes(s.key).length == 0) {
            revert SecretNotFound(namespaceId, key);
        }
        if (!hasAccess(namespaceId, keyHash, msg.sender)) {
            revert Unauthorized();
        }

        return (s.value, s.nsValue, s.createdAt, s.updatedAt);
    }

    function hasAccess(uint256 namespaceId, bytes32 keyHash, address account) public view returns (bool) {
        if (_namespaces[namespaceId].owner == account) {
            return true;
        }

        (bool nsExists, uint256 nsExpiry) = _nsAccess[namespaceId].tryGet(account);
        if (nsExists && block.timestamp < nsExpiry) {
            return true;
        }

        (bool secExists, uint256 secExpiry) = _secretAccess[namespaceId][keyHash].tryGet(account);
        if (secExists && block.timestamp < secExpiry) {
            return true;
        }

        return false;
    }

    function getNamespace(uint256 namespaceId)
        external
        view
        returns (address owner, string memory name, uint256 secretCount)
    {
        Namespace storage ns = _namespaces[namespaceId];
        if (ns.owner == address(0)) {
            revert NamespaceNotFound(namespaceId);
        }
        return (ns.owner, ns.name, _secretKeys[namespaceId].length());
    }

    function getNamespaceAccessExpiry(uint256 namespaceId, address account) external view returns (uint256) {
        (bool exists, uint256 expiry) = _nsAccess[namespaceId].tryGet(account);
        return exists ? expiry : 0;
    }

    function getSecretAccessExpiry(uint256 namespaceId, string calldata key, address account)
        external
        view
        returns (uint256)
    {
        (bool exists, uint256 expiry) = _secretAccess[namespaceId][keccak256(bytes(key))].tryGet(account);
        return exists ? expiry : 0;
    }

    function getNamespacesByOwner(address owner_) external view returns (uint256[] memory) {
        return _ownerNamespaces[owner_].values();
    }

    function getNamespacesByGrantee(address account) external view returns (uint256[] memory) {
        return _granteeNamespaces[account].values();
    }

    function getSecretKeys(uint256 namespaceId) external view returns (string[] memory) {
        Namespace storage ns = _namespaces[namespaceId];
        if (ns.owner == address(0)) {
            revert NamespaceNotFound(namespaceId);
        }

        if (ns.owner == msg.sender || _hasNamespaceAccess(namespaceId, msg.sender)) {
            bytes32[] memory hashes = _secretKeys[namespaceId].values();
            string[] memory keys = new string[](hashes.length);
            for (uint256 i; i < hashes.length; ++i) {
                keys[i] = _secrets[namespaceId][hashes[i]].key;
            }
            return keys;
        }

        bytes32[] memory grantedHashes = _granteeSecretKeys[msg.sender][namespaceId].values();
        if (grantedHashes.length == 0) {
            revert Unauthorized();
        }

        string[] memory keys = new string[](grantedHashes.length);
        for (uint256 i; i < grantedHashes.length; ++i) {
            keys[i] = _secrets[namespaceId][grantedHashes[i]].key;
        }
        return keys;
    }

    function getNamespaceGrantees(uint256 namespaceId)
        external
        view
        onlyNsOwner(namespaceId)
        returns (address[] memory)
    {
        return _nsAccess[namespaceId].keys();
    }

    function getSecretGrantees(uint256 namespaceId, string calldata key)
        external
        view
        onlyNsOwner(namespaceId)
        returns (address[] memory)
    {
        return _secretAccess[namespaceId][keccak256(bytes(key))].keys();
    }

    // ─── Key Rotation

    /// @notice Rotate the namespace FHE key. Client must re-encrypt nsValues afterwards.
    function rotateNamespaceKey(uint256 namespaceId) external onlyNsOwner(namespaceId) {
        euint128 newKey = FHE.randomEuint128();
        _nsKey[namespaceId] = newKey;
        FHE.allowThis(newKey);
        FHE.allow(newKey, msg.sender);

        address[] memory grantees = _nsAccess[namespaceId].keys();
        for (uint256 i; i < grantees.length; ++i) {
            FHE.allow(newKey, grantees[i]);
        }

        emit NamespaceKeyRotated(namespaceId);
    }

    /// @notice Rotate a per-secret FHE key. Client must re-encrypt the value afterwards.
    function rotateSecretKey(uint256 namespaceId, string calldata key) external onlyNsOwner(namespaceId) {
        bytes32 keyHash = keccak256(bytes(key));
        if (bytes(_secrets[namespaceId][keyHash].key).length == 0) {
            revert SecretNotFound(namespaceId, key);
        }

        euint128 newKey = FHE.randomEuint128();
        _secretFheKey[namespaceId][keyHash] = newKey;
        FHE.allowThis(newKey);
        FHE.allow(newKey, msg.sender);

        address[] memory grantees = _secretAccess[namespaceId][keyHash].keys();
        for (uint256 i; i < grantees.length; ++i) {
            FHE.allow(newKey, grantees[i]);
        }

        emit SecretKeyRotated(namespaceId, keyHash);
    }

    // ─── Views

    function getNsKeyHandle(uint256 namespaceId) external view returns (euint128) {
        Namespace storage ns = _namespaces[namespaceId];
        if (ns.owner == address(0)) {
            revert NamespaceNotFound(namespaceId);
        }
        if (ns.owner != msg.sender && !_hasNamespaceAccess(namespaceId, msg.sender)) {
            revert Unauthorized();
        }
        return _nsKey[namespaceId];
    }

    function getSecretKeyHandle(uint256 namespaceId, string calldata key) external view returns (euint128) {
        bytes32 keyHash = keccak256(bytes(key));
        if (bytes(_secrets[namespaceId][keyHash].key).length == 0) {
            revert SecretNotFound(namespaceId, key);
        }
        if (!hasAccess(namespaceId, keyHash, msg.sender)) {
            revert Unauthorized();
        }
        return _secretFheKey[namespaceId][keyHash];
    }

    function _hasNamespaceAccess(uint256 namespaceId, address account) internal view returns (bool) {
        (bool exists, uint256 expiry) = _nsAccess[namespaceId].tryGet(account);
        return exists && block.timestamp < expiry;
    }
}
