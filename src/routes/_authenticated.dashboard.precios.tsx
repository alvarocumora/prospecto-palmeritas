import { createFileRoute } from "@tanstack/react-router";
import { MetalPricesPanel } from "@/components/prices/MetalPricesPanel";
import { PriceIndexPanel } from "@/components/prices/PriceIndexPanel";

export const Route = createFileRoute("/_authenticated/dashboard/precios")({
  head: () => ({ meta: [{ title: "Precios de metales — Geocapitals" }] }),
  component: PreciosPage,
});

function PreciosPage() {
  return (
    <div>
      <MetalPricesPanel />
      <div className="border-t border-border">
        <PriceIndexPanel />
      </div>
    </div>
  );
}
