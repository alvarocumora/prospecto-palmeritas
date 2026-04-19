/** Au-grade color/size scale for sample markers. */
export function auColor(au: number | null | undefined): string {
  if (au == null || au <= 0) return "#64748b"; // slate
  if (au < 0.1) return "#0ea5e9";  // sky
  if (au < 0.5) return "#14b8a6";  // teal
  if (au < 1.0) return "#eab308";  // yellow
  if (au < 5.0) return "#f97316";  // orange
  return "#dc2626";                // red
}

export function auRadius(au: number | null | undefined): number {
  if (au == null || au <= 0) return 4;
  if (au < 0.1) return 5;
  if (au < 0.5) return 6;
  if (au < 1.0) return 8;
  if (au < 5.0) return 10;
  return 13;
}

export const AU_LEGEND: { label: string; color: string }[] = [
  { label: "<0.1 g/t", color: "#0ea5e9" },
  { label: "0.1–0.5", color: "#14b8a6" },
  { label: "0.5–1.0", color: "#eab308" },
  { label: "1.0–5.0", color: "#f97316" },
  { label: "≥5.0 g/t", color: "#dc2626" },
];
