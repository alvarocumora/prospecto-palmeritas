// MOTOR DE DUE DILIGENCE + GEOSCORE (Fase C).
//
// Calcula, por proyecto, un puntaje de madurez técnica y transaccional a
// partir de datos reales existentes en la base (no mock): tenencia legal,
// evidencia geológica, datos técnicos, data room, valorización y comercial.
//
// Todas las lecturas pasan por el cliente autenticado (RLS del usuario).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DDItem = {
  key: string;
  label: string;
  value: string;
  ok: boolean;
  weight: number;
  hint: string;
};

export type DDDimension = {
  key: string;
  label: string;
  score: number; // 0-100
  items: DDItem[];
};

export type ProjectDueDiligence = {
  projectId: string;
  geoScore: number; // 0-100 ponderado
  grade: "A" | "B" | "C" | "D";
  dimensions: DDDimension[];
  gaps: string[];
};

const DIMENSION_WEIGHT: Record<string, number> = {
  tenencia: 0.22,
  geologia: 0.26,
  tecnico: 0.2,
  dataroom: 0.14,
  valorizacion: 0.1,
  comercial: 0.08,
};

function dim(key: string, label: string, items: DDItem[]): DDDimension {
  const total = items.reduce((a, i) => a + i.weight, 0) || 1;
  const got = items.reduce((a, i) => a + (i.ok ? i.weight : 0), 0);
  return { key, label, score: Math.round((got / total) * 100), items };
}

const item = (
  key: string,
  label: string,
  ok: boolean,
  value: string,
  hint: string,
  weight = 1,
): DDItem => ({ key, label, ok, value, hint, weight });

