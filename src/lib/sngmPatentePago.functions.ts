// Server function pública: consulta de pago de patente minera (SERNAGEOMIN).
// Sin auth — es información pública (el propio SERNAGEOMIN la expone sin login).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fetchPatentePagoAuto, type PatentePagoConsulta } from "./sngmPatentePago";

const inputSchema = z.object({ rol: z.string().min(3).max(20) });

export const getConcessionPatentePago = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ data }): Promise<PatentePagoConsulta | null> => {
    return fetchPatentePagoAuto(data.rol);
  });
