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

// Golden vectors. The HeritageB backend ships a self-contained port of canonicalize/reportHash/
// vinHash (backend/src/peaq_anchor.ts) and pins the same values in its own tests — if either
// side drifts, verify-by-VIN stops matching what was anchored on-chain.
test("golden vectors (must match the backend port byte-for-byte)", () => {
  const r = {
    vin: " sjnfaaj11u1234567 ", odometerKm: 142000, recordedAt: "2026-09-01T16:50:00Z", health: 72,
    dtcCodes: ["p0301", "C0300"], tamperFlags: ["Codes_Cleared"],
  };
  assert.equal(
    canonicalize(r),
    '{"vin":"SJNFAAJ11U1234567","odometerKm":142000,"recordedAt":"2026-09-01T16:50:00Z","health":72,"dtcCodes":["C0300","P0301"],"tamperFlags":["codes_cleared"]}',
  );
  assert.equal(reportHash(r), "0xb8cacb4092f5bbe38184e2437f281b590820dcdae61782cf0a43f9a46ba73e1c");
  assert.equal(vinHash("SJNFAAJ11U1234567"), "0xcdccdfba88bdfccd8d12338f0754446c63aab754a1e4ee691d12feb7fee26674");
  const minimal = { vin: "WVGZZZ1TZJ9000001", recordedAt: "2026-10-01T00:00:00.000Z" };
  assert.equal(reportHash(minimal), "0x22a7adc631cc61951b1b1e1ba2e76eea543282856716a9f6204423b0da20f59f");
});
