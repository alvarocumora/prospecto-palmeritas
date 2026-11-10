import { z } from "zod";

export const CHOLQUI_PILOT_PATH = "/inversion/piloto/cholqui";
export const PILOT_SHARE_PRICE_CLP = 10_000;
export const PILOT_MIN_CLP = 100_000;
export const PILOT_MAX_CLP = 10_000_000;

export const pilotAmount = z
  .number()
  .int()
  .min(PILOT_MIN_CLP)
  .max(PILOT_MAX_CLP)
  .multipleOf(PILOT_SHARE_PRICE_CLP);
