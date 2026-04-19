export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      alteration_zones: {
        Row: {
          assemblage: string | null
          color_hex: string | null
          created_at: string
          created_by: string
          description: string | null
          display_order: number
          id: string
          intensity: string | null
          name: string
          project_id: string | null
          reference_id: string | null
          source: string | null
          updated_at: string
          zone_code: string
        }
        Insert: {
          assemblage?: string | null
          color_hex?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          display_order?: number
          id?: string
          intensity?: string | null
          name: string
          project_id?: string | null
          reference_id?: string | null
          source?: string | null
          updated_at?: string
          zone_code: string
        }
        Update: {
          assemblage?: string | null
          color_hex?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          display_order?: number
          id?: string
          intensity?: string | null
          name?: string
          project_id?: string | null
          reference_id?: string | null
          source?: string | null
          updated_at?: string
          zone_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "alteration_zones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alteration_zones_reference_id_fkey"
            columns: ["reference_id"]
            isOneToOne: false
            referencedRelation: "geo_references"
            referencedColumns: ["id"]
          },
        ]
      }
      app_roles: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          payload: Json | null
          project_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          payload?: Json | null
          project_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          payload?: Json | null
          project_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      campaign_budgets: {
        Row: {
          campaign_id: string
          category: string
          created_at: string
          created_by: string
          id: string
          notes: string | null
          planned_amount_usd: number
          project_id: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          category: string
          created_at?: string
          created_by: string
          id?: string
          notes?: string | null
          planned_amount_usd?: number
          project_id: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          category?: string
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          planned_amount_usd?: number
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_budgets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "exploration_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_budgets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_expenses: {
        Row: {
          amount_usd: number
          approved_at: string | null
          approved_by: string | null
          campaign_id: string
          category: string
          created_at: string
          created_by: string
          description: string
          expense_date: string
          hole_id: string | null
          id: string
          invoice_number: string | null
          meters_drilled: number | null
          notes: string | null
          project_id: string
          status: string
          updated_at: string
          vendor: string | null
        }
        Insert: {
          amount_usd?: number
          approved_at?: string | null
          approved_by?: string | null
          campaign_id: string
          category: string
          created_at?: string
          created_by: string
          description: string
          expense_date?: string
          hole_id?: string | null
          id?: string
          invoice_number?: string | null
          meters_drilled?: number | null
          notes?: string | null
          project_id: string
          status?: string
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          amount_usd?: number
          approved_at?: string | null
          approved_by?: string | null
          campaign_id?: string
          category?: string
          created_at?: string
          created_by?: string
          description?: string
          expense_date?: string
          hole_id?: string | null
          id?: string
          invoice_number?: string | null
          meters_drilled?: number | null
          notes?: string | null
          project_id?: string
          status?: string
          updated_at?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_expenses_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "exploration_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_expenses_hole_id_fkey"
            columns: ["hole_id"]
            isOneToOne: false
            referencedRelation: "drill_holes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      community_events: {
        Row: {
          attendees: number | null
          commitments: string | null
          community_name: string
          created_at: string
          created_by: string
          event_date: string
          event_type: string
          follow_up_date: string | null
          id: string
          project_id: string
          status: string
          summary: string
          updated_at: string
        }
        Insert: {
          attendees?: number | null
          commitments?: string | null
          community_name: string
          created_at?: string
          created_by: string
          event_date?: string
          event_type: string
          follow_up_date?: string | null
          id?: string
          project_id: string
          status?: string
          summary: string
          updated_at?: string
        }
        Update: {
          attendees?: number | null
          commitments?: string | null
          community_name?: string
          created_at?: string
          created_by?: string
          event_date?: string
          event_type?: string
          follow_up_date?: string | null
          id?: string
          project_id?: string
          status?: string
          summary?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      core_boxes: {
        Row: {
          box_code: string
          box_number: number | null
          condition: string
          created_at: string
          created_by: string
          depth_from: number | null
          depth_to: number | null
          hole_id: string | null
          id: string
          notes: string | null
          photo_urls: string[] | null
          position: string | null
          project_id: string
          rack: string | null
          shelf: string | null
          status: string
          storage_location: string | null
          updated_at: string
        }
        Insert: {
          box_code: string
          box_number?: number | null
          condition?: string
          created_at?: string
          created_by: string
          depth_from?: number | null
          depth_to?: number | null
          hole_id?: string | null
          id?: string
          notes?: string | null
          photo_urls?: string[] | null
          position?: string | null
          project_id: string
          rack?: string | null
          shelf?: string | null
          status?: string
          storage_location?: string | null
          updated_at?: string
        }
        Update: {
          box_code?: string
          box_number?: number | null
          condition?: string
          created_at?: string
          created_by?: string
          depth_from?: number | null
          depth_to?: number | null
          hole_id?: string | null
          id?: string
          notes?: string | null
          photo_urls?: string[] | null
          position?: string | null
          project_id?: string
          rack?: string | null
          shelf?: string | null
          status?: string
          storage_location?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "core_boxes_hole_id_fkey"
            columns: ["hole_id"]
            isOneToOne: false
            referencedRelation: "drill_holes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "core_boxes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      drill_core_logs: {
        Row: {
          ag_gpt: number | null
          alteration: string | null
          approved_at: string | null
          approved_by: string | null
          au_gpt: number | null
          created_at: string
          created_by: string
          cu_pct: number | null
          depth_from: number
          depth_to: number
          hole_id: string
          id: string
          lithology: string | null
          mineralization: string | null
          notes: string | null
          project_id: string | null
          record_status: string
          recovery_pct: number | null
          rqd_pct: number | null
          structure: string | null
          sulfide_pct: number | null
          updated_at: string
          vein_pct: number | null
        }
        Insert: {
          ag_gpt?: number | null
          alteration?: string | null
          approved_at?: string | null
          approved_by?: string | null
          au_gpt?: number | null
          created_at?: string
          created_by: string
          cu_pct?: number | null
          depth_from: number
          depth_to: number
          hole_id: string
          id?: string
          lithology?: string | null
          mineralization?: string | null
          notes?: string | null
          project_id?: string | null
          record_status?: string
          recovery_pct?: number | null
          rqd_pct?: number | null
          structure?: string | null
          sulfide_pct?: number | null
          updated_at?: string
          vein_pct?: number | null
        }
        Update: {
          ag_gpt?: number | null
          alteration?: string | null
          approved_at?: string | null
          approved_by?: string | null
          au_gpt?: number | null
          created_at?: string
          created_by?: string
          cu_pct?: number | null
          depth_from?: number
          depth_to?: number
          hole_id?: string
          id?: string
          lithology?: string | null
          mineralization?: string | null
          notes?: string | null
          project_id?: string | null
          record_status?: string
          recovery_pct?: number | null
          rqd_pct?: number | null
          structure?: string | null
          sulfide_pct?: number | null
          updated_at?: string
          vein_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "drill_core_logs_hole_id_fkey"
            columns: ["hole_id"]
            isOneToOne: false
            referencedRelation: "drill_holes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drill_core_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      drill_holes: {
        Row: {
          actual_depth: number | null
          azimuth: number | null
          campaign_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          dip: number | null
          easting: number | null
          elevation: number | null
          hole_id: string
          id: string
          northing: number | null
          notes: string | null
          planned_depth: number | null
          project_id: string | null
          started_at: string | null
          status: string
          target_zone: string | null
          updated_at: string
        }
        Insert: {
          actual_depth?: number | null
          azimuth?: number | null
          campaign_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          dip?: number | null
          easting?: number | null
          elevation?: number | null
          hole_id: string
          id?: string
          northing?: number | null
          notes?: string | null
          planned_depth?: number | null
          project_id?: string | null
          started_at?: string | null
          status?: string
          target_zone?: string | null
          updated_at?: string
        }
        Update: {
          actual_depth?: number | null
          azimuth?: number | null
          campaign_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          dip?: number | null
          easting?: number | null
          elevation?: number | null
          hole_id?: string
          id?: string
          northing?: number | null
          notes?: string | null
          planned_depth?: number | null
          project_id?: string | null
          started_at?: string | null
          status?: string
          target_zone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drill_holes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "exploration_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drill_holes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      drone_flights: {
        Row: {
          altitude_m: number | null
          area_ha: number | null
          campaign_id: string | null
          created_at: string
          created_by: string
          flown_at: string | null
          geometry_geojson: Json | null
          id: string
          name: string
          notes: string | null
          pilot: string | null
          project_id: string
          sensor: string
          updated_at: string
        }
        Insert: {
          altitude_m?: number | null
          area_ha?: number | null
          campaign_id?: string | null
          created_at?: string
          created_by: string
          flown_at?: string | null
          geometry_geojson?: Json | null
          id?: string
          name: string
          notes?: string | null
          pilot?: string | null
          project_id: string
          sensor?: string
          updated_at?: string
        }
        Update: {
          altitude_m?: number | null
          area_ha?: number | null
          campaign_id?: string | null
          created_at?: string
          created_by?: string
          flown_at?: string | null
          geometry_geojson?: Json | null
          id?: string
          name?: string
          notes?: string | null
          pilot?: string | null
          project_id?: string
          sensor?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drone_flights_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "exploration_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drone_flights_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      drone_rasters: {
        Row: {
          bounds_geojson: Json | null
          campaign_id: string | null
          captured_at: string | null
          created_at: string
          created_by: string
          flight_id: string | null
          id: string
          name: string
          notes: string | null
          project_id: string
          raster_type: string
          updated_at: string
          url: string
        }
        Insert: {
          bounds_geojson?: Json | null
          campaign_id?: string | null
          captured_at?: string | null
          created_at?: string
          created_by: string
          flight_id?: string | null
          id?: string
          name: string
          notes?: string | null
          project_id: string
          raster_type?: string
          updated_at?: string
          url: string
        }
        Update: {
          bounds_geojson?: Json | null
          campaign_id?: string | null
          captured_at?: string | null
          created_at?: string
          created_by?: string
          flight_id?: string | null
          id?: string
          name?: string
          notes?: string | null
          project_id?: string
          raster_type?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "drone_rasters_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "exploration_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drone_rasters_flight_id_fkey"
            columns: ["flight_id"]
            isOneToOne: false
            referencedRelation: "drone_flights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drone_rasters_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      exploration_campaigns: {
        Row: {
          aoi_geojson: Json | null
          created_at: string
          created_by: string
          ended_at: string | null
          id: string
          lead_user_id: string | null
          name: string
          notes: string | null
          phase: string
          project_id: string
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          aoi_geojson?: Json | null
          created_at?: string
          created_by: string
          ended_at?: string | null
          id?: string
          lead_user_id?: string | null
          name: string
          notes?: string | null
          phase?: string
          project_id: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          aoi_geojson?: Json | null
          created_at?: string
          created_by?: string
          ended_at?: string | null
          id?: string
          lead_user_id?: string | null
          name?: string
          notes?: string | null
          phase?: string
          project_id?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exploration_campaigns_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      exploration_targets: {
        Row: {
          assigned_to: string | null
          campaign_id: string | null
          closed_at: string | null
          closed_reason: string | null
          code: string
          commodity: string | null
          confidence_pct: number | null
          created_at: string
          created_by: string
          elevation_m: number | null
          estimated_cost_usd: number | null
          evidence: Json | null
          geometry_geojson: Json | null
          id: string
          lat: number | null
          lng: number | null
          name: string
          notes: string | null
          planned_meters: number | null
          priority: string
          project_id: string
          rationale: string | null
          score: number | null
          stage: string
          target_type: string
          target_zone: string | null
          updated_at: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          assigned_to?: string | null
          campaign_id?: string | null
          closed_at?: string | null
          closed_reason?: string | null
          code: string
          commodity?: string | null
          confidence_pct?: number | null
          created_at?: string
          created_by: string
          elevation_m?: number | null
          estimated_cost_usd?: number | null
          evidence?: Json | null
          geometry_geojson?: Json | null
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          notes?: string | null
          planned_meters?: number | null
          priority?: string
          project_id: string
          rationale?: string | null
          score?: number | null
          stage?: string
          target_type?: string
          target_zone?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          assigned_to?: string | null
          campaign_id?: string | null
          closed_at?: string | null
          closed_reason?: string | null
          code?: string
          commodity?: string | null
          confidence_pct?: number | null
          created_at?: string
          created_by?: string
          elevation_m?: number | null
          estimated_cost_usd?: number | null
          evidence?: Json | null
          geometry_geojson?: Json | null
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          notes?: string | null
          planned_meters?: number | null
          priority?: string
          project_id?: string
          rationale?: string | null
          score?: number | null
          stage?: string
          target_type?: string
          target_zone?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exploration_targets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "exploration_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exploration_targets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      geo_references: {
        Row: {
          authors: string | null
          citation_key: string
          created_at: string
          created_by: string
          doi: string | null
          id: string
          notes: string | null
          project_id: string | null
          publisher: string | null
          title: string
          updated_at: string
          url: string | null
          year: number | null
        }
        Insert: {
          authors?: string | null
          citation_key: string
          created_at?: string
          created_by: string
          doi?: string | null
          id?: string
          notes?: string | null
          project_id?: string | null
          publisher?: string | null
          title: string
          updated_at?: string
          url?: string | null
          year?: number | null
        }
        Update: {
          authors?: string | null
          citation_key?: string
          created_at?: string
          created_by?: string
          doi?: string | null
          id?: string
          notes?: string | null
          project_id?: string | null
          publisher?: string | null
          title?: string
          updated_at?: string
          url?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "geo_references_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      geological_features: {
        Row: {
          alteration_id: string | null
          created_at: string
          created_by: string
          description: string | null
          dip: string | null
          feature_code: string
          feature_type: string
          geometry_geojson: Json | null
          id: string
          length_m: number | null
          lithology_id: string | null
          name: string
          project_id: string | null
          reference_id: string | null
          source: string | null
          strike: string | null
          updated_at: string
          width_m: number | null
        }
        Insert: {
          alteration_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          dip?: string | null
          feature_code: string
          feature_type: string
          geometry_geojson?: Json | null
          id?: string
          length_m?: number | null
          lithology_id?: string | null
          name: string
          project_id?: string | null
          reference_id?: string | null
          source?: string | null
          strike?: string | null
          updated_at?: string
          width_m?: number | null
        }
        Update: {
          alteration_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          dip?: string | null
          feature_code?: string
          feature_type?: string
          geometry_geojson?: Json | null
          id?: string
          length_m?: number | null
          lithology_id?: string | null
          name?: string
          project_id?: string | null
          reference_id?: string | null
          source?: string | null
          strike?: string | null
          updated_at?: string
          width_m?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "geological_features_alteration_id_fkey"
            columns: ["alteration_id"]
            isOneToOne: false
            referencedRelation: "alteration_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geological_features_lithology_id_fkey"
            columns: ["lithology_id"]
            isOneToOne: false
            referencedRelation: "lithology_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geological_features_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geological_features_reference_id_fkey"
            columns: ["reference_id"]
            isOneToOne: false
            referencedRelation: "geo_references"
            referencedColumns: ["id"]
          },
        ]
      }
      geophysics_lines: {
        Row: {
          created_at: string
          created_by: string | null
          geometry_geojson: Json
          id: string
          is_synthetic: boolean
          length_m: number | null
          line_id: string
          notes: string | null
          project_id: string | null
          survey_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          geometry_geojson: Json
          id?: string
          is_synthetic?: boolean
          length_m?: number | null
          line_id: string
          notes?: string | null
          project_id?: string | null
          survey_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          geometry_geojson?: Json
          id?: string
          is_synthetic?: boolean
          length_m?: number | null
          line_id?: string
          notes?: string | null
          project_id?: string | null
          survey_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "geophysics_lines_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geophysics_lines_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "geophysics_surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      geophysics_stations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          ip_chargeability_mvv: number | null
          ip_resistivity_ohmm: number | null
          is_synthetic: boolean
          lat: number
          lng: number
          mag_nt: number | null
          notes: string | null
          project_id: string | null
          station_id: string
          survey_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          ip_chargeability_mvv?: number | null
          ip_resistivity_ohmm?: number | null
          is_synthetic?: boolean
          lat: number
          lng: number
          mag_nt?: number | null
          notes?: string | null
          project_id?: string | null
          station_id: string
          survey_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          ip_chargeability_mvv?: number | null
          ip_resistivity_ohmm?: number | null
          is_synthetic?: boolean
          lat?: number
          lng?: number
          mag_nt?: number | null
          notes?: string | null
          project_id?: string | null
          station_id?: string
          survey_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "geophysics_stations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geophysics_stations_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "geophysics_surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      geophysics_surveys: {
        Row: {
          campaign_id: string | null
          cost_usd: number | null
          created_at: string
          created_by: string | null
          display_order: number
          expected_depth_m: number | null
          id: string
          method: string
          name: string
          notes: string | null
          planned_km: number | null
          project_id: string | null
          station_spacing_m: number | null
          status: string
          updated_at: string
        }
        Insert: {
          campaign_id?: string | null
          cost_usd?: number | null
          created_at?: string
          created_by?: string | null
          display_order?: number
          expected_depth_m?: number | null
          id?: string
          method: string
          name: string
          notes?: string | null
          planned_km?: number | null
          project_id?: string | null
          station_spacing_m?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string | null
          cost_usd?: number | null
          created_at?: string
          created_by?: string | null
          display_order?: number
          expected_depth_m?: number | null
          id?: string
          method?: string
          name?: string
          notes?: string | null
          planned_km?: number | null
          project_id?: string | null
          station_spacing_m?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "geophysics_surveys_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "exploration_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geophysics_surveys_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      hse_incidents: {
        Row: {
          category: string
          closed_at: string | null
          corrective_actions: string | null
          created_at: string
          description: string
          id: string
          location: string | null
          notes: string | null
          occurred_at: string
          people_affected: number
          project_id: string
          reported_by: string
          severity: string
          status: string
          updated_at: string
        }
        Insert: {
          category: string
          closed_at?: string | null
          corrective_actions?: string | null
          created_at?: string
          description: string
          id?: string
          location?: string | null
          notes?: string | null
          occurred_at?: string
          people_affected?: number
          project_id: string
          reported_by: string
          severity?: string
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          closed_at?: string | null
          corrective_actions?: string | null
          created_at?: string
          description?: string
          id?: string
          location?: string | null
          notes?: string | null
          occurred_at?: string
          people_affected?: number
          project_id?: string
          reported_by?: string
          severity?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hse_incidents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      hse_permits: {
        Row: {
          authority: string | null
          created_at: string
          created_by: string
          document_url: string | null
          expires_at: string | null
          id: string
          issued_at: string | null
          notes: string | null
          number: string | null
          permit_type: string
          project_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          authority?: string | null
          created_at?: string
          created_by: string
          document_url?: string | null
          expires_at?: string | null
          id?: string
          issued_at?: string | null
          notes?: string | null
          number?: string | null
          permit_type: string
          project_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          authority?: string | null
          created_at?: string
          created_by?: string
          document_url?: string | null
          expires_at?: string | null
          id?: string
          issued_at?: string | null
          notes?: string | null
          number?: string | null
          permit_type?: string
          project_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hse_permits_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      lithology_units: {
        Row: {
          age: string | null
          color_hex: string | null
          created_at: string
          created_by: string
          description: string | null
          display_order: number
          formation: string | null
          id: string
          name: string
          project_id: string | null
          reference_id: string | null
          rock_type: string | null
          source: string | null
          unit_code: string
          updated_at: string
        }
        Insert: {
          age?: string | null
          color_hex?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          display_order?: number
          formation?: string | null
          id?: string
          name: string
          project_id?: string | null
          reference_id?: string | null
          rock_type?: string | null
          source?: string | null
          unit_code: string
          updated_at?: string
        }
        Update: {
          age?: string | null
          color_hex?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          display_order?: number
          formation?: string | null
          id?: string
          name?: string
          project_id?: string | null
          reference_id?: string | null
          rock_type?: string | null
          source?: string | null
          unit_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lithology_units_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lithology_units_reference_id_fkey"
            columns: ["reference_id"]
            isOneToOne: false
            referencedRelation: "geo_references"
            referencedColumns: ["id"]
          },
        ]
      }
      map_views: {
        Row: {
          center_lat: number | null
          center_lng: number | null
          created_at: string
          id: string
          layer_state: Json
          name: string
          project_id: string
          updated_at: string
          user_id: string
          zoom: number | null
        }
        Insert: {
          center_lat?: number | null
          center_lng?: number | null
          created_at?: string
          id?: string
          layer_state?: Json
          name: string
          project_id: string
          updated_at?: string
          user_id: string
          zoom?: number | null
        }
        Update: {
          center_lat?: number | null
          center_lng?: number | null
          created_at?: string
          id?: string
          layer_state?: Json
          name?: string
          project_id?: string
          updated_at?: string
          user_id?: string
          zoom?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "map_views_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      mineralogy: {
        Row: {
          abundance: string | null
          category: string | null
          created_at: string
          created_by: string
          description: string | null
          display_order: number
          formula: string | null
          id: string
          mineral: string
          occurrence: string | null
          paragenetic_stage: string | null
          project_id: string | null
          reference_id: string | null
          source: string | null
          updated_at: string
        }
        Insert: {
          abundance?: string | null
          category?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          display_order?: number
          formula?: string | null
          id?: string
          mineral: string
          occurrence?: string | null
          paragenetic_stage?: string | null
          project_id?: string | null
          reference_id?: string | null
          source?: string | null
          updated_at?: string
        }
        Update: {
          abundance?: string | null
          category?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          display_order?: number
          formula?: string | null
          id?: string
          mineral?: string
          occurrence?: string | null
          paragenetic_stage?: string | null
          project_id?: string | null
          reference_id?: string | null
          source?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mineralogy_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mineralogy_reference_id_fkey"
            columns: ["reference_id"]
            isOneToOne: false
            referencedRelation: "geo_references"
            referencedColumns: ["id"]
          },
        ]
      }
      mining_concessions: {
        Row: {
          area_ha: number | null
          code: string
          commune: string | null
          concession_type: string
          created_at: string
          created_by: string
          expires_at: string | null
          geometry_geojson: Json | null
          granted_at: string | null
          holder: string | null
          id: string
          name: string
          notes: string | null
          project_id: string
          region: string | null
          source: string | null
          status: string
          updated_at: string
        }
        Insert: {
          area_ha?: number | null
          code: string
          commune?: string | null
          concession_type?: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          geometry_geojson?: Json | null
          granted_at?: string | null
          holder?: string | null
          id?: string
          name: string
          notes?: string | null
          project_id: string
          region?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          area_ha?: number | null
          code?: string
          commune?: string | null
          concession_type?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          geometry_geojson?: Json | null
          granted_at?: string | null
          holder?: string | null
          id?: string
          name?: string
          notes?: string | null
          project_id?: string
          region?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mining_concessions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          certifications: string[] | null
          country: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          language: string | null
          organization: string | null
          phone: string | null
          specialty: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          certifications?: string[] | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          language?: string | null
          organization?: string | null
          phone?: string | null
          specialty?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          certifications?: string[] | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          language?: string | null
          organization?: string | null
          phone?: string | null
          specialty?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          project_id: string
          role: Database["public"]["Enums"]["project_role"]
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          project_id: string
          role?: Database["public"]["Enums"]["project_role"]
          status?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          project_id?: string
          role?: Database["public"]["Enums"]["project_role"]
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_invitations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_member_capabilities: {
        Row: {
          capability: string
          expires_at: string | null
          granted_at: string
          granted_by: string | null
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          capability: string
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          capability?: string
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: []
      }
      project_members: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          project_id: string
          role: Database["public"]["Enums"]["project_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          project_id: string
          role?: Database["public"]["Enums"]["project_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          project_id?: string
          role?: Database["public"]["Enums"]["project_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          center_lat: number | null
          center_lng: number | null
          code: string
          commodity: string | null
          country: string | null
          cover_image_url: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          region: string | null
          status: string
          updated_at: string
        }
        Insert: {
          center_lat?: number | null
          center_lng?: number | null
          code: string
          commodity?: string | null
          country?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          region?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          center_lat?: number | null
          center_lng?: number | null
          code?: string
          commodity?: string | null
          country?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          region?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      prospectivity_cells: {
        Row: {
          cell_lat: number
          cell_lng: number
          cell_size_m: number
          features: Json
          generated_at: string
          generated_by: string | null
          id: string
          project_id: string
          run_id: string
          score: number
        }
        Insert: {
          cell_lat: number
          cell_lng: number
          cell_size_m?: number
          features?: Json
          generated_at?: string
          generated_by?: string | null
          id?: string
          project_id: string
          run_id: string
          score: number
        }
        Update: {
          cell_lat?: number
          cell_lng?: number
          cell_size_m?: number
          features?: Json
          generated_at?: string
          generated_by?: string | null
          id?: string
          project_id?: string
          run_id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "prospectivity_cells_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      prospectivity_runs: {
        Row: {
          bbox_geojson: Json
          cell_count: number
          cell_size_m: number
          generated_at: string
          generated_by: string
          id: string
          notes: string | null
          project_id: string
          weights: Json
        }
        Insert: {
          bbox_geojson: Json
          cell_count?: number
          cell_size_m: number
          generated_at?: string
          generated_by: string
          id?: string
          notes?: string | null
          project_id: string
          weights?: Json
        }
        Update: {
          bbox_geojson?: Json
          cell_count?: number
          cell_size_m?: number
          generated_at?: string
          generated_by?: string
          id?: string
          notes?: string | null
          project_id?: string
          weights?: Json
        }
        Relationships: [
          {
            foreignKeyName: "prospectivity_runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      qaqc_results: {
        Row: {
          certificate: string | null
          created_at: string
          created_by: string
          element: string
          id: string
          lab: string | null
          measured_at: string | null
          measured_value: number | null
          notes: string | null
          parent_sample_code: string | null
          project_id: string
          qc_type: string
          reviewed_at: string | null
          reviewed_by: string | null
          sample_code: string
          sample_id: string | null
          standard_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          certificate?: string | null
          created_at?: string
          created_by: string
          element: string
          id?: string
          lab?: string | null
          measured_at?: string | null
          measured_value?: number | null
          notes?: string | null
          parent_sample_code?: string | null
          project_id: string
          qc_type: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sample_code: string
          sample_id?: string | null
          standard_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          certificate?: string | null
          created_at?: string
          created_by?: string
          element?: string
          id?: string
          lab?: string | null
          measured_at?: string | null
          measured_value?: number | null
          notes?: string | null
          parent_sample_code?: string | null
          project_id?: string
          qc_type?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sample_code?: string
          sample_id?: string | null
          standard_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      qaqc_standards: {
        Row: {
          certifying_lab: string | null
          code: string
          created_at: string
          created_by: string
          element: string
          expected_value: number
          id: string
          name: string
          notes: string | null
          project_id: string
          tolerance_pct: number
          unit: string
          updated_at: string
        }
        Insert: {
          certifying_lab?: string | null
          code: string
          created_at?: string
          created_by: string
          element: string
          expected_value: number
          id?: string
          name: string
          notes?: string | null
          project_id: string
          tolerance_pct?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          certifying_lab?: string | null
          code?: string
          created_at?: string
          created_by?: string
          element?: string
          expected_value?: number
          id?: string
          name?: string
          notes?: string | null
          project_id?: string
          tolerance_pct?: number
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      sample_custody: {
        Row: {
          carrier: string | null
          created_at: string
          created_by: string
          event_at: string
          event_type: string
          from_user: string | null
          id: string
          location: string | null
          notes: string | null
          photo_urls: string[] | null
          project_id: string
          sample_code: string
          sample_id: string | null
          seal_number: string | null
          to_user: string | null
          waybill: string | null
        }
        Insert: {
          carrier?: string | null
          created_at?: string
          created_by: string
          event_at?: string
          event_type: string
          from_user?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          photo_urls?: string[] | null
          project_id: string
          sample_code: string
          sample_id?: string | null
          seal_number?: string | null
          to_user?: string | null
          waybill?: string | null
        }
        Update: {
          carrier?: string | null
          created_at?: string
          created_by?: string
          event_at?: string
          event_type?: string
          from_user?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          photo_urls?: string[] | null
          project_id?: string
          sample_code?: string
          sample_id?: string | null
          seal_number?: string | null
          to_user?: string | null
          waybill?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sample_custody_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sample_custody_sample_id_fkey"
            columns: ["sample_id"]
            isOneToOne: false
            referencedRelation: "sampling_results"
            referencedColumns: ["id"]
          },
        ]
      }
      sampling_results: {
        Row: {
          ag_gpt: number | null
          approved_at: string | null
          approved_by: string | null
          as_ppm: number | null
          au_gpt: number | null
          campaign_id: string | null
          certificate: string | null
          created_at: string
          created_by: string
          cu_pct: number | null
          depth_from: number | null
          depth_to: number | null
          easting: number | null
          elevation: number | null
          hg_ppm: number | null
          id: string
          lab: string | null
          mo_ppm: number | null
          northing: number | null
          notes: string | null
          pb_ppm: number | null
          project_id: string | null
          record_status: string
          sample_code: string
          sample_type: string
          sampled_at: string | null
          sb_ppm: number | null
          updated_at: string
          zn_ppm: number | null
          zone: string | null
        }
        Insert: {
          ag_gpt?: number | null
          approved_at?: string | null
          approved_by?: string | null
          as_ppm?: number | null
          au_gpt?: number | null
          campaign_id?: string | null
          certificate?: string | null
          created_at?: string
          created_by: string
          cu_pct?: number | null
          depth_from?: number | null
          depth_to?: number | null
          easting?: number | null
          elevation?: number | null
          hg_ppm?: number | null
          id?: string
          lab?: string | null
          mo_ppm?: number | null
          northing?: number | null
          notes?: string | null
          pb_ppm?: number | null
          project_id?: string | null
          record_status?: string
          sample_code: string
          sample_type: string
          sampled_at?: string | null
          sb_ppm?: number | null
          updated_at?: string
          zn_ppm?: number | null
          zone?: string | null
        }
        Update: {
          ag_gpt?: number | null
          approved_at?: string | null
          approved_by?: string | null
          as_ppm?: number | null
          au_gpt?: number | null
          campaign_id?: string | null
          certificate?: string | null
          created_at?: string
          created_by?: string
          cu_pct?: number | null
          depth_from?: number | null
          depth_to?: number | null
          easting?: number | null
          elevation?: number | null
          hg_ppm?: number | null
          id?: string
          lab?: string | null
          mo_ppm?: number | null
          northing?: number | null
          notes?: string | null
          pb_ppm?: number | null
          project_id?: string | null
          record_status?: string
          sample_code?: string
          sample_type?: string
          sampled_at?: string | null
          sb_ppm?: number | null
          updated_at?: string
          zn_ppm?: number | null
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sampling_results_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "exploration_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sampling_results_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_layers: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          downloads_count: number
          geometry_geojson: Json
          id: string
          is_public: boolean
          name: string
          owner_id: string | null
          tags: string[] | null
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          downloads_count?: number
          geometry_geojson: Json
          id?: string
          is_public?: boolean
          name: string
          owner_id?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          downloads_count?: number
          geometry_geojson?: Json
          id?: string
          is_public?: boolean
          name?: string
          owner_id?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_project_invitation: { Args: { _token: string }; Returns: Json }
      get_invitation_preview: {
        Args: { _token: string }
        Returns: {
          email: string
          expires_at: string
          id: string
          project_id: string
          project_name: string
          role: Database["public"]["Enums"]["project_role"]
          status: string
        }[]
      }
      has_project_role: {
        Args: {
          _project_id: string
          _roles: Database["public"]["Enums"]["project_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      is_project_member: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "super_admin" | "support"
      project_role:
        | "owner"
        | "admin"
        | "geologist"
        | "viewer"
        | "project_manager"
        | "chief_geologist"
        | "qaqc_officer"
        | "field_technician"
        | "drilling_supervisor"
        | "hse_officer"
        | "community_relations"
        | "external_consultant"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["super_admin", "support"],
      project_role: [
        "owner",
        "admin",
        "geologist",
        "viewer",
        "project_manager",
        "chief_geologist",
        "qaqc_officer",
        "field_technician",
        "drilling_supervisor",
        "hse_officer",
        "community_relations",
        "external_consultant",
      ],
    },
  },
} as const
