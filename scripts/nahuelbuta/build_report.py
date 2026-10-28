"""Genera el informe técnico preliminar Nahuelbuta REE a partir de reports/nahuelbuta/2026-10-27/.
Uso: python scripts/nahuelbuta/build_report.py <salida.pdf>
Solo lee resultados ya calculados; no inventa cifras."""
import json, csv, sys
from PIL import Image as PI
from reportlab.lib.pagesizes import A4
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table,
                                TableStyle, Image, PageBreak, KeepTogether, NextPageTemplate)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.fonts import addMapping

ROOT = '/dev-server/'
F = ROOT + 'src/assets/fonts/pdf/'
R = ROOT + 'reports/nahuelbuta/2026-10-27/'
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/Nahuelbuta_REE_Technical_Report.pdf'
for n, f in [('NR', 'Newsreader-Regular'), ('NRS', 'Newsreader-SemiBold'), ('PS', 'PlexSans-Regular'),
             ('PSB', 'PlexSans-SemiBold'), ('PSI', 'PlexSans-Italic'), ('PM', 'PlexMono-Regular')]:
    pdfmetrics.registerFont(TTFont(n, F + f + '.ttf'))
addMapping('PS', 0, 0, 'PS'); addMapping('PS', 1, 0, 'PSB'); addMapping('PS', 0, 1, 'PSI'); addMapping('PS', 1, 1, 'PSB')
NAVY = colors.HexColor('#14213D'); COP = colors.HexColor('#B87333'); GR = colors.HexColor('#3A3F4B'); HL = colors.HexColor('#D9D5CC')

rd = lambda f: list(csv.DictReader(open(R + f)))
rank = rd('ranking_by_pano.csv'); cov = json.load(open(R + 'coverage.json'))
man = json.load(open(R + 'scene_manifest.json'))['scenes']; val = json.load(open(R + 'validation_report.json'))
geo = rd('geomorphology_by_pano.csv'); pv = rd('polygon_validation.csv')
idx = json.load(open(R + 'spectral_indices_interpretable_px.json'))

S = lambda **k: ParagraphStyle('x', **k)
body = S(fontName='PS', fontSize=9, leading=13.2, textColor=GR, spaceAfter=5)
small = S(fontName='PS', fontSize=7.5, leading=10, textColor=GR)
h1 = S(fontName='NRS', fontSize=17, leading=21, textColor=NAVY, spaceBefore=4, spaceAfter=8)
h2 = S(fontName='PSB', fontSize=9.5, leading=13, textColor=COP, spaceBefore=8, spaceAfter=3)
cell = S(fontName='PS', fontSize=7.5, leading=9.4, textColor=GR)
cellb = S(fontName='PSB', fontSize=7.5, leading=9.4, textColor=NAVY)
WARN = ("El presente documento constituye una evaluación técnica preliminar basada en antecedentes documentales y "
        "análisis geoespaciales. No representa una estimación de recursos o reservas minerales, ni demuestra la existencia "
        "de mineralización económicamente explotable. Las interpretaciones requieren validación mediante trabajos de terreno, "
        "mineralogía y análisis geoquímicos. Este documento no constituye un informe técnico certificado conforme a NI 43-101.")


class Doc(BaseDocTemplate):
    def afterFlowable(self, f):
        if isinstance(f, Paragraph) and f.style is h1:
            self.notify('TOCEntry', (0, f.getPlainText(), self.page))


def deco(c, d):
    c.saveState(); W, H = A4
    c.setStrokeColor(HL); c.setLineWidth(.5)
    c.line(18*mm, H-14*mm, W-18*mm, H-14*mm); c.line(18*mm, 14*mm, W-18*mm, 14*mm)
    c.setFont('PSB', 7); c.setFillColor(NAVY); c.drawString(18*mm, H-11.5*mm, 'GEOCAPITALS · NHB-REE')
    c.setFont('PS', 7); c.setFillColor(GR); c.drawRightString(W-18*mm, H-11.5*mm, 'NHB-TR-2026-002 · v0.1 PRELIMINAR · 27-10-2026')
    c.drawString(18*mm, 10*mm, 'Evaluación preliminar. Sin recursos ni reservas. No certificado NI 43-101.')
    c.setFont('PM', 7); c.drawRightString(W-18*mm, 10*mm, f'{d.page}')
    c.restoreState()


