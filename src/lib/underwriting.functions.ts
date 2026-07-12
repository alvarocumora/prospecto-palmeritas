import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { assessAdvance, type UnderwritingResult } from "@/lib/underwriting";
import { verifyCommodityLot } from "@/lib/lotVerification.functions";
import { getCounterpartyReputation } from "@/lib/counterpartyReputation.functions";
import { estimatePayableValue } from "@/lib/payableValue.functions";

// Orquestador del motor de underwriting: reúne los tres scores del stack de
// verificación (KYM del activo + reputación de la contraparte + valor pagable
// del lote) y produce un anticipo pre-aprobado indicativo. Cada dependencia se
// tolera a null (degradación elegante). Lectura de solo lectura.

export type AdvanceOffer = UnderwritingResult & {
  lotId: string;
  lotValueUsd: number | null;
  generatedAt: string;
};

const input = z.object({ lotId: z.string().uuid() });

export const getAdvanceOffer = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data }): Promise<AdvanceOffer> => {
    const [kym, reputation, valuation] = await Promise.all([
      verifyCommodityLot({ data: { lotId: data.lotId } }).catch(() => null),
      getCounterpartyReputation({ data: { lotId: data.lotId } }).catch(() => null),
      estimatePayableValue({ data: { lotId: data.lotId } }).catch(() => null),
    ]);

    const lotValueUsd = valuation?.result.netTotalUsd ?? null;
    const result = assessAdvance({
      assetTrust: kym?.score ?? null,
      hasRedFlags: (kym?.redFlags?.length ?? 0) > 0,
      sellerReputation: reputation?.score ?? null,
      sellerTier: reputation?.tier ?? "new",
      lotValueUsd,
      valuationSupported: !!valuation?.result.supported && lotValueUsd != null,
    });

    return {
      ...result,
      lotId: data.lotId,
      lotValueUsd,
      generatedAt: new Date().toISOString(),
    };
  });
