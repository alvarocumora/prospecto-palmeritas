import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type Project = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  commodity: string | null;
  country: string | null;
  region: string | null;
  center_lat: number | null;
  center_lng: number | null;
  status: string;
  cover_image_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  role?: "owner" | "admin" | "geologist" | "viewer";
};

const ACTIVE_KEY = "trackmin:active-project";

export function useProjects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveIdState] = useState<string | null>(() =>
    typeof window === "undefined" ? null : localStorage.getItem(ACTIVE_KEY)
  );

  const refresh = useCallback(async () => {
    if (!user) {
      setProjects([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: err } = await supabase
      .from("projects")
      .select("*, project_members!inner(role,user_id)")
      .eq("project_members.user_id", user.id)
      .order("updated_at", { ascending: false });
    if (err) {
      setError(err.message);
      setProjects([]);
    } else {
      type Row = Project & { project_members: { role: Project["role"] }[] };
      const rows = (data ?? []) as unknown as Row[];
      setProjects(
        rows.map((p) => ({ ...p, role: p.project_members?.[0]?.role }))
      );
      setError(null);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setActiveId = useCallback((id: string | null) => {
    setActiveIdState(id);
    if (typeof window !== "undefined") {
      if (id) localStorage.setItem(ACTIVE_KEY, id);
      else localStorage.removeItem(ACTIVE_KEY);
    }
  }, []);

  // Auto-select first project when none active
  useEffect(() => {
    if (!activeId && projects.length > 0) setActiveId(projects[0].id);
    if (activeId && projects.length > 0 && !projects.some((p) => p.id === activeId)) {
      setActiveId(projects[0].id);
    }
  }, [projects, activeId, setActiveId]);

  const active = projects.find((p) => p.id === activeId) ?? null;

  return { projects, active, activeId, setActiveId, loading, error, refresh };
}