def cover(c, d):
    W, H = A4; c.saveState(); c.setFillColor(NAVY); c.rect(0, 0, W, H, fill=1, stroke=0)
    c.drawImage(R + 'maps/fig07_s2_rgb.png', 10*mm, H*0.43, W-20*mm, H*0.36, preserveAspectRatio=True, anchor='c')
    c.setFillColor(COP); c.rect(18*mm, H-36*mm, 24*mm, 1.2*mm, fill=1, stroke=0)
    c.setFillColor(colors.white); c.setFont('PSB', 8); c.drawString(18*mm, H-30*mm, 'GEOCAPITALS · MINING INTELLIGENCE')
    y0 = H*0.37
    c.setFont('NRS', 21); c.drawString(18*mm, y0, 'NAHUELBUTA RARE EARTH ELEMENTS PROJECT')
    c.setFont('NR', 14); c.drawString(18*mm, y0-9*mm, 'Preliminary Geological & Remote Sensing Assessment')
    c.setFont('PS', 9.5); c.drawString(18*mm, y0-17*mm, 'Integrated Remote Sensing, Geomorphological and Geological Screening Report')
    c.drawString(18*mm, y0-23*mm, 'Región del Biobío – Región de La Araucanía, Chile')
    y = H*0.19
    for k, v in [('Código', 'NHB-TR-2026-002'), ('Fecha efectiva', '27 de octubre de 2026'),
                 ('Versión', 'v0.1 · PRELIMINAR · no revisado por Persona Calificada'),
                 ('Solicitante', 'GeoCapitals · titular declarado: Inversiones Bioenergy SpA'),
                 ('Ámbito', '34 paños Arcillas 1–34 · 10.200 ha nominales · EPSG:32718')]:
        c.setFont('PSB', 7.5); c.setFillColor(COP); c.drawString(18*mm, y, k.upper())
        c.setFont('PS', 9); c.setFillColor(colors.white); c.drawString(55*mm, y, v); y -= 6*mm
    c.setFont('PS', 7); c.setFillColor(colors.HexColor('#C9CCD3'))
    c.drawString(18*mm, 12*mm, 'Imagen: Sentinel-2 L2A 21-02-2025 (Copernicus/ESA vía Microsoft Planetary Computer), color real; paños en blanco.')
    c.restoreState()


def T(rows, widths, head=True):
    data = [[Paragraph(str(x), cellb if (head and i == 0) else cell) for x in r] for i, r in enumerate(rows)]
    t = Table(data, colWidths=[w*mm for w in widths], repeatRows=1 if head else 0)
    t.setStyle(TableStyle([('LINEBELOW', (0, 0), (-1, 0), .8, NAVY), ('LINEBELOW', (0, 1), (-1, -1), .25, HL),
                           ('VALIGN', (0, 0), (-1, -1), 'TOP'), ('TOPPADDING', (0, 0), (-1, -1), 2.2),
                           ('BOTTOMPADDING', (0, 0), (-1, -1), 2.2), ('LEFTPADDING', (0, 0), (-1, -1), 3)]))
    return t


def fig(name, cap, w=172):
    ww, hh = PI.open(R + 'maps/' + name).size
    return KeepTogether([Image(R + 'maps/' + name, width=w*mm, height=w*mm*hh/ww), Paragraph(cap, small), Spacer(1, 8)])


P = lambda t: Paragraph(t, body)
doc = Doc(OUT, pagesize=A4, leftMargin=18*mm, rightMargin=18*mm, topMargin=20*mm, bottomMargin=20*mm,
          title='Nahuelbuta REE — Preliminary Geological & Remote Sensing Assessment', author='GeoCapitals')
