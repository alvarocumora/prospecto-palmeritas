import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  FileText,
  ArrowRight,
  ShieldCheck,
  Clock,
  CloudOff,
  Plus,
  User2,
  Download,
  Sparkles,
  PenLine,
} from "lucide-react";
import { TEMPLATES, TEMPLATE_BY_ID, CATEGORY_LABEL } from "@/lib/documents/templates";
import { SPECIAL_DOCS, downloadSpecialDoc, type SpecialDocId } from "@/lib/documents/specialDocs";
import { SpecialDocSignDialog } from "@/features/documents/SpecialDocSignDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// Listado de documentos por cliente / operación: cada plantilla puede tener
// muchos borradores (uno por contraparte). Este listado agrega todos.

export const Route = createFileRoute("/_authenticated/dashboard/documentos/")({
  head: () => ({
    meta: [
      { title: "Documentos de transacción — Geocapitals" },
      {
        name: "description",
        content:
          "Genera NDAs, NCNDAs, MoUs, LOIs, term sheets, SPAs y JVs por cliente u operación. Borradores editables con branding Geocapitals sincronizados a tu cuenta.",
      },
    ],
  }),
  component: DocumentsGallery,
});

type DraftRow = {
  id: string;
  template_id: string;
  title: string | null;
  client_name: string | null;
  reference: string | null;
  status: string;
  updated_at: string;
  project_id: string | null;
  trade_id: string | null;
  inquiry_id: string | null;
};

