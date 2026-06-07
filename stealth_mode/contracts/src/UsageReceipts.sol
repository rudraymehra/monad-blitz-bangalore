// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title UsageReceipts
 * @notice On-chain, tamper-evident log of paid AI-API calls for AgentMeter
 *         (Monad Blitz Bangalore). Each paid x402 call produces a receipt:
 *         who paid, which endpoint, a hash fingerprint of the request, and the
 *         amount. The request/response content stays off-chain — only the hash
 *         is anchored, giving provenance without leaking data.
 *
 *         `record` is intentionally permissionless for the hackathon MVP so the
 *         server relayer (or anyone) can append a receipt after settlement.
 */
contract UsageReceipts {
    struct Receipt {
        address payer;       // who paid for the call
        bytes32 endpointId;  // keccak256 of the endpoint name, e.g. "summarize"
        bytes32 requestHash; // keccak256/sha256 of the request payload
        uint96  amount;      // amount paid, in the token's smallest unit (USDC 6dp)
        uint64  timestamp;   // block timestamp
    }

    Receipt[] public receipts;
    mapping(bytes32 => uint256) public callsByEndpoint; // endpointId => count
    mapping(address => uint256) public callsByPayer;    // payer => count
    mapping(bytes32 => uint256) public volumeByEndpoint; // endpointId => total amount

    event Used(
        uint256 indexed id,
        address indexed payer,
        bytes32 indexed endpointId,
        bytes32 requestHash,
        uint96  amount,
        uint64  timestamp
    );

    /// @notice Append a usage receipt. Returns the receipt id.
    function record(
        address payer,
        bytes32 endpointId,
        bytes32 requestHash,
        uint96  amount
    ) external returns (uint256 id) {
        id = receipts.length;
        uint64 ts = uint64(block.timestamp);
        receipts.push(Receipt(payer, endpointId, requestHash, amount, ts));
        unchecked {
            callsByEndpoint[endpointId] += 1;
            callsByPayer[payer] += 1;
            volumeByEndpoint[endpointId] += amount;
        }
        emit Used(id, payer, endpointId, requestHash, amount, ts);
    }

    /// @notice Total number of receipts recorded.
    function total() external view returns (uint256) {
        return receipts.length;
    }

    /// @notice Return the most recent `n` receipts (newest first), capped at total.
    function latest(uint256 n) external view returns (Receipt[] memory out) {
        uint256 len = receipts.length;
        if (n > len) n = len;
        out = new Receipt[](n);
        for (uint256 i = 0; i < n; i++) {
            out[i] = receipts[len - 1 - i];
        }
    }
}
