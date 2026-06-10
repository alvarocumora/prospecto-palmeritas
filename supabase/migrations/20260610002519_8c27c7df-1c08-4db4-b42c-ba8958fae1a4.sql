CREATE OR REPLACE FUNCTION public.opportunities_geo(
  _limit int DEFAULT 200,
  _min_score numeric DEFAULT 0,
  _region text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _bbox geometry;
  result jsonb;
  has_opps boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.cadastre_opportunities LIMIT 1) INTO has_opps;

  IF has_opps THEN
    WITH top_opp AS (
      SELECT o.id, o.concession_id, o.score, o.commodity_hint, o.holder_name,
             o.region, o.commune, o.area_ha, o.deposit_proximity_km,
             o.anomaly_overlap_count, o.expiry_risk, o.ai_thesis, o.ai_action,
             c.name AS concession_name, c.geom AS geom
      FROM public.cadastre_opportunities o
      JOIN public.cadastre_national c ON c.id = o.concession_id
      WHERE o.score >= COALESCE(_min_score, 0)
        AND (_region IS NULL OR o.region = _region)
        AND c.geom IS NOT NULL
      ORDER BY o.score DESC
      LIMIT _limit
    ),
    fc AS (
      SELECT jsonb_build_object(
        'type','FeatureCollection',
        'features', COALESCE(jsonb_agg(jsonb_build_object(
          'type','Feature',
          'geometry', ST_AsGeoJSON(ST_Transform(geom, 4326))::jsonb,
          'properties', jsonb_build_object(
            'id', id, 'concession_id', concession_id, 'name', concession_name,
            'score', score, 'commodity_hint', commodity_hint, 'holder_name', holder_name,
            'region', region, 'commune', commune, 'area_ha', area_ha,
            'deposit_proximity_km', deposit_proximity_km,
            'anomaly_overlap_count', anomaly_overlap_count,
            'expiry_risk', expiry_risk, 'ai_thesis', ai_thesis, 'ai_action', ai_action
          )
        )), '[]'::jsonb)
      ) AS fc,
      ST_Extent(ST_Transform(geom, 4326)) AS env
      FROM top_opp
    )
    SELECT fc.fc, fc.env::geometry INTO result, _bbox FROM fc;
  ELSE
    WITH top_conc AS (
      SELECT c.id, c.name, c.region, c.commune, c.area_ha, c.holder_name,
             c.tipo, c.status, c.geom
      FROM public.cadastre_national c
      WHERE c.geom IS NOT NULL
        AND (_region IS NULL OR c.region = _region)
        AND c.area_ha IS NOT NULL
      ORDER BY c.area_ha DESC NULLS LAST
      LIMIT _limit
    ),
    fc AS (
      SELECT jsonb_build_object(
        'type','FeatureCollection',
        'features', COALESCE(jsonb_agg(jsonb_build_object(
          'type','Feature',
          'geometry', ST_AsGeoJSON(ST_Transform(geom, 4326))::jsonb,
          'properties', jsonb_build_object(
            'id', id, 'concession_id', id, 'name', name,
            'score', LEAST(95::numeric, GREATEST(40::numeric, (area_ha / 50.0)::numeric))::numeric(6,2),
            'commodity_hint', NULL, 'holder_name', holder_name,
            'region', region, 'commune', commune, 'area_ha', area_ha,
            'deposit_proximity_km', NULL, 'anomaly_overlap_count', 0,
            'expiry_risk', NULL,
            'ai_thesis', NULL, 'ai_action', NULL,
            'tipo', tipo, 'status', status
          )
        )), '[]'::jsonb)
      ) AS fc,
      ST_Extent(ST_Transform(geom, 4326)) AS env
      FROM top_conc
    )
    SELECT fc.fc, fc.env::geometry INTO result, _bbox FROM fc;
  END IF;

  IF _bbox IS NOT NULL THEN
    _bbox := ST_Expand(_bbox, 0.5);
  END IF;

  RETURN jsonb_build_object(
    'concessions', result,
    'bbox', CASE WHEN _bbox IS NULL THEN NULL ELSE jsonb_build_array(
      ST_XMin(_bbox), ST_YMin(_bbox), ST_XMax(_bbox), ST_YMax(_bbox)
    ) END,
    'anomalies', (
      SELECT jsonb_build_object(
        'type','FeatureCollection',
        'features', COALESCE(jsonb_agg(jsonb_build_object(
          'type','Feature',
          'geometry', a.geometry,
          'properties', jsonb_build_object(
            'id', a.id, 'kind', a.index_code,
            'severity', a.severity, 'score', a.score
          )
        )), '[]'::jsonb)
      )
      FROM (
        SELECT id, index_code, severity, score, geometry
        FROM public.satellite_anomalies
        WHERE geometry IS NOT NULL
        LIMIT 500
      ) a
    ),
    'deposits', (
      SELECT jsonb_build_object(
        'type','FeatureCollection',
        'features', COALESCE(jsonb_agg(jsonb_build_object(
          'type','Feature',
          'geometry', jsonb_build_object('type','Point','coordinates', jsonb_build_array(d.lng, d.lat)),
          'properties', jsonb_build_object(
            'id', d.id, 'name', d.name,
            'commodity', d.primary_commodity, 'dev_status', d.dev_status
          )
        )), '[]'::jsonb)
      )
      FROM public.mineral_deposits d
      WHERE d.lat IS NOT NULL AND d.lng IS NOT NULL
        AND (_bbox IS NULL OR ST_Intersects(ST_SetSRID(ST_MakePoint(d.lng, d.lat), 4326), _bbox))
      LIMIT 500
    ),
    'targets', (
      SELECT jsonb_build_object(
        'type','FeatureCollection',
        'features', COALESCE(jsonb_agg(jsonb_build_object(
          'type','Feature',
          'geometry', jsonb_build_object('type','Point','coordinates', jsonb_build_array(t.lng, t.lat)),
          'properties', jsonb_build_object(
            'id', t.id, 'name', t.name, 'commodity', t.commodity,
            'stage', t.stage, 'priority', t.priority, 'score', t.score
          )
        )), '[]'::jsonb)
      )
      FROM public.exploration_targets t
      WHERE t.lat IS NOT NULL AND t.lng IS NOT NULL
        AND (_bbox IS NULL OR ST_Intersects(ST_SetSRID(ST_MakePoint(t.lng, t.lat), 4326), _bbox))
      LIMIT 500
    )
  );
END;
$$;