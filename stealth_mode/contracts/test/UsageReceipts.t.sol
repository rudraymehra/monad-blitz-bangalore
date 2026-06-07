// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test} from "forge-std/Test.sol";
import {UsageReceipts} from "../src/UsageReceipts.sol";

contract UsageReceiptsTest is Test {
    UsageReceipts internal r;
    bytes32 internal constant EP = keccak256("summarize");

    event Used(
        uint256 indexed id,
        address indexed payer,
        bytes32 indexed endpointId,
        bytes32 requestHash,
        uint96 amount,
        uint64 timestamp
    );

    function setUp() public {
        r = new UsageReceipts();
    }

    function test_RecordIncrementsCountersAndEmits() public {
        address payer = address(0xBEEF);
        bytes32 reqHash = keccak256("hello world");

        vm.expectEmit(true, true, true, true);
        emit Used(0, payer, EP, reqHash, 1000, uint64(block.timestamp));

        uint256 id = r.record(payer, EP, reqHash, 1000);
        assertEq(id, 0);
        assertEq(r.total(), 1);
        assertEq(r.callsByEndpoint(EP), 1);
        assertEq(r.callsByPayer(payer), 1);
        assertEq(r.volumeByEndpoint(EP), 1000);
    }

    function test_Accumulates() public {
        r.record(address(0x1), EP, keccak256("a"), 1000);
        r.record(address(0x1), EP, keccak256("b"), 1000);
        r.record(address(0x2), EP, keccak256("c"), 500);
        assertEq(r.total(), 3);
        assertEq(r.callsByEndpoint(EP), 3);
        assertEq(r.callsByPayer(address(0x1)), 2);
        assertEq(r.volumeByEndpoint(EP), 2500);
    }

    function test_LatestReturnsNewestFirst() public {
        r.record(address(0x1), EP, keccak256("a"), 1);
        r.record(address(0x1), EP, keccak256("b"), 2);
        r.record(address(0x1), EP, keccak256("c"), 3);
        UsageReceipts.Receipt[] memory out = r.latest(2);
        assertEq(out.length, 2);
        assertEq(out[0].requestHash, keccak256("c"));
        assertEq(out[1].requestHash, keccak256("b"));
    }

    function test_LatestCapsAtTotal() public {
        r.record(address(0x1), EP, keccak256("a"), 1);
        UsageReceipts.Receipt[] memory out = r.latest(50);
        assertEq(out.length, 1);
    }

    function testFuzz_Record(address payer, bytes32 reqHash, uint96 amount) public {
        r.record(payer, EP, reqHash, amount);
        assertEq(r.callsByPayer(payer), 1);
        assertEq(r.volumeByEndpoint(EP), amount);
    }
}
