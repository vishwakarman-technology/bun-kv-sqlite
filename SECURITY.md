# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in BunKV, please report it via email to **developers@vishwakarman.tech**.

We will acknowledge your report within 7 days and provide an estimated timeline for a patch or workaround. We ask that you do not publicly disclose the issue until it has been addressed.

## Security Considerations & Limitations

When using BunKV, be aware of the following design choices and their security/operational implications:

### 1. Resource Management (Watchers)
BunKV sets `MaxListeners` to `0` (unlimited) to allow for many concurrent `watch` operations.
-   **Risk**: If your application creates watchers based on untrusted user input without limits, it may lead to memory exhaustion (DoS).
-   **Mitigation**: Ensure your application limits the number of active watchers per user or session, and always cancels readers (`reader.cancel()`) when they are no longer needed.

### 2. Data Privacy (Tracing)
If OpenTelemetry tracing is enabled (`OTEL_BUN=true`), BunKV logs keys to the tracing backend for observability (`db.key` attribute).
-   **Risk**: If your keys contain sensitive information (e.g., `["session", "SECRET_TOKEN"]`), this data will be visible in your trace logs.
-   **Mitigation**: Avoid including secrets directly in keys. Store secrets as values (which are not logged) or hash sensitive parts of the key.

### 3. Database Growth (Lazy Expiration)
BunKV implements "Lazy Expiration" for performance. Expired keys are not strictly deleted from the underlying SQLite database until they are accessed via `get()`.
-   **Risk**: A database with many set-with-expiry operations that are never read again may grow in size indefinitely on disk.
-   **Mitigation**: Periodic vacuuming or accessing keys can trigger cleanup, but currently, no automatic background garbage collection is enforced by the library.
