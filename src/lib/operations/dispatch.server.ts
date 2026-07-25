import { sendInternalEmail } from "@/lib/email/send-internal.server";
import { publicUrl } from "@/lib/publicUrl";

interface OpDispatch {
  role: "buyer" | "seller";
  email: string;
  name?: string | null;
  token: string;
  operationId: string;
  operationCode: string;
  operationName: string;
  commodity: string;
  incoterm?: string | null;
  quantityMonthly?: number | null;
  quantityTotal?: number | null;
  unit?: string | null;
  originCountry?: string | null;
  destinationCountry?: string | null;
  expiresAt?: string | null;
  invitedByName?: string | null;
}

function fmtQty(monthly?: number | null, total?: number | null, unit?: string | null) {
  const u = unit || "MT";
  if (monthly && monthly > 0) return `${monthly.toLocaleString("es-CL")} ${u}/mes`;
  if (total && total > 0) return `${total.toLocaleString("es-CL")} ${u} total`;
  return "—";
}

export async function sendPortalInvitationEmail(args: OpDispatch) {
  const portal = publicUrl(`/portal/${args.role}/${encodeURIComponent(args.token)}`);
  return sendInternalEmail({
    templateName: "operation-portal-invitation",
    recipientEmail: args.email,
    idempotencyKey: `op-invite:${args.operationId}:${args.role}:${args.token.slice(0, 12)}`,
    templateData: {
      fullName: args.name ?? undefined,
      role: args.role,
      operationCode: args.operationCode,
      operationName: args.operationName,
      commodity: args.commodity,
      incoterm: args.incoterm ?? undefined,
      quantityLabel: fmtQty(args.quantityMonthly, args.quantityTotal, args.unit),
      originCountry: args.originCountry ?? undefined,
      destinationCountry: args.destinationCountry ?? undefined,
      portalUrl: portal,
      expiresAt: args.expiresAt ?? undefined,
      invitedByName: args.invitedByName ?? undefined,
    },
  });
}
