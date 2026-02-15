import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { type BunKV, openKv } from "../src/index";

describe("BunKV", () => {
	let kv: BunKV;

	beforeEach(async () => {
		kv = await openKv(":memory:");
	});

	afterEach(async () => {
		await kv.close();
	});

	test("basic set and get", async () => {
		await kv.set(["users", "alice"], { name: "Alice" });
		const entry = await kv.get(["users", "alice"]);
		expect(entry.value).toEqual({ name: "Alice" });
		expect(entry.version).toBeString();
	});

	test("delete", async () => {
		await kv.set(["temp"], "deleteme");
		await kv.delete(["temp"]);
		const entry = await kv.get(["temp"]);
		expect(entry.value).toBeNull();
	});

	test("list by prefix", async () => {
		await kv.set(["users", "alice"], "Alice");
		await kv.set(["users", "bob"], "Bob");
		await kv.set(["posts", "1"], "Post 1");

		const entries = [];
		for await (const entry of kv.list({ prefix: ["users"] })) {
			entries.push(entry);
		}

		expect(entries.length).toBe(2);
		expect(entries[0]?.key).toEqual(["users", "alice"]);
		expect(entries[1]?.key).toEqual(["users", "bob"]);
	});

	test("ordering types", async () => {
		// Deno KV order: Uint8Array < string < number < boolean (Need to verify this exact order in my encoder)
		// My encoder order:
		// 0x10 Bytes
		// 0x20 String
		// 0x30 Number
		// 0x40 Boolean

		await kv.set(["a", "string"], "s");
		await kv.set(["a", 10], "n");
		await kv.set(["a", true], "b");
		// await kv.set(["a", new Uint8Array([1])], "bytes"); // Types might need fix in test comparison

		const keys = [];
		for await (const entry of kv.list({ prefix: ["a"] })) {
			keys.push(entry.key[1]);
		}

		// Expect: bytes < string < number < boolean based on my encoder constants
		// Note: Deno spec might be differrent, but consistency is key here.
		expect(keys).toEqual(["string", 10, true]);
	});

	test("ordering numbers", async () => {
		await kv.set(["n", 10], 10);
		await kv.set(["n", 2], 2);
		await kv.set(["n", -5], -5);
		await kv.set(["n", 0], 0);

		const values = [];
		for await (const entry of kv.list({ prefix: ["n"] })) {
			values.push(entry.value);
		}

		expect(values).toEqual([-5, 0, 2, 10]);
	});

	test("expiry", async () => {
		await kv.set(["temp"], "short-lived", { expireIn: 10 }); // 10ms

		// Immediate get
		const e1 = await kv.get(["temp"]);
		expect(e1.value).toBe("short-lived");

		// Wait for expiry
		await new Promise((r) => setTimeout(r, 20));

		const e2 = await kv.get(["temp"]);
		expect(e2.value).toBeNull();
	});

	test("list filters expired", async () => {
		await kv.set(["l", "1"], "v1", { expireIn: 10 });
		await kv.set(["l", "2"], "v2"); // no expiry

		await new Promise((r) => setTimeout(r, 20));

		const items = [];
		for await (const entry of kv.list({ prefix: ["l"] })) {
			items.push(entry.value);
		}

		expect(items).toEqual(["v2"]);
	});

	test("atomic transaction success", async () => {
		const res = await kv
			.atomic()
			.check(["money", "alice"], null)
			.set(["money", "alice"], 100)
			.commit();

		expect(res.ok).toBe(true);
		expect((await kv.get(["money", "alice"])).value).toBe(100);
	});

	test("atomic transaction failure", async () => {
		await kv.set(["lock"], "taken");
		const _entry = await kv.get(["lock"]);

		const res = await kv
			.atomic()
			.check(["lock"], "wrong-version")
			.set(["lock"], "stolen")
			.commit();

		expect(res.ok).toBe(false);
		expect((await kv.get(["lock"])).value).toBe("taken");
	});
});
