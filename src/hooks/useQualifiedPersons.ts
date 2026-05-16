import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProjects } from "./useProjects";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export type QualifiedPerson = {
  id: string;
  user_id: string;
  full_name: string;
  profession: string;
  registration_body: string;
  license_no: string;
  competency_areas: string[];
  cv_url: string | null;
  signature_url: string | null;
  bio: string | null;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
};

export type TechnicalReport = {
  id: string;
  project_id: string;
  title: string;
  effective_date: string | null;
  signature_date: string | null;
  report_type: string;
  status: string; // draft | review | signed | published
  lead_qp_id: string | null;
  version: number;
  summary: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  active_standards?: string[] | null;
  compliance_threshold?: number | null;
  compliance_score_cached?: number | null;
  compliance_evaluated_at?: string | null;
};

export type ReportSection = {
  id: string;
  report_id: string;
  project_id: string;
  section_no: number;
  title: string;
  content_md: string | null;
  status: string; // empty | drafting | ready | signed
  qp_id: string | null;
  signed_at: string | null;
  signature_hash: string | null;
  word_count: number | null;
  updated_at: string;
};

export function useQualifiedPersons() {
  const { active } = useProjects();
  const { user } = useAuth();
  const [qps, setQps] = useState<QualifiedPerson[]>([]);
  const [reports, setReports] = useState<TechnicalReport[]>([]);
  const [sections, setSections] = useState<ReportSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!active?.id) {
      setQps([]);
      setReports([]);
      setSections([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [
        { data: qpData, error: qpErr },
        { data: rData, error: rErr },
        { data: sData, error: sErr },
      ] = await Promise.all([
        supabase.from("qualified_persons").select("*").order("full_name"),
        supabase
          .from("technical_reports")
          .select("*")
          .eq("project_id", active.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("technical_report_sections")
          .select("*")
          .eq("project_id", active.id)
          .order("section_no"),
      ]);
      if (qpErr) throw qpErr;
      if (rErr) throw rErr;
      if (sErr) throw sErr;
      setQps((qpData ?? []) as QualifiedPerson[]);
      setReports((rData ?? []) as TechnicalReport[]);
      setSections((sData ?? []) as ReportSection[]);
      setError(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error cargando datos";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [active?.id]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const createQp = async (input: Partial<QualifiedPerson>) => {
    if (!user) throw new Error("No autenticado");
    const { data, error } = await supabase
      .from("qualified_persons")
      .insert({
        user_id: user.id,
        full_name: input.full_name ?? "",
        profession: input.profession ?? "",
        registration_body: input.registration_body ?? "",
        license_no: input.license_no ?? "",
        competency_areas: input.competency_areas ?? [],
        bio: input.bio ?? null,
        cv_url: input.cv_url ?? null,
        signature_url: input.signature_url ?? null,
      })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      throw error;
    }
    toast.success("QP registrado");
    await fetchAll();
    return data;
  };

  const updateQp = async (id: string, patch: Partial<QualifiedPerson>) => {
    const { error } = await supabase.from("qualified_persons").update(patch).eq("id", id);
    if (error) {
      toast.error(error.message);
      throw error;
    }
    toast.success("QP actualizado");
    await fetchAll();
  };

  const deleteQp = async (id: string) => {
    const { error } = await supabase.from("qualified_persons").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      throw error;
    }
    toast.success("QP eliminado");
    await fetchAll();
  };

  const createReport = async (input: {
    title: string;
    report_type?: string;
    lead_qp_id?: string | null;
    effective_date?: string | null;
    summary?: string | null;
  }) => {
    if (!user || !active?.id) throw new Error("Sin proyecto activo");
    const { data, error } = await supabase
      .from("technical_reports")
      .insert({
        project_id: active.id,
        title: input.title,
        report_type: input.report_type ?? "ni43101",
        lead_qp_id: input.lead_qp_id ?? null,
        effective_date: input.effective_date ?? null,
        summary: input.summary ?? null,
        status: "draft",
        created_by: user.id,
      })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      throw error;
    }
    toast.success("Reporte creado");
    await fetchAll();
    return data;
  };

  const updateReport = async (id: string, patch: Partial<TechnicalReport>) => {
    const { error } = await supabase
      .from("technical_reports")
      .update(patch as never)
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      throw error;
    }
    await fetchAll();
  };

  const deleteReport = async (id: string) => {
    const { error } = await supabase.from("technical_reports").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      throw error;
    }
    toast.success("Reporte eliminado");
    await fetchAll();
  };

  const upsertSection = async (input: {
    report_id: string;
    section_no: number;
    title: string;
    qp_id?: string | null;
    status?: string;
    content_md?: string;
  }) => {
    if (!active?.id) throw new Error("Sin proyecto activo");
    const { error } = await supabase.from("technical_report_sections").upsert(
      {
        report_id: input.report_id,
        project_id: active.id,
        section_no: input.section_no,
        title: input.title,
        qp_id: input.qp_id ?? null,
        status: input.status ?? "empty",
        content_md: input.content_md ?? "",
      },
      { onConflict: "report_id,section_no" },
    );
    if (error) {
      toast.error(error.message);
      throw error;
    }
    await fetchAll();
  };

  const assignQpToSection = async (sectionId: string, qpId: string | null) => {
    const { error } = await supabase
      .from("technical_report_sections")
      .update({ qp_id: qpId })
      .eq("id", sectionId);
    if (error) {
      toast.error(error.message);
      throw error;
    }
    toast.success("QP asignado a la sección");
    await fetchAll();
  };

  const signSection = async (sectionId: string) => {
    // Gate: bloquea firma si compliance < umbral configurado
    const sec = sections.find((s) => s.id === sectionId);
    if (sec) {
      const { data: rep } = await supabase
        .from("technical_reports")
        .select("compliance_score_cached, compliance_threshold")
        .eq("id", sec.report_id)
        .maybeSingle();
      if (rep) {
        const score = rep.compliance_score_cached ?? 0;
        const thr = rep.compliance_threshold ?? 95;
        if (score < thr) {
          toast.error(`Firma bloqueada: compliance ${score}% < umbral ${thr}%`);
          throw new Error("compliance_below_threshold");
        }
      }
    }
    const hash = `sig_${crypto.randomUUID().slice(0, 12)}_${Date.now().toString(36)}`;
    const { error } = await supabase
      .from("technical_report_sections")
      .update({ status: "signed", signed_at: new Date().toISOString(), signature_hash: hash })
      .eq("id", sectionId);
    if (error) {
      toast.error(error.message);
      throw error;
    }
    toast.success("Sección firmada");
    await fetchAll();
  };

  const revokeSignature = async (sectionId: string) => {
    const { error } = await supabase
      .from("technical_report_sections")
      .update({ status: "ready", signed_at: null, signature_hash: null })
      .eq("id", sectionId);
    if (error) {
      toast.error(error.message);
      throw error;
    }
    toast.success("Firma revocada");
    await fetchAll();
  };

  return {
    qps,
    reports,
    sections,
    loading,
    error,
    refresh: fetchAll,
    createQp,
    updateQp,
    deleteQp,
    createReport,
    updateReport,
    deleteReport,
    upsertSection,
    assignQpToSection,
    signSection,
    revokeSignature,
  };
}
