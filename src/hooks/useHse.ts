import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export const PERMIT_TYPES = ["environmental","water","exploration","community","safety","tailings","closure","other"] as const;
export type PermitType = typeof PERMIT_TYPES[number];

export const PERMIT_STATUS = ["active","expired","revoked","pending","renewed"] as const;
export type PermitStatus = typeof PERMIT_STATUS[number];

export const INCIDENT_SEVERITY = ["low","medium","high","critical","near_miss"] as const;
export type IncidentSeverity = typeof INCIDENT_SEVERITY[number];

export const INCIDENT_CATEGORY = ["safety","environmental","equipment","vehicle","health","security","other"] as const;
export type IncidentCategory = typeof INCIDENT_CATEGORY[number];

export const INCIDENT_STATUS = ["open","investigating","closed","escalated"] as const;
export type IncidentStatus = typeof INCIDENT_STATUS[number];

export const COMMUNITY_EVENT_TYPES = ["meeting","consultation","workshop","complaint","agreement","donation","training","other"] as const;
export type CommunityEventType = typeof COMMUNITY_EVENT_TYPES[number];

export const COMMUNITY_EVENT_STATUS = ["planned","completed","cancelled","follow_up"] as const;
export type CommunityEventStatus = typeof COMMUNITY_EVENT_STATUS[number];

export type HsePermit = {
  id: string;
  project_id: string;
  permit_type: PermitType;
  authority: string | null;
  number: string | null;
  title: string;
  issued_at: string | null;
  expires_at: string | null;
  status: PermitStatus;
  document_url: string | null;
  notes: string | null;
  created_at: string;
};

export type HseIncident = {
  id: string;
  project_id: string;
  occurred_at: string;
  severity: IncidentSeverity;
  category: IncidentCategory;
  location: string | null;
  description: string;
  people_affected: number;
  corrective_actions: string | null;
  status: IncidentStatus;
  reported_by: string;
  closed_at: string | null;
  notes: string | null;
  created_at: string;
};

export type CommunityEvent = {
  id: string;
  project_id: string;
  event_type: CommunityEventType;
  community_name: string;
  event_date: string;
  attendees: number | null;
  summary: string;
  commitments: string | null;
  follow_up_date: string | null;
  status: CommunityEventStatus;
  created_at: string;
};

export function useHse(projectId: string | null) {
  const { user } = useAuth();
  const [permits, setPermits] = useState<HsePermit[]>([]);
  const [incidents, setIncidents] = useState<HseIncident[]>([]);
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!projectId) {
      setPermits([]); setIncidents([]); setEvents([]); setLoading(false); return;
    }
    setLoading(true);
    const [p, i, e] = await Promise.all([
      supabase.from("hse_permits").select("*").eq("project_id", projectId).order("expires_at", { ascending: true, nullsFirst: false }),
      supabase.from("hse_incidents").select("*").eq("project_id", projectId).order("occurred_at", { ascending: false }),
      supabase.from("community_events").select("*").eq("project_id", projectId).order("event_date", { ascending: false }),
    ]);
    if (p.error || i.error || e.error) setError((p.error?.message || i.error?.message || e.error?.message) ?? null);
    else setError(null);
    setPermits((p.data ?? []) as HsePermit[]);
    setIncidents((i.data ?? []) as HseIncident[]);
    setEvents((e.data ?? []) as CommunityEvent[]);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { refresh(); }, [refresh]);

  const addPermit = useCallback(async (p: Omit<HsePermit, "id" | "created_at" | "project_id">) => {
    if (!user || !projectId) return { error: "no-context" };
    const { error: err } = await supabase.from("hse_permits").insert({ ...p, project_id: projectId, created_by: user.id });
    await refresh();
    return { error: err?.message ?? null };
  }, [user, projectId, refresh]);

  const addIncident = useCallback(async (i: Omit<HseIncident, "id" | "created_at" | "project_id" | "reported_by">) => {
    if (!user || !projectId) return { error: "no-context" };
    const { error: err } = await supabase.from("hse_incidents").insert({ ...i, project_id: projectId, reported_by: user.id });
    await refresh();
    return { error: err?.message ?? null };
  }, [user, projectId, refresh]);

  const addEvent = useCallback(async (e: Omit<CommunityEvent, "id" | "created_at" | "project_id">) => {
    if (!user || !projectId) return { error: "no-context" };
    const { error: err } = await supabase.from("community_events").insert({ ...e, project_id: projectId, created_by: user.id });
    await refresh();
    return { error: err?.message ?? null };
  }, [user, projectId, refresh]);

  const updateIncidentStatus = useCallback(async (id: string, status: IncidentStatus) => {
    const patch: { status: IncidentStatus; closed_at?: string } = { status };
    if (status === "closed") patch.closed_at = new Date().toISOString();
    const { error: err } = await supabase.from("hse_incidents").update(patch).eq("id", id);
    await refresh();
    return { error: err?.message ?? null };
  }, [refresh]);

  // Derived
  const now = Date.now();
  const expiringPermits = permits.filter((p) => {
    if (!p.expires_at || p.status !== "active") return false;
    const days = (new Date(p.expires_at).getTime() - now) / (1000 * 3600 * 24);
    return days >= 0 && days <= 90;
  });
  const expiredPermits = permits.filter((p) => {
    if (!p.expires_at) return false;
    return new Date(p.expires_at).getTime() < now && p.status !== "renewed";
  });
  const openIncidents = incidents.filter((i) => i.status === "open" || i.status === "investigating");

  return {
    permits, incidents, events, loading, error, refresh,
    addPermit, addIncident, addEvent, updateIncidentStatus,
    expiringPermits, expiredPermits, openIncidents,
  };
}
