import { Database } from "bun:sqlite";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import { type Span, type Tracer, trace } from "@opentelemetry/api";
import { ulid } from "ulid";
import { encodeKey } from "./encoding";
import { KvErrors } from "./error";
import { SQL } from "./sql";
import type {
	KvCommitResult,
	KvEntry,
	KvEntryMaybe,
	KvKey,
	KvListOptions,
	KvListSelector,
	KvSetOptions,
} from "./types";

/**
 * BunKV Store backed by SQLite.
 * Compatible with Deno KV API.
 */
export class BunKV {
	private db: Database;
	private events = new EventEmitter();
	private tracer: Tracer | null = null;

	/**
	 * Open a new KV Store instance.
	 * @param path File path to the SQLite database, or ":memory:"
	 */
	constructor(path: string) {
		if (!path) {
			throw new Error("Path is required");
		}
		if (path === ":memory:") {
			this.db = new Database(":memory:");
		} else {
			// make sure the directory exists or else create it
			const dir = path.substring(0, path.lastIndexOf("/"));
			if (dir) {
				fs.mkdirSync(dir, { recursive: true });
			}
			this.db = new Database(path);
		}
		this.events.setMaxListeners(0); // Unlimited listeners
		if (process.env.OTEL_BUN === "true") {
			this.tracer = trace.getTracer("bunkv");
		}
		this.init();
	}

	private init() {
		this.db.run(SQL.CREATE_TABLE);

		const runMigration = (sql: string) => {
			try {
				this.db.run(sql);
			} catch (error: unknown) {
				// Ignore if column already exists
				if (
					error instanceof Error &&
					error.message.includes("duplicate column name")
				) {
					return;
				}
				throw error;
			}
		};

		runMigration(SQL.MIGRATE_ADD_VERSION);
		runMigration(SQL.MIGRATE_ADD_DATE_CREATED);
		runMigration(SQL.MIGRATE_ADD_DATE_UPDATED);
		runMigration(SQL.MIGRATE_ADD_DATE_EXPIRED);
	}

	/**
	 * Retrieve a value from the store.
	 * @param key The key to retrieve
	 * @returns An object containing the key, value, and versionstamp. Value is null if not found.
	 */
	async get<T = unknown>(key: KvKey): Promise<KvEntryMaybe<T>> {
		return this.trace("get", async (span) => {
			span?.setAttribute("db.key", JSON.stringify(key));
			const pk = encodeKey(key);
			const now = Date.now();
			// Try selecting 'version', fallback to 'versionstamp' if that column is stuck in old schemas (not handling full migration here)
			// We expect 'version' to be the truth.
			const stmt = this.db.prepare(SQL.SELECT_GET);
			const result = stmt.get(pk) as {
				value_json: string;
				version: string;
				date_expired: number | null;
			} | null;

			if (!result) {
				return { key, value: null, version: null };
			}

			if (result.date_expired !== null && result.date_expired < now) {
				// Lazily delete expired? Or just return null.
				// Deno KV sometimes lazily deletes. For now just return null.
				this.delete(key); // Lazy cleanup
				return { key, value: null, version: null };
			}

			return {
				key,
				value: JSON.parse(result.value_json),
				version: result.version,
			};
		});
	}

	/**
	 * Set a value in the store.
	 * @param key The key to set
	 * @param value The value to store
	 * @param options Optional settings like expiration (TTL)
	 */
	async set(
		key: KvKey,
		value: unknown,
		options?: KvSetOptions,
	): Promise<KvCommitResult> {
		return this.trace("set", async (span) => {
			span?.setAttribute("db.key", JSON.stringify(key));
			const pk = encodeKey(key);
			const keyJson = JSON.stringify(key);
			const valueJson = JSON.stringify(value);
			const version = ulid();

			const now = Date.now();
			const dateExpired = options?.expireIn ? now + options.expireIn : null;

			const stmt = this.db.prepare(SQL.UPSERT);

			stmt.run({
				$pk: pk,
				$key_json: keyJson,
				$value_json: valueJson,
				$version: version,
				$now: now,
				$date_expired: dateExpired,
			});

			this.events.emit("change", [key]);
			return { ok: true, version };
		});
	}

	/**
	 * Delete a value from the store.
	 * @param key The key to delete
	 */
	async delete(key: KvKey): Promise<void> {
		return this.trace("delete", async (span) => {
			span?.setAttribute("db.key", JSON.stringify(key));
			const pk = encodeKey(key);
			this.db.run(SQL.DELETE, [pk]);
			this.events.emit("change", [key]);
		});
	}

