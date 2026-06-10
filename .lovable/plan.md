# Landing + Shell unificado de Geocapitals

Objetivo: el landing muestra un mapa real (no mock estático), el "giro" del proceso se siente vivo, el dashboard interior comparte el mismo lenguaje visual (un solo shell), las rutas/botones/contacto del landing dejan de ser anclas rotas, y todo queda documentado en un único MD maestro.

## 1. Hero del landing: mapa real en vez de mock

Archivo: `src/features/marketing/MarketingLanding.tsx` (reemplaza el "Hero card mock" actual, líneas ~240-274).

- Nuevo componente `src/features/marketing/HeroLiveMap.tsx`:
  - MapLibre con basemap Esri satélite (mismo helper que `OpportunitiesMap` y `LosVerdesStrategicMap`), centrado en Chile minero (-70.5, -27.5, zoom 4.6), interactivo pero con `cooperativeGestures` para que no robe scroll.
  - Carga vía nueva serverFn pública `getLandingMapData` (`src/lib/landingMap.functions.ts`, usa `supabaseAdmin` dentro del handler — sin `requireSupabaseAuth` para que el landing público funcione en SSR):
    - top 25 `cadastre_opportunities` con `score >= 50` → polígonos coloreados por score.
    - top 80 `mineral_deposits` (puntos) y top 80 `satellite_anomalies` (puntos).
    - solo columnas seguras (nombre, score, commodity, región) — sin PII.
  - Overlay encima del mapa: tarjeta translúcida con las 3 métricas clave (proyectos, anomalías, targets) y dos badges flotantes ("LIVE · Chile" pulse dorado, "Powered by PostGIS").
  - Leyenda compacta abajo-izquierda y botón **"Abrir en Terminal"** → `/terminal`.
- Manejo de error/empty: si la serverFn falla o el dataset está vacío, cae al mock actual (no romper SSR).

## 2. "Giro" del proceso: rueda viva

Archivo: misma página, sección "For owners + process" (líneas ~314-342).

- Mantener la rueda SVG pero:
  - Animar rotación continua lenta del círculo punteado (`@keyframes brand-spin 40s linear infinite`).
  - Los 4 nodos (Publica · Conecta · Negocia · Cierra) **no** rotan; en su lugar reciben un highlight secuencial cada 3s (paso activo en `--brand-blue`, resto en gris) controlado por `useState` + `setInterval`.
  - El nodo central pasa de "G" estático a marca pulsante: anillo `bg-[var(--brand-blue-soft)]` + halo `box-shadow` que respira (`@keyframes brand-pulse 2.4s ease-in-out infinite`).
  - Línea de conexión animada entre nodo central y nodo activo (SVG `stroke-dasharray` animado).
- Definir `@keyframes brand-spin` y `brand-pulse` en `src/styles.css` dentro del bloque `brand-light`.

## 3. Rutas + botones + contacto del landing

El header tiene `#section-0..3` (anclas rotas) y el bloque de contacto solo muestra texto. Lo arreglamos:

- **Header nav** apunta a rutas reales:
  - "Proyectos" → `/proyectos` (nueva)
  - "Inversionistas" → `/inversionistas` (nueva)
  - "Empresas" → `/empresas` (nueva)
  - "Recursos" → `/recursos` (nueva)
- Nuevas páginas (todas con `head()` propio, scroll a top, mismo shell visual):
  - `src/routes/proyectos.tsx` — grid de proyectos públicos (lee `live.*` existentes: Palmeras, Los Verdes, Tilama, Franco) + CTA "Publica el tuyo" → `/auth`.
  - `src/routes/inversionistas.tsx` — propuesta de valor para fondos + form (lead capture) que llama serverFn `submitInvestorLead`.
  - `src/routes/empresas.tsx` — pricing/planes institucionales (3 tiers, redirige a `/contacto`).
  - `src/routes/recursos.tsx` — links a los MD públicos (`/recursos/onepager`, NI 43-101 demo, whitepaper).
  - `src/routes/contacto.tsx` — form real (`nombre, email, organización, mensaje, tipo: owner|investor|qp`) que llama serverFn `submitContactMessage` y crea fila en una tabla nueva `contact_messages` con RLS (insert público anónimo, select solo `is_super_admin`).
- Migration para `public.contact_messages` (id, name, email, org, role, message, source, created_at) + GRANTs + RLS (`INSERT TO anon, authenticated`; `SELECT` vía `has_role(auth.uid(),'super_admin')`).
- Reemplazar las anclas (`href="#section-N"`) por `<Link to>` y los IDs `section-*` por anclas semánticas reales o eliminarlos.
- Sección "Join" inferior del landing: el bloque actual con `info@geocapitals.com` se vuelve un mini-form embebido (mismo componente que `/contacto`) + el botón "Sign up" pasa al lado derecho de un layout limpio.
- CTAs del hero:
  - "Publica tu proyecto" → `/proyectos#publicar` (con anchor real)
  - "Explorar oportunidades" → `/terminal` (ya existe, lo mantenemos)

## 4. Shell unificado interior + exterior

