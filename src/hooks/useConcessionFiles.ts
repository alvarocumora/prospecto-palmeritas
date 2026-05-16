import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ConcessionFile = {
  id: string;
  concession_id: string;
  project_id: string;
  file_path: string;
  file_name: string;
  file_type: string;
  description: string | null;
  size_bytes: number | null;
  uploaded_by: string;
  uploaded_at: string;
};

export const CONCESSION_FILE_TYPE_LABELS: Record<string, string> = {
  titulo: "Título / Inscripción",
  patente: "Patente",
  plano: "Plano / Mensura",
  resolucion: "Resolución",
  contrato: "Contrato",
  otros: "Otros",
};

export function useConcessionFiles(concessionId: string | null) {
  const [data, setData] = useState<ConcessionFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!concessionId) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: rows, error: err } = await supabase
      .from("concession_files")
      .select("*")
      .eq("concession_id", concessionId)
      .order("uploaded_at", { ascending: false });
    if (err) {
      setError(err.message);
      setData([]);
    } else {
      setError(null);
      setData((rows ?? []) as ConcessionFile[]);
    }
    setLoading(false);
  }, [concessionId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const upload = useCallback(
    async (
      file: File,
      opts: {
        concessionId: string;
        projectId: string;
        userId: string;
        fileType: string;
        description?: string;
      },
    ) => {
      const id = crypto.randomUUID();
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${opts.projectId}/${opts.concessionId}/${id}-${safe}`;
      const up = await supabase.storage
        .from("concession-files")
        .upload(path, file, { upsert: false });
      if (up.error) throw up.error;
      const { error: insErr } = await supabase.from("concession_files").insert({
        concession_id: opts.concessionId,
        project_id: opts.projectId,
        file_path: path,
        file_name: file.name,
        file_type: opts.fileType,
        description: opts.description ?? null,
        size_bytes: file.size,
        uploaded_by: opts.userId,
      });
      if (insErr) throw insErr;
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (file: { id: string; file_path: string }) => {
      await supabase.storage.from("concession-files").remove([file.file_path]);
      const { error: dErr } = await supabase.from("concession_files").delete().eq("id", file.id);
      if (dErr) throw dErr;
      await refresh();
    },
    [refresh],
  );

  const getDownloadUrl = useCallback(async (path: string) => {
    const { data: signed } = await supabase.storage
      .from("concession-files")
      .createSignedUrl(path, 60 * 10);
    return signed?.signedUrl ?? null;
  }, []);

  return { data, loading, error, refresh, upload, remove, getDownloadUrl };
}
