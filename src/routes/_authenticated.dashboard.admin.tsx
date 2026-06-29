import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";
import {
  Users,
  FolderKanban,
  CreditCard,
  Activity,
  ShieldAlert,
  Loader2,
  Search,
  Crown,
  UserMinus,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/admin")({
  head: () => ({ meta: [{ title: "Admin · Plataforma — Trackmin GeoIntel" }] }),
  component: AdminPage,
});

type Tab = "overview" | "users" | "projects" | "billing" | "operations";

type UserRow = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  organization: string | null;
  country: string | null;
  created_at: string;
  is_super_admin?: boolean;
};

type ProjectRow = {
  id: string;
  code: string;
  name: string;
  commodity: string | null;
  country: string | null;
  status: string;
  created_at: string;
  member_count?: number;
};

function AdminPage() {
  const { isAdmin, loading: roleLoading } = useIsSuperAdmin();
  const [tab, setTab] = useState<Tab>("overview");

  if (roleLoading) {
    return (
      <div className="p-8">
        <Loader2 className="w-5 h-5 animate-spin text-gold" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-8 max-w-md mx-auto text-center">
        <ShieldAlert className="w-10 h-10 text-destructive mx-auto mb-3" />
        <div className="font-mono font-semibold">Acceso restringido</div>
        <p className="text-xs text-muted-foreground mt-1">Solo super-admins de la plataforma.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto pb-20 md:pb-8">
      <header className="mb-6">
        <div className="text-[10px] uppercase tracking-wider font-mono text-gold inline-flex items-center gap-1">
          <Crown className="w-3 h-3" /> Super-admin
        </div>
        <h1 className="text-xl md:text-2xl font-bold mt-1">Panel de Administración</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Gestión global de usuarios, proyectos, pagos y operación.
        </p>
      </header>

      <nav className="flex gap-1 mb-6 border-b border-border overflow-x-auto">
        {(
          [
            ["overview", "Resumen", Activity],
            ["users", "Usuarios", Users],
            ["projects", "Proyectos", FolderKanban],
            ["billing", "Pagos", CreditCard],
            ["operations", "Operación", ShieldAlert],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-3 py-2 text-xs font-mono inline-flex items-center gap-1.5 border-b-2 transition-colors whitespace-nowrap ${
              tab === id
                ? "border-gold text-gold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
        <a
          href="/dashboard/admin/investors"
          className="px-3 py-2 text-xs font-mono inline-flex items-center gap-1.5 border-b-2 border-transparent text-muted-foreground hover:text-gold whitespace-nowrap"
        >
          <ShieldAlert className="w-3.5 h-3.5" /> Inversionistas (KYC)
        </a>
      </nav>

      {tab === "overview" && <Overview />}
      {tab === "users" && <UsersTab />}
      {tab === "projects" && <ProjectsTab />}
      {tab === "billing" && <BillingTab />}
      {tab === "operations" && <OperationsTab />}
    </div>
  );
}

function Overview() {
  const [stats, setStats] = useState<{
    users: number;
    projects: number;
    holes: number;
    samples: number;
    surveys: number;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const [u, p, h, s, sv] = await Promise.all([
        supabase.from("profiles").select("user_id", { count: "exact", head: true }),
        supabase.from("projects").select("id", { count: "exact", head: true }),
        supabase.from("drill_holes").select("id", { count: "exact", head: true }),
        supabase.from("sampling_results").select("id", { count: "exact", head: true }),
        supabase.from("geophysics_surveys").select("id", { count: "exact", head: true }),
      ]);
      setStats({
        users: u.count ?? 0,
        projects: p.count ?? 0,
        holes: h.count ?? 0,
        samples: s.count ?? 0,
        surveys: sv.count ?? 0,
      });
    })();
  }, []);

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <StatCard label="Usuarios" value={stats?.users ?? "…"} />
      <StatCard label="Proyectos" value={stats?.projects ?? "…"} />
      <StatCard label="Sondajes" value={stats?.holes ?? "…"} />
      <StatCard label="Muestras" value={stats?.samples ?? "…"} />
      <StatCard label="Surveys geo" value={stats?.surveys ?? "…"} />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border border-border bg-bg-secondary p-3">
      <div className="text-[10px] font-mono uppercase text-muted-foreground">{label}</div>
      <div className="text-2xl font-mono font-bold mt-1 text-gold">{value}</div>
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const refresh = async () => {
    setLoading(true);
    const [{ data: profiles }, { data: admins }] = await Promise.all([
      supabase
        .from("profiles")
        .select("user_id,email,display_name,organization,country,created_at")
        .order("created_at", { ascending: false }),
      supabase.from("app_roles").select("user_id").eq("role", "super_admin"),
    ]);
    const adminSet = new Set((admins ?? []).map((a) => a.user_id));
    setUsers((profiles ?? []).map((p) => ({ ...p, is_super_admin: adminSet.has(p.user_id) })));
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const toggleAdmin = async (userId: string, currentlyAdmin: boolean) => {
    if (currentlyAdmin) {
      const { error } = await supabase
        .from("app_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", "super_admin");
      if (error) toast.error(error.message);
      else {
        toast.success("Admin removido");
        refresh();
      }
    } else {
      const { error } = await supabase
        .from("app_roles")
        .insert({ user_id: userId, role: "super_admin" });
      if (error) toast.error(error.message);
      else {
        toast.success("Promovido a super-admin");
        refresh();
      }
    }
  };

  const filtered = users.filter(
    (u) =>
      !q ||
      u.email?.toLowerCase().includes(q.toLowerCase()) ||
      u.display_name?.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div>
      <div className="mb-3 relative">
        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar email o nombre…"
          className="w-full pl-8 pr-2 py-1.5 text-xs font-mono rounded border border-border bg-background focus:outline-none focus:border-gold"
        />
      </div>

      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <div className="rounded border border-border bg-bg-secondary overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-background">
              <tr>
                <th className="text-left px-3 py-2 font-mono text-[10px] uppercase text-muted-foreground">
                  Usuario
                </th>
                <th className="text-left px-3 py-2 font-mono text-[10px] uppercase text-muted-foreground">
                  Email
                </th>
                <th className="text-left px-3 py-2 font-mono text-[10px] uppercase text-muted-foreground">
                  Org
                </th>
                <th className="text-left px-3 py-2 font-mono text-[10px] uppercase text-muted-foreground">
                  Registro
                </th>
                <th className="text-right px-3 py-2 font-mono text-[10px] uppercase text-muted-foreground">
                  Rol global
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.user_id} className="border-t border-border">
                  <td className="px-3 py-2 font-mono">{u.display_name ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-muted-foreground">{u.email ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-muted-foreground">
                    {u.organization ?? "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => toggleAdmin(u.user_id, !!u.is_super_admin)}
                      className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border inline-flex items-center gap-1 ${
                        u.is_super_admin
                          ? "bg-gold/15 text-gold border-gold/30 hover:bg-gold/25"
                          : "bg-background text-muted-foreground border-border hover:text-foreground"
                      }`}
                      title={u.is_super_admin ? "Quitar super-admin" : "Hacer super-admin"}
                    >
                      {u.is_super_admin ? (
                        <>
                          <Crown className="w-3 h-3" /> super-admin
                        </>
                      ) : (
                        <>
                          <UserMinus className="w-3 h-3" /> usuario
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-6 text-center text-xs font-mono text-muted-foreground"
                  >
                    Sin resultados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ProjectsTab() {
  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: projects } = await supabase
        .from("projects")
        .select("id,code,name,commodity,country,status,created_at")
        .order("created_at", { ascending: false });
      const ids = (projects ?? []).map((p) => p.id);
      const { data: members } = ids.length
        ? await supabase.from("project_members").select("project_id").in("project_id", ids)
        : { data: [] as { project_id: string }[] };
      const counts = new Map<string, number>();
      (members ?? []).forEach((m) => counts.set(m.project_id, (counts.get(m.project_id) ?? 0) + 1));
      setRows((projects ?? []).map((p) => ({ ...p, member_count: counts.get(p.id) ?? 0 })));
      setLoading(false);
    })();
  }, []);

  if (loading) return <Loader2 className="w-4 h-4 animate-spin" />;

  return (
    <div className="rounded border border-border bg-bg-secondary overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-background">
          <tr>
            <th className="text-left px-3 py-2 font-mono text-[10px] uppercase text-muted-foreground">
              Código
            </th>
            <th className="text-left px-3 py-2 font-mono text-[10px] uppercase text-muted-foreground">
              Nombre
            </th>
            <th className="text-left px-3 py-2 font-mono text-[10px] uppercase text-muted-foreground">
              Commodity
            </th>
            <th className="text-left px-3 py-2 font-mono text-[10px] uppercase text-muted-foreground">
              País
            </th>
            <th className="text-left px-3 py-2 font-mono text-[10px] uppercase text-muted-foreground">
              Estado
            </th>
            <th className="text-right px-3 py-2 font-mono text-[10px] uppercase text-muted-foreground">
              Miembros
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-t border-border">
              <td className="px-3 py-2 font-mono text-gold">{p.code}</td>
              <td className="px-3 py-2 font-mono">{p.name}</td>
              <td className="px-3 py-2 font-mono text-muted-foreground">{p.commodity ?? "—"}</td>
              <td className="px-3 py-2 font-mono text-muted-foreground">{p.country ?? "—"}</td>
              <td className="px-3 py-2 font-mono">
                <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-teal/10 text-teal border border-teal/20">
                  {p.status}
                </span>
              </td>
              <td className="px-3 py-2 font-mono text-right">{p.member_count}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={6}
                className="px-3 py-6 text-center text-xs font-mono text-muted-foreground"
              >
                Sin proyectos.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function BillingTab() {
  return (
    <div className="rounded border border-dashed border-border bg-bg-secondary p-8 text-center">
      <CreditCard className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
      <div className="font-mono text-sm">Pagos & suscripciones</div>
      <p className="text-xs text-muted-foreground mt-2 max-w-md mx-auto">
        Conecta Stripe o Paddle desde{" "}
        <span className="font-mono text-gold">Connectors → Payments</span> para gestionar planes,
        cobros recurrentes, facturas e historial de pagos directamente desde aquí.
      </p>
      <div className="mt-4 grid grid-cols-3 gap-2 max-w-md mx-auto">
        <PlanStub name="Free" price="$0" features="3 proyectos · 1 GB" />
        <PlanStub name="Pro" price="$49/mes" features="20 proyectos · 50 GB · IA" highlight />
        <PlanStub name="Enterprise" price="Custom" features="Sin límites · SSO · soporte 24/7" />
      </div>
    </div>
  );
}

function PlanStub({
  name,
  price,
  features,
  highlight,
}: {
  name: string;
  price: string;
  features: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded border p-3 text-left ${highlight ? "border-gold bg-gold/5" : "border-border bg-background"}`}
    >
      <div className="font-mono font-semibold text-sm">{name}</div>
      <div className={`font-mono text-lg mt-1 ${highlight ? "text-gold" : ""}`}>{price}</div>
      <div className="text-[10px] font-mono text-muted-foreground mt-1">{features}</div>
    </div>
  );
}

function OperationsTab() {
  const [recent, setRecent] = useState<
    {
      id: string;
      action: string;
      entity_type: string;
      created_at: string;
      project_id: string | null;
    }[]
  >([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("audit_log")
        .select("id,action,entity_type,created_at,project_id")
        .order("created_at", { ascending: false })
        .limit(50);
      setRecent(data ?? []);
    })();
  }, []);

  return (
    <div className="space-y-4">
      <div className="rounded border border-border bg-bg-secondary p-4">
        <div className="font-mono text-sm font-semibold mb-2">Estado del sistema</div>
        <div className="grid grid-cols-3 gap-3 text-xs font-mono">
          <Health label="Base de datos" status="ok" />
          <Health label="Edge functions" status="ok" />
          <Health label="IA Gateway" status="ok" />
        </div>
      </div>

      <div className="rounded border border-border bg-bg-secondary overflow-hidden">
        <div className="px-3 py-2 border-b border-border font-mono text-xs font-semibold">
          Actividad reciente (audit log global)
        </div>
        <div className="divide-y divide-border max-h-96 overflow-y-auto">
          {recent.map((r) => (
            <div key={r.id} className="px-3 py-1.5 flex items-center gap-3 text-xs font-mono">
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded border ${
                  r.action === "INSERT"
                    ? "bg-teal/10 text-teal border-teal/20"
                    : r.action === "UPDATE"
                      ? "bg-info/10 text-info border-info/20"
                      : "bg-destructive/10 text-destructive border-destructive/20"
                }`}
              >
                {r.action}
              </span>
              <span>{r.entity_type}</span>
              <span className="ml-auto text-[10px] text-muted-foreground">
                {new Date(r.created_at).toLocaleString()}
              </span>
            </div>
          ))}
          {recent.length === 0 && (
            <div className="px-3 py-4 text-center text-xs font-mono text-muted-foreground">
              Sin actividad.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Health({ label, status }: { label: string; status: "ok" | "warn" | "down" }) {
  const color =
    status === "ok" ? "text-teal" : status === "warn" ? "text-gold" : "text-destructive";
  return (
    <div className="flex items-center gap-2">
      <span
        className={`w-2 h-2 rounded-full ${status === "ok" ? "bg-teal" : status === "warn" ? "bg-gold" : "bg-destructive"} animate-pulse`}
      />
      <span>{label}</span>
      <span className={`ml-auto uppercase text-[10px] ${color}`}>{status}</span>
    </div>
  );
}
