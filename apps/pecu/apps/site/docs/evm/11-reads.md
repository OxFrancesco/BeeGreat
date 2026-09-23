---
title: Reads
description: Read contracts, balances, tokens, blocks, transactions and logs at a recorded block, and inspect or decode contracts.
group: CLI
---

Reads never sign and never store a plan. Every read that touches chain state returns the block it read, so a later read can use the same block.

## Supply an ABI

Contract commands take a common set of fields:

| Field | Required | Meaning |
| --- | --- | --- |
| `chainId` | Yes | Chain ID as a JSON integer |
| `address` | Yes | Contract address |
| `abi` | No | A JSON ABI array |
| `signatures` | No | Human-readable signatures, such as `"function decimals() view returns (uint8)"` |
| `block` | No | Block number as a decimal string. Reads historical state. |

The ABI comes from the first source available:

1. `abi`, used as given.
2. `signatures`, parsed into an ABI.
3. Discovery. The command reads the EIP-1967 implementation slot, then asks the Etherscan V2 API for the verified ABI of the implementation, or of the address when the slot is empty. Discovery needs `EVM_ETHERSCAN_API_KEY`.

Without an ABI source the command fails with `AbiUnavailable`. It also fails with `AbiUnavailable` when the address has no bytecode on that chain. Automatic proxy resolution covers only the EIP-1967 implementation slot. For other proxy patterns, supply the implementation's ABI yourself.

## Inspect a contract

```sh
evm inspect --input '{"chainId":8453,"address":"0xTOKEN"}'
```

The result has `address`, `implementation` (or `null`), `abi`, `source` (`provided`, `signatures` or `etherscan`) and `block`. In the TUI, the returned functions become a picker that opens a filled `read` or `prepare-call` form.

## Read a contract

```sh
evm read --input '{"chainId":8453,"address":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913","signatures":["function decimals() view returns (uint8)"],"functionName":"decimals"}'
```

```json
{"version":1,"ok":true,"command":"read","result":{"chainId":8453,"address":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913","block":"30000000","value":6}}
```

`read` adds `functionName`, optional `args` and optional `account` to the contract fields. `account` sets the caller for the call.

- Pass large integers as decimal strings, such as `"1000000"`.
- Pass arrays as JSON arrays and tuples as objects keyed by component name, or as arrays.
- Results for `uint256` and other large integers come back as decimal strings. Small integer types such as `uint8` come back as JSON numbers.

```json
{"chainId":8453,"address":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913","signatures":["function balanceOf(address) view returns (uint256)"],"functionName":"balanceOf","args":["0xYOUR_ADDRESS"]}
```

## Historical reads

`inspect`, `read`, `decode` and `identity` accept `block`. Reading an old block needs an archive RPC. Without `block`, the command reads the latest block number once and uses it for every call it makes. `balance`, `token` and `allowance` always read the latest block and return its number.

## Chain data

| Command | Input | Returns |
| --- | --- | --- |
| `balance` | `chainId`, `address` | `block`, `balanceWei` |
| `token` | `chainId`, `address`, `token` | `block`, `symbol`, `decimals`, `amount` in base units, all read at one block |
| `allowance` | `chainId`, `account`, `token`, `spender` | `block`, `amount` in base units |
| `block` | `chainId`, optional `number` | `number`, `hash`, `parentHash`, `timestamp`, `gasUsed`, `gasLimit`, `baseFeePerGas`, transaction count |
| `transaction` | `chainId`, `hash` | `from`, `to`, `nonce`, `valueWei`, `data`, `block`, `gas`, `gasPrice` |

```sh
evm token --input '{"chainId":8453,"address":"0xYOUR_ADDRESS","token":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"}'
evm allowance --input '{"chainId":8453,"account":"0xYOUR_ADDRESS","token":"0xTOKEN","spender":"0xSPENDER"}'
```

`token` metadata comes from the token contract. Treat symbols as untrusted text.

## Logs and pagination

`logs` takes `chainId`, `address`, `fromBlock`, `toBlock` and an optional `offset`. One call covers at most 2000 blocks and returns at most 1000 records. The result says where to continue:

| Field | Meaning |
| --- | --- |
| `fromBlock`, `toBlock` | The block window this call read |
| `nextBlock` | Where the next call starts, or `null` when the requested range is done |
| `nextOffset` | The record offset for the next call. Nonzero when one window held more than 1000 records. |

To read a long range, keep your original `toBlock`, and call again with `fromBlock` set to `nextBlock` and `offset` set to `nextOffset` until `nextBlock` is `null`. Records are never dropped between pages.

```sh
evm logs --input '{"chainId":8453,"address":"0xTOKEN","fromBlock":"30000000","toBlock":"30010000"}'
```

Each log has `address`, `data`, `topics`, `block`, `transactionHash`, `logIndex` and `removed`. Logs are not decoded. Use `decode` with `kind` set to `event` to decode one.

## Decode

`decode` takes the contract fields plus `data`, `kind` (`call`, `error` or `event`) and, for events, `topics`. It resolves the ABI the same way as `inspect`, so the address must have bytecode.

```sh
evm decode --input '{"chainId":8453,"address":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913","signatures":["function transfer(address to, uint256 amount) returns (bool)"],"kind":"call","data":"0xa9059cbb000000000000000000000000111111111111111111111111111111111111111100000000000000000000000000000000000000000000000000000000000f4240"}'
```

The result has `source` and the decoded `result`, here `transfer` to `0x1111111111111111111111111111111111111111` with an amount of `"1000000"`.

## Identity and names

`identity` returns the resolved contract with its `implementation`, the `codeHash` of the implementation or the address, and `descriptionsTrusted: false`. Names and descriptions from explorers are untrusted data. Compare bytecode hashes when you need to know what code runs.

`resolve-name` resolves an ENS name on a chain with an ENS registry and fails with `NotFound` when the name has no address:

```sh
evm resolve-name --input '{"name":"yourname.eth","chainId":1}'
```

## Capabilities and simulation

`capabilities` probes one chain and the current signer:

```sh
evm capabilities --input '{"chainId":8453}'
```

It returns `block`, `eip1559`, `safeBlocks`, `finalizedBlocks`, `assetSimulation`, `signer` (address and whether it is interactive, or `null`) and `socketEndpoint`.

`simulate` runs up to 32 calls in sequence with `eth_simulateV1` and traces asset changes:

```json
{"chainId":8453,"account":"0xYOUR_ADDRESS","calls":[{"to":"0xTOKEN","data":"0x","value":"0"}]}
```

When the RPC does not support `eth_simulateV1`, the result has `available: false` and a `reason` instead of failing. Simulation shows what the RPC predicts at one block. It does not prove what happens when the transaction is included.