fr = Frame(18*mm, 20*mm, A4[0]-36*mm, A4[1]-40*mm, id='f')
doc.addPageTemplates([PageTemplate('cover', [fr], onPage=cover), PageTemplate('main', [fr], onPage=deco)])
conc = cov['panos_conclusivos_mejor_caso']
g_min = min(m['global_interp_ndvi025'] for m in man); g_max = max(m['global_interp_ndvi025'] for m in man)
s = [NextPageTemplate('main'), PageBreak()]

s += [Paragraph('Control documental', h1),
      T([['Versión', 'Fecha', 'Elaboración', 'Revisión', 'Aprobación'],
         ['v0.1 preliminar', '27-10-2026', 'Equipo GeoCapitals Mining Intelligence (análisis reproducible)', 'Pendiente', 'Pendiente — QP no designada']],
        [24, 22, 62, 28, 38]), Spacer(1, 6),
      P('No se ha designado Persona Calificada (QP) para este documento. El informe del titular NHB-TR-2026-001 (7-oct-2026) '
        'menciona a un profesional; su autoría o aprobación de <b>este</b> documento no ha sido verificada y no se le atribuye. '
        'No existen firmas en este documento.'),
      Paragraph('Advertencia obligatoria', h2), P(WARN),
      Paragraph('Niveles de evidencia', h2),
      T([['Nivel', 'Significado en este informe'],
         ['Medido', 'Medición de terreno o laboratorio. <b>No existe ninguna en el área.</b>'],
         ['Oficial / documental', 'Información de organismos o del titular, sin verificación independiente'],
         ['Derivado', 'Cálculo nuevo de esta corrida a partir de Sentinel-2 y Copernicus DEM'],
         ['Heredado', 'Derivado en corridas previas del repositorio; no recalculado'],
         ['Interpretado', 'Inferencia técnica basada en antecedentes'],
         ['Hipótesis', 'Posibilidad que requiere evaluación adicional'],
         ['Pendiente', 'Información no obtenida']], [34, 140]),
      Spacer(1, 8), Paragraph('Índice', h1)]
toc = TableOfContents(); toc.levelStyles = [S(fontName='PS', fontSize=9, leading=13, textColor=GR)]
s += [toc, PageBreak()]

s += [Paragraph('Resumen ejecutivo', h1),
      P('Se evaluaron los <b>34 paños Arcillas 1–34</b> (10.200 ha, geometría efectiva; 0 geometrías inválidas, 0 traslapes) '
        'con <b>8 escenas reales Sentinel-2 L2A</b> de verano austral 2019–2026, el <b>Copernicus DEM GLO-30</b> y los 1.852 '
        'lineamientos interpretados existentes en el repositorio.'),
      Paragraph('Hallazgos principales', h2),
      P(f'• <b>Observabilidad óptica muy baja.</b> La superficie interpretable global (NDVI&lt;0,25, sin nube, sombra ni agua) fue '
        f'de {g_min:.2f}–{g_max:.2f} % según escena (mediana {cov["global_tipico_ndvi025"]:.2f} %), muy por debajo del umbral de 15 %.'),
      P(f'• Solo <b>{len(conc)} paños</b> ({", ".join(conc)}) superan 15 % en su mejor escena, en sectores de cosecha forestal. '
        'En escena típica <b>ningún paño</b> alcanza el umbral. Los otros {34-len(conc)} son <b>NO CONCLUYENTES PARA TARGETING ESPECTRAL</b>.'),
      P('• <b>Geomorfología:</b> 8 paños clase A (meseta heredada ≥25 %): Arcillas 26, 34, 31, 27, 33, 30, 29 y 28, en el sector '
        'oriental. La pendiente &lt;5° recalculada es coherente con este orden (confianza media).'),
      P(f'• <b>Lineamientos:</b> {val["lineaments"]} trazas, sin duplicados por extremos; longitud mediana '
        f'{val["lineament_len_m"]["median"]/1000:.1f} km. Son trazas de imagen que pueden ser drenajes o caminos; no se califican como fallas.'),
      P('• <b>No existe ninguna muestra geoquímica.</b> No hay ley TREO medida; ningún índice satelital se convierte en ppm, leyes ni tonelaje.'),
      Paragraph('Decisión recomendada', h2),
      P('Pasar a reconocimiento de terreno y muestreo de perfiles de regolito priorizando los paños clase A, y usar los paños '
        f'{", ".join(c.split()[1] for c in conc)} como única ventana para contrastar índices espectrales en terreno. '
        'El ranking integrado se declara <b>no calculable</b> hasta contar con geoquímica.'),
      Paragraph('Etapas no ejecutadas', h2),
      P('ASTER, Landsat 8/9 y Sentinel-1 no se procesaron; curvatura, TPI y red de drenaje no se calcularon; no hay consulta '
        'de hoja geológica SERNAGEOMIN específica. Ver sección 4.'), PageBreak()]

