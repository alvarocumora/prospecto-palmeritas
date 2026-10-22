import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { FAMILY_LABEL, integrityProblems, publicExportBlocked, type ResearchFamily } from "@/lib/pdf/research/model";
import { availability, buildResearchDoc, type ResearchProject } from "@/lib/pdf/research/projects";
import { RESEARCH_DOCS_EXPERIMENTAL, buildResearchPdf, researchFilename } from "@/lib/pdf/research/build";

export const Route = createFileRoute("/_authenticated/dashboard/documentos/research")({
  head: () => ({
    meta: [
      { title: "Research documental (vista previa interna) — Geocapitals" },
      { name: "description", content: "Vista previa interna de memorandos, fichas e informes técnicos con procedencia por dato." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResearchStudio,
});

const FAMILIES: ResearchFamily[] = ["memo", "factsheet", "technical", "quarterly", "statement"];
const PROJECTS: Array<{ id: ResearchProject; label: string }> = [
  { id: "cholqui", label: "Cholqui" },
  { id: "losverdes", label: "Los Verdes – Tilama" },
];

function ResearchStudio() {
  const { user, profile, loading: authLoading } = useAuth();
  const [staff, setStaff] = useState<boolean | null>(null);
  useEffect(() => {
    if (!user) return;
    supabase.rpc("is_geocapitals_staff", { _user_id: user.id }).then(({ data }) => setStaff(!!data));
  }, [user]);
  const loading = authLoading || (!!user && staff === null);
  const [family, setFamily] = useState<ResearchFamily>("memo");
  const [project, setProject] = useState<ResearchProject>("cholqui");
  const [url, setUrl] = useState<string | null>(null);
  const [overflow, setOverflow] = useState<string[]>([]);
  const [pages, setPages] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const avail = availability(family, project);
  const model = useMemo(() => buildResearchDoc(family, project), [family, project]);
  const isStaff = profile?.account_type === "geocapitals_team" || staff === true;

  useEffect(() => {
    if (!isStaff || !model) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    let made: string | null = null;
    setBusy(true);
    setErr(null);
    buildResearchPdf(buildResearchDoc(family, project)!)
      .then(({ doc, report }) => {
        if (cancelled) return;
        made = URL.createObjectURL(doc.output("blob"));
        setUrl(made);
        setOverflow(report.overflow);
        setPages(report.pages);
      })
      .catch((e: Error) => !cancelled && setErr(e.message))
      .finally(() => !cancelled && setBusy(false));
    return () => {
      cancelled = true;
      if (made) URL.revokeObjectURL(made);
    };
  }, [family, project, isStaff, model]);

  if (loading) return <div className="p-8 text-sm text-content-muted">Cargando…</div>;
  if (!isStaff)
    return (
      <div data-theme="im-light" className="p-8 text-sm text-content">
        Espacio reservado al equipo GeoCapitals.
      </div>
    );

  const blocked = model ? publicExportBlocked(model) : true;
  const problems = model ? integrityProblems(model) : [];

  return (
    <div data-theme="im-light" className="min-h-screen bg-surface text-content">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        <Link to="/dashboard/documentos" className="font-mono text-[11px] uppercase tracking-[0.2em] text-content-muted hover:text-accent-brand">
          ← Documentos
        </Link>
        <h1 className="mt-3 font-serif text-3xl md:text-4xl">Research documental</h1>
        <p className="mt-2 max-w-2xl text-sm text-content-muted">
          Vista previa interna del PDF real. Los documentos públicos actuales no cambian. Exportación solo como prueba interna.
        </p>

        <div className="mt-6 grid gap-4 border-y border-hairline py-4 md:grid-cols-2">
          <label className="text-xs">
            <span className="font-mono uppercase tracking-[0.2em] text-content-muted">Documento</span>
            <select value={family} onChange={(e) => setFamily(e.target.value as ResearchFamily)} className="mt-1 block h-11 w-full border border-hairline bg-surface px-3 text-sm">
              {FAMILIES.map((f) => (
                <option key={f} value={f}>{FAMILY_LABEL[f]}</option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            <span className="font-mono uppercase tracking-[0.2em] text-content-muted">Proyecto</span>
            <select value={project} onChange={(e) => setProject(e.target.value as ResearchProject)} className="mt-1 block h-11 w-full border border-hairline bg-surface px-3 text-sm">
              {PROJECTS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </label>
        </div>

        {!avail.ok ? (
          <div className="mt-8 border-l-2 border-accent-brand pl-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent-brand">No disponible · datos insuficientes</p>
            <p className="mt-2 max-w-xl text-sm">{avail.reason}</p>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
            <aside className="space-y-5 text-sm">
              <section>
                <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-content-muted">Estado</h2>
                <p className={`mt-1 ${blocked ? "text-accent-brand" : ""}`}>
                  {blocked ? "Exportación pública bloqueada" : "Sin conflictos de datos"}
                </p>
                <p className="mt-1 font-mono text-xs text-content-muted">
                  {model?.code} · {pages || "…"} pág.
                </p>
              </section>
              {model && model.discrepancies.length > 0 && (
                <section>
                  <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-content-muted">Revisión / dato por confirmar</h2>
                  <ul className="mt-2 divide-y divide-hairline border-y border-hairline">
                    {model.discrepancies.map((d) => (
                      <li key={d.id} className="py-2">
                        <p className="font-medium">{d.field} {d.blocking ? "· bloqueante" : "· informativa"}</p>
                        <p className="text-xs text-content-muted">Dossier: {d.documentValue}</p>
                        <p className="text-xs text-content-muted">Plataforma: {d.platformValue}</p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {(problems.length > 0 || overflow.length > 0) && (
                <section>
                  <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-content-muted">Control de calidad</h2>
                  <ul className="mt-1 list-disc pl-4 text-xs">
                    {[...problems, ...overflow].map((p) => <li key={p}>{p}</li>)}
                  </ul>
                </section>
              )}
              <section>
                <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-content-muted">Fuentes</h2>
                <ol className="mt-1 space-y-1 text-xs">
                  {model?.sources.map((s, i) => (
                    <li key={s.id}>[{i + 1}] {s.label} · {s.period} · <span className="font-mono">{s.provenance}</span></li>
                  ))}
                </ol>
              </section>
              <div className="flex flex-col gap-2">
                {url && (
                  <a href={url} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center justify-center border border-content px-4 text-[11px] uppercase tracking-[0.2em]">
                    Abrir vista previa
                  </a>
                )}
                {RESEARCH_DOCS_EXPERIMENTAL && url && model && (
                  <a href={url} download={researchFilename(model)} className="inline-flex h-11 items-center justify-center bg-content px-4 text-[11px] uppercase tracking-[0.2em] text-surface">
                    Exportar prueba interna
                  </a>
                )}
                <p className="text-xs text-content-muted">La exportación pública permanece deshabilitada hasta aprobar la vista previa y resolver discrepancias.</p>
              </div>
            </aside>
            <div className="min-h-[70vh] border border-hairline bg-surface-2">
              {err && <p className="p-4 text-sm">No se pudo generar el PDF: {err}</p>}
              {busy && !url && <p className="p-4 text-sm text-content-muted">Generando PDF…</p>}
              {url && <iframe title="Vista previa PDF" src={url} className="h-[80vh] w-full" />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
