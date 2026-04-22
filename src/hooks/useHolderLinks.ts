import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type HolderLink = {
  id: string;
  holder_id: string;
  project_id: string;
  link_type: "bulletin" | "court_case" | "external_url";
  bulletin_id: string | null;
  case_id: string | null;
  external_url: string | null;
  label: string | null;
  notes: string | null;
  auto_matched: boolean;
  linked_by: string | null;
  linked_at: string;
};

export type EnrichedBulletin = {
  id: string;
  publication_date: string | null;
  publication_number: string | null;
  publication_type: string | null;
  concession_name: string | null;
  comuna: string | null;
  source_url: string | null;
};

export type EnrichedCase = {
  id: string;
  case_number: string | null;
  court: string | null;
  matter: string | null;
  plaintiff: string | null;
  filed_at: string | null;
  status: string | null;
  source_url: string | null;
};

export type HolderLinksData = {
  bulletins: Array<HolderLink & { bulletin: EnrichedBulletin | null }>;
  cases: Array<HolderLink & { case: EnrichedCase | null }>;
  external: HolderLink[];
};

export function useHolderLinks(holderId: string | null) {
  const [data, setData] = useState<HolderLinksData>({ bulletins: [], cases: [], external: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!holderId) {
      setData({ bulletins: [], cases: [], external: [] });
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: links, error: err } = await supabase
      .from("holder_links")
      .select("*")
      .eq("holder_id", holderId)
      .order("linked_at", { ascending: false });
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    const bulletinIds = (links ?? []).filter((l) => l.bulletin_id).map((l) => l.bulletin_id!);
    const caseIds = (links ?? []).filter((l) => l.case_id).map((l) => l.case_id!);

    const [bRes, cRes] = await Promise.all([
      bulletinIds.length
        ? supabase.from("mining_bulletins").select("id,publication_date,publication_number,publication_type,concession_name,comuna,source_url").in("id", bulletinIds)
        : Promise.resolve({ data: [] as EnrichedBulletin[] }),
      caseIds.length
        ? supabase.from("mining_court_cases").select("id,case_number,court,matter,plaintiff,filed_at,status,source_url").in("id", caseIds)
        : Promise.resolve({ data: [] as EnrichedCase[] }),
    ]);

    const bMap = new Map((bRes.data ?? []).map((b) => [b.id, b as EnrichedBulletin]));
    const cMap = new Map((cRes.data ?? []).map((c) => [c.id, c as EnrichedCase]));

    const bulletins = (links ?? [])
      .filter((l) => l.link_type === "bulletin" && l.bulletin_id)
      .map((l) => ({ ...(l as HolderLink), bulletin: bMap.get(l.bulletin_id!) ?? null }));
    const cases = (links ?? [])
      .filter((l) => l.link_type === "court_case" && l.case_id)
      .map((l) => ({ ...(l as HolderLink), case: cMap.get(l.case_id!) ?? null }));
    const external = (links ?? []).filter((l) => l.link_type === "external_url") as HolderLink[];

    setData({ bulletins, cases, external });
    setError(null);
    setLoading(false);
  }, [holderId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addExternal = useCallback(
    async (input: { holderId: string; projectId: string; userId: string; url: string; label?: string }) => {
      const { error: err } = await supabase.from("holder_links").insert({
        holder_id: input.holderId,
        project_id: input.projectId,
        link_type: "external_url",
        external_url: input.url,
        label: input.label ?? null,
        linked_by: input.userId,
        auto_matched: false,
      });
      if (err) throw err;
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      const { error: err } = await supabase.from("holder_links").delete().eq("id", id);
      if (err) throw err;
      await refresh();
    },
    [refresh],
  );

  const rescan = useCallback(async (holderId: string) => {
    // Re-trigger matching by touching the holder row (updates name/rut trigger fires)
    const { data: h } = await supabase.from("concession_holders").select("name").eq("id", holderId).maybeSingle();
    if (h) {
      await supabase.from("concession_holders").update({ name: h.name }).eq("id", holderId);
    }
    await refresh();
  }, [refresh]);

  return { data, loading, error, refresh, addExternal, remove, rescan };
}
