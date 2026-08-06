import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getOperacionByToken,
  requestOperacionUpload,
  attachOperacionDoc,
  acceptOperacionTerms,
  getOperacionChecklist,
} from "@/lib/tradeOps.functions";
import { publicUrl } from "@/lib/publicUrl";
import { supabase } from "@/integrations/supabase/client";
import { DOC_CATALOG, DOC_BY_KEY } from "@/lib/tradeDocuments";
import { TradeComplianceChecklist } from "@/features/trades/TradeComplianceChecklist";
import { PortalGate, portalSessionKey } from "@/features/operations/PortalGate";
import { PortalDocGenPanel } from "@/features/operations/PortalDocGenPanel";

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
  const [session, setSession] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setSession(window.localStorage.getItem(portalSessionKey(token)));
    } catch {
      setSession(null);
    }
    setReady(true);
  }, [token]);

  const clearSession = useCallback(() => {
    try {
      window.localStorage.removeItem(portalSessionKey(token));
    } catch {
      /* ignore */
    }
    setSession(null);
  }, [token]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["operacion", token, session],
    enabled: ready && !!session,
    queryFn: () => fn({ data: { token, session: session as string } }),
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: false,
  });

  // Sesión vencida o revocada -> volver a la puerta de acceso.
  useEffect(() => {
    if (session && ready && !isLoading && (error || data === null)) clearSession();
  }, [session, ready, isLoading, error, data, clearSession]);

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
        {!ready && <p className="text-sm text-[hsl(var(--im-ink-soft))]">Verificando acceso…</p>}
        {ready && !session && (
          <PortalGate
            token={token}
            onGranted={(s) => {
              try {
                window.localStorage.setItem(portalSessionKey(token), s);
              } catch {
                /* ignore */
              }
              setSession(s);
            }}
          />
        )}
        {ready && session && isLoading && (
          <p className="text-sm text-[hsl(var(--im-ink-soft))]">Cargando operación…</p>
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
              session={session as string}
              role={data.role}
              alreadyAccepted={data.events.some(
                (e) => e.kind === "terms_accepted_by_counterparty",
              )}
              defaultName={data.counterparty.name ?? ""}
            />

            <ComplianceChecklistPublic token={token} session={session as string} />

            <PortalDocGenPanel token={token} session={session as string} />

            <DocsUpload token={token} session={session as string} documents={data.documents} />

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

function ComplianceChecklistPublic({ token, session }: { token: string; session: string }) {
  const qc = useQueryClient();
  const fetchFn = useServerFn(getOperacionChecklist);
  const reqFn = useServerFn(requestOperacionUpload);
  const attachFn = useServerFn(attachOperacionDoc);

  const onUpload = async (docKind: string, file: File) => {
    if (file.size > 50 * 1024 * 1024) {
      toast.error("Máximo 50 MB por archivo.");
      return;
    }
    try {
      const { path, token: upToken, bucket } = await reqFn({
        data: { token, session, fileName: file.name },
      });
      const up = await supabase.storage.from(bucket).uploadToSignedUrl(path, upToken, file);
      if (up.error) throw up.error;
      await attachFn({ data: { token, session, docType: docKind, filePath: path } });
      toast.success(`Documento enviado: ${file.name}`);
      void qc.invalidateQueries({ queryKey: ["operacion", token] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo subir el documento.");
    }
  };

  return (
    <div className="mt-8">
      <TradeComplianceChecklist
        fetcher={async () => {
          const r = await fetchFn({ data: { token, session } });
          return { rows: (r.rows ?? []) as any, readiness: (r.readiness ?? null) as any };
        }}
        queryKey={["operacion-checklist", token]}
        onUpload={onUpload}
        title="Checklist de compliance"
      />
    </div>
  );
}

const isProvided = (s: string) => s === "uploaded" || s === "signed" || s === "verified";


function DocsUpload({
  token,
  session,
  documents,
}: {
  token: string;
  session: string;
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
        data: { token, session, fileName: file.name },
      });
      const up = await supabase.storage.from(bucket).uploadToSignedUrl(path, upToken, file);
      if (up.error) throw up.error;
      await attachFn({ data: { token, session, docType: chosenType, filePath: path } });
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

// ---------- Aceptación de términos comerciales por contraparte ----------
function AcceptTermsPanel({
  token,
  session,
  role,
  alreadyAccepted,
  defaultName,
}: {
  token: string;
  session: string;
  role: "buyer" | "seller";
  alreadyAccepted: boolean;
  defaultName: string;
}) {
  const qc = useQueryClient();
  const acceptFn = useServerFn(acceptOperacionTerms);
  const [name, setName] = useState(defaultName ?? "");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [openForm, setOpenForm] = useState(false);

  const submit = async () => {
    if (name.trim().length < 2) return toast.error("Ingresa tu nombre completo.");
    setSaving(true);
    try {
      await acceptFn({
        data: {
          token,
          acceptorName: name.trim(),
          acceptorTitle: title.trim() || undefined,
          note: note.trim() || undefined,
        },
      });
      toast.success("Términos aceptados. Trazabilidad registrada.");
      void qc.invalidateQueries({ queryKey: ["operacion", token] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo registrar la aceptación.");
    } finally {
      setSaving(false);
    }
  };

  if (alreadyAccepted) {
    return (
      <section className="mt-8 rounded-lg border border-[hsl(var(--im-hairline))] bg-white p-6">
        <div className="flex items-center gap-2">
          <span className="text-[hsl(var(--im-accent-brand))] text-lg">✓</span>
          <h2 className="font-serif text-xl">Términos comerciales aceptados</h2>
        </div>
        <p className="text-sm text-[hsl(var(--im-ink-soft))] mt-2">
          La aceptación quedó registrada en la bitácora con fecha, rol y firmante. Continúe cargando
          los documentos POP / Shipping abajo para avanzar la operación.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-lg border border-[hsl(var(--im-hairline))] bg-white p-6">
      <h2 className="font-serif text-xl mb-1">Aceptación de términos comerciales</h2>
      <p className="text-sm text-[hsl(var(--im-ink-soft))] mb-3">
        Como {role === "seller" ? "vendedor" : "comprador"}, confirme que ha leído y acepta las
        condiciones (commodity, volumen 1,500 MT/mes × 12 meses, CIF Florida, pago SWIFT MT103,
        inspección independiente). La aceptación se registra en la bitácora y habilita el envío del
        SPA definitivo. No sustituye la firma del SPA.
      </p>
      {!openForm ? (
        <button
          onClick={() => setOpenForm(true)}
          className="px-4 py-2 rounded bg-[hsl(var(--im-accent-brand))] text-white text-sm font-medium hover:opacity-90"
        >
          Aceptar términos comerciales
        </button>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3 mt-2">
          <label className="text-xs">
            <span className="block text-[hsl(var(--im-ink-soft))] mb-1">Nombre completo *</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded border border-[hsl(var(--im-hairline))] bg-white text-sm"
            />
          </label>
          <label className="text-xs">
            <span className="block text-[hsl(var(--im-ink-soft))] mb-1">Cargo / representación</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Representante legal, Director Comercial…"
              className="w-full px-3 py-2 rounded border border-[hsl(var(--im-hairline))] bg-white text-sm"
            />
          </label>
          <label className="text-xs sm:col-span-2">
            <span className="block text-[hsl(var(--im-ink-soft))] mb-1">Nota (opcional)</span>
            <textarea
              value={note}
              rows={2}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Comentarios, condiciones adicionales o pedidos de ajuste al SPA."
              className="w-full px-3 py-2 rounded border border-[hsl(var(--im-hairline))] bg-white text-sm"
            />
          </label>
          <div className="sm:col-span-2 flex items-center gap-2">
            <button
              onClick={() => void submit()}
              disabled={saving}
              className="px-4 py-2 rounded bg-[hsl(var(--im-accent-brand))] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Registrando…" : "Confirmar aceptación"}
            </button>
            <button
              onClick={() => setOpenForm(false)}
              className="px-3 py-2 text-sm text-[hsl(var(--im-ink-soft))]"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
