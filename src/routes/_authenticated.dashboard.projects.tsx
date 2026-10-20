import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useProjects } from "@/hooks/useProjects";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { ContentState, PageHeader, PlatformPage } from "@/components/ui-system";

export const Route = createFileRoute("/_authenticated/dashboard/projects")({
  head: () => ({ meta: [{ title: "Proyectos — Geocapitals" }] }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const { projects, refresh, setActiveId, loading } = useProjects();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: "",
    name: "",
    commodity: "Au-Cu",
    region: "",
    description: "",
  });

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { data: orgRow, error: orgErr } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    if (orgErr || !orgRow) {
      setSaving(false);
      toast.error(orgErr?.message ?? "No tienes una organización asignada.");
      return;
    }
    const { data, error } = await supabase
      .from("projects")
      .insert({ ...form, created_by: user.id, organization_id: orgRow.organization_id })
      .select()
      .single();
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Proyecto creado");
    setOpen(false);
    setForm({ code: "", name: "", commodity: "Au-Cu", region: "", description: "" });
    await refresh();
    if (data) setActiveId(data.id);
  };

  return (
    <PlatformPage width="standard">
      <PageHeader
        eyebrow="Explorar · Workspace"
        title="Proyectos"
        description="Gestiona tus proyectos y campañas de exploración desde un único espacio."
        actions={
          <>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-hairline px-3 py-2 text-xs font-medium text-content transition-colors hover:border-accent-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-brand"
            >
              <Plus className="h-4 w-4" /> Rápido
            </button>
            <Link
              to="/dashboard/projects/comparar"
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-hairline px-3 py-2 text-xs font-medium text-content transition-colors hover:border-accent-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-brand"
            >
              Comparar fichas
            </Link>
            <Link
              to="/dashboard/projects/nuevo"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-accent-brand px-4 py-2 text-xs font-semibold text-accent-brand-contrast transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
            >
              <Plus className="h-4 w-4" /> Alta con antecedentes
            </Link>
          </>
        }
      />

      {loading ? (
        <ContentState kind="loading" title="Cargando proyectos…" />
      ) : projects.length === 0 ? (
        <OnboardingWizard />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((p) => (
            <div
              key={p.id}
              className="rounded-xl border border-hairline bg-surface-3 p-5 shadow-sm transition-colors hover:border-accent-brand"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-display text-xl text-content">{p.name}</div>
                  <div className="font-mono text-[10px] text-content-subtle">{p.code}</div>
                </div>
                <span className="rounded-md border border-hairline bg-surface-2 px-2 py-1 font-mono text-[10px] uppercase text-content-muted">
                  {p.role}
                </span>
              </div>
              {p.description && (
                <p className="mt-3 text-sm leading-relaxed text-content-muted">{p.description}</p>
              )}
              <div className="mt-3 font-mono text-[11px] text-content-subtle">
                {p.commodity ?? "—"} · {p.region ?? p.country ?? ""}
              </div>
              <div className="mt-4 flex flex-col gap-2 border-t border-hairline pt-4 sm:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    void navigate({
                      to: "/projects/$projectId/$section",
                      params: { projectId: p.id, section: "overview" },
                      search: { project: undefined },
                    });
                  }}
                  className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md bg-accent-brand px-3 py-2 text-center text-xs font-medium text-accent-brand-contrast hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-brand"
                >
                  Abrir workspace
                </button>
                <Link
                  to="/dashboard/projects/$projectId"
                  params={{ projectId: p.id }}
                  className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md border border-hairline px-3 py-2 text-center text-xs font-medium text-content hover:border-accent-brand hover:text-accent-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-brand"
                >
                  Ficha · Financiamiento
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-content/60 p-4 backdrop-blur-sm">
          <form
            onSubmit={create}
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-project-title"
            className="w-full max-w-md space-y-4 rounded-xl border border-hairline bg-surface-3 p-5 text-content shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h2 id="new-project-title" className="font-display text-2xl">
                Nuevo proyecto
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar formulario"
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-brand"
              >
                <X className="h-5 w-5 text-content-muted" />
              </button>
            </div>
            {(["code", "name", "commodity", "region"] as const).map((f) => (
              <div key={f}>
                <label
                  htmlFor={`new-project-${f}`}
                  className="font-mono text-[10px] uppercase text-content-muted"
                >
                  {f === "code" ? "Código (único)" : f}
                </label>
                <input
                  id={`new-project-${f}`}
                  type="text"
                  required={f === "code" || f === "name"}
                  value={form[f]}
                  onChange={(e) => setForm({ ...form, [f]: e.target.value })}
                  maxLength={100}
                  className="mt-1 min-h-11 w-full rounded-md border border-hairline bg-surface px-3 py-2 text-sm text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-brand"
                />
              </div>
            ))}
            <div>
              <label
                htmlFor="new-project-description"
                className="font-mono text-[10px] uppercase text-content-muted"
              >
                Descripción
              </label>
              <textarea
                id="new-project-description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                maxLength={500}
                rows={3}
                className="mt-1 min-h-11 w-full rounded-md border border-hairline bg-surface px-3 py-2 text-sm text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-brand"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-accent-brand px-4 py-2 text-sm font-semibold text-accent-brand-contrast disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-brand"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Crear
            </button>
          </form>
        </div>
      )}
    </PlatformPage>
  );
}
