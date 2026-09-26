import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type ModuleKey = "catastro" | "commodities" | "capital";

export type ModuleInfo = {
  key: ModuleKey;
  name_es: string;
  name_en: string;
  description_es: string | null;
  description_en: string | null;
  icon: string | null;
  display_order: number;
};

export type MyModulesResult = {
  plan_code: string | null;
  unrestricted: boolean;
  modules: ModuleInfo[];
  features: string[];
};

const SELECTED_KEY = "geocapitals:selected-module:v1";

/**
 * Modules the current user's plan includes (via get_my_modules RPC).
 * If the plan has no entitlements configured, `unrestricted` = true and
 * all gated modules are returned so existing users don't get locked out.
 */
export function useMyModules() {
  const { user } = useAuth();
  return useQuery<MyModulesResult>({
    queryKey: ["my-modules", user?.id ?? null],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_modules" as never);
      if (error) throw error;
      return (data ?? {
        plan_code: null,
        unrestricted: true,
        modules: [],
        features: [],
      }) as MyModulesResult;
    },
  });
}

/** Persisted selected module (falls back to first available). */
export function useSelectedModule(
  available: ModuleInfo[] | undefined,
): [ModuleKey | "all", (m: ModuleKey | "all") => void] {
  const [selected, setSelected] = useState<ModuleKey | "all">("all");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(SELECTED_KEY) as ModuleKey | "all" | null;
    if (stored) setSelected(stored);
  }, []);

  useEffect(() => {
    if (!available || available.length === 0) return;
    const keys = available.map((m) => m.key);
    // If only one module is available, force-select it.
    if (available.length === 1) {
      if (selected !== keys[0]) {
        setSelected(keys[0]);
        try {
          window.localStorage.setItem(SELECTED_KEY, keys[0]);
        } catch {
          // localStorage may be unavailable in restricted browser contexts.
        }
      }
      return;
    }
    if (selected !== "all" && !keys.includes(selected as ModuleKey)) {
      setSelected("all");
      try {
        window.localStorage.setItem(SELECTED_KEY, "all");
      } catch {
          // localStorage may be unavailable in restricted browser contexts.
        }
    }
  }, [available, selected]);

  const change = (m: ModuleKey | "all") => {
    setSelected(m);
    try {
      window.localStorage.setItem(SELECTED_KEY, m);
    } catch {
          // localStorage may be unavailable in restricted browser contexts.
        }
  };

  return [selected, change];
}

export function hasFeature(features: string[] | undefined, key: string): boolean {
  return Array.isArray(features) && features.includes(key);
}
