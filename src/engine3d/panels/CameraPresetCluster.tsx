// CameraPresetCluster — HUD flotante con vistas N/E/S/W/Top/Iso + Fit.
import type { CameraView } from "@/engine3d/panels/CameraViewPresets";

type Props = {
  onPreset: (v: CameraView) => void;
  onFit: () => void;
};

export function CameraPresetCluster({ onPreset, onFit }: Props) {
  const btn = "h-6 w-6 rounded text-[10px] font-mono hover:bg-accent";
  return (
    <div className="absolute top-3 right-3 z-20 flex flex-col gap-1 rounded-md border border-border/40 bg-background/80 p-1 backdrop-blur">
      <div className="text-[8px] uppercase tracking-wide text-muted-foreground text-center">vista</div>
      <div className="grid grid-cols-3 gap-1">
        <button className={btn} onClick={() => onPreset("top")} title="Planta (top)">⌖</button>
        <button className={btn} onClick={() => onPreset("N")} title="Vista Norte">N</button>
        <button className={btn} onClick={() => onPreset("iso")} title="Isométrica">◆</button>
        <button className={btn} onClick={() => onPreset("W")} title="Vista Oeste">W</button>
        <button className={btn} onClick={onFit} title="Fit a escena">⛶</button>
        <button className={btn} onClick={() => onPreset("E")} title="Vista Este">E</button>
        <button className={`${btn} col-start-2`} onClick={() => onPreset("S")} title="Vista Sur">S</button>
      </div>
    </div>
  );
}