	/**
	 * List keys and values in the store.
	 * @param selector Selection criteria (prefix, range)
	 * @param options List options (limit, reverse)
	 */
	list<T = unknown>(
		selector: KvListSelector,
		options: KvListOptions = {},
	): AsyncIterableIterator<KvEntry<T>> {
		const now = Date.now();
		// We clean up expired items during iteration or filter them out in SQL?
		// Filtering in SQL is better for limit count.

		let sql = SQL.SELECT_LIST_BASE;
		const params: (string | number | Uint8Array)[] = [];
		const conditions: string[] = [
			`(date_expired IS NULL OR date_expired >= ${now})`,
		];

		// Constraints
		if (selector.prefix) {
			const start = encodeKey(selector.prefix);
			const end = this.incrementBytes(start);
			conditions.push("pk >= ?");
			conditions.push("pk < ?");
			params.push(start);
			params.push(end);
		}

		// Explicit start/end override prefix if needed, or refine it.
		// Deno KV logic: start/end take precedence or refine prefix?
		// "The selector must be one of..." usually implies mutual exclusivity or structural.
		// Deno KV 'list' takes { prefix } OR { start, end }.
		// If both, behavior needs checking. Usually prefix is sugar for a range.
		if (selector.start) {
			// Overrides prefix start if greater? logic is complex.
			// Simple impl: if start is present, use it as lower bound.
			// Warning: This implementation is simplified.
			const startBytes = encodeKey(selector.start);
			conditions.push(`pk >= ?`);
			params.push(startBytes);
		}
		if (selector.end) {
			const endBytes = encodeKey(selector.end);
			conditions.push(`pk < ?`);
			params.push(endBytes);
		}

		if (conditions.length > 0) {
			sql += ` WHERE ${conditions.join(" AND ")}`;
		}

		sql += options.reverse ? " ORDER BY pk DESC" : " ORDER BY pk ASC";

		if (options.limit) {
			sql += " LIMIT ?";
			params.push(options.limit);
		}

		const stmt = this.db.prepare(sql);
		// bun-sqlite .all() returns everything. iterator() is better.
		// But bun:sqlite might not support async iterator natively on stmt?
		// It has `iterate()`.
		const iterator = stmt.iterate(...params);

		// Create async generator
		async function* gen() {
			for (const row of iterator) {
				const r = row as {
					key_json: string;
					value_json: string;
					version: string;
					date_expired: number | null;
				};
				// Double check expiry (though SQL SHOULD handle it)
				if (r.date_expired !== null && r.date_expired < now) {
					// Should not happen with SQL filter, but race condition possible?
					// Also lazy delete?
					// Technically with SQL filter we just don't see it.
					continue;
				}

				yield {
					key: JSON.parse(r.key_json) as KvKey,
					value: JSON.parse(r.value_json) as T,
					version: r.version,
				};
			}
		}

		return gen();
	}

	/**
	 * Watch for changes on specific keys.
	 * @param keys List of keys to watch
	 * @returns A ReadableStream that emits the new values when changes occur
	 */
	watch<T = unknown>(keys: KvKey[]): ReadableStream<KvEntryMaybe<T>[]> {
		const self = this;
		let listener: ((changedKeys: KvKey[]) => Promise<void>) | undefined;

		return new ReadableStream({
			async start(controller) {
				// Emit initial values
				const initial: KvEntryMaybe<T>[] = [];
				for (const key of keys) {
					initial.push(await self.get(key));
				}
				controller.enqueue(initial);

				listener = async (changedKeys: KvKey[]) => {
					// Check if any of the changed keys match our watched keys
					// Simple JSON.stringify comparison for now.
					let relevant = false;
					const watchedSet = new Set(keys.map((k) => JSON.stringify(k)));

					for (const k of changedKeys) {
						if (watchedSet.has(JSON.stringify(k))) {
							relevant = true;
							break;
						}
					}

					if (relevant) {
						const updates: KvEntryMaybe<T>[] = [];
						for (const key of keys) {
							updates.push(await self.get(key));
						}
						controller.enqueue(updates);
					}
				};

				self.events.on("change", listener);
			},
			cancel() {
				if (listener) {
					self.events.off("change", listener);
				}
			},
		});
	}

