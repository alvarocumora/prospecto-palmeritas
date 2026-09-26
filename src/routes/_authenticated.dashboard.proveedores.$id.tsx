import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  addSupplierNote,
  extractCertificate,
  getInboxDetail,
  type InboxDetail,
  updateDocReview,
  updateSupplierStatus,
} from "@/lib/suppliers/inbox.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, CheckCircle2, Download, FileText, Sparkles, XCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/proveedores/$id")({
  head: () => ({
    meta: [
      { title: "Detalle de proveedor — Geocapitals" },
      {
        name: "description",
        content:
          "Ficha interna del proveedor: oferta, documentos, notas de revisión y extracción IA del certificado de análisis.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DetailPage,
});

type Sup = {
  id: string;
  folio: string;
  legal_name: string;
  country: string;
  status: string;
  contact_name: string;
  email: string;
  phone_e164: string;
  supplier_role: string;
};
type Off = {
  id: string;
  product: string;
  presentation: string | null;
  tonnage_available_t: number | null;
  grade_value: number | null;
  grade_unit: string | null;
  port_or_delivery: string | null;
  incoterm: string | null;
  price_ask: string | null;
  status: string;
};
type Doc = {
  id: string;
  doc_type: string;
  storage_path: string;
  mime_type: string | null;
  review_status: string;
  uploaded_at: string;
  signed_url: string | null;
};
type Note = { id: string; body: string; visibility: string; created_at: string };
type Ext = {
  id: string;
  document_id: string;
  created_at: string;
  fields: Record<string, unknown>;
  raw_text: string | null;
};

function DetailPage() {
  const { id } = Route.useParams();
  const load = useServerFn(getInboxDetail);
  const changeStatus = useServerFn(updateSupplierStatus);
  const reviewDoc = useServerFn(updateDocReview);
  const extract = useServerFn(extractCertificate);
  const addNote = useServerFn(addSupplierNote);

  const [data, setData] = useState<InboxDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [noteBody, setNoteBody] = useState("");
  const [noteVisibility, setNoteVisibility] = useState<"internal" | "supplier">("internal");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await load({ data: { id } });
      setData(res);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [load, id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (loading || !data) {
    return <div className="p-8 text-sm text-[hsl(var(--content-subtle))]">Cargando…</div>;
  }

  const supplier = data.supplier as unknown as Sup;
  const offers = data.offers as unknown as Off[];
  const documents = data.documents as unknown as Doc[];
  const notes = data.notes as unknown as Note[];
  const extractions = data.extractions as unknown as Ext[];
  const extractionByDoc = new Map<string, Ext>();
  for (const e of extractions)
    if (!extractionByDoc.has(e.document_id)) extractionByDoc.set(e.document_id, e);

  return (
    <div
      data-theme="im-light"
      className="min-h-screen bg-[hsl(var(--surface-paper))] text-[hsl(var(--content))]"
    >
      <div className="mx-auto max-w-5xl px-4 py-8">
        <Link
          to="/dashboard/proveedores"
          className="mb-6 inline-flex items-center gap-1 text-xs text-[hsl(var(--content-subtle))]"
        >
          <ArrowLeft className="h-3 w-3" /> Bandeja
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-[hsl(var(--content-subtle))]">
              Folio {supplier.folio} · {supplier.country}
            </div>
            <h1 className="mt-1 font-serif text-3xl">{supplier.legal_name}</h1>
            <p className="mt-1 text-sm text-[hsl(var(--content-subtle))]">
              {supplier.contact_name} · {supplier.email} · {supplier.phone_e164} · rol{" "}
              <em>{supplier.supplier_role}</em>
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="rounded-full bg-[hsl(var(--surface))] px-3 py-1 text-xs uppercase tracking-wide">
              {supplier.status.replace(/_/g, " ")}
            </span>
            <div className="flex flex-wrap gap-1">
              {(["en_revision", "verificado", "documentos_incompletos", "descartado"] as const).map(
                (s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={supplier.status === s ? "default" : "outline"}
                    disabled={busy === "status"}
                    onClick={async () => {
                      setBusy("status");
                      try {
                        await changeStatus({ data: { id, status: s } });
                        await refresh();
                      } finally {
                        setBusy(null);
                      }
                    }}
                  >
                    {s.replace(/_/g, " ")}
                  </Button>
                ),
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <section className="mt-10">
          <h2 className="font-serif text-xl">Oferta declarada</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            {offers.length === 0 && (
              <div className="text-sm text-[hsl(var(--content-subtle))]">
                Sin ofertas registradas.
              </div>
            )}
            {offers.map((o) => (
              <div key={o.id} className="rounded border border-[hsl(var(--hairline))] bg-white p-4">
                <div className="font-serif text-lg">{o.product}</div>
                <div className="mt-1 text-xs text-[hsl(var(--content-subtle))]">
                  {o.presentation ?? "—"} · {o.incoterm ?? "sin incoterm"} ·{" "}
                  {o.port_or_delivery ?? "—"}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <Metric
                    label="Ley"
                    value={o.grade_value != null ? `${o.grade_value} ${o.grade_unit ?? ""}` : "—"}
                  />
                  <Metric
                    label="Toneladas"
                    value={o.tonnage_available_t != null ? `${o.tonnage_available_t}` : "—"}
                  />
                  <Metric label="Precio pedido" value={o.price_ask ?? "—"} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="font-serif text-xl">Documentos</h2>
          {documents.length === 0 ? (
            <p className="mt-2 text-sm text-[hsl(var(--content-subtle))]">
              El proveedor aún no ha cargado documentos.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {documents.map((d) => {
                const ext = extractionByDoc.get(d.id);
                const canExtract =
                  d.doc_type === "certificado_analisis" ||
                  d.doc_type === "assay" ||
                  d.mime_type?.includes("pdf") ||
                  d.mime_type?.startsWith("image/");
                return (
                  <div
                    key={d.id}
                    className="rounded border border-[hsl(var(--hairline))] bg-white p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 font-medium">
                          <FileText className="h-4 w-4" /> {d.doc_type}
                          <span className="text-xs text-[hsl(var(--content-subtle))]">
                            {d.mime_type ?? "—"}
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-[hsl(var(--content-subtle))]">
                          Cargado {new Date(d.uploaded_at).toLocaleString("es-CL")} · estado{" "}
                          <em>{d.review_status}</em>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {d.signed_url && (
                          <a href={d.signed_url} target="_blank" rel="noreferrer">
                            <Button size="sm" variant="outline">
                              <Download className="mr-1 h-3 w-3" /> Ver
                            </Button>
                          </a>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === `rv-${d.id}`}
                          onClick={async () => {
                            setBusy(`rv-${d.id}`);
                            try {
                              await reviewDoc({ data: { id: d.id, review_status: "valido" } });
                              await refresh();
                            } finally {
                              setBusy(null);
                            }
                          }}
                        >
                          <CheckCircle2 className="mr-1 h-3 w-3" /> Válido
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === `rj-${d.id}`}
                          onClick={async () => {
                            setBusy(`rj-${d.id}`);
                            try {
                              await reviewDoc({ data: { id: d.id, review_status: "rechazado" } });
                              await refresh();
                            } finally {
                              setBusy(null);
                            }
                          }}
                        >
                          <XCircle className="mr-1 h-3 w-3" /> Rechazar
                        </Button>
                        {canExtract && (
                          <Button
                            size="sm"
                            disabled={busy === `ex-${d.id}`}
                            onClick={async () => {
                              setBusy(`ex-${d.id}`);
                              setError(null);
                              try {
                                await extract({ data: { document_id: d.id } });
                                await refresh();
                              } catch (e) {
                                setError((e as Error).message);
                              } finally {
                                setBusy(null);
                              }
                            }}
                          >
                            <Sparkles className="mr-1 h-3 w-3" />
                            {busy === `ex-${d.id}` ? "Extrayendo…" : "Extraer con IA"}
                          </Button>
                        )}
                      </div>
                    </div>
                    {ext && <ExtractionCard ext={ext} />}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-10">
          <h2 className="font-serif text-xl">Notas de revisión</h2>
          <div className="mt-3 space-y-3">
            {notes.length === 0 && (
              <p className="text-sm text-[hsl(var(--content-subtle))]">Aún no hay notas.</p>
            )}
            {notes.map((n) => (
              <div
                key={n.id}
                className="rounded border border-[hsl(var(--hairline))] bg-white p-3 text-sm"
              >
                <div className="mb-1 flex justify-between text-xs text-[hsl(var(--content-subtle))]">
                  <span>{new Date(n.created_at).toLocaleString("es-CL")}</span>
                  <span
                    className={
                      n.visibility === "supplier"
                        ? "rounded bg-sky-100 px-2 text-sky-800"
                        : "rounded bg-gray-100 px-2 text-gray-700"
                    }
                  >
                    {n.visibility === "supplier" ? "visible al proveedor" : "solo staff"}
                  </span>
                </div>
                <p className="whitespace-pre-wrap">{n.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded border border-[hsl(var(--hairline))] bg-white p-3">
            <Textarea
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              placeholder="Escribe una nota…"
              rows={3}
            />
            <div className="mt-2 flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={noteVisibility === "supplier"}
                  onChange={(e) => setNoteVisibility(e.target.checked ? "supplier" : "internal")}
                />
                Compartir con el proveedor
              </label>
              <Button
                size="sm"
                disabled={!noteBody.trim() || busy === "note"}
                onClick={async () => {
                  setBusy("note");
                  try {
                    await addNote({
                      data: {
                        supplier_id: id,
                        visibility: noteVisibility,
                        body: noteBody.trim(),
                      },
                    });
                    setNoteBody("");
                    await refresh();
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                Añadir nota
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-[hsl(var(--content-subtle))]">
        {label}
      </div>
      <div className="font-mono">{value}</div>
    </div>
  );
}

function ExtractionCard({ ext }: { ext: Ext }) {
  const f = ext.fields as {
    laboratory?: string | null;
    sample_id?: string | null;
    sample_date?: string | null;
    method?: string | null;
    elements?: Array<{ element: string; value: number | null; unit: string | null }>;
    notes?: string | null;
  };
  return (
    <div className="mt-4 rounded border border-[hsl(var(--hairline))] bg-[hsl(var(--surface))] p-3 text-sm">
      <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-[hsl(var(--content-subtle))]">
        <Sparkles className="h-3 w-3" /> Extracción IA ·{" "}
        {new Date(ext.created_at).toLocaleString("es-CL")}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Laboratorio" value={f.laboratory ?? "—"} />
        <Metric label="Muestra" value={f.sample_id ?? "—"} />
        <Metric label="Fecha" value={f.sample_date ?? "—"} />
        <Metric label="Método" value={f.method ?? "—"} />
      </div>
      {f.elements && f.elements.length > 0 && (
        <table className="mt-3 min-w-full text-xs">
          <thead className="text-[10px] uppercase tracking-wider text-[hsl(var(--content-subtle))]">
            <tr>
              <th className="text-left">Elemento</th>
              <th className="text-right">Valor</th>
              <th className="text-left pl-3">Unidad</th>
            </tr>
          </thead>
          <tbody>
            {f.elements.map((e, i) => (
              <tr key={i} className="border-t border-[hsl(var(--hairline))]">
                <td>{e.element}</td>
                <td className="text-right font-mono">{e.value ?? "—"}</td>
                <td className="pl-3">{e.unit ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {f.notes && <p className="mt-2 text-xs text-[hsl(var(--content-subtle))]">{f.notes}</p>}
    </div>
  );
}
