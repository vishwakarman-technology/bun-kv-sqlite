import { describe, expect, test } from "bun:test";
import { encodeKey, type KvKey } from "../src/encoding";

function compare(a: KvKey, b: KvKey) {
    const encA = encodeKey(a);
    const encB = encodeKey(b);
    return Buffer.compare(encA, encB);
}

describe("Key Encoding", () => {
    test("encodes strings", () => {
        const k1 = ["a"];
        const k2 = ["b"];
        const e1 = encodeKey(k1);
        const e2 = encodeKey(k2);
        expect(Buffer.compare(e1, e2)).toBeLessThan(0);
    });

    test("encodes numbers", () => {
        expect(compare([1], [2])).toBeLessThan(0);
        expect(compare([1.5], [1.6])).toBeLessThan(0);
        expect(compare([-10], [10])).toBeLessThan(0);
        expect(compare([-10], [-5])).toBeLessThan(0);
        expect(compare([0], [1])).toBeLessThan(0);
        expect(compare([-Infinity], [Infinity])).toBeLessThan(0);
    });

    test("encodes booleans", () => {
        expect(compare([false], [true])).toBeLessThan(0);
    });

    test("encodes composite keys", () => {
        expect(compare(["a", 1], ["a", 2])).toBeLessThan(0);
        expect(compare(["a", 1], ["b", 1])).toBeLessThan(0);
        expect(compare(["a"], ["a", "b"])).toBeLessThan(0); // This relies on suffix/terminator logic
    });

    test("type ordering", () => {
        // Expected Order: Bytes < String < Number < BigInt < Boolean
        // (This depends on the constants defined in encoding.ts)

        const bytes = [new Uint8Array([1])];
        const str = ["string"];
        const num = [123];
        const big = [123n];
        const bool = [true];

        expect(compare(bytes, str)).toBeLessThan(0);
        expect(compare(str, num)).toBeLessThan(0);
        expect(compare(num, big)).toBeLessThan(0);
        expect(compare(big, bool)).toBeLessThan(0);
    });

    test("encodes bigints", () => {
        expect(compare([1n], [2n])).toBeLessThan(0);
        expect(compare([-10n], [10n])).toBeLessThan(0);
        expect(compare([-10n], [-5n])).toBeLessThan(0);
    });

    test("nested bytes ordering", () => {
        const b1 = [new Uint8Array([10])];
        const b2 = [new Uint8Array([20])];
        expect(compare(b1, b2)).toBeLessThan(0);
    });

    test("null byte escaping in strings", () => {
        // String with null byte should be handled
        // "a\0b"
        const k1 = ["a\0b"];
        const k2 = ["a\0c"];
        expect(compare(k1, k2)).toBeLessThan(0);

        // Ensure "a" < "a\0" (Standard C-string logic says a < a..., wait.)
        // 'a' = 0x61. 'a\0' = 0x61 0x00.
        // If we just append null terminator:
        // 'a' enc -> 61 00
        // 'a\0' enc -> 61 00 FF 00 (if escaped correctly) or similar.
        // So 61 00 < 61 00 FF ... Correct.
        expect(compare(["a"], ["a\0"])).toBeLessThan(0);
    });
});
