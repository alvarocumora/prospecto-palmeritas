# Consolidación web de proyectos GeoCapitals

## Estado verificado

- `/live/cholqui` responde correctamente en el dominio público, con y sin barra final.
- `/live/franco` redirige a `/live/cholqui`.
- La ficha muestra **7 análisis**, **3 informes** y el mapa satelital con los puntos georreferenciados.
- El PDF se descarga sin autenticación, está abierto y contiene 13 páginas A4 sin páginas vacías.
- Se corrigió un salto que producía una página casi vacía y se renovó la caché pública para desplazar versiones antiguas que podían mostrar 404.

## Objetivo

Consolidar la plataforma alrededor de proyectos canónicos, eliminando nombres, fichas, enlaces y fuentes duplicadas sin romper enlaces ya compartidos.

```text
Proyecto canónico
├── Ficha pública /live/{proyecto}
├── Panel privado /dashboard/projects/{proyecto}
├── Mapa y evidencia
├── Data room
├── Valorización y escenarios
└── PDF generado desde los mismos datos
```

## Fase 1 — Rutas y navegación canónicas

- Definir `/live/cholqui` y `/live/losverdes` como únicos enlaces públicos.
- Mantener `/live/franco` y `/live/tilama` solo como redirecciones permanentes para enlaces antiguos.
- Cambiar enlaces internos que aún apunten a “Franco”, “Gianfranco” o “Tilama”.
- Renombrar “Terreno franco” a “Cholqui” y dirigirlo directamente a la vista vigente.
- Incorporar una página índice pública de proyectos con enlaces verificables y estado de cada ficha.
- Añadir comprobación automática de rutas públicas para detectar 404 antes de publicar.

## Fase 2 — Ficha maestra reutilizable

- Crear una estructura visual única para Cholqui, Los Verdes y próximos proyectos.
- Mantener secciones estándar: identidad, ubicación, catastro, muestreo, informes, mapa, riesgos, escenarios, documentos y contacto.
- Reutilizar la misma ficha en vista pública y panel privado, mostrando funciones adicionales solo según rol.
- Tratar “Franco/Gianfranco” como nombre histórico de Cholqui y “Tilama” como sector de Los Verdes, no como proyectos independientes.

## Fase 3 — Fuente única de datos

- Migrar gradualmente los antecedentes de Cholqui desde archivos estáticos a las tablas canónicas ya usadas por proyectos reales.
- Centralizar identificadores, alias, coordenadas, muestras, certificados, escenarios y documentos por código de proyecto.
- Unificar las lecturas hoy separadas de Los Verdes en un único expediente técnico.
- Etiquetar cada dato como certificado, declarado, por verificar, interpretación o escenario.
- Evitar que scripts antiguos mantengan copias manuales de leyes, costos o puntos.

## Fase 4 — Mapas, documentos y PDFs reconciliados

- Generar mapa, panel, ficha pública y PDF desde el mismo expediente maestro.
- Estandarizar portada, QR, versión, control documental, pies, descargos y paginación.
- Evitar tablas partidas, páginas huérfanas o vacías mediante reglas comunes de composición.
- Añadir control automático que compare cantidades de muestras, informes, concesiones y targets entre pantalla y PDF.
- Mantener los PDFs descargables directamente, sin autenticación, cuando la ficha sea pública.

## Fase 5 — Gobierno y publicación

- Definir estados: borrador, revisión técnica, aprobado internamente, publicado y archivado.
- Separar claramente información pública, inversionistas autorizados y equipo GeoCapitals.
- Registrar versión, fecha, responsable, hash y enlace canónico de cada publicación.
- Incorporar una lista de control previa a publicación: enlaces, QR, permisos, mapa, móvil, PDF y ausencia de 404.

## Orden de ejecución

1. Corregir navegación y enlaces históricos.
2. Consolidar las fichas duplicadas de Cholqui/Franco y Los Verdes/Tilama.
3. Crear la ficha maestra compartida.
4. Migrar Cholqui al expediente canónico sin cambiar cifras.
5. Unificar generación de mapas y PDFs.
6. Aplicar estados editoriales y pruebas automáticas de publicación.

## Criterios de aceptación

- Cada proyecto tiene un único nombre comercial, enlace público y ficha privada.
- Todos los enlaces internos apuntan directamente a rutas vigentes.
- Los enlaces históricos redirigen sin mostrar 404.
- Mapa, ficha y PDF muestran exactamente los mismos conteos y cifras.
- No existen páginas PDF vacías, tablas cortadas ni superposiciones en escritorio o móvil.
- Ningún escenario se presenta como recurso, reserva o resultado certificado.
- Una prueba previa a publicación valida rutas, QR, descargas y permisos.
