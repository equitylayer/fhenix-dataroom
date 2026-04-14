// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {CoFheTest} from "@cofhe/mock-contracts/foundry/CoFheTest.sol";
import {SecretsVault} from "../src/SecretsVault.sol";

contract SecretsVaultTest is CoFheTest {
    SecretsVault public vault;

    address public owner = makeAddr("owner");
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    uint256 public nsId;
    bytes constant SECRET_VAL = "s3cret-value";
    bytes constant NS_SECRET_VAL = "ns-encrypted-value";
    string constant KEY = "DB_PASSWORD";
    string constant API_KEY = "API_KEY";
    string constant NOPE = "NOPE";

    function setUp() public {
        vault = new SecretsVault(owner);

        vm.startPrank(owner);
        nsId = vault.createNamespace("ethglobal");
        vault.setSecret(nsId, KEY, SECRET_VAL, NS_SECRET_VAL);
        vm.stopPrank();
    }

    function test_createNamespace() public view {
        (address nsOwner, string memory name, uint256 count) = vault.getNamespace(nsId);
        assertEq(nsOwner, owner);
        assertEq(name, "ethglobal");
        assertEq(count, 1);
    }

    function test_namespaceNotFound() public {
        vm.expectRevert(abi.encodeWithSelector(SecretsVault.NamespaceNotFound.selector, 999));
        vault.getNamespace(999);
    }

    function test_ownerCanRead() public {
        vm.prank(owner);
        (bytes memory val, bytes memory nsVal,,) = vault.getSecret(nsId, KEY);
        assertEq(val, SECRET_VAL);
        assertEq(nsVal, NS_SECRET_VAL);
    }

    function test_setSecretUpdates() public {
        vm.prank(owner);
        vault.setSecret(nsId, KEY, "updated", "ns-updated");

        vm.prank(owner);
        (bytes memory val, bytes memory nsVal,,) = vault.getSecret(nsId, KEY);
        assertEq(val, "updated");
        assertEq(nsVal, "ns-updated");

        (,, uint256 count) = vault.getNamespace(nsId);
        assertEq(count, 1);
    }

    function test_deleteSecret() public {
        vm.prank(owner);
        vault.deleteSecret(nsId, KEY);

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(SecretsVault.SecretNotFound.selector, nsId, KEY));
        vault.getSecret(nsId, KEY);
    }

    function test_getSecretNotFound() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(SecretsVault.SecretNotFound.selector, nsId, NOPE));
        vault.getSecret(nsId, NOPE);
    }

    function test_emptyKeyReverts() public {
        vm.prank(owner);
        vm.expectRevert(SecretsVault.EmptyKey.selector);
        vault.setSecret(nsId, "", "v", "nv");
    }

    function test_reCreateAfterDelete() public {
        vm.startPrank(owner);
        vault.deleteSecret(nsId, KEY);
        vault.setSecret(nsId, KEY, "new-value", "ns-new");
        vm.stopPrank();

        vm.prank(owner);
        string[] memory keys = vault.getSecretKeys(nsId);
        assertEq(keys.length, 1);
        assertEq(keys[0], KEY);
    }

    function test_noAccessReverts() public {
        vm.prank(alice);
        vm.expectRevert(SecretsVault.Unauthorized.selector);
        vault.getSecret(nsId, KEY);
    }

    function test_nonOwnerCannotSet() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SecretsVault.NotNamespaceOwner.selector, nsId));
        vault.setSecret(nsId, KEY, "bar", "nsbar");
    }

    function test_nonOwnerCannotDelete() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SecretsVault.NotNamespaceOwner.selector, nsId));
        vault.deleteSecret(nsId, KEY);
    }

    function test_deleteNonExistentSecret() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(SecretsVault.SecretNotFound.selector, nsId, NOPE));
        vault.deleteSecret(nsId, NOPE);
    }

    function test_invalidAddressReverts() public {
        vm.prank(owner);
        vm.expectRevert(SecretsVault.InvalidAddress.selector);
        vault.grantNamespaceAccess(nsId, address(0), type(uint256).max);
    }

    function test_nonOwnerCannotGrantNamespaceAccess() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SecretsVault.NotNamespaceOwner.selector, nsId));
        vault.grantNamespaceAccess(nsId, bob, type(uint256).max);
    }

    function test_nonOwnerCannotRevokeNamespaceAccess() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SecretsVault.NotNamespaceOwner.selector, nsId));
        vault.revokeNamespaceAccess(nsId, bob);
    }

    function test_nonOwnerCannotGrantSecretAccess() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SecretsVault.NotNamespaceOwner.selector, nsId));
        vault.grantSecretAccess(nsId, KEY, bob, type(uint256).max);
    }

    function test_nonOwnerCannotRevokeSecretAccess() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SecretsVault.NotNamespaceOwner.selector, nsId));
        vault.revokeSecretAccess(nsId, KEY, bob);
    }

    function test_grantSecretAccessNonExistentSecret() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(SecretsVault.SecretNotFound.selector, nsId, NOPE));
        vault.grantSecretAccess(nsId, NOPE, bob, type(uint256).max);
    }

    function test_grantSecretAccessInvalidAddress() public {
        vm.prank(owner);
        vm.expectRevert(SecretsVault.InvalidAddress.selector);
        vault.grantSecretAccess(nsId, KEY, address(0), type(uint256).max);
    }

    function test_getNsKeyHandle_unauthorized() public {
        vm.prank(alice);
        vm.expectRevert(SecretsVault.Unauthorized.selector);
        vault.getNsKeyHandle(nsId);
    }

    function test_getSecretKeyHandle_unauthorized() public {
        vm.prank(alice);
        vm.expectRevert(SecretsVault.Unauthorized.selector);
        vault.getSecretKeyHandle(nsId, KEY);
    }

    function test_namespaceAccessPermanent() public {
        vm.prank(owner);
        vault.grantNamespaceAccess(nsId, alice, type(uint256).max);

        vm.prank(alice);
        (bytes memory val,,,) = vault.getSecret(nsId, KEY);
        assertEq(val, SECRET_VAL);
    }

    function test_namespaceAccessExpiring() public {
        uint256 deadline = block.timestamp + 1 hours;
        vm.prank(owner);
        vault.grantNamespaceAccess(nsId, alice, deadline);

        vm.prank(alice);
        (bytes memory val,,,) = vault.getSecret(nsId, KEY);
        assertEq(val, SECRET_VAL);

        vm.warp(deadline);
        vm.prank(alice);
        vm.expectRevert(SecretsVault.Unauthorized.selector);
        vault.getSecret(nsId, KEY);
    }

    function test_revokeNamespaceAccess() public {
        vm.startPrank(owner);
        vault.grantNamespaceAccess(nsId, alice, type(uint256).max);
        vault.revokeNamespaceAccess(nsId, alice);
        vm.stopPrank();

        vm.prank(alice);
        vm.expectRevert(SecretsVault.Unauthorized.selector);
        vault.getSecret(nsId, KEY);
    }

    function test_namespaceAccessGrantsAllSecrets() public {
        vm.startPrank(owner);
        vault.setSecret(nsId, API_KEY, "abc123", "ns-abc123");
        vault.grantNamespaceAccess(nsId, alice, type(uint256).max);
        vm.stopPrank();

        vm.prank(alice);
        (bytes memory val1,,,) = vault.getSecret(nsId, KEY);
        assertEq(val1, SECRET_VAL);

        vm.prank(alice);
        (bytes memory val2,,,) = vault.getSecret(nsId, API_KEY);
        assertEq(val2, "abc123");
    }

    function test_secretAccessPermanent() public {
        vm.prank(owner);
        vault.grantSecretAccess(nsId, KEY, bob, type(uint256).max);

        vm.prank(bob);
        (bytes memory val,,,) = vault.getSecret(nsId, KEY);
        assertEq(val, SECRET_VAL);
    }

    function test_secretAccessExpiring() public {
        uint256 deadline = block.timestamp + 30 minutes;
        vm.prank(owner);
        vault.grantSecretAccess(nsId, KEY, bob, deadline);

        vm.prank(bob);
        (bytes memory val,,,) = vault.getSecret(nsId, KEY);
        assertEq(val, SECRET_VAL);

        vm.warp(deadline);
        vm.prank(bob);
        vm.expectRevert(SecretsVault.Unauthorized.selector);
        vault.getSecret(nsId, KEY);
    }

    function test_revokeSecretAccess() public {
        vm.startPrank(owner);
        vault.grantSecretAccess(nsId, KEY, bob, type(uint256).max);
        vault.revokeSecretAccess(nsId, KEY, bob);
        vm.stopPrank();

        vm.prank(bob);
        vm.expectRevert(SecretsVault.Unauthorized.selector);
        vault.getSecret(nsId, KEY);
    }

    function test_secretAccessDoesNotGrantOtherSecrets() public {
        vm.startPrank(owner);
        vault.grantSecretAccess(nsId, KEY, bob, type(uint256).max);
        vault.setSecret(nsId, API_KEY, "abc123", "ns-abc123");
        vm.stopPrank();

        vm.prank(bob);
        vm.expectRevert(SecretsVault.Unauthorized.selector);
        vault.getSecret(nsId, API_KEY);
    }

    function test_deleteSecretClearsAccess() public {
        vm.startPrank(owner);
        vault.grantSecretAccess(nsId, KEY, alice, type(uint256).max);
        vault.grantSecretAccess(nsId, KEY, bob, type(uint256).max);
        vault.deleteSecret(nsId, KEY);
        vault.setSecret(nsId, KEY, "new-value", "ns-new");
        vm.stopPrank();

        vm.prank(owner);
        address[] memory grantees = vault.getSecretGrantees(nsId, KEY);
        assertEq(grantees.length, 0);

        assertFalse(vault.hasAccess(nsId, keccak256(bytes(KEY)), bob));
    }

    function test_hasAccess() public {
        assertTrue(vault.hasAccess(nsId, keccak256(bytes(KEY)), owner));
        assertFalse(vault.hasAccess(nsId, keccak256(bytes(KEY)), alice));

        vm.prank(owner);
        vault.grantSecretAccess(nsId, KEY, alice, type(uint256).max);
        assertTrue(vault.hasAccess(nsId, keccak256(bytes(KEY)), alice));
    }

    function test_getNamespacesByGrantee() public {
        vm.startPrank(owner);
        vault.grantNamespaceAccess(nsId, alice, type(uint256).max);
        uint256 ns2 = vault.createNamespace("second");
        vault.setSecret(ns2, "KEY2", "v", "nv");
        vault.grantSecretAccess(ns2, "KEY2", alice, type(uint256).max);
        vm.stopPrank();

        uint256[] memory shared = vault.getNamespacesByGrantee(alice);
        assertEq(shared.length, 2);
        assertEq(shared[0], nsId);
        assertEq(shared[1], ns2);

        assertEq(vault.getNamespacesByGrantee(bob).length, 0);
    }

    function test_getNamespacesByGrantee_afterRevoke() public {
        vm.startPrank(owner);
        vault.grantNamespaceAccess(nsId, alice, type(uint256).max);
        vault.revokeNamespaceAccess(nsId, alice);
        vm.stopPrank();

        assertEq(vault.getNamespacesByGrantee(alice).length, 0);
    }

    function test_accessExpiryViews() public {
        vm.startPrank(owner);
        vault.grantNamespaceAccess(nsId, alice, 1000);
        vault.grantSecretAccess(nsId, KEY, bob, 2000);
        vm.stopPrank();

        assertEq(vault.getNamespaceAccessExpiry(nsId, alice), 1000);
        assertEq(vault.getSecretAccessExpiry(nsId, KEY, bob), 2000);
    }

    function test_getNamespacesByOwner() public {
        vm.prank(owner);
        uint256 ns2 = vault.createNamespace("second");

        uint256[] memory ids = vault.getNamespacesByOwner(owner);
        assertEq(ids.length, 2);
        assertEq(ids[0], nsId);
        assertEq(ids[1], ns2);
    }

    function test_getNamespacesByOwner_empty() public view {
        assertEq(vault.getNamespacesByOwner(alice).length, 0);
    }

    function test_getSecretKeys() public {
        vm.prank(owner);
        vault.setSecret(nsId, API_KEY, "abc", "ns-abc");

        vm.prank(owner);
        string[] memory keys = vault.getSecretKeys(nsId);
        assertEq(keys.length, 2);
        assertEq(keys[0], KEY);
        assertEq(keys[1], API_KEY);
    }

    function test_getSecretKeys_unauthorized() public {
        vm.prank(alice);
        vm.expectRevert(SecretsVault.Unauthorized.selector);
        vault.getSecretKeys(nsId);
    }

    function test_getSecretKeys_secretAccessOnly() public {
        vm.startPrank(owner);
        vault.setSecret(nsId, "OTHER", "v", "nv");
        vault.grantSecretAccess(nsId, KEY, bob, type(uint256).max);
        vm.stopPrank();

        vm.prank(bob);
        string[] memory keys = vault.getSecretKeys(nsId);
        assertEq(keys.length, 1);
        assertEq(keys[0], KEY);
    }

    function test_getNamespaceGrantees() public {
        vm.startPrank(owner);
        vault.grantNamespaceAccess(nsId, alice, type(uint256).max);
        vault.grantNamespaceAccess(nsId, bob, type(uint256).max);
        vm.stopPrank();

        vm.prank(owner);
        assertEq(vault.getNamespaceGrantees(nsId).length, 2);
    }

    function test_getSecretGrantees() public {
        vm.prank(owner);
        vault.grantSecretAccess(nsId, KEY, bob, type(uint256).max);

        vm.prank(owner);
        address[] memory grantees = vault.getSecretGrantees(nsId, KEY);
        assertEq(grantees.length, 1);
        assertEq(grantees[0], bob);
    }

    function test_getSecretGrantees_isolatedPerSecret() public {
        vm.startPrank(owner);
        vault.setSecret(nsId, API_KEY, "abc", "ns-abc");
        vault.grantSecretAccess(nsId, KEY, bob, type(uint256).max);
        vault.grantSecretAccess(nsId, API_KEY, alice, type(uint256).max);
        vm.stopPrank();

        vm.prank(owner);
        assertEq(vault.getSecretGrantees(nsId, KEY)[0], bob);
        vm.prank(owner);
        assertEq(vault.getSecretGrantees(nsId, API_KEY)[0], alice);
    }
}
