import { Layers, MapPin } from "lucide-react";
import { ProjectMap } from "@/components/ProjectMap";
import { Card, SectionTitle } from "./primitives";
import { CrossSection, MetricsGrid, OperationalAlerts, ProjectHero, ProjectTimeline } from "./overview";

export function OverviewTab() {
  return (
    <div className="space-y-6">
      <ProjectHero />
      <MetricsGrid />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ProjectTimeline />
        <OperationalAlerts />
      </div>

      <Card delay={300} className="p-6">
        <SectionTitle icon={MapPin} sub="Vetas · Palmeras · Collares DDH">
          Mapa Geológico Interactivo
        </SectionTitle>
        <ProjectMap />
      </Card>

      <Card delay={400} className="p-6">
        <SectionTitle icon={Layers} sub="Profundidad 0–300 m">
          Sección Esquemática Vertical
        </SectionTitle>
        <CrossSection />
      </Card>
    </div>
  );
}
