/** A catalog scene proves an acquisition exists, not that mineral processing ran. */
export function satelliteEvidence(metadata: unknown, notes?: string | null): string {
  const meta =
    metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>) : {};
  if (
    meta.seeded === true ||
    meta.provenance === "synthetic" ||
    meta.provenance === "conceptual" ||
    /sint[eé]tic|synthetic|demo/i.test(notes ?? "")
  )
    return "CONCEPTUAL · DEMOSTRACIÓN";
  return "DERIVADO · VALIDACIÓN PENDIENTE";
}

export function validSatelliteBbox(
  bbox: readonly number[] | null | undefined,
): bbox is [number, number, number, number] {
  return (
    !!bbox &&
    bbox.length === 4 &&
    bbox.every(Number.isFinite) &&
    bbox[0] >= -180 &&
    bbox[2] <= 180 &&
    bbox[1] >= -90 &&
    bbox[3] <= 90 &&
    bbox[0] < bbox[2] &&
    bbox[1] < bbox[3]
  );
}
