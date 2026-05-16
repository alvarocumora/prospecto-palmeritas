import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type HolderType = "persona" | "sociedad" | "comunidad";

export type ConcessionHolder = {
  id: string;
  project_id: string;
  name: string;
  rut: string | null;
  holder_type: string;
  legal_repr_name: string | null;
  legal_repr_rut: string | null;
  address: string | null;
  commune: string | null;
  region: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  economic_activity: string | null;
  incorporation_date: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type HolderWithCounts = ConcessionHolder & {
  concessions_count: number;
  bulletins_count: number;
  cases_count: number;
  files_count: number;
};

export const HOLDER_TYPE_LABELS: Record<string, string> = {
  persona: "Persona natural",
  sociedad: "Sociedad",
  comunidad: "Comunidad",
};

export function normalizeRut(rut: string | null | undefined): string {
  if (!rut) return "";
  return rut.replace(/[.\s]/g, "").toLowerCase();
}

export function useHolders(projectId: string | null) {
  const [data, setData] = useState<HolderWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!projectId) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: holders, error: err } = await supabase
      .from("concession_holders")
      .select("*")
      .eq("project_id", projectId)
      .order("name");
    if (err) {
      setError(err.message);
      setData([]);
      setLoading(false);
      return;
    }
    const ids = (holders ?? []).map((h) => h.id);
    if (ids.length === 0) {
      setData([]);
      setLoading(false);
      setError(null);
      return;
    }
    // Counts in parallel
    const [conc, links, files] = await Promise.all([
      supabase.from("mining_concessions").select("holder_id").in("holder_id", ids),
      supabase.from("holder_links").select("holder_id, link_type").in("holder_id", ids),
      supabase.from("holder_files").select("holder_id").in("holder_id", ids),
    ]);
    const cMap = new Map<string, number>();
    (conc.data ?? []).forEach((r) => cMap.set(r.holder_id!, (cMap.get(r.holder_id!) ?? 0) + 1));
    const bMap = new Map<string, number>();
    const caseMap = new Map<string, number>();
    (links.data ?? []).forEach((r) => {
      if (r.link_type === "bulletin") bMap.set(r.holder_id, (bMap.get(r.holder_id) ?? 0) + 1);
      else if (r.link_type === "court_case")
        caseMap.set(r.holder_id, (caseMap.get(r.holder_id) ?? 0) + 1);
    });
    const fMap = new Map<string, number>();
    (files.data ?? []).forEach((r) => fMap.set(r.holder_id, (fMap.get(r.holder_id) ?? 0) + 1));

    setData(
      (holders ?? []).map((h) => ({
        ...(h as ConcessionHolder),
        concessions_count: cMap.get(h.id) ?? 0,
        bulletins_count: bMap.get(h.id) ?? 0,
        cases_count: caseMap.get(h.id) ?? 0,
        files_count: fMap.get(h.id) ?? 0,
      })),
    );
    setError(null);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

export function useHolder(holderId: string | null) {
  const [data, setData] = useState<ConcessionHolder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!holderId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: row, error: err } = await supabase
      .from("concession_holders")
      .select("*")
      .eq("id", holderId)
      .maybeSingle();
    if (err) setError(err.message);
    else setError(null);
    setData((row as ConcessionHolder) ?? null);
    setLoading(false);
  }, [holderId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
