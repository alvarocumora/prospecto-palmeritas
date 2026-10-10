import { useMemo } from "react";
import { ProjectTerrain3D } from "@/components/geo/ProjectTerrain3D";
import { ProjectDocsMenu } from "@/components/documents/ProjectDocsMenu";
import { buildCholquiDoc } from "@/lib/pdf/adapters/cholqui";
import { buildCholquiPublicGeoBundle } from "../cholquiPublicGeo";
import { useSentinelRasterPreview } from "@/hooks/useSentinelRasterPreview";
import { CHOLQUI, CHOLQUI_POINTS, LAS_MINITAS } from "../data/cholqui";
import { CHOLQUI_COORDINATE_NOTICE, CHOLQUI_INTERPOLATION_NOTICE } from "../cholquiGeoPolicy";

/** Cholqui evidence configuration; all terrain rendering lives in the shared engine. */
export function CholquiTerrain3D() {
  const { data: satellitePreview } = useSentinelRasterPreview(
    "e5360f13-1647-4e44-bb13-c0614e6f39fe",
  );
  const bundle = useMemo(
    () =>
      buildCholquiPublicGeoBundle(
        satellitePreview as Parameters<typeof buildCholquiPublicGeoBundle>[0],
      ),
    [satellitePreview],
  );
  return (
    <ProjectTerrain3D
      slug="Cholqui"
      projectId="e5360f13-1647-4e44-bb13-c0614e6f39fe"
      center={CHOLQUI.center}
      extentMeters={20000}
      demSize={257}
      evidenceBundle={bundle}
      observationPoints={CHOLQUI_POINTS}
      neighbourDeposit={LAS_MINITAS}
      coordinateNotice={CHOLQUI_COORDINATE_NOTICE}
      interpolationNotice={CHOLQUI_INTERPOLATION_NOTICE}
      documentMenu={
        <ProjectDocsMenu
          build={buildCholquiDoc}
          label="Informe geocientífico"
          variant="outline"
          className="h-9 text-xs"
        />
      }
    />
  );
}
