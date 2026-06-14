// Estimation Settings Panel — Sprint 4
// Controla parámetros IDW + anisotropía + density by lithology + presets persistentes.
import { useEffect, useState } from "react";
import { X, Save, Trash2, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  DEFAULT_ESTIMATION,
  type EstimationSettings,
  type EstimationPreset,
  listPresets,
  savePreset,
  deletePreset,
} from "@/engine3d/qaqc/estimationPresets";
import { auditTrail } from "@/engine3d/qaqc/auditTrail";

type Props = {
  value: EstimationSettings;
  onChange: (next: EstimationSettings) => void;
  onClose: () => void;
};

export function EstimationSettingsPanel({ value, onChange, onClose }: Props) {
  const [presets, setPresets] = useState<EstimationPreset[]>([]);
  const [name, setName] = useState("");

  useEffect(() => {
    setPresets(listPresets());
  }, []);

  function patch<K extends keyof EstimationSettings>(k: K, v: EstimationSettings[K]) {
    onChange({ ...value, [k]: v });
  }

  function handleSave() {
    if (!name.trim()) return;
    const p = savePreset(name.trim(), value);
    setPresets(listPresets());
    setName("");
    auditTrail.log("preset.save", { name: p.name, settings: value });
  }
  function handleLoad(p: EstimationPreset) {
    onChange(p.settings);
    auditTrail.log("preset.load", { name: p.name });
  }
  function handleDelete(id: string) {
    deletePreset(id);
    setPresets(listPresets());
  }

  return (
    <div className="absolute inset-2 z-30 bg-black/95 backdrop-blur rounded-lg border border-border flex flex-col font-mono text-[11px]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="uppercase tracking-wider text-[10px] text-emerald-300">
          Estimation settings · IDW + anisotropía + densidad
        </div>
        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={onClose}>
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 grid grid-cols-2 gap-x-4 gap-y-3">
        <Field label={`IDW power · ${value.idwPower.toFixed(2)}`}>
          <Slider
            min={0.5}
            max={6}
            step={0.1}
            value={[value.idwPower]}
            onValueChange={([v]) => patch("idwPower", v)}
          />
        </Field>
        <Field label={`Search radius · ${value.searchRadius} m`}>
          <Slider
            min={20}
            max={500}
            step={10}
            value={[value.searchRadius]}
            onValueChange={([v]) => patch("searchRadius", v)}
          />
        </Field>
        <Field label={`Min samples · ${value.minSamples}`}>
          <Slider
            min={1}
            max={10}
            step={1}
            value={[value.minSamples]}
            onValueChange={([v]) => patch("minSamples", v)}
          />
        </Field>
        <Field label={`Max samples · ${value.maxSamples}`}>
          <Slider
            min={2}
            max={30}
            step={1}
            value={[value.maxSamples]}
            onValueChange={([v]) => patch("maxSamples", v)}
          />
        </Field>
        <Field label={`Cutoff · ${value.cutoff.toFixed(2)}`}>
          <Slider
            min={0}
            max={10}
            step={0.05}
            value={[value.cutoff]}
            onValueChange={([v]) => patch("cutoff", v)}
          />
        </Field>
        <Field label={`Densidad default · ${value.defaultDensity.toFixed(2)} t/m³`}>
          <Slider
            min={1.5}
            max={5}
            step={0.05}
            value={[value.defaultDensity]}
            onValueChange={([v]) => patch("defaultDensity", v)}
          />
        </Field>

        <div className="col-span-2">
          <Label className="text-[9px] uppercase">Anisotropía (rx · ry · rz)</Label>
          <div className="grid grid-cols-3 gap-2 mt-1">
            {(["rx", "ry", "rz"] as const).map((k) => (
              <div key={k}>
                <div className="text-[9px] text-muted-foreground">
                  {k} · {value.anisotropy[k].toFixed(2)}
                </div>
                <Slider
                  min={0.1}
                  max={3}
                  step={0.05}
                  value={[value.anisotropy[k]]}
                  onValueChange={([v]) => patch("anisotropy", { ...value.anisotropy, [k]: v })}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-2">
          <Label className="text-[9px] uppercase">Densidad por litología (t/m³)</Label>
          <div className="grid grid-cols-4 gap-2 mt-1">
            {Object.entries(value.densityByLithology).map(([code, d]) => (
              <div key={code} className="flex items-center gap-1">
                <span className="text-[10px] text-emerald-300 uppercase w-8">{code}</span>
                <Input
                  type="number"
                  step="0.05"
                  className="h-6 text-[10px]"
                  value={d}
                  onChange={(e) =>
                    patch("densityByLithology", {
                      ...value.densityByLithology,
                      [code]: Number(e.target.value) || 0,
                    })
                  }
                />
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-2 border-t border-border pt-3">
          <Label className="text-[9px] uppercase">Presets de escenario</Label>
          <div className="flex gap-1 mt-1">
            <Input
              placeholder="Nombre del escenario…"
              className="h-7 text-[11px]"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button
              size="sm"
              className="h-7 text-[10px]"
              onClick={handleSave}
              disabled={!name.trim()}
            >
              <Save className="w-3 h-3 mr-1" /> Save
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[10px]"
              onClick={() => onChange(DEFAULT_ESTIMATION)}
            >
              Reset
            </Button>
          </div>
          <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
            {presets.length === 0 && (
              <div className="text-muted-foreground text-[10px]">Sin presets guardados.</div>
            )}
            {presets.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between border border-border/60 rounded px-2 py-1"
              >
                <div>
                  <div className="text-foreground text-[11px]">{p.name}</div>
                  <div className="text-muted-foreground text-[9px]">
                    {new Date(p.createdAt).toLocaleString()} · IDW {p.settings.idwPower} · R{" "}
                    {p.settings.searchRadius}m
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-[10px]"
                    onClick={() => handleLoad(p)}
                  >
                    <FolderOpen className="w-3 h-3 mr-1" /> Load
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-red-400"
                    onClick={() => handleDelete(p.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-[9px] uppercase">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
