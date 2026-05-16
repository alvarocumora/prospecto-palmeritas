import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export const EXPENSE_CATEGORIES = [
  "drilling",
  "geophysics",
  "geochemistry",
  "drones",
  "logistics",
  "lab",
  "permits",
  "salaries",
  "equipment",
  "other",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  drilling: "Sondaje",
  geophysics: "Geofísica",
  geochemistry: "Geoquímica",
  drones: "Drones",
  logistics: "Logística",
  lab: "Laboratorio",
  permits: "Permisos",
  salaries: "Salarios",
  equipment: "Equipos",
  other: "Otros",
};

export type CampaignBudget = {
  id: string;
  project_id: string;
  campaign_id: string;
  category: ExpenseCategory;
  planned_amount_usd: number;
  notes: string | null;
  created_at: string;
};

export type CampaignExpense = {
  id: string;
  project_id: string;
  campaign_id: string;
  hole_id: string | null;
  category: ExpenseCategory;
  description: string;
  amount_usd: number;
  meters_drilled: number | null;
  vendor: string | null;
  invoice_number: string | null;
  expense_date: string;
  status: "pending" | "approved" | "rejected";
  approved_by: string | null;
  approved_at: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
};

export function useCampaignFinance(projectId: string | null, campaignId: string | null) {
  const { user } = useAuth();
  const [budgets, setBudgets] = useState<CampaignBudget[]>([]);
  const [expenses, setExpenses] = useState<CampaignExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!projectId || !campaignId) {
      setBudgets([]);
      setExpenses([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [b, e] = await Promise.all([
      supabase.from("campaign_budgets").select("*").eq("campaign_id", campaignId),
      supabase
        .from("campaign_expenses")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("expense_date", { ascending: false })
        .limit(2000),
    ]);
    if (b.error) setError(b.error.message);
    if (e.error) setError(e.error.message);
    setBudgets((b.data ?? []) as CampaignBudget[]);
    setExpenses((e.data ?? []) as CampaignExpense[]);
    setLoading(false);
  }, [projectId, campaignId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const upsertBudget = useCallback(
    async (category: ExpenseCategory, planned_amount_usd: number, notes?: string) => {
      if (!user || !projectId || !campaignId) return { error: "no-context" };
      const { error: err } = await supabase.from("campaign_budgets").upsert(
        {
          project_id: projectId,
          campaign_id: campaignId,
          category,
          planned_amount_usd,
          notes: notes ?? null,
          created_by: user.id,
        },
        { onConflict: "campaign_id,category" },
      );
      await refresh();
      return { error: err?.message ?? null };
    },
    [user, projectId, campaignId, refresh],
  );

  const addExpense = useCallback(
    async (
      input: Partial<CampaignExpense> & {
        category: ExpenseCategory;
        description: string;
        amount_usd: number;
      },
    ) => {
      if (!user || !projectId || !campaignId) return { error: "no-context" };
      const { error: err } = await supabase.from("campaign_expenses").insert({
        project_id: projectId,
        campaign_id: campaignId,
        hole_id: input.hole_id ?? null,
        category: input.category,
        description: input.description,
        amount_usd: input.amount_usd,
        meters_drilled: input.meters_drilled ?? null,
        vendor: input.vendor ?? null,
        invoice_number: input.invoice_number ?? null,
        expense_date: input.expense_date ?? new Date().toISOString().slice(0, 10),
        status: "pending",
        notes: input.notes ?? null,
        created_by: user.id,
      });
      await refresh();
      return { error: err?.message ?? null };
    },
    [user, projectId, campaignId, refresh],
  );

  const setExpenseStatus = useCallback(
    async (id: string, status: "pending" | "approved" | "rejected") => {
      if (!user) return { error: "no-user" };
      const patch =
        status === "approved"
          ? { status, approved_by: user.id, approved_at: new Date().toISOString() }
          : { status, approved_by: null, approved_at: null };
      const { error: err } = await supabase.from("campaign_expenses").update(patch).eq("id", id);
      await refresh();
      return { error: err?.message ?? null };
    },
    [user, refresh],
  );

  const deleteExpense = useCallback(
    async (id: string) => {
      const { error: err } = await supabase.from("campaign_expenses").delete().eq("id", id);
      await refresh();
      return { error: err?.message ?? null };
    },
    [refresh],
  );

  return {
    budgets,
    expenses,
    loading,
    error,
    refresh,
    upsertBudget,
    addExpense,
    setExpenseStatus,
    deleteExpense,
  };
}
