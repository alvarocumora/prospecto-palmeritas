// Mapea atributos reales de un elemento a filas legibles para la ficha.
// Solo se muestran campos presentes; nunca se rellenan valores faltantes.

export type FeatureFact = { label: string; value: string };

const LABELS: Record<string, string> = {
  // Catastro SERNAGEOMIN
  NUMERO_ROL: "Rol",
  rol: "Rol",
  TITULAR_NOMBRE: "Titular",
  titular: "Titular",
  HECTAREAS: "Hectáreas",
  hectareas: "Hectáreas",
  SITUACION_CONCESION: "Situación",
  situacion: "Situación",
  TIPO_CONCESION: "Tipo",
  tipo: "Tipo",
  FECHA_VENCIMIENTO: "Vencimiento",
  COMUNA: "Comuna",
  // Estructuras
  rumbo: "Rumbo",
  strike: "Rumbo",
  manteo: "Manteo",
  dip: "Manteo",
  dip_dir: "Dirección de manteo",
  halo_emit_300m: "Halo EMIT (300 m)",
  delta_angular_deg: "Δ angular (°)",
  distancia_m: "Distancia (m)",
  veta: "Veta",
  // Carta geológica
  codigo: "Código",
  edad: "Edad",
  litologia: "Litología",
  // Espectral / muestreo
  mineral: "Mineral",
  intensidad: "Intensidad",
  score: "Intensidad",
  sensor: "Sensor",
  fecha: "Fecha",
  date: "Fecha",
  lab: "Laboratorio",
  cu_total_pct: "Cu total (%)",
  au_gpt: "Au (g/t)",
  report_id: "Informe",
  fuente: "Fuente",
};

const SKIP = new Set(["nombre", "name", "NOMBRE", "procedencia", "advertencia", "OBJECTID", "FID"]);

export function featureFacts(
  properties: Record<string, unknown> | null | undefined,
): FeatureFact[] {
  if (!properties) return [];
  const facts: FeatureFact[] = [];
  const seen = new Set<string>();
  for (const [key, raw] of Object.entries(properties)) {
    if (SKIP.has(key) || raw == null || raw === "" || typeof raw === "object") continue;
    const label = LABELS[key];
    if (!label || seen.has(label)) continue;
    seen.add(label);
    let value = String(raw);
    if (key === "FECHA_VENCIMIENTO" && typeof raw === "number")
      value = new Date(raw).toISOString().slice(0, 10);
    else if (typeof raw === "number")
      value = raw.toLocaleString("es-CL", { maximumFractionDigits: 3 });
    facts.push({ label, value });
  }
  return facts;
}

const PROVENANCE: Record<string, string> = {
  official: "OFICIAL",
  measured: "MEDIDO",
  modelled: "MODELADO",
  modeled: "MODELADO",
  interpreted: "INTERPRETADO",
  declared: "DECLARADO",
};

export function provenanceLabel(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  return PROVENANCE[value.toLowerCase()] ?? value;
}
