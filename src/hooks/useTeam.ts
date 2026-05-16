import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ProjectRole } from "./useProjectRole";

export type Member = {
  id: string;
  user_id: string;
  role: ProjectRole;
  created_at: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
};

export type Invitation = {
  id: string;
  email: string;
  role: ProjectRole;
  status: string;
  token: string;
  expires_at: string;
  created_at: string;
};

export function useTeam(projectId: string | null) {
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!projectId) {
      setMembers([]);
      setInvitations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [m, inv] = await Promise.all([
      supabase
        .from("project_members")
        .select("id,user_id,role,created_at")
        .eq("project_id", projectId),
      supabase
        .from("project_invitations")
        .select("id,email,role,status,token,expires_at,created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false }),
    ]);

    if (m.error) {
      setError(m.error.message);
      setLoading(false);
      return;
    }
    const memberRows = m.data ?? [];
    const userIds = memberRows.map((x) => x.user_id);
    const { data: profiles } = userIds.length
      ? await supabase
          .from("profiles")
          .select("user_id,display_name,email,avatar_url")
          .in("user_id", userIds)
      : {
          data: [] as {
            user_id: string;
            display_name: string | null;
            email: string | null;
            avatar_url: string | null;
          }[],
        };
    const byUser = new Map((profiles ?? []).map((p) => [p.user_id, p]));
    setMembers(
      memberRows.map((mm) => ({
        id: mm.id,
        user_id: mm.user_id,
        role: mm.role as ProjectRole,
        created_at: mm.created_at,
        display_name: byUser.get(mm.user_id)?.display_name ?? null,
        email: byUser.get(mm.user_id)?.email ?? null,
        avatar_url: byUser.get(mm.user_id)?.avatar_url ?? null,
      })),
    );
    setInvitations((inv.data ?? []) as Invitation[]);
    setError(null);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateRole = useCallback(
    async (memberId: string, role: ProjectRole) => {
      const { error } = await supabase.from("project_members").update({ role }).eq("id", memberId);
      if (!error) await refresh();
      return error;
    },
    [refresh],
  );

  const removeMember = useCallback(
    async (memberId: string) => {
      const { error } = await supabase.from("project_members").delete().eq("id", memberId);
      if (!error) await refresh();
      return error;
    },
    [refresh],
  );

  const revokeInvitation = useCallback(
    async (invId: string) => {
      const { error } = await supabase.from("project_invitations").delete().eq("id", invId);
      if (!error) await refresh();
      return error;
    },
    [refresh],
  );

  return {
    members,
    invitations,
    loading,
    error,
    refresh,
    updateRole,
    removeMember,
    revokeInvitation,
  };
}
