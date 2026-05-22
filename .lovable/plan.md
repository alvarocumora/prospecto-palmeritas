## Diagnóstico

- El dev server arranca sin errores y todas las rutas devuelven HTTP 200:
  - `/`, `/catastro`, `/catastro/mapa`, `/catastro/precios`, `/catastro/c/$code`, `/catastro/app/watchlist`.
- La pantalla "404 Página no encontrada" que ves es el `NotFoundComponent` del `__root.tsx` renderizando correctamente porque la URL actual del preview es **`/index`**, que **no existe** como ruta en TanStack Router. La home está en `src/routes/index.tsx` y corresponde a `/`, no a `/index`.
- No hay ningún `Link to="/index"` en el código (`rg` no encuentra nada), así que probablemente fue una URL tipeada o un bookmark antiguo. Pero si vino de un enlace externo, conviene cubrirlo.
- El módulo público de catastro (Fases 1 y 2) está intacto: registro de rutas en `routeTree.gen.ts` confirmado, `WatchlistButton` montado, `PublicCatastroShell` ok.

## Cambios propuestos

1. **Alias `/index` → `/`**  
   Crear `src/routes/index_.tsx` (sufijo `_` lo deja como ruta plana sin layout especial) con `createFileRoute("/index")` que use `beforeLoad` para `throw redirect({ to: "/" })`. Así cualquier visita a `/index` (humanos, crawlers, bookmarks) termina en la home en vez del 404. Sin impacto en el resto del routing.

2. **Mejorar el 404 del root con CTA a catastro**  
   En `NotFoundComponent` agregar un segundo enlace "Explorar catastro minero" hacia `/catastro`, para no perder al visitante que aterriza mal.

3. **QA rápido post-cambio**  
   - `curl` a `/index` debe responder 200 con HTML de la home (redirect SSR).
   - `curl` a `/catastro` y `/catastro/mapa` siguen respondiendo 200.
   - Navegar el preview a `/` y confirmar que aparece la home (no 404).

## Fuera de alcance

- No tocar Fase 3 (Stripe) ni Fase 4 (job de sync de alertas): siguen pendientes según el plan.
- No modificar `routeTree.gen.ts` a mano — se regenera solo al crear el nuevo archivo de ruta.
- No cambiar `client.ts`, `auth-middleware.ts`, ni configuración Supabase.
