# Roadmap

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
- [ ] Renovar secreto EARTHDATA_TOKEN con la llave nueva del usuario (formulario seguro).
