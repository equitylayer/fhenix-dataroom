// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {DataRoom} from "../src/DataRoom.sol";
import {SecretsVault} from "../src/SecretsVault.sol";

/// @title Deploy
/// @notice Deploys DataRoom + SecretsVault together, sharing a single admin/owner.
contract Deploy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address admin = vm.envAddress("ADMIN_ADDRESS");
        address operator = vm.envAddress("OPERATOR_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);

        DataRoom dataRoom = new DataRoom();
        dataRoom.initialize(admin, operator);

        SecretsVault secretsVault = new SecretsVault(admin);

        vm.stopBroadcast();

        console.log("DataRoom     deployed at:", address(dataRoom));
        console.log("SecretsVault deployed at:", address(secretsVault));
        console.log("  admin:   ", admin);
        console.log("  operator:", operator);
    }
}
