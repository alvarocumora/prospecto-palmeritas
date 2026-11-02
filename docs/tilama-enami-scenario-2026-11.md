# Tilama / Los Verdes — escenario económico ENAMI desde Cholqui

**Estado:** desarrollo de sensibilidad tarifaria preliminar, no apto para decisión de inversión (`REFERENCE_ONLY`). No modifica rondas, registros de capital, contratos ni cifras en fichas de inversión.

## Fuente implementada

- Tabla documental: `src/features/franco/data/cholqui.ts`, `CHOLQUI_ENAMI` y `CHOLQUI_SCENARIOS`.
- Referencia: Circular ENAMI N.º 27, julio de 2026, óxidos/lixiviación.
- Fórmula: `tarifa(CuS) = 171.886 - (2,5 - CuS) × 82.315` CLP/tms, para sensibilidad de 1–3 % Cu soluble, usando el valor publicado exacto cuando coincide con un escenario original.
- No se afirma vigencia en noviembre de 2026, ni aceptación de mineral de Tilama; debe solicitarse cotización en la agencia/poder comprador realmente habilitado.

El nuevo motor es `src/features/losverdes/tilamaEnamiModel.ts`. UI exclusiva de Los Verdes–Tilama: `/terminal/losverdes?tab=simulador` (componente `TilamaEnamiPanel.tsx`). Los costos y flota de Cholqui NO se reutilizan: un gasto o distancia del proyecto RM no puede trasladarse a Choapa.

## Controles de integridad

1. El Cu soluble ingresado debe ser menor o igual al Cu total.
2. Los resultados ENAMI de 2004–2008 y las 20 muestras de 2022 demuestran evidencia de lotes/muestras específicas, no una ley media explotable. No se usa 2 % Cu total como Cu soluble automáticamente.
3. La referencia histórica de 3.746.250 t (frecuentemente resumida en 3 millones de toneladas) es **potencial conceptual** de cuerpos descritos; NO recurso, reserva ni inventario minable certificado.
4. El ejemplo utiliza 1.000 tms hipotéticas por defecto. Al introducir 3.000.000 t, el valor es sólo la extrapolación matemática del mismo precio unitario: NO ventas comprometidas o plan de vida de mina.
5. El netback es **nulo** hasta que se hayan informado expresamente costo de mina/preparación, flete, ajustes comerciales y escenario de renta minera. El borrador de arriendo del 10 % se modela opcionalmente, sin afirmarlo contrato vigente.
6. No se muestra VAN, TIR, recuperación de inversión ni valor de la propiedad. Los resultados no acreditan permisos, factibilidad, capacidad de ENAMI o posibilidad de producir ese tonelaje.
7. El estado nunca cambia a `VERIFIED` por completar casillas; requiere proceso de due diligence externo.

## Ejercicio reproducible (solo sensibilidad; sin costos)

| Ley Cu total supuesta | Ley Cu soluble supuesta | Tms hipotéticas | Referencia CLP/tms | Ingreso bruto CLP |
|---:|---:|---:|---:|---:|
| 2,0 % | 1,5 % | 1.000 | 89.571 | 89.571.000 |
| 2,0 % | 1,5 % | 3.000.000 | 89.571 | 268.713.000.000 |
| 2,0 % | 2,0 % | 3.000.000 | 130.728 | 392.184.000.000 |

La referencia de CLP/tms es una fórmula documental de **julio de 2026**, no una cotización ni ingreso neto para Tilama.

## Pendientes antes de publicación como caso comercial verificable

- Conciliar pertenencias y derechos efectivos del portafolio Los Verdes–Tilama y los borradores de arriendo.
- Validar muestreos, cadena de custodia, coordenadas UTM, laboratorio definitivo y QA/QC de la base de 210 muestras; NO promediar campañas no comparables.
- Determinar Cu soluble/total de mineral de alimentación representativo y pruebas de metalurgia/lixiviación.
- Confirmar poder comprador ENAMI, admisibilidad, tarifa vigente por producto/ley, impurezas, consumo ácido, humedad, retenciones y límites de capacidad.
- Verificar distancia vial, flete de transportista y costos propios de Tilama para planes escalables; no reutilizar el OPEX/meseta de Cholqui.
- Conciliar los certificados históricos ENAMI por mina/lote y las transacciones con evidencia de origen.
- Asegurar que `src/lib/mining-economics.ts` no se use como fuente definitiva: contiene una ubicación incorrecta de Planta Matta y distancias ilustrativas sin cotización.
- Evaluación formal por Persona Competente/Qualified Person si corresponde; no presentar cantidades conceptuales como recursos ni reservas.

## Pruebas

`src/features/losverdes/tilamaEnamiModel.test.ts`: tarifa igual a Cholqui, 3 millones como sensibilidad, validación CuS ≤ CuT, errores de entrada, no mostrar margen sin costos completos, margen negativo permitido y estado permanentemente `REFERENCE_ONLY`.
