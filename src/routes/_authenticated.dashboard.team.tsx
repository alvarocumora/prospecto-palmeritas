import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useProjects } from "@/hooks/useProjects";
import { useTeam } from "@/hooks/useTeam";
import { useProjectRole } from "@/hooks/useProjectRole";
import { MembersTable } from "@/components/team/MembersTable";
import { InviteMemberDialog } from "@/components/team/InviteMemberDialog";
import { CapabilitiesMatrix } from "@/components/team/CapabilitiesMatrix";
import { UserPlus, Mail, Trash2, Copy, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/team")({
  head: () => ({ meta: [{ title: "Equipo — Geocapitals" }] }),
  component: TeamPage,
});

function TeamPage() {
  const { active } = useProjects();
  const role = useProjectRole();
  const canManage = role === "owner" || role === "admin";
  const { members, invitations, loading, updateRole, removeMember, revokeInvitation, refresh } =
    useTeam(active?.id ?? null);
  const [inviteOpen, setInviteOpen] = useState(false);

  if (!active) {
    return <div className="p-8 text-sm text-muted-foreground">Selecciona un proyecto primero.</div>;
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto pb-20 md:pb-8">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">
            Proyecto · {active.code}
          </div>
          <h1 className="text-xl md:text-2xl font-bold mt-1">Equipo de {active.name}</h1>
        </div>
        {canManage && (
          <button
            onClick={() => setInviteOpen(true)}
            className="px-3 py-1.5 rounded bg-gold text-bg-secondary text-xs font-mono font-semibold inline-flex items-center gap-1.5"
          >
            <UserPlus className="w-3.5 h-3.5" /> Invitar
          </button>
        )}
      </header>

      <section className="mb-8">
        <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">
          Miembros
        </h2>
        {loading ? (
          <div className="text-xs text-muted-foreground">Cargando…</div>
        ) : (
          <MembersTable
            members={members}
            canManage={canManage}
            onUpdateRole={updateRole}
            onRemove={removeMember}
          />
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5" /> Capacidades por miembro
        </h2>
        {!loading && <CapabilitiesMatrix members={members} canManage={canManage} />}
      </section>

      {canManage && (
        <section>
          <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">
            Invitaciones
          </h2>
          <div className="rounded border border-border bg-bg-secondary divide-y divide-border">
            {invitations.length === 0 && (
              <div className="px-3 py-4 text-xs text-muted-foreground font-mono text-center">
                Sin invitaciones pendientes.
              </div>
            )}
            {invitations.map((inv) => (
              <div key={inv.id} className="px-3 py-2 flex items-center gap-3 text-xs">
                <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-mono truncate">{inv.email}</div>
                  <div className="text-[10px] font-mono text-muted-foreground">
                    {inv.role} · {inv.status} · expira{" "}
                    {new Date(inv.expires_at).toLocaleDateString()}
                  </div>
                </div>
                <button
                  onClick={async () => {
                    const link = `https://geocapitals.com/invitations/${inv.token}`;
                    await navigator.clipboard.writeText(link);
                    toast.success("Enlace copiado");
                  }}
                  className="p-1 text-muted-foreground hover:text-gold"
                  title="Copiar enlace"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={async () => {
                    if (!confirm("¿Revocar invitación?")) return;
                    const err = await revokeInvitation(inv.id);
                    if (err) toast.error(err.message);
                    else toast.success("Invitación revocada");
                  }}
                  className="p-1 text-muted-foreground hover:text-destructive"
                  title="Revocar"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {inviteOpen && (
        <InviteMemberDialog
          projectId={active.id}
          onClose={() => setInviteOpen(false)}
          onInvited={refresh}
        />
      )}
    </div>
  );
}
