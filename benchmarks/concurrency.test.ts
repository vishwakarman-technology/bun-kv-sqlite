import { describe, beforeAll, afterAll, test } from "bun:test";
import { type BunKV, openKv } from "../src/index";
import { stat, unlink } from "node:fs/promises";

const DB_PATH = "./tests/data/test_concurrency.sqlite";

describe("Concurrency & Performance", () => {
	let kv: BunKV;
	const CONCURRENCY_LIMIT = 10000;

	beforeAll(async () => {
		kv = await openKv(DB_PATH);
		console.log(`\n[Setup] Opened KV at ${DB_PATH}`);
	});

	afterAll(async () => {
		try {
			const stats = await stat(DB_PATH);
			console.log(
				`[Teardown] Database size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`,
			);
			await unlink(DB_PATH);
			console.log(`[Teardown] Removed ${DB_PATH}\n`);
		} catch (cause) {
			console.error(`[Teardown] Failed to remove ${DB_PATH}\n`, { cause });
		}
		await kv.close();
	});

	test(`concurrent writes (${CONCURRENCY_LIMIT} ops)`, async () => {
		const start = performance.now();
		const promises = [];
		for (let i = 0; i < CONCURRENCY_LIMIT; i++) {
			promises.push(kv.set(["perf", i], { value: i }));
		}

		await Promise.all(promises);

		const end = performance.now();
		const duration = end - start;
		const opsPerSec = (CONCURRENCY_LIMIT / duration) * 1000;

		console.log(`\n--- Write Performance ---`);
		console.log(`Total Writes: ${CONCURRENCY_LIMIT}`);
		console.log(`Duration: ${duration.toFixed(2)}ms`);
		console.log(`Throughput: ${opsPerSec.toFixed(2)} ops/sec`);
		console.log(`-------------------------\n`);
	});

	test(`concurrent reads (${CONCURRENCY_LIMIT} ops)`, async () => {
		// Pre-fill if not already done by previous test, but previous test did it.

		const start = performance.now();

		const promises = [];
		for (let i = 0; i < CONCURRENCY_LIMIT; i++) {
			promises.push(kv.get(["perf", i]));
		}

		await Promise.all(promises);

		const end = performance.now();
		const duration = end - start;
		const opsPerSec = (CONCURRENCY_LIMIT / duration) * 1000;

		console.log(`\n--- Read Performance ---`);
		console.log(`Total Reads: ${CONCURRENCY_LIMIT}`);
		console.log(`Duration: ${duration.toFixed(2)}ms`);
		console.log(`Throughput: ${opsPerSec.toFixed(2)} ops/sec`);
		console.log(`------------------------\n`);
	});

	test(`concurrent operations (mixed read/write)`, async () => {
		const count = 5000;
		const start = performance.now();

		const promises = [];
		for (let i = 0; i < count; i++) {
			// Write
			promises.push(kv.set(["mixed", i], i));
			// Read (maybe same, maybe different)
			promises.push(kv.get(["mixed", i])); // Note: might get null if write hasn't happened yet in queue order
		}

		await Promise.all(promises);

		const end = performance.now();
		const duration = end - start;
		const opsPerSec = ((count * 2) / duration) * 1000;

		console.log(`\n--- Mixed Performance ---`);
		console.log(`Total Ops: ${count * 2}`);
		console.log(`Duration: ${duration.toFixed(2)}ms`);
		console.log(`Throughput: ${opsPerSec.toFixed(2)} ops/sec`);
		console.log(`-------------------------\n`);
	});
});
