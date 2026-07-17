import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { queryClient } from "@/lib/queryClient";
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

type ProjectsStore = {
  activeId: string | null;
  error: string | null;
  initializedUserId: string | null;
  loading: boolean;
  projects: Project[];
  userId: string | null;
};

const store: ProjectsStore = {
  activeId: null,
  error: null,
  initializedUserId: null,
  loading: true,
  projects: [],
  userId: null,
};

const listeners = new Set<() => void>();
let refreshPromise: Promise<void> | null = null;

function emitStoreChange() {
  listeners.forEach((listener) => listener());
}

function readStoredActiveId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

function writeStoredActiveId(id: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  } catch {
    // ignore localStorage failures
  }
}

function syncActiveProject(projects: Project[]) {
  let nextActiveId = store.activeId ?? readStoredActiveId();

  if (nextActiveId && !projects.some((project) => project.id === nextActiveId)) {
    nextActiveId = null;
  }

  if (!nextActiveId && projects.length > 0) {
    nextActiveId = projects[0].id;
  }

  if (nextActiveId !== store.activeId) {
    store.activeId = nextActiveId;
    writeStoredActiveId(nextActiveId);
  }
}

async function fetchProjects(userId: string | null, force = false) {
  if (!userId) {
    store.userId = null;
    store.initializedUserId = null;
    store.projects = [];
    store.error = null;
    store.loading = false;
    store.activeId = readStoredActiveId();
    emitStoreChange();
    return;
  }

  if (!force && store.initializedUserId === userId && !store.loading) {
    syncActiveProject(store.projects);
    emitStoreChange();
    return;
  }

  if (refreshPromise) {
    await refreshPromise;
    return;
  }

  store.userId = userId;
  store.loading = true;
  store.error = null;
  emitStoreChange();

  refreshPromise = (async () => {
    const { data, error } = await supabase
      .from("projects")
      .select("*, project_members!inner(role,user_id)")
      .eq("project_members.user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) {
      store.projects = [];
      store.error = error.message;
      store.loading = false;
      store.initializedUserId = userId;
      emitStoreChange();
      return;
    }

    type Row = Project & { project_members: { role: Project["role"] }[] };
    const rows = (data ?? []) as unknown as Row[];

    store.projects = rows.map((project) => ({
      ...project,
      role: project.project_members?.[0]?.role,
    }));
    store.error = null;
    store.loading = false;
    store.initializedUserId = userId;
    syncActiveProject(store.projects);
    emitStoreChange();
  })().finally(() => {
    refreshPromise = null;
  });

  await refreshPromise;
}

export function useProjects() {
  const { user } = useAuth();
  const [, forceRender] = useState(0);

  useEffect(() => {
    const onStoreChange = () => forceRender((count) => count + 1);
    listeners.add(onStoreChange);

    const syncFromStorage = () => {
      const storedActiveId = readStoredActiveId();
      if (storedActiveId !== store.activeId) {
        store.activeId = storedActiveId;
        emitStoreChange();
      }
    };

    syncFromStorage();

    if (typeof window !== "undefined") {
      const onStorage = (event: StorageEvent) => {
        if (event.key === ACTIVE_KEY) syncFromStorage();
      };

      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(onStoreChange);
        window.removeEventListener("storage", onStorage);
      };
    }

    return () => {
      listeners.delete(onStoreChange);
    };
  }, []);

  const refresh = useCallback(async () => {
    await fetchProjects(user?.id ?? null, true);
  }, [user?.id]);

  useEffect(() => {
    void fetchProjects(user?.id ?? null);
  }, [user?.id]);

  const setActiveId = useCallback((id: string | null) => {
    if (id === store.activeId) return;
    store.activeId = id;
    writeStoredActiveId(id);
    emitStoreChange();
    // Refrescar toda la data cacheada: cada módulo depende del proyecto activo,
    // así el cambio de selector se ve reflejado sin recargar la página.
    void queryClient.invalidateQueries();
  }, []);


  const active = store.projects.find((project) => project.id === store.activeId) ?? null;

  return {
    projects: store.projects,
    active,
    activeId: store.activeId,
    setActiveId,
    loading: store.loading,
    error: store.error,
    refresh,
  };
}
