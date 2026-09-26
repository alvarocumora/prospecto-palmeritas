import { createFileRoute } from "@tanstack/react-router";
import PortalPage from "@/features/operations/PortalPage";

export const Route = createFileRoute("/portal/seller/$token")({
  head: () => ({
    meta: [
      { title: "Portal Vendedor · Geocapitals" },
      {
        name: "description",
        content:
          "Portal privado del vendedor para completar KYC, documentación técnica y firma de acuerdos.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: SellerPortal,
});

function SellerPortal() {
  const { token } = Route.useParams();
  return <PortalPage token={token} role="seller" />;
}
