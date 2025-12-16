import { describe, expect, test } from "bun:test";
// @ts-expect-error
import { openKv as openKvCjs } from "../dist/index.cjs";
import { openKv as openKvEsm } from "../dist/index.js";

describe("Distribution Build Tests", () => {
    test("ESM Build (index.js)", async () => {
        const kv = await openKvEsm(":memory:");
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
});
