# Cholqui — Plan minero escalable 1.000 → 20.000 t/mes

Hoy el módulo Cholqui muestra un único plan fijo (166.500 t en 24 meses, rampa declarada 1.500 → 15.000 t/mes) con un costo global de CLP 8.911.198.950 sin desglose, sin dimensionamiento de flota y sin proyección mes a mes. El objetivo es reemplazar ese bloque estático por un **plan minero parametrizado** que proyecte producción, flota, costos y venta a ENAMI desde 1.000 t/mes hasta 15.000 t/mes (caso base) y 20.000 t/mes (caso ampliado).

## Qué se construye

**1. Modelo de plan minero (nueva fuente de cálculo, no otra fuente de datos)**
- Rampa mensual configurable: capacidad inicial 1.000 t/mes, meseta objetivo 15.000 o 20.000 t/mes, meses de rampa y duración total.
- Producción mes a mes, acumulada, y tonelaje total resultante del escenario.
- Punto de equilibrio (~2.341 t/mes hoy documentado) recalculado con la estructura de costos del escenario.

**2. Costos desagregados por tonelada (reemplazan el costo global opaco)**
Bloques: perforación, tronadura, carguío, transporte interno, chancado, transporte a planta ENAMI, administración y supervisión, permisos/patentes/seguros/cierre, contingencia. Costos fijos mensuales separados de los variables por tonelada, de modo que el costo unitario baje al escalar — que es el argumento central de subir de 1.000 a 20.000 t/mes.

**3. Dimensionamiento de maquinaria por escalón de producción**
Tabla que, para cada nivel (1.000 / 3.000 / 5.000 / 10.000 / 15.000 / 20.000 t/mes), calcula unidades requeridas y su costo mensual: perforadora, excavadora/retro, cargador frontal, camiones de 30 t (rendimiento por ciclo y distancia), chancador móvil, apoyo (bulldozer, aljibe, camioneta). Esto corrige de raíz la inconsistencia registrada como brecha ("167 camiones × CLP 600.000/mes" vs "2 a 5 camiones" del plan minero): la flota pasa a derivarse del tonelaje, no de un dato suelto.

**4. Proyección de venta a ENAMI**
Ingreso mensual = tonelaje × tarifa según ley de Cu soluble (1,5 / 2,0 / 2,5 / 3,0 %), usando la escala ya cargada de la Circular ENAMI N°27. Salida: ingresos, costos, margen y flujo acumulado por mes; mes de payback; margen CLP/t.

**5. Panel en la plataforma**
Nuevo panel "Plan minero y escalamiento" dentro de la ficha Cholqui (`/dashboard/cholqui` y live público `/live/franco`), en estilo Institutional Modernist:
- Selector de meseta (15.000 / 20.000 t/mes) y de ley de Cu soluble.
- Gráfico de rampa de producción mensual.
- Tabla de flota por escalón con costo mensual.
- Desglose de costo CLP/t: variable, fijo y total, mostrando la caída del unitario al escalar.
- Curva de flujo acumulado con marca de payback.

**6. PDF**
El PDF de inversión de Cholqui incorpora la rampa, la tabla de flota y el cuadro de costos unitarios por escalón, con la misma numeración que la pantalla.

## Honestidad de datos

- La rampa a 15.000 t/mes se rotula **"plan declarado"**; el escenario de 20.000 t/mes se rotula **"hipótesis de ampliación — sujeta al marco regulatorio y a permisos, por validar"**, sin presentarlo como autorizado.
- Los costos unitarios y el dimensionamiento de flota se rotulan **"estimación de ingeniería preliminar"**, no cotizaciones cerradas.
- Se mantiene la advertencia existente: el tonelaje del plan excede 2,74 veces el potencial conceptual de 60.750 t; ningún escenario ampliado implica recursos ni reservas certificadas, ni VAN/TIR auditados.

## Detalle técnico

- Nuevo `src/features/franco/data/minePlan.ts`: tipos y funciones puras (`buildRamp`, `fleetForRate`, `unitCosts`, `projectCashflow`), sin acceso a red ni a base de datos.
- Constantes ENAMI, tonelaje y opex se siguen leyendo desde `src/features/franco/data/cholqui.ts` (fuente canónica); el nuevo archivo sólo calcula.
- Nuevo `src/features/franco/components/CholquiMinePlanPanel.tsx`, montado en `FrancoDashboard.tsx` junto a `CholquiScenariosPanel`.
- `cholquiPdf.ts` suma las secciones nuevas reutilizando las mismas funciones.
- Tests unitarios en Vitest para rampa, flota y flujo (coherencia de totales y monotonía del costo unitario).
- Sin cambios de base de datos ni de permisos.
