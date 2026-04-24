import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useResourceModels, type Commodity, type ResourceMethod } from "@/hooks/useResourceModels";
import { useProjectRole, canWrite } from "@/hooks/useProjectRole";
import { useProjects } from "@/hooks/useProjects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Plus, Play, Trash2, Loader2, Layers, Mountain, Gauge, Activity, Box as BoxIcon } from "lucide-react";
import { BlockModel3DViewer } from "@/components/estimation/BlockModel3DViewer";

export const Route = createFileRoute("/_authenticated/dashboard/estimation")({
  head: () => ({
    meta: [
      { title: "Estimación de Recursos | Geocapitals" },
      { name: "description", content: "Motor geoestadístico (IDW + NN) para estimación de recursos minerales conforme NI 43-101 / JORC." },
    ],
  }),
  component: EstimationPage,
});

const COMMODITIES: { v: Commodity; l: string; unit: string }[] = [
  { v: "au", l: "Au (Oro)", unit: "g/t" },
  { v: "ag", l: "Ag (Plata)", unit: "g/t" },
  { v: "cu", l: "Cu (Cobre)", unit: "%" },
  { v: "zn", l: "Zn", unit: "%" },
  { v: "pb", l: "Pb", unit: "%" },
  { v: "mo", l: "Mo", unit: "%" },
  { v: "fe", l: "Fe", unit: "%" },
  { v: "li", l: "Li", unit: "%" },
];

const METHODS: { v: ResourceMethod; l: string; desc: string }[] = [
  { v: "idw", l: "IDW", desc: "Inverse Distance Weighting (potencia 2)" },
  { v: "nn", l: "Nearest Neighbour", desc: "Asigna ley del compósito más cercano" },
  { v: "ok", l: "Ordinary Kriging", desc: "Próximamente · requiere variograma fitteado" },
];

function EstimationPage() {
  const { active } = useProjects();
  const role = useProjectRole();
  const writable = canWrite(role);
  const { models, loading, running, create, remove, estimate } = useResourceModels();
  const [dialog, setDialog] = useState(false);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const viewerModel = useMemo(() => models.find((m) => m.id === viewerId) ?? null, [models, viewerId]);

  if (!active) {
    return <div className="p-8 text-text-dim font-mono text-xs">Selecciona un proyecto activo.</div>;
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-signal-cyan" />
          <div>
            <h1 className="text-base font-mono uppercase tracking-wide">Estimación de Recursos</h1>
            <p className="text-[10px] text-text-dim font-mono">
              Motor geoestadístico · IDW + NN · Compatible NI 43-101 / JORC 2012
            </p>
          </div>
        </div>
        {writable && (
          <Button size="sm" onClick={() => setDialog(true)}>
            <Plus className="w-3 h-3 mr-1" /> Nuevo modelo
          </Button>
        )}
      </div>

      {loading ? (
        <div className="text-text-dim text-xs flex items-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin" /> Cargando…
        </div>
      ) : models.length === 0 ? (
        <div className="border border-border rounded p-8 text-center text-text-dim font-mono text-xs space-y-2">
          <Mountain className="w-8 h-8 mx-auto text-text-dim/50" />
          <div>No hay modelos de recursos.</div>
          {writable && <div className="text-[10px]">Crea uno con "Nuevo modelo" para iniciar la estimación.</div>}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {models.map((m) => (
            <ModelCard
              key={m.id}
              model={m}
              writable={writable}
              running={running === m.id}
              onRun={() => estimate(m.id)}
              onDelete={() => { if (confirm(`Eliminar modelo "${m.name}"?`)) remove(m.id); }}
            />
          ))}
        </div>
      )}

      <CreateDialog
        open={dialog}
        onClose={() => setDialog(false)}
        onSave={async (data) => {
          await create(data);
          setDialog(false);
        }}
      />
    </div>
  );
}

