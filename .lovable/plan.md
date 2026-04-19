
The pasted instructions reference a different project ("TrackMin": 1,052 files, `src/cadastre/`, `src/components/trackmin/`, `useSernageominQuery`, `ingemmetDirect`, `BlockModelLayer`, `FaenaDashboard`, `AppRoutes.tsx`, `src/core/`, `src/pages/`).

This project is **Geocapitals/Palmeras** — TanStack Start with file-based routing in `src/routes/`, ~150 files. None of those 17 files in Paso 1 exist. None of the 198 files in `trackmin/` exist. None of the 132 hooks listed exist. There is no `AppRoutes.tsx`, no `src/pages/`, no `src/core/`, no `useSernageominQuery`.

Applying that 10-step plan literally would delete working code and break the project. Instead I propose what the underlying request actually asks for: **"ver estatus del proyecto y verificar que todo funcione"**.

## Plan: Auditoría real de Geocapitals + verificación

### A. Diagnóstico técnico (read-only)
1. Compilación TypeScript (`tsc --noEmit`) → 0 errores esperados tras Fases 1–7.
2. Lint Supabase (`supabase--linter`) → warnings de RLS / índices.
3. Inventario real de:
   - Rutas en `src/routes/` (vs sidebar de `_authenticated.tsx`)
   - Hooks en `src/hooks/`
   - Componentes en `src/components/`
   - Tablas DB con RLS (ya tenemos 24+ tablas confirmadas)
4. Snapshot de errores de runtime + console del preview actual (`/dashboard/catastro`).

### B. Limpieza segura aplicada SOLO a este codebase
- Detectar y eliminar imports no usados que hayan quedado tras Fases 5/6/7 (auth.tsx hero, targetsLayer, geoIntelInspector, monthly-report).
- Verificar que `routeTree.gen.ts` está sincronizado con las rutas reales (no editarlo a mano).
- Confirmar que `useProjectRole.ts` lista `hse` y `reports` correctamente.
- Confirmar que las nuevas capas de mapa (`sernageominLayers`, `satelliteLayers`, `targetsLayer`) están enchufadas en `LayerOpacityPanel` y `ProjectMap`.

### C. Entregable: `STATUS.md` en raíz
Documento real con:
1. **Fases implementadas** (1: QA/QC + roles + aprobación + KPIs · 2: Targets · 3: Inventario · 4: Finance · 5: Reports PDF · 6: HSE · 7: Capas geocientíficas reales)
2. **Inventario rutas** — lista actual de `_authenticated.dashboard.*.tsx`
3. **DB**: tablas + RLS + funciones SECURITY DEFINER existentes
4. **Capas de mapa**: SERNAGEOMIN, Sentinel-2, Copernicus DEM, targets, AOI, sondajes, muestras, drones
5. **Flujos verificados** vs **pendientes de QA manual**
6. **Próximos pasos sugeridos** (notificaciones email para permisos por vencer, storage bucket para documentos HSE, datalineage)

### Diagrama (estado real)

```text
src/
├── routes/                 (~25 archivos, file-based TanStack)
│   ├── auth.tsx            (rediseñado Fase auth)
│   ├── _authenticated.tsx  (sidebar + guard)
│   └── _authenticated.dashboard.*.tsx (módulos)
├── components/
│   ├── map/                (capas + inspector — Fase 7)
│   ├── drilling/, sampling/, geophysics/, team/, drones consolidados
│   └── ui/                 (shadcn)
├── hooks/                  (~25 hooks — sin duplicación detectada)
├── lib/pdf/                (Fase 5: monthly-report + ni43101)
└── integrations/supabase/  (auto-generado)
```

### Fuera de alcance (NO se hará)
- Refactor TrackMin de 10 pasos — los archivos no existen aquí.
- Mover/renombrar carpetas que ya están organizadas (`map/`, `drilling/`, `sampling/`).
- Borrar nada sin verificar primero importadores.

### Después de aprobar
Ejecuto A → B → C en una sola pasada y entrego `STATUS.md` + lista breve de hallazgos. Si encuentro errores reales (TS, RLS, runtime), los reporto con propuesta de fix (sin aplicar todavía si son destructivos).
