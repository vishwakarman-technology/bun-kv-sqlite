import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { type BunKV, openKv } from "../src/index";

describe("BunKV Watch", () => {
    let kv: BunKV;

    beforeEach(async () => {
        kv = await openKv(":memory:");
    });

    afterEach(async () => {
        await kv.close();
    });

    test("watch emits initial value", async () => {
        await kv.set(["config"], "init");

        const stream = kv.watch([["config"]]);
        const reader = stream.getReader();

        const { value, done } = await reader.read();
        expect(done).toBe(false);
        expect(value).toHaveLength(1);
        expect(value[0]!.value).toBe("init");

        reader.cancel();
    });

    test("watch emits updates", async () => {
        await kv.set(["counter"], 0);

        const stream = kv.watch([["counter"]]);
        const reader = stream.getReader();

        // Initial value
        const { value: init } = await reader.read();
        expect(init[0]!.value).toBe(0);

        // Update
        await kv.set(["counter"], 1);

        // Should receive update
        const { value: update } = await reader.read();
        expect(update[0]!.value).toBe(1);

        reader.cancel();
    });

    test("watch filters unrelated updates", async () => {
        await kv.set(["target"], "A");
        await kv.set(["other"], "B");

        const stream = kv.watch([["target"]]);
        const reader = stream.getReader();

        // Initial
        await reader.read();

        // Update unrelated key
        await kv.set(["other"], "C");

        // Update target key
        await kv.set(["target"], "A2");

        // Should only receive the target update (eventual consistency might make this tricky if implementation emits everything, but our implementation filters)
        // Our implementation:
        // events.on('change', (changedKeys) => { if match -> emit current values of watched keys })
        // So unrelated set -> event fires -> irrelevant -> no emit
        // target set -> event fires -> relevant -> emit

        // Wait a bit to ensure unrelated update didn't trigger
        // This is hard to test deterministically without a timeout or counting.
        // We'll just wait for the next read, which MUST be "A2".

        const { value: update } = await reader.read();
        expect(update[0]!.value).toBe("A2");

        reader.cancel();
    });
});
