// Expediente KYC / compliance de la operación por parte (comprador y vendedor):
// carga de documentos, estado de revisión y descarga con URL firmada.

import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ShieldCheck, Upload, Loader2, Download, CheckCircle2, AlertTriangle } from "lucide-react";
import {
  listTradeKyc,
  uploadTradeKycDocument,
  reviewTradeKycDocument,
  getTradeKycFileUrl,
  KYC_CHECKLIST,
  type KycRow,
} from "@/lib/tradeKyc.functions";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  in_review: "En revisión",
  approved: "Aprobado",
  observed: "Observado",
};

const STATUS_CLASS: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  in_review: "bg-amber-500/10 text-amber-700",
  approved: "bg-green-600/10 text-green-700",
  observed: "bg-destructive/10 text-destructive",
};

async function fileToBase64(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) {
    bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

export function TradeKycPanel({ tradeId }: { tradeId: string }) {
  const qc = useQueryClient();
  const list = useServerFn(listTradeKyc);
  const upload = useServerFn(uploadTradeKycDocument);
  const review = useServerFn(reviewTradeKycDocument);
  const fileUrl = useServerFn(getTradeKycFileUrl);

  const [party, setParty] = useState<"buyer" | "seller">("buyer");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const q = useQuery({
    queryKey: ["trade-kyc", tradeId],
    queryFn: () => list({ data: { tradeId } }),
    staleTime: 15_000,
  });

  const byKey = useMemo(() => {
    const m = new Map<string, KycRow>();
    for (const r of (q.data ?? []) as KycRow[]) if (r.party === party) m.set(r.doc_key, r);
    return m;
  }, [q.data, party]);

  const refresh = () => void qc.invalidateQueries({ queryKey: ["trade-kyc", tradeId] });

  const onFile = async (docKey: string, label: string, file: File) => {
    if (file.size > 8 * 1024 * 1024) return toast.error("El archivo supera 8 MB.");
    setBusyKey(docKey);
    try {
      await upload({
        data: {
          tradeId,
          party,
          docKey,
          label,
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
          base64: await fileToBase64(file),
        },
      });
      toast.success("Documento cargado.");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo cargar el documento.");
    } finally {
      setBusyKey(null);
    }
  };

  const items = KYC_CHECKLIST[party];
  const approved = items.filter((i) => byKey.get(i.key)?.review_status === "approved").length;

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="h-4 w-4 text-primary" /> Expediente KYC y compliance
        </h2>
        <div className="flex items-center gap-1 text-xs">
          {(["buyer", "seller"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setParty(p)}
              className={`rounded px-2.5 py-1 ${
                party === p ? "bg-primary text-primary-foreground" : "border border-border"
              }`}
            >
              {p === "buyer" ? "Comprador" : "Vendedor"}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {approved} de {items.length} documentos aprobados. Los archivos se guardan cifrados y solo
        se entregan con enlaces firmados de 5 minutos.
      </p>

      <div className="mt-4 space-y-2">
        {items.map((item) => {
          const row = byKey.get(item.key);
          const status = row?.review_status ?? "pending";
          return (
            <div
              key={item.key}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded border border-border px-3 py-2 text-xs"
            >
              {status === "approved" ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
              ) : status === "observed" ? (
                <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
              ) : null}
              <span className="font-medium">{item.label}</span>
              <span className={`rounded px-1.5 py-0.5 ${STATUS_CLASS[status]}`}>
                {STATUS_LABEL[status]}
              </span>
              {row?.file_name ? (
                <span className="text-muted-foreground">{row.file_name}</span>
              ) : null}
              {row?.review_note ? (
                <span className="text-destructive">Nota: {row.review_note}</span>
              ) : null}

              <div className="ml-auto flex items-center gap-1.5">
                <input
                  ref={(el) => {
                    inputs.current[item.key] = el;
                  }}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onFile(item.key, item.label, f);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => inputs.current[item.key]?.click()}
                  disabled={busyKey === item.key}
                  className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 hover:bg-muted disabled:opacity-50"
                >
                  {busyKey === item.key ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  {row?.file_name ? "Reemplazar" : "Subir"}
                </button>
                {row ? (
                  <>
                    <button
                      type="button"
                      onClick={async () => {
                        const r = await fileUrl({ data: { id: row.id } });
                        if (r.url) window.open(r.url, "_blank", "noopener");
                        else toast.error("Archivo no disponible.");
                      }}
                      className="rounded border border-border p-1 hover:bg-muted"
                      title="Descargar"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                    <select
                      value={status}
                      onChange={async (e) => {
                        try {
                          await review({
                            data: {
                              id: row.id,
                              reviewStatus: e.target.value as "approved",
                              note:
                                e.target.value === "observed"
                                  ? (window.prompt("Observación para la contraparte:") ?? undefined)
                                  : undefined,
                            },
                          });
                          toast.success("Estado actualizado.");
                          refresh();
                        } catch {
                          toast.error("No se pudo actualizar el estado.");
                        }
                      }}
                      className="rounded border border-border bg-background px-1.5 py-1"
                    >
                      {Object.entries(STATUS_LABEL).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