function ModelCard({ model, writable, running, onRun, onDelete }: {
  model: ReturnType<typeof useResourceModels>["models"][number];
  writable: boolean;
  running: boolean;
  onRun: () => void;
  onDelete: () => void;
}) {
  const unit = COMMODITIES.find((c) => c.v === model.commodity)?.unit ?? "";
  const statusColor = {
    draft: "border-border text-text-dim",
    running: "border-signal-amber/50 text-signal-amber",
    complete: "border-signal-cyan/50 text-signal-cyan",
    failed: "border-signal-red/50 text-signal-red",
    archived: "border-border text-text-dim",
  }[model.status];

  const tonnage = model.tonnage_above_cutoff ?? model.tonnage_total ?? 0;
  const tonnageK = tonnage > 1e6 ? `${(tonnage / 1e6).toFixed(2)} Mt` : `${(tonnage / 1e3).toFixed(0)} kt`;

  return (
    <div className="border border-border rounded p-3 bg-card space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-mono text-sm truncate">{model.name}</div>
          <div className="text-[10px] text-text-dim font-mono mt-0.5 flex items-center gap-2 flex-wrap">
            <span className="uppercase">{model.commodity}</span>
            <span>·</span>
            <span className="uppercase">{model.method}</span>
            <span>·</span>
            <span>bloque {model.block_size_x}×{model.block_size_y}×{model.block_size_z} m</span>
          </div>
        </div>
        <Badge variant="outline" className={`text-[9px] ${statusColor}`}>{model.status}</Badge>
      </div>

      {model.status === "complete" && (
        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono pt-2 border-t border-border">
          <Stat icon={<Layers className="w-3 h-3" />} label="Bloques estim." value={`${model.blocks_estimated}/${model.blocks_total}`} />
          <Stat icon={<Activity className="w-3 h-3" />} label="Compósitos" value={String(model.composites_count)} />
          <Stat icon={<Mountain className="w-3 h-3" />} label="Tonelaje" value={tonnageK} />
          <Stat icon={<Gauge className="w-3 h-3" />} label="Ley media" value={`${(model.mean_grade ?? 0).toFixed(model.commodity === "au" || model.commodity === "ag" ? 2 : 3)} ${unit}`} />
          {model.cutoff_grade != null && (
            <div className="col-span-2 text-[9px] text-text-dim">
              Cutoff: {model.cutoff_grade} {unit} · Densidad: {model.density_t_m3} t/m³
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 pt-2 border-t border-border">
        {writable && (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              disabled={running || model.status === "running" || model.method === "ok"}
              onClick={onRun}
            >
              {running ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Play className="w-3 h-3 mr-1" />}
              {model.status === "complete" ? "Re-estimar" : "Estimar"}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs text-signal-red ml-auto" onClick={onDelete}>
              <Trash2 className="w-3 h-3" />
            </Button>
          </>
        )}
        {model.method === "ok" && (
          <span className="text-[9px] text-signal-amber font-mono ml-auto">OK requiere variograma — pendiente</span>
        )}
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-text-dim">{icon}</span>
      <span className="text-text-dim">{label}:</span>
      <b className="text-foreground">{value}</b>
    </div>
  );
}

function CreateDialog({ open, onClose, onSave }: {
  open: boolean;
  onClose: () => void;
  onSave: (data: Parameters<ReturnType<typeof useResourceModels>["create"]>[0]) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [commodity, setCommodity] = useState<Commodity>("au");
  const [method, setMethod] = useState<ResourceMethod>("idw");
  const [searchRadius, setSearchRadius] = useState(50);
  const [blockSize, setBlockSize] = useState(10);
  const [blockZ, setBlockZ] = useState(5);
  const [compositeLength, setCompositeLength] = useState(2);
  const [cutoff, setCutoff] = useState<string>("");
  const [density, setDensity] = useState(2.7);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName(""); setCommodity("au"); setMethod("idw");
    setSearchRadius(50); setBlockSize(10); setBlockZ(5);
    setCompositeLength(2); setCutoff(""); setDensity(2.7);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        commodity,
        method,
        search_radius: searchRadius,
        block_size_x: blockSize,
        block_size_y: blockSize,
        block_size_z: blockZ,
        composite_length: compositeLength,
        cutoff_grade: cutoff ? Number(cutoff) : null,
        density_t_m3: density,
      });
      reset();
    } finally {
      setSaving(false);
    }
  };

  const unit = useMemo(() => COMMODITIES.find((c) => c.v === commodity)?.unit ?? "", [commodity]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm">Nuevo Modelo de Recursos</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label className="text-xs font-mono">Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Veta Norte · Au IDW v1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-mono">Commodity</Label>
              <Select value={commodity} onValueChange={(v) => setCommodity(v as Commodity)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COMMODITIES.map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-mono">Método</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as ResourceMethod)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => (
                    <SelectItem key={m.v} value={m.v} disabled={m.v === "ok"}>
                      {m.l} {m.v === "ok" && "(próximamente)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-[9px] text-text-dim mt-1">{METHODS.find((m) => m.v === method)?.desc}</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs font-mono">Bloque XY (m)</Label>
              <Input type="number" min={1} value={blockSize} onChange={(e) => setBlockSize(Number(e.target.value))} />
            </div>
            <div>
              <Label className="text-xs font-mono">Bloque Z (m)</Label>
              <Input type="number" min={1} value={blockZ} onChange={(e) => setBlockZ(Number(e.target.value))} />
            </div>
            <div>
              <Label className="text-xs font-mono">Compósito (m)</Label>
              <Input type="number" min={0.5} step={0.5} value={compositeLength} onChange={(e) => setCompositeLength(Number(e.target.value))} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs font-mono">Radio búsq. (m)</Label>
              <Input type="number" min={1} value={searchRadius} onChange={(e) => setSearchRadius(Number(e.target.value))} />
            </div>
            <div>
              <Label className="text-xs font-mono">Cutoff ({unit})</Label>
              <Input type="number" step={0.01} value={cutoff} onChange={(e) => setCutoff(e.target.value)} placeholder="ej: 0.3" />
            </div>
            <div>
              <Label className="text-xs font-mono">Densidad (t/m³)</Label>
              <Input type="number" step={0.1} min={0.1} value={density} onChange={(e) => setDensity(Number(e.target.value))} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!name.trim() || saving}>
            {saving && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
            Crear modelo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
