## Objetivo
Endurecer los 4 flujos críticos que determinan la conversión inversor → operación: **Auth**, **Dashboard**, **Ficha de Proyecto** y **Simulación de Inversión**. Sin tocar lógica de negocio existente más allá de lo necesario para conectarla a UI real.

---

## 1. Auth — reducir fricción y errores silenciosos

**Problemas detectados hoy:**
- `signup` con `emailRedirectTo` a `/dashboard` pero sin manejar el callback de confirmación → usuarios caen en `/auth` confundidos.
- No hay validación de fortaleza de password en cliente (HIBP solo server-side).
- `intent=investor` solo cambia copy; no se propaga a `onboarding_status` para saltar pasos.
- `/reset-password` existe pero no maneja el caso `type=recovery` explícito.
- Errores Supabase se muestran tal cual ("Invalid login credentials") sin traducción ES.

**Cambios:**
- Mapa de errores ES en `auth.tsx` (credenciales inválidas, email no confirmado, rate limit).
- Indicador visual de fortaleza de contraseña + checklist (8+, mayúscula, número).
- Propagar `intent` a metadata del user y leerlo en `OnboardingWizard` para preseleccionar `account_type`.
- Reforzar `/reset-password`: detectar `type=recovery` en hash, manejar token expirado.
- Botón "Reenviar email de confirmación" cuando el login falla por `email_not_confirmed`.
- Google OAuth como segundo método (botón en formulario).

---

## 2. Dashboard — KPIs reales + estado vacío útil

**Problemas:**
- `RoleSegmentedPanel` carga aunque no haya datos → cards vacías sin CTA.
- `useExecutiveKpis` no diferencia "loading" de "0 datos reales".
- No hay vista de "último estado" / actividad reciente por rol.
- Falta breadcrumb de progreso del onboarding ("Te faltan 2 pasos").

**Cambios:**
- Empty-states por card con CTA específico (ej. owner sin concesiones → "Importar desde catastro").
- Banner persistente de onboarding incompleto con % de progreso (lee `useOnboardingStatus`).
- Feed unificado de actividad reciente (últimos 10 eventos: NDA firmado, alerta catastro, settlement, anomalía).
- Skeleton loaders consistentes (hoy hay mezcla de spinners y nada).
- Quick-actions sticky superiores por rol (investor: "Ver deal flow" + "Mis inversiones"; owner: "Nuevo proyecto" + "Publicar deal"; team: "Aprobar KYC").

---

## 3. Ficha de Proyecto — vista pública compartible + privada técnica

**Problemas:**
- `PublicListingDrawer` (drawer lateral) limita la información mostrada y no es enlazable directamente como URL para mandar a un inversor.
- No hay ruta canónica `/proyectos/$id` SSR-friendly con OG image.
- Métricas técnicas (drilling meters, samples, anomalías) no se muestran en la ficha pública.

**Cambios:**
- Nueva ruta `/proyectos/$listingId` con `head()` dinámico (OG title/description/image desde `property_listings`).
- Layout 2 columnas: izq = mapa + galería; der = ficha (modalidad, ticket, commodity, etapa, ubicación, qualified person, documentos públicos).
- Sección "Datos verificados" con badges (NI 43-101, QP firmado, satellite anomalies, drilling), cada uno con tooltip de fuente.
- CTA principal: "Solicitar data room" → si no auth, redirige a `/auth?intent=investor&listing={id}`; si auth, abre modal de NDA.
- Sección "Comparables" si existen en `deal_comparables`.
- El drawer actual se mantiene para vista rápida desde `/inversionistas`, pero con link "Ver ficha completa".

---

## 4. Simulación de Inversión — calculadora previa al NDA

**Estado actual:** no existe. Inversor ve ticket mínimo pero no puede modelar retorno.

**Cambios:**
- Componente `InvestmentSimulator` embebido en ficha pública del proyecto.
- Inputs: monto a invertir (slider entre ticket mínimo y máximo configurado), horizonte (años), escenario (conservador/base/optimista).
- Cálculo con `economic_scenarios` del proyecto si existe; fallback a parámetros del listing (TIR estimada, múltiplo, royalty %).
- Outputs: retorno estimado, múltiplo, breakdown anual (tabla + sparkline), sensibilidad al precio del commodity (`commodity_prices`).
- Disclaimer legal explícito ("simulación referencial, no constituye oferta").
- Botón "Guardar simulación y solicitar acceso" → persiste en `property_deal_inquiries` con el monto simulado para que el equipo Geocapitals vea el interés cuantificado.
- Server fn `simulateInvestment` para cálculos sensibles (no exponer fórmulas en cliente).

---

## Detalles técnicos

**Archivos nuevos:**
- `src/routes/proyectos.$listingId.tsx` — ficha pública SSR.
- `src/features/listings/ProjectSheet.tsx` — layout ficha.
- `src/features/listings/InvestmentSimulator.tsx` — calculadora.
- `src/lib/simulator.functions.ts` — `simulateInvestment` (server fn pública con rate-limit por IP).
- `src/lib/auth-errors.ts` — diccionario ES de errores Supabase.

**Archivos modificados:**
- `src/routes/auth.tsx` — UX errores, fortaleza password, Google, reenvío confirmación.
- `src/routes/reset-password.tsx` — manejo `type=recovery`.
- `src/features/dashboard/RoleSegmentedPanel.tsx` — empty-states + feed.
- `src/hooks/useExecutiveKpis.ts` — distinguir loading/empty.
- `src/features/marketing/DealFlow.tsx` / `PublicListingCard.tsx` — añadir link a ficha completa.
- `src/features/onboarding/OnboardingWizard.tsx` — leer intent desde user metadata.

**Backend:**
- Migración: `property_deal_inquiries` añadir columna `simulated_amount_usd numeric` + `simulation_payload jsonb`.
- RPC `get_public_listing_full(listing_id)` — devuelve listing + comparables + scenarios + métricas técnicas agregadas con `TO anon` controlado.
- Sin cambios a RLS de tablas sensibles (técnicas se exponen agregadas, no granulares).

**Sin tocar:**
- Sistema de KYC/admin de inversores (ya implementado).
- Tablas de cadastro, satellite, drilling (solo lectura agregada vía RPC).
- Edge functions existentes.

---

## Orden de implementación
1. Auth (1 jornada) — desbloquea todo lo demás.
2. Ficha pública `/proyectos/$id` + RPC (1.5 jornadas) — necesaria para el simulador.
3. Simulador + inquiry con monto (1 jornada).
4. Dashboard empty-states + feed (1 jornada).

Total estimado: 4–5 jornadas.

¿Avanzo con este alcance o ajustamos prioridades (p.ej. simulador primero, auth después)?
