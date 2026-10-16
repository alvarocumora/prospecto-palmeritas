/** Proyectos habilitados para tickets de inversión y su código de SPV. */
export const INVESTABLE_PROJECTS = [
  { slug: "cholqui", spvCode: "CHOLQUI", name: "Proyecto Cholqui" },
  { slug: "losverdes", spvCode: "LV-TIL-001", name: "Distrito Cuprífero Los Verdes – Tilama" },
] as const;

export function spvCodeForSlug(slug: string): string | null {
  return INVESTABLE_PROJECTS.find((p) => p.slug === slug)?.spvCode ?? null;
}

export const TICKET_STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  pending_kyc: "En revisión KYC",
  contract_pending: "Contrato listo para firmar",
  signed: "Firmado",
  payment_pending: "Pago pendiente",
  settled: "Liquidado",
  cancelled: "Cancelado",
};

export const TICKET_STEPS = [
  "pending_kyc",
  "contract_pending",
  "payment_pending",
  "settled",
] as const;

export function fmtMoney(n: number | null | undefined, currency: string): string {
  if (n == null) return "—";
  return `${currency} ${Number(n).toLocaleString("es-CL", { maximumFractionDigits: 2 })}`;
}

/** Texto canónico del contrato; su SHA-256 queda registrado al firmar. */
export function contractText(t: {
  ticket_code: string;
  amount: number;
  currency: string;
  shares_allocated: number | null;
  share_price: number | null;
  legalName: string;
  projectName: string;
}): string {
  return [
    `CONTRATO DE SUSCRIPCIÓN DE ACCIONES · ${t.ticket_code}`,
    `Sociedad: ${t.legalName} · Proyecto: ${t.projectName}`,
    `Monto: ${fmtMoney(t.amount, t.currency)} · Precio por acción: ${fmtMoney(t.share_price, t.currency)} · Acciones: ${t.shares_allocated ?? "—"}`,
    "El inversionista declara conocer que el proyecto se encuentra en etapa de exploración, que no existen recursos ni reservas certificados bajo NI 43-101 ni JORC, y que la información técnica combina hechos medidos, datos declarados por terceros e interpretaciones. No se garantiza rentabilidad. Los fondos se depositan en la cuenta indicada por la sociedad y la emisión de acciones queda sujeta a la verificación del pago por GeoCapitals.",
  ].join("\n");
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
