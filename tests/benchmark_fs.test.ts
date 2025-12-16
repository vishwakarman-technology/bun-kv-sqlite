import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { unlink } from "node:fs/promises";
import { type BunKV, openKv } from "../src/index";

// Configuration
const DB_PATH = "bench.sqlite";
const CONCURRENCY_LIMIT = 2000; // Reduced to prevent timeouts on slower disks
const LARGE_VALUE_SIZE = 10 * 1024 * 1024; // 10MB

describe("Filesystem Benchmark (Real Disk I/O)", () => {
    let kv: BunKV;

    beforeAll(async () => {
        // Ensure clean state
        try {
            await unlink(DB_PATH);
        } catch {
            // Ignore
        }
        kv = await openKv(DB_PATH);
        console.log(`\n[Setup] Opened KV at ${DB_PATH}`);
    });

    afterAll(async () => {
        await kv.close();
        try {
            await unlink(DB_PATH);
        } catch {
            // Ignore
        }
        console.log(`[Teardown] Removed ${DB_PATH}\n`);
    });

    test("fs: concurrent writes", async () => {
        const start = performance.now();
        const promises = [];
        for (let i = 0; i < CONCURRENCY_LIMIT; i++) {
            promises.push(kv.set(["bench", "fs", i], { i }));
        }
        await Promise.all(promises);
        const duration = performance.now() - start;
        const opsPerSec = (CONCURRENCY_LIMIT / duration) * 1000;

        console.log(`\n--- FS Write Performance ---`);
        console.log(`Ops: ${CONCURRENCY_LIMIT}`);
        console.log(`Time: ${duration.toFixed(2)}ms`);
        console.log(`Rate: ${opsPerSec.toFixed(2)} ops/sec`);
        console.log(`----------------------------`);

        // Verify a random one
        const entry = await kv.get(["bench", "fs", CONCURRENCY_LIMIT - 1]);
        expect(entry.value).toEqual({ i: CONCURRENCY_LIMIT - 1 });
    }, 30000);

    test("fs: concurrent reads", async () => {
        const start = performance.now();
        const promises = [];
        for (let i = 0; i < CONCURRENCY_LIMIT; i++) {
            promises.push(kv.get(["bench", "fs", i]));
        }
        await Promise.all(promises);
        const duration = performance.now() - start;
        const opsPerSec = (CONCURRENCY_LIMIT / duration) * 1000;

        console.log(`\n--- FS Read Performance ---`);
        console.log(`Ops: ${CONCURRENCY_LIMIT}`);
        console.log(`Time: ${duration.toFixed(2)}ms`);
        console.log(`Rate: ${opsPerSec.toFixed(2)} ops/sec`);
        console.log(`---------------------------`);
    }, 30000);

    test("fs: large value write/read (10MB)", async () => {
        const largeString = "f".repeat(LARGE_VALUE_SIZE);
        const key = ["bench", "large"];

        const startWrite = performance.now();
        await kv.set(key, largeString);
        const writeTime = performance.now() - startWrite;

        const startRead = performance.now();
        const entry = await kv.get(key);
        const readTime = performance.now() - startRead;

        expect((entry.value as string).length).toBe(LARGE_VALUE_SIZE);

        console.log(`\n--- FS Large Data (10MB) ---`);
        console.log(`Write Time: ${writeTime.toFixed(2)}ms`);
        console.log(`Read Time: ${readTime.toFixed(2)}ms`);
        console.log(`----------------------------\n`);
    });

    test("fs: atomic transaction", async () => {
        const res = await kv.atomic().set(["atomic", 1], 1).set(["atomic", 2], 2).commit();
        expect(res.ok).toBe(true);
        expect((await kv.get(["atomic", 2])).value).toBe(2);
    });
});
