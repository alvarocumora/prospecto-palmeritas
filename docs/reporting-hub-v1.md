# GeoCapitals Reporting Hub v1

## Objetivo

Centralizar la generación, revisión y gobernanza de informes de proyecto. Los módulos de Catastro, Exploración, Satélite, DEM, Geofísica, Muestreo, Targets y Economía producen evidencia; Reporting consume esa evidencia y construye documentos con una narrativa definida por propósito y audiencia.

## Productos canónicos

1. Executive Summary — 1–2 páginas.
2. Investment Memorandum — decisión de inversión y due diligence.
3. Exploration Targeting Report — cadena reproducible desde datos hasta target y ground truth.
4. Technical Evidence Report — revisión técnica estructurada y preparación para QP/CP.

El deck 16:9 y otros formatos de presentación son derivados de estos productos; no constituyen una fuente documental independiente.

## Principios editoriales

- Narrative-first: texto técnico, figuras y mapas antes que tablas.
- Una tabla extensa va a anexos salvo que sea material para la decisión.
- Cada afirmación material debe conservar procedencia, fuente, fecha/corrida y estado de validación.
- DERIVED, INTERPRETED, PROPOSED y SCENARIO no se presentan como evidencia medida.
- Una sección sin evidencia suficiente se muestra como gap; no se rellena con texto genérico.
- Un informe técnico no incorpora términos de ronda, valoración o escenarios comerciales como hechos geológicos.

## NI 43-101

GeoCapitals puede estructurar el dataset y el documento para revisión contra NI 43-101 / Form 43-101F1, pero no debe rotular una salida como Technical Report NI 43-101 hasta que se cumplan los requisitos aplicables y exista revisión/responsabilidad de Qualified Person.

## JORC

La plataforma mantiene un checklist orientado a JORC Code 2012 / Table 1, preservando transparencia, materialidad y competencia. La salida de software no reemplaza la responsabilidad de la Competent Person.

## Fases

### REPORT-01 — Hub y contrato internacional
- ruta canónica /dashboard/reports;
- catálogo único de productos;
- frameworks NI 43-101 / JORC;
- reporte mensual separado como producto operacional;
- accesos contextuales apuntan primero al Hub.

### REPORT-02 — Narrative engine
Implementado en la capa documental: Narrative, Finding, Evidence, Figure, Map, DataGap, Recommendation y AppendixTable. El renderer técnico separa cuerpo principal y anexos; Cholqui v3.1 es la primera migración narrative-first.

### REPORT-03 — Readiness y revisión
Implementado en el Hub usando infraestructura existente: `report_readiness(project_id)`, `technical_reports`, `technical_report_sections`, `qualified_persons` y `technical_report_versions`. El panel evalúa procedencia, revisor competente, secciones firmadas, umbral interno de compliance y snapshot SHA-256. El estado máximo se denomina “candidato a emisión controlada” y no implica cumplimiento regulatorio por sí mismo.

### REPORT-04 — Cholqui v2
Regenerar Cholqui como documento narrative-first: geología y evidencia medida, interpretación satelital/DEM, gaps, ground-truth, programa Toki 2 y anexos completos.

## Compatibilidad

Las exportaciones rápidas actuales permanecen temporalmente disponibles desde ProjectDocsMenu bajo una sección de compatibilidad. Se retirarán cuando REPORT-02 permita generar los cuatro productos canónicos desde el Hub.


## Estado de la migración

REPORT-01 introdujo el Hub y los contratos de producto/estándar. REPORT-02 incorporó el motor narrativo. REPORT-03 conecta readiness, QP/CP, firma de secciones, compliance interno y snapshots versionados sin crear tablas paralelas. Las exportaciones contextuales permanecen como compatibilidad hasta REPORT-04, cuando Cholqui/Toki 2 migre al flujo completo de evidencia y ground-truth.
