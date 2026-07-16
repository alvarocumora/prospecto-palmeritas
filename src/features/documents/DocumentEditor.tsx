import { useMemo, useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Download, RotateCcw, FileText, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import type { TemplateDef, GeneratedDoc, DocBlock } from "@/lib/documents/model";
import { buildReference } from "@/lib/documents/templates";
import { renderGeocapitalsPdf } from "@/lib/documents/pdf";

const STORAGE_PREFIX = "geocapitals:doc:";

function defaultValues(tpl: TemplateDef): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of tpl.fields) out[f.key] = f.default ?? "";
  return out;
}

function defaultClauses(tpl: TemplateDef): Set<string> {
  return new Set(tpl.clauses.filter((c) => c.defaultOn).map((c) => c.key));
}

export function DocumentEditor({ template }: { template: TemplateDef }) {
  const storageKey = `${STORAGE_PREFIX}${template.id}`;

  const [values, setValues] = useState<Record<string, string>>(() => defaultValues(template));
  const [clauses, setClauses] = useState<Set<string>>(() => defaultClauses(template));
  const [reference] = useState<string>(() => buildReference(template.id));
  const [busy, setBusy] = useState(false);

  // Hidratar desde localStorage tras montar (evita mismatch SSR).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { values?: Record<string, string>; clauses?: string[] };
      if (parsed.values) setValues((prev) => ({ ...prev, ...parsed.values }));
      if (parsed.clauses) setClauses(new Set(parsed.clauses));
    } catch {
      // ignore
    }
  }, [storageKey]);

  // Persistir cambios.
  useEffect(() => {
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({ values, clauses: Array.from(clauses) }),
      );
    } catch {
      // ignore
    }
  }, [storageKey, values, clauses]);

  const doc = useMemo<GeneratedDoc>(
    () =>
      template.build(values, clauses, {
        reference,
        date: new Date().toISOString(),
      }),
    [template, values, clauses, reference],
  );

  const groups = useMemo(() => {
    const map = new Map<string, typeof template.fields>();
    for (const f of template.fields) {
      const g = f.group ?? "Datos del documento";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(f);
    }
    return Array.from(map.entries());
  }, [template]);

  const reset = () => {
    setValues(defaultValues(template));
    setClauses(defaultClauses(template));
    toast.success("Valores restaurados");
  };

  const exportPdf = async () => {
    setBusy(true);
    try {
      await renderGeocapitalsPdf(doc);
      toast.success("PDF descargado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al generar el PDF");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-6">
      <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
        <Link
          to="/recursos"
          className="inline-flex items-center gap-1.5 text-[12px] font-mono text-content-subtle hover:text-content"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Volver a recursos
        </Link>
        <div className="flex items-center gap-2 text-[11px] font-mono text-content-subtle">
          <ShieldCheck className="w-3.5 h-3.5 text-accent-brand" />
          Borrador editable · No constituye asesoría legal
        </div>
      </div>

      <div className="mb-6">
        <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-accent-brand">
          {template.acronym ?? template.shortTitle}
        </div>
        <h1 className="font-display text-3xl lg:text-4xl mt-1 text-content">{template.title}</h1>
        <p className="text-sm text-content-subtle mt-2 max-w-3xl">{template.summary}</p>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] gap-6">
        {/* Panel de formulario */}
        <div className="space-y-5">
          {groups.map(([groupName, fields]) => (
            <section
              key={groupName}
              className="rounded-2xl border border-hairline bg-white p-5"
            >
              <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle mb-3">
                {groupName}
              </div>
              <div className="space-y-3">
                {fields.map((f) => (
                  <div key={f.key}>
                    <label className="block text-[12px] font-mono text-content mb-1">
                      {f.label}
                    </label>
                    {f.type === "textarea" ? (
                      <textarea
                        value={values[f.key] ?? ""}
                        placeholder={f.placeholder}
                        onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
                        rows={3}
                        className="w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-content focus:outline-none focus:border-accent-brand"
                      />
                    ) : f.type === "select" ? (
                      <select
                        value={values[f.key] ?? ""}
                        onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
                        className="w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-content focus:outline-none focus:border-accent-brand"
                      >
                        {f.options?.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                        value={values[f.key] ?? ""}
                        placeholder={f.placeholder}
                        onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
                        className="w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-content focus:outline-none focus:border-accent-brand"
                      />
                    )}
                    {f.help ? (
                      <p className="text-[11px] text-content-subtle mt-1">{f.help}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ))}

          {template.clauses.length > 0 ? (
            <section className="rounded-2xl border border-hairline bg-white p-5">
              <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle mb-3">
                Cláusulas opcionales
              </div>
              <div className="space-y-2">
                {template.clauses.map((c) => {
                  const on = clauses.has(c.key);
                  return (
                    <label
                      key={c.key}
                      className="flex gap-2 items-start cursor-pointer p-2 rounded-lg hover:bg-surface-subtle"
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={(e) => {
                          setClauses((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(c.key);
                            else next.delete(c.key);
                            return next;
                          });
                        }}
                        className="mt-0.5"
                      />
                      <div>
                        <div className="text-[13px] font-medium text-content">{c.label}</div>
                        <div className="text-[11px] text-content-subtle mt-0.5">{c.text}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </section>
          ) : null}

          <div className="flex flex-wrap gap-2 sticky bottom-4">
            <button
              type="button"
              onClick={exportPdf}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-content text-white px-4 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50 shadow-lg"
            >
              <Download className="w-4 h-4" />
              {busy ? "Generando…" : "Descargar PDF"}
            </button>
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-white px-4 py-2.5 text-sm text-content hover:border-accent-brand"
            >
              <RotateCcw className="w-4 h-4" /> Restaurar
            </button>
          </div>
        </div>

        {/* Preview live */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-2xl border border-hairline bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-hairline bg-surface-subtle">
              <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-content-subtle">
                <FileText className="w-3.5 h-3.5" /> Vista previa
              </div>
              <div className="text-[10px] font-mono text-content-subtle">Ref {reference}</div>
            </div>
            <DocumentPreview doc={doc} />
          </div>
        </div>
      </div>
    </div>
  );
}

function DocumentPreview({ doc }: { doc: GeneratedDoc }) {
  return (
    <div className="p-8 lg:p-10 max-h-[80vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-content">
            <span style={{ color: "oklch(0.78 0.14 82)" }}>■</span> GEOCAPITALS
          </div>
          <div className="text-[9px] font-mono text-content-subtle mt-0.5">
            Mining · Deals · Documentation
          </div>
        </div>
        <div className="text-right text-[10px] font-mono text-content-subtle">
          <div>Ref: {doc.reference}</div>
          <div>
            {new Date(doc.date).toLocaleDateString("es-CL", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>
        </div>
      </div>

      <div
        className="h-[2px] w-10 mb-5"
        style={{ background: "oklch(0.78 0.14 82)" }}
      />

      <h2 className="font-display text-2xl text-content mb-6 leading-tight">{doc.title}</h2>

      <div className="border-t border-hairline pt-5 space-y-5">
        {doc.blocks.map((b, i) => (
          <BlockPreview key={i} block={b} />
        ))}
      </div>

      <div className="mt-10 pt-4 border-t border-hairline text-[10px] italic text-content-subtle">
        Documento generado por Geocapitals como borrador editable. No constituye asesoría legal ni
        oferta financiera. Validar con las contrapartes y sus asesores antes de firmar.
      </div>
    </div>
  );
}

function BlockPreview({ block }: { block: DocBlock }) {
  if (block.kind === "paragraph") {
    return <p className="text-[13px] leading-relaxed text-content whitespace-pre-wrap">{block.text}</p>;
  }
  if (block.kind === "clauses") {
    return (
      <ul className="space-y-2">
        {block.items.map((it, i) => (
          <li key={i} className="text-[13px] leading-relaxed text-content pl-4 relative">
            <span
              className="absolute left-0 top-2 w-1.5 h-1.5 rounded-full"
              style={{ background: "oklch(0.78 0.14 82)" }}
            />
            {it}
          </li>
        ))}
      </ul>
    );
  }
  if (block.kind === "fields") {
    return (
      <table className="w-full text-[12px]">
        <tbody>
          {block.rows.map(([k, v], i) => (
            <tr key={i} className="border-b border-hairline/60 last:border-0">
              <td className="py-1.5 pr-3 font-mono text-[11px] uppercase tracking-wide text-content-subtle w-40 align-top">
                {k}
              </td>
              <td className="py-1.5 text-content">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  if (block.kind === "table") {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-[12px] border-collapse">
          <thead>
            <tr>
              {block.head.map((h, i) => (
                <th
                  key={i}
                  className="text-left px-2 py-1.5 bg-content text-white font-mono text-[10px] uppercase tracking-wide"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, i) => (
              <tr key={i} className="border-b border-hairline">
                {row.map((cell, j) => (
                  <td key={j} className="px-2 py-1.5 text-content align-top">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (block.kind === "signature") {
    return (
      <div className="grid gap-6 pt-8" style={{ gridTemplateColumns: `repeat(${block.parties.length}, minmax(0,1fr))` }}>
        {block.parties.map((p, i) => (
          <div key={i}>
            <div className="border-t border-content pt-1.5">
              <div className="text-[12px] font-medium text-content">{p}</div>
              <div className="text-[10px] font-mono text-content-subtle">
                Nombre, cargo y firma
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }
  return null;
}
