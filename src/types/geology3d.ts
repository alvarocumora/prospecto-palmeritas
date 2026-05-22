export type GeologyStructureType =
  | "fault"
  | "vein"
  | "lithology"
  | "alteration"
  | "ore_body"
  | "intrusion"
  | "shear_zone"
  | "drill_trace";

export type Vec3 = {
  x: number;
  y: number;
  z: number;
};

export type GeologyVertex = Vec3 & {
  id?: string;
};

export type Geology3DStructure = {
  id: string;
  type: GeologyStructureType;
  name: string;
  vertices: GeologyVertex[];
  color?: string | null;
  opacity?: number | null;
  strikeDeg?: number | null;
  dipDeg?: number | null;
  thicknessM?: number | null;
  depthFromM?: number | null;
  depthToM?: number | null;
  confidence?: number | null;
  metadata?: Record<string, unknown>;
};

export type GeologyStructureBounds = {
  min: Vec3;
  max: Vec3;
  width: number;
  height: number;
  depth: number;
};
