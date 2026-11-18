// Causas propias: semáforo del plazo de tasa TGR y decisión pagar / dejar vencer.
import { useEffect, useState } from "react";
import { loadCases, saveCases, tgrStatus, TGR_DAYS, type OwnCase, type CaseDecision } from "@/lib/cadastre/ownCases";

const TONE: Record<string, string> = {
  pagada: "border-hairline text-muted-foreground",
  vencida: "border-destructive text-destructive",
  urgente: "border-destructive text-destructive",
  proxima: "border-im-gold text-im-gold",
  holgada: "border-hairline text-content",
  dejar_vencer: "border-hairline text-muted-foreground",
};
const LABEL: Record<string, string> = {
  pagada: "Pagada", vencida: "Plazo vencido", urgente: "Pagar ya", proxima: "Pagar pronto", holgada: "En plazo", dejar_vencer: "Dejar vencer",
};

export function OwnCasesPanel({ onChange }: { onChange?: (c: OwnCase[]) => void }) {
  const [cases, setCases] = useState<OwnCase[]>([]);
  useEffect(() => { const c = loadCases(); setCases(c); onChange?.(c); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const today = new Date().toISOString().slice(0, 10);
  const update = (id: string, patch: Partial<OwnCase>) => {
    const next = cases.map((c) => (c.id === id ? { ...c, ...patch } : c));
    setCases(next); saveCases(next); onChange?.(next);
  };
  const remove = (id: string) => { const next = cases.filter((c) => c.id !== id); setCases(next); saveCases(next); onChange?.(next); };
  const sorted = [...cases].sort((a, b) => tgrStatus(a, today).left - tgrStatus(b, today).left);
  const toPay = cases.filter((c) => !c.paid && c.decision !== "dejar_vencer").length;
  const saved = cases.filter((c) => c.decision === "dejar_vencer").length;

  return (
    <div className="p-3 space-y-2">
      <p className="text-xs text-muted-foreground">
        Plazo de {TGR_DAYS} días corridos para pagar la tasa (Formulario 10, TGR), contado desde la fecha registrada. Confirma la fecha de rol en la OJV. Datos guardados solo en este navegador.
      </p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded border border-border p-2"><div className="text-muted-foreground">Por pagar</div><div className="font-semibold">{toPay}</div></div>
        <div className="rounded border border-border p-2"><div className="text-muted-foreground">Dejar vencer</div><div className="font-semibold">{saved}</div></div>
      </div>
      <ul className="space-y-1.5">
        {sorted.map((c) => {
          const s = tgrStatus(c, today);
          return (
            <li key={c.id} className={`rounded border p-2 ${TONE[s.level]}`}>
              <div className="flex justify-between gap-2 text-[10px] font-mono uppercase">
                <span>{LABEL[s.level]}</span>
                <span>{c.paid || c.decision === "dejar_vencer" ? `vence ${s.deadline}` : s.left >= 0 ? `${s.left} días · ${s.deadline}` : `venció ${s.deadline}`}</span>
              </div>
              <div className="text-xs font-medium text-foreground">{c.name}{c.ha ? ` · ${c.ha} ha` : ""}</div>
              <div className="text-[10px] text-muted-foreground">{c.rit ?? "Rol s/n"} · {c.court ?? "—"}{c.geometry ? " · con polígono" : ""}</div>
              {c.note && <div className="text-[10px] text-muted-foreground">{c.note}</div>}
              <div className="flex flex-wrap gap-1.5 pt-1.5 text-[10px]">
                <select aria-label="Decisión" value={c.decision} onChange={(e) => update(c.id, { decision: e.target.value as CaseDecision })}
                  className="rounded border border-border bg-background px-1 py-0.5 text-foreground">
                  <option value="pagar">Pagar</option><option value="evaluar">Evaluar</option><option value="dejar_vencer">Dejar vencer</option>
                </select>
                <label className="flex items-center gap-1 text-foreground">
                  <input type="checkbox" checked={c.paid} onChange={(e) => update(c.id, { paid: e.target.checked })} />Pagada
                </label>
                <input type="date" aria-label="Fecha de rol" value={c.filedAt} onChange={(e) => e.target.value && update(c.id, { filedAt: e.target.value })}
                  className="rounded border border-border bg-background px-1 py-0.5 text-foreground" />
                <button type="button" onClick={() => remove(c.id)} className="underline text-muted-foreground">Quitar</button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
