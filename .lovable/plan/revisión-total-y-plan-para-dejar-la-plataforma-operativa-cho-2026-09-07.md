# Revisión total y plan para dejar la plataforma operativa (Cholqui + Los Verdes/Tilama)

## Lo que encontré (verificado hoy)

**Datos reales en la base**
- 4 proyectos: Las Palmeras (TRK-ALH-001), La Cornellana (LC-001), Prospecto Gianfranco (GF-001), Distrito Cuprífero Los Verdes–Tilama (LV-TIL-001).
- Los Verdes/Tilama sí tiene sustento: 15 concesiones, 190 muestras, 1 vitrina, 1 data room.
- Cholqui (registrado como "Prospecto Gianfranco"): 14 concesiones, **0 muestras, 0 data room**, y su punto en el mapa está en la costa de Valparaíso (−32,43 / −71,07), no en Melipilla como dicen sus antecedentes.
- Todo el contenido de Cholqui (muestreo P1–P3, escenarios de ley, plan minero, flota) vive en un archivo de código, no en la base: por eso no aparece en buscador, mapa nacional, ni en el expediente del proyecto.
- **0 inversionistas registrados, 0 rondas de financiamiento y 0 deals asociados a proyectos**: hoy no existe camino real "inversionista entra → firma → ve data room → registra interés".

**Fragmentación**
- 158 pantallas. Cuatro vistas "live" casi paralelas (`/live/franco`, `/live/losverdes`, `/live/palmeras`, `/live/tilama` que redirige) más `/dashboard/cholqui` y `/dashboard/project-report`, todas resolviendo lo mismo con datos distintos.
- Pantallas sin entrada en el menú: `/terminal` y sus tres sub-pantallas, `/satelital`, `/empresas`, `/visor-3d`, `/oportunidades`, `/proyectos/ficha/{slug}`.
- Menú con entradas confusas: "Capas GIS" apunta a Marketplace; "Cholqui live" aparece dentro de Reportes.

---

## Plan en 5 fases

### Fase 1 — Cholqui como proyecto real en la base (no en código)
- Migrar los antecedentes de Cholqui a las tablas canónicas: concesiones, muestras P1–P3 con certificados, ficha técnica, escenarios económicos y plan minero.
- Corregir el nombre a "Proyecto Cholqui" y su ubicación real en Melipilla, Región Metropolitana.
- La vista live y el PDF pasan a leer de la base: un solo dato, tres salidas (pantalla, ficha, PDF).
- Marcar cada cifra como **comprobada / muestreo / interpretación / escenario**, manteniendo los avisos de que no hay recursos ni reservas certificados.

### Fase 2 — Un solo visor live paramétrico
- Una sola pantalla `/live/{proyecto}` alimentada por la base; Cholqui, Los Verdes/Tilama y Palmeras dejan de ser páginas separadas.
- Las direcciones actuales siguen funcionando (redirigen), para no romper enlaces ya enviados a inversionistas.
- Control de publicación por proyecto: privado / enlace con clave / público.

### Fase 3 — Recorrido del inversionista de punta a punta
- Alta de inversionista con perfil y verificación básica.
- Flujo: interés → NDA firmado → data room abierto → oferta → seguimiento, con el estado visible para inversionista y para el dueño.
- Data room de Cholqui y Los Verdes cargado con la taxonomía existente (legal, técnico, laboratorio, económico) y registro de quién vio qué.
- Panel del dueño: "quién miró el informe geológico esta semana".

### Fase 4 — Los Verdes/Tilama al mismo estándar
- Consolidar la lógica dispersa de Los Verdes en la misma fuente única.
- Completar ficha, valorización y expediente con los 190 muestreos ya cargados.
- Informe Pre-43-101 y PDF de inversión con la misma marca y verificación por código QR.

### Fase 5 — Limpieza y coherencia
- Retirar o redirigir las pantallas sin entrada de menú.
- Ordenar el menú (GIS bajo Catastro, Cholqui fuera de Reportes, live junto a Proyectos).
- Unificar la estética Institutional Modernist en las pantallas que siguen oscuras.
- Repaso final de permisos por rol: inversionista ve solo lo publicado.

---

## Detalles técnicos

- Migración Supabase que inserta Cholqui en `projects`, `mining_concessions`, `sampling_results`, `project_technical_brief`, `economic_scenarios` y `project_fundraises`, con GRANTs y RLS por proyecto; `src/features/franco/data/cholqui.ts` queda solo como semilla de la migración y luego se retira de la ruta de lectura.
- `/live/$slug` nueva ruta paramétrica sobre `projectFacts.functions.ts` + `livemap-public.functions.ts`; `live.franco`, `live.losverdes`, `live.palmeras` pasan a `beforeLoad → redirect`.
- Deal flow: reutilizar `dealFlow.functions.ts`, `data_rooms`/`data_room_access_grants`/`data_room_access_logs` y el patrón de enlaces por token de `trade_access_links`.
- Todas las funciones nuevas pasan por `roleMiddleware.ts`; nada de consultas sin verificación de rol.
- Sin dependencias nuevas.

## Orden de entrega
Fase 1 → 2 → 3 (Cholqui operativo para inversionistas) → 4 (Los Verdes) → 5 (limpieza).
