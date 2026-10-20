# Investor Deck 2026 · rediseño en preview

## Entrega
- Ruta pública `/inversion/deck?slide=1`, navegación en el menú Inversión & Capital y sección visible **Investor Deck 2026** junto al showcase de inversión de la portada.
- Diez láminas: portada, portafolio, ronda, Cholqui, Los Verdes–Tilama, modelo comercial, primeros 90 días, valorizaciones/horizontes, colateral y riesgos/contacto.
- Flechas, selector por índice, teclado, swipe horizontal, pantalla completa/Escape, URL persistente y versión imprimible `/inversion/deck?print=true`.
- En teléfono, presentación proporcional 16:9 más lectura accesible del contenido completo; controles ≥44 px. Pantallas verificadas a 1440, 390 y 320 px.
- Descarga PDF real de diez páginas desde portada y visor, usando `downloadProjectDoc`, fuentes incrustadas y el renderer institucional existente. Texto vectorial, pleca, membrete, secciones, pie documental y QR con URL pública. No es captura rasterizada del documento.
- Imágenes existentes: hero referencial, satélite Cholqui y Los Verdes, satélite Hualañé. Imágenes ocupan 44% del lienzo de las láminas de contenido; portada a sangre completa. No se afirma que el hero sea fotografía de una mina real. Los deslindes comerciales de Hualañé no sustituyen el plano inscrito.

## Fuente y discrepancias sin modificar economía
La fuente es la transcripción íntegra proporcionada por el usuario del **dossier comercial octubre 2026**, no una nueva verificación de datos operativos. Presentación y PDF comparten el mismo modelo documental y etiquetas de procedencia. 47%/65% significan colocación **declarada**, nunca recaudo o posiciones liquidada. Colateral es mutuo separado de la ronda accionaria. Valorizaciones son referenciales, precios inmobiliarios son lista, la base de venta es pacto y los horizontes/salidas no son garantías.

Discrepancias observadas que se mantienen sin reconciliación:
- `src/features/franco/data/cholqui.ts`: ronda local USD 1.000.000; dossier USD 1.500.000.
- `src/lib/investor/fichas.ts`: mínimo de Los Verdes USD 50.000; dossier USD 15.000.
- Los Verdes: portada Cu, ficha Cu–Mo; ambas descripciones se conservan con la atribución «según ficha».
- Referencia ENAMI Circular N°27 julio 2026 citada documentalmente; no se declara vigencia verificada.
No se alteraron estas fuentes, rondas, SPVs, base de datos, KYC, auth, RPCs, tasas ni service worker.

## Archivos
- Marketing: `MarketingLanding.tsx`, navegación canónica `components/shell/AppShell.tsx`.
- Presentación: `features/marketing/deck/{deck2026.ts,DeckSlide.tsx,DeckDownload.tsx,InvestorDeckEntry.tsx}`; ruta `routes/inversion.deck.tsx`.
- Estilos: master de presentación y print en `src/styles.css`.
- PDF: extensión opcional `visualSlides` en `lib/pdf/model.ts`, rama visual en `templates/investorDeck.ts`, layout `templates/visualInvestorSlides.ts`; clasificación documental opcional en `brand/institutional.ts`, preservando el valor privado por defecto de los demás documentos.
- Reglas de arquitectura actualizadas en `AGENTS.md`; fuente documental registrada en memoria.

## Pruebas realizadas
- 13 pruebas Vitest: seis del dossier/navegación, cinco de arquitectura PDF y dos de narrativa; todas aprobadas.
- Prueba pública conservada: `python3 tests/marketing/investor_deck_browser.py`; CTA desde portada, diez láminas, índice/teclado, imágenes completas, 1440/390/320 sin desbordamiento y descarga `%PDF`, aprobada.
- Playwright adicional: pantalla completa/Escape, swipe, recarga conservando lámina, versión imprimible de diez páginas, sin errores de ejecución del deck.
- PDF descargado real: `Geocapitals_INVESTOR_2026_Investor_Deck_2026.10.pdf`, aproximadamente 1,7 MB, diez páginas. Renderizadas todas; revisión visual en conjunto y páginas densas (colateral, roadmap, portafolio), sin contenido cortado.
- Build y comprobación automática de tipos: últimos registros **build OK**.
- No se publicó ni desplegó. No se enviaron correos ni documentos a terceros.

## Límites
No se inventó fotografía original, coordenadas ni evidencia. No se verificaron disponibilidad de parcelas, capacidad productiva, tasaciones, Circular ENAMI vigente ni cifras financieras del titular. Las diferencias live/documentales permanecen explícitas; su eventual normalización es otra tarea autorizada, no parte de este rediseño.
