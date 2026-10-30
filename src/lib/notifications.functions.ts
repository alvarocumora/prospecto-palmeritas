import { createServerFn } from "@tanstack/react-start";
import { requireAnyModuleRole } from "@/lib/access/roleMiddleware";
import { z } from "zod";
import { publicUrl } from "@/lib/publicUrl";
import {
  isActiveProjectInvitation,
  isSignedTechnicalReport,
  mayNotifyProject,
  resolveProjectNotificationRecipients,
} from "@/lib/access/projectNotifications";

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
 * Requires owner/admin authorization and an active, unexpired invitation.
 */
export const sendProjectInvitationEmail = createServerFn({ method: "POST" })
  .middleware([requireAnyModuleRole])
  .inputValidator((d) => InviteSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: inv, error } = await supabase
      .from("project_invitations")
      .select(
        "id, email, role, token, status, expires_at, project_id, projects:project_id(name, code, organization_id, organizations:organization_id(name))",
      )
      .eq("id", data.invitationId)
      .maybeSingle();
    if (error || !inv) throw new Error("Invitación no encontrada");

    // El acceso de lectura (viewer, geologist, etc.) no permite reenviar tokens.
    const { data: member, error: memberError } = await supabase
      .from("project_members")
      .select("role")
      .eq("project_id", inv.project_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (memberError || !mayNotifyProject(member?.role, context.access.isSuperAdmin)) {
      throw new Response("No autorizado a enviar invitaciones de este proyecto.", {
        status: 403,
      });
    }
    if (!isActiveProjectInvitation(inv.status, inv.expires_at)) {
      throw new Response("Esta invitación no está pendiente o ha expirado.", { status: 409 });
    }

    const { data: inviterProfile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", userId)
      .maybeSingle();

    const { sendInternalEmail } = await import("@/lib/email/send-internal.server");
    const project =
      (
        inv as unknown as {
          projects?: { name?: string; code?: string; organizations?: { name?: string } } | null;
        }
      ).projects ?? null;

    const templateName =
      data.audience === "investor" ? "project-invitation-investor" : "project-invitation-internal";

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
              shareUrl: publicUrl(`/auth/invitation?token=${inv.token}`),
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
  .middleware([requireAnyModuleRole])
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

    const { data: member, error: memberError } = await supabase
      .from("project_members")
      .select("role")
      .eq("project_id", report.project_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (memberError || !mayNotifyProject(member?.role, context.access.isSuperAdmin)) {
      throw new Response("No autorizado a comunicar reportes de este proyecto.", {
        status: 403,
      });
    }
    if (!isSignedTechnicalReport(report.status, report.signature_date)) {
      throw new Response("El reporte aún no está firmado o no tiene fecha de firma.", {
        status: 409,
      });
    }

    let leadQp = "—";
    if (report.lead_qp_id) {
      const { data: qp } = await supabase
        .from("qualified_persons")
        .select("full_name, profession, registration_body")
        .eq("id", report.lead_qp_id)
        .maybeSingle();
      if (qp) leadQp = `${qp.full_name} · ${qp.registration_body ?? qp.profession ?? ""}`.trim();
    }

    // El caller no puede añadir correos externos a un reporte confidencial.
    // Tanto la lista automática como la personalizada se comparan con el roster.
    const { data: members, error: rosterError } = await supabase
      .from("project_members")
      .select("user_id")
      .eq("project_id", report.project_id);
    if (rosterError || !members?.length) {
      throw new Error("No se pudo verificar la nómina del proyecto.");
    }
    const userIds = members.map((member) => member.user_id);
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("email")
      .in("user_id", userIds);
    if (profileError) {
      throw new Error("No se pudo verificar el correo de los miembros del proyecto.");
    }
    const projectEmails = (profiles ?? [])
      .map((profile) => profile.email)
      .filter((email): email is string => typeof email === "string" && email.length > 0);
    const recipients = resolveProjectNotificationRecipients(data.recipientEmails, projectEmails);

    const project = (report as unknown as { projects?: { name?: string } | null }).projects ?? null;
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
