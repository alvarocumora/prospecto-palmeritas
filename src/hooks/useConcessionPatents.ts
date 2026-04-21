import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ConcessionPatent = {
  id: string;
  concession_id: string;
  project_id: string;
  created_by: string;
  year: number;
  amount_utm: number;
  amount_clp: number | null;
  amount_usd: number | null;
  status: "pending" | "paid" | "overdue";
  due_date: string | null;
  paid_at: string | null;
  receipt_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type PatentStatus = "pending" | "paid" | "overdue" | "upcoming";

export const PATENT_COLORS: Record<PatentStatus, string> = {
  paid: "#0d9488",
  pending: "#3b82f6",
  upcoming: "#f59e0b",
  overdue: "#dc2626",
};

export const PATENT_LABELS: Record<PatentStatus, string> = {
  paid: "Pagada",
  pending: "Pendiente",
  upcoming: "Por vencer (<60d)",
  overdue: "Vencida",
};

export function patentDisplayStatus(p: ConcessionPatent): PatentStatus {
  if (p.status === "paid") return "paid";
  if (p.status === "overdue") return "overdue";
  if (p.due_date) {
    const days = Math.ceil((new Date(p.due_date).getTime() - Date.now()) / 86400000);
    if (days < 0) return "overdue";
    if (days <= 60) return "upcoming";
  }
  return "pending";
}

export function useConcessionPatents(projectId: string | null) {
  const [data, setData] = useState<ConcessionPatent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!projectId) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: rows, error: err } = await supabase
      .from("concession_patents")
      .select("*")
      .eq("project_id", projectId)
      .order("year", { ascending: false });
    if (err) {
      setError(err.message);
      setData([]);
    } else {
      setData((rows ?? []) as unknown as ConcessionPatent[]);
      setError(null);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
