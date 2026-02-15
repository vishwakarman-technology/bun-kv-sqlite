import { unlink } from "node:fs/promises";
import { openKv } from "../src/index";

async function runBenchmarks() {
	console.log("Starting benchmarks...");

	const dbPath = "bench.sqlite";
	// cleanup previous run
	try {
		await unlink(dbPath);
	} catch {}

	const kv = await openKv(dbPath);
	const ITERATIONS = 10000;

	console.log(`\nRunning ${ITERATIONS} operations per test...\n`);

	// SET Benchmark
	const startSet = performance.now();
	for (let i = 0; i < ITERATIONS; i++) {
		await kv.set(["bench", String(i)], { value: i, payload: "test-data" });
	}
	const endSet = performance.now();
	const opsPerSecSet = Math.floor(ITERATIONS / ((endSet - startSet) / 1000));
	console.log(
		`SET: ${opsPerSecSet.toLocaleString()} ops/sec (${(endSet - startSet).toFixed(2)}ms)`,
	);

	// GET Benchmark
	const startGet = performance.now();
	for (let i = 0; i < ITERATIONS; i++) {
		await kv.get(["bench", String(i)]);
	}
	const endGet = performance.now();
	const opsPerSecGet = Math.floor(ITERATIONS / ((endGet - startGet) / 1000));
	console.log(
		`GET: ${opsPerSecGet.toLocaleString()} ops/sec (${(endGet - startGet).toFixed(2)}ms)`,
	);

	// DELETE Benchmark
	const startDel = performance.now();
	for (let i = 0; i < ITERATIONS; i++) {
		await kv.delete(["bench", String(i)]);
	}
	const endDel = performance.now();
	const opsPerSecDel = Math.floor(ITERATIONS / ((endDel - startDel) / 1000));
	console.log(
		`DELETE: ${opsPerSecDel.toLocaleString()} ops/sec (${(endDel - startDel).toFixed(2)}ms)`,
	);

	await kv.close();
	try {
		await unlink(dbPath);
	} catch {}
}

runBenchmarks().catch(console.error);
