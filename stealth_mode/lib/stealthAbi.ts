// ABI for StealthPay.sol (only what the app uses).
export const stealthAbi = [
  {
    type: "function",
    name: "register",
    stateMutability: "nonpayable",
    inputs: [
      { name: "alias_", type: "string" },
      { name: "spendPub", type: "bytes" },
      { name: "viewPub", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getMeta",
    stateMutability: "view",
    inputs: [{ name: "alias_", type: "string" }],
    outputs: [
      { name: "spendPub", type: "bytes" },
      { name: "viewPub", type: "bytes" },
      { name: "set", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "aliasCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "payStealth",
    stateMutability: "payable",
    inputs: [
      { name: "stealthAddress", type: "address" },
      { name: "ephemeralPubKey", type: "bytes" },
      { name: "viewTag", type: "bytes1" },
    ],
    outputs: [],
  },
  {
    type: "event",
    name: "Announcement",
    inputs: [
      { name: "schemeId", type: "uint256", indexed: true },
      { name: "stealthAddress", type: "address", indexed: true },
      { name: "sender", type: "address", indexed: true },
      { name: "ephemeralPubKey", type: "bytes", indexed: false },
      { name: "viewTag", type: "bytes1", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;
