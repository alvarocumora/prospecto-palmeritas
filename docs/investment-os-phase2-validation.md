# Investment OS — Fase 2 · validación

## Cambios de presentación
- `InvestmentCard.tsx`: tarjeta compartida 16:10, imágenes con procedencia explícita, región y etapa, destinos ficha y visor únicamente para slugs canónicos.
- `investmentPresentation.ts` y pruebas: separar colocación externa declarada de compromisos del sistema; sin porcentajes para metas inválidas ni cálculo de acciones libres; solo posiciones `active` y capital agrupado por divisa.
- `PublicListingCard.tsx`, `InvestableProjects.tsx`, `DealFlow.tsx`, `proyectos.tsx`: diseño editorial 1/2/3 columnas, filtros, error/reintento, empty, drawers existentes; simulador/satélite/data room preservados.
- `ProjectCover.tsx`: eliminado generador de coordenadas y topografía ficticias; ilustración neutral explícita.
- `InvestorHome.tsx`: rondas con misma tarjeta; ubicación desde ficha canónica (Cholqui: Melipilla, Región Metropolitana); capital histórico confirmado, no valoración de mercado.
- `InvestorWallet.tsx`, `_authenticated.dashboard.investments.tsx`: posiciones confirmadas, órdenes/timeline existente, documentos, KYC y solicitudes; monedas separadas, loading/error/empty, reintentos y descargas conservadas. PDF existente solo admite USD: se bloquea explícitamente para otras divisas, sin cambiar generador.
- `RoundProgress.tsx`: meta referencial, liquidado del sistema, compromisos del sistema y colocación externa declarada por emisora separados. El contador indica tickets del sistema, no inversionistas externos.
- `PublicListingDrawer.tsx`, `MiningInvestShowcase.tsx`: región canónica, términos referenciales, imagen sin atribución afirmada y simulador preservado.

## Verificación
- 17 tests: presentación de rondas 47%/65%, metas inválidas, monedas y posiciones activas; pending ticket, catálogo canónico y PWA v4.
- Compilación automática del preview: build OK, sin ejecutar build/typecheck manualmente.
- Sesión real del solicitante: /dashboard, /dashboard/investments, wallet con `vista=wallet`; 320/390/1440 sin overflow horizontal, sin pageerror en recorrido principal.
- Catálogo público: búsqueda con resultado vacío y recuperación; drawer de La Cornellana y navegación de Ver proyecto a /terminal/losverdes?tab=tesis.
- Descarga real `GeoCapitals_Cartola_2026-10-19.pdf` desde la cartola.
- Fallo de red inducido en server functions: muestra error de posiciones, PDF deshabilitado; reintento recupera resultados reales.
- Service worker, manifest, bottom nav, servicios de inversión, datos, RPC, RLS, triggers y motores geoespaciales no modificados. No publicación.

## Pendientes / límites
- La cuenta actual no tiene posiciones ni tickets: no se pudo probar descarga de contrato firmado ni certificado con una orden/posición real; no se fabricaron inversiones.
- getMyWallet/getPublicListings/getPublicRounds actuales pueden convertir algunos errores internos de lectura en resultados vacíos o fallbacks. El frontend maneja errores de transporte, pero no puede detectar un error que el servicio oculta. No se modificaron interfaces ni server functions.
- La fecha de consulta de listados no es fecha de validación de evidencia. getPublicRounds no entrega fecha de declaración de la emisora: no se inventó.
- Procedencia de imágenes de archivo pendiente de confirmación; se etiquetan como por verificar, no satélite real.
- Evolución temporal, valor bursátil y retornos no se incorporan por falta de series/datos verificados.
