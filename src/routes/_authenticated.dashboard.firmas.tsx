import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileSignature, ArrowRight, Ban, CheckCircle2, Clock, XCircle } from "lucide-react";
import {
  listMySignRequests,
  voidSignRequest,
  type SignRequestRow,
} from "@/lib/documents/signing.functions";

// Panel único de solicitudes de firma emitidas por el usuario: estado real
// (pendiente / firmado / expirado / anulado) y anulación de links pendientes.

export const Route = createFileRoute("/_authenticated/dashboard/firmas")({
  head: () => ({ meta: [{ title: "Mis solicitudes de firma — Geocapitals" }] }),
  component: FirmasPage,
});

type EffectiveStatus = "signed" | "pending" | "expired" | "void";

function effectiveStatus(r: SignRequestRow, now: Date): EffectiveStatus {
  if (r.status === "signed") return "signed";
  if (r.status === "void") return "void";
  if (r.status === "pending" && new Date(r.expires_at) < now) return "expired";
  return r.status === "pending" ? "pending" : "void";
}

const STATUS_META: Record<
  EffectiveStatus,
  { label: string; cls: string; icon: typeof CheckCircle2 }
> = {
  signed: {
    label: "Firmado",
    cls: "bg-green-500/15 text-green-700 border-green-500/30",
    icon: CheckCircle2,
  },
  pending: {
    label: "Pendiente",
    cls: "bg-amber-500/15 text-amber-700 border-amber-500/30",
    icon: Clock,
  },
  expired: {
    label: "Expirado",
    cls: "bg-muted text-muted-foreground border-border",
    icon: XCircle,
  },
  void: {
    label: "Anulado",
    cls: "bg-muted text-muted-foreground border-border",
    icon: Ban,
  },
};

function FirmasPage() {
  const listFn = useServerFn(listMySignRequests);
  const voidFn = useServerFn(voidSignRequest);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["my-sign-requests"],
    queryFn: () => listFn(),
    staleTime: 30_000,
  });
  const [voiding, setVoiding] = useState<string | null>(null);

  const now = new Date();
  const rows = data ?? [];
  const counts = useMemo(() => {
    const c = { signed: 0, pending: 0, expired: 0, void: 0 };
    for (const r of rows) c[effectiveStatus(r, now)]++;
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const onVoid = async (r: SignRequestRow) => {
    if (!window.confirm(`¿Anular la solicitud de firma de "${r.title}"? El link dejará de servir.`))
      return;
    setVoiding(r.id);
    try {
      await voidFn({ data: { id: r.id } });
      toast.success("Solicitud anulada. El link ya no permite firmar.");
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo anular.");
    } finally {
      setVoiding(null);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1100px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FileSignature className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-semibold">Mis solicitudes de firma</h1>
          </div>
          <p className="text-xs text-text-secondary mt-0.5">
            Estado de cada documento que enviaste a firma electrónica. Anula los links pendientes
            que ya no quieras vigentes.
          </p>
        </div>
        <Link
          to="/dashboard/documentos"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-border text-sm hover:bg-accent"
        >
          Nuevo documento <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Resumen por estado */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(["pending", "signed", "expired", "void"] as EffectiveStatus[]).map((s) => {
          const M = STATUS_META[s];
          return (
            <div key={s} className="rounded-md border border-border bg-bg-secondary/20 p-3">
              <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                <M.icon className="w-3.5 h-3.5" /> {M.label}
              </div>
              <div className="text-2xl font-mono font-bold mt-1">{counts[s]}</div>
            </div>
          );
        })}
      </div>

      {isLoading ? (
        <div className="h-40 rounded bg-muted/20 animate-pulse" />
      ) : rows.length === 0 ? (
        <div className="rounded-md border border-border p-8 text-center text-sm text-text-secondary">
          Todavía no has enviado documentos a firma. Genera un NDA, SPA o Data Sheet desde{" "}
          <Link to="/dashboard/documentos" className="text-primary underline">
            Documentos
          </Link>{" "}
          y pulsa «Solicitar firma».
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-left text-[10px] font-mono uppercase tracking-wider text-muted-foreground border-b border-border bg-bg-secondary/30">
                <th className="px-4 py-2.5">Documento</th>
                <th className="px-4 py-2.5">Firmante</th>
                <th className="px-4 py-2.5">Estado</th>
                <th className="px-4 py-2.5">Fecha</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => {
                const st = effectiveStatus(r, now);
                const M = STATUS_META[st];
                return (
                  <tr key={r.id} className="hover:bg-accent/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.title}</div>
                      <div className="text-[11px] font-mono text-muted-foreground">
                        {r.reference} · {r.template_id.toUpperCase()}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {r.signed_by_name ?? r.signer_name_expected ?? (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border ${M.cls}`}
                      >
                        <M.icon className="w-3 h-3" /> {M.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {st === "signed" && r.signed_at
                        ? `Firmado ${new Date(r.signed_at).toLocaleDateString("es-CL")}`
                        : st === "pending"
                          ? `Vence ${new Date(r.expires_at).toLocaleDateString("es-CL")}`
                          : new Date(r.created_at).toLocaleDateString("es-CL")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {st === "pending" && (
                        <button
                          onClick={() => void onVoid(r)}
                          disabled={voiding === r.id}
                          className="text-[11px] font-mono text-red-500 hover:underline inline-flex items-center gap-1 disabled:opacity-50"
                        >
                          <Ban className="w-3 h-3" /> Anular
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
