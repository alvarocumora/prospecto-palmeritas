import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { z } from "zod";

export const Route = createFileRoute("/inscripcion/gracias")({
  validateSearch: (raw: Record<string, unknown>) =>
    z.object({ folio: z.string().optional() }).parse(raw),
  head: () => ({
    meta: [
      { title: "Inscripción recibida — Geocapitals" },
      {
        name: "description",
        content:
          "Tu inscripción de proveedor fue recibida por Geocapitals. Próximo paso: crear cuenta con tu correo para subir documentos y seguir el avance.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Gracias,
});

function Gracias() {
  const { folio } = Route.useSearch();
  return (
    <div
      data-theme="im-light"
      className="min-h-screen bg-[hsl(var(--surface-paper))] text-[hsl(var(--content))]"
    >
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <CheckCircle2 className="mx-auto h-16 w-16 text-[hsl(var(--accent-brand))]" />
        <h1 className="mt-6 font-serif text-3xl">Inscripción recibida</h1>
        {folio && (
          <p className="mt-2 text-sm text-[hsl(var(--content-subtle))]">
            Folio: <span className="font-mono">{folio}</span>
          </p>
        )}
        <p className="mx-auto mt-6 max-w-lg text-sm">
          Guarda este folio. Para subir el certificado de análisis, el título o mandato y las fotos
          de la faena, crea tu cuenta con el mismo correo que usaste en la inscripción y entra a
          tu panel de proveedor.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            to="/auth"
            className="rounded bg-[hsl(var(--accent-brand))] px-4 py-2 text-sm text-white"
          >
            Crear cuenta / iniciar sesión
          </Link>
          <Link to="/" className="text-sm underline">
            Volver al inicio
          </Link>
        </div>
        <p className="mt-10 text-xs text-[hsl(var(--content-subtle))]">
          Dudas: <a href="mailto:info@geocapitals.com" className="underline">info@geocapitals.com</a>{" "}
          · WhatsApp <a href="https://wa.me/56962184071" className="underline">+56 9 6218 4071</a>
        </p>
      </main>
    </div>
  );
}
