// Server functions públicas para el mapa del landing.
// Sin requireSupabaseAuth: corren durante SSR y para visitantes anónimos.
import { createServerFn } from "@tanstack/react-start";

type FC = { type: "FeatureCollection"; features: any[] };
type GeoPayload = {
  concessions: FC;
  anomalies: FC;
  deposits: FC;
  targets: FC;
  bbox: [number, number, number, number] | null;
  generatedAt: string;
};

const EMPTY_FC: FC = { type: "FeatureCollection", features: [] };

export const getLandingMapData = createServerFn({ method: "GET" }).handler(
  async (): Promise<GeoPayload> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error } = await supabaseAdmin.rpc("opportunities_geo", {
        _limit: 60,
        _min_score: 40,
        _region: null as unknown as string,
      });
      if (error) throw error;
      const payload = (data ?? {}) as Partial<GeoPayload>;
      return {
        concessions: (payload.concessions as FC) ?? EMPTY_FC,
        anomalies: (payload.anomalies as FC) ?? EMPTY_FC,
        deposits: (payload.deposits as FC) ?? EMPTY_FC,
        targets: (payload.targets as FC) ?? EMPTY_FC,
        bbox: (payload.bbox as [number, number, number, number]) ?? null,
        generatedAt: new Date().toISOString(),
      };
    } catch (_e) {
      return {
        concessions: EMPTY_FC,
        anomalies: EMPTY_FC,
        deposits: EMPTY_FC,
        targets: EMPTY_FC,
        bbox: null,
        generatedAt: new Date().toISOString(),
      };
    }
  },
);
