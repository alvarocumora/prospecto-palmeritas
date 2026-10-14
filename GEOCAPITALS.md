# Geocapitals — Documento maestro

> **Única fuente de verdad** del producto, diseño, rutas y operación.
> Reemplaza a `plan.md`, `DIAGNOSTICO_SAAS_ARQUITECTURA.md`, `PLAN_MEJORA_ARQUITECTURA_PLATAFORMA.md`, `ROADMAP_MVP_GEOCAPITALS.md` y `STATUS.md`.
> Cualquier cambio relevante de marca, ruta o sistema debe reflejarse aquí.

---

## 1. Producto y propuesta

**Geocapitals** es la plataforma donde proyectos mineros se encuentran con capital institucional.
Integra **catastro, exploración geocientífica, monitoreo satelital, NI 43-101 y deals** sobre una sola capa de datos georreferenciada.

**Audiencia:**

| Perfil                          | Caso de uso                                               |
| ------------------------------- | --------------------------------------------------------- |
| Holdings y juniors              | Estructurar activos, levantar capital, NI 43-101          |
| Fondos / family offices         | Due diligence acelerado, screening de +47.000 concesiones |
| Qualified Persons / consultoras | Trazabilidad, firma electrónica, audit-trail              |
| Reguladores                     | Compliance, vencimientos, expedientes                     |

---

## 2. Arquitectura

Plan técnico de consolidación: [Blueprint técnico global](docs/blueprint-tecnico-global.md).
Incluye inventario basado en código, fragmentación, contratos de exploración/capital/trade,
prioridades de seguridad y gates de validación. Su existencia no certifica producción.

- **Frontend**: TanStack Start v1 + React 19 + Tailwind v4 (CSS-first, sin `tailwind.config.js`).
- **Backend**: Lovable Cloud (Supabase) — 135 tablas, 35 edge functions, **PostGIS 3.3.7**, pg_cron + pg_net.
- **AI**: Lovable AI Gateway (Gemini 3 Flash) para tesis IA, target generator y geo-copiloto.
- **3D real**: `Geology3DViewer` + `scene3d.server` con DEM Copernicus, drape Sentinel MPC y anomalías WGS84.
- **Auth**: Supabase Auth + roles vía tabla separada `app_roles` + helpers `has_*role()` `SECURITY DEFINER`.
- **Multi-tenant**: `organizations` y `projects` con RLS estricta.

---

## 3. Sistema de diseño

### 3.1 Dos contextos visuales

Geocapitals tiene **dos shells deliberadamente distintos** que comparten marca:

| Contexto                | Scope CSS          | Fondo                       | Cuándo                                                                                    |
| ----------------------- | ------------------ | --------------------------- | ----------------------------------------------------------------------------------------- |
| **Marketing / público** | `.brand-light`     | Blanco roto, navy/blue/gold | `/`, `/proyectos`, `/inversionistas`, `/empresas`, `/recursos`, `/contacto`, `/terminal*` |
| **Operations Console**  | tokens shadcn dark | `#06080A` (void)            | `/_authenticated/dashboard/*`                                                             |

Los unifica la marca (logo G + nombre GEOCAPITALS), las fuentes y el lenguaje cromático secundario (gold + navy).

### 3.2 Paleta `--brand-*` (marketing)

```css
--brand-navy: oklch(0.27 0.09 260);
--brand-navy-deep: oklch(0.18 0.08 260);
--brand-blue: oklch(0.55 0.2 255); /* primario CTA */
--brand-blue-soft: oklch(0.96 0.025 255); /* fondo suave */
--brand-gold: oklch(0.78 0.13 78); /* acento marca */
--brand-ink: oklch(0.18 0.02 260);
--brand-mute: oklch(0.5 0.02 260);
--brand-hair: oklch(0.9 0.01 260); /* bordes */
```

### 3.3 Tipografía

- **Display / Headings**: `Inter` 800, letter-spacing -0.02em (`.brand-display`)
- **Body**: `Inter` 400-600
- **Mono / etiquetas técnicas**: `JetBrains Mono` (`.brand-eyebrow`, métricas, códigos)

### 3.4 Componentes base reutilizables

- `MarketingHeader` — barra sticky con BrandMark + nav + login (`src/features/marketing/MarketingShell.tsx`)
- `MarketingFooter` — footer institucional con links de producto/compañía
- `MarketingPage` — layout con hero + slot de contenido para todas las rutas públicas secundarias
- `ContactForm` — formulario que escribe en `contact_messages`
- `HeroLiveMap` — MapLibre con datos PostGIS reales para el hero del landing
- `.brand-input` — input/select/textarea estilizado del marketing

