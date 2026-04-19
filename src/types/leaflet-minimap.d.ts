declare module "leaflet-minimap" {
  const MiniMap: new (layer: unknown, opts?: Record<string, unknown>) => {
    addTo: (map: unknown) => unknown;
  };
  export default MiniMap;
}
declare module "leaflet-minimap/dist/Control.MiniMap.min.css";
