// Lógica pura de la firma electrónica de documentos del editor.
// Tokens de un solo documento (solo se persiste su hash), hash canónico del
// snapshot y evidencia de integridad de la firma. Testeable sin IO.

import type { GeneratedDoc } from "./model";

export const SIGN_TOKEN_PREFIX = "gcsign_";

/** Genera el token del link de firma (CSPRNG, 32 bytes → hex). */
export function generateSignToken(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${SIGN_TOKEN_PREFIX}${hex}`;
}

export function isSignTokenFormat(token: string): boolean {
  return new RegExp(`^${SIGN_TOKEN_PREFIX}[0-9a-f]{64}$`).test(token);
}

/** Prefijo para display: "gcsign_ab12cd…". */
export function signTokenPrefix(token: string): string {
  return token.slice(0, SIGN_TOKEN_PREFIX.length + 6);
}

/** SHA-256 hex (Web Crypto). */
export async function sha256Hex(message: string): Promise<string> {
  const buf = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(message));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Stringify determinista (claves ordenadas) para hashear el documento. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

/** Hash canónico del snapshot del documento (congelado al solicitar firma). */
export async function docHash(doc: GeneratedDoc): Promise<string> {
  return sha256Hex(stableStringify(doc));
}

/** Evidencia de integridad: liga documento, firmante, momento y token. */
export async function buildSignatureHash(input: {
  docHash: string;
  signerName: string;
  signedAtIso: string;
  tokenHash: string;
}): Promise<string> {
  return sha256Hex(
    `${input.docHash}|${input.signerName.trim()}|${input.signedAtIso}|${input.tokenHash}`,
  );
}

export type SignRequestStatus = "pending" | "signed" | "void";

/** ¿Se puede firmar esta solicitud ahora? */
export function canSign(
  status: SignRequestStatus,
  expiresAtIso: string | null,
  now: Date,
): { ok: boolean; error?: string } {
  if (status === "signed") return { ok: false, error: "El documento ya fue firmado." };
  if (status === "void") return { ok: false, error: "La solicitud de firma fue anulada." };
  if (expiresAtIso && new Date(expiresAtIso).getTime() < now.getTime()) {
    return { ok: false, error: "El link de firma expiró. Solicita uno nuevo." };
  }
  return { ok: true };
}
