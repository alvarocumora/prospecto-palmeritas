import { useMemo, useState, useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Download,
  Link2,
  RotateCcw,
  FileText,
  ShieldCheck,
  Cloud,
  CloudOff,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import type { TemplateDef, GeneratedDoc, DocBlock } from "@/lib/documents/model";
import { buildReference } from "@/lib/documents/templates";
import { renderGeocapitalsPdf } from "@/lib/documents/pdf";
import { createSignRequest, type SignableDoc } from "@/lib/documents/signing.functions";
import { supabase } from "@/integrations/supabase/client";
import { signUrl as buildSignUrl } from "@/lib/publicUrl";
import { useAuth } from "@/hooks/useAuth";

const STORAGE_PREFIX = "geocapitals:doc:";

type SyncStatus = "idle" | "loading" | "saving" | "saved" | "offline" | "error";

function defaultValues(tpl: TemplateDef): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of tpl.fields) out[f.key] = f.default ?? "";
  return out;
}

function defaultClauses(tpl: TemplateDef): Set<string> {
  return new Set(tpl.clauses.filter((c) => c.defaultOn).map((c) => c.key));
}

export function DocumentEditor({
  template,
  prefill,
  tradeId,
  signerPrefill,
}: {
  template: TemplateDef;
  /** Valores iniciales (ej. desde un lote del marketplace). Pisan el borrador. */
  prefill?: Record<string, string>;
  /** Trade de origen: la firma queda en la trazabilidad de la operación. */
  tradeId?: string;
  /** Contraparte sugerida (ej. desde un trade) para la solicitud de firma. */
  signerPrefill?: { name?: string | null; email?: string | null };
}) {
  const { user } = useAuth();
  const storageKey = `${STORAGE_PREFIX}${template.id}`;

  const [values, setValues] = useState<Record<string, string>>(() => defaultValues(template));
  const [clauses, setClauses] = useState<Set<string>>(() => defaultClauses(template));
  const [reference, setReference] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [sync, setSync] = useState<SyncStatus>("idle");
  const hydrated = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Genera referencia solo en cliente para evitar mismatch SSR.
  useEffect(() => {
    setReference((prev) => prev || buildReference(template.id));
  }, [template.id]);

  // Hidratación: Supabase (si hay sesión) → localStorage como fallback.
  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      // Fallback local siempre disponible.
      const loadLocal = () => {
        try {
          const raw = window.localStorage.getItem(storageKey);
          if (!raw) return;
          const parsed = JSON.parse(raw) as {
            values?: Record<string, string>;
            clauses?: string[];
            reference?: string;
          };
          if (parsed.values) setValues((prev) => ({ ...prev, ...parsed.values }));
          if (parsed.clauses) setClauses(new Set(parsed.clauses));
          if (parsed.reference) setReference(parsed.reference);
        } catch {
          // ignore
        }
      };

      if (!user) {
        loadLocal();
        setSync("offline");
        hydrated.current = true;
        return;
      }

      setSync("loading");
      const { data, error } = await supabase
        .from("document_drafts")
        .select("values, clauses, reference")
        .eq("user_id", user.id)
        .eq("template_id", template.id)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        loadLocal();
        setSync("error");
        hydrated.current = true;
        return;
      }

      if (data) {
        const remoteValues = (data.values ?? {}) as Record<string, string>;
        const remoteClauses = (data.clauses ?? []) as string[];
        setValues((prev) => ({ ...prev, ...remoteValues }));
        setClauses(new Set(remoteClauses));
        if (data.reference) setReference(data.reference);
        setSync("saved");
      } else {
        loadLocal();
        setSync("idle");
      }
      hydrated.current = true;
    }
    hydrate();
    return () => {
      cancelled = true;
    };
  }, [storageKey, template.id, user]);

  // Prefill (ej. desde un lote): se aplica después de hidratar y pisa el
  // borrador solo en las claves que trae, para reflejar el dato actual del lote.
  const prefillKey = prefill ? JSON.stringify(prefill) : null;
  useEffect(() => {
    if (!prefillKey) return;
    const wait = window.setInterval(() => {
      if (!hydrated.current) return;
      window.clearInterval(wait);
      const p = JSON.parse(prefillKey) as Record<string, string>;
      setValues((prev) => ({ ...prev, ...p }));
    }, 50);
    return () => window.clearInterval(wait);
  }, [prefillKey]);

  // Persistencia local + remota con debounce.
  useEffect(() => {
    if (!hydrated.current) return;
    // Local siempre.
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({ values, clauses: Array.from(clauses), reference }),
      );
    } catch {
      // ignore
    }

    if (!user || !reference) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSync("saving");
    saveTimer.current = setTimeout(async () => {
      const { error } = await supabase.from("document_drafts").upsert(
        {
          user_id: user.id,
          template_id: template.id,
          values,
          clauses: Array.from(clauses),
          reference,
        },
        { onConflict: "user_id,template_id" },
      );
      setSync(error ? "error" : "saved");
    }, 800);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [storageKey, values, clauses, reference, user, template.id]);

  const doc = useMemo<GeneratedDoc>(
    () =>
      template.build(values, clauses, {
        reference: reference || "GC-DRAFT",
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

  const reset = async () => {
    setValues(defaultValues(template));
    setClauses(defaultClauses(template));
    if (user) {
      await supabase
        .from("document_drafts")
        .delete()
        .eq("user_id", user.id)
        .eq("template_id", template.id);
    }
    toast.success("Valores restaurados");
  };

  const [signLink, setSignLink] = useState<string | null>(null);
  const [requestingSign, setRequestingSign] = useState(false);
  const [signerEmail, setSignerEmail] = useState(signerPrefill?.email ?? "");
  const [signerName, setSignerName] = useState(signerPrefill?.name ?? "");
  const signFn = useServerFn(createSignRequest);

  const requestSignature = async () => {
    if (!user) {
      toast.error("Inicia sesión para solicitar firmas.");
      return;
    }
    setRequestingSign(true);
    try {
      const { token, emailed } = await signFn({
        data: {
          templateId: template.id,
          doc: doc as unknown as SignableDoc,
          signerEmail: signerEmail.trim() || undefined,
          signerName: signerName.trim() || undefined,
          tradeId,
        },
      });
      const url = buildSignUrl(token);
      setSignLink(url);
      await navigator.clipboard.writeText(url).catch(() => {});
      toast.success(
        emailed
          ? `Solicitud creada y link enviado por email a ${signerEmail.trim()}.`
          : "Solicitud de firma creada. Link copiado — compártelo con la contraparte.",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo crear la solicitud de firma.");
    } finally {
      setRequestingSign(false);
    }
  };

  const exportPdf = async () => {
    setBusy(true);
    try {
      // Si hay usuario logueado, el emisor (primera parte del bloque de firma)
      // aparece pre-firmado con su email + timestamp + hash corto de sesión.
      // El emisor es la primera parte del documento — tomamos el primer campo
      // de identificación de parte que exista en el formulario (partyA, seller,
      // grantor, etc.). Fallback al email del usuario.
      const emitterName =
        values["partyA"] ||
        values["seller"] ||
        values["investor"] ||
        values["grantor"] ||
        values["client"] ||
        values["divulgante"] ||
        values["vendedor"] ||
        values["emisor"] ||
        user?.email ||
        "Emisor";
      const emitterSignature = user
        ? {
            name: emitterName,
            email: user.email ?? undefined,
            signedAt: new Date().toISOString(),
            hash: user.id.replace(/-/g, "").slice(0, 12),
            partyIndex: 0,
          }
        : undefined;

      await renderGeocapitalsPdf(doc, { emitterSignature });
      toast.success(
        emitterSignature
          ? `PDF descargado · firmado por ${emitterSignature.email ?? emitterSignature.name}`
          : "PDF descargado",
      );
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
          to="/dashboard/documentos"
          className="inline-flex items-center gap-1.5 text-[12px] font-mono text-content-subtle hover:text-content"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Volver a recursos
        </Link>
        <div className="flex items-center gap-3 text-[11px] font-mono text-content-subtle">
          <SyncBadge status={sync} signedIn={!!user} />
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-accent-brand" />
            Borrador editable · No constituye asesoría legal
          </div>
        </div>
      </div>

      <div className="mb-6">
        <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-accent-brand">
          {template.acronym ?? template.shortTitle}
        </div>
        <h1 className="font-display text-3xl lg:text-4xl mt-1 text-content">{template.title}</h1>
        <p className="text-sm text-content-subtle mt-2 max-w-3xl">{template.summary}</p>
        {!user ? (
          <p className="text-[11px] font-mono text-content-subtle mt-2">
            Estás editando sin sesión: los cambios se guardan solo en este dispositivo.{" "}
            <Link to="/auth" className="text-accent-brand underline">
              Inicia sesión
            </Link>{" "}
            para sincronizar entre dispositivos.
          </p>
        ) : null}
      </div>

      <div className="grid lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] gap-6">
        {/* Panel de formulario */}
        <div className="space-y-5">
          {groups.map(([groupName, fields]) => (
            <section key={groupName} className="rounded-2xl border border-hairline bg-surface-3 p-5">
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
                         className="w-full rounded-lg border border-hairline bg-surface-3 px-3 py-2 text-sm text-content focus:outline-none focus:border-accent-brand"
                      />
                    ) : f.type === "select" ? (
                      <select
                        value={values[f.key] ?? ""}
                        onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
                         className="w-full rounded-lg border border-hairline bg-surface-3 px-3 py-2 text-sm text-content focus:outline-none focus:border-accent-brand"
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
                         className="w-full rounded-lg border border-hairline bg-surface-3 px-3 py-2 text-sm text-content focus:outline-none focus:border-accent-brand"
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
             <section className="rounded-2xl border border-hairline bg-surface-3 p-5">
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
               className="inline-flex items-center gap-1.5 rounded-lg bg-content text-surface px-4 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50 shadow-lg"
            >
              <Download className="w-4 h-4" />
              {busy ? "Generando…" : "Descargar PDF"}
            </button>
            <button
              type="button"
              onClick={() => void requestSignature()}
              disabled={requestingSign}
               className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-surface-3 px-4 py-2.5 text-sm text-content hover:border-accent-brand disabled:opacity-50"
            >
              <Link2 className="w-4 h-4" />
              {requestingSign ? "Creando…" : "Solicitar firma"}
            </button>
            <button
              type="button"
              onClick={reset}
               className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-surface-3 px-4 py-2.5 text-sm text-content hover:border-accent-brand"
            >
              <RotateCcw className="w-4 h-4" /> Restaurar
            </button>
          </div>

          <div className="mt-3 grid sm:grid-cols-2 gap-2">
            <label className="text-xs">
              <span className="block text-content-subtle mb-1">
                Email del firmante (opcional — enviamos el link)
              </span>
              <input
                type="email"
                value={signerEmail}
                onChange={(e) => setSignerEmail(e.target.value)}
                placeholder="contraparte@empresa.com"
                 className="w-full rounded-lg border border-hairline bg-surface-3 px-3 py-2 text-sm text-content"
              />
            </label>
            <label className="text-xs">
              <span className="block text-content-subtle mb-1">Nombre esperado (opcional)</span>
              <input
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Nombre de quien firmará"
                 className="w-full rounded-lg border border-hairline bg-surface-3 px-3 py-2 text-sm text-content"
              />
            </label>
          </div>

          {signLink && (
            <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
              <div className="text-[11px] font-medium text-amber-700 mb-1">
                Link de firma (válido 30 días) — guárdalo, no volverá a mostrarse:
              </div>
              <code className="text-xs font-mono break-all">{signLink}</code>
            </div>
          )}
        </div>

        {/* Preview live */}
        <div className="lg:sticky lg:top-4 lg:self-start">
           <div className="rounded-2xl border border-hairline bg-surface-3 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-hairline bg-surface-subtle">
              <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-content-subtle">
                <FileText className="w-3.5 h-3.5" /> Vista previa
              </div>
              <div className="text-[10px] font-mono text-content-subtle">
                Ref {reference || "…"}
              </div>
            </div>
            <DocumentPreview doc={doc} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SyncBadge({ status, signedIn }: { status: SyncStatus; signedIn: boolean }) {
  if (!signedIn) {
    return (
      <span className="inline-flex items-center gap-1">
        <CloudOff className="w-3.5 h-3.5" /> Solo en este dispositivo
      </span>
    );
  }
  if (status === "loading" || status === "saving") {
    return (
      <span className="inline-flex items-center gap-1">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        {status === "loading" ? "Cargando borrador…" : "Guardando…"}
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1 text-red-600">
        <CloudOff className="w-3.5 h-3.5" /> Error al sincronizar
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-accent-brand">
      <Cloud className="w-3.5 h-3.5" /> Sincronizado
    </span>
  );
}

export function DocumentPreview({ doc }: { doc: GeneratedDoc }) {
  return (
       <div className="p-8 lg:p-10 max-h-[80vh] overflow-y-auto bg-surface-3">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-content">
             <span className="text-accent-brand">■</span> GEOCAPITALS
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

       <div className="h-[2px] w-10 mb-5 bg-accent-brand" />

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
    return (
      <p className="text-[13px] leading-relaxed text-content whitespace-pre-wrap">{block.text}</p>
    );
  }
  if (block.kind === "clauses") {
    return (
      <ul className="space-y-2">
        {block.items.map((it, i) => (
          <li key={i} className="text-[13px] leading-relaxed text-content pl-4 relative">
            <span className="absolute left-0 top-2 w-1.5 h-1.5 rounded-full bg-accent-brand" />
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
          {block.rows.map(([k, val], i) => (
            <tr key={i} className="border-b border-hairline/60 last:border-0">
              <td className="py-1.5 pr-3 font-mono text-[11px] uppercase tracking-wide text-content-subtle w-40 align-top">
                {k}
              </td>
              <td className="py-1.5 text-content">{val}</td>
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
                   className="text-left px-2 py-1.5 bg-content text-surface font-mono text-[10px] uppercase tracking-wide"
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
      <div
        className="grid gap-6 pt-8"
        style={{ gridTemplateColumns: `repeat(${block.parties.length}, minmax(0,1fr))` }}
      >
        {block.parties.map((p, i) => (
          <div key={i}>
            <div className="border-t border-content pt-1.5">
              <div className="text-[12px] font-medium text-content">{p}</div>
              <div className="text-[10px] font-mono text-content-subtle">Nombre, cargo y firma</div>
            </div>
          </div>
        ))}
      </div>
    );
  }
  return null;
}
