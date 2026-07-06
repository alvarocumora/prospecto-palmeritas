import { createFileRoute } from "@tanstack/react-router";
import { MetalPricesPanel } from "@/components/prices/MetalPricesPanel";

export const Route = createFileRoute("/_authenticated/dashboard/precios")({
  head: () => ({ meta: [{ title: "Precios de metales — Geocapitals" }] }),
  component: MetalPricesPanel,
});
