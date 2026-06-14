import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const InviteSchema = z.object({
  invitationId: z.string().uuid(),
  audience: z.enum(["internal", "investor"]).default("internal"),
});

const ReportSchema = z.object({
  reportId: z.string().uuid(),
  audience: z.enum(["internal", "investor"]).default("internal"),
  recipientEmails: z.array(z.string().email()).min(1).max(50).optional(),
});

/**
 * Manually send a project invitation email for an existing project_invitations row.
 * Requires the caller to be a member of the project.
 */
export const sendProjectInvitationEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => InviteSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: inv, error } = await supabase
      .from("project_invitations")
      .select(
        "id, email, role, token, expires_at, project_id, projects:project_id(name, code, organization_id, organizations:organization_id(name))",
      )
      .eq("id", data.invitationId)
      .maybeSingle();
    if (error || !inv) throw new Error("Invitación no encontrada");

    // authorization: invited_by or project member
    const { data: member } = await supabase
      .from("project_members")
      .select("user_id")
      .eq("project_id", inv.project_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!member) throw new Error("No tienes acceso a este proyecto");

    const { data: inviterProfile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", userId)
      .maybeSingle();

    const { sendInternalEmail } = await import("@/lib/email/send-internal.server");
    const project = (inv as any).projects as
      | { name?: string; code?: string; organizations?: { name?: string } }
      | null;

    const templateName =
      data.audience === "investor"
        ? "project-invitation-investor"
        : "project-invitation-internal";

    const res = await sendInternalEmail({
      templateName,
      recipientEmail: inv.email,
      idempotencyKey: `invitation:${inv.id}:${data.audience}`,
      templateData:
        data.audience === "investor"
          ? {
              inviterName: inviterProfile?.display_name,
              projectName: project?.name,
              organization: project?.organizations?.name,
              shareUrl: `https://geocapitals.com/auth/invitation?token=${inv.token}`,
              expiresAt: inv.expires_at,
            }
          : {
              inviterName: inviterProfile?.display_name,
              projectName: project?.name,
              projectCode: project?.code,
              role: inv.role,
              token: inv.token,
              expiresAt: inv.expires_at,
            },
    });
    return res;
  });

/**
 * Notify the project team / investors that a technical report changed to signed.
 */
export const sendReportSignedEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => ReportSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: report, error } = await supabase
      .from("technical_reports")
      .select(
        "id, project_id, title, report_type, status, signature_date, compliance_score_cached, lead_qp_id, projects:project_id(name)",
      )
      .eq("id", data.reportId)
      .maybeSingle();
    if (error || !report) throw new Error("Reporte no encontrado");

    const { data: member } = await supabase
      .from("project_members")
      .select("user_id")
      .eq("project_id", report.project_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!member) throw new Error("No tienes acceso a este proyecto");

    let leadQp = "—";
    if (report.lead_qp_id) {
      const { data: qp } = await supabase
        .from("qualified_persons")
        .select("full_name, profession, registration_body")
        .eq("id", report.lead_qp_id)
        .maybeSingle();
      if (qp) leadQp = `${qp.full_name} · ${qp.registration_body ?? qp.profession ?? ""}`.trim();
    }

    let recipients = data.recipientEmails ?? [];
    if (recipients.length === 0) {
      // default: all project members
      const { data: members } = await supabase
        .from("project_members")
        .select("user_id")
        .eq("project_id", report.project_id);
      const userIds = (members ?? []).map((m) => m.user_id);
      const { data: profs } = await supabase
        .from("profiles")
        .select("email")
        .in("user_id", userIds);
      recipients = (profs ?? []).map((p) => p.email).filter(Boolean) as string[];
    }

    const project = (report as any).projects as { name?: string } | null;
    const templateName =
      data.audience === "investor" ? "report-signed-investor" : "report-signed-internal";

    const { sendInternalEmail } = await import("@/lib/email/send-internal.server");
    const results = [];
    for (const r of recipients) {
      results.push(
        await sendInternalEmail({
          templateName,
          recipientEmail: r,
          idempotencyKey: `report-signed:${report.id}:${data.audience}:${r}`,
          templateData: {
            projectName: project?.name,
            reportTitle: report.title,
            reportType: report.report_type,
            status: report.status,
            leadQp,
            complianceScore: report.compliance_score_cached,
            signatureDate: report.signature_date,
            reportId: report.id,
          },
        }),
      );
    }
    const queued = results.filter((r) => r.ok && "queued" in r && r.queued).length;
    return { queued, attempted: results.length };
  });