s += [Paragraph('1. Introducción', h1),
      P('Objetivo: evaluar con datos verificables la capacidad de la teledetección y la geomorfología para orientar el reconocimiento '
        'de una hipótesis de REE en regolitos y arcillas de adsorción iónica. Alcance: trabajo de escritorio, sin terreno. '
        'Limitación central: cobertura forestal densa y ausencia total de laboratorio.'),
      Paragraph('2. Ubicación y antecedentes', h1),
      P('Cordillera de Nahuelbuta, regiones del Biobío y La Araucanía, ~37,64° S / 73,20° O. Titular declarado de las solicitudes: '
        'Inversiones Bioenergy SpA. Situación catastral: pedimentos en trámite; tenencia no constituida (documental). Datum de la '
        'documentación original: PSAD56 UTM 18S; análisis en WGS84 / UTM 18S (EPSG:32718). No se mezclan los 22 paños de expansión '
        'ni los 7 polígonos del deal GEO-2026-004 (ubicación por revisar).'),
      fig('fig01_ubicacion.png', 'Figura 1. Contexto de relieve del área. No se incluye marco regional nacional por no contar con base cartográfica verificada en esta corrida.'),
      fig('fig02_panos.png', 'Figura 2. Los 34 paños con su geometría efectiva.'),
      Paragraph('3. Contexto geológico', h1),
      P('<i>Documental / interpretado.</i> Basamento del Complejo Metamórfico Nahuelbuta y granitoides asociados. El informe del titular '
        'describe saprolito caolinita-halloysita de 5–20 m (no verificado). El modelo de adsorción iónica por analogía regional es una '
        '<b>hipótesis</b>: no hay evidencia medida en los paños.'), PageBreak()]

s += [Paragraph('4. Fuentes de información y metodología', h1),
      T([['Dataset', 'Fecha', 'Resol.', 'CRS', 'Procesamiento', 'Nivel'],
         ['Paños Arcillas 1–34', 'repo', 'vector', '4326→32718', 'Validación topológica y áreas', 'Documental'],
         ['Sentinel-2 L2A (8 escenas)', '2019–2026, ene–mar', '20 m', '32718', 'Máscara SCL, NDVI, índices', 'Derivado'],
         ['Copernicus DEM GLO-30', '—', '30 m', '4326→32718', 'Pendiente, estadísticas, hillshade', 'Derivado'],
         ['Meseta DEM por paño', '2026-10-27', '30 m', '—', 'No recalculada', 'Heredado'],
         ['Lineamientos (1.852)', '2026-10-27', '30 m', '4326', 'QA geométrico y rosas', 'Heredado'],
         ['ASTER, Landsat 8/9, Sentinel-1', '—', '—', '—', '<b>No procesados</b>', 'Pendiente'],
         ['Geoquímica y mineralogía', '—', '—', '—', '<b>No existe</b>', 'Pendiente']], [42, 26, 13, 20, 48, 25]),
      Spacer(1, 6), Paragraph('Escenas Sentinel-2 utilizadas', h2),
      T([['ID de escena', 'Fecha', 'Nubes %', 'Interpretable global']] +
        [[m['id'], m['datetime'][:10], f"{m['cloud_cover_pct']:.2f}", f"{m['global_interp_ndvi025']:.2f} %"] for m in man],
        [100, 22, 18, 34]),
      Paragraph('Fuente: Microsoft Planetary Computer STAC, colección sentinel-2-l2a, tile 18HXD. Una escena por año, la de menor '
                'nubosidad entre enero y marzo (&lt;10 %). Desfase radiométrico −1000 aplicado a baseline ≥ 04.00.', small),
      PageBreak()]

