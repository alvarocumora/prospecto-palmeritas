# Ranking de distritos para vender desmontes a ENAMI

Revisión del 19-11-2026. Une el catastro SERNAGEOMIN de cuatro zonas: Choapa interior (23.377 concesiones), costa de la IV Región, norte de la V Región y Cerro Alto. Son 4.591 concesiones de explotación eliminadas y 6.230 vigentes o en trámite.

## Método

1. **Distritos**: se agruparon (DBSCAN) las concesiones de explotación de 60 ha o menos, vigentes y eliminadas. Las pertenencias chicas marcan labores pirquineras. Salieron 180 distritos.
2. **Comprador más cercano por camino**: las distancias se calcularon con OSRM y luego se ajustaron por distrito. Se consideraron cuatro compradores:
   - Cabildo (ENAMI en instalaciones de Las Cenizas)
   - Portezuelo, en Illapel (ENAMI)
   - Combarbalá (ENAMI en Minera Barba)
   - Planta Delta, en Ovalle (ENAMI)
3. **Margen por tonelada**: tarifa ENAMI de junio 2026 para sulfuros, interpolada en forma lineal desde la base de 2,5 % ($217.016/t, con $103.482 por cada punto de ley). A eso se restan $6.000/t de carguío y $130/t-km de flete. Es una estimación: la escala real no es lineal y el flete hay que cotizarlo.
4. **Puntaje**: margen a 1,2 % × historia (número de pertenencias chicas y eliminadas) × superficie disponible (eliminada y libre, o ya nuestra) × lo que se ve en la imagen.
5. **Revisión en imagen**: los 36 primeros distritos se revisaron con 117 recortes de 1,2 km (`fichas_*.jpg`, rama `data/barrido-ranking`).

## Advertencias

- **Ubicaciones aproximadas**: la de Portezuelo es el centro de Illapel y la de Combarbalá, el pueblo. Antes de decidir hay que confirmar la ubicación exacta y que los poderes de compra sigan operando.
- **CEMIN Catemu** es privada y su compra estuvo en duda en 2023. No se usa como destino.
- **A\*** significa faena grande en concesión vigente de terceros. Ahí el camino es arrendar o comprar, no pedir.
