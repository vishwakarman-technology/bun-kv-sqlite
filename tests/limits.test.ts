import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { type BunKV, openKv } from "../src/index";

describe("Size Limits", () => {
	let kv: BunKV;

	beforeAll(async () => {
		kv = await openKv(":memory:");
	});

	afterAll(async () => {
		await kv.close();
	});

	test("large key (10KB string)", async () => {
		// Deno KV limit is 2KB. We test 10KB here.
		const longString = "k".repeat(10 * 1024);
		const key = ["large_key", longString];

		await kv.set(key, "value");
		const entry = await kv.get(key);

		expect(entry.value).toBe("value");
		expect(entry.key).toEqual(key);
	});

	test("large value (1MB array)", async () => {
		// Deno KV limit is 64KB. We test 1MB.
		// Use standard array for JSON compatibility in this MVP
		const largeData = new Array(100 * 1024).fill(1); // 100K items (not 1MB bytes, but large JSON)

		const key = ["large_val_array", 1];
		await kv.set(key, largeData);

		const entry = await kv.get(key);
		const val = entry.value as number[];

		expect(val.length).toBe(largeData.length);
		expect(val[0]).toBe(1);
	});

	test("very large value (10MB)", async () => {
		// 10MB Value
		const size = 10 * 1024 * 1024;
		const largeString = "a".repeat(size);
		const key = ["huge_val"];

		await kv.set(key, largeString);

		const entry = await kv.get(key);
		expect((entry.value as string).length).toBe(size);
	});

	test("extremely large value (100MB)", async () => {
		// 100MB Value
		// Warning: This might be slow or hit memory limits on small machines
		const size = 100 * 1024 * 1024;
		const largeString = "z".repeat(size);
		const key = ["massive_val"];

		await kv.set(key, largeString);

		const entry = await kv.get(key);
		expect((entry.value as string).length).toBe(size);
	}, 30000); // Increase timeout
});