	/**
	 * Close the database connection.
	 */
	async close() {
		this.db.close();
		this.events.removeAllListeners();
	}

	// Minimal Atomic Stub
	/**
	 * Begin an atomic transaction.
	 * Allows multiple operations (check, set, delete) to be committed together.
	 */
	atomic() {
		const self = this;
		interface AtomicCheck {
			key: KvKey;
			version: string | null;
		}
		interface AtomicOp {
			type: "set" | "delete";
			key: KvKey;
			value?: unknown;
			options?: KvSetOptions;
		}

		const checks: AtomicCheck[] = [];
		const ops: AtomicOp[] = [];
		return {
			check(key: KvKey, version: string | null) {
				checks.push({ key, version });
				return this;
			},
			set(key: KvKey, value: unknown, options?: KvSetOptions) {
				ops.push({ type: "set", key, value, options });
				return this;
			},
			delete(key: KvKey) {
				ops.push({ type: "delete", key });
				return this;
			},
			async commit(): Promise<KvCommitResult> {
				return self.trace("atomic_commit", async (span) => {
					span?.setAttribute("db.operation_count", ops.length);
					// Transaction
					const transaction = self.db.transaction(() => {
						const now = Date.now();
						// 1. Checks
						for (const check of checks) {
							const pk = encodeKey(check.key);
							const existing = self.db
								.prepare(SQL.SELECT_META_CHECK)
								.get(pk) as {
								version: string;
								date_expired: number | null;
							} | null;

							// Handle expiration in check
							let effectiveVersion = existing?.version;
							if (existing?.date_expired && existing.date_expired < now) {
								effectiveVersion = undefined; // Expired = Missing roughly
							}
							// Check
							if (check.version === null) {
								if (effectiveVersion)
									throw new Error(KvErrors.ERROR_CHECK_FAILED_KEY_EXISTS);
							} else {
								if (!effectiveVersion || effectiveVersion !== check.version) {
									throw new Error(KvErrors.ERROR_CHECK_FAILED_VERSION_MISMATCH);
								}
							}
						}

						// 2. Ops
						const newVersion = ulid();
						const changedKeys: KvKey[] = [];

						for (const op of ops) {
							if (op.type === "set") {
								const pk = encodeKey(op.key);
								const dateExpired = op.options?.expireIn
									? now + op.options.expireIn
									: null;

								self.db.prepare(SQL.UPSERT).run({
									$pk: pk,
									$key_json: JSON.stringify(op.key),
									$value_json: JSON.stringify(op.value),
									$version: newVersion,
									$now: now,
									$date_expired: dateExpired,
								});
								changedKeys.push(op.key);
							} else if (op.type === "delete") {
								const pk = encodeKey(op.key);
								self.db.prepare(SQL.DELETE).run(pk);
								changedKeys.push(op.key);
							}
						}
						return { newVersion, changedKeys };
					});

					try {
						const res = transaction();
						// Emit changes after commit
						if (res.changedKeys.length > 0) {
							self.events.emit("change", res.changedKeys);
						}
						return { ok: true, version: res.newVersion };
					} catch (_e) {
						return { ok: false };
					}
				});
			},
		};
	}

	/**
	 * Increments a Uint8Array lexicographically.
	 * This function treats the byte array as a number and increments it,
	 * handling carries and overflow by extending the array.
	 *
	 * @param bytes The Uint8Array to increment. This array will not be mutated.
	 * @returns A new Uint8Array representing the incremented bytes.
	 */

	private incrementBytes(bytes: Uint8Array): Uint8Array {
		// Copy to avoid mutating input
		const res = new Uint8Array(bytes);
		// Increment starting from end
		for (let i = res.length - 1; i >= 0; i--) {
			const byte = res[i];
			if (byte === undefined) continue;
			if (byte < 0xff) {
				res[i] = byte + 1;
				return res;
			}
			res[i] = 0;
		}
		// Overflow (e.g. [255, 255])
		return new Uint8Array([...res, 0]);
	}

	private async trace<R>(
		name: string,
		fn: (span: Span | null) => Promise<R>,
	): Promise<R> {
		if (!this.tracer) return fn(null);
		return this.tracer.startActiveSpan(`bunkv.${name}`, async (span) => {
			try {
				const res = await fn(span);
				return res;
			} catch (e: unknown) {
				if (e instanceof Error) span.recordException(e);
				span.setStatus({ code: 2 }); // Error
				throw e;
			} finally {
				span.end();
			}
		});
	}
}