### 3.5 Animaciones de marca

- `.brand-spin-slow` — rotación continua 40s lineal (anillo del proceso).
- `.brand-pulse` — halo respirando 2.4s ease-in-out (nodo G central del proceso).

---

## 4. Shell unificado

### 4.1 Shell público (`.brand-light`)

```
MarketingHeader
└── BrandMark + nav (Proyectos · Inversionistas · Empresas · Recursos · Contacto) + Login/Signup

[Contenido de la ruta]

MarketingFooter
└── BrandMark + 3 columnas de links + copyright
```

Aplicado a TODAS las rutas públicas, ya sea via `MarketingPage` (rutas secundarias) o directamente (landing `/`).

### 4.2 Shell autenticado (Operations Console)

```
TopBar (mini, dark)
CommandRail (sidebar vertical 56px con grupos: OPERATIONS · CADASTRE · FIELD · ANALYSIS · GOVERNANCE · ACCOUNT)
└── <Outlet /> contenido del módulo
StatusBar (mini footer dark)
MobileBottomNav (móvil)
```

Definido en `src/routes/_authenticated.tsx`. Todos los módulos del dashboard (`/dashboard/*`) heredan automáticamente este shell — **no se duplica en cada ruta**.

### 4.3 Coherencia entre ambos

- Mismo logo `G` (blue en landing, gold en footer/dashboard).
- Misma fuente mono (`JetBrains Mono`) para etiquetas técnicas.
- Mismo color gold como acento brand en ambos.
- Botón "Iniciar sesión" en landing → `/auth` → `/dashboard` con el shell oscuro.

---

## 5. Mapa de rutas

### 5.1 Públicas (sin auth)

| Ruta                                                                                                   | Descripción                                                           | head() propio |
| ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- | ------------- |
| `/`                                                                                                    | Landing con mapa en vivo, giro animado, contacto                      | ✓             |
| `/proyectos`                                                                                           | Showcase de proyectos reales + CTA publicar                           | ✓             |
| `/inversionistas`                                                                                      | Propuesta de valor para fondos + form lead                            | ✓             |
| `/empresas`                                                                                            | Planes institucionales (Explorer · Operator · Institutional)          | ✓             |
| `/recursos`                                                                                            | Guías, whitepapers, demos                                             | ✓             |
| `/contacto`                                                                                            | Formulario completo + info de contacto                                | ✓             |
| `/auth`                                                                                                | Login / signup                                                        | ✓             |
| `/reset-password`                                                                                      | Recuperar contraseña                                                  | ✓             |
| `/terminal` · `/terminal.market` · `/terminal.capital-raise` · `/terminal.tokenize`                    | Pre-vista pública del terminal                                        | ✓             |
| `/catastro` · `/catastro.mapa` · `/catastro.precios` · `/catastro.c.$code` · `/catastro.app.watchlist` | Vistas públicas del catastro                                          | ✓             |
| `/live/palmeras` · `/live/losverdes` · `/live/tilama` · `/live/franco`                                 | Vistas en vivo de proyectos demo                                      | ✓             |
| `/diag/mining-engine`                                                                                  | Diagnóstico ingeniería minera                                         | ✓             |
| `/invitations/$token`                                                                                  | Aceptar invitación a organización                                     | ✓             |
| `/share/targets/$projectId`                                                                            | Compartir targets vía link público                                    | ✓             |
| `/api/public/*`                                                                                        | Webhooks y APIs públicas (sync catastro, verify compliance, live map) | n/a           |

### 5.2 Autenticadas (`/_authenticated/dashboard/*`)

Agrupadas en 6 secciones del CommandRail:

- **OPERATIONS**: Mission Control, Centro Op., Campañas, Proyectos
- **CADASTRE**: Catastro, Boletín Minero
- **FIELD**: Geofísica, Drones, Sondajes, Sección 3D, Muestreo
- **ANALYSIS**: QA/QC, Targets, Inteligencia Sat., Estimación, Inventario, Reportes, NI 43-101, QPs
- **GOVERNANCE**: Aprobaciones, Costos, HSE, Equipo, Auditoría, Validación, Marketplace Capas, Marketplace Deals
- **ACCOUNT**: Mi Perfil, Admin (solo super_admin)

Otros: `3d-pro`, `geology3d`, `field-map`, `map`, `command-center`, `opportunities` (IA), `palmeras`, `lv5-page5`, `sat3d`, `mag-revalidations`, `targets/ai-brief`, `project-report`, `catastro/holders/$id`, `geophysics/$surveyId(/field)`.

### 5.3 Reportes especiales

- `/reports/losverdes/pre43101` — reporte público pre-NI-43-101.

---

