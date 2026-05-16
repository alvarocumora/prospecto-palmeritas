import { useEffect } from "react";
import { Circle, CircleMarker, Tooltip, useMap } from "react-leaflet";
import type { GeoPosition } from "@/hooks/useGeolocation";

export function UserLocationLayer({
  position,
  follow,
}: {
  position: GeoPosition | null;
  follow: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (!follow || !position) return;
    const z = Math.max(map.getZoom(), 15);
    map.setView([position.lat, position.lng], z, { animate: true });
  }, [position, follow, map]);

  if (!position) return null;

  return (
    <>
      <Circle
        center={[position.lat, position.lng]}
        radius={Math.max(5, position.accuracy)}
        pathOptions={{ color: "#38bdf8", weight: 1, fillColor: "#38bdf8", fillOpacity: 0.12 }}
      />
      <CircleMarker
        center={[position.lat, position.lng]}
        radius={7}
        pathOptions={{ color: "#ffffff", weight: 2, fillColor: "#38bdf8", fillOpacity: 1 }}
      >
        <Tooltip direction="top" offset={[0, -6]} opacity={0.95}>
          <div className="text-[10px] font-mono">
            <div className="font-semibold">Tu posición</div>
            <div>±{position.accuracy.toFixed(0)} m</div>
          </div>
        </Tooltip>
      </CircleMarker>
    </>
  );
}
