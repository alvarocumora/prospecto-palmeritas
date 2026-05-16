import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProjects } from "@/hooks/useProjects";
import { useAuth } from "@/hooks/useAuth";
import { Layers, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/marketplace")({
  head: () => ({ meta: [{ title: "Marketplace de Capas — Trackmin GeoIntel" }] }),
  component: MarketplacePage,
});

type Layer = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  geometry_geojson: unknown;
  tags: string[] | null;
  downloads_count: number;
};

function MarketplacePage() {
  const { active } = useProjects();
  const { user } = useAuth();
  const [layers, setLayers] = useState<Layer[]>([]);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("shared_layers")
        .select("id,name,description,category,geometry_geojson,tags,downloads_count")
        .eq("is_public", true)
        .order("downloads_count", { ascending: false });
      setLayers((data ?? []) as Layer[]);
      setLoading(false);
    })();
  }, []);

  const install = async (layer: Layer) => {
    if (!active || !user) {
      toast.error("Selecciona un proyecto primero");
      return;
    }
    setInstalling(layer.id);
    const { error } = await supabase.from("geological_features").insert({
      project_id: active.id,
      created_by: user.id,
      feature_code: `MKT-${layer.id.slice(0, 6)}`,
      name: layer.name,
      feature_type: layer.category ?? "shared",
      description: layer.description ?? null,
      geometry_geojson: layer.geometry_geojson,
      source: "marketplace",
    });
    if (error) toast.error(error.message);
    else {
      await supabase
        .from("shared_layers")
        .update({ downloads_count: layer.downloads_count + 1 })
        .eq("id", layer.id);
      toast.success(`"${layer.name}" instalada en ${active.name}`);
    }
    setInstalling(null);
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto pb-20 md:pb-8">
      <header className="mb-6">
        <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">
          Datos compartidos
        </div>
        <h1 className="text-xl md:text-2xl font-bold mt-1">Marketplace de Capas</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Instala capas públicas (geología regional, fallas, hidrografía) en tu proyecto activo.
        </p>
      </header>

      {loading ? (
        <div className="text-sm text-muted-foreground">Cargando capas…</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {layers.map((l) => (
            <div key={l.id} className="rounded border border-border bg-bg-secondary p-4">
              <div className="flex items-start gap-3">
                <Layers className="w-5 h-5 text-gold shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-mono font-semibold text-sm">{l.name}</div>
                  <div className="text-[10px] font-mono uppercase text-muted-foreground mt-0.5">
                    {l.category ?? "—"}
                  </div>
                </div>
              </div>
              {l.description && (
                <p className="mt-2 text-xs text-muted-foreground">{l.description}</p>
              )}
              {l.tags && l.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {l.tags.map((t) => (
                    <span
                      key={t}
                      className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-background border border-border"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[10px] font-mono text-muted-foreground">
                  {l.downloads_count} instalaciones
                </span>
                <button
                  onClick={() => install(l)}
                  disabled={!active || installing === l.id}
                  className="px-2.5 py-1 rounded bg-gold text-bg-secondary text-xs font-mono font-semibold disabled:opacity-50 inline-flex items-center gap-1"
                >
                  {installing === l.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Download className="w-3 h-3" />
                  )}
                  Instalar
                </button>
              </div>
            </div>
          ))}
          {layers.length === 0 && (
            <div className="md:col-span-2 text-center text-xs text-muted-foreground py-8 font-mono">
              No hay capas disponibles aún.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
