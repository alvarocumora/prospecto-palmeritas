# Terminar Geocapitals para producción

Iteración enfocada en dejar la plataforma lista para clientes reales en `geocapitals.com`, capturando leads (sin cobros aún).

## Fase 1 — Hardening seguridad y datos

- Correr `security--run_security_scan` + `supabase--linter` y arreglar todo lo crítico (RLS faltante, GRANTs, funciones sin `search_path`, políticas permisivas).
- Revisar tablas nuevas de esta semana (`property_deal_inquiries`, `deal_settlements`, `investor_profiles`, `onboarding_status`) y confirmar:
  - RLS habilitado + `GRANT` correctos por rol.
  - Ninguna política deja escapar PII a `anon`.
  - Función `has_role` sigue siendo la única fuente de verdad para admin.
- Activar **Password HIBP Check** vía `supabase--configure_auth`.
- Confirmar que `_authenticated/route.tsx` protege todas las rutas privadas y que ninguna loader pública llama a serverFns con `requireSupabaseAuth`.

## Fase 2 — Estabilizar flujos críticos

Objetivo: cero pantallas rotas en móvil (viewport actual del usuario: 440×799).

1. **Auth** (`/auth`, `/reset-password`)
   - QA end-to-end: signup email, login, reset, resend confirmation, intent=investor.
   - Añadir botón "Continuar con Google" usando `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })`.
   - Loading states en submit; deshabilitar botón mientras corre.

2. **Dashboard** (`/dashboard`)
   - Empty states por card con CTA claro cuando no hay proyectos/deals.
   - Skeleton loader unificado (evitar layout shift).
   - Banner de onboarding solo si `account_type && !completed`.
   - Sticky quick-actions responsive en móvil.

3. **Ficha de proyecto** (`/proyectos/$listingId`)
   - Verificar SSR + metadata dinámica (title, description, og:image desde imagen del listing).
   - Ajustar 2-columnas → 1-columna en móvil (revisar overflow del mapa/gallery).
   - Botón "Solicitar data room" con estados: idle / requesting / requested / needs-auth.

4. **Simulador de inversión** (`InvestmentSimulator`)
   - Validar rangos (ticket mínimo/máximo, horizonte).
   - "Guardar simulación" → toast de confirmación + email interno al equipo.
   - Usuarios no autenticados: redirect a `/auth?intent=investor&returnTo=…`.

5. **Portal inversionista** (`/dashboard/investments`)
   - Estados vacíos ("Aún no tienes operaciones") con CTA a `/oportunidades`.
   - Mobile: tabla settlements → cards.

## Fase 3 — SEO, metadata y dominio

- `__root.tsx`: título, description, og:site_name, viewport, JSON-LD Organization. **Sin** `og:image` global.
- Cada ruta pública con `head()` propio: `/`, `/oportunidades`, `/proyectos/$listingId`, `/inversionistas`, `/legal/privacidad`, `/legal/terminos`, `/auth`.
- `og:image` por listing derivado del loader.
- `canonical` + `og:url` self-referencing con `https://geocapitals.com`.
- Crear `src/routes/sitemap[.]xml.ts` con rutas estáticas + listings publicados (query a `property_listings`).
- Crear/actualizar `public/robots.txt` con `Sitemap: https://geocapitals.com/sitemap.xml`.
- Correr `seo_chat--trigger_scan` al final y marcar findings resueltos.

## Fase 4 — Publicar

- Re-correr security scan; bloquear publish si hay críticos abiertos.
- `preview_ui--publish` a `geocapitals.com` (dominio ya conectado).
- Recordar al usuario que backend deploya inmediato pero frontend requiere click de "Update" en el diálogo de publish para promover cambios futuros.

## Fuera de alcance

- Stripe / cobros reales (se hará en próxima iteración).
- Nuevas features de motor 3D / satelital / NI 43‑101.
- Cambios de diseño / rebrand.

## Notas técnicas

- Todos los server functions nuevos siguen patrón `createServerFn` + `requireSupabaseAuth` cuando aplique; los públicos usan cliente publishable con políticas `TO anon` estrictas.
- Migraciones nuevas: solo si linter/scan lo exige (probablemente ninguna estructural, sí posibles `ALTER FUNCTION … SET search_path`).
- No tocar `src/integrations/supabase/*` autogenerados ni `routeTree.gen.ts`.
