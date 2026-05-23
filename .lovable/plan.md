# Geocapitals OS — Plataforma Unificada de Exploración y Certificación Minera

## Visión

Una sola plataforma donde un proyecto minero vive su ciclo completo —desde la primera anomalía satelital hasta el NI 43-101 firmado y el deal cerrado con inversionistas— con **IA geológica, 3D real y trazabilidad criptográfica** como columna vertebral.

Hoy Geocapitals tiene 135 tablas, 35 edge functions, 3D real (Copernicus + Sentinel), catastro, satelital, geofísica, drilling, NI 43-101 y deals. Pero está **fragmentado en ~60 rutas** sin un hilo narrativo. Este plan no agrega features: **unifica, jerarquiza y le da una identidad visionaria.**

---

## Los 4 pilares unificadores

```text
┌─────────────────────────────────────────────────────────────┐
│  1. EXPLORE    →  2. MODEL    →  3. CERTIFY   →  4. DEAL    │
│  (descubrir)      (entender)     (validar)        (monetizar)│
└─────────────────────────────────────────────────────────────┘
        ↑                                              ↓
        └──────── Geo Copilot (IA transversal) ────────┘
```

Cada módulo actual se reasigna a uno de estos 4 pilares. Se eliminan rutas huérfanas y se consolidan duplicados (ej. 3 visores 3D → 1 visor canónico con modos).

---

## Fase 1 — Mission Control unificado (la "portada operativa")

Reemplaza el dashboard actual por un **cockpit único por proyecto** con 4 zonas que mapean a los 4 pilares. Layout tipo Bloomberg/Palantir:

```text
┌──────────────────────────────────────────────────────────┐
│ Header: Proyecto · Commodity · Fase · Fusion Score · QPS │
├────────────────┬─────────────────────────────────────────┤
│  EXPLORE       │   MODEL (visor 3D real, centro)         │
│  - Targets     │   ┌─────────────────────────────────┐   │
│  - Sat anom    │   │  DEM + Sentinel + anomalías     │   │
│  - Geofísica   │   │  vetas + pórfidos + drill holes │   │
│  - Catastro    │   └─────────────────────────────────┘   │
├────────────────┼─────────────────────────────────────────┤
│  CERTIFY       │   DEAL                                  │
│  - NI 43-101   │   - Data room · Inversionistas         │
│  - QPS sigs    │   - Marketplace · Compliance           │
└────────────────┴─────────────────────────────────────────┘
```

- Una sola navegación lateral con los 4 pilares (no 60 entradas).
- El visor 3D real (Geology3DViewer + SatToSubsurface) se vuelve el centro visual del cockpit, no una ruta separada.
- Fusion Score y QPS status siempre visibles en el header como "signos vitales" del proyecto.

## Fase 2 — Geo Copilot transversal

Un copiloto IA persistente (drawer derecho, atajo ⌘K) que entiende el contexto del proyecto y puede:

- "Genérame 5 targets desde las anomalías Sentinel + lineamientos magnéticos"
- "Explica el target T-042 en lenguaje QP"
- "Redacta la sección 9 del NI 43-101 con la data actual"
- "Compara este proyecto con depósitos pórfido análogos en Chile"

Usa `google/gemini-3.1-pro-preview` para razonamiento + `gemini-3.1-flash-image-preview` para overlays geológicos. Reusa `geo-assistant` y `geo-brief` ya existentes, los unifica detrás de una sola UI.

## Fase 3 — 3D canónico (un solo visor, tres modos)

Hoy hay `Geology3DViewer`, `SatToSubsurface3DViewer`, `MagAnomaly3DPro`, `BlockModel3DViewer`. Se consolidan en **un solo `GeoScene3D`** con modos:

- **Surface**: DEM + Sentinel + catastro + targets
- **Subsurface**: vetas, pórfidos, drill holes, secciones
- **Resource**: bloques, leyes, pit shells, NPV/IRR

Mismo motor (deck.gl), mismas capas base, toggles arriba. Esto elimina ~3000 líneas de duplicación.

## Fase 4 — Certificación como producto de primera clase

NI 43-101 deja de ser un PDF generado on-demand y se vuelve un **documento vivo** versionado:

- Editor sección por sección con QP asignado
- Cada figura/tabla referencia data viva (si cambian las anomalías, la sección 9 se marca "stale")
- Firma criptográfica por sección (envelopes que ya existen en `signature_envelopes`)
- Verificación pública vía `/api/public/verify-compliance/$reportId` (ya existe)
- Export PDF determinista + hash on-chain opcional

Esto convierte la certificación en el **moat defendible** vs competidores.

## Fase 5 — Deal Room conectado

Cuando un proyecto alcanza cierto Fusion Score + NI 43-101 firmado, automáticamente puede publicarse al marketplace con:

- One-pager auto-generado (hero del cockpit + KPIs + scenarios económicos)
- Data room con permisos granulares por inversionista
- Tracking de quién vio qué (ya existe `usage` types)

---

## Roadmap propuesto (6 sprints de 1 semana)

| Sprint | Entregable | Foco |
|---|---|---|
| 1 | Mission Control shell + navegación de 4 pilares | UX/IA unificada |
| 2 | Visor 3D canónico (GeoScene3D) con 3 modos | Consolidación técnica |
| 3 | Geo Copilot drawer transversal | IA |
| 4 | NI 43-101 documento vivo + staleness tracking | Certificación |
| 5 | Deal Room conectado al cockpit | Monetización |
| 6 | Onboarding visionario + landing geocapitals.com | Go-to-market |

---

## Detalles técnicos

- **Rutas**: colapsar `_authenticated.dashboard.*` (~40 rutas) a 4 rutas raíz (`/explore`, `/model`, `/certify`, `/deal`) + sub-rutas. Mantener compatibilidad con redirects 6 meses.
- **Diseño**: paleta `Midnight Indigo` + acentos `Emerald Prestige` (autoridad técnica + lujo minero). Tipografía: Space Grotesk + DM Sans. Tokens en `src/styles.css`.
- **Estado**: TanStack Query como única fuente para data del proyecto activo. Eliminar duplicación entre `useProjects`, `useExecutiveKpis`, etc.
- **Backend**: 35 edge functions auditadas — consolidar las 8 de "compute-*" en un dispatcher único `compute-engine` con tipo de cómputo como input.
- **Realtime**: canal único `project:{id}` que multiplexa targets, anomalías, firmas, etc., en vez de N canales.

---

## Preguntas antes de empezar

Para asegurar que el sprint 1 sea exactamente lo que esperas:

1. **¿Empezamos por el Mission Control (Fase 1)** como primer entregable visible, o prefieres que ataquemos primero la **consolidación del visor 3D** (Fase 2) porque es el diferenciador visual más fuerte?
2. **¿Mantenemos las rutas antiguas como redirects** durante la migración, o hacemos un corte limpio (riesgo si hay usuarios con bookmarks)?
3. **¿La certificación NI 43-101 viva** (Fase 4) debe incluir firma on-chain desde el inicio, o lo dejamos como opt-in para una v2?

Apruébame el plan (o ajústalo) y arrancamos por la fase que prefieras.
