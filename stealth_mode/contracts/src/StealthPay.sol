// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title StealthPay
 * @notice ERC-5564-style stealth payments on Monad. Two parts:
 *   1) Registry: a public alias ("agent handle") → stealth meta-address (spend + view pubkeys).
 *   2) Announcer/pay: send MON to a fresh one-time stealth address and emit an Announcement.
 *
 * Privacy model: the alias→meta mapping is public (like a username), but individual
 * payments go to fresh stealth addresses derived per-payment. Observers see announcements
 * but cannot link a stealth address to a recipient alias — only the holder of the viewing
 * key can detect which announcements are theirs.
 */
contract StealthPay {
    struct Meta {
        bytes spendPub; // 33-byte compressed secp256k1 pubkey
        bytes viewPub;  // 33-byte compressed secp256k1 pubkey
        bool set;
    }

    mapping(bytes32 => Meta) private metaOf; // keccak256(alias) => meta
    mapping(bytes32 => string) public aliasOf;
    bytes32[] public aliasKeys;

    event MetaRegistered(string aliasName, bytes spendPub, bytes viewPub);
    event Announcement(
        uint256 indexed schemeId,
        address indexed stealthAddress,
        address indexed sender,
        bytes ephemeralPubKey,
        bytes1 viewTag,
        uint256 amount
    );

    error BadKeyLength();
    error NoValue();
    error ForwardFailed();

    /// Register (or update) the meta-address for a public alias.
    function register(string calldata alias_, bytes calldata spendPub, bytes calldata viewPub) external {
        if (spendPub.length != 33 || viewPub.length != 33) revert BadKeyLength();
        bytes32 k = keccak256(bytes(alias_));
        if (!metaOf[k].set) {
            aliasKeys.push(k);
            aliasOf[k] = alias_;
        }
        metaOf[k] = Meta(spendPub, viewPub, true);
        emit MetaRegistered(alias_, spendPub, viewPub);
    }

    function getMeta(string calldata alias_)
        external
        view
        returns (bytes memory spendPub, bytes memory viewPub, bool set)
    {
        Meta storage m = metaOf[keccak256(bytes(alias_))];
        return (m.spendPub, m.viewPub, m.set);
    }

    function aliasCount() external view returns (uint256) {
        return aliasKeys.length;
    }

    /// Pay a one-time stealth address (forwarding msg.value) and announce it.
    function payStealth(
        address stealthAddress,
        bytes calldata ephemeralPubKey,
        bytes1 viewTag
    ) external payable {
        if (msg.value == 0) revert NoValue();
        (bool ok, ) = stealthAddress.call{value: msg.value}("");
        if (!ok) revert ForwardFailed();
        emit Announcement(1, stealthAddress, msg.sender, ephemeralPubKey, viewTag, msg.value);
    }
}
