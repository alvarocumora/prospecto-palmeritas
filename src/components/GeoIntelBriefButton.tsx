import { useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import { Sparkles, Loader2, Download, X, MapPin } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { generateGeoBriefPdf, type BriefEvidence } from "@/lib/pdf/geo-brief";

interface Props {
  map: LeafletMap | null;
}

export function GeoIntelBriefButton({ map }: Props) {
  const { active } = useProjects();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [brief, setBrief] = useState<string>("");
  const [evidence, setEvidence] = useState<BriefEvidence | null>(null);

  const generate = async () => {
    if (!active?.id) {
      toast.error("Selecciona un proyecto activo");
      return;
    }
    if (!map) {
      toast.error("Mapa no listo");
      return;
    }
    const c = map.getCenter();
    setLoading(true);
    setOpen(true);
    setBrief("");
    setEvidence(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/geo-brief`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({
          project_id: active.id,
          lat: c.lat,
          lng: c.lng,
          radius_m: 1000,
        }),
      });
      const json = await resp.json();
      if (!resp.ok) {
        toast.error(json.error ?? "Error generando brief");
        setOpen(false);
        return;
      }
      setBrief(json.brief);
      setEvidence(json.evidence);
    } catch (e) {
      console.error(e);
      toast.error("No se pudo generar el brief");
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const downloadPdf = () => {
    if (!brief || !evidence) return;
    try {
      const doc = generateGeoBriefPdf(brief, evidence);
      const slug = (active?.code ?? "brief").toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const ts = new Date().toISOString().slice(0, 10);
      doc.save(`geo-brief-${slug}-${ts}.pdf`);
      toast.success("PDF descargado");
    } catch (e) {
      console.error(e);
      toast.error("Error generando PDF");
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={generate}
        disabled={loading}
        className="absolute top-3 right-28 z-[500] inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-gold/40 bg-bg-secondary/95 backdrop-blur text-foreground hover:bg-gold/10 hover:border-gold disabled:opacity-50 text-[11px] font-mono shadow-md transition-colors"
        title="Generar brief geológico IA del centro del mapa"
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-gold" /> : <Sparkles className="w-3.5 h-3.5 text-gold" />}
        <span className="hidden sm:inline">Geo-Intel Brief</span>
      </button>

      {open && (
        <div className="absolute top-14 right-3 z-[800] w-[min(94vw,440px)] max-h-[75vh] flex flex-col rounded-lg border border-gold/40 bg-bg-secondary shadow-2xl">
          <header className="px-3 py-2 border-b border-border flex items-center gap-2 shrink-0">
            <Sparkles className="w-4 h-4 text-gold" />
            <div className="font-mono text-xs font-semibold flex-1">Geo-Intel Brief</div>
            {evidence && (
              <span className="text-[10px] font-mono text-muted-foreground inline-flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {evidence.point.lat.toFixed(4)}, {evidence.point.lng.toFixed(4)}
              </span>
            )}
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
          </header>

          <div className="flex-1 overflow-y-auto p-3 text-xs font-mono whitespace-pre-wrap text-foreground">
            {loading ? (
              <div className="inline-flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Fusionando capas y consultando IA…
              </div>
            ) : (
              brief || <span className="text-muted-foreground">(sin contenido)</span>
            )}
          </div>

          {brief && evidence && (
            <div className="p-2 border-t border-border flex gap-2 shrink-0">
              <button
                type="button"
                onClick={downloadPdf}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded bg-gold text-bg-secondary text-[11px] font-mono font-semibold hover:opacity-90"
              >
                <Download className="w-3.5 h-3.5" /> Descargar PDF
              </button>
              <button
                type="button"
                onClick={generate}
                className="px-2 py-1.5 rounded border border-border text-foreground text-[11px] font-mono hover:bg-accent"
                title="Regenerar para el centro actual del mapa"
              >
                Re-generar
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
