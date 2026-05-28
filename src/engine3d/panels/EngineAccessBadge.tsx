// EngineAccessBadge — Sprint 6
// Badge superior izquierdo que muestra rol y modo investor.
import { Lock, ShieldCheck } from "lucide-react";
import { engineRoleColor, engineRoleLabel } from "@/engine3d/access/enginePermissions";
import { useEngineRole } from "@/engine3d/hooks/useEngineRole";

type Props = {
  versionLabel?: string;
};

export function EngineAccessBadge({ versionLabel }: Props) {
  const { engineRole, isInvestor } = useEngineRole();
  return (
    <div className="absolute top-2 left-2 z-20 flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider">
      <div
        className={`flex items-center gap-1 px-2 py-1 rounded border ${engineRoleColor(engineRole)}`}
      >
        <ShieldCheck className="w-3 h-3" />
        {engineRoleLabel(engineRole)}
      </div>
      {isInvestor && (
        <div className="flex items-center gap-1 px-2 py-1 rounded border bg-black/60 border-border text-muted-foreground">
          <Lock className="w-3 h-3" /> read-only
        </div>
      )}
      {versionLabel && (
        <div className="px-2 py-1 rounded border bg-black/60 border-border text-cyan-300">
          v: {versionLabel}
        </div>
      )}
    </div>
  );
}
