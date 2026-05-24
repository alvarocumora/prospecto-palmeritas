// Editor de survey shots + recálculo de trayectoria vía mining-engine.
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2, Compass } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { computeHoleTrajectory } from "@/lib/miningEngine.functions";
import type { DrillHole } from "@/hooks/useDrilling";

type Survey = { id: string; depth: number; azimuth: number; dip: number };

export function SurveysDialog({
  hole,
  onClose,
}: {
  hole: DrillHole;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [traj, setTraj] = useState<{ points: number; total_length: number } | null>(null);
  const [draft, setDraft] = useState({ depth: "", azimuth: "", dip: "" });

  const compute = useServerFn(computeHoleTrajectory);

  const refresh = async () => {
    setLoading(true);
    const [{ data: s }, { data: t }] = await Promise.all([
      supabase
        .from("drill_hole_surveys")
        .select("id,depth,azimuth,dip")
        .eq("hole_id", hole.id)
        .order("depth", { ascending: true }),
      supabase
        .from("drill_hole_trajectories")
        .select("points,total_length")
        .eq("hole_id", hole.id)
        .maybeSingle(),
    ]);
    setRows(
      (s ?? []).map((r) => ({
        id: r.id,
        depth: Number(r.depth),
        azimuth: Number(r.azimuth),
        dip: Number(r.dip),
      })),
    );
    if (t) {
      const pts = (t.points as unknown[]) ?? [];
      setTraj({ points: pts.length, total_length: Number(t.total_length) });
    } else {
      setTraj(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hole.id]);

  const addShot = async () => {
    const depth = Number(draft.depth);
    const azimuth = Number(draft.azimuth);
    const dip = Number(draft.dip);
    if (!Number.isFinite(depth) || depth < 0) return toast.error("Depth inválido");
    if (!Number.isFinite(azimuth)) return toast.error("Azimut inválido");
    if (!Number.isFinite(dip)) return toast.error("Dip inválido");
    const { error } = await supabase
      .from("drill_hole_surveys")
      .insert({ hole_id: hole.id, depth, azimuth, dip });
    if (error) return toast.error(error.message);
    setDraft({ depth: "", azimuth: "", dip: "" });
    refresh();
  };

  const removeShot = async (id: string) => {
    const { error } = await supabase.from("drill_hole_surveys").delete().eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  };

  const recompute = async () => {
    setComputing(true);
    try {
      const r = await compute({ data: { holeId: hole.id } });
      toast.success(
        r.synthesized
          ? `Trayectoria recta calculada (${r.points} puntos · ${r.total_length.toFixed(1)} m)`
          : `Desurvey OK: ${r.points} puntos · ${r.total_length.toFixed(1)} m`,
      );
      refresh();
    } catch (e) {
      toast.error(String((e as Error).message ?? e));
    } finally {
      setComputing(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Surveys · <span className="font-mono">{hole.hole_id}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="text-xs text-text-secondary">
          Collar: E {hole.easting ?? "—"} · N {hole.northing ?? "—"} · Z{" "}
          {hole.elevation ?? "—"} · Az {hole.azimuth ?? "—"}° · Dip {hole.dip ?? "—"}°
        </div>

        <div className="border border-border rounded overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-bg-secondary border-b border-border">
              <tr className="text-left">
                <th className="px-2.5 py-1.5 font-medium text-text-secondary uppercase tracking-wider text-[10px]">
                  Depth (m)
                </th>
                <th className="px-2.5 py-1.5 font-medium text-text-secondary uppercase tracking-wider text-[10px]">
                  Azimut (°)
                </th>
                <th className="px-2.5 py-1.5 font-medium text-text-secondary uppercase tracking-wider text-[10px]">
                  Dip (°)
                </th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-2.5 py-3 text-text-secondary text-center">
                    Cargando…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-2.5 py-3 text-text-secondary text-center">
                    Sin shots. Se generará trayectoria recta desde el collar.
                  </td>
                </tr>
              ) : (
                rows.map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-0">
                    <td className="px-2.5 py-1.5 font-mono">{s.depth.toFixed(2)}</td>
                    <td className="px-2.5 py-1.5 font-mono">{s.azimuth.toFixed(1)}</td>
                    <td className="px-2.5 py-1.5 font-mono">{s.dip.toFixed(1)}</td>
                    <td className="px-2.5 py-1.5 text-right">
                      <button
                        onClick={() => removeShot(s.id)}
                        className="p-1 rounded hover:bg-destructive/20 text-destructive"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
              <tr className="bg-bg-secondary/30">
                <td className="px-2 py-1.5">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="depth"
                    className={inp}
                    value={draft.depth}
                    onChange={(e) => setDraft({ ...draft, depth: e.target.value })}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="number"
                    step="0.1"
                    placeholder="azimuth"
                    className={inp}
                    value={draft.azimuth}
                    onChange={(e) => setDraft({ ...draft, azimuth: e.target.value })}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="number"
                    step="0.1"
                    placeholder="dip"
                    className={inp}
                    value={draft.dip}
                    onChange={(e) => setDraft({ ...draft, dip: e.target.value })}
                  />
                </td>
                <td className="px-2.5 py-1.5 text-right">
                  <button
                    onClick={addShot}
                    className="p-1 rounded hover:bg-accent text-primary"
                    title="Agregar shot"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-2 pt-2">
          <div className="text-xs text-text-secondary">
            {traj
              ? `Trayectoria: ${traj.points} pts · ${traj.total_length.toFixed(1)} m`
              : "Sin trayectoria calculada"}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm rounded border border-border hover:bg-accent"
            >
              Cerrar
            </button>
            <button
              onClick={recompute}
              disabled={computing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              <Compass className="w-4 h-4" />
              {computing ? "Calculando…" : "Recalcular trayectoria"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const inp =
  "w-full px-2 py-1 text-xs bg-bg-secondary border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary";
