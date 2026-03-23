// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {DataRoom} from "../src/DataRoom.sol";
import {MockTaskManager} from "@cofhe/mock-contracts/MockTaskManager.sol";
import {MockThresholdNetwork} from "@cofhe/mock-contracts/MockThresholdNetwork.sol";
import {TASK_MANAGER_ADDRESS} from "@fhenixprotocol/cofhe-contracts/FHE.sol";

/// @title DeployLocal
/// @notice Initialises CoFHE mocks (pre-etched) then deploys DataRoom. Anvil only.
contract DeployLocal is Script {
    address constant ACL_ADDR = 0xa6Ea4b5291d044D93b73b3CFf3109A1128663E8B;
    address constant THRESHOLD_NETWORK_ADDR = 0x0000000000000000000000000000000000005002;

    function run() external {
        require(block.chainid == 31337, "DeployLocal: Anvil only");

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address admin = vm.envAddress("ADMIN_ADDRESS");
        address operator = vm.envAddress("OPERATOR_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);

        // 1) Initialise CoFHE mocks (bytecodes already etched by deploy-local.sh)
        console.log("--- CoFHE Mocks ---");
        MockTaskManager tm = MockTaskManager(TASK_MANAGER_ADDRESS);
        tm.initialize(deployer);
        tm.setSecurityZoneMin(0);
        tm.setSecurityZoneMax(1);
        tm.setACLContract(ACL_ADDR);

        MockThresholdNetwork tn = MockThresholdNetwork(THRESHOLD_NETWORK_ADDR);
        tn.initialize(TASK_MANAGER_ADDRESS, ACL_ADDR);

        console.log("MockTaskManager:", TASK_MANAGER_ADDRESS);
        console.log("MockACL:", ACL_ADDR);

        // 2) Deploy DataRoom
        console.log("\n--- DataRoom ---");
        DataRoom dataRoom = new DataRoom();
        dataRoom.initialize(admin, operator);

        console.log("DataRoom deployed at:", address(dataRoom));
        console.log("  admin:", admin);
        console.log("  operator:", operator);

        vm.stopBroadcast();
    }
}
