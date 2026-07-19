# Proyecto Los Toldos — Expediente 19.514

Ficha de carga para el módulo de proyectos de GeoCapitals. Los valores están
mapeados 1:1 a los campos y enums del módulo (`/dashboard/projects/$projectId`).
La procedencia de cada dato respeta el semáforo de certificación: **no se
mezcla lo probado con lo declarado**.

> Estado general: **sin certificar / pre-DD**. La mayoría de los datos entran
> como `A verificar` o `Declarado`; muy pocos como `Certificado`. Es el estado
> real del activo y alimenta el checklist de due diligence.

---

## 1. Crear proyecto

| Campo       | Valor                                                                                                                                                                             |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Código      | `LOS-TOLDOS-19514`                                                                                                                                                                |
| Nombre      | `Proyecto Los Toldos`                                                                                                                                                             |
| Commodity   | `Au aluvial · Tierras raras`                                                                                                                                                      |
| Región      | `Salta, Argentina`                                                                                                                                                                |
| Descripción | Expediente minero N° 19.514. Oro aluvial (placer) + tierras raras. Depto. Santa Victoria Oeste, zona Rodeo Monte. Cateo concluido, yacimiento declarado. Pre-DD / sin certificar. |

**CRS (`crs_epsg`):** POSGAR 94 Gauss-Krüger. Por longitud (~-64,5°) corresponde a
**faja 3 (EPSG 22183)** o **faja 4 (EPSG 22184)** — confirmar contra el plano
oficial. Queda además como dato `A verificar` en la ficha.

---

## 2. Catastro · concesión

Una fila en el editor de catastro (`mining_concessions`):

| Campo               | Valor                                                                                                                                                                                           |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Expediente / código | `19.514`                                                                                                                                                                                        |
| Nombre              | `Los Toldos`                                                                                                                                                                                    |
| Tipo                | `Cateo`                                                                                                                                                                                         |
| Estado              | `Vigente`                                                                                                                                                                                       |
| Superficie (ha)     | `6250`                                                                                                                                                                                          |
| Titular             | `Argencampo S.A. · CUIT 30-57056971-2`                                                                                                                                                          |
| Matrículas          | `224, 461`                                                                                                                                                                                      |
| Región / provincia  | `Salta`                                                                                                                                                                                         |
| Comuna / depto      | `Santa Victoria Oeste`                                                                                                                                                                          |
| Otorgado / Vence    | (según plano / expediente)                                                                                                                                                                      |
| Notas               | Límites: S río Lipeo, E río Bermejo, N río El Condado (frontera Bolivia), O cordillera. Cercano al PN Baritú. Titulares del cateo (personas físicas: Rodríguez, Reggio) desalineados con la SA. |

**Polígono:** 7 vértices en POSGAR 94 Gauss-Krüger. **Reproyectar a WGS84
(lng/lat)** antes de pegar. Formato esperado:

```json
{ "type": "Polygon", "coordinates": [[[lng, lat], [lng, lat], "…", [lng, lat]]] }
```

El editor valida el polígono en vivo y cuenta los vértices. La faja POSGAR
original se preserva en `projects.crs_epsg`.

---

## 3. Ficha de datos · procedencia

Cargar cada fila en el editor (Sección · Dato · Valor · Unidad · Procedencia · Fuente).

