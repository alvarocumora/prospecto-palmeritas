import { createFileRoute } from "@tanstack/react-router";
import PortalPage from "@/features/operations/PortalPage";

export const Route = createFileRoute("/portal/buyer/$token")({
  head: () => ({
    meta: [
      { title: "Portal Comprador · Geocapitals" },
      {
        name: "description",
        content:
          "Portal privado del comprador para gestión documental, firmas y trazabilidad de la operación.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: BuyerPortal,
});

function BuyerPortal() {
  const { token } = Route.useParams();
  return <PortalPage token={token} role="buyer" />;
}
