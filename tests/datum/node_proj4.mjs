// Puente proj4js para la comparación de motores (B1). Lee de stdin un array
// [{e,n,huso}] (PSAD56 UTM) y devuelve [[lon,lat],...] en WGS84 usando la MISMA
// transformación que SERNAGEOMIN (EPSG:1204, towgs84=-288,175,-376).
// Se ejecuta desde la raíz del repo para resolver proj4 de node_modules.
import proj4 from "proj4";

let input = "";
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", () => {
  const pts = JSON.parse(input);
  const out = pts.map((p) => {
    const def = `+proj=utm +zone=${p.huso} +south +ellps=intl +towgs84=-288,175,-376,0,0,0,0 +units=m +no_defs`;
    const [lon, lat] = proj4(def, "EPSG:4326", [p.e, p.n]);
    return [lon, lat];
  });
  process.stdout.write(JSON.stringify(out));
});
