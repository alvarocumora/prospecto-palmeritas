import { useState } from "react";
import { calculateTilamaEnami, TILAMA_ENAMI_REFERENCE } from "./tilamaEnamiModel";

const money = (n: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(n);
const integer = (n: number) => Math.round(n).toLocaleString("es-CL");

type CostInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

function CostInput({ label, value, onChange }: CostInputProps) {
  return (
    <label className="block text-xs text-content-subtle">
      <span className="block mb-1">{label}</span>
      <input
        type="number"
        min="0"
        step="100"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Pendiente de cotizar"
        className="w-full min-h-11 rounded-md border border-hairline bg-white px-3 text-sm text-content"
      />
    </label>
  );
}

function cost(value: string): number | null {
  if (value.trim() === "") return null;
  return Number(value);
}

/** Escenario público de venta de mineral; nunca un plan minero ni una valorización. */
export function TilamaEnamiPanel() {
  const [tonnes, setTonnes] = useState("1000");
  const [total, setTotal] = useState("2");
  const [soluble, setSoluble] = useState("1.5");
  const [showCosts, setShowCosts] = useState(false);
  const [mineCost, setMineCost] = useState("");
  const [freight, setFreight] = useState("");
  const [adjustments, setAdjustments] = useState("");
  const [royalty, setRoyalty] = useState<"pending" | "zero" | "draft10">("pending");

  let scenario: ReturnType<typeof calculateTilamaEnami> | null = null;
  try {
    scenario = calculateTilamaEnami({
      dryTonnes: Number(tonnes),
      cuTotalPct: Number(total),
      cuSolublePct: Number(soluble),
      mineCostClpPerT: showCosts ? cost(mineCost) : null,
      freightClpPerT: showCosts ? cost(freight) : null,
      adjustmentsClpPerT: showCosts ? cost(adjustments) : null,
      draftRoyaltyPct: showCosts ? (royalty === "pending" ? null : royalty === "draft10" ? 10 : 0) : null,
    });
  } catch {
    // Las entradas inválidas no generan cifras; no se inventan tarifas.
  }

  return (
    <section className="rounded-2xl border border-hairline bg-white overflow-hidden">
      <header className="px-6 py-5 border-b border-hairline">
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-accent-brand">
          Tilama · venta de mineral · escenario no certificado
        </div>
        <h2 className="font-display text-2xl text-content mt-1">
          Simulación tarifaria ENAMI
        </h2>
        <p className="mt-2 text-sm text-content-subtle max-w-3xl leading-relaxed">
          Mismo método tarifario de Cholqui, con la {TILAMA_ENAMI_REFERENCE.tariffSource}.
          Es una referencia histórica, <strong>no una cotización vigente</strong> ni aceptación de
          mineral de Tilama. El volumen ingresado es hipotético: no acredita recursos, reservas,
          producción ni ventas futuras.
        </p>
      </header>

      <div className="px-6 py-5">
        <div className="grid sm:grid-cols-3 gap-4">
          <label className="block text-xs text-content-subtle">
            <span className="block mb-1">Toneladas métricas secas hipotéticas (tms)</span>
            <input
              type="number"
              min="1"
              max="20000000"
              step="1"
              value={tonnes}
              onChange={(event) => setTonnes(event.target.value)}
              className="w-full min-h-11 rounded-md border border-hairline bg-white px-3 text-sm text-content"
            />
          </label>
          <label className="block text-xs text-content-subtle">
            <span className="block mb-1">Ley Cu total hipotética (%)</span>
            <input
              type="number"
              min="0.1"
              max="100"
              step="0.1"
              value={total}
              onChange={(event) => setTotal(event.target.value)}
              className="w-full min-h-11 rounded-md border border-hairline bg-white px-3 text-sm text-content"
            />
          </label>
          <label className="block text-xs text-content-subtle">
            <span className="block mb-1">Ley Cu soluble hipotética (%)</span>
            <input
              type="number"
              min="1"
              max="3"
              step="0.1"
              value={soluble}
              onChange={(event) => setSoluble(event.target.value)}
              className="w-full min-h-11 rounded-md border border-hairline bg-white px-3 text-sm text-content"
            />
          </label>
        </div>

        <p className="text-xs text-content-subtle mt-3">
          El Cu soluble no puede superar el Cu total. Las leyes puntuales del laboratorio y los
          certificados históricos ENAMI no constituyen una ley media representativa.
        </p>

        {scenario ? (
          <div className="mt-5 grid sm:grid-cols-3 gap-3" aria-live="polite">
            <div className="rounded-lg bg-surface-2 p-4">
              <div className="text-[11px] text-content-subtle uppercase">Tarifa histórica por tms</div>
              <div className="font-display text-xl text-content mt-1">
                {money(scenario.tariffClpPerT)}
              </div>
            </div>
            <div className="rounded-lg bg-surface-2 p-4">
              <div className="text-[11px] text-content-subtle uppercase">Ingreso bruto ilustrativo</div>
              <div className="font-display text-xl text-content mt-1">
                {money(scenario.grossClp)}
              </div>
            </div>
            <div className="rounded-lg bg-surface-2 p-4">
              <div className="text-[11px] text-content-subtle uppercase">Cobre contenido teórico</div>
              <div className="font-display text-xl text-content mt-1">
                {integer(scenario.copperContainedTonnes)} t
              </div>
              <p className="text-[10px] text-content-subtle mt-1">
                No es cobre pagable ni recuperado.
              </p>
            </div>
          </div>
        ) : (
          <p role="alert" className="mt-4 text-sm text-red-700">
            Revise tonelaje y leyes: Cu soluble entre 1 y 3 %, sin superar Cu total.
            No se calcula una tarifa fuera del intervalo de sensibilidad.
          </p>
        )}

        <label className="flex items-center gap-3 mt-6 text-sm text-content">
          <input
            type="checkbox"
            checked={showCosts}
            onChange={(event) => setShowCosts(event.target.checked)}
            className="h-4 w-4 accent-accent-brand"
          />
          Ingresar hipótesis explícitas de costos y renta minera
        </label>

        {showCosts && (
          <div className="mt-4 rounded-xl border border-hairline p-4">
            <p className="text-xs text-content-subtle mb-4">
              No se copian automáticamente costos de Cholqui: ingrese cotizaciones o supuestos
              de Tilama y documente su procedencia. Cero equivale a un supuesto explícito,
              no a un costo conocido.
            </p>
            <div className="grid sm:grid-cols-3 gap-3">
              <CostInput
                label="Extracción y preparación (CLP/tms)"
                value={mineCost}
                onChange={setMineCost}
              />
              <CostInput label="Flete (CLP/tms)" value={freight} onChange={setFreight} />
              <CostInput
                label="Ajustes, ácido y otras deducciones (CLP/tms)"
                value={adjustments}
                onChange={setAdjustments}
              />
            </div>
            <label className="block text-xs text-content-subtle mt-4">
              <span className="block mb-1">Escenario de renta minera</span>
              <select
                value={royalty}
                onChange={(event) =>
                  setRoyalty(event.target.value as "pending" | "zero" | "draft10")
                }
                className="w-full sm:max-w-sm min-h-11 rounded-md border border-hairline bg-white px-3 text-sm text-content"
              >
                <option value="pending">No definido — no calcular netback</option>
                <option value="zero">0 % — sensibilidad sin renta</option>
                <option value="draft10">10 % sobre venta — borrador de arriendo, no acreditado</option>
              </select>
            </label>
            {scenario?.scenarioNetClp != null ? (
              <div className="mt-5 rounded-lg bg-surface-2 p-4">
                <p className="text-[11px] uppercase text-content-subtle">
                  Margen ilustrativo después de costos ingresados, no beneficio auditado
                </p>
                <p className="mt-1 font-display text-xl text-content">
                  {money(scenario.scenarioNetClp)}
                </p>
                <p className="text-xs text-content-subtle mt-1">
                  {money(scenario.netbackClpPerT!)} por tms. No incluye CAPEX, impuestos,
                  financiamiento, cierre ni valor temporal del dinero.
                </p>
              </div>
            ) : (
              <p className="text-xs text-content-subtle mt-3">
                Netback pendiente: complete los costos y seleccione un escenario de renta minera.
              </p>
            )}
          </div>
        )}

        <p className="text-xs text-content-subtle mt-5 leading-relaxed border-t border-hairline pt-4">
          <strong>Bloqueo de due diligence:</strong> sin inventario explotable validado,
          metalurgia, aceptación de ENAMI, distancia, cotización de flete y condiciones de
          liquidación vigentes, estas cifras no son aptas para decisiones de inversión.
          El potencial conceptual histórico de ~3,75 millones de toneladas no puede
          presentarse como reservas. Se requiere revisión de una Persona Competente.
        </p>
      </div>
    </section>
  );
}
