import { BunKV } from "./kv";

/**
 * Opens a persistent or in-memory key-value store.
 *
 * @param path The path to the SQLite database file. Defaults to ':memory:' for in-memory storage.
 * @returns A Promise that resolves to a BunKV instance.
 */
export function openKv(path: string = ":memory:"): Promise<BunKV> {
    // Deno openKv is async
    return Promise.resolve(new BunKV(path));
}

export { BunKV };
