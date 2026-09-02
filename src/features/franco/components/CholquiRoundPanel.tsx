import { CHOLQUI, CHOLQUI_ROUND, fmtUsd } from "../data/cholqui";

export function CholquiRoundPanel() {
  return (
    <section className="border border-hairline bg-white rounded-2xl overflow-hidden">
      <header className="px-6 py-5 border-b border-hairline">
        <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-accent-brand">
          Estructura de inversión · referencial
        </div>
        <h2 className="font-display text-2xl mt-1 text-content">Qué obtiene el inversionista</h2>
      </header>

      <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-hairline">
        <div className="px-6 py-5 space-y-3">
          {(
            [
              [
                "Valorización",
                `${fmtUsd(CHOLQUI_ROUND.valuationLowUsd)} – ${fmtUsd(CHOLQUI_ROUND.valuationHighUsd)}`,
              ],
              ["Ronda", fmtUsd(CHOLQUI_ROUND.roundSizeUsd)],
              ["Ticket mínimo", fmtUsd(CHOLQUI_ROUND.minTicketUsd)],
              ["Instrumento", `${CHOLQUI_ROUND.instrument} · ${CHOLQUI_ROUND.equityOfferedPct}%`],
              ["Horizonte", `${CHOLQUI_ROUND.horizonYears} años`],
            ] as Array<[string, string]>
          ).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-b border-hairline pb-2">
              <span className="text-xs text-content-subtle">{k}</span>
              <span className="text-sm text-content text-right">{v}</span>
            </div>
          ))}
          <p className="text-[11px] text-content-subtle">
            Método: {CHOLQUI_ROUND.valuationMethod}.
          </p>
        </div>

        <div className="px-6 py-5">
          <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle mb-3">
            Uso de fondos
          </div>
          <div className="space-y-2.5">
            {CHOLQUI_ROUND.useOfFunds.map((u) => (
              <div key={u.label}>
                <div className="flex justify-between text-xs text-content-muted">
                  <span>{u.label}</span>
                  <span className="font-mono">{u.pct}%</span>
                </div>
                <div className="h-1.5 mt-1 bg-surface-2 rounded-sm overflow-hidden">
                  <div className="h-full bg-accent-brand" style={{ width: `${u.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 py-5">
          <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle mb-3">
            Hitos de de-risking
          </div>
          <ol className="space-y-3">
            {CHOLQUI_ROUND.milestones.map((m) => (
              <li key={m.when} className="border-l-2 border-accent-brand pl-3">
                <div className="text-[11px] font-mono text-accent-brand">{m.when}</div>
                <div className="text-xs text-content">{m.what}</div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <footer className="px-6 py-4 border-t border-hairline bg-surface-2 text-[11px] text-content-subtle">
        Términos referenciales, base de conversación. No constituyen oferta pública y están sujetos
        a due diligence, NDA y acuerdo definitivo. Contacto del titular: {CHOLQUI.contact.name} ·{" "}
        {CHOLQUI.contact.email} · {CHOLQUI.contact.phone}.
      </footer>
    </section>
  );
}
