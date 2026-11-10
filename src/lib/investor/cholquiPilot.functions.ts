import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pilotAmount } from "./cholquiPilot";

const receipt = z
  .union([
    z.object({ orderId: z.null(), amountClp: z.null(), issuedAt: z.null() }),
    z.object({ orderId: z.string().uuid(), amountClp: pilotAmount, issuedAt: z.string() }),
  ])
  .nullable();

export const getCholquiPilot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // The migration adds this RPC. Generated Supabase types follow schema deployment.
    const { data, error } = await context.supabase.rpc("cholqui_pilot_receipt" as never);
    if (error) throw new Error("No fue posible consultar el piloto.");
    return receipt.parse(data);
  });

export const confirmCholquiPilot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ amountClp: pilotAmount, acceptedSimulation: z.literal(true) }))
  .handler(async ({ context, data: input }) => {
    const { data, error } = await context.supabase.rpc(
      "cholqui_pilot_receipt" as never,
      { p_amount_clp: input.amountClp } as never,
    );
    if (error) throw new Error("No fue posible registrar la simulación.");
    return receipt.parse(data);
  });
