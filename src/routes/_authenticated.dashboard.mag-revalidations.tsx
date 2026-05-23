import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, RefreshCw, History, ChevronRight } from "lucide-react";
import {
  revalidateMagTargets,
  listMagRevalidations,
  getMagRevalidationDiffs,
} from "@/lib/magRevalidation.functions";
import { toast } from "sonner";

export const Route = createFileRoute(
  "/_authenticated/dashboard/mag-revalidations",
)({
  component: MagRevalidationsPage,
});

function MagRevalidationsPage() {
  const qc = useQueryClient();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);

  const projectsQ = useQuery({
    queryKey: ["projects-list-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id,name")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const listFn = useServerFn(listMagRevalidations);
  const runsQ = useQuery({
    queryKey: ["mag-revalidations", projectId],
    queryFn: () => listFn({ data: { projectId: projectId!, limit: 30 } }),
    enabled: !!projectId,
  });

  const diffsFn = useServerFn(getMagRevalidationDiffs);
  const diffsQ = useQuery({
    queryKey: ["mag-revalidation-diffs", selectedRun],
    queryFn: () => diffsFn({ data: { revalidationId: selectedRun! } }),
    enabled: !!selectedRun,
  });

  const revalidateFn = useServerFn(revalidateMagTargets);
  const revalidate = useMutation({
    mutationFn: () =>
      revalidateFn({
        data: { projectId: projectId!, triggeredBy: "manual" },
      }),
    onSuccess: (res) => {
      toast.success(
        `Re-validación lista: ${res.summary.added} +, ${res.summary.removed} -, ${res.summary.moved} movidos`,
      );
      qc.invalidateQueries({ queryKey: ["mag-revalidations", projectId] });
      setSelectedRun(res.revalidationId);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <History className="size-6" />
            Re-validación de targets magnéticos
          </h1>
          <p className="text-muted-foreground text-sm">
            Re-consulta EMAG2v3 (NOAA NCEI) y compara con la corrida anterior.
          </p>
        </div>
        <Button
          onClick={() => revalidate.mutate()}
          disabled={!projectId || revalidate.isPending}
        >
          {revalidate.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          Re-validar ahora
        </Button>
      </div>

      <Card className="p-4">
        <label className="text-sm font-medium block mb-2">Proyecto</label>
        <select
          className="w-full max-w-md border rounded-md p-2 bg-background"
          value={projectId ?? ""}
          onChange={(e) => {
            setProjectId(e.target.value || null);
            setSelectedRun(null);
          }}
        >
          <option value="">— elegir proyecto —</option>
          {(projectsQ.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Card>

      {projectId && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <Card className="p-4 lg:col-span-2">
            <h2 className="font-semibold mb-3">Historial de corridas</h2>
            {runsQ.isLoading && (
              <Loader2 className="size-4 animate-spin" />
            )}
            {runsQ.data?.runs.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Aún no hay corridas. Presiona "Re-validar ahora".
              </p>
            )}
            <div className="space-y-2 max-h-[600px] overflow-auto">
              {(runsQ.data?.runs ?? []).map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedRun(r.id)}
                  className={`w-full text-left p-3 rounded-md border hover:bg-accent transition ${
                    selectedRun === r.id ? "bg-accent border-primary" : ""
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString()}
                    </span>
                    <Badge variant="outline">{r.triggered_by}</Badge>
                  </div>
                  <div className="flex gap-2 flex-wrap text-xs">
                    <Badge variant="secondary">
                      {r.prev_count} → {r.new_count}
                    </Badge>
                    <Badge className="bg-green-600">+{r.added_count}</Badge>
                    <Badge variant="destructive">-{r.removed_count}</Badge>
                    <Badge className="bg-amber-600">
                      ↔ {r.moved_count}
                    </Badge>
                    <Badge className="bg-blue-600">
                      Δ {r.mag_changed_count}
                    </Badge>
                  </div>
                  {r.mean_shift_m != null && (
                    <div className="text-xs text-muted-foreground mt-1">
                      shift μ={r.mean_shift_m.toFixed(0)}m · max=
                      {(r.max_shift_m ?? 0).toFixed(0)}m · ΔnT μ=
                      {(r.mean_mag_delta_nt ?? 0).toFixed(1)}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-4 lg:col-span-3">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <ChevronRight className="size-4" />
              Diferencias de la corrida
            </h2>
            {!selectedRun && (
              <p className="text-sm text-muted-foreground">
                Selecciona una corrida del historial.
              </p>
            )}
            {selectedRun && diffsQ.isLoading && (
              <Loader2 className="size-4 animate-spin" />
            )}
            {selectedRun && diffsQ.data && (
              <div className="overflow-auto max-h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cambio</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Rank</TableHead>
                      <TableHead>Shift (m)</TableHead>
                      <TableHead>Δ nT</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {diffsQ.data.diffs.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell>
                          <ChangeBadge type={d.change_type} />
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {d.name ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {d.prev_rank ?? "—"} → {d.new_rank ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {d.shift_m != null ? d.shift_m.toFixed(0) : "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {d.mag_delta_nt != null
                            ? (d.mag_delta_nt > 0 ? "+" : "") +
                              d.mag_delta_nt.toFixed(1)
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

function ChangeBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    added: { label: "Nuevo", cls: "bg-green-600" },
    removed: { label: "Eliminado", cls: "bg-red-600" },
    moved: { label: "Movido", cls: "bg-amber-600" },
    mag_changed: { label: "Δ nT", cls: "bg-blue-600" },
    unchanged: { label: "Igual", cls: "bg-muted text-foreground" },
  };
  const m = map[type] ?? { label: type, cls: "bg-muted" };
  return <Badge className={m.cls}>{m.label}</Badge>;
}