Hoy el dashboard interior no comparte tokens con el landing (interior usa `bg-background`/`foreground` shadcn, exterior usa `--brand-*`). Los unificamos sin romper componentes shadcn:

- En `src/styles.css`, dentro de `:root` y `.dark`, **mapear** los tokens shadcn al brand:
  - `--background` → blanco roto del landing, `--foreground` → `--brand-ink`, `--primary` → `--brand-blue`, `--secondary` → `--brand-navy-deep`, `--accent` → `--brand-gold`, `--border` → `--brand-hair`, `--ring` → `--brand-blue`, `--card`/`--popover` siguen blancos.
  - Tipografías: `--font-display: "Space Grotesk"`, `--font-sans: "Inter"`, `--font-mono: "JetBrains Mono"` (ya cargadas en `__root.tsx`).
- Nuevo componente `src/components/layout/AppShell.tsx` que envuelve TODO `_authenticated/dashboard.*`:
  - Header sticky idéntico al del landing (BrandMark + nav del módulo + lang/user) sobre fondo `bg-white/90 backdrop-blur` con `border-[var(--brand-hair)]`.
  - Sidebar/aside opcional (collapse en mobile) reutilizable.
  - Footer compacto en `bg-[var(--brand-navy-deep)]` igual al landing.
- Aplicar `AppShell` a `_authenticated.tsx` (layout pathless), de forma que todas las páginas internas hereden la cabecera/footer sin reescribir cada ruta. Los componentes shadcn dentro siguen funcionando porque los tokens se mantienen.
- Resultado: usuario abre landing → entra a `/auth` → cae en `/dashboard` y el header/colores/tipografía son los mismos. Sin "ruptura" entre exterior e interior.

## 5. Un solo MD maestro

Hoy hay 5 docs (`plan.md`, `DIAGNOSTICO_SAAS_ARQUITECTURA.md`, `PLAN_MEJORA_ARQUITECTURA_PLATAFORMA.md`, `ROADMAP_MVP_GEOCAPITALS.md`, `STATUS.md`). Los consolidamos:

- Crear `GEOCAPITALS.md` (raíz) como **única fuente de verdad** con secciones:
  1. **Producto y propuesta** (qué es Geocapitals, audiencia).
  2. **Arquitectura** (TanStack Start, Lovable Cloud, PostGIS, AI Gateway, 35 funciones, 135 tablas).
  3. **Sistema de diseño** (paleta `--brand-*` en oklch, fuentes Space Grotesk + Inter + JetBrains Mono, tokens shadcn mapeados, escalas, sombras, `brand-display`/`brand-eyebrow`).
  4. **Shell unificado** (header/sidebar/footer compartidos landing↔dashboard).
  5. **Mapa de rutas públicas** (`/`, `/proyectos`, `/inversionistas`, `/empresas`, `/recursos`, `/contacto`, `/terminal`, `/auth`, `/catastro`, `/live.*`) y **rutas autenticadas** (resumen del árbol `_authenticated/dashboard.*`).
  6. **Inventario de botones y CTAs** del landing — qué hace cada uno, a dónde lleva, qué evento dispara.
  7. **Contacto y captación** (formulario, tabla `contact_messages`, política de respuesta, integraciones futuras).
  8. **Pendientes** (lo que queda fuera de este sprint).
- Marcar los 5 docs viejos como deprecados con un banner al inicio que apunta a `GEOCAPITALS.md`, o moverlos a `.lovable/archive/` si el usuario lo prefiere (en este sprint los movemos a `docs/legacy/`).

## Archivos a tocar / crear

```text
+ src/features/marketing/HeroLiveMap.tsx          (nuevo, MapLibre)
+ src/lib/landingMap.functions.ts                 (serverFn pública, supabaseAdmin)
+ src/lib/contactMessages.functions.ts            (submitContactMessage + submitInvestorLead)
+ src/routes/proyectos.tsx                        (nueva)
+ src/routes/inversionistas.tsx                   (nueva)
+ src/routes/empresas.tsx                         (nueva)
+ src/routes/recursos.tsx                         (nueva)
+ src/routes/contacto.tsx                         (nueva, form real)
+ src/components/layout/AppShell.tsx              (header+footer compartidos)
+ supabase/migrations/<ts>_contact_messages.sql   (tabla + RLS + GRANT)
+ GEOCAPITALS.md                                  (doc maestro único)
~ src/features/marketing/MarketingLanding.tsx     (hero map + giro animado + nav real + contacto)
~ src/styles.css                                  (tokens shadcn ↔ --brand-*, keyframes brand-spin/pulse)
~ src/routes/_authenticated.tsx                   (envolver con AppShell)
~ docs/legacy/                                    (mover los 5 MD viejos con banner deprecated)
```

## Fuera de alcance

- Rediseño visual completo del dashboard (solo unificamos header/footer/tokens; los módulos internos mantienen su layout actual).
- Internacionalización de las nuevas rutas (`/proyectos`, etc.) — quedan en español; toggle ES/EN se mantiene solo en `/`.
- Envío real de email desde el form de contacto (queda como fila en DB + notificación in-app; integración SMTP la dejamos para el próximo sprint).
