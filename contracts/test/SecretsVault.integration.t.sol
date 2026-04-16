// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {CoFheTest} from "@cofhe/mock-contracts/foundry/CoFheTest.sol";
import {SecretsVault} from "../src/SecretsVault.sol";
import {euint128} from "@fhenixprotocol/cofhe-contracts/FHE.sol";

contract SecretsVaultIntegrationTest is CoFheTest {
    SecretsVault public vault;

    address public admin = makeAddr("admin");
    address public dev1 = makeAddr("dev1");
    address public dev2 = makeAddr("dev2");
    address public contractor = makeAddr("contractor");

    string constant DB_PASSWORD = "DB_PASSWORD";
    string constant API_KEY = "API_KEY";
    string constant JWT_SECRET = "JWT_SECRET";
    string constant DEPLOY_KEY = "DEPLOY_KEY";
    string constant SECRET_A = "SECRET_A";
    string constant SECRET_B = "SECRET_B";
    string constant SECRET = "SECRET";
    string constant KEY = "KEY";

    function setUp() public {
        vault = new SecretsVault(admin);
    }

    function test_teamSecretManagement() public {
        vm.startPrank(admin);
        uint256 nsId = vault.createNamespace("production");

        vault.setSecret(nsId, DB_PASSWORD, "enc-db-pwd", "ns-enc-db-pwd");
        vault.setSecret(nsId, API_KEY, "enc-api-key", "ns-enc-api-key");
        vault.setSecret(nsId, JWT_SECRET, "enc-jwt", "ns-enc-jwt");

        vault.grantNamespaceAccess(nsId, dev1, type(uint256).max);

        vault.grantSecretAccess(nsId, DB_PASSWORD, dev2, type(uint256).max);
        vm.stopPrank();

        vm.startPrank(dev1);
        (bytes memory v1,,,) = vault.getSecret(nsId, DB_PASSWORD);
        assertEq(v1, "enc-db-pwd");
        (bytes memory v2,,,) = vault.getSecret(nsId, API_KEY);
        assertEq(v2, "enc-api-key");
        (bytes memory v3,,,) = vault.getSecret(nsId, JWT_SECRET);
        assertEq(v3, "enc-jwt");

        string[] memory keys = vault.getSecretKeys(nsId);
        assertEq(keys.length, 3);
        vm.stopPrank();

        vm.prank(dev2);
        (bytes memory v4,,,) = vault.getSecret(nsId, DB_PASSWORD);
        assertEq(v4, "enc-db-pwd");

        vm.prank(dev2);
        vm.expectRevert(SecretsVault.Unauthorized.selector);
        vault.getSecret(nsId, API_KEY);

        vm.prank(dev2);
        string[] memory dev2Keys = vault.getSecretKeys(nsId);
        assertEq(dev2Keys.length, 1);
        assertEq(dev2Keys[0], DB_PASSWORD);

        vm.prank(admin);
        vault.revokeNamespaceAccess(nsId, dev1);

        vm.prank(dev1);
        vm.expectRevert(SecretsVault.Unauthorized.selector);
        vault.getSecret(nsId, DB_PASSWORD);

        vm.prank(dev2);
        (bytes memory v5,,,) = vault.getSecret(nsId, DB_PASSWORD);
        assertEq(v5, "enc-db-pwd");
    }

    function test_temporaryContractorAccess() public {
        vm.startPrank(admin);
        uint256 nsId = vault.createNamespace("staging");
        vault.setSecret(nsId, DEPLOY_KEY, "enc-deploy", "ns-enc-deploy");

        uint256 deadline = block.timestamp + 1 hours;
        vault.grantSecretAccess(nsId, DEPLOY_KEY, contractor, deadline);
        vm.stopPrank();

        vm.prank(contractor);
        (bytes memory val,,,) = vault.getSecret(nsId, DEPLOY_KEY);
        assertEq(val, "enc-deploy");

        vm.warp(deadline + 1);

        vm.prank(contractor);
        vm.expectRevert(SecretsVault.Unauthorized.selector);
        vault.getSecret(nsId, DEPLOY_KEY);

        vm.prank(admin);
        vault.grantSecretAccess(nsId, DEPLOY_KEY, contractor, type(uint256).max);

        vm.prank(contractor);
        (bytes memory val2,,,) = vault.getSecret(nsId, DEPLOY_KEY);
        assertEq(val2, "enc-deploy");
    }

    function test_overlappingAccessExpiry() public {
        vm.startPrank(admin);
        uint256 nsId = vault.createNamespace("shared");
        vault.setSecret(nsId, SECRET_A, "enc-a", "ns-enc-a");
        vault.setSecret(nsId, SECRET_B, "enc-b", "ns-enc-b");

        uint256 nsDeadline = block.timestamp + 1 hours;
        uint256 secretDeadline = block.timestamp + 2 hours;

        vault.grantNamespaceAccess(nsId, dev1, nsDeadline);
        vault.grantSecretAccess(nsId, SECRET_A, dev1, secretDeadline);
        vm.stopPrank();

        vm.prank(dev1);
        vault.getSecret(nsId, SECRET_A);
        vm.prank(dev1);
        vault.getSecret(nsId, SECRET_B);

        vm.warp(nsDeadline);

        vm.prank(dev1);
        (bytes memory val,,,) = vault.getSecret(nsId, SECRET_A);
        assertEq(val, "enc-a");

        vm.prank(dev1);
        vm.expectRevert(SecretsVault.Unauthorized.selector);
        vault.getSecret(nsId, SECRET_B);

        vm.warp(secretDeadline);

        vm.prank(dev1);
        vm.expectRevert(SecretsVault.Unauthorized.selector);
        vault.getSecret(nsId, SECRET_A);
    }

    function test_secretRotation() public {
        vm.startPrank(admin);
        uint256 nsId = vault.createNamespace("prod");
        vault.setSecret(nsId, DB_PASSWORD, "old-pwd", "ns-old-pwd");

        vault.grantSecretAccess(nsId, DB_PASSWORD, dev1, type(uint256).max);
        vault.grantSecretAccess(nsId, DB_PASSWORD, dev2, type(uint256).max);
        vm.stopPrank();

        vm.prank(dev1);
        vault.getSecret(nsId, DB_PASSWORD);
        vm.prank(dev2);
        vault.getSecret(nsId, DB_PASSWORD);

        vm.startPrank(admin);
        vault.deleteSecret(nsId, DB_PASSWORD);
        vault.setSecret(nsId, DB_PASSWORD, "new-pwd", "ns-new-pwd");

        vault.grantSecretAccess(nsId, DB_PASSWORD, dev1, type(uint256).max);
        vm.stopPrank();

        vm.prank(dev1);
        (bytes memory val,,,) = vault.getSecret(nsId, DB_PASSWORD);
        assertEq(val, "new-pwd");

        vm.prank(dev2);
        vm.expectRevert(SecretsVault.Unauthorized.selector);
        vault.getSecret(nsId, DB_PASSWORD);

        vm.prank(admin);
        address[] memory grantees = vault.getSecretGrantees(nsId, DB_PASSWORD);
        assertEq(grantees.length, 1);
        assertEq(grantees[0], dev1);
    }

    function test_namespaceIsolation() public {
        vm.startPrank(admin);
        uint256 prod = vault.createNamespace("prod");
        uint256 staging = vault.createNamespace("staging");

        vault.setSecret(prod, SECRET, "prod-val", "ns-prod-val");
        vault.setSecret(staging, SECRET, "staging-val", "ns-staging-val");

        vault.grantNamespaceAccess(prod, dev1, type(uint256).max);
        vm.stopPrank();

        vm.prank(dev1);
        (bytes memory val,,,) = vault.getSecret(prod, SECRET);
        assertEq(val, "prod-val");

        vm.prank(dev1);
        vm.expectRevert(SecretsVault.Unauthorized.selector);
        vault.getSecret(staging, SECRET);

        uint256[] memory adminNs = vault.getNamespacesByOwner(admin);
        assertEq(adminNs.length, 2);
    }

    function test_granteeListConsistency() public {
        vm.startPrank(admin);
        uint256 nsId = vault.createNamespace("test");
        vault.setSecret(nsId, KEY, "val", "nsval");

        vault.grantNamespaceAccess(nsId, dev1, type(uint256).max);
        vault.grantNamespaceAccess(nsId, dev2, type(uint256).max);
        assertEq(vault.getNamespaceGrantees(nsId).length, 2);

        vault.revokeNamespaceAccess(nsId, dev1);
        assertEq(vault.getNamespaceGrantees(nsId).length, 1);

        vault.grantNamespaceAccess(nsId, dev1, type(uint256).max);
        assertEq(vault.getNamespaceGrantees(nsId).length, 2);

        vault.grantNamespaceAccess(nsId, dev1, 9999);
        assertEq(vault.getNamespaceGrantees(nsId).length, 2);

        vault.grantSecretAccess(nsId, KEY, contractor, type(uint256).max);
        vault.grantSecretAccess(nsId, KEY, contractor, 5000);
        assertEq(vault.getSecretGrantees(nsId, KEY).length, 1);
        vm.stopPrank();
    }

    function test_rotateNamespaceKey() public {
        vm.startPrank(admin);
        uint256 nsId = vault.createNamespace("prod");
        vault.setSecret(nsId, DB_PASSWORD, "old-enc", "ns-old-enc");
        vault.grantNamespaceAccess(nsId, dev1, type(uint256).max);
        vault.grantNamespaceAccess(nsId, dev2, type(uint256).max);

        // Rotate (generates new FHE key, re-allows grantees)
        vault.rotateNamespaceKey(nsId);

        // Grantees can still read the handle (FHE.allow was re-granted)
        vm.stopPrank();
        vm.prank(dev1);
        vault.getNsKeyHandle(nsId); // should not revert

        vm.prank(dev2);
        vault.getNsKeyHandle(nsId); // should not revert

        // Old ciphertext still in storage (client re-encrypts separately)
        vm.prank(admin);
        (bytes memory val,,,) = vault.getSecret(nsId, DB_PASSWORD);
        assertEq(val, "old-enc");
    }

    function test_rotateSecretKey() public {
        vm.startPrank(admin);
        uint256 nsId = vault.createNamespace("staging");
        vault.setSecret(nsId, API_KEY, "old-api-enc", "ns-old-api-enc");
        vault.grantSecretAccess(nsId, API_KEY, dev1, type(uint256).max);

        vault.rotateSecretKey(nsId, API_KEY);

        // Grantee can still read the handle (FHE.allow was re-granted)
        vm.stopPrank();
        vm.prank(dev1);
        vault.getSecretKeyHandle(nsId, API_KEY); // should not revert
    }

    function test_rotateNamespaceKey_rejectsNonOwner() public {
        vm.startPrank(admin);
        uint256 nsId = vault.createNamespace("test");
        vm.stopPrank();

        vm.prank(dev1);
        vm.expectRevert(abi.encodeWithSelector(SecretsVault.NotNamespaceOwner.selector, nsId));
        vault.rotateNamespaceKey(nsId);
    }

    function test_rotateSecretKey_rejectsNonExistent() public {
        vm.startPrank(admin);
        uint256 nsId = vault.createNamespace("test");
        vm.stopPrank();

        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(SecretsVault.SecretNotFound.selector, nsId, "NOPE"));
        vault.rotateSecretKey(nsId, "NOPE");
    }
}
