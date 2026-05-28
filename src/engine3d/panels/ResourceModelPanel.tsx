// Panel KPI estilo Datamine: volumen, tonelaje, ley media, contenido metálico,
// clasificación y NPV preliminar. Lee directo del BlockModelOutput sin re-cómputo
// pesado (sólo agregaciones lineales sobre filtros).
import { useMemo } from "react";
import type { BlockModelOutput } from "@/engine3d/workers/blockModel.worker";
import type { BlockFilters } from "@/engine3d/layers/BlockModelLayer";
import { Boxes, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  model: BlockModelOutput;
  filters: BlockFilters;
  /** Precio metal (USD/oz para Au/Ag, USD/lb para Cu, USD/t resto). */
  price: number;
  /** Coste operativo (USD/tonelada). */
  opex: number;
  /** Capex preliminar (USD). */
  capex: number;
  /** Recuperación metalúrgica %. */
  recovery: number;
  /** Tasa de descuento. */
  discount: number;
  /** Años de operación. */
  years: number;
  onClose: () => void;
};

const OZ_PER_GRAM = 1 / 31.1035;
const LB_PER_TONNE = 2204.6226;

export function ResourceModelPanel({
  model, filters, price, opex, capex, recovery, discount, years, onClose,
}: Props) {
  const kpis = useMemo(() => {
    const { grades, tonnages, metals, classification, confidence, positions } = model;
    let tonnes = 0;
    let metalSum = 0;
    let gradeSumW = 0;
    let countOver = 0;
    let nMeas = 0, nInd = 0, nInf = 0;
    let tMeas = 0, tInd = 0, tInf = 0;
    let mMeas = 0, mInd = 0, mInf = 0;
    for (let i = 0; i < model.count; i++) {
      const cls = classification[i];
      const grade = grades[i];
      const conf = confidence[i];
      const z = positions[i * 3 + 2];
      const depth = -z;
      if (cls === 0 && !filters.showMeasured) continue;
      if (cls === 1 && !filters.showIndicated) continue;
      if (cls === 2 && !filters.showInferred) continue;
      if (cls === 3) continue;
      if (grade < filters.cutoff) continue;
      if (conf < filters.minConfidence) continue;
      if (depth < filters.minDepth || depth > filters.maxDepth) continue;
      tonnes += tonnages[i];
      metalSum += metals[i];
      gradeSumW += grade * tonnages[i];
      countOver++;
      if (cls === 0) { nMeas++; tMeas += tonnages[i]; mMeas += metals[i]; }
      else if (cls === 1) { nInd++; tInd += tonnages[i]; mInd += metals[i]; }
      else if (cls === 2) { nInf++; tInf += tonnages[i]; mInf += metals[i]; }
    }
    const meanGrade = tonnes > 0 ? gradeSumW / tonnes : 0;
    const volume = countOver * model.blockSize.x * model.blockSize.y * model.blockSize.z;

    const isPrecious = model.commodity === "au" || model.commodity === "ag";
    const isCu = model.commodity === "cu";
    // metalSum: g (precious) o t (base)
    const recoveredMetal = metalSum * (recovery / 100);
    let revenue = 0;
    let metalLabel = "";
    if (isPrecious) {
      const oz = recoveredMetal * OZ_PER_GRAM;
      revenue = oz * price;
      metalLabel = `${oz.toLocaleString(undefined, { maximumFractionDigits: 0 })} oz`;
    } else if (isCu) {
      const lbs = recoveredMetal * LB_PER_TONNE;
      revenue = lbs * price;
      metalLabel = `${recoveredMetal.toLocaleString(undefined, { maximumFractionDigits: 0 })} t`;
    } else {
      revenue = recoveredMetal * price;
      metalLabel = `${recoveredMetal.toLocaleString(undefined, { maximumFractionDigits: 0 })} t`;
    }
    const opexTotal = opex * tonnes;
    const cashflow = revenue - opexTotal - capex;
    const mid = years / 2;
    const npv = cashflow / Math.pow(1 + discount, mid);

    return {
      tonnes, volume, meanGrade, countOver, metalLabel, metalSumRaw: metalSum,
      revenue, opexTotal, capex, cashflow, npv,
      meas: { n: nMeas, t: tMeas, m: mMeas },
      ind: { n: nInd, t: tInd, m: mInd },
      inf: { n: nInf, t: tInf, m: mInf },
    };
  }, [model, filters, price, opex, capex, recovery, discount, years]);

  const unit = model.commodity === "au" || model.commodity === "ag" ? "g/t" : "%";
  const commodityLabel = model.commodity.toUpperCase();

  return (
    <div className="absolute top-2 right-2 z-20 w-[280px] bg-black/90 backdrop-blur rounded-md border border-amber-500/40 text-[10px] font-mono">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2 text-amber-300 uppercase tracking-wider">
          <Boxes className="w-3 h-3" /> Resource model · {commodityLabel}
        </div>
        <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={onClose}>
          <X className="w-3 h-3" />
        </Button>
      </div>
      <div className="p-3 space-y-2.5 max-h-[60vh] overflow-y-auto">
        <Row label="Bloques estimados" value={kpis.countOver.toLocaleString()} />
        <Row label="Volumen" value={`${(kpis.volume / 1_000_000).toFixed(2)} Mm³`} />
        <Row label="Tonelaje" value={`${(kpis.tonnes / 1_000_000).toFixed(2)} Mt`} />
        <Row label={`Cut-off`} value={`${filters.cutoff.toFixed(2)} ${unit}`} />
        <Row label={`Ley media`} value={`${kpis.meanGrade.toFixed(2)} ${unit}`} />
        <Row label="Metal recuperado" value={kpis.metalLabel} highlight />

        <div className="pt-1 mt-1 border-t border-border/50">
          <div className="text-muted-foreground uppercase text-[9px] mb-1">Clasificación</div>
          <ClsRow color="bg-green-500" label="Measured" n={kpis.meas.n} t={kpis.meas.t} />
          <ClsRow color="bg-yellow-500" label="Indicated" n={kpis.ind.n} t={kpis.ind.t} />
          <ClsRow color="bg-red-500" label="Inferred" n={kpis.inf.n} t={kpis.inf.t} />
        </div>

        <div className="pt-1 mt-1 border-t border-border/50">
          <div className="text-muted-foreground uppercase text-[9px] mb-1">Economía preliminar</div>
          <Row label="Revenue" value={fmtUsd(kpis.revenue)} />
          <Row label="Opex" value={fmtUsd(-kpis.opexTotal)} />
          <Row label="Capex" value={fmtUsd(-kpis.capex)} />
          <Row label="Cashflow" value={fmtUsd(kpis.cashflow)} />
          <Row label={`NPV @${(discount * 100).toFixed(0)}%`} value={fmtUsd(kpis.npv)} highlight />
        </div>
        <div className="text-[8px] text-muted-foreground italic pt-1 border-t border-border/30">
          Cálculo preliminar — no constituye estimación NI 43-101.
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={highlight ? "text-amber-300 font-bold" : "text-foreground"}>{value}</span>
    </div>
  );
}

function ClsRow({ color, label, n, t }: { color: string; label: string; n: number; t: number }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-0.5">
      <div className="flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-sm ${color}`} />
        <span className="text-muted-foreground">{label}</span>
      </div>
      <span className="text-foreground">
        {n.toLocaleString()} · {(t / 1_000_000).toFixed(2)} Mt
      </span>
    </div>
  );
}

function fmtUsd(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)} B USD`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)} M USD`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)} k USD`;
  return `${n.toFixed(0)} USD`;
}
