import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useProjects } from "@/hooks/useProjects";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { OnboardingWizard } from "@/components/OnboardingWizard";

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
    <div className="p-4 md:p-8 max-w-5xl mx-auto pb-20 md:pb-8">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Proyectos</h1>
          <p className="text-sm text-muted-foreground">Gestiona tus campañas de exploración.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-border font-mono text-xs hover:bg-accent"
          >
            <Plus className="w-3.5 h-3.5" /> Rápido
          </button>
          <Link
            to="/dashboard/projects/comparar"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-border font-mono text-xs hover:bg-accent"
          >
            Comparar fichas
          </Link>
          <Link
            to="/dashboard/projects/nuevo"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded bg-gold text-background font-mono text-xs font-semibold hover:bg-gold-light"
          >
            <Plus className="w-3.5 h-3.5" /> Alta con antecedentes
          </Link>
        </div>
      </header>

      {loading ? (
        <Loader2 className="w-5 h-5 animate-spin text-gold" />
      ) : projects.length === 0 ? (
        <OnboardingWizard />
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {projects.map((p) => (
            <div key={p.id} className="rounded border border-border bg-bg-secondary p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-mono font-semibold">{p.name}</div>
                  <div className="text-[10px] font-mono text-muted-foreground">{p.code}</div>
                </div>
                <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-gold/10 text-gold border border-gold/20">
                  {p.role}
                </span>
              </div>
              {p.description && (
                <p className="mt-2 text-xs text-muted-foreground">{p.description}</p>
              )}
              <div className="mt-3 text-[10px] font-mono text-muted-foreground">
                {p.commodity ?? "—"} · {p.region ?? p.country ?? ""}
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void navigate({
                      to: "/projects/$projectId/$section",
                      params: { projectId: p.id, section: "overview" },
                      search: { project: undefined },
                    });
                  }}
                  className="flex-1 text-[11px] font-mono px-2 py-1 rounded border border-border hover:bg-accent"
                >
                  Abrir workspace
                </button>
                <Link
                  to="/dashboard/projects/$projectId"
                  params={{ projectId: p.id }}
                  className="flex-1 text-center text-[11px] font-mono px-2 py-1 rounded border border-primary/40 text-primary hover:bg-primary/10"
                >
                  Ficha · Financiamiento
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur flex items-center justify-center p-4">
          <form
            onSubmit={create}
            className="w-full max-w-md rounded border border-border bg-bg-secondary p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-mono font-semibold">Nuevo proyecto</h2>
              <button type="button" onClick={() => setOpen(false)}>
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            {(["code", "name", "commodity", "region"] as const).map((f) => (
              <div key={f}>
                <label className="text-[10px] uppercase font-mono text-muted-foreground">
                  {f === "code" ? "Código (único)" : f}
                </label>
                <input
                  type="text"
                  required={f === "code" || f === "name"}
                  value={form[f]}
                  onChange={(e) => setForm({ ...form, [f]: e.target.value })}
                  maxLength={100}
                  className="w-full mt-1 px-2 py-1.5 rounded border border-border bg-background text-sm focus:outline-none focus:border-gold"
                />
              </div>
            ))}
            <div>
              <label className="text-[10px] uppercase font-mono text-muted-foreground">
                Descripción
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                maxLength={500}
                rows={3}
                className="w-full mt-1 px-2 py-1.5 rounded border border-border bg-background text-sm focus:outline-none focus:border-gold"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full py-2 rounded bg-gold text-background font-mono text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Crear
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
