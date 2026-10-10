// Simulador de inversión client-side: calcula retorno proyectado bajo 3 escenarios
// con fórmula determinista. Disclaimer legal explícito. NO ejecuta cálculos sensibles.
import { useMemo, useState } from "react";
import { Link, useSearch } from "@tanstack/react-router";
import { Calculator, TrendingUp, ArrowRight, Info, Lock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { submitContactMessage } from "@/lib/contactMessages.functions";
import { useServerFn } from "@tanstack/react-start";
import {
  calculateInvestmentReturn,
  readSimulationSearch,
  simulationReturnPath,
} from "@/lib/investor/simulation";
import { fmtUSD } from "@/modules/deals/domain/format";

type Scenario = "conservative" | "base" | "optimistic";

const SCENARIOS: Record<Scenario, { label: string; color: string }> = {
  conservative: { label: "Conservador", color: "text-slate-600" },
  base: { label: "Base", color: "text-accent-brand" },
  optimistic: { label: "Optimista", color: "text-emerald-600" },
};

// Bonus por etapa: greenfield más upside; pre-feas más cierre.
const STAGE_BONUS: Record<string, number> = {
  greenfield: 0.4,
  exploration: 0.25,
  scoping: 0.15,
  prefeasibility: 0.05,
  feasibility: 0,
  construction: -0.1,
  production: -0.2,
};

export function InvestmentSimulator({
  listingId,
  listingTitle,
  askingPriceUSD,
  modality,
  royaltyPct,
  stage,
  commodity,
}: {
  listingId: string;
  listingTitle: string;
  askingPriceUSD: number | null;
  modality: string | null;
  royaltyPct: number | null;
  stage: string | null;
  commodity: string | null;
}) {
  const { user } = useAuth();
  const submitContact = useServerFn(submitContactMessage);

  const baseTicket = askingPriceUSD ?? 500_000;
  const minTicket = Math.max(50_000, Math.round(baseTicket * 0.05));
  const maxTicket = Math.max(minTicket * 4, baseTicket);

  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const initial = readSimulationSearch(
    search,
    Math.max(minTicket, Math.round(baseTicket * 0.1)),
    minTicket,
    maxTicket,
  );
  const [amount, setAmount] = useState(initial.amount);
  const [years, setYears] = useState(initial.years);
  const [scenario, setScenario] = useState<Scenario>(initial.scenario);
  const returnPath = simulationReturnPath(listingId, amount, years, scenario);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const stageBonus = STAGE_BONUS[stage ?? ""] ?? 0;
  const result = useMemo(
    () => calculateInvestmentReturn(amount, years, scenario, stageBonus),
    [amount, years, scenario, stageBonus],
  );

  const breakdown = useMemo(() => {
    const arr: Array<{ y: number; v: number }> = [];
    for (let y = 0; y <= years; y++) {
      arr.push({ y, v: amount * Math.pow(1 + result.irr, y) });
    }
    return arr;
  }, [amount, years, result.irr]);

  const maxBar = breakdown[breakdown.length - 1].v;

  const handleSave = async () => {
    if (!user) {
      // Redirect to auth, preserving listing for return
      window.location.href =
        "/auth?intent=investor&mode=signup&next=" + encodeURIComponent(returnPath);
      return;
    }
    setSaving(true);
    try {
      // Crea inquiry con la simulación embebida en message
      const msg = JSON.stringify(
        {
          type: "investment_simulation",
          model_version: "reference-terminal-flow-v1",
          listing: listingTitle,
          amount_usd: amount,
          horizon_years: years,
          scenario,
          projected_irr: result.irr,
          projected_multiple: result.multiplier,
          projected_return_usd: result.final,
        },
        null,
        2,
      );

      const { error } = await supabase.from("property_deal_inquiries").insert({
        listing_id: listingId,
        inquirer_user_id: user.id,
        status: "new",
        message: `Simulación de inversión:\n${msg}`,
      });
      if (error) throw error;

      // Notifica equipo
      await submitContact({
        data: {
          name: user.email?.split("@")[0] ?? "Inversionista",
          email: user.email ?? "",
          organization: null,
          role: "investor",
          message: `Simulación guardada para "${listingTitle}": USD ${amount.toLocaleString()} a ${years}y, escenario ${scenario}, IRR ${(result.irr * 100).toFixed(1)}%, retorno proyectado ${fmtUSD(result.final)}.`,
          source: `simulator:${listingId}`,
        },
      });

      setSaved(true);
      toast.success("Simulación guardada. El equipo te contactará.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-hairline bg-white p-6 space-y-6">
      <header className="flex items-center gap-2">
        <Calculator className="w-5 h-5 text-accent-brand" />
        <div>
          <h3 className="font-display text-lg text-content">Simulador de inversión</h3>
          <p className="text-xs text-content-subtle">
            Modelo referencial — no constituye oferta ni promesa de retorno.
          </p>
        </div>
      </header>

      {/* Inputs */}
      <div className="grid gap-5">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-mono uppercase tracking-wider text-content-subtle">
              Monto a invertir
            </label>
            <span className="font-mono text-sm text-content font-semibold">{fmtUSD(amount)}</span>
          </div>
          <input
            type="range"
            min={minTicket}
            max={maxTicket}
            step={Math.round(minTicket / 10)}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full accent-accent-brand"
          />
          <div className="flex justify-between text-[10px] font-mono text-content-subtle mt-1">
            <span>{fmtUSD(minTicket)}</span>
            <span>{fmtUSD(maxTicket)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-mono uppercase tracking-wider text-content-subtle">
              Horizonte (años)
            </label>
            <select
              value={years}
              onChange={(e) => setYears(Number(e.target.value))}
              className="brand-input w-full mt-1"
            >
              {[2, 3, 5, 7, 10].map((y) => (
                <option key={y} value={y}>
                  {y} años
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-mono uppercase tracking-wider text-content-subtle">
              Escenario
            </label>
            <select
              value={scenario}
              onChange={(e) => setScenario(e.target.value as Scenario)}
              className="brand-input w-full mt-1"
            >
              {(Object.keys(SCENARIOS) as Scenario[]).map((s) => (
                <option key={s} value={s}>
                  {SCENARIOS[s].label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Outputs */}
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Retorno proy." value={fmtUSD(result.final)} highlight />
        <Stat label="Múltiplo" value={`${result.multiplier.toFixed(2)}x`} />
        <Stat label="Retorno anualizado" value={`${(result.irr * 100).toFixed(1)}%`} />
      </div>

      {/* Bar chart */}
      <div>
        <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle mb-2">
          Proyección anual ({SCENARIOS[scenario].label})
        </div>
        <div className="flex items-end gap-1 h-24">
          {breakdown.map((b) => (
            <div key={b.y} className="flex-1 flex flex-col items-center gap-1">
              <div
                className={`w-full rounded-t ${scenario === "optimistic" ? "bg-emerald-500" : scenario === "conservative" ? "bg-slate-400" : "bg-accent-brand"}`}
                style={{ height: `${(b.v / maxBar) * 100}%`, minHeight: "4px" }}
                title={fmtUSD(b.v)}
              />
              <span className="text-[9px] font-mono text-content-subtle">Y{b.y}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="rounded-md bg-amber-50 border border-amber-200 p-3 flex gap-2">
        <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-[11px] text-amber-900 leading-relaxed">
          Cálculo referencial basado en parámetros del proyecto ({stage ?? "etapa no def."},{" "}
          {commodity ?? "—"}
          {modality === "royalty" && royaltyPct ? `, royalty ${royaltyPct}% NSR` : ""}). No
          constituye una oferta, recomendación de inversión ni promesa de retorno. Los retornos
          reales dependen de variables geológicas, regulatorias y de mercado, y pueden implicar
          pérdida de capital. La tasa supone un aporte inicial y un cobro final; no modela
          distribuciones ni dilución. Geocapitals actúa como facilitador del deal, no como gestor de
          capital.
        </p>
      </div>

      {/* Save CTA */}
      {saved ? (
        <div className="rounded-md bg-emerald-50 border border-emerald-200 p-4 text-center">
          <TrendingUp className="w-6 h-6 text-emerald-600 mx-auto mb-1" />
          <div className="font-display text-content">Simulación guardada</div>
          <p className="text-xs text-emerald-800 mt-1">
            Te contactaremos para revisar el data room y NDA.
          </p>
        </div>
      ) : user ? (
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full inline-flex items-center justify-center gap-2 bg-accent-brand text-white px-5 py-3 rounded-md text-sm font-medium hover:opacity-95 disabled:opacity-60"
        >
          {saving ? (
            "Guardando…"
          ) : (
            <>
              Guardar simulación y solicitar acceso <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      ) : (
        <Link
          to="/auth"
          search={{ intent: "investor", mode: "signup", next: returnPath }}
          className="w-full inline-flex items-center justify-center gap-2 bg-accent-brand text-white px-5 py-3 rounded-md text-sm font-medium hover:opacity-95"
        >
          <Lock className="w-4 h-4" /> Crear cuenta para guardar simulación
        </Link>
      )}
    </section>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={`rounded-lg p-3 ${highlight ? "bg-accent-brand text-white" : "bg-accent-brand-subtle text-content"}`}
    >
      <div
        className={`text-[10px] font-mono uppercase tracking-wider ${highlight ? "text-white/70" : "text-content-subtle"}`}
      >
        {label}
      </div>
      <div className="font-mono text-lg font-semibold mt-0.5">{value}</div>
    </div>
  );
}
