// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint128} from "@fhenixprotocol/cofhe-contracts/FHE.sol";

/// @title DataRoom
/// @notice Trustless data room with FHE-encrypted access control.
contract DataRoom {
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

    /// @dev parentId => child index => roomId
    mapping(uint256 => mapping(uint256 => uint256)) private _children;

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
    function createRoom(string calldata name) external onlyAdmin returns (uint256 roomId) {
        roomId = roomCount++;

        rooms[roomId] =
            Room({name: name, documentCount: 0, memberCount: 0, isParent: true, parentId: NO_PARENT, childCount: 0});

        emit RoomCreated(roomId, msg.sender);
    }

    /// @notice Create a folder inside a parent room. Folder gets its own FHE key, members, documents.
    /// @param parentId The parent room ID.
    /// @param name Human-readable folder name.
    /// @return roomId The ID of the newly created folder.
    function createFolder(uint256 parentId, string calldata name)
        external
        onlyAdmin
        roomExists(parentId)
        returns (uint256 roomId)
    {
        Room storage parent = rooms[parentId];
        if (!parent.isParent) revert NotParentRoom();

        roomId = roomCount++;

        rooms[roomId] =
            Room({name: name, documentCount: 0, memberCount: 0, isParent: false, parentId: parentId, childCount: 0});

        _children[parentId][parent.childCount] = roomId;
        parent.childCount++;

        // Generate FHE key for the folder
        euint128 key = FHE.randomEuint128();
        _roomKey[roomId] = key;
        FHE.allowThis(key);
        FHE.allow(key, operator);

        _grantUser(roomId, msg.sender);

        emit FolderCreated(parentId, roomId);
    }

    /// @notice Rename an existing room or folder.
    /// @param roomId  The room or folder to rename.
    /// @param newName The new name.
    function renameRoom(uint256 roomId, string calldata newName) external onlyAdmin roomExists(roomId) {
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
    ) external onlyAdmin roomExists(roomId) notParentRoom(roomId) {
        if (cids.length == 0) revert EmptyBatch();
        if (cids.length != names.length || cids.length != wrappedKeys.length || cids.length != metadata.length) {
            revert LengthMismatch();
        }
        if (cids.length > MAX_BATCH_SIZE) revert BatchTooLarge();
        for (uint256 i = 0; i < cids.length;) {
            uint256 docIndex = rooms[roomId].documentCount++;
            _documents[roomId][docIndex] = Document({
                cid: cids[i],
                name: names[i],
                createdAt: block.timestamp,
                wrappedKey: wrappedKeys[i],
                metadata: metadata[i],
                deleted: false
            });
            documentKeyVersion[roomId][docIndex] = roomKeyVersion[roomId];
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
        onlyAdmin
        roomExists(roomId)
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
        onlyAdmin
        roomExists(roomId)
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
        onlyAdmin
        roomExists(roomId)
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

    /// @notice Grant access to one or more users on a folder. Skips already-members.
    /// @param roomId The folder to grant access to.
    /// @param users    Addresses to grant access.
    function grantAccess(uint256 roomId, address[] calldata users)
        external
        onlyAdmin
        roomExists(roomId)
        notParentRoom(roomId)
    {
        if (users.length > MAX_BATCH_SIZE) revert BatchTooLarge();
        for (uint256 i = 0; i < users.length;) {
            if (users[i] == address(0)) revert InvalidAddress();
            _grantUser(roomId, users[i]);
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
        onlyAdmin
        roomExists(roomId)
        notParentRoom(roomId)
    {
        _revokeAccess(roomId, users);
    }

    /// @notice Revoke access and immediately rotate the room key in a single transaction.
    /// @param roomId The folder to revoke + rekey.
    /// @param users    Addresses to revoke.
    function revokeAndRekey(uint256 roomId, address[] calldata users)
        external
        onlyAdmin
        roomExists(roomId)
        notParentRoom(roomId)
    {
        _revokeAccess(roomId, users);
        _rekeyRoom(roomId);
    }

    /// @notice Grant a user access to all folders under a parent room.
    /// @param parentId The parent room ID.
    /// @param user Address of the user to grant access.
    function grantAccessToAllFolders(uint256 parentId, address user) external onlyAdmin roomExists(parentId) {
        if (user == address(0)) revert InvalidAddress();
        Room storage parent = rooms[parentId];
        if (!parent.isParent) revert NotParentRoom();

        for (uint256 i = 0; i < parent.childCount;) {
            uint256 roomId = _children[parentId][i];
            _grantUser(roomId, user);
            emit MembershipChanged(roomId);
            unchecked {
                ++i;
            }
        }
    }

    /// @notice Revoke a user from all folders under a parent room.
    /// @param parentId  The parent room ID.
    /// @param user      Address of the user to revoke.
    function revokeAccessFromAllFolders(uint256 parentId, address user) external onlyAdmin roomExists(parentId) {
        if (user == operator) revert CannotRevokeOperator();
        Room storage parent = rooms[parentId];
        if (!parent.isParent) revert NotParentRoom();

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
    function rekeyRoom(uint256 roomId) external onlyAdmin roomExists(roomId) notParentRoom(roomId) {
        _rekeyRoom(roomId);
    }

    // ─── Internal Helpers

    /// @dev Grant a single user access to a folder. Skips if already a member.
    function _grantUser(uint256 roomId, address user) internal {
        if (_isMember[roomId][user]) return;

        uint256 slot = rooms[roomId].memberCount++;
        _members[roomId][slot] = user;
        _memberIndex[roomId][user] = slot;
        _isMember[roomId][user] = true;

        FHE.allow(_roomKey[roomId], user);
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

        // Only iterates active members (packed array)
        uint256 count = rooms[roomId].memberCount;
        for (uint256 i = 0; i < count;) {
            FHE.allow(newKey, _members[roomId][i]);
            unchecked {
                ++i;
            }
        }

        emit RoomRekeyed(roomId, roomKeyVersion[roomId]);
    }

    // Views

    /// @notice Check if the caller has access to a folder
    /// @param roomId The folder to check access for.
    function hasAccess(uint256 roomId) external view roomExists(roomId) returns (bool) {
        return _isMember[roomId][msg.sender];
    }

    /// @notice Get the encrypted folder key handle. Only decryptable if granted FHE access.
    /// @param roomId The folder to get the key for.
    function getRoomKey(uint256 roomId) external view roomExists(roomId) notParentRoom(roomId) returns (euint128) {
        if (msg.sender != admin && msg.sender != operator && !_isMember[roomId][msg.sender]) {
            revert Unauthorized();
        }
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
            if (msg.sender != admin && msg.sender != operator && !_isMember[roomId][msg.sender]) {
                revert Unauthorized();
            }
        }
        return (doc.cid, doc.name, doc.createdAt, documentKeyVersion[roomId][docIndex], doc.wrappedKey, doc.metadata);
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
        if (msg.sender != admin && msg.sender != operator) revert Unauthorized();

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
}
