// Sprint 6.4 — Time Slider: animación temporal de sondajes y vuelos de drone.
// Filtra elementos por fecha (started_at / flown_at) ≤ cursor temporal.

import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, X, Clock, SkipBack, SkipForward } from "lucide-react";

export interface TimeSliderItem {
  date: string | null | undefined; // ISO date
}

interface Props {
  holes: TimeSliderItem[];
  flights: TimeSliderItem[];
  onChange: (cursorMs: number | null) => void;
  active: boolean;
  onToggle: (active: boolean) => void;
}

const DAY_MS = 86_400_000;

export function TimeSlider({ holes, flights, onChange, active, onToggle }: Props) {
  const { minMs, maxMs, totalDays } = useMemo(() => {
    const dates: number[] = [];
    for (const h of holes) if (h.date) { const t = Date.parse(h.date); if (!isNaN(t)) dates.push(t); }
    for (const f of flights) if (f.date) { const t = Date.parse(f.date); if (!isNaN(t)) dates.push(t); }
    if (dates.length === 0) return { minMs: 0, maxMs: 0, totalDays: 0 };
    const min = Math.min(...dates);
    const max = Math.max(...dates);
    return { minMs: min, maxMs: max, totalDays: Math.max(1, Math.ceil((max - min) / DAY_MS)) };
  }, [holes, flights]);

  const [day, setDay] = useState(totalDays);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1); // days per tick
  const rafRef = useRef<number | null>(null);

  // Reset day when range changes
  useEffect(() => { setDay(totalDays); }, [totalDays]);

  // Emit cursor on change
  useEffect(() => {
    if (!active || maxMs === 0) { onChange(null); return; }
    onChange(minMs + day * DAY_MS);
  }, [day, active, minMs, maxMs, onChange]);

  // Animation loop
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      if (dt >= 200) {
        last = now;
        setDay((d) => {
          const next = d + speed;
          if (next >= totalDays) { setPlaying(false); return totalDays; }
          return next;
        });
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, totalDays]);

  if (!active) {
    return (
      <button
        onClick={() => onToggle(true)}
        disabled={totalDays === 0}
        className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[500] inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-border bg-bg-secondary/95 backdrop-blur text-[11px] font-mono text-foreground hover:bg-accent shadow-md disabled:opacity-40"
        title={totalDays === 0 ? "Sin datos temporales" : "Activar línea de tiempo"}
      >
        <Clock className="w-3.5 h-3.5 text-gold" />
        <span>Tiempo</span>
      </button>
    );
  }

  const cursorDate = maxMs > 0 ? new Date(minMs + day * DAY_MS).toISOString().slice(0, 10) : "—";
  const minDate = maxMs > 0 ? new Date(minMs).toISOString().slice(0, 10) : "—";
  const maxDate = maxMs > 0 ? new Date(maxMs).toISOString().slice(0, 10) : "—";

  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[600] w-[min(560px,calc(100vw-1.5rem))] bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-xl">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Clock className="w-3.5 h-3.5 text-gold shrink-0" />
        <span className="text-[10px] font-mono uppercase text-muted-foreground">Línea de tiempo</span>
        <span className="text-[11px] font-mono font-semibold text-gold ml-auto">{cursorDate}</span>
        <button onClick={() => { setPlaying(false); onToggle(false); }} className="text-muted-foreground hover:text-foreground" title="Cerrar">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="px-3 py-2 flex items-center gap-2">
        <button onClick={() => { setPlaying(false); setDay(0); }} className="p-1 hover:bg-accent rounded" title="Inicio">
          <SkipBack className="w-3 h-3" />
        </button>
        <button
          onClick={() => setPlaying((p) => !p)}
          disabled={totalDays === 0}
          className="inline-flex items-center justify-center w-7 h-7 rounded bg-gold text-bg-primary hover:bg-gold/90 disabled:opacity-40"
          title={playing ? "Pausar" : "Reproducir"}
        >
          {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
        </button>
        <button onClick={() => { setPlaying(false); setDay(totalDays); }} className="p-1 hover:bg-accent rounded" title="Fin">
          <SkipForward className="w-3 h-3" />
        </button>
        <input
          type="range"
          min={0}
          max={totalDays}
          value={day}
          onChange={(e) => { setPlaying(false); setDay(Number(e.target.value)); }}
          className="flex-1 accent-gold"
        />
        <select
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          className="text-[10px] font-mono bg-background border border-border rounded px-1 py-0.5 outline-none focus:border-gold"
          title="Velocidad (días/tick)"
        >
          <option value={1}>1×</option>
          <option value={3}>3×</option>
          <option value={7}>7×</option>
          <option value={30}>30×</option>
        </select>
      </div>
      <div className="px-3 pb-2 flex justify-between text-[9px] font-mono text-muted-foreground">
        <span>{minDate}</span>
        <span>{day}/{totalDays} días</span>
        <span>{maxDate}</span>
      </div>
    </div>
  );
}
