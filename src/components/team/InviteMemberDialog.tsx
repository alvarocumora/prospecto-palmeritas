import { useState, type FormEvent } from "react";
import { X, Loader2, Copy } from "lucide-react";
import type { ProjectRole } from "@/hooks/useProjectRole";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function InviteMemberDialog({
  projectId,
  onClose,
  onInvited,
}: {
  projectId: string;
  onClose: () => void;
  onInvited: () => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ProjectRole>("geologist");
  const [saving, setSaving] = useState(false);
  const [link, setLink] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-project-invitation", {
        body: { project_id: projectId, email, role },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setLink(data?.link ?? null);
      toast.success("Invitación creada");
      onInvited();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al invitar");
    } finally {
      setSaving(false);
    }
  };

  const copy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    toast.success("Enlace copiado");
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded border border-border bg-bg-secondary">
        <header className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="font-mono font-semibold text-sm">Invitar miembro</div>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </header>

        {link ? (
          <div className="p-4 space-y-3">
            <p className="text-xs text-muted-foreground font-mono">
              Comparte este enlace con la persona invitada (válido 14 días).
            </p>
            <div className="flex gap-1.5">
              <input readOnly value={link} className="flex-1 px-2 py-1.5 text-xs font-mono rounded border border-border bg-background" />
              <button onClick={copy} className="px-2 rounded bg-gold text-bg-secondary"><Copy className="w-3.5 h-3.5" /></button>
            </div>
            <button onClick={onClose} className="w-full mt-2 px-3 py-2 text-xs font-mono rounded border border-border hover:bg-accent">Cerrar</button>
          </div>
        ) : (
          <form onSubmit={submit} className="p-4 space-y-3">
            <label className="block">
              <div className="text-[10px] uppercase font-mono text-muted-foreground mb-1">Email</div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="persona@empresa.com"
                className="w-full px-2 py-1.5 text-xs font-mono rounded border border-border bg-background focus:outline-none focus:border-gold"
              />
            </label>
            <label className="block">
              <div className="text-[10px] uppercase font-mono text-muted-foreground mb-1">Rol</div>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as ProjectRole)}
                className="w-full px-2 py-1.5 text-xs font-mono rounded border border-border bg-background"
              >
                <option value="viewer">Lector</option>
                <option value="geologist">Geólogo</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <button
              type="submit"
              disabled={saving}
              className="w-full px-3 py-2 rounded bg-gold text-bg-secondary text-xs font-mono font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
            >
              {saving && <Loader2 className="w-3 h-3 animate-spin" />}
              Crear invitación
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
