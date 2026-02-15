import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, unlinkSync } from "node:fs";
// @ts-expect-error
import { openKv as openKvCjs } from "../dist/index.cjs";
import { openKv as openKvEsm } from "../dist/index.js";

const DB_PATH = "./tests/data/test_dist.sqlite";
describe("Distribution Build Tests", () => {
	beforeAll(() => {
		if (existsSync(DB_PATH)) {
			unlinkSync(DB_PATH);
		}
	});

	afterAll(() => {
		if (existsSync(DB_PATH)) {
			unlinkSync(DB_PATH);
		}
	});
	test("ESM Build (index.js)", async () => {
		const kv = await openKvEsm(":memory:");
		await kv.set(["test"], "esm");
		const entry = await kv.get(["test"]);
		expect(entry?.value).toBe("esm");
		await kv.close();
	});

	test("ESM Build (index.js) with relative db path", async () => {
		const kv = await openKvEsm(DB_PATH);
		await kv.set(["test"], "esm");
		const entry = await kv.get(["test"]);
		expect(entry?.value).toBe("esm");
		await kv.close();
	});

	test("CJS Build (index.cjs)", async () => {
		const kv = await openKvCjs(":memory:");
		await kv.set(["test"], "cjs");
		const entry = await kv.get(["test"]);
		expect(entry?.value).toBe("cjs");
		await kv.close();
	});

	test("CJS Build (index.cjs) with relative db path", async () => {
		const kv = await openKvCjs(DB_PATH);
		await kv.set(["test"], "cjs");
		const entry = await kv.get(["test"]);
		expect(entry?.value).toBe("cjs");
		await kv.close();
	});
});
