// EXPEDIENTE MAESTRO DEL PROYECTO (Fase B).
//
// `projects` es el registro maestro; `property_listings` es sólo la capa
// comercial que lo referencia. Esta función consolida en una sola lectura:
// identidad del proyecto, publicación comercial, data room, pipeline de deals
// y valorización, más un "readiness" de transacción con desglose visible.
//
// Todas las lecturas pasan por el cliente autenticado (RLS del usuario).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ReadinessCheck = {
  key: string;
  label: string;
  ok: boolean;
  hint: string;
};

export type ProjectMasterRecord = {
  projectId: string;
  name: string;
  code: string;
  commodity: string | null;
  region: string | null;
  country: string | null;
  status: string;
  hasCentroid: boolean;
  listing: {
    id: string;
    published: boolean;
    askingPriceUsd: number | null;
    areaHa: number | null;
    stage: string;
    views: number;
  } | null;
  dataRoom: { id: string; files: number; ndaRequired: boolean } | null;
  deals: { total: number; active: number; byStage: Record<string, number> };
  npvUsd: number | null;
  readiness: { score: number; checks: ReadinessCheck[] };
};

const TERMINAL = new Set(["cierre", "retirado", "rechazado", "expirado", "descartado"]);

export const getProjectMasterRecords = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProjectMasterRecord[]> => {
    const sb = context.supabase;

    const { data: projects } = await sb
      .from("projects")
      .select("id,name,code,commodity,region,country,status,center_lat,center_lng")
      .order("name");
    if (!projects?.length) return [];
    const ids = projects.map((p) => p.id);

    const [{ data: listings }, { data: rooms }, { data: scenarios }] = await Promise.all([
      sb
        .from("property_listings")
        .select("id,project_id,is_published,asking_price_usd,area_ha,stage,views_count")
        .in("project_id", ids),
      sb.from("data_rooms").select("id,project_id,nda_required").in("project_id", ids),
      sb
        .from("economic_scenarios")
        .select("project_id,npv_usd,updated_at")
        .in("project_id", ids)
        .order("updated_at", { ascending: false }),
    ]);

    const roomIds = (rooms ?? []).map((r) => r.id);
    const listingIds = (listings ?? []).map((l) => l.id);

    const [{ data: files }, { data: inquiries }] = await Promise.all([
      roomIds.length
        ? sb.from("data_room_files").select("id,data_room_id").in("data_room_id", roomIds)
        : Promise.resolve({ data: [] as { id: string; data_room_id: string }[] }),
      listingIds.length
        ? sb
            .from("property_deal_inquiries")
            .select("id,listing_id,stage")
            .in("listing_id", listingIds)
        : Promise.resolve({ data: [] as { id: string; listing_id: string; stage: string }[] }),
    ]);

    const filesByRoom = new Map<string, number>();
    for (const f of files ?? []) {
      filesByRoom.set(f.data_room_id, (filesByRoom.get(f.data_room_id) ?? 0) + 1);
    }

    return projects.map((p) => {
      const listing = (listings ?? []).find((l) => l.project_id === p.id) ?? null;
      const room = (rooms ?? []).find((r) => r.project_id === p.id) ?? null;
      const npv = (scenarios ?? []).find((s) => s.project_id === p.id)?.npv_usd ?? null;
      const roomFiles = room ? (filesByRoom.get(room.id) ?? 0) : 0;

      const projectInquiries = listing
        ? (inquiries ?? []).filter((i) => i.listing_id === listing.id)
        : [];
      const byStage: Record<string, number> = {};
      for (const i of projectInquiries) {
        const s = i.stage ?? "interesado";
        byStage[s] = (byStage[s] ?? 0) + 1;
      }

      const checks: ReadinessCheck[] = [
        {
          key: "geo",
          label: "Ubicación oficial",
          ok: p.center_lat != null && p.center_lng != null,
          hint: "Define el centroide del proyecto para mapa, PDF y valorización.",
        },
        {
          key: "listing",
          label: "Ficha comercial",
          ok: !!listing,
          hint: "Crea la ficha en Vitrina para exponer el proyecto a inversionistas.",
        },
        {
          key: "published",
          label: "Publicada",
          ok: !!listing?.is_published,
          hint: "La ficha existe pero no está publicada.",
        },
        {
          key: "price",
          label: "Precio o modalidad",
          ok: listing?.asking_price_usd != null,
          hint: "Sin precio pedido el deal no puede pasar a oferta.",
        },
        {
          key: "room",
          label: "Data room",
          ok: !!room,
          hint: "Crea el data room canónico (carpetas 00–10).",
        },
        {
          key: "docs",
          label: "Documentos cargados",
          ok: roomFiles >= 5,
          hint: "Carga al menos 5 documentos base (legal, geología, títulos).",
        },
        {
          key: "valuation",
          label: "Valorización",
          ok: npv != null,
          hint: "Corre un escenario económico para tener NPV comparable.",
        },
      ];
      const score = Math.round((checks.filter((c) => c.ok).length / checks.length) * 100);

      return {
        projectId: p.id,
        name: p.name,
        code: p.code,
        commodity: p.commodity,
        region: p.region,
        country: p.country,
        status: p.status,
        hasCentroid: p.center_lat != null && p.center_lng != null,
        listing: listing
          ? {
              id: listing.id,
              published: !!listing.is_published,
              askingPriceUsd:
                listing.asking_price_usd != null ? Number(listing.asking_price_usd) : null,
              areaHa: listing.area_ha != null ? Number(listing.area_ha) : null,
              stage: listing.stage,
              views: Number(listing.views_count ?? 0),
            }
          : null,
        dataRoom: room ? { id: room.id, files: roomFiles, ndaRequired: !!room.nda_required } : null,
        deals: {
          total: projectInquiries.length,
          active: projectInquiries.filter((i) => !TERMINAL.has(i.stage ?? "interesado")).length,
          byStage,
        },
        npvUsd: npv != null ? Number(npv) : null,
        readiness: { score, checks },
      };
    });
  });
