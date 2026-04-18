import { useCallback, useEffect, useState } from "react";

export type QueuedStation = {
  id: string; // local uuid
  projectId: string;
  surveyId: string;
  station_id: string;
  lat: number;
  lng: number;
  mag_nt: number | null;
  ip_chargeability_mvv: number | null;
  ip_resistivity_ohmm: number | null;
  notes: string | null;
  created_by: string;
  queuedAt: number;
};

const KEY = "geocapitals:offline-stations";

function read(): QueuedStation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as QueuedStation[]) : [];
  } catch {
    return [];
  }
}

function write(items: QueuedStation[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(items));
}

export function useOfflineQueue() {
  const [queue, setQueue] = useState<QueuedStation[]>([]);
  const [online, setOnline] = useState<boolean>(
    typeof navigator === "undefined" ? true : navigator.onLine
  );

  useEffect(() => {
    setQueue(read());
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const enqueue = useCallback((item: Omit<QueuedStation, "id" | "queuedAt">) => {
    const next: QueuedStation = {
      ...item,
      id: crypto.randomUUID(),
      queuedAt: Date.now(),
    };
    const all = [...read(), next];
    write(all);
    setQueue(all);
    return next;
  }, []);

  const remove = useCallback((id: string) => {
    const all = read().filter((q) => q.id !== id);
    write(all);
    setQueue(all);
  }, []);

  const clear = useCallback(() => {
    write([]);
    setQueue([]);
  }, []);

  return { queue, online, enqueue, remove, clear };
}