s += [Paragraph('5. Procesamiento de teledetección', h1),
      P('Bandas B02, B04, B08, B8A, B11, B12 y SCL leídas solo sobre la ventana de los paños y remuestreadas a 20 m. Máscaras: '
        'SCL 0–1 (sin dato), 3/8/9/10 (sombra, nube, cirro), 6 (agua). Vegetación: NDVI ≥ umbral (sensibilidad 0,20 / 0,25 / 0,30). '
        'Índices BSI, B11/B12 (proxy Al-OH), B04/B02 (óxidos), B11/B8A (ferroso) y KI calculados solo sobre píxeles interpretables. '
        '<b>KI = (B11+B08)/(B12+B04) es una heurística del proyecto, no una identificación de caolinita.</b>'),
      fig('fig07_s2_rgb.png', 'Figura 7. Composición en color real (escena más despejada del periodo).'),
      Paragraph('6. Resultados de observabilidad', h1),
      fig('fig08_observabilidad.png', 'Figura 8. NDVI y superficie interpretable por paño en su mejor escena. La cifra histórica de 0,53 % corresponde a un AOI rectangular y no se reutiliza.')]
covrows = [['Paño', 'Típico 0,20', 'Típico 0,25', 'Típico 0,30', 'Mejor 0,25', 'Estado']] + \
    [[c['pano'], c['tipico_ndvi0.20'], c['tipico_ndvi0.25'], c['tipico_ndvi0.30'], c['mejor_ndvi0.25'],
      'Evaluable en escena favorable' if c['conclusivo_15pct_ndvi0.25'] else 'No concluyente'] for c in cov['by_pano']]
s += [Paragraph('Tabla 1. Superficie interpretable por paño (%)', h2), T(covrows, [24, 22, 22, 22, 22, 62]),
      Paragraph('Típico = mediana de 8 escenas; Mejor = máximo. Umbral 15 %. Ningún paño lo alcanza en escena típica.', small),
      Paragraph('Índices espectrales (Figura 9)', h2),
      P('La Figura 9 (mapa de índices) <b>se omite</b>: la superficie interpretable no permite un mapa defendible. Se reportan '
        'medianas solo para los paños evaluables en su escena favorable, como referencia para contraste en terreno; no indican REE.')]
ir = [['Paño', 'Escena', 'Px', 'BSI', 'B11/B12', 'B04/B02', 'B11/B8A', 'KI*']]
for p in conc:
    best = max(idx.get(p, []), key=lambda x: x['n_px'], default=None)
    if best:
        ir.append([p, best['scene'][11:19], best['n_px'], best['BSI'], best['AlOH_B11_B12'], best['FeOx_B04_B02'], best['Ferrous_B11_B8A'], best['KI']])
s += [T(ir, [24, 20, 14, 20, 22, 22, 22, 20]),
      Paragraph('* KI heurístico. Las superficies son mayoritariamente cosecha forestal reciente; el suelo puede estar removido.', small),
      PageBreak()]

