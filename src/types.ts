/**
 * Represents a part of a KV Key.
 * Supported types: string, number, boolean, bigint, Uint8Array.
 */
export type KvKeyPart = string | number | boolean | bigint | Uint8Array;

/**
 * Represents a hierarchical key as an array of parts.
 * Example: ["users", 123, "profile"]
 */
export type KvKey = KvKeyPart[];

/**
 * Represents a single key-value entry with its versionstamp.
 */
export type KvEntry<T = unknown> = {
	key: KvKey;
	value: T;
	version: string;
};

export type KvEntryMaybe<T = unknown> =
	| KvEntry<T>
	| { key: KvKey; value: null; version: null };

/**
 * Result of an atomic commit.
 */
export type KvCommitResult =
	| {
			ok: true;
			version: string;
	  }
	| {
			ok: false;
	  };

/**
 * Options for listing keys.
 */
export interface KvListSelector {
	prefix?: KvKey;
	start?: KvKey;
	end?: KvKey;
}

/**
 * Options for listing keys.
 */
export interface KvListOptions {
	/** Max number of results to return */
	limit?: number;
	/** Reverse the iteration order */
	reverse?: boolean;
	consistency?: "strong" | "eventual"; // Ignored in sqlite (always strong-ish)
	cursor?: string;
}

/**
 * Options for setting a key.
 */
export interface KvSetOptions {
	/** Expiration time in milliseconds relative to now */
	expireIn?: number;
}
