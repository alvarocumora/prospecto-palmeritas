// VersionSelectorPanel — Sprint 6
// Selector y guardado de versiones de modelo de bloques (persistencia en Cloud).
import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { History, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEngineRole } from "@/engine3d/hooks/useEngineRole";
import {
  listBlockModelVersions,
  saveBlockModelVersion,
  logEngineAudit,
  type BlockModelVersionRow,
} from "@/engine3d/persistence/engineCloud";

type Props = {
  projectId: string;
  activeVersionId: string | null;
  onSelect: (v: BlockModelVersionRow | null) => void;
  buildSnapshot?: () => {
    settings: Record<string, unknown>;
    settingsHash: string;
    inputHash: string;
    resourceSummary: Record<string, unknown>;
    blockCount: number;
  } | null;
};

export function VersionSelectorPanel({ projectId, activeVersionId, onSelect, buildSnapshot }: Props) {
  const qc = useQueryClient();
  const { can } = useEngineRole();
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");

  const q = useQuery({
    queryKey: ["engine-bmv", projectId],
    queryFn: () => listBlockModelVersions(projectId),
    staleTime: 30_000,
    enabled: !!projectId,
  });

  const saveM = useMutation({
    mutationFn: async () => {
      const snap = buildSnapshot?.();
      if (!snap) throw new Error("No hay snapshot del modelo");
      const row = await saveBlockModelVersion({
        projectId,
        versionLabel: label || `v${(q.data?.length ?? 0) + 1}`,
        inputHash: snap.inputHash,
        settingsHash: snap.settingsHash,
        settings: snap.settings,
        resourceSummary: snap.resourceSummary,
        blockCount: snap.blockCount,
        notes: notes || undefined,
      });
      await logEngineAudit({
        projectId,
        action: "block_model_version.saved",
        entityType: "block_model_version",
        entityId: row.id,
        payload: { label: row.version_label, blockCount: row.block_count },
      });
      return row;
    },
    onSuccess: (row) => {
      setLabel("");
      setNotes("");
      qc.invalidateQueries({ queryKey: ["engine-bmv", projectId] });
      onSelect(row);
    },
  });

  const canPersist = can("model.persist");
  const versions = q.data ?? [];

  return (
    <div className="absolute top-12 left-2 z-20 w-[300px] bg-black/85 backdrop-blur border border-border rounded-md p-3 text-xs flex flex-col gap-2">
      <div className="flex items-center gap-2 text-foreground">
        <History className="w-3.5 h-3.5 text-cyan-300" />
        <span className="font-mono uppercase tracking-wider">Versiones de modelo</span>
      </div>
      {q.isLoading && <Loader2 className="w-3 h-3 animate-spin" />}
      <div className="max-h-[180px] overflow-y-auto space-y-1">
        <button
          onClick={() => onSelect(null)}
          className={`w-full text-left px-2 py-1 rounded border ${
            activeVersionId === null
              ? "border-cyan-400/60 bg-cyan-500/10 text-cyan-200"
              : "border-border hover:bg-white/5 text-muted-foreground"
          }`}
        >
          (working draft — no persistido)
        </button>
        {versions.map((v) => (
          <button
            key={v.id}
            onClick={() => onSelect(v)}
            className={`w-full text-left px-2 py-1 rounded border ${
              activeVersionId === v.id
                ? "border-cyan-400/60 bg-cyan-500/10 text-cyan-200"
                : "border-border hover:bg-white/5"
            }`}
          >
            <div className="flex justify-between items-center">
              <span className="font-mono">{v.version_label}</span>
              <span className="text-[9px] text-muted-foreground">
                {v.block_count ?? 0} blk
              </span>
            </div>
            <div className="text-[9px] text-muted-foreground">
              {new Date(v.created_at).toLocaleString()}
            </div>
            {v.notes && <p className="text-[10px] text-muted-foreground mt-0.5">{v.notes}</p>}
          </button>
        ))}
        {!q.isLoading && versions.length === 0 && (
          <p className="text-[10px] text-muted-foreground italic">Sin versiones guardadas.</p>
        )}
      </div>

      {canPersist && (
        <div className="border-t border-border pt-2 space-y-1.5">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Nombre de versión (ej. v1-IDW3)"
            className="h-7 text-xs"
          />
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas (opcional)"
            className="h-7 text-xs"
          />
          <Button
            size="sm"
            disabled={saveM.isPending || !buildSnapshot}
            onClick={() => saveM.mutate()}
            className="w-full h-7 text-xs"
          >
            <Save className="w-3 h-3 mr-1" />
            {saveM.isPending ? "Guardando…" : "Guardar snapshot"}
          </Button>
          {saveM.error && (
            <p className="text-[10px] text-red-400">{(saveM.error as Error).message}</p>
          )}
        </div>
      )}
    </div>
  );
}
