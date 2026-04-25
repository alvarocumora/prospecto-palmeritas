export function fmtUSD(v: number | null): string {
  if (v == null) return "A consultar";
  if (v >= 1_000_000) return `US$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `US$ ${(v / 1_000).toFixed(0)}k`;
  return `US$ ${v.toFixed(0)}`;
}
