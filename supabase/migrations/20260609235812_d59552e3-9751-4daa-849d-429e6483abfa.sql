
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
  bbox geometry;
  result jsonb;
BEGIN
  -- Concessions (top by score, with geometry)
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
  concessions_fc AS (
    SELECT jsonb_build_object(
      'type','FeatureCollection',
      'features', COALESCE(jsonb_agg(jsonb_build_object(
        'type','Feature',
        'geometry', ST_AsGeoJSON(ST_Transform(geom, 4326))::jsonb,
        'properties', jsonb_build_object(
          'id', id,
          'concession_id', concession_id,
          'name', concession_name,
          'score', score,
          'commodity_hint', commodity_hint,
          'holder_name', holder_name,
          'region', region,
          'commune', commune,
          'area_ha', area_ha,
          'deposit_proximity_km', deposit_proximity_km,
          'anomaly_overlap_count', anomaly_overlap_count,
          'expiry_risk', expiry_risk,
          'ai_thesis', ai_thesis,
          'ai_action', ai_action
        )
      )), '[]'::jsonb)
    ) AS fc,
    ST_Extent(ST_Transform(geom, 4326)) AS env
    FROM top_opp
  )
  SELECT fc, env::geometry INTO result, bbox FROM concessions_fc;

  -- Expand bbox a bit (~0.5 deg) to grab nearby features
  IF bbox IS NOT NULL THEN
    bbox := ST_Expand(bbox, 0.5);
  END IF;

  RETURN jsonb_build_object(
    'concessions', result,
    'bbox', CASE WHEN bbox IS NULL THEN NULL ELSE jsonb_build_array(
      ST_XMin(bbox), ST_YMin(bbox), ST_XMax(bbox), ST_YMax(bbox)
    ) END,
    'anomalies', (
      SELECT jsonb_build_object(
        'type','FeatureCollection',
        'features', COALESCE(jsonb_agg(jsonb_build_object(
          'type','Feature',
          'geometry', ST_AsGeoJSON(ST_Transform(a.geom, 4326))::jsonb,
          'properties', jsonb_build_object(
            'id', a.id,
            'kind', a.anomaly_type,
            'confidence', a.confidence
          )
        )), '[]'::jsonb)
      )
      FROM public.satellite_anomalies a
      WHERE a.geom IS NOT NULL
        AND (bbox IS NULL OR ST_Intersects(ST_Transform(a.geom, 4326), bbox))
      LIMIT 500
    ),
    'deposits', (
      SELECT jsonb_build_object(
        'type','FeatureCollection',
        'features', COALESCE(jsonb_agg(jsonb_build_object(
          'type','Feature',
          'geometry', jsonb_build_object('type','Point','coordinates', jsonb_build_array(d.lng, d.lat)),
          'properties', jsonb_build_object(
            'id', d.id,
            'name', d.name,
            'commodity', d.primary_commodity,
            'dev_status', d.dev_status
          )
        )), '[]'::jsonb)
      )
      FROM public.mineral_deposits d
      WHERE d.lat IS NOT NULL AND d.lng IS NOT NULL
        AND (bbox IS NULL OR ST_Intersects(ST_SetSRID(ST_MakePoint(d.lng, d.lat), 4326), bbox))
      LIMIT 500
    ),
    'targets', (
      SELECT jsonb_build_object(
        'type','FeatureCollection',
        'features', COALESCE(jsonb_agg(jsonb_build_object(
          'type','Feature',
          'geometry', CASE
            WHEN t.geom IS NOT NULL THEN ST_AsGeoJSON(ST_Transform(t.geom, 4326))::jsonb
            WHEN t.lat IS NOT NULL AND t.lng IS NOT NULL THEN jsonb_build_object('type','Point','coordinates', jsonb_build_array(t.lng, t.lat))
            ELSE NULL
          END,
          'properties', jsonb_build_object(
            'id', t.id,
            'name', t.name,
            'commodity', t.commodity,
            'stage', t.stage,
            'priority', t.priority,
            'score', t.score
          )
        )) FILTER (WHERE t.geom IS NOT NULL OR (t.lat IS NOT NULL AND t.lng IS NOT NULL)), '[]'::jsonb)
      )
      FROM public.exploration_targets t
      WHERE (
        (t.geom IS NOT NULL AND (bbox IS NULL OR ST_Intersects(ST_Transform(t.geom, 4326), bbox)))
        OR
        (t.lat IS NOT NULL AND t.lng IS NOT NULL AND (bbox IS NULL OR ST_Intersects(ST_SetSRID(ST_MakePoint(t.lng, t.lat), 4326), bbox)))
      )
      LIMIT 500
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.opportunities_geo(int, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.opportunities_geo(int, numeric, text) TO authenticated, service_role;
