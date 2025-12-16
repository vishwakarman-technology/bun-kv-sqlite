# Security & Code Quality Review

## Findings

### 1. Unbounded Event Listeners (Resource Exhaustion Risk)
**Severity**: Low (if used internally) / Medium (if exposed to untrusted input)
**Location**: `src/kv.ts:76`
```typescript
this.events.setMaxListeners(0); // Unlimited listeners
```
**Issue**: Setting max listeners to 0 disables the memory leak warning. If an application creates many watchers (e.g., one per user connection) without properly cancelling them, this will lead to a memory leak and potential crash.
**Recommendation**: Ensure watchers are always cancelled or limit the number of active watchers if possible.

### 2. Lazy Expiration & Database Growth
**Severity**: Medium (Performance/Storage)
**Location**: `src/kv.ts:195` (list)
**Issue**: The `list()` method filters out expired keys but does not delete them. The `get()` method lazily deletes them. If keys are only ever listed and never accessed directly via `get()`, they will remain in the database forever, occupying space and slowing down queries.
**Recommendation**: Implement a background cleanup task (e.g., `vacuum()` method) or delete expired keys during `list()` iteration (though this affects read performance).

### 3. Loose Migration Handling
**Severity**: Low (Reliability)
**Location**: `src/kv.ts:91`
```typescript
try { this.db.run(SQL.MIGRATE_ADD_VERSION); } catch { }
```
**Issue**: Swallowing all errors hides potential database corruption or permissions issues. It assumes the only error is "column already exists", which might not be true.
**Recommendation**: Check if the column exists using `PRAGMA table_info` before attempting to add it, or check `error.message`.

### 4. Minor SQL Parameter Injection
**Severity**: Very Low / Safe
**Location**: `src/kv.ts:202`
```typescript
const conditions: string[] = [`(date_expired IS NULL OR date_expired >= ${now})`];
```
**Issue**: While `Date.now()` returns a number and is currently safe from injection, it is best practice to always use parameter bindings for values in SQL queries.
**Recommendation**: Use `?` binding for `now`.

### 5. Sensitive Data in Traces
**Severity**: Informational
**Location**: `src/kv.ts:117`, `src/kv.ts:152`
```typescript
span?.setAttribute("db.key", JSON.stringify(key));
```
**Issue**: Keys are logged to OpenTelemetry traces. If keys contain PII or secrets (e.g. `["session", "token_123"]`), this could leak sensitive data to the tracing backend.
**Recommendation**: Ensure keys do not contain secrets, or implement a masking strategy for traces.

## Conclusion
The codebase is generally secure against major vulnerabilities like SQL Injection (due to use of bindings) and Path Traversal (assuming trusted input for DB path). The identified issues are primarily related to resource management and best practices.
