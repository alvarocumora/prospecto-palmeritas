// Contexto de documentos para el panel privado de operación (sin cuenta).
// Reutiliza los constructores oficiales de PDF de Geocapitals.

import type { TradePackContext } from "@/lib/documents/officialPdfs.server";
import type { PortalSession } from "@/lib/portalSession.server";

const COLS = `
  id, reference, commodity, form, quantity_t, incoterm, payment_instrument,
  unit_price_usd, total_value_usd, notes, destination,
  counterparty_role, counterparty_name, counterparty_company, counterparty_email
`;

export async function loadPortalDocCtx(s: PortalSession): Promise<TradePackContext> {
  const { data, error } = await s.sb
    .from("commodity_trades")
    .select(COLS)
    .eq("id", s.tradeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Operación no encontrada");
  const t = data as Record<string, unknown>;

  const counterparty = {
    role: s.role === "buyer" ? "Buyer" : "Seller",
    name: (t.counterparty_name as string) ?? "Contraparte",
    company: (t.counterparty_company as string) ?? undefined,
    email: (t.counterparty_email as string) ?? undefined,
  };
  const geocapitals = {
    role: s.role === "buyer" ? "Seller" : "Buyer",
    name: "Geocapitals SpA",
    company: "Geocapitals SpA",
    email: "info@geocapitals.com",
  };

  // Si el titular del enlace es el comprador, Geocapitals actúa como vendedor
  // intermediario y viceversa.
  const buyer = s.role === "buyer" ? counterparty : geocapitals;
  const seller = s.role === "buyer" ? geocapitals : counterparty;

  return {
    reference: (t.reference as string) ?? "OPERACION",
    commodity: (t.commodity as string) ?? "Commodity",
    form: (t.form as string) ?? null,
    quantityMt: (t.quantity_t as number) ?? null,
    incoterm: (t.incoterm as string) ?? null,
    paymentInstrument: (t.payment_instrument as string) ?? null,
    unitPriceUsd: (t.unit_price_usd as number) ?? null,
    totalUsd: (t.total_value_usd as number) ?? null,
    destination: (t.destination as string) ?? null,
    notes: (t.notes as string) ?? null,
    buyer,
    seller,
  };
}
