import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FolderLock } from "lucide-react";
import {
  LEAD_STATUSES,
  listCollateralLeads,
  setCollateralLeadStatus,
  type LeadStatus,
} from "@/lib/investor/collateral.functions";
import { fmtClp, monthlyInterestClp } from "@/lib/investor/collateralProgram";

export const Route = createFileRoute("/_authenticated/dashboard/colateral-leads")({
  head: () => ({ meta: [{ title: "Solicitudes · Inversión con colateral — Geocapitals" }] }),
  component: LeadsPage,
});

const LABEL: Record<LeadStatus, string> = {
  new: "Nueva",
  contacted: "Contactado",
  qualified: "Calificado",
  discarded: "Descartado",
};
const PREF: Record<string, string> = {
  hualane: "Hualañé",
  "valle-escondido": "Licantén",
  indiferente: "Indiferente",
};

function LeadsPage() {
  const list = useServerFn(listCollateralLeads);
  const setStatus = useServerFn(setCollateralLeadStatus);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["collateral-leads"], queryFn: () => list() });
  const mut = useMutation({
    mutationFn: (v: { id: string; status: LeadStatus }) => setStatus({ data: v }),
    onSuccess: () => {
      toast.success("Estado actualizado");
      void qc.invalidateQueries({ queryKey: ["collateral-leads"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const rows = q.data ?? [];
  const total = rows.filter((r) => r.status !== "discarded").reduce((a, r) => a + r.amount_clp, 0);

  return (
    <div data-theme="im-light" className="min-h-screen bg-surface text-content">
      <div className="max-w-6xl mx-auto p-4 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-hairline pb-6">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-accent-brand">
              Inversión con colateral
            </p>
            <h1 className="font-serif text-3xl mt-2">Solicitudes de inversionistas</h1>
            <p className="text-sm text-content-subtle mt-1">
              Llegan desde el simulador público. Marca "Calificado" para darle acceso a los
              documentos legales de los valles.
            </p>
          </div>
          <Link
            to="/dashboard/colateral-documentos"
            className="inline-flex items-center gap-2 h-10 px-4 border border-hairline text-sm hover:border-accent-brand"
          >
            <FolderLock className="w-4 h-4" /> Documentos legales
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-hairline border border-hairline mt-6">
          {[
            { l: "Solicitudes", v: String(rows.length) },
            { l: "Nuevas", v: String(rows.filter((r) => r.status === "new").length) },
            { l: "Calificadas", v: String(rows.filter((r) => r.status === "qualified").length) },
            { l: "Monto en conversación", v: fmtClp(total) },
          ].map((k) => (
            <div key={k.l} className="bg-surface p-4">
              <div className="font-mono text-xl">{k.v}</div>
              <div className="text-xs text-content-subtle">{k.l}</div>
            </div>
          ))}
        </div>

        {q.isError && <p className="mt-6 text-sm text-destructive">{(q.error as Error).message}</p>}
        {q.isLoading && <p className="mt-6 text-sm text-content-subtle">Cargando…</p>}
        {!q.isLoading && rows.length === 0 && !q.isError && (
          <p className="mt-6 border border-dashed border-hairline p-6 text-sm text-content-subtle">
            Aún no hay solicitudes. Comparte la página pública /inversion-colateral.
          </p>
        )}

        <div className="mt-6 space-y-3">
          {rows.map((r) => (
            <article
              key={r.id}
              className="border border-hairline p-4 grid md:grid-cols-[1.4fr_1fr_auto] gap-4"
            >
              <div>
                <div className="font-medium">{r.name}</div>
                <div className="text-sm text-content-subtle">
                  <a href={`mailto:${r.email}`} className="hover:text-accent-brand">
                    {r.email}
                  </a>
                  {r.phone && (
                    <>
                      {" "}
                      ·{" "}
                      <a
                        href={`https://wa.me/${r.phone.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-accent-brand"
                      >
                        {r.phone}
                      </a>
                    </>
                  )}
                </div>
                {r.message && <p className="text-sm mt-2">{r.message}</p>}
                <div className="text-[11px] font-mono text-content-subtle mt-2">
                  {new Date(r.created_at).toLocaleString("es-CL")}
                </div>
              </div>
              <dl className="text-sm space-y-1">
                <div className="flex justify-between gap-2">
                  <dt className="text-content-subtle">Monto</dt>
                  <dd className="font-mono">{fmtClp(r.amount_clp)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-content-subtle">Plazo</dt>
                  <dd className="font-mono">{r.months} meses</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-content-subtle">Interés/mes</dt>
                  <dd className="font-mono">{fmtClp(monthlyInterestClp(r.amount_clp))}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-content-subtle">Valle</dt>
                  <dd>{PREF[r.project_pref ?? "indiferente"] ?? r.project_pref}</dd>
                </div>
              </dl>
              <select
                aria-label="Estado"
                value={r.status}
                disabled={mut.isPending}
                onChange={(e) => mut.mutate({ id: r.id, status: e.target.value as LeadStatus })}
                className="brand-input h-10 self-start"
              >
                {LEAD_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {LABEL[s]}
                  </option>
                ))}
              </select>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
