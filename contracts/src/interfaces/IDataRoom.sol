// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IDataRoom
interface IDataRoom {
    function initialize(address _admin, address _operator) external;

    function setAdmin(address newAdmin) external;

    function createRoom(string calldata name) external returns (uint256 roomId);

    function createFolder(uint256 parentId, string calldata name) external returns (uint256 roomId);

    function renameRoom(uint256 roomId, string calldata newName) external;

    function addDocuments(
        uint256 roomId,
        string[] calldata cids,
        string[] calldata names,
        bytes[] calldata wrappedKeys,
        bytes[] calldata metadata
    ) external;

    function removeDocument(uint256 roomId, uint256 docIndex) external;

    function updateDocumentMetadata(uint256 roomId, uint256[] calldata docIndices, bytes[] calldata metadata) external;

    function grantAccess(uint256 roomId, address[] calldata users) external;

    function revokeAccess(uint256 roomId, address[] calldata users) external;

    function revokeAndRekey(uint256 roomId, address[] calldata users) external;

    function grantAccessToAllFolders(uint256 parentId, address user) external;

    function revokeAccessFromAllFolders(uint256 parentId, address user) external;

    function rekeyRoom(uint256 roomId) external;

    function updateDocumentKeys(uint256 roomId, uint256[] calldata docIndices, bytes[] calldata newWrappedKeys) external;

    function hasAccess(uint256 roomId) external view returns (bool);

    function getRoom(uint256 roomId)
        external
        view
        returns (
            string memory name,
            uint256 documentCount,
            uint256 memberCount,
            bool isParent,
            uint256 parentId,
            uint256 childCount
        );

    function getDocument(uint256 roomId, uint256 docIndex)
        external
        view
        returns (
            string memory cid,
            string memory name,
            uint256 createdAt,
            uint256 keyVersion,
            bytes memory wrappedKey,
            bytes memory metadata
        );

    function getFolders(uint256 parentId) external view returns (uint256[] memory);

    function getMembers(uint256 roomId) external view returns (address[] memory);

    function getParentRoom(uint256 roomId) external view returns (uint256);

    function ownerOf(uint256 roomId) external view returns (address);

    function roomCount() external view returns (uint256);

    function admin() external view returns (address);

    function operator() external view returns (address);
}
