# Plan: reordenar el dashboard y quitar callejones sin salida

Trabajo grande, dividido en 4 fases entregables e independientes. Cada fase deja la plataforma más usable que la anterior.

---

## Fase 1 — Limpiar el mapa de rutas del dashboard

**Problema hoy:** 116 archivos de ruta bajo `/dashboard`, con nombres duplicados en el sidebar ("Mission Control" en `/dashboard` y "Centro Op." en `/dashboard/map` se sienten iguales), rutas fantasma que solo redirigen (`palmeras`, `sat3d`, `lv5-page5`, `command-center`) y una barra lateral muy larga sin jerarquía clara.

Acciones:

1. **Consolidar navegación** en `src/routes/_authenticated.tsx` (el `CommandRail`):
  - Renombrar `/dashboard` → "Inicio" y `/dashboard/map` → "Mapa operacional" para eliminar la sensación de duplicado.
  - Colapsar los grupos `ANALYSIS` y `GOVERNANCE` por defecto; expandirlos si hay ruta activa.
  - Agrupar `Marketplace Deals` + `Marketplace Capas` + `commodity-lots` bajo un solo grupo **MARKETPLACE**.
  - Añadir separador visual antes de **ACCOUNT**.
2. **Eliminar rutas stub** (`palmeras`, `sat3d`, `lv5-page5`, `command-center`, `franco`) y reemplazarlas por 301 en un solo helper `redirects.ts` — dejan de aparecer como archivos.
3. **Marcar rutas "en construcción"** con un placeholder consistente (no un 404 ni una página en blanco) cuando el módulo no está listo. Un componente `<ComingSoon module="…"/>` con enlace de vuelta a Inicio.
4. **Auditar cada entrada del sidebar** contra su ruta destino: si la ruta muestra datos vacíos o crashea, se marca "beta" o se oculta según el rol.

Entregable: sidebar más corto, sin duplicados, sin rutas que redirigen en silencio, y todo ítem del menú abre algo real.

---

## Fase 2 — Selector de proyecto que realmente cambia el contexto

**Problema hoy:** `useProjects` mantiene `activeId` en `localStorage` y expone `setActive`, pero muchas rutas del dashboard (deals, targets, catastro, finance, drilling, etc.) consultan por `activeId` sin invalidar sus queries cuando cambia, por lo que la UI se queda con datos del proyecto anterior.

Acciones:

1. **Mover el estado activo a un contexto React** (`ActiveProjectProvider`) además de localStorage, para que cualquier `useQuery` con `queryKey: ['x', activeProjectId]` re-consulte automáticamente al cambiar.
2. **Poner el selector visible siempre** en el `TopBar` (arriba a la izquierda), con el nombre y código del proyecto activo y un dropdown para cambiar. Hoy vive solo dentro de `/dashboard/projects`.
3. **Invalidar TanStack Query en el cambio**: al llamar `setActive`, ejecutar `queryClient.invalidateQueries({ predicate: q => q.queryKey.includes(prevProjectId) })`.
4. **Rutas globales sin proyecto** (marketplace, documentos, admin, boletín nacional) se marcan como "cross-project" y el selector muestra "— todos los proyectos —" en esas pantallas.
5. **Empty state claro** cuando no hay proyecto activo: en cada módulo project-scoped, un cartel "Elegí un proyecto en la barra superior" con CTA al selector.

Entregable: cambiar de proyecto en el TopBar refresca inmediatamente los datos de Catastro, Sondajes, Targets, Finance y Reportes.

---

## Fase 3 — Documentos que se abren, editan y guardan

**Problema hoy:** el usuario reporta que "no puedo ver los documentos". El editor en `/dashboard/documentos/$templateId` depende de que la plantilla exista en `TEMPLATE_BY_ID` y de que la tabla `document_drafts` esté persistiendo. Falla si el `templateId` de la URL no matchea, o si el guardado en Supabase da error silencioso.

Acciones:

1. **Reparar el listado** `/dashboard/documentos`: mostrar las 10 plantillas con estado ("borrador guardado", "firmado", "sin usar") consultando `document_drafts` + `document_sign_requests` filtrado por `user_id`.
2. **Corregir el editor**: verificar que al hacer click abre `DocumentEditor` sin blanquear la pantalla (loguear el error real si `TEMPLATE_BY_ID[templateId]` es `undefined`), y que autoguarda en `document_drafts` cada N segundos con feedback visual ("Guardado ✓").
3. **Feedback de firma**: en `/firmar/$token`, mostrar claramente estados "pendiente / firmado / expirado / anulado" y un botón "Descargar PDF" cuando corresponde.
4. **Prefill desde lote**: verificar que `/dashboard/documentos/data-sheet?lot=<id>` carga los datos del lote real del usuario, no un mock.

Entregable: los 10 documentos abren, guardan solos, se pueden compartir para firma y descargar como PDF.

---

## Fase 4 — Datos reales del usuario, demo aparte

**Problema hoy:** proyectos demo (Palmeras, Franco, Los Verdes) y listings/lotes de ejemplo se mezclan con lo que el usuario crea, dando la sensación de que "nada es real".

Acciones:

1. **Nueva sección "Ejemplos"** en el sidebar (grupo aparte al final), donde vive Palmeras, Franco y LV5 como demos de solo lectura. Se marca con badge "DEMO".
2. **Filtrar el resto de la app por `user_id**` de forma estricta:
  - `/dashboard/projects` → solo proyectos donde el usuario es miembro (no demo).
  - `/dashboard/commodity-lots` y `/dashboard/listings` → solo lo creado por el usuario, con CTA claro "Crear mi primer lote/listing".
  - `/dashboard/marketplace` → lotes/listings publicados (curados), diferenciados visualmente de los propios.
3. **Empty states útiles**: en vez de mostrar demo cuando el usuario no tiene datos, mostrar cartel "Aún no tenés X. Crear ahora →" y un link a "Ver ejemplos" que lleva a la sección demo.
4. **Seguimiento de proyecto real**: al crear un proyecto nuevo, redirigir a `/dashboard/project-report` con el `activeProjectId` recién creado y hooks que lean sus datos reales (no los de Palmeras).

Entregable: el usuario ve solo sus datos, con demos claramente separadas para explorar.

---

## Orden de ejecución sugerido

Fase 1 (rutas) → Fase 2 (selector) → Fase 3 (documentos) → Fase 4 (datos reales).

Cada fase es una PR autocontenida, se puede probar y publicar antes de pasar a la siguiente. Estimado: 1 fase por sesión de trabajo.

## Detalles técnicos

- **Fase 1**: solo edita `src/routes/_authenticated.tsx`, borra 4-5 archivos stub, crea `src/components/ops/ComingSoon.tsx`.
- **Fase 2**: nuevo `src/contexts/ActiveProjectContext.tsx`, refactor de `useProjects` para publicar cambios via contexto, hook `useActiveProjectId()`, mover selector a `TopBar.tsx`.
- **Fase 3**: revisar `DocumentEditor.tsx` (error boundary + autosave), route loader de `documentos.tsx` (join con `document_drafts`), sin cambios de schema.
- **Fase 4**: flag `is_demo` en `projects` (migración pequeña), filtros en `useProjects` y en los loaders de listings/lots. No borra datos existentes.

## Decisión pendiente

¿Empezamos por Fase 1 (más visible, rápido) o preferís que arranquemos por Fase 3 (documentos) porque es lo que más te bloquea hoy?  FASE # para enviar un NDA hoy 