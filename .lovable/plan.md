

# Plan: Perfil del Titular en Catastro + vinculación con Boletín y PJUD

Hoy en `/dashboard/catastro` cada concesión muestra solo `holder` como texto plano. Vamos a convertirlo en un **perfil 360° del titular** con datos legales, archivos y enlaces vivos a las publicaciones del Boletín Minero y causas en PJUD que ya estamos sincronizando.

---

## 1. Modelo de datos

### 1.A — Tabla nueva `concession_holders` (ficha por titular)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid pk | |
| `project_id` | uuid | RLS por proyecto |
| `name` | text | razón social / persona |
| `rut` | text | normalizado sin puntos |
| `holder_type` | text | `persona` · `sociedad` · `comunidad` |
| `legal_repr_name` | text | representante legal |
| `legal_repr_rut` | text | |
| `address`, `commune`, `region` | text | domicilio |
| `email`, `phone`, `website` | text | contacto |
| `economic_activity` | text | giro |
| `incorporation_date` | date | constitución |
| `notes` | text | |
| `created_by`, `created_at`, `updated_at` | | |

Único `(project_id, rut)`.

### 1.B — Extender `mining_concessions`
Agregar `holder_id uuid references concession_holders(id)` (nullable; mantenemos `holder` text como fallback). Trigger backfill: si una concesión tiene `holder` y existe ficha con ese nombre/RUT en el proyecto, vincula.

### 1.C — Tabla nueva `holder_files` (data room del titular)
- `id`, `holder_id`, `project_id`
- `file_path` (storage), `file_name`, `file_type` (`escritura | poder | rut | dicom | balance | otros`)
- `description`, `uploaded_by`, `uploaded_at`, `size_bytes`

Bucket privado `holder-files` con RLS: solo miembros del proyecto.

### 1.D — Tabla nueva `holder_links` (vínculos manuales/auto)
Une un titular con publicaciones externas ya en BD:
- `id`, `holder_id`, `project_id`
- `link_type`: `bulletin | court_case | external_url`
- `bulletin_id` (fk `mining_bulletins`, nullable)
- `case_id` (fk `mining_court_cases`, nullable)
- `external_url`, `label`, `notes`
- `linked_by`, `linked_at`, `auto_matched` (boolean)

---

## 2. Auto-matching con datos ya sincronizados

Function SQL `match_holder_publications(holder_id)`:
1. Busca en `mining_bulletins` por `titular_rut` exacto o `titular_nombre` ILIKE.
2. Busca en `mining_court_cases` por `parties` ILIKE / RUT.
3. Inserta resultados nuevos en `holder_links` con `auto_matched=true`.

Se ejecuta:
- Al crear/editar un holder (trigger AFTER INSERT/UPDATE).
- Al final de `sync-boletin-minero` y `sync-pjud` (cada nuevo registro busca holders coincidentes en todos los proyectos).
- Bajo demanda desde el UI (botón "Re-escanear").

---

## 3. UI — Catastro extendido

### 3.A — Tab nueva "Titulares" en `/dashboard/catastro`
Lista de fichas con: nombre, RUT, # concesiones, # publicaciones boletín, # causas PJUD, # archivos. Búsqueda por nombre/RUT. Botón "Nueva ficha".

### 3.B — Drawer/route `/dashboard/catastro/holders/$id` — perfil 360°
Layout densely empaquetado tipo Command Platform:

