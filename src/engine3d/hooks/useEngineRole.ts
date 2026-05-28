// useEngineRole — Sprint 6
import { useMemo } from "react";
import { useProjectRole } from "@/hooks/useProjectRole";
import {
  mapProjectRoleToEngine,
  canEngine,
  type EngineCapability,
  type EngineRole,
} from "@/engine3d/access/enginePermissions";

export function useEngineRole() {
  const projectRole = useProjectRole();
  const engineRole = useMemo<EngineRole | null>(
    () => mapProjectRoleToEngine(projectRole),
    [projectRole],
  );

  const can = useMemo(
    () => (capability: EngineCapability) => canEngine(engineRole, capability),
    [engineRole],
  );

  return { engineRole, projectRole, can, isInvestor: engineRole === "investor" };
}
