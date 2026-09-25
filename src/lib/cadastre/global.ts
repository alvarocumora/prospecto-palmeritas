import { searchCadastre, type SearchCadastreInput, type GlobalCadastreResult } from "@/lib/cadastre/searchCadastre";

/**
 * Compatibility adapter for the Mining Cadastre Intelligence workspace.
 * New consumers should call searchCadastre directly.
 */
export async function searchCadastreForMining(input: SearchCadastreInput): Promise<GlobalCadastreResult> {
  return searchCadastre(input);
}
