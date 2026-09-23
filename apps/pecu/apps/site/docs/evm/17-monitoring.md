---
title: Monitoring
description: Sample new blocks, watch a contract read for changes, and consume contract events through monitors whose cursors survive restarts.
group: CLI
---

## Watch blocks

`watch` samples the latest block a fixed number of times.

| Field | Limits |
| --- | --- |
| `chainId` | Chain ID |
| `count` | 1 to 100 samples |
| `intervalMs` | 500 to 60000 milliseconds between samples |

```sh
evm watch --input '{"chainId":8453,"count":3,"intervalMs":2000}'
```

The CLI prints one line per sample as it arrives:

```json
{"version":1,"ok":true,"command":"watch","result":{"chainId":8453,"number":"30000000","hash":"0x..."}}
```

Through the SDK, MCP and the TUI, `watch` returns the array of samples after the last one.

## Watch a contract read

`watch-contract` repeats one contract read and reports whether the value changed.

| Field | Meaning |
| --- | --- |
| `name` | Name that stores the last value |
| `call` | The same input as [`read`](/docs/evm/reads#read-a-contract) |
| `count` | 1 to 1000 samples |
| `intervalMs` | 1000 to 60000 milliseconds between samples |

```json
{"name":"usdc-balance","call":{"chainId":8453,"address":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913","signatures":["function balanceOf(address) view returns (uint256)"],"functionName":"balanceOf","args":["0xYOUR_ADDRESS"]},"count":10,"intervalMs":5000}
```

Each sample has `name`, `chainId`, `address`, `block`, `value` and `changed`. The last value is stored in the journal under `name`, so the first sample after a restart compares against the value seen before it. A name belongs to one read. Reusing it for a different `call` fails with `IdempotencyConflict`. Use it for balances, allowances or positions that a contract read exposes.

## Event monitors

A monitor reads every log a contract emits, in batches, and moves its cursor only after you acknowledge a batch. Its state survives restarts.

```sh
evm monitor-create --input '{"name":"usdc-events","chainId":8453,"address":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913","fromBlock":"30000000","confirmations":12}'
evm monitor-poll --input '{"name":"usdc-events"}'
evm monitor-ack --input '{"name":"usdc-events","id":"0xBATCH_ID"}'
```

| Field | Meaning |
| --- | --- |
| `name` | Monitor name. Creating a name that exists fails with `InvalidState`. |
| `chainId`, `address` | The contract to follow. Every log from it is included. There is no topic filter. |
| `fromBlock` | First block to read, as a decimal string |
| `confirmations` | 1 to 256. The monitor stays this many blocks behind the head. |

### Poll and acknowledge

`monitor-poll` returns the next batch, or `null` when the monitor is caught up or paused. A batch covers up to 1000 blocks and has `id`, `name`, `fromBlock`, `toBlock`, `blockHash`, `reorg` and `events`. Each event has `address`, `data`, `topics`, `block`, `blockHash`, `transactionHash` and `logIndex`.

The same batch comes back on every poll until you acknowledge it. Process the events, then call `monitor-ack` with the batch `id`. The acknowledgement must match the pending batch exactly. It moves the cursor to the block after `toBlock` and saves that block's hash as a checkpoint, in one database transaction.

A safe loop is poll, process, acknowledge, repeat. If your process stops before acknowledging, the next poll returns the same batch, so make your processing idempotent by `transactionHash` and `logIndex`.

### Reorgs

Before reading a new batch, the monitor checks the saved checkpoint hash against the chain. If it changed, the cursor moves back 256 blocks and the batch has `reorg: true`. Expect events you already processed to appear again.

### Pause, resume and list

```sh
evm monitor-pause --input '{"name":"usdc-events","paused":true}'
evm monitor-pause --input '{"name":"usdc-events","paused":false}'
evm monitors
```

Pausing keeps the cursor. A batch already pending is still returned while paused. There is no command to delete a monitor. Create a new name to start over.

Events are raw logs. Decode them with [`decode`](/docs/evm/reads#decode) and `kind` set to `event`.
