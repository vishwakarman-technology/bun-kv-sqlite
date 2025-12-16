import { afterAll, beforeAll, describe, test } from "bun:test";
import { stat, unlink } from "node:fs/promises";
import { type BunKV, openKv } from "../src/index";

const DB_PATH = "bench_1m.sqlite";
const TOTAL_USERS = 1_000_000;
const BATCH_SIZE = 1_000;

describe("1 Million Users Benchmark", () => {
    let kv: BunKV;

    beforeAll(async () => {
        try {
            await unlink(DB_PATH);
        } catch {}
        kv = await openKv(DB_PATH);
        console.log(`\n[Setup] Opened KV at ${DB_PATH}`);
    });

    afterAll(async () => {
        await kv.close();
        // We do NOT unlink here so we can measure size, or we measure before unlink?
        // We will measure in the test.
        // Clean up manually or leave it? User asked to "measure the filesize", implies valid file at end.
        // I'll leave it but maybe print instructions or just unlink in teardown after measuring.
        // I'll measure in the test then unlink.
        try {
            await unlink(DB_PATH);
        } catch {}
    });

    test(
        `insert 1,000,000 users (batches of ${BATCH_SIZE})`,
        async () => {
            console.log(`Starting insert of ${TOTAL_USERS} users...`);
            const start = performance.now();

            // We need to do TOTAL_USERS / BATCH_SIZE batches
            const batches = Math.ceil(TOTAL_USERS / BATCH_SIZE);

            for (let b = 0; b < batches; b++) {
                const atomic = kv.atomic();
                const startId = b * BATCH_SIZE;
                const endId = Math.min(startId + BATCH_SIZE, TOTAL_USERS);

                for (let i = startId; i < endId; i++) {
                    const user = {
                        id: `user_${i}`,
                        name: `User Name ${i}`,
                        email: `user${i}@example.com`,
                        roles: ["viewer", "editor"],
                        meta: {
                            logins: i % 100,
                            last_login: Date.now(),
                        },
                    };
                    atomic.set(["users", user.id], user);
                }

                const res = await atomic.commit();
                if (!res.ok) throw new Error("Commit failed");

                if (b % 100 === 0) {
                    process.stdout.write(`\rBatch ${b}/${batches}     `);
                }
            }

            const duration = performance.now() - start;
            console.log(`\n\n--- 1 Million Users Result ---`);
            console.log(`Total Time: ${(duration / 1000).toFixed(2)}s`);
            console.log(`Avg Ops/Sec: ${(TOTAL_USERS / (duration / 1000)).toFixed(0)}`);

            // Measure File Size
            const fileStats = await stat(DB_PATH);
            const sizeMB = fileStats.size / (1024 * 1024);
            console.log(`Database Size: ${sizeMB.toFixed(2)} MB`);
            console.log(`------------------------------\n`);
        },
        120 * 1000,
    ); // 2 minute timeout
});
