import type { DisclosureStandard } from "@/lib/reports/internationalStandards";
import { STANDARD_FRAMEWORKS } from "@/lib/reports/internationalStandards";
import type { ProjectDoc } from "./model";

/** Disclosure frameworks guide review; no dataset or template establishes compliance. */
export function technicalStandard(model: ProjectDoc) {
  return STANDARD_FRAMEWORKS[model.disclosureStandard ?? "NI_43_101"];
}

export function reportSources(model: ProjectDoc): string[] {
  const sources = new Set<string>();
  if (model.map?.source) sources.add(model.map.source);
  for (const flag of model.dataQuality ?? []) if (flag.source) sources.add(flag.source);
  for (const section of model.sections) {
    for (const block of section.blocks) {
      if ("source" in block && block.source) sources.add(block.source);
    }
  }
  return [...sources];
}

export const TECHNICAL_STANDARDS: readonly DisclosureStandard[] = ["NI_43_101", "JORC_2012"];
