// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint128} from "@fhenixprotocol/cofhe-contracts/FHE.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

/// @title DataRoom
/// @notice Trustless data room with FHE-encrypted access control.
contract DataRoom {
    using EnumerableSet for EnumerableSet.AddressSet;

    // Errors
    error OnlyAdmin();
    error RoomNotFound();
    error NotMember();
    error Unauthorized();
    error LengthMismatch();
    error NotParentRoom();
    error IsParentRoom();
    error BatchTooLarge();
    error InvalidAddress();
    error AlreadyInitialized();
    error DocumentNotFound();
    error DocumentDeleted();
    error EmptyBatch();
    error CannotRevokeOperator();

    struct Room {
        address owner;
        string name;
        uint256 documentCount;
        uint256 memberCount;
        bool isParent;
        uint256 parentId;
        uint256 childCount;
    }

    struct Document {
        string cid;
        string name;
        uint256 createdAt;
        bytes wrappedKey;
        bytes metadata;
        bool deleted;
    }

    uint256 public constant NO_PARENT = type(uint256).max;
    uint256 public constant MAX_BATCH_SIZE = 100;
    uint256 public constant PERMANENT = type(uint256).max;

    address public admin;
    address public operator;
    bool private _initialized;

    uint256 public roomCount;
    mapping(uint256 => Room) public rooms;
    mapping(uint256 => mapping(uint256 => Document)) internal _documents;

    /// @dev FHE-encrypted folder key (root secret for AES key wrapping)
    mapping(uint256 => euint128) private _roomKey;
    mapping(uint256 => uint256) public roomKeyVersion;
    mapping(uint256 => mapping(uint256 => uint256)) public documentKeyVersion;

    /// @dev Packed member array: slots 0..memberCount-1 are always active members.
    mapping(uint256 => mapping(uint256 => address)) private _members;
    /// @dev Reverse lookup: member address → slot index in _members.
    mapping(uint256 => mapping(address => uint256)) private _memberIndex;
    mapping(uint256 => mapping(address => bool)) private _isMember;
    /// @dev Per-member expiry. `PERMANENT` = never expires. 0 only for non-members.
    mapping(uint256 => mapping(address => uint256)) private _memberExpiry;

    /// @dev parentId => child index => roomId
    mapping(uint256 => mapping(uint256 => uint256)) private _children;

    /// @dev parentId => set of addresses that have been granted access at the room level.
    ///      Distinct from per-folder membership (which is union). Tracks intent, not derived.
    mapping(uint256 => EnumerableSet.AddressSet) private _roomWideAccess;
    /// @dev parentId => user => expiry for room-wide grant. `PERMANENT` = never expires.
    mapping(uint256 => mapping(address => uint256)) private _roomWideExpiry;

    // Public Events
    event RoomCreated(uint256 indexed roomId, address indexed creator);
    event FolderCreated(uint256 indexed parentId, uint256 indexed roomId);
    event DocumentAdded(uint256 indexed roomId, uint256 indexed docIndex);
    event MembershipChanged(uint256 indexed roomId);
    event RoomRekeyed(uint256 indexed roomId, uint256 newVersion);
    event DocumentRemoved(uint256 indexed roomId, uint256 indexed docIndex);
    event RoomRenamed(uint256 indexed roomId, string newName);
    event AdminChanged(address indexed oldAdmin, address indexed newAdmin);

    // Modifiers
    modifier onlyAdmin() {
        if (msg.sender != admin) revert OnlyAdmin();
        _;
    }

    modifier onlyRoomOwner(uint256 roomId) {
        if (rooms[roomId].owner != msg.sender) revert OnlyAdmin();
        _;
    }

    modifier notParentRoom(uint256 roomId) {
        if (rooms[roomId].isParent) revert IsParentRoom();
        _;
    }

    modifier roomExists(uint256 roomId) {
        if (roomId >= roomCount) revert RoomNotFound();
        _;
    }

    // Initializer

    /// @notice Initialize the DataRoom with an admin and operator.
    /// @param _admin The admin (owner/board) address.
    /// @param _operator Platform operator address.
    function initialize(address _admin, address _operator) external {
        if (_initialized) revert AlreadyInitialized();
        if (_admin == address(0)) revert InvalidAddress();
        if (_operator == address(0)) revert InvalidAddress();
        _initialized = true;
        admin = _admin;
        operator = _operator;
    }

    /// @notice Transfer admin to a new address.
    /// @param newAdmin The new admin address.
    function setAdmin(address newAdmin) external onlyAdmin {
        if (newAdmin == address(0)) revert InvalidAddress();
        address oldAdmin = admin;
        admin = newAdmin;
        emit AdminChanged(oldAdmin, newAdmin);
    }

    // Room Management

    /// @notice Create a new parent room
    /// @param name Human-readable room name.
    /// @return roomId The ID of the newly created room.
    function createRoom(string calldata name) external returns (uint256 roomId) {
        roomId = roomCount++;

        rooms[roomId] = Room({
            owner: msg.sender,
            name: name,
            documentCount: 0,
            memberCount: 0,
            isParent: true,
            parentId: NO_PARENT,
            childCount: 0
        });

        emit RoomCreated(roomId, msg.sender);
    }

    /// @notice Create a folder inside a parent room. Folder gets its own FHE key, members, documents.
    /// @param parentId The parent room ID.
    /// @param name Human-readable folder name.
    /// @return roomId The ID of the newly created folder.
    function createFolder(uint256 parentId, string calldata name)
        external
        roomExists(parentId)
        onlyRoomOwner(parentId)
        returns (uint256 roomId)
    {
        Room storage parent = rooms[parentId];
        if (!parent.isParent) revert NotParentRoom();

        roomId = roomCount++;

        rooms[roomId] = Room({
            owner: msg.sender,
            name: name,
            documentCount: 0,
            memberCount: 0,
            isParent: false,
            parentId: parentId,
            childCount: 0
        });

        _children[parentId][parent.childCount] = roomId;
        parent.childCount++;

        // Generate FHE key for the folder
        euint128 key = FHE.randomEuint128();
        _roomKey[roomId] = key;
        FHE.allowThis(key);
        FHE.allow(key, operator);

        _grantUser(roomId, msg.sender, PERMANENT);

        address[] memory roomWide = _roomWideAccess[parentId].values();
        for (uint256 i; i < roomWide.length;) {
            _grantUser(roomId, roomWide[i], _roomWideExpiry[parentId][roomWide[i]]);
            unchecked {
                ++i;
            }
        }

        emit FolderCreated(parentId, roomId);
    }

    /// @notice Rename an existing room or folder.
    /// @param roomId  The room or folder to rename.
    /// @param newName The new name.
    function renameRoom(uint256 roomId, string calldata newName) external roomExists(roomId) onlyRoomOwner(roomId) {
        rooms[roomId].name = newName;
        emit RoomRenamed(roomId, newName);
    }

    // Document Management

    /// @notice Add documents to a folder. Pass empty wrappedKeys for public (unencrypted) documents.
    /// @param roomId      The folder to add documents to.
    /// @param cids        Ordered array of Storacha CIDs.
    /// @param names       Ordered array of file names.
    /// @param wrappedKeys Ordered array of wrapped CEKs (empty bytes for public folders).
    /// @param metadata    Ordered array of arbitrary metadata bytes per document.
    function addDocuments(
        uint256 roomId,
        string[] calldata cids,
        string[] calldata names,
        bytes[] calldata wrappedKeys,
        bytes[] calldata metadata
    ) external roomExists(roomId) onlyRoomOwner(roomId) notParentRoom(roomId) {
        if (cids.length == 0) revert EmptyBatch();
        if (cids.length != names.length || cids.length != wrappedKeys.length || cids.length != metadata.length) {
            revert LengthMismatch();
        }
        if (cids.length > MAX_BATCH_SIZE) revert BatchTooLarge();
        for (uint256 i = 0; i < cids.length;) {
            uint256 docIndex = _storeDocument(roomId, cids[i], names[i], wrappedKeys[i], metadata[i]);
            emit DocumentAdded(roomId, docIndex);
            unchecked {
                ++i;
            }
        }
    }

    /// @notice Soft-delete a document. Indices stay stable; deleted docs are skipped by getDocument.
    /// @param roomId   The folder containing the document.
    /// @param docIndex Index of the document to remove.
    function removeDocument(uint256 roomId, uint256 docIndex)
        external
        roomExists(roomId)
        onlyRoomOwner(roomId)
        notParentRoom(roomId)
    {
        if (docIndex >= rooms[roomId].documentCount) revert DocumentNotFound();
        if (_documents[roomId][docIndex].deleted) revert DocumentDeleted();
        _documents[roomId][docIndex].deleted = true;
        emit DocumentRemoved(roomId, docIndex);
    }

    /// @notice Update metadata for documents in a folder.
    /// @param roomId      The folder containing the documents.
    /// @param docIndices  Indices of the documents to update.
    /// @param metadata    New metadata bytes per document.
    function updateDocumentMetadata(uint256 roomId, uint256[] calldata docIndices, bytes[] calldata metadata)
        external
        roomExists(roomId)
        onlyRoomOwner(roomId)
        notParentRoom(roomId)
    {
        if (docIndices.length != metadata.length) revert LengthMismatch();
        if (docIndices.length > MAX_BATCH_SIZE) revert BatchTooLarge();
        uint256 docCount = rooms[roomId].documentCount;
        for (uint256 i = 0; i < docIndices.length;) {
            if (docIndices[i] >= docCount) revert DocumentNotFound();
            if (_documents[roomId][docIndices[i]].deleted) revert DocumentDeleted();
            _documents[roomId][docIndices[i]].metadata = metadata[i];
            unchecked {
                ++i;
            }
        }
    }

    /// @notice Update wrapped keys in bulk (e.g. after rekey — CIDs stay the same).
    /// @param roomId        The folder containing the documents.
    /// @param docIndices      Indices of the documents to update.
    /// @param newWrappedKeys  New wrapped CEKs (re-wrapped with the new room key).
    function updateDocumentKeys(uint256 roomId, uint256[] calldata docIndices, bytes[] calldata newWrappedKeys)
        external
        roomExists(roomId)
        onlyRoomOwner(roomId)
        notParentRoom(roomId)
    {
        if (docIndices.length != newWrappedKeys.length) revert LengthMismatch();
        if (docIndices.length > MAX_BATCH_SIZE) revert BatchTooLarge();
        uint256 docCount = rooms[roomId].documentCount;
        for (uint256 i = 0; i < docIndices.length;) {
            if (docIndices[i] >= docCount) revert DocumentNotFound();
            if (_documents[roomId][docIndices[i]].deleted) revert DocumentDeleted();
            _documents[roomId][docIndices[i]].wrappedKey = newWrappedKeys[i];
            documentKeyVersion[roomId][docIndices[i]] = roomKeyVersion[roomId];
            unchecked {
                ++i;
            }
        }
    }

    // ─── Access Group Management

    /// @notice Grant access to one or more users on a folder. For already-members, updates expiry.
    /// @param roomId     The folder to grant access to.
    /// @param users      Addresses to grant access.
    /// @param expiresAt  Expiry per user. Use `PERMANENT` for no expiry.
    function grantAccess(uint256 roomId, address[] calldata users, uint256[] calldata expiresAt)
        external
        roomExists(roomId)
        onlyRoomOwner(roomId)
        notParentRoom(roomId)
    {
        if (users.length != expiresAt.length) revert LengthMismatch();
        if (users.length > MAX_BATCH_SIZE) revert BatchTooLarge();
        for (uint256 i = 0; i < users.length;) {
            if (users[i] == address(0)) revert InvalidAddress();
            _grantUser(roomId, users[i], expiresAt[i]);
            unchecked {
                ++i;
            }
        }
        emit MembershipChanged(roomId);
    }

    /// @notice Revoke access from one or more users on a folder.
    /// @dev Does NOT rotate the room key. Use revokeAndRekey() to atomically revoke + rotate.
    /// @param roomId The folder to revoke access from.
    /// @param users    Addresses to revoke.
    function revokeAccess(uint256 roomId, address[] calldata users)
        external
        roomExists(roomId)
        onlyRoomOwner(roomId)
        notParentRoom(roomId)
    {
        _revokeAccess(roomId, users);
    }

    /// @notice Revoke access and immediately rotate the room key in a single transaction.
    /// @param roomId The folder to revoke + rekey.
    /// @param users    Addresses to revoke.
    function revokeAndRekey(uint256 roomId, address[] calldata users)
        external
        roomExists(roomId)
        onlyRoomOwner(roomId)
        notParentRoom(roomId)
    {
        _revokeAccess(roomId, users);
        _rekeyRoom(roomId);
    }

    /// @notice Grant a user access to all folders under a parent room.
    /// @param parentId   The parent room ID.
    /// @param user       Address of the user to grant access.
    /// @param expiresAt  Expiry timestamp. Use `PERMANENT` for no expiry.
    function grantAccessToAllFolders(uint256 parentId, address user, uint256 expiresAt)
        external
        roomExists(parentId)
        onlyRoomOwner(parentId)
    {
        if (user == address(0)) revert InvalidAddress();
        Room storage parent = rooms[parentId];
        if (!parent.isParent) revert NotParentRoom();

        _roomWideAccess[parentId].add(user);
        _roomWideExpiry[parentId][user] = expiresAt;

        for (uint256 i = 0; i < parent.childCount;) {
            uint256 roomId = _children[parentId][i];
            _grantUser(roomId, user, expiresAt);
            emit MembershipChanged(roomId);
            unchecked {
                ++i;
            }
        }
    }

    /// @notice Revoke a user from all folders under a parent room.
    /// @param parentId  The parent room ID.
    /// @param user      Address of the user to revoke.
    function revokeAccessFromAllFolders(uint256 parentId, address user) external roomExists(parentId) onlyRoomOwner(parentId) {
        if (user == operator) revert CannotRevokeOperator();
        Room storage parent = rooms[parentId];
        if (!parent.isParent) revert NotParentRoom();

        _roomWideAccess[parentId].remove(user);
        delete _roomWideExpiry[parentId][user];

        for (uint256 i = 0; i < parent.childCount;) {
            uint256 roomId = _children[parentId][i];
            if (_isMember[roomId][user]) {
                _removeUser(roomId, user);
                emit MembershipChanged(roomId);
            }
            unchecked {
                ++i;
            }
        }
    }

    // Key Management

    /// @notice Rotate the folder key. Re-grants access to all active members.
    /// @param roomId The folder to rekey.
    function rekeyRoom(uint256 roomId) external roomExists(roomId) onlyRoomOwner(roomId) notParentRoom(roomId) {
        _rekeyRoom(roomId);
    }

    /// @notice Re-key every folder under a parent room in a single transaction.
    function rekeyAllFolders(uint256 parentId) external roomExists(parentId) onlyRoomOwner(parentId) {
        Room storage parent = rooms[parentId];
        if (!parent.isParent) revert NotParentRoom();

        for (uint256 i = 0; i < parent.childCount;) {
            _rekeyRoom(_children[parentId][i]);
            unchecked {
                ++i;
            }
        }
    }

    // ─── Internal Helpers

    /// @dev Grant a single user access to a folder. If already a member, updates expiry in place.
    function _grantUser(uint256 roomId, address user, uint256 expiresAt) internal {
        if (_isMember[roomId][user]) {
            _memberExpiry[roomId][user] = expiresAt;
            return;
        }

        uint256 slot = rooms[roomId].memberCount++;
        _members[roomId][slot] = user;
        _memberIndex[roomId][user] = slot;
        _isMember[roomId][user] = true;
        _memberExpiry[roomId][user] = expiresAt;

        FHE.allow(_roomKey[roomId], user);
    }

    /// @dev `account` has non-expired access to `roomId`. Owner and operator bypass expiry.
    function _hasAccess(uint256 roomId, address account) internal view returns (bool) {
        if (account == rooms[roomId].owner || account == operator) return true;
        if (!_isMember[roomId][account]) return false;
        uint256 exp = _memberExpiry[roomId][account];
        if (exp == PERMANENT) return true;
        return block.timestamp < exp;
    }

    function _storeDocument(uint256 roomId, string calldata cid, string calldata name, bytes calldata wrappedKey, bytes calldata metadata)
        internal
        returns (uint256 docIndex)
    {
        docIndex = rooms[roomId].documentCount++;
        _documents[roomId][docIndex] = Document({
            cid: cid,
            name: name,
            createdAt: block.timestamp,
            wrappedKey: wrappedKey,
            metadata: metadata,
            deleted: false
        });
        documentKeyVersion[roomId][docIndex] = roomKeyVersion[roomId];
    }

    /// @dev Remove a user from the packed member array (swap-and-pop).
    function _removeUser(uint256 roomId, address user) internal {
        uint256 slot = _memberIndex[roomId][user];
        uint256 lastSlot = rooms[roomId].memberCount - 1;

        if (slot != lastSlot) {
            address lastMember = _members[roomId][lastSlot];
            _members[roomId][slot] = lastMember;
            _memberIndex[roomId][lastMember] = slot;
        }

        delete _members[roomId][lastSlot];
        delete _memberIndex[roomId][user];
        _isMember[roomId][user] = false;
        rooms[roomId].memberCount--;
    }

    function _revokeAccess(uint256 roomId, address[] calldata users) internal {
        if (users.length > MAX_BATCH_SIZE) revert BatchTooLarge();
        for (uint256 i = 0; i < users.length;) {
            address user = users[i];
            if (user == operator) revert CannotRevokeOperator();
            if (!_isMember[roomId][user]) revert NotMember();
            _removeUser(roomId, user);
            unchecked {
                ++i;
            }
        }
        emit MembershipChanged(roomId);
    }

    function _rekeyRoom(uint256 roomId) internal {
        euint128 newKey = FHE.randomEuint128();
        _roomKey[roomId] = newKey;
        roomKeyVersion[roomId]++;
        FHE.allowThis(newKey);
        FHE.allow(newKey, operator);

        // Re-allow every active, non-expired member on the new key. Expired members keep
        // their `_isMember` flag (visible in member list until owner clears them via
        // revokeAndRekey), but do not get a fresh FHE permit.
        uint256 count = rooms[roomId].memberCount;
        uint256 nowTs = block.timestamp;
        for (uint256 i = 0; i < count;) {
            address member = _members[roomId][i];
            uint256 exp = _memberExpiry[roomId][member];
            if (exp == PERMANENT || nowTs < exp) {
                FHE.allow(newKey, member);
            }
            unchecked {
                ++i;
            }
        }

        emit RoomRekeyed(roomId, roomKeyVersion[roomId]);
    }

    // Views

    /// @notice Check if the caller currently has access to a folder (respects expiry).
    /// @param roomId The folder to check access for.
    function hasAccess(uint256 roomId) external view roomExists(roomId) returns (bool) {
        return _hasAccess(roomId, msg.sender);
    }

    /// @notice Get the encrypted folder key handle. Only decryptable if granted FHE access.
    /// @param roomId The folder to get the key for.
    function getRoomKey(uint256 roomId) external view roomExists(roomId) notParentRoom(roomId) returns (euint128) {
        if (!_hasAccess(roomId, msg.sender)) revert Unauthorized();
        return _roomKey[roomId];
    }

    /// @notice Get document metadata. CID points to content on Storacha.
    /// @dev Documents with a non-empty wrappedKey require admin, operator, or member access.
    /// @param roomId  The folder containing the document.
    /// @param docIndex  Index of the document.
    function getDocument(uint256 roomId, uint256 docIndex)
        external
        view
        roomExists(roomId)
        returns (
            string memory cid,
            string memory name,
            uint256 createdAt,
            uint256 keyVersion,
            bytes memory wrappedKey,
            bytes memory metadata
        )
    {
        if (docIndex >= rooms[roomId].documentCount) revert DocumentNotFound();
        Document storage doc = _documents[roomId][docIndex];
        if (doc.deleted) revert DocumentDeleted();
        if (doc.wrappedKey.length > 0) {
            if (!_hasAccess(roomId, msg.sender)) revert Unauthorized();
        }
        return (doc.cid, doc.name, doc.createdAt, documentKeyVersion[roomId][docIndex], doc.wrappedKey, doc.metadata);
    }

    /// @notice Get the owner for a room or folder.
    /// @param roomId The room or folder to query.
    function ownerOf(uint256 roomId) external view roomExists(roomId) returns (address) {
        return rooms[roomId].owner;
    }

    /// @notice Get room/folder info.
    /// @param roomId The room or folder to query.
    function getRoom(uint256 roomId)
        external
        view
        roomExists(roomId)
        returns (
            string memory name,
            uint256 documentCount,
            uint256 memberCount,
            bool isParent,
            uint256 parentId,
            uint256 childCount
        )
    {
        Room storage room = rooms[roomId];
        return (room.name, room.documentCount, room.memberCount, room.isParent, room.parentId, room.childCount);
    }

    /// @notice Get all folder IDs under a parent room.
    /// @param parentId The parent room ID.
    function getFolders(uint256 parentId) external view roomExists(parentId) returns (uint256[] memory) {
        Room storage parent = rooms[parentId];
        if (!parent.isParent) revert NotParentRoom();

        uint256[] memory result = new uint256[](parent.childCount);
        for (uint256 i = 0; i < parent.childCount;) {
            result[i] = _children[parentId][i];
            unchecked {
                ++i;
            }
        }
        return result;
    }

    /// @notice Get the parent room ID for a folder.
    /// @param roomId The folder ID.
    function getParentRoom(uint256 roomId) external view roomExists(roomId) returns (uint256) {
        return rooms[roomId].parentId;
    }

    /// @notice Get active members of a folder.
    /// @param roomId The folder to query.
    function getMembers(uint256 roomId) external view roomExists(roomId) returns (address[] memory) {
        if (msg.sender != rooms[roomId].owner && msg.sender != operator) revert Unauthorized();

        uint256 count = rooms[roomId].memberCount;
        address[] memory result = new address[](count);
        for (uint256 i = 0; i < count;) {
            result[i] = _members[roomId][i];
            unchecked {
                ++i;
            }
        }
        return result;
    }

    /// @notice Get addresses that were granted access at the room-wide level (via
    ///         `grantAccessToAllFolders`), distinct from per-folder grants.
    /// @param parentId The parent room ID.
    function getRoomWideGrantees(uint256 parentId) external view roomExists(parentId) returns (address[] memory) {
        if (msg.sender != rooms[parentId].owner && msg.sender != operator) revert Unauthorized();
        if (!rooms[parentId].isParent) revert NotParentRoom();
        return _roomWideAccess[parentId].values();
    }

    /// @notice Expiry timestamp for a member's access to a folder. Returns 0 for non-members,
    ///         `PERMANENT` for no-expiry grants, otherwise a unix timestamp.
    function getMemberExpiry(uint256 roomId, address user) external view roomExists(roomId) returns (uint256) {
        if (!_isMember[roomId][user]) return 0;
        return _memberExpiry[roomId][user];
    }

    /// @notice Expiry timestamp for a room-wide grant. Returns 0 if not a room-wide grantee.
    function getRoomWideExpiry(uint256 parentId, address user) external view roomExists(parentId) returns (uint256) {
        if (!_roomWideAccess[parentId].contains(user)) return 0;
        return _roomWideExpiry[parentId][user];
    }

    /// @notice Members whose access has expired. Owner feeds this into `revokeAndRekey`
    ///         to hard-revoke (remove FHE permits on a fresh folder key).
    function getExpiredMembers(uint256 roomId) external view roomExists(roomId) returns (address[] memory) {
        if (msg.sender != rooms[roomId].owner && msg.sender != operator) revert Unauthorized();

        uint256 count = rooms[roomId].memberCount;
        uint256 nowTs = block.timestamp;
        address[] memory tmp = new address[](count);
        uint256 n;
        for (uint256 i = 0; i < count;) {
            address m = _members[roomId][i];
            uint256 exp = _memberExpiry[roomId][m];
            if (exp != PERMANENT && nowTs >= exp) {
                tmp[n++] = m;
            }
            unchecked {
                ++i;
            }
        }
        address[] memory result = new address[](n);
        for (uint256 i = 0; i < n;) {
            result[i] = tmp[i];
            unchecked {
                ++i;
            }
        }
        return result;
    }
}
