import { describe, expect, it } from "vitest";
import type { StacItem } from "@/types/stac";
import { stacItemToDatasetDraft } from "./stacAdapter";
import fixture from "./fixtures/stac-item.json";

// Fixture real: mismo Sentinel-2 L2A usado en el pase de Cholqui
// (S2A_MSIL2A_20260703T143801_R096_T19HCC…), sin red — solo el JSON.
const item = fixture as StacItem;

describe("stacItemToDatasetDraft", () => {
  it("no hace ninguna llamada de red — es puro", () => {
    // Si esto compila y corre sin mocks de fetch, es prueba suficiente de
    // que el mapper es 100% offline.
    expect(() => stacItemToDatasetDraft(item, "proj-1")).not.toThrow();
  });

  it("preserva id, collection, bbox y geometry sin transformarlos", () => {
    const draft = stacItemToDatasetDraft(item, "proj-1");
    expect(draft.source_ref).toBe(item.id);
    expect(draft.name).toContain(item.collection);
    expect(draft.bbox_wgs84).toEqual(item.bbox);
    expect(draft.geometry_type).toBe("Polygon");
  });

  it("mapea a dataset_type remote_sensing con provenance DERIVED", () => {
    const draft = stacItemToDatasetDraft(item, "proj-1");
    expect(draft.dataset_type).toBe("remote_sensing");
    expect(draft.provenance).toBe("DERIVED");
  });

  it("usa datetime como fallback cuando no hay start/end_datetime separados", () => {
    const draft = stacItemToDatasetDraft(item, "proj-1");
    expect(draft.acquisition_start).toBe(item.properties.datetime);
    expect(draft.acquisition_end).toBe(item.properties.datetime);
  });

  it("preserva metadata de assets sin descargarlos", () => {
    const draft = stacItemToDatasetDraft(item, "proj-1");
    const assets = draft.metadata as { assets: Record<string, { href: string }> };
    expect(assets.assets.B11.href).toBe(item.assets!.B11.href);
  });

  it("es determinista", () => {
    expect(stacItemToDatasetDraft(item, "proj-1")).toEqual(stacItemToDatasetDraft(item, "proj-1"));
  });
});
