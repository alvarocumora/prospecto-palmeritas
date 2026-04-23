import { useMemo, useState } from "react";
import type { Member } from "@/hooks/useTeam";
import {
  MANAGEABLE_MODULES,
  buildCapKey,
  effectiveCanView,
  effectiveCanEdit,
  useProjectCapabilities,
  type ModuleAction,
} from "@/hooks/useMemberCapabilities";
import { Eye, Pencil, Ban, RotateCcw, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function CapabilitiesMatrix({
  members,
  canManage,
}: {
  members: Member[];
  canManage: boolean;
}) {
  const { caps, loading, setCapability, clearMember } = useProjectCapabilities();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(
    members.find((m) => m.role !== "owner")?.user_id ?? null,
  );
  const [busy, setBusy] = useState<string | null>(null);

  const overridesByUser = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const c of caps) {
      if (!map.has(c.user_id)) map.set(c.user_id, new Set());
      map.get(c.user_id)!.add(c.capability);
    }
    return map;
  }, [caps]);

  const selected = members.find((m) => m.user_id === selectedUserId) ?? null;
  const overrides = selected ? overridesByUser.get(selected.user_id) ?? new Set<string>() : new Set<string>();

  const toggle = async (module: string, action: ModuleAction, enabled: boolean) => {
    if (!selected) return;
    const k = `${selected.user_id}:${module}:${action}`;
    setBusy(k);
    await setCapability(selected.user_id, module, action, enabled);
    setBusy(null);
  };

  return (
    <div className="rounded border border-border bg-bg-secondary">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-gold" />
          <div>
            <div className="text-xs font-mono">Permisos granulares por miembro</div>
            <div className="text-[10px] font-mono text-muted-foreground">
              Override sobre el rol — vista, edición o bloqueo explícito por módulo
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={selectedUserId ?? ""}
            onValueChange={(v) => setSelectedUserId(v)}
            disabled={!canManage}
          >
            <SelectTrigger className="h-8 text-xs font-mono w-[220px]">
              <SelectValue placeholder="Selecciona miembro…" />
            </SelectTrigger>
            <SelectContent>
              {members.map((m) => (
                <SelectItem key={m.user_id} value={m.user_id}>
                  {m.display_name ?? m.email ?? m.user_id.slice(0, 8)} · {m.role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canManage && selected && selected.role !== "owner" && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={async () => {
                if (!confirm(`Restablecer permisos de ${selected.display_name ?? selected.email} al rol por defecto?`)) return;
                await clearMember(selected.user_id);
              }}
            >
              <RotateCcw className="w-3 h-3 mr-1" /> Reset
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="p-6 text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin" /> Cargando…
        </div>
      ) : !selected ? (
        <div className="p-6 text-xs text-muted-foreground font-mono text-center">
          Selecciona un miembro para configurar sus permisos.
        </div>
      ) : selected.role === "owner" ? (
        <div className="p-6 text-xs text-muted-foreground font-mono text-center">
          El rol Owner tiene acceso completo y no puede ser restringido.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-background">
              <tr>
                <th className="text-left px-3 py-2 font-mono text-[10px] uppercase text-muted-foreground">Módulo</th>
                <th className="px-2 py-2 font-mono text-[10px] uppercase text-muted-foreground w-24">Default rol</th>
                <th className="px-2 py-2 font-mono text-[10px] uppercase text-muted-foreground w-24">
                  <Eye className="w-3 h-3 inline mr-1" /> Ver
                </th>
                <th className="px-2 py-2 font-mono text-[10px] uppercase text-muted-foreground w-24">
                  <Pencil className="w-3 h-3 inline mr-1" /> Editar
                </th>
                <th className="px-2 py-2 font-mono text-[10px] uppercase text-muted-foreground w-24">
                  <Ban className="w-3 h-3 inline mr-1" /> Bloquear
                </th>
                <th className="px-2 py-2 font-mono text-[10px] uppercase text-muted-foreground w-28">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {MANAGEABLE_MODULES.map(({ key, label }) => {
                const view = overrides.has(buildCapKey(key, "view"));
                const edit = overrides.has(buildCapKey(key, "edit"));
                const deny = overrides.has(buildCapKey(key, "deny"));
                const effView = effectiveCanView(selected.role, key, overrides);
                const effEdit = effectiveCanEdit(selected.role, key, overrides);

                return (
                  <tr key={key} className="border-t border-border">
                    <td className="px-3 py-2 font-mono">{label}</td>
                    <td className="px-2 py-2 text-center">
                      <DefaultPill role={selected.role} module={key} />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <CheckCell
                        checked={view}
                        disabled={!canManage || busy !== null || deny}
                        onChange={(v) => toggle(key, "view", v)}
                      />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <CheckCell
                        checked={edit}
                        disabled={!canManage || busy !== null || deny}
                        onChange={(v) => toggle(key, "edit", v)}
                      />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <CheckCell
                        checked={deny}
                        disabled={!canManage || busy !== null}
                        danger
                        onChange={(v) => toggle(key, "deny", v)}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <ResultPill view={effView} edit={effEdit} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CheckCell({
  checked, disabled, danger, onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  danger?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
      className={`w-4 h-4 rounded border-border ${danger ? "accent-destructive" : "accent-gold"} cursor-pointer disabled:cursor-not-allowed disabled:opacity-50`}
    />
  );
}

function DefaultPill({ role, module }: { role: string; module: string }) {
  // simple lookup against MODULE_ROLES
  // re-import lazily to avoid extra cost
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require("@/hooks/useProjectRole");
  const allowed: string[] = mod.MODULE_ROLES?.[module] ?? [];
  const canWriteRoles: string[] = mod.WRITE_ROLES ?? [];
  const hasAccess = allowed.includes(role);
  const hasWrite = hasAccess && canWriteRoles.includes(role);
  return (
    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${hasWrite ? "border-gold/40 text-gold" : hasAccess ? "border-border text-muted-foreground" : "border-destructive/30 text-destructive/70"}`}>
      {hasWrite ? "edit" : hasAccess ? "view" : "—"}
    </span>
  );
}

function ResultPill({ view, edit }: { view: boolean; edit: boolean }) {
  if (edit) return <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-gold/10 text-gold border border-gold/30">PUEDE EDITAR</span>;
  if (view) return <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-border text-muted-foreground">SOLO VER</span>;
  return <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/30">SIN ACCESO</span>;
}
