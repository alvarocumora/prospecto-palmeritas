import type { ExpiryStatus } from "@/types/miningConcessions";

export function daysUntilExpiry(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  const exp = new Date(expiresAt).getTime();
  const now = Date.now();
  return Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
}

export function expiryStatus(expiresAt: string | null): ExpiryStatus {
  const d = daysUntilExpiry(expiresAt);
  if (d === null) return "none";
  if (d < 0) return "expired";
  if (d < 30) return "critical";
  if (d < 90) return "warning";
  return "ok";
}

export const EXPIRY_COLORS: Record<ExpiryStatus, string> = {
  expired: "#dc2626",
  critical: "#ea580c",
  warning: "#f59e0b",
  ok: "#0d9488",
  none: "#6b7280",
};

export const EXPIRY_LABELS: Record<ExpiryStatus, string> = {
  expired: "Vencida",
  critical: "Crítico (<30d)",
  warning: "Por vencer (<90d)",
  ok: "Vigente",
  none: "Sin fecha",
};
