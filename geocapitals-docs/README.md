# geocapitals-docs — generador de documentos PDF

Genera documentos con la identidad de GeoCapitals a partir de plantillas HTML
(Jinja2) + CSS de marca, renderizados a PDF con **chromium headless** sobre A4
(medidas reales, sin factor de escala).

## Documentos

| Documento | Salida | Páginas |
|---|---|---|
| KYC / precalificación de proveedores | `out/GEOCAPITALS_KYC_Precalificacion_Proveedores.pdf` | 6 |
| Ficha de oferta (desde YAML) | `out/GEOCAPITALS_Ficha_Oferta_<REF>.pdf` | 2 |
| Due diligence catastral (desde JSON) | `out/GEOCAPITALS_DueDiligence_Catastro_<ID>.pdf` | 1 |

## Uso

```bash
python3 generate.py kyc            # KYC en español
python3 generate.py kyc --lang en  # KYC en inglés
python3 generate.py ficha data/au_conc_202608.yml   # oro  (g/t -> oz troy)
python3 generate.py ficha data/cu_cat_202609.yml    # cobre (% -> t contenidas)
python3 generate.py ficha data/sb_conc_202609.yml   # antimonio
python3 generate.py ficha data/li_spod_202609.yml   # litio (espodumeno)
python3 generate.py dd data/dd_catastro_ejemplo.json # reporte de due diligence
python3 generate.py all            # KYC + ficha oro + due diligence de ejemplo
```

### Ficha multi-commodity

El motor de contenido fino se adapta a la unidad de ley declarada en el YAML:

```yaml
ley:
  unidad: g/t      # 'g/t' o '%'
  metal: Au        # Au/Ag/Pt/Pd -> además oz troy; Cu/Sb/Li2O -> t contenidas
escenarios_ley: [300, 400, 475, 550]
```

- `g/t` + metal precioso → `g`, `kg`, `oz troy` (÷ 31.1034768).
- `%` → `t` y `kg` de metal contenido (`t × %/100`). Base para Cu, Sb, Li2O, etc.

Los escenarios de ley son **supuestos de cálculo**, nunca un ensaye.

## Reglas de datos (inviolables)

- **No se inventan datos.** Todo campo sin valor confirmado se renderiza como
  **Por confirmar** (ámbar, negrita). Un vacío nunca se presenta como confirmado.
- Los **escenarios de ley** del material son *supuestos de cálculo*, rotulados
  como tales. El contenido fino se calcula en Python
  (`g = t × 1000 × g/t`; `oz troy = g / 31.1034768`), no es un ensaye.
- El **assay** de laboratorio acreditado es la única fuente de ley real.

## Estructura

```
brand/geocapitals.css        # tokens de marca + layout (A4)
brand/logo-geocapitals.*     # opcional; si falta, se usa el sello tipográfico "GC"
templates/kyc.html           # KYC 6 pp (bilingüe vía tabla de strings en generate.py)
templates/ficha_oferta.html  # ficha 2 pp (Jinja2 sobre el YAML)
data/au_conc_202608.yml       # YAML de ejemplo (concentrado de oro)
generate.py                  # CLI + cálculo de fino + render chromium + verificación
out/                         # PDFs generados
```

## Requisitos

- Python: `jinja2`, `pyyaml`, `markupsafe`
- chromium headless (buscado en `/opt/pw-browsers/chromium` y en el `PATH`)
- `pdfinfo` (poppler) para el conteo de páginas de verificación

## Contacto / logo

`generate.py` deja el email, teléfono y web como constantes vacías
(`CONTACT_EMAIL`, etc.): al estar vacías no se imprime contacto inventado.
Si se coloca `brand/logo-geocapitals.svg` o `.png`, se incrusta como data-URI;
si no existe, se usa el sello tipográfico **GC**.
