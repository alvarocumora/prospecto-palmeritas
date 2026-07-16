import { describe, expect, it } from "vitest";
import {
  generateSignToken,
  isSignTokenFormat,
  signTokenPrefix,
  sha256Hex,
  stableStringify,
  docHash,
  buildSignatureHash,
  canSign,
} from "./signing";
import type { GeneratedDoc } from "./model";

const DOC: GeneratedDoc = {
  docType: "nda",
  title: "ACUERDO DE CONFIDENCIALIDAD (NDA)",
  reference: "GC-NDA-20260717-1234",
  date: "2026-07-17",
  blocks: [
    { kind: "paragraph", text: "Entre A y B…" },
    { kind: "signature", parties: ["A", "B"] },
  ],
};

describe("tokens de firma", () => {
  it("genera tokens únicos con formato gcsign_", () => {
    const a = generateSignToken();
    const b = generateSignToken();
    expect(isSignTokenFormat(a)).toBe(true);
    expect(a).not.toBe(b);
    expect(signTokenPrefix(a).startsWith("gcsign_")).toBe(true);
  });
  it("rechaza formatos inválidos", () => {
    expect(isSignTokenFormat("")).toBe(false);
    expect(isSignTokenFormat("gc_live_" + "a".repeat(64))).toBe(false);
    expect(isSignTokenFormat("gcsign_corto")).toBe(false);
  });
});

describe("stableStringify / docHash", () => {
  it("es estable ante el orden de claves", async () => {
    const a = { x: 1, y: { b: 2, a: 3 } };
    const b = { y: { a: 3, b: 2 }, x: 1 };
    expect(stableStringify(a)).toBe(stableStringify(b));
    expect(await sha256Hex(stableStringify(a))).toBe(await sha256Hex(stableStringify(b)));
  });
  it("el hash del documento cambia si cambia el contenido", async () => {
    const h1 = await docHash(DOC);
    const h2 = await docHash({ ...DOC, title: "OTRO TÍTULO" });
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
    expect(h1).not.toBe(h2);
  });
});

describe("buildSignatureHash", () => {
  it("es determinista y sensible a cada componente", async () => {
    const base = {
      docHash: "d".repeat(64),
      signerName: "Álvaro Cumora",
      signedAtIso: "2026-07-17T12:00:00.000Z",
      tokenHash: "t".repeat(64),
    };
    const h1 = await buildSignatureHash(base);
    expect(h1).toBe(await buildSignatureHash({ ...base }));
    expect(h1).not.toBe(await buildSignatureHash({ ...base, signerName: "Otro" }));
    expect(h1).not.toBe(
      await buildSignatureHash({ ...base, signedAtIso: "2026-07-18T12:00:00.000Z" }),
    );
  });
});

describe("canSign", () => {
  const now = new Date("2026-07-17T12:00:00Z");
  it("pendiente y vigente → ok", () => {
    expect(canSign("pending", "2026-08-01T00:00:00Z", now).ok).toBe(true);
  });
  it("firmado, anulado o expirado → error específico", () => {
    expect(canSign("signed", null, now).error).toContain("ya fue firmado");
    expect(canSign("void", null, now).error).toContain("anulada");
    expect(canSign("pending", "2026-07-01T00:00:00Z", now).error).toContain("expiró");
  });
});
