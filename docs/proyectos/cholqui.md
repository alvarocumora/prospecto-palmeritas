# Proyecto Cholqui (ex "Distrito Franco / Gianfranco")

Ficha de carga para el módulo de proyectos. Datos extraídos de los documentos
del proyecto (Prospecto Cholqui.docx, Proyecto Cholqui FINAL.pptx). El slug y
las rutas internas siguen siendo `franco` (p. ej. `/live/franco`) para no romper
enlaces; todo lo visible dice **Proyecto Cholqui**.

> Estado: **exploración avanzada** — muestreo de superficie a laboratorio
> certificado, con una **faena vecina en producción** (Mina Las Minitas) sobre
> la misma estructura geológica. Sin sondaje propio aún.

---

## 1. Proyecto

| Campo       | Valor                                                                                                                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Código      | `CHOLQUI`                                                                                                                                                                                   |
| Nombre      | `Proyecto Cholqui`                                                                                                                                                                          |
| Commodity   | `Cu-Au-Ag`                                                                                                                                                                                  |
| Región      | `Melipilla · Región Metropolitana`                                                                                                                                                          |
| Titular     | `Volcania Minerals SpA`                                                                                                                                                                     |
| Descripción | Yacimiento de cobre, oro y plata con buenas leyes. ~5.000 ha (20 pedimentos + 15 pertenencias). Cholqui, Cajón de Panamá, Melipilla, RM — a 30 min de la ruta 78. Sin comunidades cercanas. |

**CRS (`crs_epsg`):** UTM **PSAD'56 Zona 19H** (EPSG 24879) — datum de los planos y
muestreos. Reproyectar a WGS84 para el polígono.

---

## 2. Catastro · concesión

| Campo               | Valor                                                                                                                                                                                                                                        |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Expediente / código | `CHOLQUI` (20 pedimentos + 15 pertenencias — cargar por grupo o individual)                                                                                                                                                                  |
| Nombre              | `Cholqui`                                                                                                                                                                                                                                    |
| Tipo                | `Mina / pertenencia`                                                                                                                                                                                                                         |
| Estado              | `Vigente`                                                                                                                                                                                                                                    |
| Superficie (ha)     | `5000`                                                                                                                                                                                                                                       |
| Titular             | `Volcania Minerals SpA`                                                                                                                                                                                                                      |
| Región / provincia  | `Región Metropolitana`                                                                                                                                                                                                                       |
| Comuna / depto      | `Melipilla (Cholqui / Cajón de Panamá)`                                                                                                                                                                                                      |
| Notas               | Rodea a la Mina Las Minitas (en producción, ~15.000 t/mes, Sociedad Servicios RG Minerals SpA · RUT 77066786-0, coord. PSAD'56 19H N 6.254.650 / E 311.970). Colinda con pertenencias de Yamana Gold. IGM Cholqui E-73 (3345-7100) 1:50.000. |

**Polígono:** el plano de pertenencias (color verde, rodeando a la mina vecina en
rojo) está en los archivos escaneados. Digitalizar los vértices, reproyectar de
PSAD'56 19H a WGS84 (lng/lat) y pegar como GeoJSON `Polygon`/`MultiPolygon`.

---

## 3. Ficha de datos · procedencia

| Sección   | Dato                       | Valor                                               | Unidad | Procedencia | Fuente                                    |
| --------- | -------------------------- | --------------------------------------------------- | ------ | ----------- | ----------------------------------------- |
| Activo    | Superficie                 | ~5.000                                              | ha     | Declarado   | Dueño (20 pedimentos + 15 pertenencias)   |
| Activo    | Ubicación                  | Cholqui, Melipilla, RM                              | —      | Declarado   | IGM Cholqui E-73                          |
| Legal     | Titular                    | Volcania Minerals SpA                               | —      | A verificar | Acreditación de dominio (carpeta adjunta) |
| Geología  | Litología                  | Fm. Veta Negra (Kvn), Lo Prado (Klp), Horqueta (Jh) | —      | Declarado   | Informe geol. Lema / Arcos                |
| Geología  | Estilo mineralización      | Vetas y mantos Cu / Au-Cu / Cu-Ag                   | —      | Declarado   | Informe geológico                         |
| Cobre     | Ley (muestreo superficie)  | 1,5–2,5 (escenarios)                                | % Cu   | A verificar | 4 puntos a lab certificado                |
| Cobre     | Faena vecina en producción | Las Minitas ~15.000 t/mes                           | t/mes  | Certificado | RG Minerals SpA (operación real)          |
| Económico | Escenarios de flujo        | Ley 1,5% / 2% / 2,5% Cu                             | —      | Declarado   | Planillas del proyecto                    |
| Económico | Vecino estratégico         | Colinda con Yamana Gold                             | —      | Declarado   | Plano de pertenencias                     |

### Caveats

1. Las **leyes de cobre provienen de muestreo de superficie (4 puntos)**, no de
   sondaje ni recurso estimado — van como `A verificar`.
2. La **producción de Las Minitas es del vecino** (RG Minerals SpA), no del
   proyecto; se cita como evidencia de continuidad de la estructura, no como
   producción propia.
3. El **dominio de las pertenencias** debe validarse contra la acreditación
   (carpeta de dominio adjunta) — `A verificar` hasta confirmar.

---

## 4. Levantamiento de capital

Valores referenciales (los definitivos salen de las planillas de flujo y del
acuerdo con el dueño):

| Campo                                  | Valor                                               |
| -------------------------------------- | --------------------------------------------------- |
| Instrumento                            | `Equity / participación` (`equity`) — SpA           |
| Valorización                           | US$ 4–6 M (comparables + flujo a leyes 1,5–2,5% Cu) |
| Monto a levantar / Ticket / % ofrecido | A confirmar con el dueño                            |

**Contacto del proyecto:** Ernesto Egert Errázuriz · egerternesto@gmail.com ·
+56 9 6609 1332.
