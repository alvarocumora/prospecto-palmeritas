/**
 * Crowdfunding + wallet del inversionista.
 * - getPublicRounds: avance agregado de cada ronda (sin datos personales), público.
 * - getMyWallet: tickets y posiciones SPV del usuario actual (RLS como usuario).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const ROUND_PROJECTS = [
  { code: "CHOLQUI", slug: "cholqui" as const, name: "Cholqui", token: "CHLQ" },
  { code: "LV-TIL-001", slug: "losverdes" as const, name: "Los Verdes–Tilama", token: "LVRD" },
];

export type PublicRound = {
  code: string;
  slug: "cholqui" | "losverdes";
  name: string;
  token: string;
  target: number;
  shares: number;
  sharePrice: number;
  minTicket: number;
  open: boolean;
  committed: number;
  settled: number;
  /** Colocación comprometida por la emisora (declarada, fuera de la plataforma). */
  anchor: number;
  investors: number;
};

/** Avance de colocación declarado por Valle Escondido SpA (fracción de la ronda). */
export const ANCHOR_PLACEMENT_PCT: Record<string, number> = {
  CHOLQUI: 0.47,
  "LV-TIL-001": 0.65,
};

export const getPublicRounds = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicRound[]> => {
    // Solo agregados: montos totales y número de tickets, nunca identidades.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const out: PublicRound[] = [];
    for (const p of ROUND_PROJECTS) {
      const { data: spv } = await supabaseAdmin
        .from("spv_entities")
        .select("round_size, round_shares, share_price, min_ticket, tickets_open")
        .eq("project_code", p.code)
        .maybeSingle();
      const { data: st } = await supabaseAdmin.rpc("spv_round_status", { _project_code: p.code });
      const s = Array.isArray(st) ? st[0] : null;
      const target = Number(spv?.round_size ?? 1_500_000);
      const anchor = Math.round(target * (ANCHOR_PLACEMENT_PCT[p.code] ?? 0));
      out.push({
        ...p,
        target,
        shares: Number(spv?.round_shares ?? 15_000),
        sharePrice: Number(spv?.share_price ?? 100),
        minTicket: Number(spv?.min_ticket ?? 15_000),
        open: !!spv?.tickets_open,
        committed: Number(s?.committed ?? 0) + anchor,
        settled: Number(s?.settled ?? 0),
        anchor,
        investors: Number(s?.tickets_count ?? 0),
      });
    }
    return out;
  },
);

export type WalletTicket = {
  id: string;
  ticket_code: string;
  amount: number;
  currency: string;
  shares_allocated: number | null;
  status: string;
  signed_at: string | null;
  created_at: string;
  project: string;
  token: string;
};
export type WalletPosition = {
  id: string;
  shares: number;
  amount_paid: number;
  currency: string;
  status: string;
  subscribed_on: string;
  document_url: string | null;
  project: string;
  token: string;
  slug: "cholqui" | "losverdes" | null;
  pctOfSpv: number | null;
};

export const getMyWallet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: spvs } = await supabase
      .from("spv_entities")
      .select("id, project_code, total_shares");
    const byId = new Map((spvs ?? []).map((s) => [s.id, s]));
    const meta = (spvId: string | null) => {
      const s = spvId ? byId.get(spvId) : undefined;
      const p = ROUND_PROJECTS.find((r) => r.code === s?.project_code);
      return {
        project: p?.name ?? s?.project_code ?? "SPV",
        token: p?.token ?? "SPV",
        slug: p?.slug ?? null,
        total: Number(s?.total_shares ?? 0),
      };
    };
    const [{ data: t }, { data: pos }] = await Promise.all([
      supabase
        .from("investment_tickets")
        .select(
          "id, ticket_code, spv_id, amount, currency, shares_allocated, status, signed_at, created_at, is_test",
        )
        .eq("investor_user_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("spv_positions")
        .select(
          "id, spv_id, shares, amount_paid, currency, status, subscribed_on, document_url, is_test",
        )
        .eq("investor_user_id", userId),
    ]);
    const tickets: WalletTicket[] = (t ?? []).map((r) => {
      const m = meta(r.spv_id);
      const { is_test, ...rest } = r;
      return {
        ...rest,
        amount: Number(r.amount),
        project: is_test ? `${m.project} · PRUEBA` : m.project,
        token: m.token,
      };
    });
    const positions: WalletPosition[] = (pos ?? []).map((r) => {
      const m = meta(r.spv_id);
      return {
        id: r.id,
        shares: Number(r.shares),
        amount_paid: Number(r.amount_paid),
        currency: r.currency,
        status: r.status,
        subscribed_on: r.subscribed_on,
        document_url: r.document_url,
        project: r.is_test ? `${m.project} · PRUEBA` : m.project,
        token: m.token,
        slug: m.slug,
        pctOfSpv: m.total ? (Number(r.shares) / m.total) * 100 : null,
      };
    });
    const active = positions.filter((p) => p.status !== "void" && p.status !== "cancelled");
    const pending = tickets.filter((x) => !["settled", "cancelled", "rejected"].includes(x.status));
    return {
      tickets,
      positions: active,
      totals: {
        invested: active.reduce((a, p) => a + p.amount_paid, 0),
        shares: active.reduce((a, p) => a + p.shares, 0),
        pending: pending.reduce((a, x) => a + x.amount, 0),
      },
    };
  });
