import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FileText, ArrowRight, ShieldCheck, Clock, CloudOff } from "lucide-react";
import { TEMPLATES, CATEGORY_LABEL } from "@/lib/documents/templates";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/dashboard/documentos")({
  head: () => ({
    meta: [
      { title: "Documentos de transacción — Geocapitals" },
      {
        name: "description",
        content:
          "Editor in-app de NDAs, MoUs, LOIs, term sheets, SPAs y JVs. Borradores editables con branding Geocapitals sincronizados a tu cuenta.",
      },
    ],
  }),
  component: DocumentsGallery,
});

type DraftMeta = { template_id: string; reference: string | null; updated_at: string };

function DocumentsGallery() {
  const { user } = useAuth();
  const [drafts, setDrafts] = useState<Record<string, DraftMeta>>({});
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
        .select("template_id, reference, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });
      if (cancelled) return;
      if (error) {
        setError(error.message);
      } else {
        const map: Record<string, DraftMeta> = {};
        for (const row of data ?? []) map[row.template_id] = row as DraftMeta;
        setDrafts(map);
      }
      // Estado de firmas (solicitudes emitidas por el usuario, RLS owner).
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

  const recent = Object.values(drafts).slice(0, 4);

  return (
    <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-8">
      <div className="mb-8">
        <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-accent-brand">
          Documentos · Editables in-app
        </div>
        <h1 className="font-display text-3xl lg:text-4xl mt-1 text-content">
          Plantillas de transacción
        </h1>
        <p className="text-sm text-content-subtle mt-2 max-w-3xl">
          NDAs, MoUs, LOIs, term sheets, SPAs, JVs, royalties y advisory. Edita cláusulas,
          previsualiza en vivo y descarga PDF con branding Geocapitals. Tus borradores se guardan en
          tu cuenta y se sincronizan entre dispositivos.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] font-mono text-content-subtle">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-accent-brand" />
            Borradores editables · No constituye asesoría legal
          </span>
          {user ? (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {loading
                ? "Cargando tus borradores…"
                : `${Object.keys(drafts).length} borrador(es) guardado(s)`}
            </span>
          ) : null}
          {error ? (
            <span className="inline-flex items-center gap-1.5 text-red-600">
              <CloudOff className="w-3.5 h-3.5" /> {error}
            </span>
          ) : null}
        </div>
      </div>

      {recent.length > 0 ? (
        <section className="mb-10">
          <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle mb-3">
            Tus borradores recientes
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {recent.map((d) => {
              const t = TEMPLATES.find((x) => x.id === d.template_id);
              if (!t) return null;
              return (
                <Link
                  key={d.template_id}
                  to="/dashboard/documentos/$templateId"
                  params={{ templateId: t.id }}
                  className="rounded-xl border border-accent-brand/40 bg-accent-brand-subtle/40 p-4 hover:border-accent-brand transition-colors"
                >
                  <div className="text-[10px] font-mono uppercase tracking-wider text-accent-brand">
                    {t.acronym ?? t.shortTitle}
                  </div>
                  <div className="text-sm font-medium text-content mt-1 line-clamp-2">
                    {t.title}
                  </div>
                  <div className="text-[10px] font-mono text-content-subtle mt-2">
                    {d.reference ?? "—"} ·{" "}
                    {new Date(d.updated_at).toLocaleDateString("es-CL", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </div>
                  <SignBadge stats={signs[d.template_id]} />
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {Array.from(byCategory.entries()).map(([cat, list]) => (
        <section key={cat} className="mb-10">
          <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle mb-3">
            {CATEGORY_LABEL[cat] ?? cat}
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {list.map((t) => {
              const draft = drafts[t.id];
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
                    <span className="flex items-center gap-1.5">
                      <SignBadge stats={signs[t.id]} />
                      {draft ? (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider bg-accent-brand text-white">
                          En curso
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <div className="font-display text-lg text-content group-hover:text-accent-brand transition-colors">
                    {t.title}
                  </div>
                  <p className="text-sm text-content-subtle mt-1.5 leading-relaxed">{t.summary}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-wider text-accent-brand opacity-0 group-hover:opacity-100 transition-opacity">
                      {draft ? "Continuar" : "Abrir editor"} <ArrowRight className="w-3 h-3" />
                    </span>
                    {draft ? (
                      <span className="text-[10px] font-mono text-content-subtle">
                        {new Date(draft.updated_at).toLocaleDateString("es-CL", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </span>
                    ) : null}
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

/** Estado de firmas del template: firmado (verde) o pendiente (ámbar). */
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
