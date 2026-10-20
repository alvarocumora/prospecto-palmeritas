# GeoCapitals · Auditoría global UI/UX — Landing, Terminal, Investor OS y PWA

## Referencia y alcance
Revisión del repositorio GitHub `alvarocumora/prospecto-palmeritas` y capturas de Lovable facilitadas por el usuario (2026-10-20). Sistema institucional existente: `src/styles.css`, `AppShell`, `PlatformPage`, `BrandButton`, `GeoScene3D` y `ProjectTerminalShell`. **No crear shell ni visor alternativos.**

El proyecto Lovable consultado reportaba `191caedb52f276a448baffaeb5e6980998347f1f`, anterior al `main` revisado `66140cc0a676dbf7a6fc328bf52adc23663cbe33`. Una captura con “Preview is out of date” NO demuestra que las últimas integraciones se estén mostrando. No afirmar QA visual autenticado mientras no se recargue/sincronice preview y se pruebe la ruta.

## Flujo de experiencia de referencia
1. **Landing (`/`)** → elegir inversión minera, colateral, catastro o trade. Mensajes y evidencias sin suponer verificación.
2. **Inversión minera (`/#invertir`, `/proyectos`)** → seleccionar proyecto → terminal público `/terminal/$slug` → mapa/satélite/tesis → simular → auth/KYC/ticket/contrato/seguimiento según rol.
3. **Inversionista (`/dashboard`)** → resumen de posiciones confirmadas → `/dashboard/investments` → wallet/cartola `?vista=wallet` → documentos y estado de operación. Sin inventar saldo o holdings.
4. **Inteligencia (`/catastro/mapa`, `/satelital`, `/terminal`)** → seleccionar fuente y proyecto explícitamente → visores 2D/3D → capas e inspector con procedencia, escala, unidades y limitaciones.
5. **PWA multirol** → launch `/dashboard`, gateway autenticado redirige si falta login; accesos rápidos a portafolio, proyectos y terreno.

## PR UX-01, correcciones puntuales
- INTEL de portada ahora apunta a destinos temáticos (`/satelital` y `/terminal`) en vez de preseleccionar Cholqui o Los Verdes sin consentimiento.
- Menú marketing: targets táctiles de 44 px y etiquetas/foco de teclado.
- Tarjetas de inversión: separar botón “seleccionar proyecto” del enlace independiente “ver ficha y visor”; no anidar un `<a>` dentro de `<button>`.
- “Dos faenas activas” se sustituye por “Dos proyectos mineros”: operación 5–15k t/mes sigue identificada como **declarada por el titular**, no auditada. Franja de rigor expresa trazabilidad y clasificación de evidencia sin implicar certificaciones universales.
- Terminal: retorno explícito a landing, selector por proyecto y tabs con 44 px y etiquetas accesibles, preservando el mismo canvas 2D/3D.
- PWA: identidad multirol `GeoCapitals`, inicio `/dashboard`, accesos a inversión/proyectos/campo; eliminar bloqueo de orientación vertical en vistas de mapas.
- Tests puros de destinos públicos. Sin tocar backend, supabase, permisos, importación de datos o el motor geoespacial.

## Pendientes de evaluación visual y pruebas manuales (sin afirmar completados)
- [ ] Actualizar/sincronizar preview Lovable antes de capturas comparativas.
- [ ] QA móvil 360/390 px + tableta 768 px + escritorio 1440 px: sin overflow horizontal, jerarquía 1 H1, menú visible, CTAs 44 px y contraste AA.
- [ ] Landing: Inicio → `#invertir` → selección proyecto → `/terminal/$slug?tab=mapa` → pestañas `satelital/tesis/simulador/dataroom`.
- [ ] Invitado → autenticación / registro → KYC → ticket pendiente → aprobación → contrato; comprobar estados erróneos y vacíos, sin simulaciones tratadas como liquidadas.
- [ ] Rol inversionista: navegación inferior Inicio/Explorar/Portafolio/Wallet; scroll a cartola mediante `?vista=wallet` y permisos.
- [ ] Verificar home hero Terrain3D en Safari iOS y low-end Android, raster/DEM, 2D fallback, coste de CPU/GPU.
- [ ] Verificar control de 2D/3D, panel Capas, inspector Evidencia, altura canvas y cambios de tab en 390/1440 px; no deformar coordenadas.
- [ ] PWA instalada, autenticación, deep links y orientaciones, servicio SW y cache offline.
- [ ] Auditar lenguaje comercial/legal y actualización de datos de los dos proyectos por titular, equipo jurídico y geólogo competente; no derivar recursos certificados de datos previos.

## Siguiente PR recomendado
UX-02: pruebas E2E móviles de las dos rutas de conversión, componentes de estado de carga/error y capturas visuales reales autorizadas; UX-03: responsive geoscene y toolbar de capas sin crear un segundo motor.
