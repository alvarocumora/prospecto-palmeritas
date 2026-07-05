import { useMemo, useState } from "react";
import { AlertCircle, BarChart3, Clock, DollarSign, TrendingUp } from "lucide-react";
import { SectionHeading, Stat } from "@/components/brand";

type Commodity = "Au" | "Cu" | "Li";

interface SimInputs {
  commodity: Commodity;
  price: number;
  ore_t: number;
  grade: number;
  recovery: number;
  mining_cost: number;
  processing_cost: number;
  capex: number;
  discount_rate: number;
}

interface SimOutputs {
  gross_revenue: number;
  total_opex: number;
  ebitda: number;
  ebitda_margin: number;
  npv: number;
  irr: number | null;
  payback: number | null;
  mine_life: number;
  cashflows: number[];
}

// ── Defaults por commodity ─────────────────────────────────────────────────────
const DEFAULTS: Record<
  Commodity,
  { price: number; grade: number; recovery: number; mining_cost: number; processing_cost: number }
> = {
  Au: { price: 2350, grade: 1.5, recovery: 92, mining_cost: 4.5, processing_cost: 22 },
  Cu: { price: 4.2, grade: 0.8, recovery: 88, mining_cost: 5.0, processing_cost: 18 },
  Li: { price: 15000, grade: 0.3, recovery: 78, mining_cost: 3.5, processing_cost: 28 },
};

const META: Record<
  Commodity,
  {
    label: string;
    priceUnit: string;
    gradeUnit: string;
    priceMin: number;
    priceMax: number;
    priceStep: number;
    gradeMin: number;
    gradeMax: number;
    gradeStep: number;
  }
> = {
  Au: {
    label: "Oro (Au)",
    priceUnit: "USD/oz",
    gradeUnit: "g/t",
    priceMin: 1500,
    priceMax: 4000,
    priceStep: 25,
    gradeMin: 0.3,
    gradeMax: 8,
    gradeStep: 0.1,
  },
  Cu: {
    label: "Cobre (Cu)",
    priceUnit: "USD/lb",
    gradeUnit: "% Cu",
    priceMin: 2,
    priceMax: 8,
    priceStep: 0.05,
    gradeMin: 0.2,
    gradeMax: 3,
    gradeStep: 0.05,
  },
  Li: {
    label: "Litio (Li₂CO₃)",
    priceUnit: "USD/t",
    gradeUnit: "% Li",
    priceMin: 5000,
    priceMax: 40000,
    priceStep: 500,
    gradeMin: 0.1,
    gradeMax: 2,
    gradeStep: 0.05,
  },
};

const ANNUAL_THROUGHPUT = 1_000_000; // t/año (fijo para simplicidad)

// ── Cómputo de ingresos por metal ─────────────────────────────────────────────
function grossRevenue(
  commodity: Commodity,
  price: number,
  ore_t: number,
  grade: number,
  recovery: number,
): number {
  const rec = recovery / 100;
  if (commodity === "Au") return ore_t * (grade / 31.1035) * rec * price;
  if (commodity === "Cu") return ore_t * (grade / 100) * rec * 2204.62 * price;
  return ore_t * (grade / 100) * rec * 5.323 * price; // Li → Li₂CO₃ eq.
}

function npvAt(annual_cf: number, capex: number, mine_life: number, r: number): number {
  let v = -capex;
  for (let t = 1; t <= mine_life; t++) v += annual_cf / Math.pow(1 + r, t);
  return v;
}

function solveIRR(annual_cf: number, capex: number, mine_life: number): number | null {
  if (annual_cf <= 0) return null;
  if (npvAt(annual_cf, capex, mine_life, 0) <= 0) return null;
  if (npvAt(annual_cf, capex, mine_life, 5) >= 0) return 5; // cap 500%
  let lo = 0,
    hi = 5;
  for (let i = 0; i < 64; i++) {
    const mid = (lo + hi) / 2;
    if (npvAt(annual_cf, capex, mine_life, mid) > 0) lo = mid;
    else hi = mid;
    if (hi - lo < 1e-7) break;
  }
  return (lo + hi) / 2;
}

