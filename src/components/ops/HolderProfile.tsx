import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Building2, Pencil, FileDown, ChevronLeft, MapPin } from "lucide-react";
import { useHolder, HOLDER_TYPE_LABELS } from "@/hooks/useHolders";
import { useHolderLinks } from "@/hooks/useHolderLinks";
import { useHolderFiles } from "@/hooks/useHolderFiles";
import { supabase } from "@/integrations/supabase/client";
import { HolderFilesPanel } from "./HolderFilesPanel";
import { HolderLinksPanel } from "./HolderLinksPanel";
import { HolderEditDialog } from "./HolderEditDialog";
import { CollapsibleSection } from "./CollapsibleSection";
import { generateHolderProfilePdf } from "@/lib/pdf/holder-profile";
import { toast } from "sonner";

type HolderConcession = {
  id: string;
  code: string;
  name: string;
  status: string;
  area_ha: number | null;
  expires_at: string | null;
};

export function HolderProfile({
  holderId,
  projectId,
  projectName,
  userId,
}: {
  holderId: string;
  projectId: string;
  projectName: string;
  userId: string;
}) {
  const { data: holder, loading, refresh } = useHolder(holderId);
  const links = useHolderLinks(holderId);
  const files = useHolderFiles(holderId);
  const [concessions, setConcessions] = useState<HolderConcession[]>([]);
  const [editing, setEditing] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let cancel = false;
    void (async () => {
      const { data } = await supabase
        .from("mining_concessions")
        .select("id,code,name,status,area_ha,expires_at")
        .eq("holder_id", holderId)
        .order("expires_at", { ascending: true, nullsFirst: false });
      if (!cancel) setConcessions((data ?? []) as HolderConcession[]);
    })();
    return () => {
      cancel = true;
    };
  }, [holderId]);

  if (loading) return <div className="p-6 text-text-secondary text-sm">Cargando perfil…</div>;
  if (!holder) return <div className="p-6 text-text-secondary text-sm">Titular no encontrado.</div>;

  const onExport = async () => {
    setExporting(true);
    try {
      await generateHolderProfilePdf({
        projectId,
        projectName,
        holderName: holder.name,
        holderRut: holder.rut,
      });
      toast.success("PDF generado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al exportar");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="border border-border rounded p-4 bg-bg-secondary/30">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <Link
              to="/catastro/mapa"
              className="p-1.5 rounded border border-border hover:bg-accent shrink-0"
              title="Volver"
            >
              <ChevronLeft className="w-4 h-4" />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-text-secondary" />
                <span className="font-mono text-[10px] uppercase tracking-wider text-text-secondary">
                  HOLDER
                </span>
              </div>
              <h1 className="font-semibold text-lg truncate mt-0.5">{holder.name}</h1>
              <div className="text-xs text-text-secondary mt-0.5">
                RUT <span className="font-mono">{holder.rut ?? "—"}</span>
                {" · "}
                {HOLDER_TYPE_LABELS[holder.holder_type] ?? holder.holder_type}
                {holder.incorporation_date && <> · const. {holder.incorporation_date}</>}
              </div>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded border border-border hover:bg-accent active:scale-95 transition-transform"
              aria-label="Editar"
            >
              <Pencil className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Editar</span>
            </button>
            <button
              onClick={onExport}
              disabled={exporting}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded bg-primary text-primary-foreground disabled:opacity-50 active:scale-95 transition-transform"
              aria-label="Exportar PDF"
            >
              <FileDown className="w-3.5 h-3.5" />{" "}
              <span className="hidden sm:inline">{exporting ? "Generando…" : "PDF"}</span>
            </button>
          </div>
        </div>

        {/* Identity grid — collapsible on mobile */}
        <CollapsibleSection title="Más datos" mobileOnly className="mt-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-xs">
            {holder.legal_repr_name && (
              <div>
                <span className="text-text-secondary">Repr. legal:</span> {holder.legal_repr_name}{" "}
                <span className="font-mono text-text-secondary">{holder.legal_repr_rut ?? ""}</span>
              </div>
            )}
            {holder.economic_activity && (
              <div>
                <span className="text-text-secondary">Giro:</span> {holder.economic_activity}
              </div>
            )}
            {(holder.region || holder.commune) && (
              <div>
                <span className="text-text-secondary">Domicilio:</span>{" "}
                {[holder.address, holder.commune, holder.region].filter(Boolean).join(", ")}
              </div>
            )}
            {holder.email && (
              <div>
                <span className="text-text-secondary">Email:</span>{" "}
                <a href={`mailto:${holder.email}`} className="hover:underline">
                  {holder.email}
                </a>
              </div>
            )}
            {holder.phone && (
              <div>
                <span className="text-text-secondary">Tel:</span> {holder.phone}
              </div>
            )}
            {holder.website && (
              <div>
                <span className="text-text-secondary">Web:</span>{" "}
                <a
                  href={holder.website}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:underline"
                >
                  {holder.website}
                </a>
              </div>
            )}
          </div>
          {holder.notes && (
            <div className="mt-2 text-xs text-text-secondary border-l-2 border-border pl-2">
              {holder.notes}
            </div>
          )}
        </CollapsibleSection>

        {/* Quick counts — 2 cols on mobile, 4 on desktop */}
        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
          <Stat label="Concesiones" value={concessions.length} />
          <Stat label="Boletín" value={links.data.bulletins.length} />
          <Stat label="PJUD" value={links.data.cases.length} />
          <Stat label="Archivos" value={files.data.length} />
        </div>
      </div>

      {/* Concessions */}
      <div className="border border-border rounded">
        <div className="px-3 py-2 border-b border-border bg-bg-secondary/40 font-mono text-[11px] uppercase tracking-wider text-text-secondary">
          Concesiones del titular ({concessions.length})
        </div>
        {concessions.length === 0 ? (
          <div className="p-3 text-xs text-text-secondary text-center">
            Sin concesiones vinculadas.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {concessions.map((c) => (
              <div key={c.id} className="px-3 py-1.5 text-xs flex items-center gap-2">
                <MapPin className="w-3 h-3 text-text-secondary shrink-0" />
                <span className="font-mono font-semibold w-24 shrink-0">{c.code}</span>
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
                <span className="text-text-secondary text-[10px] hidden sm:inline">
                  {c.area_ha ?? "—"} ha
                </span>
                <span className="text-text-secondary text-[10px]">{c.status}</span>
                <span className="font-mono text-[10px] text-text-secondary">
                  {c.expires_at ?? "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Links */}
      <HolderLinksPanel holderId={holderId} projectId={projectId} userId={userId} />

      {/* Files */}
      <HolderFilesPanel holderId={holderId} projectId={projectId} userId={userId} />

      {editing && (
        <HolderEditDialog
          holder={holder}
          projectId={projectId}
          userId={userId}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-border rounded px-2 py-1.5 bg-background">
      <div className="text-[10px] uppercase tracking-wider text-text-secondary">{label}</div>
      <div className="font-mono text-2xl md:text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
