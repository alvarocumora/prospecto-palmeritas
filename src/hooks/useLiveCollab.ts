// Sprint 6.8 — Live Collaboration
// Combina (a) Presence Realtime para cursores en vivo y
// (b) suscripción/CRUD a map_annotations (pins persistentes).

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type LiveCursor = {
  user_id: string;
  display_name: string;
  color: string;
  lat: number;
  lng: number;
  ts: number;
};

export type MapAnnotation = {
  id: string;
  project_id: string;
  created_by: string;
  lat: number;
  lng: number;
  text: string;
  color: string;
  resolved: boolean;
  created_at: string;
  updated_at: string;
};

// Stable color per user (deterministic hash → palette)
const PALETTE = ["#f0c96b", "#7dd3fc", "#fda4af", "#86efac", "#c4b5fd", "#fdba74", "#67e8f9"];
function colorForUser(uid: string): string {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

export function useLiveCollab(projectId: string | null) {
  const { user } = useAuth();
  const [cursors, setCursors] = useState<LiveCursor[]>([]);
  const [annotations, setAnnotations] = useState<MapAnnotation[]>([]);
  const [sharing, setSharing] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const displayNameRef = useRef<string>("");

  // Resolve display name once
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        displayNameRef.current = data?.display_name ?? user.email?.split("@")[0] ?? "Anon";
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Load + subscribe annotations (always on, regardless of "sharing")
  useEffect(() => {
    if (!projectId) {
      setAnnotations([]);
      return;
    }
    let cancelled = false;
    void supabase
      .from("map_annotations")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (cancelled) return;
        setAnnotations((data ?? []) as MapAnnotation[]);
      });

    const ch = supabase
      .channel(`annot:${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "map_annotations",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          setAnnotations((prev) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as MapAnnotation;
              if (prev.some((a) => a.id === row.id)) return prev;
              return [row, ...prev];
            }
            if (payload.eventType === "UPDATE") {
              const row = payload.new as MapAnnotation;
              return prev.map((a) => (a.id === row.id ? row : a));
            }
            if (payload.eventType === "DELETE") {
              const row = payload.old as MapAnnotation;
              return prev.filter((a) => a.id !== row.id);
            }
            return prev;
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(ch);
    };
  }, [projectId]);

  // Presence channel for cursors — only when sharing is enabled
  useEffect(() => {
    if (!sharing || !projectId || !user) {
      setCursors([]);
      return;
    }
    const ch = supabase.channel(`cursors:${projectId}`, {
      config: { presence: { key: user.id } },
    });

    const refreshFromState = () => {
      const state = ch.presenceState() as Record<string, Array<Partial<LiveCursor>>>;
      const list: LiveCursor[] = [];
      for (const [uid, metas] of Object.entries(state)) {
        if (uid === user.id) continue; // don't render own cursor
        const m = metas[0];
        if (!m || typeof m.lat !== "number" || typeof m.lng !== "number") continue;
        list.push({
          user_id: uid,
          display_name: m.display_name ?? "Anon",
          color: m.color ?? colorForUser(uid),
          lat: m.lat,
          lng: m.lng,
          ts: m.ts ?? Date.now(),
        });
      }
      setCursors(list);
    };

    ch.on("presence", { event: "sync" }, refreshFromState)
      .on("presence", { event: "join" }, refreshFromState)
      .on("presence", { event: "leave" }, refreshFromState)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await ch.track({
            display_name: displayNameRef.current || "Anon",
            color: colorForUser(user.id),
            lat: null,
            lng: null,
            ts: Date.now(),
          });
        }
      });

    channelRef.current = ch;
    return () => {
      channelRef.current = null;
      void supabase.removeChannel(ch);
    };
  }, [sharing, projectId, user]);

  // Throttled cursor broadcast
  const lastSentRef = useRef(0);
  const broadcastCursor = useCallback(
    (lat: number, lng: number) => {
      if (!sharing || !channelRef.current || !user) return;
      const now = Date.now();
      if (now - lastSentRef.current < 80) return; // ~12 Hz max
      lastSentRef.current = now;
      void channelRef.current.track({
        display_name: displayNameRef.current || "Anon",
        color: colorForUser(user.id),
        lat,
        lng,
        ts: now,
      });
    },
    [sharing, user],
  );

  // Annotation CRUD
  const addAnnotation = useCallback(
    async (lat: number, lng: number, text: string) => {
      if (!projectId || !user) return null;
      const { data, error } = await supabase
        .from("map_annotations")
        .insert({ project_id: projectId, created_by: user.id, lat, lng, text, color: "gold" })
        .select()
        .single();
      if (error) throw error;
      return data as MapAnnotation;
    },
    [projectId, user],
  );

  const toggleResolved = useCallback(async (id: string, resolved: boolean) => {
    const { error } = await supabase.from("map_annotations").update({ resolved }).eq("id", id);
    if (error) throw error;
  }, []);

  const deleteAnnotation = useCallback(async (id: string) => {
    const { error } = await supabase.from("map_annotations").delete().eq("id", id);
    if (error) throw error;
  }, []);

  return {
    cursors,
    annotations,
    sharing,
    setSharing,
    broadcastCursor,
    addAnnotation,
    toggleResolved,
    deleteAnnotation,
    currentUserId: user?.id ?? null,
  };
}
