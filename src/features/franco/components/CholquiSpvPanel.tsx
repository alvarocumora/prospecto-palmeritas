import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Download, Loader2, Plus, Users } from "lucide-react";
import { getSpvOverview, saveSpvPosition, type SpvPosition } from "@/lib/spv.functions";
import { downloadSpvCertificate } from "../spvCertificatePdf";
import { CHOLQUI } from "../data/cholqui";
import { CholquiStagePanel } from "./CholquiStagePanel";

function pctOf(shares: number, total: number): string {
  if (!total) return "—";
  return `${((shares / total) * 100).toFixed(4)} %`;
}

export function CholquiSpvPanel({
  projectCode = "CHOLQUI",
  projectName = CHOLQUI.name,
}: {
  projectCode?: string;
  projectName?: string;
} = {}) {
  const qc = useQueryClient();
  const overviewFn = useServerFn(getSpvOverview);
  const saveFn = useServerFn(saveSpvPosition);

  const { data, isLoading } = useQuery({
    queryKey: ["spv-overview", projectCode],
    queryFn: () => overviewFn({ data: { projectCode: projectCode } }),
  });

  const [form, setForm] = useState({
    investorName: "",
    investorEmail: "",
    investorUserId: "",
    shares: "",
    amountPaid: "",
    instrument: "equity",
    subscribedOn: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          projectCode: projectCode,
          investorName: form.investorName.trim(),
          investorEmail: form.investorEmail.trim() || null,
          investorUserId: form.investorUserId.trim() || null,
          shares: Number(form.shares || 0),
          amountPaid: Number(form.amountPaid || 0),
          currency: "CLP",
          instrument: form.instrument,
          subscribedOn: form.subscribedOn,
          status: "active" as const,
          notes: form.notes.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("Posición registrada");
      setForm((f) => ({ ...f, investorName: "", investorEmail: "", shares: "", amountPaid: "" }));
      qc.invalidateQueries({ queryKey: ["spv-overview", projectCode] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo registrar"),
  });

  const total = data?.spv?.total_shares ?? 0;
  const subscribed = useMemo(
    () =>
      (data?.positions ?? [])
        .filter((p) => p.status === "active")
        .reduce((s, p) => s + Number(p.shares), 0),
    [data],
  );

  async function certificate(p: SpvPosition) {
    if (!data?.spv) return;
    try {
      await downloadSpvCertificate({
        spv: data.spv,
        position: p,
        projectName,
        verifyPath: CHOLQUI.liveUrl,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo generar el certificado");
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-content-subtle px-6 py-8">
        <Loader2 className="w-4 h-4 animate-spin" /> Cargando participación…
      </div>
    );
  }

  const spv = data?.spv ?? null;
  const isStaff = !!data?.isStaff;
  const mine = data?.myPositions ?? [];

  return (
    <div className="space-y-6">
      <section className="border border-hairline bg-white rounded-2xl overflow-hidden">
        <header className="px-6 py-5 border-b border-hairline">
          <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-accent-brand flex items-center gap-2">
            <Users className="w-3.5 h-3.5" />
            Sociedad operadora · SPV
          </div>
          <h2 className="font-display text-2xl mt-1 text-content">
            {spv?.legal_name ?? "SPV no registrada"}
          </h2>
          {spv?.notes && <p className="text-sm text-content-subtle mt-1">{spv.notes}</p>}
        </header>

        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-hairline border-b border-hairline bg-surface-2">
          {(
            [
              ["Acciones emitidas", total ? total.toLocaleString("es-CL") : "por confirmar"],
              ["Acciones suscritas", subscribed.toLocaleString("es-CL")],
              ["Participación colocada", total ? pctOf(subscribed, total) : "—"],
              ["RUT", spv?.rut ?? "por acreditar"],
            ] as Array<[string, string]>
          ).map(([k, v]) => (
            <div key={k} className="px-5 py-4">
              <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle">
                {k}
              </div>
              <div className="mt-1 text-lg font-display text-content">{v}</div>
            </div>
          ))}
        </div>

        <div className="px-6 py-5">
          <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle mb-3">
            {isStaff ? "Cap table completo" : "Mi participación"}
          </div>
          {(data?.positions ?? []).length === 0 ? (
            <p className="text-sm text-content-subtle">
              {isStaff
                ? "Sin inversionistas registrados todavía."
                : "No hay una participación asociada a tu cuenta en esta sociedad."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-content-subtle border-b border-hairline">
                    <th className="py-2 pr-3 font-mono font-normal">Inversionista</th>
                    <th className="py-2 pr-3 font-mono font-normal text-right">Acciones</th>
                    <th className="py-2 pr-3 font-mono font-normal text-right">%</th>
                    <th className="py-2 pr-3 font-mono font-normal text-right">Monto</th>
                    <th className="py-2 pr-3 font-mono font-normal">Fecha</th>
                    <th className="py-2 pr-3 font-mono font-normal">Estado</th>
                    <th className="py-2 font-mono font-normal" />
                  </tr>
                </thead>
                <tbody>
                  {(data?.positions ?? []).map((p) => (
                    <tr key={p.id} className="border-b border-hairline/60">
                      <td className="py-2 pr-3 text-content">
                        {p.investor_name}
                        {p.investor_email && (
                          <span className="block text-content-subtle">{p.investor_email}</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono text-content">
                        {Number(p.shares).toLocaleString("es-CL")}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono text-content-subtle">
                        {pctOf(Number(p.shares), total)}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono text-content-subtle">
                        {p.currency} {Number(p.amount_paid).toLocaleString("es-CL")}
                      </td>
                      <td className="py-2 pr-3 font-mono text-content-subtle">{p.subscribed_on}</td>
                      <td className="py-2 pr-3 text-content-subtle">
                        {p.status === "active" ? "Vigente" : "Anulado"}
                      </td>
                      <td className="py-2 text-right">
                        {(isStaff || mine.some((m) => m.id === p.id)) && spv && (
                          <button
                            type="button"
                            onClick={() => certificate(p)}
                            className="inline-flex items-center gap-1.5 border border-hairline rounded-lg px-2.5 py-1.5 hover:border-accent-brand"
                          >
                            <Download className="w-3 h-3" />
                            Certificado
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {isStaff && spv && (
          <div className="px-6 py-5 border-t border-hairline bg-surface-2">
            <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle mb-3">
              Registrar posición (pago confirmado fuera de la plataforma)
            </div>
            <div className="grid md:grid-cols-3 gap-3">
              {(
                [
                  ["investorName", "Nombre del inversionista", "text"],
                  ["investorEmail", "Correo", "email"],
                  ["investorUserId", "User ID (opcional)", "text"],
                  ["shares", "Acciones", "number"],
                  ["amountPaid", "Monto pagado (CLP)", "number"],
                  ["subscribedOn", "Fecha de suscripción", "date"],
                ] as Array<[keyof typeof form, string, string]>
              ).map(([key, label, type]) => (
                <label key={key} className="block">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-content-subtle">
                    {label}
                  </span>
                  <input
                    type={type}
                    value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="mt-1 w-full border border-hairline rounded-lg px-3 py-2 text-sm bg-white text-content"
                  />
                </label>
              ))}
            </div>
            <button
              type="button"
              disabled={save.isPending || !form.investorName || !form.shares}
              onClick={() => save.mutate()}
              className="mt-4 inline-flex items-center gap-2 bg-accent-brand text-accent-brand-contrast rounded-lg px-4 py-2 text-sm disabled:opacity-50"
            >
              {save.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Registrar posición
            </button>
          </div>
        )}
      </section>

      <CholquiStagePanel
        stages={data?.stages ?? []}
        metrics={data?.metrics ?? []}
        certifications={data?.certifications ?? []}
      />
    </div>
  );
}