s += [Paragraph('7. Interpretación geomorfológica', h1),
      P('Pendiente y estadísticas altimétricas recalculadas por paño con Copernicus DEM GLO-30. El porcentaje de meseta es heredado. '
        'Las superficies subhorizontales elevadas son compatibles con la preservación de perfiles de meteorización, sin confirmarla.'),
      fig('fig03_dem.png', 'Figura 3. Modelo digital de elevación.', 150),
      fig('fig04_pendiente.png', 'Figura 4. Pendientes.', 150),
      fig('fig05_mesetas.png', 'Figura 5. Mesetas DEM por paño (heredado).', 150),
      Paragraph('8. Interpretación morfoestructural', h1),
      P(f'QA: {val["lineaments"]} trazas, {val["lineament_duplicates_endpoint_1m"]} duplicadas por extremos (tolerancia 1 m), longitud '
        f'{val["lineament_len_m"]["min"]/1000:.1f}–{val["lineament_len_m"]["max"]/1000:.1f} km (mediana {val["lineament_len_m"]["median"]/1000:.1f} km). '
        'La longitud mínima de 1,5 km refleja un filtro del algoritmo original. Las trazas no se han discriminado en terreno de drenajes '
        'o caminos, y su densidad por paño (≈14–22 km/km²) es poco discriminante.'),
      fig('fig06_lineamientos.png', 'Figura 6. Lineamientos interpretados (no son fallas confirmadas).', 150),
      fig('fig06b_rosas.png', 'Figura 6b. Diagrama de rosas e histograma de longitudes.', 150), PageBreak()]

s += [Paragraph('9. Modelo exploratorio de REE', h1),
      T([['Elemento', 'Evidencia', 'Nivel'],
         ['Roca fuente (granitoides / CMN)', 'Cartografía regional citada por el titular', 'Documental'],
         ['Saprolito 5–20 m', 'Descrito por el titular; no verificado', 'Documental'],
         ['Superficies de preservación', 'Mesetas DEM y pendiente &lt;5°', 'Derivado / heredado'],
         ['Arcillas en superficie', 'Sin señal SWIR defendible por cobertura forestal', 'Pendiente'],
         ['Contenido REE / fracción intercambiable', 'Ninguna muestra', 'Pendiente']], [50, 90, 34]),
      Spacer(1, 4),
      P('Pruebas necesarias: perfiles de regolito por horizonte, REE total, fracción intercambiable, mineralogía de arcillas y QA/QC. '
        'La hipótesis de adsorción iónica <b>no constituye un descubrimiento</b>.'),
      Paragraph('10. Evaluación comparativa de paños', h1),
      P('Ranking geomorfológico de prioridad relativa de reconocimiento (no probabilidad de yacimiento). Meseta y pendiente &lt;5° '
        'están correlacionadas y no se suman. Ranking integrado: <b>NO CALCULABLE</b>.'),
      T([['#', 'Paño', 'Meseta %', 'Pend.&lt;5° %', 'Pend. media °', 'Obs. mejor %', 'Clase', 'Conf.', 'Limitantes']] +
        [[r['rank_meseta'], r['pano'], r['meseta_pct_heredado'], r['slope_lt5_pct_recalc'], r['slope_mean_deg'],
          r['observabilidad_mejor_pct'], r['prioridad_reconocimiento'], r['confianza'], r['factores_limitantes']] for r in rank],
        [8, 20, 14, 15, 15, 15, 10, 12, 65]),
      fig('fig10_prioridades.png', 'Figura 10. Prioridades relativas de reconocimiento de regolito.', 150), PageBreak()]

s += [Paragraph('11. Riesgos e incertidumbres', h1)] + [P('• ' + x) for x in [
    'Cobertura forestal: la teledetección óptica no es concluyente en ' + str(34-len(conc)) + ' de 34 paños.',
    'Georreferenciación: datum fuente PSAD56 sin conciliación formal; error posicional no cuantificado.',
    'Catastro: pedimentos en trámite; superposición con terceros y estudio de títulos pendientes.',
    'Sensores: ASTER, Landsat y Sentinel-1 no procesados en esta corrida.',
    'Lineamientos: artefactos de drenaje y caminos no discriminados.',
    'Geología: hipótesis REE sin muestra; las analogías regionales no son transferibles.',
    'Territorio: consulta indígena (Convenio 169 OIT) y restricciones ambientales no evaluadas.']]