function simulate(inp: SimInputs): SimOutputs {
  const mine_life = Math.max(1, Math.ceil(inp.ore_t / ANNUAL_THROUGHPUT));
  const rev = grossRevenue(inp.commodity, inp.price, inp.ore_t, inp.grade, inp.recovery);
  const opex = (inp.mining_cost + inp.processing_cost) * inp.ore_t;
  const ebitda = rev - opex;
  const annual_cf = ebitda / mine_life;
  const npv = npvAt(annual_cf, inp.capex, mine_life, inp.discount_rate / 100);
  const irr = solveIRR(annual_cf, inp.capex, mine_life);
  const payback = annual_cf > 0 ? inp.capex / annual_cf : null;
  const cashflows = [-inp.capex, ...Array.from({ length: mine_life }, () => annual_cf)];
  return {
    gross_revenue: rev,
    total_opex: opex,
    ebitda,
    ebitda_margin: rev > 0 ? (ebitda / rev) * 100 : 0,
    npv,
    irr,
    payback,
    mine_life,
    cashflows,
  };
}

// ── Slider ────────────────────────────────────────────────────────────────────
function SimSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1.5">
        <span className="text-[11px] font-mono uppercase tracking-wider text-content-subtle">
          {label}
        </span>
        <span className="text-sm font-mono font-semibold text-content">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full cursor-pointer"
        style={{ accentColor: "var(--accent-brand)" }}
      />
    </div>
  );
}

