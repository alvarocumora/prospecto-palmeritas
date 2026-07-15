import { auth, defineMcp } from "@lovable.dev/mcp-js";
import searchCommodityLots from "./tools/search-commodity-lots";
import getCommodityLot from "./tools/get-commodity-lot";
import listInvestmentOpportunities from "./tools/list-investment-opportunities";

// Direct Supabase host (never the .lovable.cloud proxy — RFC 8414 issuer mismatch).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "geocapitals-mcp",
  title: "Geocapitals",
  version: "0.1.0",
  instructions:
    "Geocapitals expone su marketplace certificado de commodities minerales y su deal flow de proyectos mineros en LatAm. Usa `search_commodity_lots` y `get_commodity_lot` para lotes de cobre, oro, plata, litio, tierras raras (concentrados, cátodos, doré, etc.) verificados. Usa `list_investment_opportunities` para descubrir proyectos publicados abiertos a inversión por país, commodity o etapa.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [searchCommodityLots, getCommodityLot, listInvestmentOpportunities],
});
