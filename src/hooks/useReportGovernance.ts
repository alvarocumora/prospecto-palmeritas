import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProjects } from "@/hooks/useProjects";
import { useQualifiedPersons } from "@/hooks/useQualifiedPersons";
import {
  evaluateDeliveryGate,
  parseReportReadiness,
  type GovernanceVersion,
  type ReportReadiness,
} from "@/lib/reports/governance";

export function useReportGovernance() {
  const { active } = useProjects();
  const registry = useQualifiedPersons();
  const [readiness, setReadiness] = useState<ReportReadiness | null>(null);
  const [versions, setVersions] = useState<GovernanceVersion[]>([]);
  const [loadingExtra, setLoadingExtra] = useState(false);
  const [extraError, setExtraError] = useState<string | null>(null);

  const latestReport = registry.reports[0] ?? null;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!active?.id) {
        setReadiness(null);
        setVersions([]);
        setExtraError(null);
        return;
      }

      setLoadingExtra(true);
      try {
        const readinessResult = await supabase.rpc("report_readiness", {
          p_project_id: active.id,
        });
        if (readinessResult.error) throw readinessResult.error;

        let nextVersions: GovernanceVersion[] = [];
        if (latestReport?.id) {
          const versionResult = await supabase
            .from("technical_report_versions")
            .select("version_no,hash_sha256,generated_at,watermark")
            .eq("project_id", active.id)
            .eq("report_id", latestReport.id)
            .order("version_no", { ascending: false });

          if (versionResult.error) throw versionResult.error;
          nextVersions = (versionResult.data ?? []).map((row) => ({
            versionNo: row.version_no,
            hashSha256: row.hash_sha256,
            generatedAt: row.generated_at,
            watermark: row.watermark,
          }));
        }

        if (!cancelled) {
          setReadiness(parseReportReadiness(readinessResult.data));
          setVersions(nextVersions);
          setExtraError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setReadiness(null);
          setVersions([]);
          setExtraError(error instanceof Error ? error.message : "Error cargando readiness");
        }
      } finally {
        if (!cancelled) setLoadingExtra(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [active?.id, latestReport?.id]);

  const reviewer = useMemo(
    () =>
      latestReport?.lead_qp_id
        ? (registry.qps.find((qp) => qp.id === latestReport.lead_qp_id) ?? null)
        : null,
    [latestReport?.lead_qp_id, registry.qps],
  );

  const reportSections = useMemo(
    () =>
      latestReport
        ? registry.sections.filter((section) => section.report_id === latestReport.id)
        : [],
    [latestReport, registry.sections],
  );

  const gate = useMemo(
    () =>
      evaluateDeliveryGate({
        readiness,
        report: latestReport
          ? {
              id: latestReport.id,
              version: latestReport.version,
              status: latestReport.status,
              leadQpId: latestReport.lead_qp_id,
              activeStandards: latestReport.active_standards ?? [],
              complianceScore: latestReport.compliance_score_cached ?? null,
              complianceThreshold: latestReport.compliance_threshold ?? 95,
            }
          : null,
        reviewer: reviewer
          ? {
              id: reviewer.id,
              fullName: reviewer.full_name,
              isVerified: reviewer.is_verified,
            }
          : null,
        sections: reportSections.map((section) => ({
          status: section.status,
          requiresQpReview: section.requires_qp_review,
          qpId: section.qp_id,
          signedAt: section.signed_at,
        })),
        versions,
      }),
    [latestReport, readiness, reportSections, reviewer, versions],
  );

  return {
    active,
    readiness,
    latestReport,
    reviewer,
    reportSections,
    versions,
    gate,
    loading: registry.loading || loadingExtra,
    error: registry.error ?? extraError,
    refresh: registry.refresh,
  };
}