s += [Paragraph('12. Programa recomendado de exploración', h1),
      T([['Etapa', 'Actividades', 'Criterio de decisión'],
         ['1 · Reconocimiento', 'Inspección geomorfológica de paños clase A; cortes de camino y afloramientos; registro de profundidad de meteorización', 'Perfiles de saprolito ≥ 5 m accesibles'],
         ['2 · Muestreo preliminar', f'Muestreo estratificado por horizonte en paños A y ventanas ópticas {", ".join(c.split()[1] for c in conc)}; QA/QC (blancos, duplicados, materiales de referencia) y cadena de custodia', 'Resultados de laboratorio competente'],
         ['3 · Laboratorio', 'REE total, fracción intercambiable, mineralogía de arcillas', 'Umbrales a definir por una QP'],
         ['4 · Reinterpretación', 'Ranking integrado con geoquímica; decisión de programa ampliado', 'Revisión por Persona Calificada']], [30, 92, 52]),
      P('No se presentan cronograma ni presupuesto: no hay cotizaciones ni cantidades verificables.'),
      Paragraph('13. Conclusiones técnicas', h1),
      P(f'<b>Derivado:</b> superficie interpretable global ≤ {g_max:.1f} % en todas las escenas; solo {len(conc)} paños superan 15 % en escena favorable. '
        '<b>Heredado / derivado:</b> 8 paños clase A con superficies subhorizontales elevadas. <b>Interpretado:</b> el sector oriental '
        'es el más favorable para reconocimiento de regolito. <b>Hipótesis:</b> REE de adsorción iónica. <b>Pendiente:</b> toda evidencia '
        'medida. No se declara mineralización, recurso ni reserva.'),
      Paragraph('14. Referencias', h1)] + [Paragraph(x, small) for x in [
    'Copernicus Sentinel-2 L2A, ESA, vía Microsoft Planetary Computer, consultado 27-10-2026.',
    'Copernicus DEM GLO-30, ESA/Airbus, colección cop-dem-glo-30.',
    'Inversiones Bioenergy SpA (2026). Informe técnico NHB-TR-2026-001, 7-oct-2026 (documental, no verificado).',
    'Repositorio GeoCapitals: losalamos_panos_arcillas.geojson, losalamos_lineamientos.geojson, reports/nahuelbuta/*-2026-10-27.json.',
    'CIM / NI 43-101 y Form 43-101F1, usados solo como guía estructural.']]

s += [PageBreak(), Paragraph('Anexo A. Coordenadas y validación de paños', h1),
      T([['Paño', 'Válido', 'Vért.', 'Área ha', 'Lat. centroide', 'Lon. centroide', 'UTM E', 'UTM N']] +
        [[v['pano'], 'Sí' if v['valid'] == 'True' else 'No', v['vertices'], v['area_ha'], v['centroid_lat'], v['centroid_lon'], v['utm_e'], v['utm_n']] for v in pv],
        [22, 13, 11, 17, 24, 24, 30, 30]),
      Paragraph('Anexo B. Estadísticas DEM por paño', h1),
      T([['Paño', 'Elev. mín', 'Elev. media', 'Elev. máx', 'Relieve m', 'Pend. &gt;20° %']] +
        [[g['pano'], g['elev_min'], g['elev_mean'], g['elev_max'], g['relieve_m'], g['slope_gt20_pct']] for g in geo],
        [28, 26, 26, 26, 26, 26]),
      Paragraph('Anexo C. Trazabilidad', h1),
      P('Carpeta reports/nahuelbuta/2026-10-27/: coverage.json, scene_manifest.json, analysis_metadata.json (hashes de entradas), '
        'coverage_by_pano.csv, geomorphology_by_pano.csv, lineaments_by_pano.csv, ranking_by_pano.csv, polygon_validation.csv, '
        'spectral_indices_interpretable_px.json, validation_report.json y maps/*.png. No se genera nahuelbuta_satellite_anomalies.geojson '
        'porque no hay anomalías defendibles.'),
      Paragraph('Advertencia', h2), P(WARN)]
doc.multiBuild(s)
print('ok', OUT)