| Sección       | Dato                     | Valor                                         | Unidad                       | Procedencia | Fuente                                       |
| ------------- | ------------------------ | --------------------------------------------- | ---------------------------- | ----------- | -------------------------------------------- |
| Activo        | Expediente minero        | 19.514                                        | —                            | Declarado   | Expediente Salta                             |
| Activo        | Superficie del cateo     | 6.250                                         | ha                           | A verificar | Contra plano oficial                         |
| Activo        | Coordenadas (7 vértices) | POSGAR 94 GK                                  | —                            | A verificar | Plano oficial                                |
| Legal         | Titular propiedad        | Argencampo S.A. (CUIT 30-57056971-2)          | —                            | Declarado   | Matrículas 224/461                           |
| Legal         | Titulares del cateo      | Rodríguez, Reggio (personas físicas)          | —                            | A verificar | Desalineado con la SA                        |
| Legal         | Estado societario        | Activa; directorio actualizado                | —                            | Certificado | Boletín Oficial 09/10/2025                   |
| Oro           | Tipo                     | Aluvial (placer), libre, gravimétrico         | —                            | Declarado   | Dueño                                        |
| Oro           | Ley                      | 6,4                                           | g/t (hasta 2,5 m)            | Declarado   | Dueño                                        |
| Oro           | Pureza (fineza, no ley)  | 24 k / 99,99%                                 | —                            | Declarado   | Geól. Battaglia M.P.081 (no NI 43-101)       |
| Oro           | Reserva citada           | ~28.372 (vs 28.235,7)                         | kg                           | A verificar | No es reserva bajo estándar; unificar cifras |
| Tierras raras | Nd                       | 48–49                                         | % (concentrado, base húmeda) | A verificar | INBEMI-UNSA 15/05/2025                       |
| Tierras raras | Pr                       | 19,5–20                                       | % (concentrado)              | A verificar | INBEMI-UNSA                                  |
| Tierras raras | La                       | 5,8–6                                         | % (concentrado)              | A verificar | INBEMI-UNSA                                  |
| Tierras raras | Ce                       | 3,9–4                                         | % (concentrado)              | A verificar | INBEMI-UNSA                                  |
| Tierras raras | Tb                       | 3,8–4                                         | % (concentrado)              | A verificar | INBEMI-UNSA                                  |
| Tierras raras | Litio                    | Mencionado, sin estudios                      | —                            | A verificar | —                                            |
| Económico     | Nivel de certificación   | Sin certificar / pre-DD                       | —                            | Declarado   | GeoCapitals                                  |
| Económico     | Ruta técnica             | Muestreo masivo / corrida piloto gravimétrica | —                            | Declarado   | Plan propuesto                               |

### Caveats que NO se pueden perder

1. **La pureza 24 k / 99,99% es la fineza del oro, no la ley del yacimiento.**
   Se carga como dato de "Pureza (fineza)", declarado por Battaglia — nunca como
   ley del recurso.
2. **Los % de tierras raras son de muestras seleccionadas (concentrado), base
   húmeda — NO ley in-situ.** El propio laboratorio (INBEMI-UNSA) pidió nuevas
   muestras para porcentajes definitivos. Todos entran como `A verificar`.
3. **La "reserva" de ~28.372 kg no es una reserva bajo estándar** (NI 43-101 /
   JORC) y hay una cifra alternativa (28.235,7 kg) que debe unificarse.

---

## 4. Levantamiento de capital

| Campo                                                 | Valor                                                                                                                                                                            |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Instrumento                                           | `Opción + regalía NSR` (`option_nsr`)                                                                                                                                            |
| Estructura de financiamiento                          | Opción exclusiva sobre el proyecto (no compra de la SA). Pagos por hitos no reembolsables + regalía NSR + vehículo SPV. Plazo 18–24 meses (cuello de botella ambiental EIA/IIA). |
| Monto a levantar / Ticket / % ofrecido / Valorización | **A definir con el abogado minero de Salta**                                                                                                                                     |

**Uso de fondos (sugerido, ajustar %):**

| Línea                            | %   |
| -------------------------------- | --- |
| Muestreo masivo / corrida piloto | —   |
| NI 43-101                        | —   |
| Ambiental (EIA/IIA)              | —   |
| Legal / SPV                      | —   |
| G&A                              | —   |

**Hitos:**

| Cuándo | Qué                                          |
| ------ | -------------------------------------------- |
| M0     | Firma de la opción                           |
| M6     | Corrida piloto gravimétrica (confirma leyes) |
| M12    | NI 43-101 inferido                           |
| M18–24 | PFS / EIA                                    |

**Highlights:**

- Oro aluvial libre, gravimétrico
- Potencial de tierras raras (Nd/Pr dominante)
- ~6.250 ha en zona fronteriza de Salta

> Los montos se dejan como placeholder: en el term sheet quedaron para definir
> con el abogado (quién cede — el cateo está a nombre de personas físicas, no de
> la SA —, montos por hito, plazo y jurisdicción).

---

## Gaps para nivel bancable (marco NI 43-101 / JORC)

- Informe de QP independiente
- PFS / DFS
- EIA / IIA ambiental
- Valorización DCF / NAV
- Estructura SPV
- Estados contables auditados