## 6. Inventario de botones y CTAs del landing `/`

| Sección                 | Botón / link                                                      | Destino                                     | Función                      |
| ----------------------- | ----------------------------------------------------------------- | ------------------------------------------- | ---------------------------- |
| Header                  | BrandMark                                                         | `/`                                         | Volver al inicio             |
| Header                  | Nav (Proyectos / Inversionistas / Empresas / Recursos / Contacto) | `/proyectos`, etc.                          | Rutas reales con head propio |
| Header                  | "Iniciar sesión"                                                  | `/auth`                                     | Login                        |
| Header                  | "Registrarse"                                                     | `/auth`                                     | Signup                       |
| Hero                    | "Publica tu proyecto"                                             | `/proyectos#publicar`                       | CTA dueño                    |
| Hero                    | "Explorar oportunidades"                                          | `/terminal`                                 | Pre-vista terminal           |
| Hero · Live map         | Navegación interactiva                                            | (mapa)                                      | Pan/zoom + bbox auto-fit     |
| Proceso (giro)          | Nodos visuales (Publica · Conecta · Negocia · Cierra)             | (decorativo)                                | Highlight secuencial cada 3s |
| Para inversionistas     | "Explorar oportunidades"                                          | `/inversionistas`                           | Página dedicada              |
| Palmeras                | "Ver vista en vivo"                                               | `/live/palmeras`                            | Vista demo en vivo           |
| Casos de uso · Holdings | "Ver más"                                                         | `/empresas`                                 | Pricing                      |
| Casos de uso · Fondos   | "Ver más"                                                         | `/inversionistas`                           | Lead capture                 |
| Casos de uso · QPs      | "Ver más"                                                         | `/recursos`                                 | Documentación                |
| CTA principal           | "Solicitar acceso institucional"                                  | `/auth`                                     | Signup                       |
| CTA principal           | "Explorar el terminal en vivo"                                    | `/terminal`                                 | Demo terminal                |
| Contacto embebido       | Form (nombre/email/org/perfil/mensaje)                            | `submitContactMessage` → `contact_messages` | Lead a DB                    |
| Footer                  | Links producto/compañía                                           | varias                                      | Navegación secundaria        |

---

## 7. Contacto y captación

### 7.1 Tabla `public.contact_messages`

| Campo          | Tipo          | Notas                                                       |
| -------------- | ------------- | ----------------------------------------------------------- |
| `id`           | uuid PK       |                                                             |
| `name`         | text NOT NULL | 1-200 chars                                                 |
| `email`        | text NOT NULL | 3-320 chars                                                 |
| `organization` | text          | ≤200 chars                                                  |
| `role`         | text          | `owner` / `investor` / `qp` / `other`                       |
| `message`      | text NOT NULL | 5-4000 chars                                                |
| `source`       | text          | `landing`, `landing-home`, `contact-page`, `inversionistas` |
| `user_agent`   | text          | reservado                                                   |
| `status`       | text          | `new` / `read` / `answered` / `spam`                        |
| `created_at`   | timestamptz   | default `now()`                                             |

### 7.2 RLS

- **INSERT**: `anon` + `authenticated` pueden enviar (form público).
- **SELECT / UPDATE**: solo usuarios con rol `super_admin` en `app_roles`.

### 7.3 Server functions

- `submitContactMessage` (`src/lib/contactMessages.functions.ts`) — validación Zod estricta.
- `getLandingMapData` (`src/lib/landingMap.functions.ts`) — usa `supabaseAdmin` + RPC PostGIS `opportunities_geo`.
- `getPlatformStats` (`src/lib/platformStats.functions.ts`) — métricas vivas del landing.

### 7.4 Política de respuesta

- SLA visible: **< 24 horas hábiles**.
- Notificación in-app a super_admin (próximo sprint: email via SMTP).

---

## 8. Pendientes

- **Email transaccional** desde el form de contacto (queda solo en DB).
- **i18n EN** para `/proyectos`, `/inversionistas`, `/empresas`, `/recursos`, `/contacto` (solo `/` está bilingüe).
- **Cluster** de anomalías en el hero map cuando supere ~500 puntos visibles.
- **OG images** dinámicas para `/live/$proyecto` y `/proyectos`.
- **Sitemap dinámico** en `src/routes/sitemap[.]xml.ts`.

---

## Apéndice · Memoria del agente

Las reglas vivas adicionales se mantienen en `mem://index.md`:

- `mem://plan/produccion-maestra` — roadmap 6 fases.
- `mem://security/definer-funcs` — funciones SECURITY DEFINER permitidas.
- `mem://plan/3d-ia-disruptivo` — sprints 3D + IA.
