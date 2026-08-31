import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalize, reportHash, vinHash } from "../dist/canonicalize.js";

const base = {
  vin: "SJNFAAJ11U1234567",
  odometerKm: 142000,
  recordedAt: "2026-08-31T16:50:00Z",
  health: 72,
  dtcCodes: ["C0300"],
  tamperFlags: [],
};

test("canonicalize is deterministic regardless of input key/array order", () => {
  const a = canonicalize({ ...base, dtcCodes: ["P0301", "C0300"] });
  const b = canonicalize({ ...base, dtcCodes: ["C0300", "P0301"] });
  assert.equal(a, b, "code order must not change the hash");
});

test("VIN is normalized (trim + uppercase)", () => {
  assert.equal(vinHash("  sjnfaaj11u1234567 "), vinHash("SJNFAAJ11U1234567"));
});

test("different odometer → different hash", () => {
  const h1 = reportHash(base);
  const h2 = reportHash({ ...base, odometerKm: 142001 });
  assert.notEqual(h1, h2, "a changed odometer must change the report hash");
});

test("reportHash is a 32-byte hex string", () => {
  const h = reportHash(base);
  assert.match(h, /^0x[0-9a-f]{64}$/);
});
