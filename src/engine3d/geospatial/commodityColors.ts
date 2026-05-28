// Colores estándar por commodity para uso consistente en layers.
export const commodityColors = {
  gold: "#ffcc00",
  copper: "#ff6600",
  silver: "#d0d0ff",
  moly: "#00d4ff",
  lithium: "#d46bff",
  zinc: "#a0d8ef",
  lead: "#7a8b99",
  iron: "#9b3b1f",
  nickel: "#9bcf8a",
  cobalt: "#3b6ef5",
} as const;

export type Commodity = keyof typeof commodityColors;

export function colorForCommodity(name?: string | null): string {
  if (!name) return "#ff8800";
  const key = name.toLowerCase() as Commodity;
  return commodityColors[key] ?? "#ff8800";
}
