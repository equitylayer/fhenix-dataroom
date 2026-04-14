// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {CoFheTest} from "@cofhe/mock-contracts/foundry/CoFheTest.sol";
import {euint128} from "@fhenixprotocol/cofhe-contracts/FHE.sol";
import {DataRoom} from "../../src/DataRoom.sol";
import {DataRoomBaseTest} from "../helpers/DataRoomBase.t.sol";

/// @title DataRoomIntegrationTest
/// @notice End-to-end workflow tests for the standalone DataRoom contract.
contract DataRoomIntegrationTest is DataRoomBaseTest, CoFheTest {
    address investorA = makeAddr("investorA");
    address investorB = makeAddr("investorB");
    address lawyer = makeAddr("lawyer");
    address auditor = makeAddr("auditor");

    function setUp() public {
        _baseSetUp();
        room = dataRoom;
    }

    // ═══════════════════════════════════════════════════════════════
    //  1. Full deal room lifecycle: create → share → revoke → rekey
    // ═══════════════════════════════════════════════════════════════

    function test_dealRoomLifecycle() public {
        vm.startPrank(board);
        uint256 parentId = room.createRoom("Series A");
        uint256 legalId = room.createFolder(parentId, "Legal");
        uint256 financialsId = room.createFolder(parentId, "Financials");

        room.addDocuments(
            legalId,
            _s2("bafyCOA", "bafyNDA"),
            _s2("certificate_of_incorporation.pdf", "nda_template.pdf"),
            _b2(_wk(1), _wk(2)),
            _b2('{"type":"legal"}', '{"type":"legal"}')
        );
        room.addDocuments(
            financialsId, _s1("bafyPL"), _s1("profit_loss_2025.xlsx"), _b1(_wk(3)), _b1('{"type":"financial"}')
        );

        room.grantAccessToAllFolders(parentId, investorA, type(uint256).max);
        vm.stopPrank();

        vm.startPrank(investorA);
        assertTrue(room.hasAccess(legalId));
        assertTrue(room.hasAccess(financialsId));

        (string memory cid,,,, bytes memory wk,) = room.getDocument(legalId, 0);
        assertEq(cid, "bafyCOA");
        assertTrue(wk.length > 0);

        (cid,,,, wk,) = room.getDocument(financialsId, 0);
        assertEq(cid, "bafyPL");
        assertTrue(wk.length > 0);

        euint128 legalKey = room.getRoomKey(legalId);
        euint128 finKey = room.getRoomKey(financialsId);
        assertTrue(euint128.unwrap(legalKey) != bytes32(0));
        assertTrue(euint128.unwrap(finKey) != bytes32(0));
        vm.stopPrank();

        vm.startPrank(board);
        room.revokeAndRekey(legalId, _addrs(investorA));
        room.revokeAndRekey(financialsId, _addrs(investorA));

        room.updateDocumentKeys(legalId, _u2(0, 1), _b2(_wk(100), _wk(101)));
        room.updateDocumentKeys(financialsId, _u1(0), _b1(_wk(102)));
        vm.stopPrank();

        vm.startPrank(investorA);
        assertFalse(room.hasAccess(legalId));
        assertFalse(room.hasAccess(financialsId));

        vm.expectRevert(DataRoom.Unauthorized.selector);
        room.getRoomKey(legalId);

        vm.expectRevert(DataRoom.Unauthorized.selector);
        room.getRoomKey(financialsId);

        vm.expectRevert(DataRoom.Unauthorized.selector);
        room.getDocument(legalId, 0);
        vm.stopPrank();

        assertEq(room.roomKeyVersion(legalId), 1);
        assertEq(room.roomKeyVersion(financialsId), 1);

        (,,, uint256 kv,,) = _getDoc(legalId, 0);
        assertEq(kv, 1);
        (,,, kv,,) = _getDoc(legalId, 1);
        assertEq(kv, 1);
        (,,, kv,,) = _getDoc(financialsId, 0);
        assertEq(kv, 1);

        vm.prank(board);
        assertTrue(room.hasAccess(legalId));
        vm.prank(board);
        room.getRoomKey(legalId);
    }

    // ═══════════════════════════════════════════════════════════════
    //  2. Multi-folder permission isolation
    // ═══════════════════════════════════════════════════════════════

    function test_folderIsolation_investorsSeeDifferentFolders() public {
        vm.startPrank(board);
        uint256 parentId = room.createRoom("Fundraise");
        uint256 legalId = room.createFolder(parentId, "Legal");
        uint256 finId = room.createFolder(parentId, "Financials");

        room.addDocuments(legalId, _s1("cidLegal"), _s1("legal.pdf"), _b1(_wk(1)), _b1(""));
        room.addDocuments(finId, _s1("cidFin"), _s1("financials.xlsx"), _b1(_wk(2)), _b1(""));

        room.grantAccess(legalId, _addrs(investorA), _permExp(1));
        room.grantAccess(finId, _addrs(investorB), _permExp(1));
        vm.stopPrank();

        vm.prank(investorA);
        assertTrue(room.hasAccess(legalId));
        vm.prank(investorA);
        assertFalse(room.hasAccess(finId));

        vm.prank(investorA);
        room.getDocument(legalId, 0);

        vm.expectRevert(DataRoom.Unauthorized.selector);
        vm.prank(investorA);
        room.getDocument(finId, 0);

        vm.prank(investorB);
        assertFalse(room.hasAccess(legalId));
        vm.prank(investorB);
        assertTrue(room.hasAccess(finId));

        vm.prank(investorB);
        room.getDocument(finId, 0);

        vm.expectRevert(DataRoom.Unauthorized.selector);
        vm.prank(investorB);
        room.getDocument(legalId, 0);
    }

    // ═══════════════════════════════════════════════════════════════
    //  3. Rekey preserves remaining members
    // ═══════════════════════════════════════════════════════════════

    function test_rekeyAfterPartialRevoke_preservesRemainingMember() public {
        vm.startPrank(board);
        uint256 parentId = room.createRoom("Deal");
        uint256 folderId = room.createFolder(parentId, "Docs");

        room.addDocuments(folderId, _s1("cidDoc"), _s1("term_sheet.pdf"), _b1(_wk(1)), _b1(""));
        room.grantAccess(folderId, _addrs(investorA, investorB), _permExp(2));
        vm.stopPrank();

        vm.prank(investorA);
        assertTrue(room.hasAccess(folderId));
        vm.prank(investorB);
        assertTrue(room.hasAccess(folderId));

        vm.prank(board);
        room.revokeAndRekey(folderId, _addrs(investorA));

        vm.prank(investorA);
        assertFalse(room.hasAccess(folderId));
        vm.expectRevert(DataRoom.Unauthorized.selector);
        vm.prank(investorA);
        room.getRoomKey(folderId);

        vm.prank(investorB);
        assertTrue(room.hasAccess(folderId));
        vm.prank(investorB);
        euint128 key = room.getRoomKey(folderId);
        assertTrue(euint128.unwrap(key) != bytes32(0));
    }

    // ═══════════════════════════════════════════════════════════════
    //  4. Document lifecycle
    // ═══════════════════════════════════════════════════════════════

    function test_documentLifecycle_deleteAndContinue() public {
        vm.startPrank(board);
        uint256 parentId = room.createRoom("Archive");
        uint256 folderId = room.createFolder(parentId, "Reports");

        room.addDocuments(
            folderId,
            _s3("cid0", "cid1", "cid2"),
            _s3("q1.pdf", "q2.pdf", "q3.pdf"),
            _b3(_wk(0), _wk(1), _wk(2)),
            _b3("", "", "")
        );

        room.removeDocument(folderId, 1);

        (string memory c0,,,,,) = room.getDocument(folderId, 0);
        assertEq(c0, "cid0");

        vm.expectRevert(DataRoom.DocumentDeleted.selector);
        room.getDocument(folderId, 1);

        (string memory c2,,,,,) = room.getDocument(folderId, 2);
        assertEq(c2, "cid2");

        room.addDocuments(folderId, _s1("cid3"), _s1("q4.pdf"), _b1(_wk(3)), _b1(""));
        (string memory c3,,,,,) = room.getDocument(folderId, 3);
        assertEq(c3, "cid3");

        (, uint256 docCount,,,,) = room.getRoom(folderId);
        assertEq(docCount, 4);
        vm.stopPrank();
    }

    // ═══════════════════════════════════════════════════════════════
    //  5. Mixed public/private folder workflow
    // ═══════════════════════════════════════════════════════════════

    function test_mixedPublicPrivateWorkflow() public {
        vm.startPrank(board);
        uint256 parentId = room.createRoom("Investor Portal");
        uint256 folderId = room.createFolder(parentId, "Shared");

        room.addDocuments(
            folderId,
            _s2("cidPitch", "cidTerms"),
            _s2("pitch_deck.pdf", "term_sheet.pdf"),
            _b2("", _wk(1)),
            _b2('{"public":true}', '{"confidential":true}')
        );
        vm.stopPrank();

        vm.prank(auditor);
        (string memory cid,,,, bytes memory wk,) = room.getDocument(folderId, 0);
        assertEq(cid, "cidPitch");
        assertEq(wk.length, 0);

        vm.expectRevert(DataRoom.Unauthorized.selector);
        vm.prank(auditor);
        room.getDocument(folderId, 1);

        vm.prank(board);
        room.updateDocumentKeys(folderId, _u1(0), _b1(_wk(99)));

        vm.expectRevert(DataRoom.Unauthorized.selector);
        vm.prank(auditor);
        room.getDocument(folderId, 0);

        vm.expectRevert(DataRoom.Unauthorized.selector);
        vm.prank(auditor);
        room.getDocument(folderId, 1);

        vm.prank(board);
        room.grantAccess(folderId, _addrs(investorA), _permExp(1));

        vm.startPrank(investorA);
        (cid,,,, wk,) = room.getDocument(folderId, 0);
        assertEq(cid, "cidPitch");
        assertTrue(wk.length > 0);
        (cid,,,, wk,) = room.getDocument(folderId, 1);
        assertEq(cid, "cidTerms");
        assertTrue(wk.length > 0);
        vm.stopPrank();
    }

    // ═══════════════════════════════════════════════════════════════
    //  6. Bulk grant → revoke → re-grant cycle
    // ═══════════════════════════════════════════════════════════════

    function test_bulkGrantRevokeRegrantCycle() public {
        vm.startPrank(board);
        uint256 parentId = room.createRoom("M&A");
        uint256 f1 = room.createFolder(parentId, "Legal");
        uint256 f2 = room.createFolder(parentId, "Tax");
        uint256 f3 = room.createFolder(parentId, "IP");

        address[] memory users = new address[](4);
        users[0] = investorA;
        users[1] = investorB;
        users[2] = lawyer;
        users[3] = auditor;

        for (uint256 i = 0; i < users.length; i++) {
            room.grantAccessToAllFolders(parentId, users[i], type(uint256).max);
        }

        for (uint256 fId = f1; fId <= f3; fId++) {
            (,, uint256 mc,,,) = room.getRoom(fId);
            assertEq(mc, 5);
        }

        for (uint256 i = 0; i < users.length; i++) {
            room.revokeAccessFromAllFolders(parentId, users[i]);
        }

        for (uint256 fId = f1; fId <= f3; fId++) {
            (,, uint256 mc,,,) = room.getRoom(fId);
            assertEq(mc, 1);
        }

        room.grantAccess(f1, _addrs(lawyer), _permExp(1));
        room.grantAccess(f2, _addrs(auditor), _permExp(1));

        (,, uint256 mc1,,,) = room.getRoom(f1);
        assertEq(mc1, 2);
        (,, uint256 mc2,,,) = room.getRoom(f2);
        assertEq(mc2, 2);
        (,, uint256 mc3,,,) = room.getRoom(f3);
        assertEq(mc3, 1);

        vm.stopPrank();

        vm.prank(lawyer);
        assertTrue(room.hasAccess(f1));
        vm.prank(lawyer);
        assertFalse(room.hasAccess(f2));

        vm.prank(auditor);
        assertFalse(room.hasAccess(f1));
        vm.prank(auditor);
        assertTrue(room.hasAccess(f2));
    }

    // ═══════════════════════════════════════════════════════════════
    //  7. Multi-rekey key version tracking
    // ═══════════════════════════════════════════════════════════════

    function test_multiRekey_docKeyVersionsTrackCorrectly() public {
        vm.startPrank(board);
        uint256 parentId = room.createRoom("Vault");
        uint256 folderId = room.createFolder(parentId, "Secrets");

        room.addDocuments(folderId, _s1("cidV0"), _s1("v0.pdf"), _b1(_wk(0)), _b1(""));
        (,,, uint256 kv0,,) = room.getDocument(folderId, 0);
        assertEq(kv0, 0);

        room.rekeyRoom(folderId);
        room.addDocuments(folderId, _s1("cidV1"), _s1("v1.pdf"), _b1(_wk(1)), _b1(""));
        (,,, uint256 kv1,,) = room.getDocument(folderId, 1);
        assertEq(kv1, 1);

        room.rekeyRoom(folderId);
        room.addDocuments(folderId, _s1("cidV2"), _s1("v2.pdf"), _b1(_wk(2)), _b1(""));
        (,,, uint256 kv2,,) = room.getDocument(folderId, 2);
        assertEq(kv2, 2);

        room.rekeyRoom(folderId);
        assertEq(room.roomKeyVersion(folderId), 3);

        (,,, kv0,,) = room.getDocument(folderId, 0);
        assertEq(kv0, 0);
        (,,, kv1,,) = room.getDocument(folderId, 1);
        assertEq(kv1, 1);

        room.updateDocumentKeys(folderId, _u1(0), _b1(_wk(30)));
        (,,, uint256 kv0after,,) = room.getDocument(folderId, 0);
        assertEq(kv0after, 3);

        vm.stopPrank();
    }

    // ═══════════════════════════════════════════════════════════════
    //  8. Operator immutability
    // ═══════════════════════════════════════════════════════════════

    function test_operatorCannotBeRevokedFromAnyPath() public {
        vm.startPrank(board);
        uint256 parentId = room.createRoom("Protected");
        uint256 folderId = room.createFolder(parentId, "Data");

        room.grantAccess(folderId, _addrs(d01Operator), _permExp(1));

        vm.expectRevert(DataRoom.CannotRevokeOperator.selector);
        room.revokeAccess(folderId, _addrs(d01Operator));

        vm.expectRevert(DataRoom.CannotRevokeOperator.selector);
        room.revokeAndRekey(folderId, _addrs(d01Operator));

        vm.expectRevert(DataRoom.CannotRevokeOperator.selector);
        room.revokeAccessFromAllFolders(parentId, d01Operator);

        vm.stopPrank();

        vm.prank(d01Operator);
        room.getRoomKey(folderId);
    }

    // ═══════════════════════════════════════════════════════════════
    //  9. Member mutation blocking
    // ═══════════════════════════════════════════════════════════════

    function test_memberCannotMutateForeignRoom() public {
        vm.startPrank(board);
        uint256 parentId = room.createRoom("ReadOnly");
        uint256 folderId = room.createFolder(parentId, "Data");
        room.addDocuments(folderId, _s1("cid"), _s1("file.pdf"), _b1(_wk(0)), _b1(""));
        room.grantAccess(folderId, _addrs(investorA), _permExp(1));
        vm.stopPrank();

        vm.prank(investorA);
        assertTrue(room.hasAccess(folderId));
        vm.prank(investorA);
        room.getDocument(folderId, 0);

        vm.startPrank(investorA);

        uint256 ownParentId = room.createRoom("Nope");
        assertEq(room.ownerOf(ownParentId), investorA);

        vm.expectRevert(DataRoom.OnlyAdmin.selector);
        room.createFolder(parentId, "Nope");

        vm.expectRevert(DataRoom.OnlyAdmin.selector);
        room.addDocuments(folderId, _s1("x"), _s1("x"), _b1(""), _b1(""));

        vm.expectRevert(DataRoom.OnlyAdmin.selector);
        room.removeDocument(folderId, 0);

        vm.expectRevert(DataRoom.OnlyAdmin.selector);
        room.grantAccess(folderId, _addrs(investorB), _permExp(1));

        vm.expectRevert(DataRoom.OnlyAdmin.selector);
        room.revokeAccess(folderId, _addrs(board));

        vm.expectRevert(DataRoom.OnlyAdmin.selector);
        room.rekeyRoom(folderId);

        vm.expectRevert(DataRoom.OnlyAdmin.selector);
        room.renameRoom(folderId, "Nope");

        vm.expectRevert(DataRoom.OnlyAdmin.selector);
        room.updateDocumentKeys(folderId, _u1(0), _b1(_wk(1)));

        vm.expectRevert(DataRoom.OnlyAdmin.selector);
        room.updateDocumentMetadata(folderId, _u1(0), _b1(""));

        vm.expectRevert(DataRoom.OnlyAdmin.selector);
        room.grantAccessToAllFolders(parentId, investorB, type(uint256).max);

        vm.expectRevert(DataRoom.OnlyAdmin.selector);
        room.revokeAccessFromAllFolders(parentId, board);

        vm.expectRevert(DataRoom.OnlyAdmin.selector);
        room.revokeAndRekey(folderId, _addrs(board));

        vm.stopPrank();
    }

    // ═══════════════════════════════════════════════════════════════
    //  10. Room hierarchy isolation
    // ═══════════════════════════════════════════════════════════════

    function test_multipleParentRooms_isolatedHierarchies() public {
        vm.startPrank(board);

        uint256 p1 = room.createRoom("Series A");
        uint256 p2 = room.createRoom("Series B");

        uint256 p1f1 = room.createFolder(p1, "A-Legal");
        uint256 p1f2 = room.createFolder(p1, "A-Financial");
        uint256 p2f1 = room.createFolder(p2, "B-Legal");

        uint256[] memory p1Folders = room.getFolders(p1);
        assertEq(p1Folders.length, 2);
        assertEq(p1Folders[0], p1f1);
        assertEq(p1Folders[1], p1f2);

        uint256[] memory p2Folders = room.getFolders(p2);
        assertEq(p2Folders.length, 1);
        assertEq(p2Folders[0], p2f1);

        assertEq(room.getParentRoom(p1f1), p1);
        assertEq(room.getParentRoom(p1f2), p1);
        assertEq(room.getParentRoom(p2f1), p2);

        room.grantAccessToAllFolders(p1, investorA, type(uint256).max);
        vm.stopPrank();

        vm.prank(investorA);
        assertTrue(room.hasAccess(p1f1));
        vm.prank(investorA);
        assertTrue(room.hasAccess(p1f2));
        vm.prank(investorA);
        assertFalse(room.hasAccess(p2f1));

        vm.prank(board);
        room.revokeAccessFromAllFolders(p1, investorA);

        vm.prank(investorA);
        assertFalse(room.hasAccess(p1f1));
    }

    // ═══════════════════════════════════════════════════════════════
    //  11. Document metadata update
    // ═══════════════════════════════════════════════════════════════

    function test_metadataUpdatePreservesDocIntegrity() public {
        vm.startPrank(board);
        uint256 parentId = room.createRoom("Compliance");
        uint256 folderId = room.createFolder(parentId, "KYC");

        bytes memory wk0 = _wk(10);
        bytes memory wk1 = _wk(11);
        room.addDocuments(
            folderId,
            _s2("cidPassport", "cidProofAddr"),
            _s2("passport.jpg", "utility_bill.pdf"),
            _b2(wk0, wk1),
            _b2('{"status":"pending"}', '{"status":"pending"}')
        );

        room.updateDocumentMetadata(folderId, _u2(0, 1), _b2('{"status":"approved"}', '{"status":"approved"}'));

        (string memory cid0,,,, bytes memory w0, bytes memory m0) = room.getDocument(folderId, 0);
        assertEq(cid0, "cidPassport");
        assertEq(w0, wk0);
        assertEq(m0, '{"status":"approved"}');

        (string memory cid1,,,, bytes memory w1, bytes memory m1) = room.getDocument(folderId, 1);
        assertEq(cid1, "cidProofAddr");
        assertEq(w1, wk1);
        assertEq(m1, '{"status":"approved"}');
        vm.stopPrank();
    }

    // ═══════════════════════════════════════════════════════════════
    //  12. Rename preserves state integrity
    // ═══════════════════════════════════════════════════════════════

    function test_renamePreservesStateIntegrity() public {
        vm.startPrank(board);
        uint256 parentId = room.createRoom("Old Name");
        uint256 folderId = room.createFolder(parentId, "Old Folder");

        room.addDocuments(folderId, _s1("cidX"), _s1("x.pdf"), _b1(_wk(0)), _b1(""));
        room.grantAccess(folderId, _addrs(investorA), _permExp(1));

        room.renameRoom(parentId, "New Name");
        room.renameRoom(folderId, "New Folder");
        vm.stopPrank();

        (string memory pName,,,,,) = room.getRoom(parentId);
        assertEq(pName, "New Name");
        (string memory fName,,,,,) = room.getRoom(folderId);
        assertEq(fName, "New Folder");

        vm.prank(investorA);
        assertTrue(room.hasAccess(folderId));

        (string memory cid,,,,,) = _getDoc(folderId, 0);
        assertEq(cid, "cidX");
    }

    // ═══════════════════════════════════════════════════════════════
    //  13. Parallel deals fully isolated
    // ═══════════════════════════════════════════════════════════════

    function test_parallelDeals_fullyIsolated() public {
        vm.startPrank(board);
        uint256 dealA = room.createRoom("Deal A");
        uint256 dealAFolder = room.createFolder(dealA, "Docs");
        room.addDocuments(dealAFolder, _s1("cidA"), _s1("a.pdf"), _b1(_wk(1)), _b1(""));
        room.grantAccess(dealAFolder, _addrs(investorA), _permExp(1));

        uint256 dealB = room.createRoom("Deal B");
        uint256 dealBFolder = room.createFolder(dealB, "Docs");
        room.addDocuments(dealBFolder, _s1("cidB"), _s1("b.pdf"), _b1(_wk(2)), _b1(""));
        room.grantAccess(dealBFolder, _addrs(investorB), _permExp(1));
        vm.stopPrank();

        vm.prank(investorA);
        assertTrue(room.hasAccess(dealAFolder));
        vm.prank(investorA);
        assertFalse(room.hasAccess(dealBFolder));

        vm.prank(investorB);
        assertTrue(room.hasAccess(dealBFolder));
        vm.prank(investorB);
        assertFalse(room.hasAccess(dealAFolder));

        vm.prank(board);
        room.revokeAndRekey(dealAFolder, _addrs(investorA));

        vm.prank(investorB);
        assertTrue(room.hasAccess(dealBFolder));
        vm.prank(investorB);
        room.getRoomKey(dealBFolder);
    }
}