function DocumentsGallery() {
  const { user } = useAuth();
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [signs, setSigns] = useState<Record<string, { pending: number; signed: number }>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      const { data, error } = await supabase
        .from("document_drafts")
        .select(
          "id, template_id, title, client_name, reference, status, updated_at, project_id, trade_id, inquiry_id",
        )
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });
      if (cancelled) return;
      if (error) setError(error.message);
      else setDrafts((data ?? []) as DraftRow[]);

      // Estado de firmas por template (contador global, informativo).
      const { data: signRows } = await supabase
        .from("document_sign_requests")
        .select("template_id, status")
        .eq("created_by", user.id);
      if (!cancelled && signRows) {
        const agg: Record<string, { pending: number; signed: number }> = {};
        for (const r of signRows as Array<{ template_id: string; status: string }>) {
          const a = (agg[r.template_id] ??= { pending: 0, signed: 0 });
          if (r.status === "signed") a.signed++;
          else if (r.status === "pending") a.pending++;
        }
        setSigns(agg);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const byCategory = new Map<string, typeof TEMPLATES>();
  for (const t of TEMPLATES) {
    if (!byCategory.has(t.category)) byCategory.set(t.category, []);
    byCategory.get(t.category)!.push(t);
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-8">
      <div className="mb-8">
        <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-accent-brand">
          Documentos · Por cliente / operación
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="font-display text-3xl lg:text-4xl mt-1 text-content">Mis documentos</h1>
          <Link
            to="/dashboard/firmas"
            className="inline-flex items-center gap-1.5 text-sm text-accent-brand hover:underline"
          >
            <ShieldCheck className="w-4 h-4" /> Mis solicitudes de firma
          </Link>
        </div>
        <p className="text-sm text-content-subtle mt-2 max-w-3xl">
          Cada borrador es independiente: puedes generar tantos NDAs, LOIs o SPAs como clientes
          tengas y asociarlos a un proyecto o trade. Todo se guarda en tu perfil y queda enlazado a
          la operación.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] font-mono text-content-subtle">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-accent-brand" />
            Borradores editables · No constituye asesoría legal
          </span>
          {user ? (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {loading ? "Cargando…" : `${drafts.length} documento(s) guardado(s)`}
            </span>
          ) : null}
          {error ? (
            <span className="inline-flex items-center gap-1.5 text-red-600">
              <CloudOff className="w-3.5 h-3.5" /> {error}
            </span>
          ) : null}
        </div>
      </div>

      {/* Bloque 0 · Centro documental: familias institucionales. */}
      <section className="mb-12" aria-labelledby="centro-doc">
        <div id="centro-doc" className="text-[10px] font-mono uppercase tracking-wider text-content-subtle mb-3">
          Centro documental
        </div>
        <div className="grid gap-px bg-hairline border border-hairline sm:grid-cols-2 lg:grid-cols-4">
          {[
            { k: "Presentación 16:9", t: "Deck de inversión 2026", d: "Diez láminas, ronda Serie A y descarga PDF.", to: "/inversion/deck" as const },
            { k: "Research A4", t: "Memorándum, ficha e informe técnico", d: "Vista previa con procedencia por dato. Uso interno.", to: "/dashboard/documentos/research" as const },
            { k: "Inversión", t: "Cartola y contratos SPV", d: "Posiciones confirmadas, órdenes y contratos firmados.", to: "/dashboard/investments" as const },
            { k: "Colateral", t: "Mutuo con garantía", d: "Documentos legales del programa inmobiliario.", to: "/dashboard/colateral-documentos" as const },
          ].map((c) => (
            <Link key={c.to} to={c.to} className="group bg-surface p-5 min-h-[140px] flex flex-col hover:bg-surface-muted">
              <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-accent-brand">{c.k}</span>
              <span className="font-display text-lg text-content mt-2">{c.t}</span>
              <span className="text-sm text-content-subtle mt-1 flex-1">{c.d}</span>
              <span className="mt-3 inline-flex items-center gap-1 text-sm text-accent-brand">
                Abrir <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Bloque 1 · Documentos guardados por cliente / operación. */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle">
            Tus documentos
          </div>
          {drafts.length > 0 && (
            <span className="text-[10px] font-mono text-content-subtle">{drafts.length} total</span>
          )}
        </div>
        {drafts.length === 0 && !loading ? (
          <div className="rounded-2xl border border-dashed border-hairline p-10 text-center bg-white">
            <FileText className="w-8 h-8 text-content-subtle mx-auto mb-2" />
            <p className="text-sm text-content mb-1">Todavía no tienes documentos guardados.</p>
            <p className="text-xs text-content-subtle">
              Elige una plantilla abajo y genera el primero para un cliente u operación.
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {drafts.map((d) => {
              const t = TEMPLATE_BY_ID[d.template_id];
              if (!t) return null;
              const displayTitle = d.title?.trim() || `${t.acronym ?? t.shortTitle} sin título`;
              return (
                <Link
                  key={d.id}
                  to="/dashboard/documentos/$templateId"
                  params={{ templateId: t.id }}
                  search={{ draftId: d.id }}
                  className="rounded-xl border border-hairline bg-white p-4 hover:border-accent-brand hover:shadow-[0_20px_40px_-30px_rgba(43,74,203,0.35)] transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider bg-accent-brand-subtle text-accent-brand">
                      {t.acronym ?? t.shortTitle}
                    </span>
                    <StatusBadge status={d.status} />
                  </div>
                  <div className="text-sm font-medium text-content line-clamp-2">
                    {displayTitle}
                  </div>
                  {d.client_name && (
                    <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-content-subtle">
                      <User2 className="w-3 h-3" />
                      {d.client_name}
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-1">
                    {d.project_id && <Tag label="Proyecto" />}
                    {d.trade_id && <Tag label="Trade" />}
                    {d.inquiry_id && <Tag label="Requerimiento" />}
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[10px] font-mono text-content-subtle">
                    <span>Ref {d.reference ?? "—"}</span>
                    <span>
                      {new Date(d.updated_at).toLocaleDateString("es-CL", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Bloque 1.5 · Documentos especiales generados con el formato global. */}
      <SpecialDocsSection />

      {/* Bloque 2 · Catálogo de plantillas para crear nuevos documentos. */}
      <div className="mb-4">
        <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle">
          Crear un documento nuevo
        </div>
        <p className="text-sm text-content-subtle mt-1">
          Cada vez que abres una plantilla se crea un borrador independiente asociado al cliente que
          indiques.
        </p>
      </div>
      {Array.from(byCategory.entries()).map(([cat, list]) => (
        <section key={cat} className="mb-10">
          <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle mb-3">
            {CATEGORY_LABEL[cat] ?? cat}
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {list.map((t) => {
              const s = signs[t.id];
              return (
                <Link
                  key={t.id}
                  to="/dashboard/documentos/$templateId"
                  params={{ templateId: t.id }}
                  className="group relative rounded-2xl border border-hairline bg-white p-6 hover:border-accent-brand hover:shadow-[0_20px_40px_-30px_rgba(43,74,203,0.35)] transition-all"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider bg-accent-brand-subtle text-accent-brand">
                      <FileText className="w-3 h-3" /> {t.acronym ?? t.shortTitle}
                    </span>
                    <SignBadge stats={s} />
                  </div>
                  <div className="font-display text-lg text-content group-hover:text-accent-brand transition-colors">
                    {t.title}
                  </div>
                  <p className="text-sm text-content-subtle mt-1.5 leading-relaxed">{t.summary}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-wider text-accent-brand">
                      <Plus className="w-3 h-3" /> Nuevo desde plantilla
                    </span>
                    <ArrowRight className="w-4 h-4 text-content-subtle group-hover:text-accent-brand group-hover:translate-x-1 transition-all" />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-surface-3 border border-hairline px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider text-content-subtle">
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    draft: { label: "Borrador", cls: "bg-surface-3 text-content-subtle border border-hairline" },
    sent: { label: "Enviado", cls: "bg-amber-500/15 text-amber-600" },
    signed: { label: "Firmado", cls: "bg-emerald-500/15 text-emerald-600" },
    archived: {
      label: "Archivado",
      cls: "bg-surface-3 text-content-subtle border border-hairline",
    },
  };
  const meta = map[status] ?? map.draft;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider ${meta.cls}`}
    >
      {meta.label}
    </span>
  );
}

function SignBadge({ stats }: { stats?: { pending: number; signed: number } }) {
  if (!stats || (stats.pending === 0 && stats.signed === 0)) return null;
  if (stats.signed > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider bg-emerald-500/15 text-emerald-600">
        Firmado{stats.signed > 1 ? ` ×${stats.signed}` : ""}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider bg-amber-500/15 text-amber-600">
      Firma pendiente{stats.pending > 1 ? ` ×${stats.pending}` : ""}
    </span>
  );
}

function SpecialDocsSection() {
  const [busy, setBusy] = useState<SpecialDocId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signing, setSigning] = useState<SpecialDocId | null>(null);

  const handleDownload = async (id: SpecialDocId) => {
    setError(null);
    setBusy(id);
    try {
      await downloadSpecialDoc(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar el PDF");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="mb-12">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle inline-flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-accent-brand" />
          Documentos especiales · Formato global con QR + firma electrónica
        </div>
        <Link
          to="/dashboard/firmas"
          className="text-[10px] font-mono uppercase tracking-wider text-accent-brand hover:underline inline-flex items-center gap-1"
        >
          <ShieldCheck className="w-3 h-3" /> Estado de firmas
        </Link>
      </div>
      <p className="text-sm text-content-subtle mb-3 max-w-3xl">
        Fichas y adendas de operaciones activas generadas con el mismo motor Institutional Modernist
        que NDA, LOI y NCNDA: papel hueso, tabulación estándar, QR de verificación en cabecera y
        pie, y contacto oficial de Geocapitals. Puedes descargarlas o enviarlas a firma electrónica
        multi-parte con trazabilidad SHA-256.
      </p>
      {error ? (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      ) : null}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {SPECIAL_DOCS.map((d) => (
          <div key={d.id} className="rounded-2xl border border-hairline bg-white p-5 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider bg-accent-brand-subtle text-accent-brand">
                <FileText className="w-3 h-3" /> {d.acronym}
              </span>
              <span className="text-[9px] font-mono uppercase tracking-wider text-content-subtle">
                {d.signers.length > 1 ? `${d.signers.length} firmantes` : "Firma"}
              </span>
            </div>
            <div className="font-display text-lg text-content leading-snug">{d.label}</div>
            <p className="text-sm text-content-subtle mt-1.5 leading-relaxed flex-1">{d.summary}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleDownload(d.id)}
                disabled={busy === d.id}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-hairline bg-white text-content px-3 py-2 text-sm font-medium hover:border-accent-brand disabled:opacity-60"
              >
                <Download className="w-4 h-4" />
                {busy === d.id ? "Generando…" : "Descargar"}
              </button>
              <button
                type="button"
                onClick={() => setSigning(d.id)}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent-brand text-white px-3 py-2 text-sm font-medium hover:bg-accent-brand/90"
              >
                <PenLine className="w-4 h-4" />
                Firma
              </button>
            </div>
          </div>
        ))}
      </div>
      {signing && <SpecialDocSignDialog docId={signing} onClose={() => setSigning(null)} />}
    </section>
  );
}
