import { useState } from "react";
import { MapContainer, TileLayer, GeoJSON, LayersControl, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import {
  ILLAPEL_CENTER,
  ILLAPEL_GEOLOGY,
  ILLAPEL_LEGEND,
  ILLAPEL_STRUCTURES,
  LV5_TARGETS,
  type IllapelUnitProps,
} from "@/data/geo/lv5_illapel_geology";

const { BaseLayer, Overlay } = LayersControl;

export function Lv5Page5Preview() {
  const [opacity, setOpacity] = useState(0.55);

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full">
      {/* Mapa */}
      <div className="flex-1 min-h-[480px] rounded-lg overflow-hidden border border-gold/30 relative">
        <MapContainer
          center={ILLAPEL_CENTER}
          zoom={12}
          style={{ height: "100%", width: "100%", background: "#0a0a0a" }}
          scrollWheelZoom
        >
          <LayersControl position="topright">
            <BaseLayer checked name="ESRI World Imagery">
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                attribution="Esri, Maxar, Earthstar Geographics"
                maxZoom={19}
              />
            </BaseLayer>
            <BaseLayer name="ESRI Topo">
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"
                attribution="Esri Topo"
              />
            </BaseLayer>

            <Overlay checked name="Geología Illapel (sintética)">
              <GeoJSON
                data={ILLAPEL_GEOLOGY}
                style={(f) => {
                  const p = f?.properties as IllapelUnitProps;
                  return {
                    color: p.color,
                    weight: 1.2,
                    fillColor: p.color,
                    fillOpacity: opacity,
                  };
                }}
                onEachFeature={(feature, layer) => {
                  const p = feature.properties as IllapelUnitProps;
                  layer.bindTooltip(
                    `<b>${p.code} — ${p.name}</b><br/>${p.age}<br/>${p.lithology}`,
                    { sticky: true },
                  );
                }}
              />
            </Overlay>

            <Overlay checked name="Lineamientos NW-SE">
              <GeoJSON
                data={ILLAPEL_STRUCTURES}
                style={{ color: "#ff4d4d", weight: 2, dashArray: "6 4" }}
                onEachFeature={(feature, layer) => {
                  layer.bindTooltip(String(feature.properties?.name ?? "Lineamiento"), {
                    sticky: true,
                  });
                }}
              />
            </Overlay>

            <Overlay checked name="Targets LV-5">
              <GeoJSON
                data={LV5_TARGETS}
                style={{
                  color: "#ffd166",
                  weight: 2,
                  fillColor: "#ffd166",
                  fillOpacity: 0.5,
                }}
                onEachFeature={(feature, layer) => {
                  const p = feature.properties as { name: string; rank: string };
                  layer.bindTooltip(`<b>${p.name}</b> · Rank ${p.rank}`, { sticky: true });
                }}
              />
            </Overlay>
          </LayersControl>
        </MapContainer>
      </div>

      {/* Leyenda */}
      <aside className="w-full lg:w-72 shrink-0 space-y-4 text-xs font-mono">
        <div className="rounded-lg border border-gold/30 p-3 bg-card/40">
          <h3 className="text-gold uppercase tracking-wider mb-2">
            Página 5 · Esquema geológico
          </h3>
          <p className="text-muted-foreground leading-relaxed">
            Vista interactiva equivalente a la carta SERNAGEOMIN renderizada en el PDF
            v3.1: unidades de la Hoja Illapel 1:250.000 sobre imagen satelital ESRI.
          </p>
        </div>

        <div className="rounded-lg border border-gold/30 p-3 bg-card/40 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-gold uppercase">Opacidad geología</span>
            <span className="text-muted-foreground">{Math.round(opacity * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={opacity}
            onChange={(e) => setOpacity(Number(e.target.value))}
            className="w-full accent-amber-400"
          />
        </div>

        <div className="rounded-lg border border-gold/30 p-3 bg-card/40">
          <h4 className="text-gold uppercase mb-2">Unidades litoestratigráficas</h4>
          <ul className="space-y-2">
            {ILLAPEL_LEGEND.map((u) => (
              <li key={u.code} className="flex gap-2">
                <span
                  className="inline-block w-4 h-4 rounded-sm border border-black/30 shrink-0 mt-0.5"
                  style={{ background: u.color }}
                />
                <div>
                  <div className="text-foreground">
                    <b>{u.code}</b> — {u.name}
                  </div>
                  <div className="text-muted-foreground">
                    {u.age} · {u.lithology}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-gold/30 p-3 bg-card/40 space-y-1">
          <h4 className="text-gold uppercase mb-1">Estructuras y targets</h4>
          <div className="flex items-center gap-2">
            <span className="inline-block w-6 border-t-2 border-dashed border-red-500" />
            <span>Lineamientos NW-SE</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="inline-block w-4 h-4 rounded-sm border border-black/30"
              style={{ background: "#ffd166" }}
            />
            <span>Targets LV-5 (V-Castellana · V-La Guanaca)</span>
          </div>
        </div>
      </aside>
    </div>
  );
}