export const getProjectDueDiligence = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { projectId: string }) => {
    if (!data?.projectId || typeof data.projectId !== "string") {
      throw new Error("projectId requerido");
    }
    return { projectId: data.projectId };
  })
  .handler(async ({ data, context }): Promise<ProjectDueDiligence> => {
    const sb = context.supabase;
    const pid = data.projectId;

    const count = async (table: string) => {
      let q = sb
        .from(table as never)
        .select("id", { count: "exact", head: true })
        .eq("project_id", pid);
      const { count: c } = await q;
      return c ?? 0;
    };

    const [
      { data: project },
      concessions,
      mensuras,
      pedimentos,
      overlaps,
      holes,
      geochem,
      geophys,
      targets,
      blockModels,
      permits,
      { data: brief },
      { data: rooms },
      { data: scenarios },
      { data: listings },
    ] = await Promise.all([
      sb
        .from("projects")
        .select("id,name,center_lat,center_lng,commodity")
        .eq("id", pid)
        .maybeSingle(),
      count("mining_concessions"),
      count("mensuras"),
      count("pedimentos"),
      count("concession_overlaps"),
      count("drill_holes"),
      count("geochem_analyses"),
      count("geophysics_surveys"),
      count("exploration_targets"),
      count("block_models"),
      count("hse_permits"),
      sb.from("project_technical_brief").select("id").eq("project_id", pid).maybeSingle(),
      sb.from("data_rooms").select("id,nda_required").eq("project_id", pid),
      sb
        .from("economic_scenarios")
        .select("npv_usd,irr_pct,updated_at")
        .eq("project_id", pid)
        .order("updated_at", { ascending: false })
        .limit(1),
      sb.from("property_listings").select("id,is_published,asking_price_usd").eq("project_id", pid),
    ]);

    const room = rooms?.[0] ?? null;
    let roomFiles = 0;
    if (room) {
      const { count: c } = await sb
        .from("data_room_files")
        .select("id", { count: "exact", head: true })
        .eq("data_room_id", room.id);
      roomFiles = c ?? 0;
    }
    const scenario = scenarios?.[0] ?? null;
    const listing = listings?.[0] ?? null;

    const dimensions: DDDimension[] = [
      dim("tenencia", "Tenencia y legal", [
        item(
          "conc",
          "Concesiones asociadas",
          concessions > 0,
          String(concessions),
          "Vincula las concesiones del proyecto desde Catastro.",
          2,
        ),
        item(
          "mensura",
          "Mensuras constituidas",
          mensuras > 0,
          String(mensuras),
          "Sin mensura el título no es de explotación.",
          2,
        ),
        item(
          "ped",
          "Pedimentos vigentes",
          pedimentos > 0,
          String(pedimentos),
          "Registra pedimentos en trámite.",
        ),
        item(
          "overlap",
          "Sin superposiciones críticas",
          overlaps === 0,
          overlaps === 0 ? "limpio" : `${overlaps} detectadas`,
          "Resuelve o documenta las superposiciones detectadas.",
          2,
        ),
        item(
          "permisos",
          "Permisos HSE",
          permits > 0,
          String(permits),
          "Carga permisos ambientales/sectoriales aplicables.",
        ),
      ]),
      dim("geologia", "Evidencia geológica", [
        item(
          "holes",
          "Sondajes registrados",
          holes > 0,
          String(holes),
          "Carga la base de sondajes (collar/survey/assay).",
          3,
        ),
        item(
          "geoq",
          "Muestreo geoquímico",
          geochem > 0,
          String(geochem),
          "Sube análisis de geoquímica de superficie.",
          2,
        ),
        item(
          "geof",
          "Campañas geofísicas",
          geophys > 0,
          String(geophys),
          "Agrega magnetometría / IP / gravimetría.",
          2,
        ),
        item(
          "targets",
          "Targets definidos",
          targets > 0,
          String(targets),
          "Define targets de exploración priorizados.",
          2,
        ),
      ]),
      dim("tecnico", "Modelo y datos técnicos", [
        item(
          "bm",
          "Modelo de bloques",
          blockModels > 0,
          String(blockModels),
          "Sin modelo no hay estimación de recursos.",
          3,
        ),
        item(
          "brief",
          "Brief técnico",
          !!brief,
          brief ? "cargado" : "—",
          "Completa el brief técnico del proyecto.",
          2,
        ),
        item(
          "geo",
          "Centroide oficial",
          project?.center_lat != null && project?.center_lng != null,
          project?.center_lat != null ? "definido" : "—",
          "Define la ubicación oficial usada por mapa, PDF y valorización.",
        ),
      ]),
      dim("dataroom", "Data room", [
        item(
          "room",
          "Data room creado",
          !!room,
          room ? "sí" : "no",
          "Crea el data room canónico (carpetas 00–10).",
          2,
        ),
        item(
          "docs",
          "Documentos base (≥8)",
          roomFiles >= 8,
          String(roomFiles),
          "Carga legal, geología, títulos y ambiental.",
          3,
        ),
        item(
          "nda",
          "NDA requerido",
          !!room?.nda_required,
          room?.nda_required ? "sí" : "no",
          "Activa NDA para material confidencial.",
        ),
      ]),
      dim("valorizacion", "Valorización", [
        item(
          "npv",
          "NPV calculado",
          scenario?.npv_usd != null,
          scenario?.npv_usd != null ? "sí" : "—",
          "Corre un escenario económico (DCF).",
          2,
        ),
        item(
          "irr",
          "TIR estimada",
          scenario?.irr_pct != null,
          scenario?.irr_pct != null ? `${Number(scenario.irr_pct).toFixed(1)}%` : "—",
          "Completa el escenario para obtener TIR.",
        ),
      ]),
      dim("comercial", "Comercial", [
        item(
          "listing",
          "Ficha comercial",
          !!listing,
          listing ? "sí" : "no",
          "Crea la ficha en Vitrina.",
          2,
        ),
        item(
          "pub",
          "Publicada",
          !!listing?.is_published,
          listing?.is_published ? "sí" : "no",
          "Publica la ficha para exponerla a inversionistas.",
        ),
        item(
          "price",
          "Precio definido",
          listing?.asking_price_usd != null,
          listing?.asking_price_usd != null ? "sí" : "—",
          "Sin precio el deal no avanza a oferta.",
        ),
      ]),
    ];

    const geoScore = Math.round(
      dimensions.reduce((a, d) => a + d.score * (DIMENSION_WEIGHT[d.key] ?? 0), 0),
    );
    const grade = geoScore >= 80 ? "A" : geoScore >= 60 ? "B" : geoScore >= 40 ? "C" : "D";

    const gaps = dimensions
      .flatMap((d) => d.items.filter((i) => !i.ok).map((i) => `${d.label}: ${i.hint}`))
      .slice(0, 6);

    return { projectId: pid, geoScore, grade, dimensions, gaps };
  });
