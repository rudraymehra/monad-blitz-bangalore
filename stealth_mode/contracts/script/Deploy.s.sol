// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {UsageReceipts} from "../src/UsageReceipts.sol";

/**
 * Deploy UsageReceipts to Monad Testnet.
 * Usage:
 *   forge script script/Deploy.s.sol:Deploy --rpc-url https://testnet-rpc.monad.xyz \
 *     --private-key $PRIVATE_KEY --broadcast
 * (or use --account <keystore> instead of --private-key)
 */
contract Deploy is Script {
    function run() external returns (UsageReceipts r) {
        vm.startBroadcast();
        r = new UsageReceipts();
        console.log("UsageReceipts deployed at:", address(r));
        vm.stopBroadcast();
    }
}
