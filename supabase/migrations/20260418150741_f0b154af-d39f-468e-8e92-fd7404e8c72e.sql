-- =========================================================
-- Ship 3 — Geological knowledge base for Prospecto Palmeras
-- =========================================================

-- ---------- references ----------
CREATE TABLE public.geo_references (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  citation_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  authors TEXT,
  year INTEGER,
  publisher TEXT,
  url TEXT,
  doi TEXT,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.geo_references ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view geo_references"
  ON public.geo_references FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert own geo_references"
  ON public.geo_references FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Owner can update geo_references"
  ON public.geo_references FOR UPDATE TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "Owner can delete geo_references"
  ON public.geo_references FOR DELETE TO authenticated USING (auth.uid() = created_by);

CREATE TRIGGER trg_geo_references_updated_at
  BEFORE UPDATE ON public.geo_references
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- lithology units ----------
CREATE TABLE public.lithology_units (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  unit_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  age TEXT,
  formation TEXT,
  rock_type TEXT,
  description TEXT,
  color_hex TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  source TEXT,
  reference_id UUID REFERENCES public.geo_references(id) ON DELETE SET NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lithology_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view lithology_units"
  ON public.lithology_units FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert own lithology_units"
  ON public.lithology_units FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Owner can update lithology_units"
  ON public.lithology_units FOR UPDATE TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "Owner can delete lithology_units"
  ON public.lithology_units FOR DELETE TO authenticated USING (auth.uid() = created_by);

CREATE TRIGGER trg_lithology_units_updated_at
  BEFORE UPDATE ON public.lithology_units
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- alteration zones ----------
CREATE TABLE public.alteration_zones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  zone_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  assemblage TEXT,
  intensity TEXT,
  description TEXT,
  color_hex TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  source TEXT,
  reference_id UUID REFERENCES public.geo_references(id) ON DELETE SET NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.alteration_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view alteration_zones"
  ON public.alteration_zones FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert own alteration_zones"
  ON public.alteration_zones FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Owner can update alteration_zones"
  ON public.alteration_zones FOR UPDATE TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "Owner can delete alteration_zones"
  ON public.alteration_zones FOR DELETE TO authenticated USING (auth.uid() = created_by);

CREATE TRIGGER trg_alteration_zones_updated_at
  BEFORE UPDATE ON public.alteration_zones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- mineralogy ----------
CREATE TABLE public.mineralogy (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mineral TEXT NOT NULL,
  formula TEXT,
  category TEXT,                    -- ore | gangue | alteration | accessory
  paragenetic_stage TEXT,           -- early | main | late | supergene
  abundance TEXT,                   -- trace | minor | moderate | major
  occurrence TEXT,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  source TEXT,
  reference_id UUID REFERENCES public.geo_references(id) ON DELETE SET NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.mineralogy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view mineralogy"
  ON public.mineralogy FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert own mineralogy"
  ON public.mineralogy FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Owner can update mineralogy"
  ON public.mineralogy FOR UPDATE TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "Owner can delete mineralogy"
  ON public.mineralogy FOR DELETE TO authenticated USING (auth.uid() = created_by);

CREATE TRIGGER trg_mineralogy_updated_at
  BEFORE UPDATE ON public.mineralogy
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- geological features (generic spatial knowledge) ----------
CREATE TABLE public.geological_features (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  feature_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  feature_type TEXT NOT NULL,       -- vein | fault | contact | shear | dyke | aoi | other
  strike TEXT,
  dip TEXT,
  length_m NUMERIC,
  width_m NUMERIC,
  description TEXT,
  geometry_geojson JSONB,           -- GeoJSON Geometry (Point/LineString/Polygon)
  lithology_id UUID REFERENCES public.lithology_units(id) ON DELETE SET NULL,
  alteration_id UUID REFERENCES public.alteration_zones(id) ON DELETE SET NULL,
  source TEXT,
  reference_id UUID REFERENCES public.geo_references(id) ON DELETE SET NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.geological_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view geological_features"
  ON public.geological_features FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert own geological_features"
  ON public.geological_features FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Owner can update geological_features"
  ON public.geological_features FOR UPDATE TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "Owner can delete geological_features"
  ON public.geological_features FOR DELETE TO authenticated USING (auth.uid() = created_by);

CREATE TRIGGER trg_geological_features_updated_at
  BEFORE UPDATE ON public.geological_features
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_geological_features_type ON public.geological_features(feature_type);
CREATE INDEX idx_lithology_units_order ON public.lithology_units(display_order);
CREATE INDEX idx_alteration_zones_order ON public.alteration_zones(display_order);
CREATE INDEX idx_mineralogy_order ON public.mineralogy(display_order);
