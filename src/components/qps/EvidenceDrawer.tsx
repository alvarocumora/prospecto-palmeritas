import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Trash2, Link2, FileText, MapPin, FlaskConical, Drill, Image as ImageIcon } from "lucide-react";
import type { EvidenceLink } from "@/hooks/useCompliance";
import { useProjects } from "@/hooks/useProjects";

interface Props {
  reportId: string;
  ruleId: string;
  ruleCode: string;
  ruleTitle: string;
  evidence: EvidenceLink[];
  onAttach: (ruleId: string, type: string, id?: string, url?: string, caption?: string) => Promise<void>;
  onRemove: (linkId: string) => Promise<void>;
  onClose: () => void;
}

type Source = {
  id: string;
  label: string;
  type: "section" | "drill_hole" | "sample" | "target" | "file" | "anomaly";
  meta?: string;
};

const TYPE_ICON: Record<string, typeof FileText> = {
  section: FileText,
  drill_hole: Drill,
  sample: FlaskConical,
  target: MapPin,
  file: ImageIcon,
  anomaly: MapPin,
  url: Link2,
};

export function EvidenceDrawer({ reportId, ruleId, ruleCode, ruleTitle, evidence, onAttach, onRemove, onClose }: Props) {
  const { active } = useProjects();
  const [sources, setSources] = useState<Source[]>([]);
  const [search, setSearch] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [externalCaption, setExternalCaption] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!active?.id) return;
      setLoading(true);
      const [sec, holes, samples, targets, anomalies] = await Promise.all([
        supabase.from("technical_report_sections").select("id, section_no, title").eq("report_id", reportId).order("section_no"),
        supabase.from("drill_holes").select("id, hole_id, status").eq("project_id", active.id).limit(100),
        supabase.from("sampling_results").select("id, sample_code, au_gpt").eq("project_id", active.id).limit(100),
        supabase.from("exploration_targets").select("id, code, name, stage").eq("project_id", active.id).limit(100),
        supabase.from("geophysics_anomalies").select("id, code, severity").eq("project_id", active.id).limit(100),
      ]);
      const out: Source[] = [];
      for (const s of (sec.data ?? [])) out.push({ id: s.id, type: "section", label: `§${s.section_no} ${s.title}` });
      for (const h of (holes.data ?? [])) out.push({ id: h.id, type: "drill_hole", label: h.hole_id, meta: h.status });
      for (const s of (samples.data ?? [])) out.push({ id: s.id, type: "sample", label: s.sample_code, meta: s.au_gpt ? `Au ${s.au_gpt} g/t` : undefined });
      for (const t of (targets.data ?? [])) out.push({ id: t.id, type: "target", label: `${t.code} · ${t.name}`, meta: t.stage });
      for (const a of (anomalies.data ?? [])) out.push({ id: a.id, type: "anomaly", label: a.code, meta: a.severity });
      setSources(out);
      setLoading(false);
    };
    load();
  }, [active?.id, reportId]);

  const filtered = sources.filter((s) => !search || s.label.toLowerCase().includes(search.toLowerCase()));

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-sm">
            <span className="font-mono text-muted-foreground">{ruleCode}</span> · Evidencia
          </SheetTitle>
          <SheetDescription className="text-xs">{ruleTitle}</SheetDescription>
        </SheetHeader>

        {/* Evidencia ya adjuntada */}
        <div className="mt-4 space-y-2">
          <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">Adjuntada ({evidence.length})</div>
          {evidence.length === 0 && (
            <div className="text-xs text-muted-foreground italic">Sin evidencia adjunta.</div>
          )}
          {evidence.map((ev) => {
            const Icon = TYPE_ICON[ev.evidence_type] ?? Link2;
            return (
              <div key={ev.id} className="flex items-center gap-2 px-2 py-1.5 rounded border border-border bg-card text-xs">
                <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                <div className="flex-1 min-w-0 truncate">
                  <span className="font-mono text-[10px] text-muted-foreground">{ev.evidence_type}</span>{" "}
                  <span>{ev.caption ?? ev.url ?? ev.evidence_id?.slice(0, 8)}</span>
                </div>
                <button onClick={() => onRemove(ev.id)} className="text-rose-400 hover:text-rose-300">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        {/* URL externa */}
        <div className="mt-6 space-y-2">
          <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">Adjuntar URL externa</div>
          <Input
            placeholder="https://..."
            value={externalUrl}
            onChange={(e) => setExternalUrl(e.target.value)}
            className="h-8 text-xs"
          />
          <Input
            placeholder="Descripción (opcional)"
            value={externalCaption}
            onChange={(e) => setExternalCaption(e.target.value)}
            className="h-8 text-xs"
          />
          <Button
            size="sm"
            disabled={!externalUrl}
            onClick={async () => {
              await onAttach(ruleId, "url", undefined, externalUrl, externalCaption || undefined);
              setExternalUrl(""); setExternalCaption("");
            }}
          >
            <Link2 className="w-3.5 h-3.5 mr-1.5" /> Adjuntar URL
          </Button>
        </div>

        {/* Buscador de fuentes internas */}
        <div className="mt-6 space-y-2">
          <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">Adjuntar desde proyecto</div>
          <Input
            placeholder="Buscar sección, sondaje, muestra, target…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-xs"
          />
          {loading ? (
            <div className="text-xs text-muted-foreground">Cargando…</div>
          ) : (
            <div className="max-h-[40vh] overflow-y-auto divide-y divide-border rounded border border-border">
              {filtered.slice(0, 50).map((s) => {
                const Icon = TYPE_ICON[s.type];
                return (
                  <button
                    key={`${s.type}-${s.id}`}
                    onClick={() => onAttach(ruleId, s.type, s.id, undefined, s.label)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-muted/50 text-xs text-left"
                  >
                    <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="flex-1 truncate">{s.label}</span>
                    {s.meta && <Badge variant="outline" className="text-[9px] h-4">{s.meta}</Badge>}
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <div className="px-2 py-3 text-xs text-muted-foreground text-center">Sin resultados.</div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
