# Roadmap

## Investment OS · Fase 2
- [ ] Verificar contratos firmados y posiciones pobladas con registros reales — la cuenta autenticada actual no tiene posiciones ni tickets; no crear inversiones de prueba.
- [ ] Verificar fallos internos de lectura — los servicios actuales convierten algunos errores en resultados vacíos; requiere autorización para modificar servicios, fuera de este patch frontend.
- [x] Rediseñar tarjetas compartidas del catálogo y rondas con procedencia explícita, filtros y enlaces existentes.
- [x] Rediseñar posiciones, órdenes, documentos y KYC en la cartola sin modificar servicios ni economía.
- [x] Desglosar colocación externa declarada y compromisos del sistema; verificar pruebas y pantallas 320/390/1440 sin publicar.

- [x] Colocar imagen satelital real georreferenciada sobre el relieve CAD de Cholqui, con atribución y controles topografía/satélite; verificada en perspectiva, planta y móvil, sin alterar cotas ni backend.

- [x] Cholqui: construir relieve interpolado de las curvas CAD declaradas en el visor compartido de Los Verdes, sin modificar backend ni extrapolar fuera de cobertura.
- [x] Verificar relieve, capas y controles 3D de Cholqui con pruebas y navegador (9 pruebas; sesión real; perspectiva, planta, modo de evidencia primaria y móvil sin desbordamiento).

- [x] Actualizar el informe técnico compartido con membrete Geocapitals, índice paginado, control documental, procedencia y revisión NI 43-101/JORC.
- [x] Verificar descargas NI 43-101/JORC de Nahuelbuta y Cholqui; revisar visualmente todas las páginas y eliminar la página de guía casi vacía.
- [ ] Verificar exportación Los Verdes — bloqueada durante la comprobación por la carga de antecedentes del reporte; no generar resultados de sustitución.

- [x] Incorporar las 190 muestras reales de Los Verdes a la fuente pública y al mapa.
- [x] Mejorar la ficha pública `/live/losverdes` con resumen verificable y enlace copiable.
- [x] Estandarizar el PDF Los Verdes con marca, QR, versión y tabla de muestreo.
- [x] Verificar escritorio, móvil y descarga del PDF.
- [x] Verificar `/live/cholqui` en vista previa y dominio público: 7 análisis, 3 informes y mapa real.
- [x] Corregir la página casi vacía del PDF Cholqui y renovar la caché pública.
- [ ] Consolidar rutas, fichas, fuentes y navegación de proyectos según el plan aprobado.
  - [x] Definir Cholqui y Los Verdes como nombres y enlaces canónicos.
  - [x] Mantener Franco y Tilama únicamente como alias con redirección permanente.
  - [x] Consolidar el índice público en tres proyectos sin duplicar Los Verdes–Tilama.
  - [x] Añadir registro único y pruebas automáticas para enlaces públicos.
  - [x] Migrar los antecedentes de Cholqui a las tablas canónicas (código `CHOLQUI`, 7 ensayes certificados, coordenadas PSAD'56 declaradas, concesiones `CHQ-CONC-*`).
  - [x] Unificar la plataforma en un solo terminal de inversión con pestañas (mapa, tesis, simulador, data room).
  - [ ] Unificar el expediente técnico y el generador PDF de ambos proyectos.
  - [ ] Incorporar estados editoriales, trazabilidad y control previo a publicación.
- [x] Portada simplificada a dos caminos (inversionistas / catastro).
- [x] Fichas públicas /live/* redirigen al terminal único /terminal/$slug.
- [x] Reducir el menú interno del panel a 3 espacios (Catastro · Trade · Capital) y fusionar pantallas duplicadas.
- [x] Unificar visores 2D/3D restantes (visor-3d, geology3d, 3d-pro) en el terminal.

- [x] Módulo live Nahuelbuta REE (paños Arcillas 1-34, satélite, informes) en /terminal/nahuelbuta
- [ ] Nahuelbuta: términos de inversión reales (valorización, ticket, instrumento) — espera al usuario
- [x] Cholqui: mineralogía NASA EMIT L2B (7 y 12 ene 2023) ortorrectificada con GLT oficial → 5 capas MODELADO en visor 2D (scripts/process_emit_l2bmin.py).
- [x] Secreto EARTHDATA_TOKEN renovado.
- [x] Los Verdes: mineralogía EMIT L2B (18 y 22 mar 2023) en visor 2D.

- [x] Validación cruzada ensayes × EMIT en informe geocientífico de Cholqui
- [ ] Siguiente capa satelital (Sentinel-1 SAR lineamientos o ASTER sílice) — espera elección del usuario
- [x] Cholqui: ASTER TIR sílice + Sentinel-1 lineamientos (scripts/process_aster_s1.py)

- [ ] Flujo de inversiones: H1 base de datos ✓ · H2 onboarding ✓ · H3 configurador ✓ (Cholqui y Los Verdes: 15.000 acciones a USD 100, meta USD 1.500.000, mínimo USD 25.000; ambas rondas cerradas) · H4 contrato con QR y página pública de verificación · H5 QA de flujo completo en navegador · Abrir rondas cuando el usuario lo decida

## Migración total a GeoScene3D (visores de proyecto)
- [x] Fase 0: visitantes públicos ya no generan errores 401 al abrir Cholqui (capa satelital privada solo con sesión).
- [x] Fase 1: GeoScene3D acepta proyecto/centro explícito y capas GeoJSON de catastro, pedimentos e hitos con procedencia.
- [x] Fase 2: relieve CAD de Cholqui como fuente de terreno en GeoScene3D (máscara de cobertura, sin extrapolar).
- [x] Fase 3 global: terminal y workspace usan una sola instancia GeoScene3D con cámara Planta/Perspectiva y capas persistentes para Cholqui, Los Verdes, Nahuelbuta, Palmeras y otros proyectos; conservar procedencia sin modificar backend.
- [x] Verificar fase 3 global: cuatro terminales públicos, acceso Cholqui con sesión real, relieve CAD con imagen real, persistencia de cámara/capas y vista móvil sin desbordamiento. Ensayes, EMIT y radar conservados; capas espectrales densas disponibles a pedido.

## Visor 3D · herramientas geológicas
- [x] Apoyar catastro, anomalías y escenas procesadas sobre el relieve real (DEM Los Verdes / CAD Cholqui) en Perspectiva.
- [x] Discos estructurales orientados por rumbo/manteo medidos (Cholqui), con pruebas.
- [x] Corte A–A′ con perfil y manteo aparente, estándar en el visor de todos los proyectos.
- [x] Sondajes por mínima curvatura (sin datos cargados aún para verlos).
- [ ] Red estereográfica de rumbos y manteos.
- [ ] Conector OMF — espera archivo real de software minero.