```text
┌─ HOLDER · MINERA EXAMPLE SPA ─────── RUT 76.123.456-7 ────────┐
│ Tipo: SOCIEDAD   Constitución: 2018-04-22                      │
│ Repr. legal: Juan Pérez (12.345.678-9)                         │
│ Giro: Explotación de minas │ Región: Valparaíso                │
│ Web: example.cl │ ✉ contacto@example.cl │ ☎ +56 32 ...        │
├─ CONCESIONES (4) ──────────────────────────────────────────────┤
│ ● PLM-001 Vigente   240ha   exp 2027-03-15                     │
│ ● PLM-002 Vigente   180ha   exp 2028-09-01                     │
│ ◐ PLM-003 Trámite   ...                                        │
├─ PUBLICACIONES BOLETÍN (12) ─ auto + manual ───────────────────┤
│ 2026-03-12 Solicitud mensura PLM-005     [→ ver]               │
│ 2026-01-08 Inscripción manifestación     [→ ver]               │
├─ CAUSAS PJUD (2) ──────────────────────────────────────────────┤
│ C-1234-2025 Civil Valparaíso · oposición concesión [→ ver]     │
├─ ARCHIVOS (5) ─────────────────────────────────────────────────┤
│ 📄 Escritura constitución.pdf · 1.2MB · 2024-01           [↓]  │
│ 📄 Poder representante.pdf   · 380KB · 2024-06           [↓]  │
│ [+ subir archivo]                                              │
├─ LINKS EXTERNOS ───────────────────────────────────────────────┤
│ [+] CBR Valparaíso ficha 2018 · BCN proyecto ley · ...         │
└────────────────────────────────────────────────────────────────┘
```

Acciones:
- Editar ficha · Re-escanear publicaciones · Generar **Perfil PDF del titular** (reutiliza `lib/pdf/holder-profile.ts`, ya existe, lo enriquecemos con archivos y vínculos).
- Cada publicación/causa abre drawer lateral con el detalle ya en BD.

### 3.C — Vínculo desde la concesión
En la fila/card de cada concesión en `ConcessionsTab`:
- Si `holder_id` está vinculado: nombre clickeable → abre perfil. Badge `📎 4` (4 archivos), `📰 12` (publicaciones), `⚖ 2` (causas).
- Si no: botón "Vincular titular" (combobox para elegir/crear ficha).

### 3.D — Vínculo desde Boletín y PJUD
En `/dashboard/boletin`, cada bulletin/caso muestra `↳ vinculado a: MINERA EXAMPLE SPA` (link al perfil) cuando hay match. Botón "Vincular a titular" si no.

---

## 4. Componentes nuevos (`src/components/ops/`)

- `<HolderCard holder />` — fila densa con counts
- `<HolderProfile holderId />` — vista 360°
- `<HolderFilesPanel holderId />` — upload/list (Supabase Storage)
- `<HolderLinksPanel holderId />` — publicaciones + causas + externos
- `<LinkHolderCombobox concessionId />` — selector con crear inline
- `<HolderBadges holderId />` — `📎📰⚖` para mostrar en concesión

Hooks: `useHolder(id)`, `useHolders(projectId)`, `useHolderFiles(holderId)`, `useHolderLinks(holderId)`.

---

## 5. Edge function `match-holders` (opcional, fase 2)
POST `{ holder_id }` o `{ project_id }`. Corre el matching SQL y devuelve cuántos vínculos nuevos se crearon. Útil para botón "Re-escanear" sin trigger.

---

## 6. Storage
- Bucket privado `holder-files`, path `{project_id}/{holder_id}/{file_id}-{filename}`.
- RLS: SELECT/INSERT/DELETE sólo miembros del proyecto (managers eliminan).

---

## 7. Migraciones (orden)
1. `concession_holders` + trigger updated_at + RLS
2. `mining_concessions.holder_id` + backfill por nombre/RUT
3. `holder_files` + bucket `holder-files` + RLS storage
4. `holder_links` + función `match_holder_publications()` + triggers en `concession_holders`, `mining_bulletins`, `mining_court_cases`

---

## 8. Resultado

Clic en `MINERA EXAMPLE SPA` desde cualquier concesión abre un dossier completo: identidad legal, todas sus concesiones en el proyecto, publicaciones del Boletín Minero y causas PJUD ya cruzadas automáticamente, archivos legales subidos por el equipo, y exportación PDF para due diligence — todo dentro de Catastro y trazable en `audit_log`.

