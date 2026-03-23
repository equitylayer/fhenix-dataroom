// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {DataRoom} from "../../src/DataRoom.sol";

/// @title BaseTest
/// @notice Minimal test base for standalone DataRoom testing (no Company/Factory dependencies).
abstract contract BaseTest is Test {
    DataRoom dataRoom;

    // Test addresses
    address board = address(0x1234);
    address nonBoard = address(0x5678);
    address investor = address(0xBEEF);
    address employee = address(0xCAFE);
    address founder = address(0xFACE);
    address d01Operator = address(0xD01);

    /// @dev Deploy and initialize a fresh DataRoom with board as admin.
    function _baseSetUp() internal {
        dataRoom = new DataRoom();
        dataRoom.initialize(board, d01Operator);
    }

    /// @dev Deploy a fresh DataRoom (uninitialized) and initialize it.
    function _deployDataRoom() internal returns (DataRoom) {
        DataRoom dr = new DataRoom();
        dr.initialize(board, d01Operator);
        return dr;
    }
}
