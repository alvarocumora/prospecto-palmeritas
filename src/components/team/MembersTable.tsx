import { useState } from "react";
import type { Member } from "@/hooks/useTeam";
import type { ProjectRole } from "@/hooks/useProjectRole";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export function MembersTable({
  members,
  canManage,
  onUpdateRole,
  onRemove,
}: {
  members: Member[];
  canManage: boolean;
  onUpdateRole: (id: string, role: ProjectRole) => Promise<{ message: string } | null>;
  onRemove: (id: string) => Promise<{ message: string } | null>;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  return (
    <div className="rounded border border-border bg-bg-secondary overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-background">
          <tr>
            <th className="text-left px-3 py-2 font-mono text-[10px] uppercase text-muted-foreground">Usuario</th>
            <th className="text-left px-3 py-2 font-mono text-[10px] uppercase text-muted-foreground">Email</th>
            <th className="text-left px-3 py-2 font-mono text-[10px] uppercase text-muted-foreground">Rol</th>
            {canManage && <th className="px-3 py-2 w-10" />}
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.id} className="border-t border-border">
              <td className="px-3 py-2 font-mono">{m.display_name ?? "—"}</td>
              <td className="px-3 py-2 font-mono text-muted-foreground">{m.email ?? "—"}</td>
              <td className="px-3 py-2">
                {canManage && m.role !== "owner" ? (
                  <select
                    value={m.role}
                    disabled={busy === m.id}
                    onChange={async (e) => {
                      setBusy(m.id);
                      const err = await onUpdateRole(m.id, e.target.value as ProjectRole);
                      if (err) toast.error(err.message);
                      else toast.success("Rol actualizado");
                      setBusy(null);
                    }}
                    className="px-1.5 py-0.5 text-xs font-mono rounded border border-border bg-background"
                  >
                    <option value="viewer">Lector</option>
                    <option value="geologist">Geólogo</option>
                    <option value="admin">Admin</option>
                  </select>
                ) : (
                  <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-gold/10 text-gold border border-gold/20">
                    {m.role}
                  </span>
                )}
              </td>
              {canManage && (
                <td className="px-3 py-2">
                  {m.role !== "owner" && (
                    <button
                      onClick={async () => {
                        if (!confirm("¿Quitar a este miembro del proyecto?")) return;
                        setBusy(m.id);
                        const err = await onRemove(m.id);
                        if (err) toast.error(err.message);
                        else toast.success("Miembro eliminado");
                        setBusy(null);
                      }}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
          {members.length === 0 && (
            <tr><td colSpan={canManage ? 4 : 3} className="px-3 py-4 text-center text-xs text-muted-foreground font-mono">Sin miembros aún.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
