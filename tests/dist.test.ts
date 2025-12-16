import { describe, test, expect } from "bun:test";
import { openKv as openKvEsm } from "../dist/index.js";
// @ts-ignore
import { openKv as openKvCjs } from "../dist/index.cjs";

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
