import { createFileRoute } from "@tanstack/react-router";
import { Construction } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/geophysics")({
  head: () => ({ meta: [{ title: "Geofísica — Trackmin GeoIntel" }] }),
  component: () => <ModuleStub title="Geofísica" desc="CRUD de campañas, líneas y estaciones (Mag, IP, CSAMT) — próxima iteración." />,
});

export function ModuleStub({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto pb-20 md:pb-8">
      <h1 className="text-2xl font-bold mb-2">{title}</h1>
      <div className="rounded border border-dashed border-border p-12 text-center mt-6">
        <Construction className="w-8 h-8 text-gold mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">{desc}</p>
        <p className="text-[11px] font-mono text-muted-foreground mt-2">La base multi-tenant ya está lista. Construiremos los CRUD en las próximas iteraciones.</p>
      </div>
    </div>
  );
}