// ── Gráfico de flujo de caja (SVG) ────────────────────────────────────────────
function CashFlowChart({ cashflows }: { cashflows: number[] }) {
  const W = 400,
    H = 110,
    PX = 6,
    PY = 8;
  const chartW = W - PX * 2;
  const chartH = H - PY * 2;
  const maxAbs = Math.max(...cashflows.map(Math.abs), 1);
  const cumulative = cashflows.reduce<number[]>((acc, v) => {
    acc.push((acc[acc.length - 1] ?? 0) + v);
    return acc;
  }, []);
  const n = cashflows.length;
  const colW = chartW / n;
  const barW = Math.max(4, colW * 0.6);
  const zeroY = PY + chartH * 0.5;

  const bx = (i: number) => PX + i * colW + (colW - barW) / 2;
  const scale = (v: number) => (Math.abs(v) / maxAbs) * (chartH / 2 - 4);
  const cumY = (v: number) => zeroY - (v / maxAbs) * (chartH / 2 - 4);

  return (
    <svg
      viewBox={`0 0 ${W} ${H + 18}`}
      className="w-full"
      role="img"
      aria-label="Flujo de caja anual"
    >
      {/* Grid */}
      {[0.25, 0.75].map((pct) => (
        <line
          key={pct}
          x1={PX}
          x2={W - PX}
          y1={PY + chartH * pct}
          y2={PY + chartH * pct}
          style={{ stroke: "var(--hairline)", strokeDasharray: "2 3" }}
          strokeWidth="0.5"
        />
      ))}
      {/* Línea cero */}
      <line
        x1={PX}
        x2={W - PX}
        y1={zeroY}
        y2={zeroY}
        style={{ stroke: "var(--hairline-strong)" }}
        strokeWidth="1"
      />

      {/* Barras */}
      {cashflows.map((cf, i) => {
        const h = Math.max(2, scale(cf));
        const y = cf >= 0 ? zeroY - h : zeroY;
        return (
          <rect
            key={i}
            x={bx(i)}
            y={y}
            width={barW}
            height={h}
            rx="1"
            style={{
              fill: cf >= 0 ? "var(--accent-brand)" : "var(--brand-danger)",
              opacity: 0.85,
            }}
          />
        );
      })}

      {/* Línea acumulada */}
      {cumulative.length > 1 && (
        <polyline
          points={cumulative.map((v, i) => `${bx(i) + barW / 2},${cumY(v)}`).join(" ")}
          style={{
            fill: "none",
            stroke: "var(--accent-brand)",
            strokeWidth: 1.5,
            opacity: 0.55,
          }}
        />
      )}

      {/* Etiquetas año */}
      {cashflows.map((_, i) => (
        <text
          key={i}
          x={bx(i) + barW / 2}
          y={H + 13}
          textAnchor="middle"
          fontSize="7"
          style={{ fill: "var(--content-subtle)", fontFamily: "var(--font-mono)" }}
        >
          {i === 0 ? "A0" : `A${i}`}
        </text>
      ))}
    </svg>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export function InvestmentSimulator() {
  const [commodity, setCommodity] = useState<Commodity>("Au");

  const [price, setPrice] = useState(DEFAULTS.Au.price);
  const [ore_t, setOreT] = useState(5_000_000);
  const [grade, setGrade] = useState(DEFAULTS.Au.grade);
  const [recovery, setRecovery] = useState(DEFAULTS.Au.recovery);
  const [mining_cost, setMiningCost] = useState(DEFAULTS.Au.mining_cost);
  const [processing_cost, setProcessingCost] = useState(DEFAULTS.Au.processing_cost);
  const [capex, setCapex] = useState(50_000_000);
  const [discount_rate, setDiscountRate] = useState(8);

  const handleCommodity = (c: Commodity) => {
    setCommodity(c);
    const d = DEFAULTS[c];
    setPrice(d.price);
    setGrade(d.grade);
    setRecovery(d.recovery);
    setMiningCost(d.mining_cost);
    setProcessingCost(d.processing_cost);
  };

  const meta = META[commodity];

  const out = useMemo(
    () =>
      simulate({
        commodity,
        price,
        ore_t,
        grade,
        recovery,
        mining_cost,
        processing_cost,
        capex,
        discount_rate,
      }),
    [commodity, price, ore_t, grade, recovery, mining_cost, processing_cost, capex, discount_rate],
  );

  const fmtM = (v: number) => {
    const abs = Math.abs(v);
    const sign = v < 0 ? "-" : "";
    if (abs >= 1_000_000) return `${sign}US$ ${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${sign}US$ ${(abs / 1_000).toFixed(0)}k`;
    return `${sign}US$ ${abs.toFixed(0)}`;
  };
  const fmtIRR = (v: number | null) => {
    if (v == null) return "N/A";
    const pct = v * 100;
    if (pct > 200) return ">200%";
    return `${pct.toFixed(1)}%`;
  };
  const fmtPayback = (v: number | null) =>
    v == null ? "N/A" : v > 50 ? ">50 años" : `${v.toFixed(1)} a`;

  return (
    <section className="bg-surface-2 border-y border-hairline">
      <div className="max-w-7xl mx-auto px-5 py-20">
        <SectionHeading
          align="center"
          eyebrow="Simulador de retornos"
          title="Evalúa tu inversión minera en tiempo real"
          description="Ajusta los parámetros y obtén una estimación de VPN, TIR y payback basada en un modelo de flujo de caja descontado."
          className="max-w-2xl mx-auto mb-12"
        />

        {/* Selector de commodity */}
        <div className="flex justify-center gap-3 mb-10 flex-wrap">
          {(["Au", "Cu", "Li"] as Commodity[]).map((c) => (
            <button
              key={c}
              onClick={() => handleCommodity(c)}
              type="button"
              className={`px-5 py-2.5 rounded-lg border font-mono text-sm font-semibold transition-all ${
                commodity === c
                  ? "bg-accent-brand text-white border-accent-brand shadow-sm"
                  : "border-hairline text-content-subtle hover:border-accent-brand hover:text-accent-brand"
              }`}
            >
              {META[c].label}
            </button>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-8 items-start">
          {/* Panel de controles */}
          <div className="bg-white rounded-2xl border border-hairline p-6 space-y-5">
            <div className="text-[11px] font-mono uppercase tracking-wider text-content-subtle">
              Parámetros de entrada
            </div>
            <SimSlider
              label={`Precio (${meta.priceUnit})`}
              value={price}
              min={meta.priceMin}
              max={meta.priceMax}
              step={meta.priceStep}
              onChange={setPrice}
              format={(v) => `${v.toLocaleString("es-CL")} ${meta.priceUnit}`}
            />
            <SimSlider
              label={`Ley media (${meta.gradeUnit})`}
              value={grade}
              min={meta.gradeMin}
              max={meta.gradeMax}
              step={meta.gradeStep}
              onChange={setGrade}
              format={(v) => `${v.toFixed(2)} ${meta.gradeUnit}`}
            />
            <SimSlider
              label="Tonelaje mineral (Mt)"
              value={ore_t}
              min={1_000_000}
              max={50_000_000}
              step={500_000}
              onChange={setOreT}
              format={(v) => `${(v / 1_000_000).toFixed(1)} Mt`}
            />
            <SimSlider
              label="Recuperación metalúrgica (%)"
              value={recovery}
              min={50}
              max={99}
              step={1}
              onChange={setRecovery}
              format={(v) => `${v}%`}
            />
            <SimSlider
              label="Costo minería (USD/t)"
              value={mining_cost}
              min={1}
              max={20}
              step={0.5}
              onChange={setMiningCost}
              format={(v) => `$${v.toFixed(1)}/t`}
            />
            <SimSlider
              label="Costo proceso (USD/t)"
              value={processing_cost}
              min={5}
              max={60}
              step={1}
              onChange={setProcessingCost}
              format={(v) => `$${v}/t`}
            />
            <SimSlider
              label="CAPEX total"
              value={capex}
              min={5_000_000}
              max={500_000_000}
              step={5_000_000}
              onChange={setCapex}
              format={fmtM}
            />
            <SimSlider
              label="Tasa de descuento (%)"
              value={discount_rate}
              min={5}
              max={20}
              step={0.5}
              onChange={setDiscountRate}
              format={(v) => `${v}%`}
            />
          </div>

          {/* Panel de resultados */}
          <div className="space-y-4">
            {/* KPIs */}
            <div className="grid grid-cols-2 gap-3">
              <Stat
                icon={TrendingUp}
                label="VPN · Valor Presente Neto"
                value={fmtM(out.npv)}
                hint={out.npv > 0 ? "Proyecto viable" : "Requiere revisión"}
              />
              <Stat
                icon={BarChart3}
                label="TIR · Tasa Interna Retorno"
                value={fmtIRR(out.irr)}
                hint={
                  out.irr != null && out.irr * 100 > discount_rate
                    ? `Supera umbral ${discount_rate}%`
                    : `Umbral: ${discount_rate}%`
                }
              />
              <Stat
                icon={Clock}
                label="Payback simple"
                value={fmtPayback(out.payback)}
                hint={`Vida de mina: ${out.mine_life} años`}
              />
              <Stat
                icon={DollarSign}
                label="EBITDA total"
                value={fmtM(out.ebitda)}
                hint={`Margen ${out.ebitda_margin.toFixed(0)}%`}
              />
            </div>

            {/* Gráfico flujo */}
            <div className="bg-white rounded-2xl border border-hairline p-5">
              <div className="text-[11px] font-mono uppercase tracking-wider text-content-subtle mb-3">
                Flujo de caja anual (barras) · Acumulado (línea)
              </div>
              <CashFlowChart cashflows={out.cashflows} />
              <div className="flex items-center justify-between mt-3 text-[10px] font-mono text-content-subtle flex-wrap gap-2">
                <span className="flex items-center gap-1.5">
                  <span
                    className="inline-block w-3 h-2.5 rounded-sm"
                    style={{ background: "var(--accent-brand)", opacity: 0.85 }}
                  />
                  Flujo positivo
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    className="inline-block w-3 h-2.5 rounded-sm"
                    style={{ background: "var(--brand-danger)", opacity: 0.85 }}
                  />
                  Inversión (CAPEX)
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    className="inline-block w-6 h-0.5"
                    style={{ background: "var(--accent-brand)", opacity: 0.55 }}
                  />
                  Acumulado
                </span>
              </div>
            </div>

            {/* Breakdown */}
            <div className="bg-white rounded-xl border border-hairline p-4 grid grid-cols-3 gap-px bg-hairline">
              {[
                { label: "Ingresos brutos", value: fmtM(out.gross_revenue) },
                { label: "OPEX total", value: fmtM(out.total_opex) },
                { label: "CAPEX", value: fmtM(capex) },
              ].map(({ label, value }) => (
                <div key={label} className="bg-white px-2 py-2.5 text-center">
                  <div className="text-[9px] font-mono uppercase tracking-wider text-content-subtle">
                    {label}
                  </div>
                  <div className="font-mono text-sm font-semibold text-content mt-1">{value}</div>
                </div>
              ))}
            </div>

            {/* Disclaimer */}
            <div className="flex items-start gap-2 text-[11px] text-content-subtle leading-relaxed">
              <AlertCircle
                className="w-4 h-4 shrink-0 mt-0.5"
                style={{ color: "var(--brand-warn)" }}
              />
              <span>
                Simulación ilustrativa. Throughput fijo 1 Mt/año. No incluye impuestos, regalías ni
                G&amp;A.{" "}
                <strong className="text-content">No constituye asesoría de inversión.</strong>
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
