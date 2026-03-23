// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {DataRoom} from "../src/DataRoom.sol";

/// @title Deploy
/// @notice Deploys the DataRoom contract for local dev or testnet.
contract Deploy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address admin = vm.envAddress("ADMIN_ADDRESS");
        address operator = vm.envAddress("OPERATOR_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);

        DataRoom dataRoom = new DataRoom();
        dataRoom.initialize(admin, operator);

        vm.stopBroadcast();

        console.log("DataRoom deployed at:", address(dataRoom));
        console.log("  admin:", admin);
        console.log("  operator:", operator);
    }
}
