# BunKV

A fast, persistent Key-Value store for [Bun](https://bun.sh), backed by SQLite.

## Features

- **Deno KV Compatible API**: Familiar `get`, `set`, `delete`, `list`, and `atomic` methods.
- **Persistent or In-Memory**: Use a file path for persistence or `:memory:` for ephemeral storage.
- **High Performance**: Built on `bun:sqlite` with optimized query execution.
- **Binary & Complex Keys**: Supports arbitrary complex keys (strings, numbers, booleans, Uint8Arrays) with correct lexicographical sorting.
- **Atomic Transactions**: Supports multiple operations in a single atomic commit.
- **Expiration**: Built-in TTL support (`expireIn`).

## Installation

```bash
bun install @vishwakarman-technology/bun-sqlite-kv
```

## Usage

### Basic Operations

```typescript
import { openKv } from "@vishwakarman-technology/bun-sqlite-kv"

const kv = await openKv("./data/my-database.sqlite")

// Set a value
await kv.set(["users", "alice"], { name: "Alice", age: 30 })

// Get a value
const entry = await kv.get(["users", "alice"])
console.log(entry.value) // { name: "Alice", age: 30 }

// Delete
await kv.delete(["users", "alice"])
```

### Listing Keys

List operations support prefixes and ranges.

```typescript
await kv.set(["users", "alice"], "Alice")
await kv.set(["users", "bob"], "Bob")

// List all users
for await (const entry of kv.list({ prefix: ["users"] })) {
    console.log(entry.key, entry.value)
}
```

### Expiration (TTL)

Automatically expire keys after a duration (in milliseconds).

```typescript
// Expire in 10 seconds
await kv.set(["session", "123"], "active", { expireIn: 10_000 })
```

### Watching Keys

Listen for changes on specific keys. The `watch` method returns a `ReadableStream` that emits the current values immediately and whenever they change.

```typescript
const stream = kv.watch([
    ["users", "alice"],
    ["users", "bob"],
])

// Iterate over the stream to handle updates
for await (const entries of stream) {
    const alice = entries[0]
    const bob = entries[1]

    console.log("Alice:", alice.value)
    console.log("Bob:", bob.value)
}
```

### Atomic Transactions

Perform multiple operations atomically. Checks allow for optimistic concurrency control.

```typescript
const result = await kv
    .atomic()
    .check(["bank", "alice"], currentVersion) // Optional optimistic check
    .set(["bank", "alice"], 100)
    .delete(["pending", "tx_1"])
    .commit()

if (result.ok) {
    console.log("Transaction succeeded", result.version)
} else {
    console.log("Transaction failed (check failed)")
}
```

### OpenTelemetry Tracing

Enable OpenTelemetry tracing by setting the `OTEL_BUN` environment variable to `true`.

```bash
OTEL_BUN=true bun run index.ts
```

This will automatically instrument:

- `get`, `set`, `delete` operations
- `atomic.commit` transactions

Ensure you have a valid OpenTelemetry SDK setup in your application to capture these traces.

### Error Handling

Common errors you might encounter:

- `"Check failed: key exists"`: During an atomic operation with a `check(key, null)`, the key already existed.
- `"Check failed: version mismatch"`: The version specified in `check(key, version)` did not match the current database version.
- `"Unsupported key type: ..."`: You tried to use a key type that is not supported (e.g., Symbol, Function).

## Benchmarks

Benchmarks run on Apple Silicon (M-Series).

### In-Memory (`:memory:`)

_Raw throughput without disk I/O overhead._

- **Writes**: ~60,000 ops/sec
- **Reads**: ~170,000 ops/sec
- **Mixed**: ~110,000 ops/sec

### Filesystem (`db.sqlite`)

_Real-world persistent storage using SQLite WAL mode._

- **Writes**: ~3,500 ops/sec
- **Reads**: ~78,000 ops/sec
- **10MB Write**: ~15ms
- **10MB Read**: ~7ms

### Bulk Insert Benchmark

_Insertion of 1,000,000 user records (atomic batches of 1000)._

- **Total Time**: ~10.24s
- **Throughput**: ~97,000 ops/sec (batched)
- **Database Size**: ~262 MB

## Limits

`BunKV` supports significantly larger limits than standard Deno KV (which often limits Values to 64KB).

| Feature        | Tested Limit | Notes                                                                                     |
| -------------- | ------------ | ----------------------------------------------------------------------------------------- |
| **Key Size**   | 10 KB+       | Standard Deno KV limit is 2KB.                                                            |
| **Value Size** | 100 MB+      | Standard Deno KV limit is 64KB. Restricted mainly by system memory and SQLite row limits. |

## License

MIT
