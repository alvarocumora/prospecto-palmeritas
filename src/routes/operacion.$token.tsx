import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getOperacionByToken,
  requestOperacionUpload,
  attachOperacionDoc,
  acceptOperacionTerms,
} from "@/lib/tradeOps.functions";
import { publicUrl } from "@/lib/publicUrl";
import { supabase } from "@/integrations/supabase/client";
import { DOC_CATALOG, DOC_BY_KEY } from "@/lib/tradeDocuments";

export const Route = createFileRoute("/operacion/$token")({
  head: () => ({
    meta: [
      { title: "Operación · Panel de contraparte — Geocapitals" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: OperacionMirror,
});

function fmtMoney(n: number | null | undefined, unit = "US$") {
  if (n == null) return "—";
  return `${unit} ${Math.round(n).toLocaleString("es-CL")}`;
}

function OperacionMirror() {
  const { token } = Route.useParams();
  const fn = useServerFn(getOperacionByToken);
  const { data, isLoading, error } = useQuery({
    queryKey: ["operacion", token],
    queryFn: () => fn({ data: { token } }),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  return (
    <div
      data-theme="im-light"
      className="min-h-screen bg-[hsl(var(--im-paper))] text-[hsl(var(--im-ink))]"
    >
      <header className="border-b border-[hsl(var(--im-hairline))]">
        <div className="mx-auto max-w-5xl px-6 py-5 flex items-center justify-between">
          <a href={publicUrl("/")} className="font-serif text-2xl tracking-tight">
            GEOCAPITALS
          </a>
          <span className="text-xs uppercase tracking-[0.2em] text-[hsl(var(--im-ink-soft))]">
            Panel de contraparte
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        {isLoading && <p className="text-sm text-[hsl(var(--im-ink-soft))]">Cargando operación…</p>}
        {(error || (!isLoading && !data)) && (
          <div className="rounded-lg border border-[hsl(var(--im-hairline))] p-8 bg-white">
            <h1 className="font-serif text-2xl mb-2">Enlace no válido</h1>
            <p className="text-sm text-[hsl(var(--im-ink-soft))]">
              El enlace expiró o no corresponde a una operación activa. Solicítelo nuevamente a su
              contraparte en Geocapitals.
            </p>
          </div>
        )}
        {data && (
          <>
            <section className="rounded-lg border border-[hsl(var(--im-hairline))] bg-white p-8">
              <p className="text-xs uppercase tracking-[0.2em] text-[hsl(var(--im-accent-brand))]">
                Rol asignado: {data.role === "buyer" ? "Comprador" : "Vendedor"}
              </p>
              <h1 className="font-serif text-3xl mt-2">
                {data.trade.reference ?? "Operación en curso"}
              </h1>
              <p className="text-sm text-[hsl(var(--im-ink-soft))] mt-1">
                Contraparte registrada: {data.counterparty.company ?? data.counterparty.name ?? "—"}
              </p>
              <p className="text-xs uppercase tracking-[0.2em] text-[hsl(var(--im-accent-brand))] mt-2">
                Operado por Geocapitals
              </p>

              <dl className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-8 text-sm">
                <div>
                  <dt className="uppercase text-[10px] tracking-[0.2em] text-[hsl(var(--im-ink-soft))]">
                    Commodity
                  </dt>
                  <dd className="mt-1 font-medium">{data.trade.commodity ?? "—"}</dd>
                </div>
                <div>
                  <dt className="uppercase text-[10px] tracking-[0.2em] text-[hsl(var(--im-ink-soft))]">
                    Cantidad
                  </dt>
                  <dd className="mt-1 font-medium">
                    {data.trade.quantity_t != null
                      ? `${data.trade.quantity_t.toLocaleString("es-CL")} t`
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="uppercase text-[10px] tracking-[0.2em] text-[hsl(var(--im-ink-soft))]">
                    Incoterm
                  </dt>
                  <dd className="mt-1 font-medium">{data.trade.incoterm ?? "—"}</dd>
                </div>
                <div>
                  <dt className="uppercase text-[10px] tracking-[0.2em] text-[hsl(var(--im-ink-soft))]">
                    Valor total
                  </dt>
                  <dd className="mt-1 font-medium">{fmtMoney(data.trade.total_value_usd)}</dd>
                </div>
                <div>
                  <dt className="uppercase text-[10px] tracking-[0.2em] text-[hsl(var(--im-ink-soft))]">
                    Etapa
                  </dt>
                  <dd className="mt-1 font-medium uppercase">{data.trade.stage}</dd>
                </div>
                <div>
                  <dt className="uppercase text-[10px] tracking-[0.2em] text-[hsl(var(--im-ink-soft))]">
                    Estado
                  </dt>
                  <dd className="mt-1 font-medium uppercase">{data.trade.status}</dd>
                </div>
                <div>
                  <dt className="uppercase text-[10px] tracking-[0.2em] text-[hsl(var(--im-ink-soft))]">
                    Documentos
                  </dt>
                  <dd className="mt-1 font-medium">{data.docsCount}</dd>
                </div>
                <div>
                  <dt className="uppercase text-[10px] tracking-[0.2em] text-[hsl(var(--im-ink-soft))]">
                    Embarques
                  </dt>
                  <dd className="mt-1 font-medium">{data.shipments.length}</dd>
                </div>
              </dl>
            </section>

            <section className="mt-8 grid md:grid-cols-2 gap-6">
              <div className="rounded-lg border border-[hsl(var(--im-hairline))] bg-white p-6">
                <h2 className="font-serif text-xl mb-4">Bitácora de la operación</h2>
                {data.events.length === 0 && (
                  <p className="text-sm text-[hsl(var(--im-ink-soft))]">
                    Sin eventos registrados aún.
                  </p>
                )}
                <ol className="space-y-3 text-sm">
                  {data.events.map((e, i) => (
                    <li key={i} className="border-l-2 border-[hsl(var(--im-accent-brand))] pl-3">
                      <p className="uppercase text-[10px] tracking-[0.2em] text-[hsl(var(--im-ink-soft))]">
                        {new Date(e.created_at).toLocaleString("es-CL")} · {e.kind}
                      </p>
                      <p className="mt-0.5">{e.detail ?? "—"}</p>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="rounded-lg border border-[hsl(var(--im-hairline))] bg-white p-6">
                <h2 className="font-serif text-xl mb-4">Embarques</h2>
                {data.shipments.length === 0 && (
                  <p className="text-sm text-[hsl(var(--im-ink-soft))]">
                    Aún no se ha registrado embarque.
                  </p>
                )}
                <ul className="space-y-4 text-sm">
                  {data.shipments.map((s, i) => (
                    <li
                      key={i}
                      className="border-b border-[hsl(var(--im-hairline))] pb-3 last:border-0"
                    >
                      <p className="font-medium">{s.reference ?? s.vessel_name ?? "Embarque"}</p>
                      <p className="text-[hsl(var(--im-ink-soft))]">
                        {s.port_loading ?? "—"} → {s.port_discharge ?? "—"} · ETA {s.eta ?? "—"}
                      </p>
                      <p className="uppercase text-[10px] tracking-[0.2em] mt-1">{s.status}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <AcceptTermsPanel
              token={token}
              role={data.role}
              alreadyAccepted={data.events.some(
                (e) => e.kind === "terms_accepted_by_counterparty",
              )}
              defaultName={data.counterparty.name ?? ""}
            />

            <DocsUpload token={token} documents={data.documents} />

            <p className="mt-10 text-xs text-[hsl(var(--im-ink-soft))]">
              Este panel es un enlace privado. No lo comparta con terceros. Para dudas escriba a
              info@geocapitals.com.
            </p>
          </>
        )}
      </main>
    </div>
  );
}

const isProvided = (s: string) => s === "uploaded" || s === "signed" || s === "verified";

function DocsUpload({
  token,
  documents,
}: {
  token: string;
  documents: Array<{ doc_type: string; status: string; file_name: string | null }>;
}) {
  const qc = useQueryClient();
  const reqFn = useServerFn(requestOperacionUpload);
  const attachFn = useServerFn(attachOperacionDoc);
  const [docType, setDocType] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const upload = async (chosenType: string, file: File) => {
    if (!chosenType) return toast.error("Elige el tipo de documento.");
    if (file.size > 50 * 1024 * 1024) return toast.error("Máximo 50 MB por archivo.");
    setBusy(chosenType);
    try {
      const {
        path,
        token: upToken,
        bucket,
      } = await reqFn({
        data: { token, fileName: file.name },
      });
      const up = await supabase.storage.from(bucket).uploadToSignedUrl(path, upToken, file);
      if (up.error) throw up.error;
      await attachFn({ data: { token, docType: chosenType, filePath: path } });
      toast.success(`Documento enviado: ${file.name}`);
      setDocType("");
      void qc.invalidateQueries({ queryKey: ["operacion", token] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo subir el documento.");
    } finally {
      setBusy(null);
    }
  };

  const label = (k: string) => DOC_BY_KEY[k]?.label ?? k;
  const requested = documents.filter((d) => !isProvided(d.status));
  const provided = documents.filter((d) => isProvided(d.status));

  return (
    <section className="mt-8 rounded-lg border border-[hsl(var(--im-hairline))] bg-white p-6">
      <h2 className="font-serif text-xl mb-1">Documentos de la operación</h2>
      <p className="text-sm text-[hsl(var(--im-ink-soft))] mb-4">
        Sube aquí los documentos solicitados por tu contraparte en Geocapitals.
      </p>

      {requested.length > 0 && (
        <div className="mb-4">
          <p className="uppercase text-[10px] tracking-[0.2em] text-[hsl(var(--im-ink-soft))] mb-2">
            Solicitados
          </p>
          <ul className="space-y-2">
            {requested.map((d) => (
              <li
                key={d.doc_type}
                className="flex items-center justify-between gap-3 border-b border-[hsl(var(--im-hairline))] pb-2 last:border-0"
              >
                <span className="text-sm">{label(d.doc_type)}</span>
                <label className="text-xs px-3 py-1.5 rounded border border-[hsl(var(--im-hairline))] cursor-pointer hover:border-[hsl(var(--im-accent-brand))]">
                  {busy === d.doc_type ? "Subiendo…" : "Subir archivo"}
                  <input
                    type="file"
                    className="hidden"
                    disabled={busy != null}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (f) void upload(d.doc_type, f);
                    }}
                  />
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      {provided.length > 0 && (
        <div className="mb-4">
          <p className="uppercase text-[10px] tracking-[0.2em] text-[hsl(var(--im-ink-soft))] mb-2">
            Recibidos
          </p>
          <ul className="space-y-1 text-sm">
            {provided.map((d) => (
              <li key={d.doc_type} className="flex items-center gap-2">
                <span className="text-[hsl(var(--im-accent-brand))]">✓</span>
                {label(d.doc_type)}
                {d.file_name ? (
                  <span className="text-[hsl(var(--im-ink-soft))]">· {d.file_name}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Subir un documento adicional (no solicitado explícitamente) */}
      <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-[hsl(var(--im-hairline))]">
        <span className="text-xs text-[hsl(var(--im-ink-soft))]">Otro documento:</span>
        <select
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          className="text-xs px-2 py-1.5 rounded border border-[hsl(var(--im-hairline))] bg-white"
        >
          <option value="">Tipo…</option>
          {DOC_CATALOG.map((d) => (
            <option key={d.key} value={d.key}>
              {d.label}
            </option>
          ))}
        </select>
        <label
          className={`text-xs px-3 py-1.5 rounded border border-[hsl(var(--im-hairline))] ${
            docType ? "cursor-pointer hover:border-[hsl(var(--im-accent-brand))]" : "opacity-50"
          }`}
        >
          {busy === docType && docType ? "Subiendo…" : "Subir archivo"}
          <input
            type="file"
            className="hidden"
            disabled={!docType || busy != null}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void upload(docType, f);
            }}
          />
        </label>
      </div>
    </section>
  );
}
