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
      ai_anomaly_explanations: {
        Row: {
          anomaly_id: string
          anomaly_kind: string
          confidence: number | null
          created_at: string
          created_by: string | null
          id: string
          input_hash: string
          lithology_hypotheses: Json
          model: string
          project_id: string
          raw_json: Json | null
          recommended_followup: Json
          structural_context: string | null
          summary: string
        }
        Insert: {
          anomaly_id: string
          anomaly_kind: string
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          input_hash: string
          lithology_hypotheses?: Json
          model: string
          project_id: string
          raw_json?: Json | null
          recommended_followup?: Json
          structural_context?: string | null
          summary: string
        }
        Update: {
          anomaly_id?: string
          anomaly_kind?: string
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          input_hash?: string
          lithology_hypotheses?: Json
          model?: string
          project_id?: string
          raw_json?: Json | null
          recommended_followup?: Json
          structural_context?: string | null
          summary?: string
        }
        Relationships: []
      }
      ai_document_embeddings: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          embedding: string | null
          id: string
          metadata: Json
          project_id: string | null
          source_id: string
          source_type: string
        }
        Insert: {
          chunk_index?: number
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json
          project_id?: string | null
          source_id: string
          source_type: string
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json
          project_id?: string | null
          source_id?: string
          source_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_document_embeddings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "ai_document_embeddings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_recommendation_traces: {
        Row: {
          context_sources: Json
          cost_usd: number | null
          created_at: string
          created_by: string | null
          entity_id: string | null
          entity_type: string
          error: string | null
          id: string
          inputs: Json
          latency_ms: number | null
          model: string
          model_version: string | null
          outputs: Json
          project_id: string | null
          prompt_hash: string | null
          provider: string
          qp_review_required: boolean
          recommendation_kind: string
          status: string
          tokens_in: number | null
          tokens_out: number | null
        }
        Insert: {
          context_sources?: Json
          cost_usd?: number | null
          created_at?: string
          created_by?: string | null
          entity_id?: string | null
          entity_type: string
          error?: string | null
          id?: string
          inputs?: Json
          latency_ms?: number | null
          model: string
          model_version?: string | null
          outputs?: Json
          project_id?: string | null
          prompt_hash?: string | null
          provider: string
          qp_review_required?: boolean
          recommendation_kind: string
          status?: string
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Update: {
          context_sources?: Json
          cost_usd?: number | null
          created_at?: string
          created_by?: string | null
          entity_id?: string | null
          entity_type?: string
          error?: string | null
          id?: string
          inputs?: Json
          latency_ms?: number | null
          model?: string
          model_version?: string | null
          outputs?: Json
          project_id?: string | null
          prompt_hash?: string | null
          provider?: string
          qp_review_required?: boolean
          recommendation_kind?: string
          status?: string
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_recommendation_traces_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "ai_recommendation_traces_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
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
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
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
      areas_of_interest: {
        Row: {
          area_ha: number | null
          color: string
          created_at: string
          created_by: string
          description: string | null
          geometry_geojson: Json
          id: string
          metadata: Json
          name: string
          notify: boolean
          organization_id: string
          project_id: string | null
          updated_at: string
        }
        Insert: {
          area_ha?: number | null
          color?: string
          created_at?: string
          created_by: string
          description?: string | null
          geometry_geojson: Json
          id?: string
          metadata?: Json
          name: string
          notify?: boolean
          organization_id: string
          project_id?: string | null
          updated_at?: string
        }
        Update: {
          area_ha?: number | null
          color?: string
          created_at?: string
          created_by?: string
          description?: string | null
          geometry_geojson?: Json
          id?: string
          metadata?: Json
          name?: string
          notify?: boolean
          organization_id?: string
          project_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "areas_of_interest_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "areas_of_interest_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "areas_of_interest_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
      billing_plans: {
        Row: {
          code: string
          created_at: string
          description: string | null
          display_order: number
          features: Json
          id: string
          is_active: boolean
          is_default: boolean
          max_ai_calls_per_month: number | null
          max_jobs_per_month: number | null
          max_members: number | null
          max_projects: number | null
          max_storage_gb: number | null
          name: string
          price_usd_monthly: number
          price_usd_yearly: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          display_order?: number
          features?: Json
          id?: string
          is_active?: boolean
          is_default?: boolean
          max_ai_calls_per_month?: number | null
          max_jobs_per_month?: number | null
          max_members?: number | null
          max_projects?: number | null
          max_storage_gb?: number | null
          name: string
          price_usd_monthly?: number
          price_usd_yearly?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          display_order?: number
          features?: Json
          id?: string
          is_active?: boolean
          is_default?: boolean
          max_ai_calls_per_month?: number | null
          max_jobs_per_month?: number | null
          max_members?: number | null
          max_projects?: number | null
          max_storage_gb?: number | null
          name?: string
          price_usd_monthly?: number
          price_usd_yearly?: number
          updated_at?: string
        }
        Relationships: []
      }
      block_models: {
        Row: {
          attributes: Json
          block_count: number
          block_size_x: number
          block_size_y: number
          block_size_z: number
          created_at: string
          created_by: string
          crs: string
          description: string | null
          id: string
          name: string
          nx: number
          ny: number
          nz: number
          origin_x: number
          origin_y: number
          origin_z: number
          project_id: string
          rotation_deg: number
          source_format: string
          status: string
          storage_path: string | null
          updated_at: string
        }
        Insert: {
          attributes?: Json
          block_count?: number
          block_size_x: number
          block_size_y: number
          block_size_z: number
          created_at?: string
          created_by: string
          crs?: string
          description?: string | null
          id?: string
          name: string
          nx: number
          ny: number
          nz: number
          origin_x: number
          origin_y: number
          origin_z: number
          project_id: string
          rotation_deg?: number
          source_format?: string
          status?: string
          storage_path?: string | null
          updated_at?: string
        }
        Update: {
          attributes?: Json
          block_count?: number
          block_size_x?: number
          block_size_y?: number
          block_size_z?: number
          created_at?: string
          created_by?: string
          crs?: string
          description?: string | null
          id?: string
          name?: string
          nx?: number
          ny?: number
          nz?: number
          origin_x?: number
          origin_y?: number
          origin_z?: number
          project_id?: string
          rotation_deg?: number
          source_format?: string
          status?: string
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "block_models_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "block_models_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      blocks: {
        Row: {
          attrs: Json
          block_model_id: string
          dx: number | null
          dy: number | null
          dz: number | null
          i: number
          id: number
          j: number
          k: number
          x: number
          y: number
          z: number
        }
        Insert: {
          attrs?: Json
          block_model_id: string
          dx?: number | null
          dy?: number | null
          dz?: number | null
          i: number
          id?: number
          j: number
          k: number
          x: number
          y: number
          z: number
        }
        Update: {
          attrs?: Json
          block_model_id?: string
          dx?: number | null
          dy?: number | null
          dz?: number | null
          i?: number
          id?: number
          j?: number
          k?: number
          x?: number
          y?: number
          z?: number
        }
        Relationships: [
          {
            foreignKeyName: "blocks_block_model_id_fkey"
            columns: ["block_model_id"]
            isOneToOne: false
            referencedRelation: "block_models"
            referencedColumns: ["id"]
          },
        ]
      }
      bulletin_alerts: {
        Row: {
          bulletin_id: string
          created_at: string
          id: string
          is_read: boolean
          match_detail: string | null
          match_type: string
          project_id: string
          read_at: string | null
          read_by: string | null
        }
        Insert: {
          bulletin_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          match_detail?: string | null
          match_type: string
          project_id: string
          read_at?: string | null
          read_by?: string | null
        }
        Update: {
          bulletin_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          match_detail?: string | null
          match_type?: string
          project_id?: string
          read_at?: string | null
          read_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bulletin_alerts_bulletin_id_fkey"
            columns: ["bulletin_id"]
            isOneToOne: false
            referencedRelation: "mining_bulletins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulletin_alerts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "bulletin_alerts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      bulletin_sync_runs: {
        Row: {
          alerts_created: number
          created_at: string
          error_message: string | null
          finished_at: string | null
          id: string
          inserted_count: number
          payload: Json | null
          scraped_count: number
          skipped_count: number
          source: string
          started_at: string
          status: string
          triggered_by: string | null
        }
        Insert: {
          alerts_created?: number
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          inserted_count?: number
          payload?: Json | null
          scraped_count?: number
          skipped_count?: number
          source?: string
          started_at?: string
          status?: string
          triggered_by?: string | null
        }
        Update: {
          alerts_created?: number
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          inserted_count?: number
          payload?: Json | null
          scraped_count?: number
          skipped_count?: number
          source?: string
          started_at?: string
          status?: string
          triggered_by?: string | null
        }
        Relationships: []
      }
      bulletin_watch_holders: {
        Row: {
          created_at: string
          created_by: string
          holder_name: string | null
          holder_rut: string | null
          id: string
          notes: string | null
          project_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          holder_name?: string | null
          holder_rut?: string | null
          id?: string
          notes?: string | null
          project_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          holder_name?: string | null
          holder_rut?: string | null
          id?: string
          notes?: string | null
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bulletin_watch_holders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "bulletin_watch_holders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      bulletin_watches: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          label: string | null
          notes: string | null
          project_id: string
          updated_at: string
          value: string
          watch_type: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          label?: string | null
          notes?: string | null
          project_id: string
          updated_at?: string
          value: string
          watch_type: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          label?: string | null
          notes?: string | null
          project_id?: string
          updated_at?: string
          value?: string
          watch_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "bulletin_watches_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "bulletin_watches_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      cadastre_change_log: {
        Row: {
          after: Json | null
          before: Json | null
          cadastre_id: string | null
          change_type: string
          changed_fields: Json
          detected_at: string
          external_id: string
          id: number
          origen: string
          rol: string | null
          run_id: string | null
        }
        Insert: {
          after?: Json | null
          before?: Json | null
          cadastre_id?: string | null
          change_type: string
          changed_fields?: Json
          detected_at?: string
          external_id: string
          id?: number
          origen: string
          rol?: string | null
          run_id?: string | null
        }
        Update: {
          after?: Json | null
          before?: Json | null
          cadastre_id?: string | null
          change_type?: string
          changed_fields?: Json
          detected_at?: string
          external_id?: string
          id?: number
          origen?: string
          rol?: string | null
          run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cadastre_change_log_cadastre_id_fkey"
            columns: ["cadastre_id"]
            isOneToOne: false
            referencedRelation: "cadastre_national"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cadastre_change_log_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "cadastre_sync_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      cadastre_national: {
        Row: {
          archived_at: string | null
          area_ha: number | null
          commune: string | null
          constituted_at: string | null
          created_at: string
          datum: string | null
          external_id: string
          fetched_at: string
          geom: unknown
          geom_3857: unknown
          geometry_geojson: Json | null
          holder_name: string | null
          holder_rut: string | null
          id: string
          last_patent_year: number | null
          metadata: Json | null
          name: string | null
          origen: string
          provincia: string | null
          region: string | null
          rol: string | null
          source: string | null
          status: string | null
          tipo: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          area_ha?: number | null
          commune?: string | null
          constituted_at?: string | null
          created_at?: string
          datum?: string | null
          external_id: string
          fetched_at?: string
          geom?: unknown
          geom_3857?: unknown
          geometry_geojson?: Json | null
          holder_name?: string | null
          holder_rut?: string | null
          id?: string
          last_patent_year?: number | null
          metadata?: Json | null
          name?: string | null
          origen: string
          provincia?: string | null
          region?: string | null
          rol?: string | null
          source?: string | null
          status?: string | null
          tipo?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          area_ha?: number | null
          commune?: string | null
          constituted_at?: string | null
          created_at?: string
          datum?: string | null
          external_id?: string
          fetched_at?: string
          geom?: unknown
          geom_3857?: unknown
          geometry_geojson?: Json | null
          holder_name?: string | null
          holder_rut?: string | null
          id?: string
          last_patent_year?: number | null
          metadata?: Json | null
          name?: string | null
          origen?: string
          provincia?: string | null
          region?: string | null
          rol?: string | null
          source?: string | null
          status?: string | null
          tipo?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cadastre_sync_runs: {
        Row: {
          archived: number
          error_message: string | null
          failed: number
          features_seen: number
          finished_at: string | null
          id: string
          inserted: number
          metadata: Json
          origen: string
          region: string | null
          scope: string
          started_at: string
          status: string
          unchanged: number
          updated: number
        }
        Insert: {
          archived?: number
          error_message?: string | null
          failed?: number
          features_seen?: number
          finished_at?: string | null
          id?: string
          inserted?: number
          metadata?: Json
          origen: string
          region?: string | null
          scope?: string
          started_at?: string
          status?: string
          unchanged?: number
          updated?: number
        }
        Update: {
          archived?: number
          error_message?: string | null
          failed?: number
          features_seen?: number
          finished_at?: string | null
          id?: string
          inserted?: number
          metadata?: Json
          origen?: string
          region?: string | null
          scope?: string
          started_at?: string
          status?: string
          unchanged?: number
          updated?: number
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
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
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
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
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
      card_comments: {
        Row: {
          author_id: string
          body: string
          card_id: string
          card_type: string
          created_at: string
          edited_at: string | null
          id: string
          organization_id: string
          parent_id: string | null
          project_id: string | null
        }
        Insert: {
          author_id: string
          body: string
          card_id: string
          card_type: string
          created_at?: string
          edited_at?: string | null
          id?: string
          organization_id: string
          parent_id?: string | null
          project_id?: string | null
        }
        Update: {
          author_id?: string
          body?: string
          card_id?: string
          card_type?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          organization_id?: string
          parent_id?: string | null
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "card_comments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "card_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "card_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      card_mentions: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          mentioned_user_id: string
          organization_id: string
          read_at: string | null
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          mentioned_user_id: string
          organization_id: string
          read_at?: string | null
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          mentioned_user_id?: string
          organization_id?: string
          read_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "card_mentions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "card_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      catastro_cache: {
        Row: {
          bbox: number[]
          bbox_key: string
          created_at: string
          feature_count: number
          fetched_at: string
          geojson: Json
          source: string
        }
        Insert: {
          bbox: number[]
          bbox_key: string
          created_at?: string
          feature_count?: number
          fetched_at?: string
          geojson: Json
          source?: string
        }
        Update: {
          bbox?: number[]
          bbox_key?: string
          created_at?: string
          feature_count?: number
          fetched_at?: string
          geojson?: Json
          source?: string
        }
        Relationships: []
      }
      certifier_independence_checks: {
        Row: {
          assignment_id: string | null
          checked_at: string
          checked_by: string | null
          conflict_notes: string | null
          deal_id: string
          declaration_url: string | null
          has_equity: boolean
          has_other_conflict: boolean
          id: string
          is_employee: boolean
          passed: boolean | null
          qualified_person_id: string
        }
        Insert: {
          assignment_id?: string | null
          checked_at?: string
          checked_by?: string | null
          conflict_notes?: string | null
          deal_id: string
          declaration_url?: string | null
          has_equity?: boolean
          has_other_conflict?: boolean
          id?: string
          is_employee?: boolean
          passed?: boolean | null
          qualified_person_id: string
        }
        Update: {
          assignment_id?: string | null
          checked_at?: string
          checked_by?: string | null
          conflict_notes?: string | null
          deal_id?: string
          declaration_url?: string | null
          has_equity?: boolean
          has_other_conflict?: boolean
          id?: string
          is_employee?: boolean
          passed?: boolean | null
          qualified_person_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "certifier_independence_checks_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "deal_certifier_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certifier_independence_checks_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certifier_independence_checks_qualified_person_id_fkey"
            columns: ["qualified_person_id"]
            isOneToOne: false
            referencedRelation: "qualified_persons"
            referencedColumns: ["id"]
          },
        ]
      }
      certifier_standards: {
        Row: {
          created_at: string
          discipline: string
          fee_per_report_usd: number | null
          id: string
          notes: string | null
          qualified_person_id: string
          reports_signed_count: number
          standard: string
        }
        Insert: {
          created_at?: string
          discipline: string
          fee_per_report_usd?: number | null
          id?: string
          notes?: string | null
          qualified_person_id: string
          reports_signed_count?: number
          standard: string
        }
        Update: {
          created_at?: string
          discipline?: string
          fee_per_report_usd?: number | null
          id?: string
          notes?: string | null
          qualified_person_id?: string
          reports_signed_count?: number
          standard?: string
        }
        Relationships: [
          {
            foreignKeyName: "certifier_standards_qualified_person_id_fkey"
            columns: ["qualified_person_id"]
            isOneToOne: false
            referencedRelation: "qualified_persons"
            referencedColumns: ["id"]
          },
        ]
      }
      change_log: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          entity_id: string
          entity_label: string | null
          entity_type: string
          field: string | null
          id: string
          new_value: Json | null
          old_value: Json | null
          organization_id: string
          project_id: string | null
          reason: string | null
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          entity_id: string
          entity_label?: string | null
          entity_type: string
          field?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          organization_id: string
          project_id?: string | null
          reason?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          entity_id?: string
          entity_label?: string | null
          entity_type?: string
          field?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          organization_id?: string
          project_id?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "change_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "change_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      client_error_log: {
        Row: {
          context: Json | null
          created_at: string
          id: string
          message: string
          organization_id: string | null
          route: string | null
          severity: string | null
          stack: string | null
          url: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string
          id?: string
          message: string
          organization_id?: string | null
          route?: string | null
          severity?: string | null
          stack?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string
          id?: string
          message?: string
          organization_id?: string | null
          route?: string | null
          severity?: string | null
          stack?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
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
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "community_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_evaluations: {
        Row: {
          auto_evaluated: boolean
          created_at: string
          evaluated_at: string | null
          evaluated_by: string | null
          evaluator_notes: string | null
          id: string
          project_id: string
          report_id: string
          rule_id: string
          score: number | null
          status: string
          updated_at: string
        }
        Insert: {
          auto_evaluated?: boolean
          created_at?: string
          evaluated_at?: string | null
          evaluated_by?: string | null
          evaluator_notes?: string | null
          id?: string
          project_id: string
          report_id: string
          rule_id: string
          score?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          auto_evaluated?: boolean
          created_at?: string
          evaluated_at?: string | null
          evaluated_by?: string | null
          evaluator_notes?: string | null
          id?: string
          project_id?: string
          report_id?: string
          rule_id?: string
          score?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_evaluations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "compliance_evaluations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_evaluations_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "technical_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_evaluations_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "compliance_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_rules: {
        Row: {
          created_at: string
          description: string
          display_order: number
          evaluator_config: Json | null
          evaluator_type: string
          id: string
          reference_url: string | null
          rule_code: string
          section_no: number | null
          severity: string
          standard: Database["public"]["Enums"]["compliance_standard"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          display_order?: number
          evaluator_config?: Json | null
          evaluator_type?: string
          id?: string
          reference_url?: string | null
          rule_code: string
          section_no?: number | null
          severity?: string
          standard: Database["public"]["Enums"]["compliance_standard"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          display_order?: number
          evaluator_config?: Json | null
          evaluator_type?: string
          id?: string
          reference_url?: string | null
          rule_code?: string
          section_no?: number | null
          severity?: string
          standard?: Database["public"]["Enums"]["compliance_standard"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      concession_alert_settings: {
        Row: {
          area_change_enabled: boolean
          area_change_threshold_pct: number
          created_at: string
          email_notify: boolean
          email_recipients: string[]
          holder_change_enabled: boolean
          project_id: string
          status_change_enabled: boolean
          updated_at: string
          updated_by: string | null
          webhook_url: string | null
        }
        Insert: {
          area_change_enabled?: boolean
          area_change_threshold_pct?: number
          created_at?: string
          email_notify?: boolean
          email_recipients?: string[]
          holder_change_enabled?: boolean
          project_id: string
          status_change_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
          webhook_url?: string | null
        }
        Update: {
          area_change_enabled?: boolean
          area_change_threshold_pct?: number
          created_at?: string
          email_notify?: boolean
          email_recipients?: string[]
          holder_change_enabled?: boolean
          project_id?: string
          status_change_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "concession_alert_settings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "concession_alert_settings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      concession_alerts: {
        Row: {
          acknowledged: boolean
          alert_type: string
          concession_id: string | null
          created_at: string
          holder_id: string | null
          id: string
          is_read: boolean
          message: string | null
          payload: Json | null
          project_id: string
          read_at: string | null
          read_by: string | null
          severity: string
          title: string
          updated_at: string
        }
        Insert: {
          acknowledged?: boolean
          alert_type: string
          concession_id?: string | null
          created_at?: string
          holder_id?: string | null
          id?: string
          is_read?: boolean
          message?: string | null
          payload?: Json | null
          project_id: string
          read_at?: string | null
          read_by?: string | null
          severity?: string
          title: string
          updated_at?: string
        }
        Update: {
          acknowledged?: boolean
          alert_type?: string
          concession_id?: string | null
          created_at?: string
          holder_id?: string | null
          id?: string
          is_read?: boolean
          message?: string | null
          payload?: Json | null
          project_id?: string
          read_at?: string | null
          read_by?: string | null
          severity?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "concession_alerts_concession_id_fkey"
            columns: ["concession_id"]
            isOneToOne: false
            referencedRelation: "concession_change_summary"
            referencedColumns: ["concession_id"]
          },
          {
            foreignKeyName: "concession_alerts_concession_id_fkey"
            columns: ["concession_id"]
            isOneToOne: false
            referencedRelation: "mining_concessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concession_alerts_holder_id_fkey"
            columns: ["holder_id"]
            isOneToOne: false
            referencedRelation: "concession_holders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concession_alerts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "concession_alerts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      concession_favorites: {
        Row: {
          concession_id: string
          created_at: string
          id: string
          notes: string | null
          project_id: string | null
          user_id: string
        }
        Insert: {
          concession_id: string
          created_at?: string
          id?: string
          notes?: string | null
          project_id?: string | null
          user_id: string
        }
        Update: {
          concession_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          project_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "concession_favorites_concession_id_fkey"
            columns: ["concession_id"]
            isOneToOne: false
            referencedRelation: "concession_change_summary"
            referencedColumns: ["concession_id"]
          },
          {
            foreignKeyName: "concession_favorites_concession_id_fkey"
            columns: ["concession_id"]
            isOneToOne: false
            referencedRelation: "mining_concessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concession_favorites_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "concession_favorites_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      concession_field_changes: {
        Row: {
          changed_at: string
          changed_by: string | null
          concession_id: string
          field: string
          id: string
          new_value: string | null
          old_value: string | null
          project_id: string
          source: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          concession_id: string
          field: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          project_id: string
          source?: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          concession_id?: string
          field?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          project_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "concession_field_changes_concession_id_fkey"
            columns: ["concession_id"]
            isOneToOne: false
            referencedRelation: "concession_change_summary"
            referencedColumns: ["concession_id"]
          },
          {
            foreignKeyName: "concession_field_changes_concession_id_fkey"
            columns: ["concession_id"]
            isOneToOne: false
            referencedRelation: "mining_concessions"
            referencedColumns: ["id"]
          },
        ]
      }
      concession_files: {
        Row: {
          concession_id: string
          description: string | null
          file_name: string
          file_path: string
          file_type: string
          id: string
          project_id: string
          size_bytes: number | null
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          concession_id: string
          description?: string | null
          file_name: string
          file_path: string
          file_type?: string
          id?: string
          project_id: string
          size_bytes?: number | null
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          concession_id?: string
          description?: string | null
          file_name?: string
          file_path?: string
          file_type?: string
          id?: string
          project_id?: string
          size_bytes?: number | null
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "concession_files_concession_id_fkey"
            columns: ["concession_id"]
            isOneToOne: false
            referencedRelation: "concession_change_summary"
            referencedColumns: ["concession_id"]
          },
          {
            foreignKeyName: "concession_files_concession_id_fkey"
            columns: ["concession_id"]
            isOneToOne: false
            referencedRelation: "mining_concessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concession_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "concession_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      concession_history: {
        Row: {
          concession_id: string
          diff: Json | null
          id: string
          project_id: string
          snapshot: Json
          source: string
          synced_at: string
        }
        Insert: {
          concession_id: string
          diff?: Json | null
          id?: string
          project_id: string
          snapshot: Json
          source?: string
          synced_at?: string
        }
        Update: {
          concession_id?: string
          diff?: Json | null
          id?: string
          project_id?: string
          snapshot?: Json
          source?: string
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "concession_history_concession_id_fkey"
            columns: ["concession_id"]
            isOneToOne: false
            referencedRelation: "concession_change_summary"
            referencedColumns: ["concession_id"]
          },
          {
            foreignKeyName: "concession_history_concession_id_fkey"
            columns: ["concession_id"]
            isOneToOne: false
            referencedRelation: "mining_concessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concession_history_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "concession_history_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      concession_holders: {
        Row: {
          address: string | null
          commune: string | null
          created_at: string
          created_by: string
          economic_activity: string | null
          email: string | null
          holder_type: string
          id: string
          incorporation_date: string | null
          legal_repr_name: string | null
          legal_repr_rut: string | null
          name: string
          notes: string | null
          phone: string | null
          project_id: string
          region: string | null
          rut: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          commune?: string | null
          created_at?: string
          created_by: string
          economic_activity?: string | null
          email?: string | null
          holder_type?: string
          id?: string
          incorporation_date?: string | null
          legal_repr_name?: string | null
          legal_repr_rut?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          project_id: string
          region?: string | null
          rut?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          commune?: string | null
          created_at?: string
          created_by?: string
          economic_activity?: string | null
          email?: string | null
          holder_type?: string
          id?: string
          incorporation_date?: string | null
          legal_repr_name?: string | null
          legal_repr_rut?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          project_id?: string
          region?: string | null
          rut?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "concession_holders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "concession_holders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      concession_overlaps: {
        Row: {
          area_overlap_ha: number | null
          concession_id: string
          created_at: string
          detected_at: string
          geometry_geojson: Json | null
          id: string
          notes: string | null
          overlap_type: string
          overlap_with_id: string | null
          overlap_with_name: string | null
          pct_overlap: number | null
          project_id: string
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          updated_at: string
        }
        Insert: {
          area_overlap_ha?: number | null
          concession_id: string
          created_at?: string
          detected_at?: string
          geometry_geojson?: Json | null
          id?: string
          notes?: string | null
          overlap_type: string
          overlap_with_id?: string | null
          overlap_with_name?: string | null
          pct_overlap?: number | null
          project_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          updated_at?: string
        }
        Update: {
          area_overlap_ha?: number | null
          concession_id?: string
          created_at?: string
          detected_at?: string
          geometry_geojson?: Json | null
          id?: string
          notes?: string | null
          overlap_type?: string
          overlap_with_id?: string | null
          overlap_with_name?: string | null
          pct_overlap?: number | null
          project_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "concession_overlaps_concession_id_fkey"
            columns: ["concession_id"]
            isOneToOne: false
            referencedRelation: "concession_change_summary"
            referencedColumns: ["concession_id"]
          },
          {
            foreignKeyName: "concession_overlaps_concession_id_fkey"
            columns: ["concession_id"]
            isOneToOne: false
            referencedRelation: "mining_concessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concession_overlaps_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "concession_overlaps_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      concession_patents: {
        Row: {
          amount_clp: number | null
          amount_usd: number | null
          amount_utm: number
          concession_id: string
          created_at: string
          created_by: string
          due_date: string | null
          id: string
          notes: string | null
          paid_at: string | null
          project_id: string
          receipt_url: string | null
          status: string
          updated_at: string
          year: number
        }
        Insert: {
          amount_clp?: number | null
          amount_usd?: number | null
          amount_utm?: number
          concession_id: string
          created_at?: string
          created_by: string
          due_date?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          project_id: string
          receipt_url?: string | null
          status?: string
          updated_at?: string
          year: number
        }
        Update: {
          amount_clp?: number | null
          amount_usd?: number | null
          amount_utm?: number
          concession_id?: string
          created_at?: string
          created_by?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          project_id?: string
          receipt_url?: string | null
          status?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "concession_patents_concession_id_fkey"
            columns: ["concession_id"]
            isOneToOne: false
            referencedRelation: "concession_change_summary"
            referencedColumns: ["concession_id"]
          },
          {
            foreignKeyName: "concession_patents_concession_id_fkey"
            columns: ["concession_id"]
            isOneToOne: false
            referencedRelation: "mining_concessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concession_patents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "concession_patents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      constituciones: {
        Row: {
          anio: number | null
          conservador: string | null
          created_at: string
          created_by: string
          fecha_sentencia: string | null
          foja: string | null
          id: string
          notas: string | null
          numero: string | null
          patente_anual_uf: number | null
          pedimento_id: string
          project_id: string
          rol_judicial: string | null
          sentencia_url: string | null
          updated_at: string
        }
        Insert: {
          anio?: number | null
          conservador?: string | null
          created_at?: string
          created_by: string
          fecha_sentencia?: string | null
          foja?: string | null
          id?: string
          notas?: string | null
          numero?: string | null
          patente_anual_uf?: number | null
          pedimento_id: string
          project_id: string
          rol_judicial?: string | null
          sentencia_url?: string | null
          updated_at?: string
        }
        Update: {
          anio?: number | null
          conservador?: string | null
          created_at?: string
          created_by?: string
          fecha_sentencia?: string | null
          foja?: string | null
          id?: string
          notas?: string | null
          numero?: string | null
          patente_anual_uf?: number | null
          pedimento_id?: string
          project_id?: string
          rol_judicial?: string | null
          sentencia_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "constituciones_pedimento_id_fkey"
            columns: ["pedimento_id"]
            isOneToOne: false
            referencedRelation: "pedimentos"
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
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
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
      court_case_alerts: {
        Row: {
          case_id: string
          created_at: string
          id: string
          is_read: boolean
          match_detail: string | null
          match_type: string
          project_id: string
          read_at: string | null
          read_by: string | null
        }
        Insert: {
          case_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          match_detail?: string | null
          match_type: string
          project_id: string
          read_at?: string | null
          read_by?: string | null
        }
        Update: {
          case_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          match_detail?: string | null
          match_type?: string
          project_id?: string
          read_at?: string | null
          read_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "court_case_alerts_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "mining_court_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "court_case_alerts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "court_case_alerts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_ledger: {
        Row: {
          created_at: string
          delta: number
          id: string
          metadata: Json | null
          reason: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          metadata?: Json | null
          reason: string
          user_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          metadata?: Json | null
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_wallets: {
        Row: {
          balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      data_room_access_grants: {
        Row: {
          access_level: string
          created_at: string
          data_room_id: string
          expires_at: string | null
          granted_by: string
          grantee_email: string | null
          grantee_user_id: string | null
          id: string
          investor_id: string | null
          nda_signed_at: string | null
          revoked_at: string | null
          scope: string
          scope_file_ids: string[] | null
          scope_folder_ids: string[] | null
          updated_at: string
        }
        Insert: {
          access_level?: string
          created_at?: string
          data_room_id: string
          expires_at?: string | null
          granted_by: string
          grantee_email?: string | null
          grantee_user_id?: string | null
          id?: string
          investor_id?: string | null
          nda_signed_at?: string | null
          revoked_at?: string | null
          scope?: string
          scope_file_ids?: string[] | null
          scope_folder_ids?: string[] | null
          updated_at?: string
        }
        Update: {
          access_level?: string
          created_at?: string
          data_room_id?: string
          expires_at?: string | null
          granted_by?: string
          grantee_email?: string | null
          grantee_user_id?: string | null
          id?: string
          investor_id?: string | null
          nda_signed_at?: string | null
          revoked_at?: string | null
          scope?: string
          scope_file_ids?: string[] | null
          scope_folder_ids?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_room_access_grants_data_room_id_fkey"
            columns: ["data_room_id"]
            isOneToOne: false
            referencedRelation: "data_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_room_access_grants_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
        ]
      }
      data_room_access_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_user_id: string | null
          allowed: boolean
          created_at: string
          data_room_id: string
          file_id: string | null
          folder_id: string | null
          grant_id: string | null
          id: string
          ip_address: string | null
          payload: Json | null
          reason: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_user_id?: string | null
          allowed?: boolean
          created_at?: string
          data_room_id: string
          file_id?: string | null
          folder_id?: string | null
          grant_id?: string | null
          id?: string
          ip_address?: string | null
          payload?: Json | null
          reason?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_user_id?: string | null
          allowed?: boolean
          created_at?: string
          data_room_id?: string
          file_id?: string | null
          folder_id?: string | null
          grant_id?: string | null
          id?: string
          ip_address?: string | null
          payload?: Json | null
          reason?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "data_room_access_logs_data_room_id_fkey"
            columns: ["data_room_id"]
            isOneToOne: false
            referencedRelation: "data_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_room_access_logs_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "data_room_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_room_access_logs_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "data_room_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_room_access_logs_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "data_room_access_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      data_room_files: {
        Row: {
          confidentiality: string
          created_at: string
          data_room_id: string
          file_name: string
          folder_id: string | null
          id: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          updated_at: string
          uploaded_by: string
          watermark_required: boolean
        }
        Insert: {
          confidentiality?: string
          created_at?: string
          data_room_id: string
          file_name: string
          folder_id?: string | null
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          updated_at?: string
          uploaded_by: string
          watermark_required?: boolean
        }
        Update: {
          confidentiality?: string
          created_at?: string
          data_room_id?: string
          file_name?: string
          folder_id?: string | null
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          updated_at?: string
          uploaded_by?: string
          watermark_required?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "data_room_files_data_room_id_fkey"
            columns: ["data_room_id"]
            isOneToOne: false
            referencedRelation: "data_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_room_files_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "data_room_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      data_room_folders: {
        Row: {
          created_at: string
          created_by: string
          data_room_id: string
          display_order: number
          id: string
          is_system: boolean
          name: string
          parent_folder_id: string | null
          path: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          data_room_id: string
          display_order?: number
          id?: string
          is_system?: boolean
          name: string
          parent_folder_id?: string | null
          path: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          data_room_id?: string
          display_order?: number
          id?: string
          is_system?: boolean
          name?: string
          parent_folder_id?: string | null
          path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_room_folders_data_room_id_fkey"
            columns: ["data_room_id"]
            isOneToOne: false
            referencedRelation: "data_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_room_folders_parent_folder_id_fkey"
            columns: ["parent_folder_id"]
            isOneToOne: false
            referencedRelation: "data_room_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      data_rooms: {
        Row: {
          created_at: string
          created_by: string
          deal_id: string | null
          description: string | null
          expires_at: string | null
          id: string
          name: string
          nda_required: boolean
          project_id: string
          status: string
          updated_at: string
          watermark_enabled: boolean
          watermark_template: string
        }
        Insert: {
          created_at?: string
          created_by: string
          deal_id?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          name: string
          nda_required?: boolean
          project_id: string
          status?: string
          updated_at?: string
          watermark_enabled?: boolean
          watermark_template?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          deal_id?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          name?: string
          nda_required?: boolean
          project_id?: string
          status?: string
          updated_at?: string
          watermark_enabled?: boolean
          watermark_template?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_rooms_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_rooms_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "data_rooms_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_certifications: {
        Row: {
          budget_clp: number
          created_at: string
          deal_id: string
          estimated_completion: string | null
          filing_ref: string | null
          id: string
          progress_pct: number
          spent_clp: number
          standard: string
          status: string
          updated_at: string
        }
        Insert: {
          budget_clp?: number
          created_at?: string
          deal_id: string
          estimated_completion?: string | null
          filing_ref?: string | null
          id?: string
          progress_pct?: number
          spent_clp?: number
          standard: string
          status?: string
          updated_at?: string
        }
        Update: {
          budget_clp?: number
          created_at?: string
          deal_id?: string
          estimated_completion?: string | null
          filing_ref?: string | null
          id?: string
          progress_pct?: number
          spent_clp?: number
          standard?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_certifications_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_certifier_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          deal_id: string
          discipline: string
          id: string
          independence_verified: boolean
          independence_verified_at: string | null
          independence_verified_by: string | null
          qualified_person_id: string
          role: string
          standard: string
          status: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          deal_id: string
          discipline: string
          id?: string
          independence_verified?: boolean
          independence_verified_at?: string | null
          independence_verified_by?: string | null
          qualified_person_id: string
          role?: string
          standard: string
          status?: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          deal_id?: string
          discipline?: string
          id?: string
          independence_verified?: boolean
          independence_verified_at?: string | null
          independence_verified_by?: string | null
          qualified_person_id?: string
          role?: string
          standard?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_certifier_assignments_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_certifier_assignments_qualified_person_id_fkey"
            columns: ["qualified_person_id"]
            isOneToOne: false
            referencedRelation: "qualified_persons"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_comparables: {
        Row: {
          comparable_project: string
          country: string | null
          created_at: string
          deal_id: string
          id: string
          notes: string | null
          resource_moz: number | null
          sale_price_usd: number | null
          usd_per_oz: number | null
          year: number | null
        }
        Insert: {
          comparable_project: string
          country?: string | null
          created_at?: string
          deal_id: string
          id?: string
          notes?: string | null
          resource_moz?: number | null
          sale_price_usd?: number | null
          usd_per_oz?: number | null
          year?: number | null
        }
        Update: {
          comparable_project?: string
          country?: string | null
          created_at?: string
          deal_id?: string
          id?: string
          notes?: string | null
          resource_moz?: number | null
          sale_price_usd?: number | null
          usd_per_oz?: number | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_comparables_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_investor_pipeline: {
        Row: {
          created_at: string
          created_by: string
          deal_id: string
          id: string
          investor_id: string
          match_score: number | null
          next_action: string | null
          next_action_at: string | null
          notes: string | null
          owner_user_id: string | null
          project_id: string
          stage: string
          ticket_estimated_usd: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          deal_id: string
          id?: string
          investor_id: string
          match_score?: number | null
          next_action?: string | null
          next_action_at?: string | null
          notes?: string | null
          owner_user_id?: string | null
          project_id: string
          stage?: string
          ticket_estimated_usd?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          deal_id?: string
          id?: string
          investor_id?: string
          match_score?: number | null
          next_action?: string | null
          next_action_at?: string | null
          notes?: string | null
          owner_user_id?: string | null
          project_id?: string
          stage?: string
          ticket_estimated_usd?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_investor_pipeline_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_investor_pipeline_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_investor_pipeline_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "deal_investor_pipeline_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_target_markets: {
        Row: {
          deal_id: string
          market: string
        }
        Insert: {
          deal_id: string
          market: string
        }
        Update: {
          deal_id?: string
          market?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_target_markets_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          acquisition_structure: string
          acquisition_terms: Json
          code: string
          commodity: string | null
          created_at: string
          created_by: string
          deal_status: string
          description: string | null
          fx_clp_usd: number | null
          id: string
          name: string
          owner_type: string | null
          project_id: string | null
          region: string | null
          resource_moz: number | null
          updated_at: string
          valuation_clp: number | null
          valuation_usd: number | null
        }
        Insert: {
          acquisition_structure?: string
          acquisition_terms?: Json
          code: string
          commodity?: string | null
          created_at?: string
          created_by: string
          deal_status?: string
          description?: string | null
          fx_clp_usd?: number | null
          id?: string
          name: string
          owner_type?: string | null
          project_id?: string | null
          region?: string | null
          resource_moz?: number | null
          updated_at?: string
          valuation_clp?: number | null
          valuation_usd?: number | null
        }
        Update: {
          acquisition_structure?: string
          acquisition_terms?: Json
          code?: string
          commodity?: string | null
          created_at?: string
          created_by?: string
          deal_status?: string
          description?: string | null
          fx_clp_usd?: number | null
          id?: string
          name?: string
          owner_type?: string | null
          project_id?: string | null
          region?: string | null
          resource_moz?: number | null
          updated_at?: string
          valuation_clp?: number | null
          valuation_usd?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "deals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      dem_diffs: {
        Row: {
          bbox_geojson: Json | null
          campaign_id: string | null
          cells_analyzed: number | null
          created_at: string
          created_by: string
          cut_volume_m3: number | null
          diff_max_m: number | null
          diff_mean_m: number | null
          diff_min_m: number | null
          fill_volume_m3: number | null
          id: string
          name: string
          net_volume_m3: number | null
          notes: string | null
          pixel_size_m: number | null
          project_id: string
          raster_after_id: string
          raster_before_id: string
          storage_path: string | null
          updated_at: string
        }
        Insert: {
          bbox_geojson?: Json | null
          campaign_id?: string | null
          cells_analyzed?: number | null
          created_at?: string
          created_by: string
          cut_volume_m3?: number | null
          diff_max_m?: number | null
          diff_mean_m?: number | null
          diff_min_m?: number | null
          fill_volume_m3?: number | null
          id?: string
          name: string
          net_volume_m3?: number | null
          notes?: string | null
          pixel_size_m?: number | null
          project_id: string
          raster_after_id: string
          raster_before_id: string
          storage_path?: string | null
          updated_at?: string
        }
        Update: {
          bbox_geojson?: Json | null
          campaign_id?: string | null
          cells_analyzed?: number | null
          created_at?: string
          created_by?: string
          cut_volume_m3?: number | null
          diff_max_m?: number | null
          diff_mean_m?: number | null
          diff_min_m?: number | null
          fill_volume_m3?: number | null
          id?: string
          name?: string
          net_volume_m3?: number | null
          notes?: string | null
          pixel_size_m?: number | null
          project_id?: string
          raster_after_id?: string
          raster_before_id?: string
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dem_diffs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "exploration_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dem_diffs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "dem_diffs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dem_diffs_raster_after_id_fkey"
            columns: ["raster_after_id"]
            isOneToOne: false
            referencedRelation: "drone_rasters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dem_diffs_raster_before_id_fkey"
            columns: ["raster_before_id"]
            isOneToOne: false
            referencedRelation: "drone_rasters"
            referencedColumns: ["id"]
          },
        ]
      }
      document_signatures: {
        Row: {
          created_at: string
          envelope_id: string
          id: string
          ip_address: string | null
          project_id: string
          rejection_reason: string | null
          signature_hmac: string | null
          signed_at: string | null
          signed_document_hash: string | null
          signer_email: string | null
          signer_name: string
          signer_role: string
          signer_user_id: string
          signing_order: number
          status: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          envelope_id: string
          id?: string
          ip_address?: string | null
          project_id: string
          rejection_reason?: string | null
          signature_hmac?: string | null
          signed_at?: string | null
          signed_document_hash?: string | null
          signer_email?: string | null
          signer_name: string
          signer_role: string
          signer_user_id: string
          signing_order?: number
          status?: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          envelope_id?: string
          id?: string
          ip_address?: string | null
          project_id?: string
          rejection_reason?: string | null
          signature_hmac?: string | null
          signed_at?: string | null
          signed_document_hash?: string | null
          signer_email?: string | null
          signer_name?: string
          signer_role?: string
          signer_user_id?: string
          signing_order?: number
          status?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_signatures_envelope_id_fkey"
            columns: ["envelope_id"]
            isOneToOne: false
            referencedRelation: "signature_envelopes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_signatures_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "document_signatures_project_id_fkey"
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
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
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
          ai_model: string | null
          ai_provider: string | null
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
          is_ai: boolean
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
          ai_model?: string | null
          ai_provider?: string | null
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
          is_ai?: boolean
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
          ai_model?: string | null
          ai_provider?: string | null
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
          is_ai?: boolean
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
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
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
          battery_count: number | null
          battery_used_pct: number | null
          campaign_id: string | null
          created_at: string
          created_by: string
          duration_min: number | null
          flight_path_geojson: Json | null
          flown_at: string | null
          geometry_geojson: Json | null
          gsd_cm: number | null
          id: string
          mission_aoi_geojson: Json | null
          name: string
          notes: string | null
          overlap_front_pct: number | null
          overlap_side_pct: number | null
          pilot: string | null
          project_id: string
          sensor: string
          status: string
          updated_at: string
          waypoints_geojson: Json | null
        }
        Insert: {
          altitude_m?: number | null
          area_ha?: number | null
          battery_count?: number | null
          battery_used_pct?: number | null
          campaign_id?: string | null
          created_at?: string
          created_by: string
          duration_min?: number | null
          flight_path_geojson?: Json | null
          flown_at?: string | null
          geometry_geojson?: Json | null
          gsd_cm?: number | null
          id?: string
          mission_aoi_geojson?: Json | null
          name: string
          notes?: string | null
          overlap_front_pct?: number | null
          overlap_side_pct?: number | null
          pilot?: string | null
          project_id: string
          sensor?: string
          status?: string
          updated_at?: string
          waypoints_geojson?: Json | null
        }
        Update: {
          altitude_m?: number | null
          area_ha?: number | null
          battery_count?: number | null
          battery_used_pct?: number | null
          campaign_id?: string | null
          created_at?: string
          created_by?: string
          duration_min?: number | null
          flight_path_geojson?: Json | null
          flown_at?: string | null
          geometry_geojson?: Json | null
          gsd_cm?: number | null
          id?: string
          mission_aoi_geojson?: Json | null
          name?: string
          notes?: string | null
          overlap_front_pct?: number | null
          overlap_side_pct?: number | null
          pilot?: string | null
          project_id?: string
          sensor?: string
          status?: string
          updated_at?: string
          waypoints_geojson?: Json | null
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
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
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
          band_count: number | null
          bounds_geojson: Json | null
          campaign_id: string | null
          captured_at: string | null
          created_at: string
          created_by: string
          crs: string | null
          file_size_bytes: number | null
          flight_id: string | null
          height_px: number | null
          id: string
          max_value: number | null
          min_value: number | null
          name: string
          notes: string | null
          pixel_size_m: number | null
          processing: boolean
          project_id: string
          raster_type: string
          storage_path: string | null
          updated_at: string
          url: string
          width_px: number | null
        }
        Insert: {
          band_count?: number | null
          bounds_geojson?: Json | null
          campaign_id?: string | null
          captured_at?: string | null
          created_at?: string
          created_by: string
          crs?: string | null
          file_size_bytes?: number | null
          flight_id?: string | null
          height_px?: number | null
          id?: string
          max_value?: number | null
          min_value?: number | null
          name: string
          notes?: string | null
          pixel_size_m?: number | null
          processing?: boolean
          project_id: string
          raster_type?: string
          storage_path?: string | null
          updated_at?: string
          url: string
          width_px?: number | null
        }
        Update: {
          band_count?: number | null
          bounds_geojson?: Json | null
          campaign_id?: string | null
          captured_at?: string | null
          created_at?: string
          created_by?: string
          crs?: string | null
          file_size_bytes?: number | null
          flight_id?: string | null
          height_px?: number | null
          id?: string
          max_value?: number | null
          min_value?: number | null
          name?: string
          notes?: string | null
          pixel_size_m?: number | null
          processing?: boolean
          project_id?: string
          raster_type?: string
          storage_path?: string | null
          updated_at?: string
          url?: string
          width_px?: number | null
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
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
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
      economic_scenarios: {
        Row: {
          annual_throughput_t: number
          capex_usd: number
          commodity_price_usd: number
          computed_at: string | null
          created_at: string
          created_by: string
          description: string | null
          discount_rate_pct: number
          ebitda_usd: number | null
          ga_cost_usd_t: number
          gross_revenue_usd: number | null
          id: string
          irr_pct: number | null
          mean_grade: number | null
          metal_payable: number | null
          mine_life_years: number | null
          mining_cost_usd_t: number
          model_id: string
          name: string
          notes: string | null
          npv_usd: number | null
          nsr_cutoff_usd_t: number | null
          ore_tonnes: number | null
          payable_pct: number
          payback_years: number | null
          price_unit: string
          processing_cost_usd_t: number
          project_id: string
          ramp_up_years: number
          recovery_pct: number
          refining_cost_usd_oz: number
          royalty_pct: number
          slope_angle_deg: number
          status: string
          strip_ratio: number | null
          sustaining_capex_usd_t: number
          total_capex_usd: number | null
          total_opex_usd: number | null
          transport_cost_usd_t: number
          updated_at: string
          waste_cost_usd_t: number
          waste_tonnes: number | null
        }
        Insert: {
          annual_throughput_t?: number
          capex_usd?: number
          commodity_price_usd?: number
          computed_at?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          discount_rate_pct?: number
          ebitda_usd?: number | null
          ga_cost_usd_t?: number
          gross_revenue_usd?: number | null
          id?: string
          irr_pct?: number | null
          mean_grade?: number | null
          metal_payable?: number | null
          mine_life_years?: number | null
          mining_cost_usd_t?: number
          model_id: string
          name: string
          notes?: string | null
          npv_usd?: number | null
          nsr_cutoff_usd_t?: number | null
          ore_tonnes?: number | null
          payable_pct?: number
          payback_years?: number | null
          price_unit?: string
          processing_cost_usd_t?: number
          project_id: string
          ramp_up_years?: number
          recovery_pct?: number
          refining_cost_usd_oz?: number
          royalty_pct?: number
          slope_angle_deg?: number
          status?: string
          strip_ratio?: number | null
          sustaining_capex_usd_t?: number
          total_capex_usd?: number | null
          total_opex_usd?: number | null
          transport_cost_usd_t?: number
          updated_at?: string
          waste_cost_usd_t?: number
          waste_tonnes?: number | null
        }
        Update: {
          annual_throughput_t?: number
          capex_usd?: number
          commodity_price_usd?: number
          computed_at?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          discount_rate_pct?: number
          ebitda_usd?: number | null
          ga_cost_usd_t?: number
          gross_revenue_usd?: number | null
          id?: string
          irr_pct?: number | null
          mean_grade?: number | null
          metal_payable?: number | null
          mine_life_years?: number | null
          mining_cost_usd_t?: number
          model_id?: string
          name?: string
          notes?: string | null
          npv_usd?: number | null
          nsr_cutoff_usd_t?: number | null
          ore_tonnes?: number | null
          payable_pct?: number
          payback_years?: number | null
          price_unit?: string
          processing_cost_usd_t?: number
          project_id?: string
          ramp_up_years?: number
          recovery_pct?: number
          refining_cost_usd_oz?: number
          royalty_pct?: number
          slope_angle_deg?: number
          status?: string
          strip_ratio?: number | null
          sustaining_capex_usd_t?: number
          total_capex_usd?: number | null
          total_opex_usd?: number | null
          transport_cost_usd_t?: number
          updated_at?: string
          waste_cost_usd_t?: number
          waste_tonnes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "economic_scenarios_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "resource_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "economic_scenarios_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "economic_scenarios_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      economic_schedule: {
        Row: {
          capex_usd: number
          cashflow_usd: number
          created_at: string
          cumulative_cashflow_usd: number
          discounted_cashflow_usd: number
          id: string
          mean_grade: number | null
          metal_payable: number
          opex_usd: number
          ore_tonnes: number
          project_id: string
          revenue_usd: number
          scenario_id: string
          waste_tonnes: number
          year: number
        }
        Insert: {
          capex_usd?: number
          cashflow_usd?: number
          created_at?: string
          cumulative_cashflow_usd?: number
          discounted_cashflow_usd?: number
          id?: string
          mean_grade?: number | null
          metal_payable?: number
          opex_usd?: number
          ore_tonnes?: number
          project_id: string
          revenue_usd?: number
          scenario_id: string
          waste_tonnes?: number
          year: number
        }
        Update: {
          capex_usd?: number
          cashflow_usd?: number
          created_at?: string
          cumulative_cashflow_usd?: number
          discounted_cashflow_usd?: number
          id?: string
          mean_grade?: number | null
          metal_payable?: number
          opex_usd?: number
          ore_tonnes?: number
          project_id?: string
          revenue_usd?: number
          scenario_id?: string
          waste_tonnes?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "economic_schedule_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "economic_schedule_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "economic_schedule_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "economic_scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      escrito_templates: {
        Row: {
          abogado_colegiatura: string | null
          abogado_direccion: string | null
          abogado_email: string | null
          abogado_nombre: string | null
          abogado_rut: string | null
          abogado_telefono: string | null
          created_at: string
          cuerpo_template: string
          estudio_direccion: string | null
          estudio_email: string | null
          estudio_nombre: string | null
          estudio_telefono: string | null
          estudio_web: string | null
          forma_notificacion: string | null
          id: string
          is_default: boolean
          logo_url: string | null
          nombre: string
          otrosies: Json
          owner_id: string
          project_id: string | null
          suma_template: string
          updated_at: string
        }
        Insert: {
          abogado_colegiatura?: string | null
          abogado_direccion?: string | null
          abogado_email?: string | null
          abogado_nombre?: string | null
          abogado_rut?: string | null
          abogado_telefono?: string | null
          created_at?: string
          cuerpo_template?: string
          estudio_direccion?: string | null
          estudio_email?: string | null
          estudio_nombre?: string | null
          estudio_telefono?: string | null
          estudio_web?: string | null
          forma_notificacion?: string | null
          id?: string
          is_default?: boolean
          logo_url?: string | null
          nombre: string
          otrosies?: Json
          owner_id: string
          project_id?: string | null
          suma_template?: string
          updated_at?: string
        }
        Update: {
          abogado_colegiatura?: string | null
          abogado_direccion?: string | null
          abogado_email?: string | null
          abogado_nombre?: string | null
          abogado_rut?: string | null
          abogado_telefono?: string | null
          created_at?: string
          cuerpo_template?: string
          estudio_direccion?: string | null
          estudio_email?: string | null
          estudio_nombre?: string | null
          estudio_telefono?: string | null
          estudio_web?: string | null
          forma_notificacion?: string | null
          id?: string
          is_default?: boolean
          logo_url?: string | null
          nombre?: string
          otrosies?: Json
          owner_id?: string
          project_id?: string | null
          suma_template?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "escrito_templates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "escrito_templates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_capture_audit: {
        Row: {
          created_at: string
          device_info: Json | null
          event_type: string
          evidence_id: string
          id: string
          ip_address: string | null
          notes: string | null
          project_id: string
          scene_config: Json | null
          selection: Json | null
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          device_info?: Json | null
          event_type: string
          evidence_id: string
          id?: string
          ip_address?: string | null
          notes?: string | null
          project_id: string
          scene_config?: Json | null
          selection?: Json | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          device_info?: Json | null
          event_type?: string
          evidence_id?: string
          id?: string
          ip_address?: string | null
          notes?: string | null
          project_id?: string
          scene_config?: Json | null
          selection?: Json | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evidence_capture_audit_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "satellite_evidence"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_qp_attachments: {
        Row: {
          created_at: string
          evidence_id: string
          file_name: string
          id: string
          mime_type: string | null
          project_id: string
          review_id: string | null
          size_bytes: number | null
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          evidence_id: string
          file_name: string
          id?: string
          mime_type?: string | null
          project_id: string
          review_id?: string | null
          size_bytes?: number | null
          storage_path: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          evidence_id?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          project_id?: string
          review_id?: string | null
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_qp_attachments_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "satellite_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_qp_attachments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "evidence_qp_attachments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_qp_attachments_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "evidence_qp_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_qp_reviews: {
        Row: {
          created_at: string
          evidence_id: string
          id: string
          new_status: string
          observation: string | null
          previous_status: string | null
          project_id: string
          reviewer_id: string
        }
        Insert: {
          created_at?: string
          evidence_id: string
          id?: string
          new_status: string
          observation?: string | null
          previous_status?: string | null
          project_id: string
          reviewer_id: string
        }
        Update: {
          created_at?: string
          evidence_id?: string
          id?: string
          new_status?: string
          observation?: string | null
          previous_status?: string | null
          project_id?: string
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_qp_reviews_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "satellite_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_qp_reviews_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "evidence_qp_reviews_project_id_fkey"
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
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
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
          geom: unknown
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
          geom?: unknown
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
          geom?: unknown
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
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
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
      express_reports: {
        Row: {
          concession_id: string | null
          created_at: string
          created_by: string | null
          evidence: Json
          hash: string
          id: string
          markdown: string
          model: string | null
          project_id: string
          provider: string | null
          status: string
          title: string
        }
        Insert: {
          concession_id?: string | null
          created_at?: string
          created_by?: string | null
          evidence?: Json
          hash: string
          id?: string
          markdown?: string
          model?: string | null
          project_id: string
          provider?: string | null
          status?: string
          title: string
        }
        Update: {
          concession_id?: string | null
          created_at?: string
          created_by?: string | null
          evidence?: Json
          hash?: string
          id?: string
          markdown?: string
          model?: string | null
          project_id?: string
          provider?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "express_reports_concession_id_fkey"
            columns: ["concession_id"]
            isOneToOne: false
            referencedRelation: "concession_change_summary"
            referencedColumns: ["concession_id"]
          },
          {
            foreignKeyName: "express_reports_concession_id_fkey"
            columns: ["concession_id"]
            isOneToOne: false
            referencedRelation: "mining_concessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "express_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "express_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_up_tasks: {
        Row: {
          assigned_to: string | null
          category: Database["public"]["Enums"]["follow_up_category"]
          completed_at: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          priority: Database["public"]["Enums"]["follow_up_priority"]
          project_id: string
          source: string
          source_ref: string | null
          status: Database["public"]["Enums"]["follow_up_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["follow_up_category"]
          completed_at?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["follow_up_priority"]
          project_id: string
          source?: string
          source_ref?: string | null
          status?: Database["public"]["Enums"]["follow_up_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["follow_up_category"]
          completed_at?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["follow_up_priority"]
          project_id?: string
          source?: string
          source_ref?: string | null
          status?: Database["public"]["Enums"]["follow_up_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
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
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "geo_references_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      geochem_analyses: {
        Row: {
          cluster_count: number
          clusters: Json
          created_at: string
          created_by: string
          elements_used: string[]
          id: string
          notes: string | null
          pathfinder_scores: Json
          pca_loadings: Json
          pca_scores: Json
          pca_variance: Json
          project_id: string
          sample_count: number
          signature: string | null
          signature_confidence: number | null
          updated_at: string
        }
        Insert: {
          cluster_count?: number
          clusters?: Json
          created_at?: string
          created_by: string
          elements_used?: string[]
          id?: string
          notes?: string | null
          pathfinder_scores?: Json
          pca_loadings?: Json
          pca_scores?: Json
          pca_variance?: Json
          project_id: string
          sample_count?: number
          signature?: string | null
          signature_confidence?: number | null
          updated_at?: string
        }
        Update: {
          cluster_count?: number
          clusters?: Json
          created_at?: string
          created_by?: string
          elements_used?: string[]
          id?: string
          notes?: string | null
          pathfinder_scores?: Json
          pca_loadings?: Json
          pca_scores?: Json
          pca_variance?: Json
          project_id?: string
          sample_count?: number
          signature?: string | null
          signature_confidence?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "geochem_analyses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "geochem_analyses_project_id_fkey"
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
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
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
      geophysics_anomalies: {
        Row: {
          anomaly_type: string
          code: string
          confidence_pct: number | null
          created_at: string
          created_by: string
          dismissed_reason: string | null
          estimated_area_m2: number | null
          estimated_depth_m: number | null
          evidence: Json | null
          id: string
          lat: number | null
          lng: number | null
          notes: string | null
          peak_unit: string | null
          peak_value: number | null
          project_id: string
          promoted_at: string | null
          rationale: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          severity: string
          station_id: string | null
          status: string
          survey_id: string
          target_id: string | null
          updated_at: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          anomaly_type?: string
          code: string
          confidence_pct?: number | null
          created_at?: string
          created_by: string
          dismissed_reason?: string | null
          estimated_area_m2?: number | null
          estimated_depth_m?: number | null
          evidence?: Json | null
          id?: string
          lat?: number | null
          lng?: number | null
          notes?: string | null
          peak_unit?: string | null
          peak_value?: number | null
          project_id: string
          promoted_at?: string | null
          rationale?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          station_id?: string | null
          status?: string
          survey_id: string
          target_id?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          anomaly_type?: string
          code?: string
          confidence_pct?: number | null
          created_at?: string
          created_by?: string
          dismissed_reason?: string | null
          estimated_area_m2?: number | null
          estimated_depth_m?: number | null
          evidence?: Json | null
          id?: string
          lat?: number | null
          lng?: number | null
          notes?: string | null
          peak_unit?: string | null
          peak_value?: number | null
          project_id?: string
          promoted_at?: string | null
          rationale?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          station_id?: string | null
          status?: string
          survey_id?: string
          target_id?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "geophysics_anomalies_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "geophysics_anomalies_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geophysics_anomalies_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "geophysics_stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geophysics_anomalies_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "geophysics_surveys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geophysics_anomalies_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "exploration_targets"
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
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
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
          acquisition_date: string | null
          campaign_id: string | null
          contractor: string | null
          cost_usd: number | null
          created_at: string
          created_by: string | null
          crs_epsg: number | null
          display_order: number
          expected_depth_m: number | null
          id: string
          instrument: string | null
          line_spacing_m: number | null
          method: string
          name: string
          notes: string | null
          planned_km: number | null
          project_id: string | null
          resolution_m: number | null
          sensor_height_agl_m: number | null
          station_spacing_m: number | null
          status: string
          updated_at: string
        }
        Insert: {
          acquisition_date?: string | null
          campaign_id?: string | null
          contractor?: string | null
          cost_usd?: number | null
          created_at?: string
          created_by?: string | null
          crs_epsg?: number | null
          display_order?: number
          expected_depth_m?: number | null
          id?: string
          instrument?: string | null
          line_spacing_m?: number | null
          method: string
          name: string
          notes?: string | null
          planned_km?: number | null
          project_id?: string | null
          resolution_m?: number | null
          sensor_height_agl_m?: number | null
          station_spacing_m?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          acquisition_date?: string | null
          campaign_id?: string | null
          contractor?: string | null
          cost_usd?: number | null
          created_at?: string
          created_by?: string | null
          crs_epsg?: number | null
          display_order?: number
          expected_depth_m?: number | null
          id?: string
          instrument?: string | null
          line_spacing_m?: number | null
          method?: string
          name?: string
          notes?: string | null
          planned_km?: number | null
          project_id?: string | null
          resolution_m?: number | null
          sensor_height_agl_m?: number | null
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
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
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
      holder_files: {
        Row: {
          description: string | null
          file_name: string
          file_path: string
          file_type: string
          holder_id: string
          id: string
          project_id: string
          size_bytes: number | null
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          description?: string | null
          file_name: string
          file_path: string
          file_type?: string
          holder_id: string
          id?: string
          project_id: string
          size_bytes?: number | null
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          description?: string | null
          file_name?: string
          file_path?: string
          file_type?: string
          holder_id?: string
          id?: string
          project_id?: string
          size_bytes?: number | null
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "holder_files_holder_id_fkey"
            columns: ["holder_id"]
            isOneToOne: false
            referencedRelation: "concession_holders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holder_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "holder_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      holder_links: {
        Row: {
          auto_matched: boolean
          bulletin_id: string | null
          case_id: string | null
          external_url: string | null
          holder_id: string
          id: string
          label: string | null
          link_type: string
          linked_at: string
          linked_by: string | null
          notes: string | null
          project_id: string
        }
        Insert: {
          auto_matched?: boolean
          bulletin_id?: string | null
          case_id?: string | null
          external_url?: string | null
          holder_id: string
          id?: string
          label?: string | null
          link_type: string
          linked_at?: string
          linked_by?: string | null
          notes?: string | null
          project_id: string
        }
        Update: {
          auto_matched?: boolean
          bulletin_id?: string | null
          case_id?: string | null
          external_url?: string | null
          holder_id?: string
          id?: string
          label?: string | null
          link_type?: string
          linked_at?: string
          linked_by?: string | null
          notes?: string | null
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "holder_links_bulletin_id_fkey"
            columns: ["bulletin_id"]
            isOneToOne: false
            referencedRelation: "mining_bulletins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holder_links_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "mining_court_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holder_links_holder_id_fkey"
            columns: ["holder_id"]
            isOneToOne: false
            referencedRelation: "concession_holders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holder_links_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "holder_links_project_id_fkey"
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
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "hse_permits_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      hyperspectral_products: {
        Row: {
          acquisition_date: string
          algorithm: string
          area_ha: number | null
          assemblage:
            | Database["public"]["Enums"]["alteration_assemblage"]
            | null
          bbox_geojson: Json
          cells_above_threshold: number | null
          cloud_pct: number | null
          cog_url: string | null
          created_at: string
          created_by: string
          id: string
          max_score: number | null
          mean_score: number | null
          metadata: Json
          mineral: Database["public"]["Enums"]["hyperspectral_mineral"]
          notes: string | null
          pixel_size_m: number | null
          project_id: string
          scene_id: string | null
          source: string
          spectral_library: string | null
          stac_href: string | null
          threshold: number | null
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          acquisition_date: string
          algorithm?: string
          area_ha?: number | null
          assemblage?:
            | Database["public"]["Enums"]["alteration_assemblage"]
            | null
          bbox_geojson: Json
          cells_above_threshold?: number | null
          cloud_pct?: number | null
          cog_url?: string | null
          created_at?: string
          created_by: string
          id?: string
          max_score?: number | null
          mean_score?: number | null
          metadata?: Json
          mineral: Database["public"]["Enums"]["hyperspectral_mineral"]
          notes?: string | null
          pixel_size_m?: number | null
          project_id: string
          scene_id?: string | null
          source: string
          spectral_library?: string | null
          stac_href?: string | null
          threshold?: number | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          acquisition_date?: string
          algorithm?: string
          area_ha?: number | null
          assemblage?:
            | Database["public"]["Enums"]["alteration_assemblage"]
            | null
          bbox_geojson?: Json
          cells_above_threshold?: number | null
          cloud_pct?: number | null
          cog_url?: string | null
          created_at?: string
          created_by?: string
          id?: string
          max_score?: number | null
          mean_score?: number | null
          metadata?: Json
          mineral?: Database["public"]["Enums"]["hyperspectral_mineral"]
          notes?: string | null
          pixel_size_m?: number | null
          project_id?: string
          scene_id?: string | null
          source?: string
          spectral_library?: string | null
          stac_href?: string | null
          threshold?: number | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hyperspectral_products_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "hyperspectral_products_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      insar_displacement: {
        Row: {
          alert_severity: string | null
          ascending: boolean | null
          asset_name: string | null
          asset_type: string | null
          bbox_geojson: Json
          cog_url: string | null
          coherence: number | null
          created_at: string
          created_by: string
          cumulative_displacement_mm: number | null
          end_date: string
          id: string
          los_vector: Json | null
          metadata: Json
          notes: string | null
          point_geojson: Json
          project_id: string
          reference_date: string
          source: string
          time_series: Json | null
          updated_at: string
          velocity_mm_year: number
        }
        Insert: {
          alert_severity?: string | null
          ascending?: boolean | null
          asset_name?: string | null
          asset_type?: string | null
          bbox_geojson: Json
          cog_url?: string | null
          coherence?: number | null
          created_at?: string
          created_by: string
          cumulative_displacement_mm?: number | null
          end_date: string
          id?: string
          los_vector?: Json | null
          metadata?: Json
          notes?: string | null
          point_geojson: Json
          project_id: string
          reference_date: string
          source?: string
          time_series?: Json | null
          updated_at?: string
          velocity_mm_year: number
        }
        Update: {
          alert_severity?: string | null
          ascending?: boolean | null
          asset_name?: string | null
          asset_type?: string | null
          bbox_geojson?: Json
          cog_url?: string | null
          coherence?: number | null
          created_at?: string
          created_by?: string
          cumulative_displacement_mm?: number | null
          end_date?: string
          id?: string
          los_vector?: Json | null
          metadata?: Json
          notes?: string | null
          point_geojson?: Json
          project_id?: string
          reference_date?: string
          source?: string
          time_series?: Json | null
          updated_at?: string
          velocity_mm_year?: number
        }
        Relationships: [
          {
            foreignKeyName: "insar_displacement_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "insar_displacement_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_contacts: {
        Row: {
          created_at: string
          created_by: string
          email: string | null
          full_name: string
          id: string
          investor_id: string
          is_primary: boolean
          linkedin_url: string | null
          notes: string | null
          phone: string | null
          project_id: string
          role_title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          email?: string | null
          full_name: string
          id?: string
          investor_id: string
          is_primary?: boolean
          linkedin_url?: string | null
          notes?: string | null
          phone?: string | null
          project_id: string
          role_title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          email?: string | null
          full_name?: string
          id?: string
          investor_id?: string
          is_primary?: boolean
          linkedin_url?: string | null
          notes?: string | null
          phone?: string | null
          project_id?: string
          role_title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "investor_contacts_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_contacts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "investor_contacts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_interactions: {
        Row: {
          body: string | null
          created_at: string
          created_by: string
          id: string
          interaction_type: string
          investor_id: string
          occurred_at: string
          pipeline_id: string | null
          project_id: string
          subject: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          created_by: string
          id?: string
          interaction_type?: string
          investor_id: string
          occurred_at?: string
          pipeline_id?: string | null
          project_id: string
          subject?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          created_by?: string
          id?: string
          interaction_type?: string
          investor_id?: string
          occurred_at?: string
          pipeline_id?: string | null
          project_id?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "investor_interactions_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_interactions_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "deal_investor_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_interactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "investor_interactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_profiles: {
        Row: {
          accepted_standards: string[]
          commodities: string[]
          company_name: string
          country: string
          created_at: string
          full_name: string
          id: string
          investor_type: string
          notes: string | null
          phone: string | null
          rejection_reason: string | null
          review_status: Database["public"]["Enums"]["review_status"]
          reviewed_at: string | null
          reviewed_by: string | null
          ticket_max_usd: number | null
          ticket_min_usd: number | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          accepted_standards?: string[]
          commodities?: string[]
          company_name: string
          country: string
          created_at?: string
          full_name: string
          id?: string
          investor_type: string
          notes?: string | null
          phone?: string | null
          rejection_reason?: string | null
          review_status?: Database["public"]["Enums"]["review_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          ticket_max_usd?: number | null
          ticket_min_usd?: number | null
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          accepted_standards?: string[]
          commodities?: string[]
          company_name?: string
          country?: string
          created_at?: string
          full_name?: string
          id?: string
          investor_type?: string
          notes?: string | null
          phone?: string | null
          rejection_reason?: string | null
          review_status?: Database["public"]["Enums"]["review_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          ticket_max_usd?: number | null
          ticket_min_usd?: number | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      investor_shared_views: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          include_anomalies: boolean
          include_catastro: boolean
          include_economics: boolean
          include_targets: boolean
          last_viewed_at: string | null
          project_id: string
          recipient_label: string | null
          revoked_at: string | null
          scenario_id: string | null
          token: string
          updated_at: string
          view_count: number
          watermark_label: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          include_anomalies?: boolean
          include_catastro?: boolean
          include_economics?: boolean
          include_targets?: boolean
          last_viewed_at?: string | null
          project_id: string
          recipient_label?: string | null
          revoked_at?: string | null
          scenario_id?: string | null
          token?: string
          updated_at?: string
          view_count?: number
          watermark_label?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          include_anomalies?: boolean
          include_catastro?: boolean
          include_economics?: boolean
          include_targets?: boolean
          last_viewed_at?: string | null
          project_id?: string
          recipient_label?: string | null
          revoked_at?: string | null
          scenario_id?: string | null
          token?: string
          updated_at?: string
          view_count?: number
          watermark_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "investor_shared_views_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "investor_shared_views_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_shared_views_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "economic_scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      investors: {
        Row: {
          commodities: string[]
          country: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          investor_type: string
          is_active: boolean
          legal_name: string
          notes: string | null
          project_id: string
          region: string | null
          regions_focus: string[]
          risk_appetite: string
          short_name: string | null
          stage_focus: string[]
          ticket_max_usd: number | null
          ticket_min_usd: number | null
          updated_at: string
          website: string | null
        }
        Insert: {
          commodities?: string[]
          country?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          investor_type?: string
          is_active?: boolean
          legal_name: string
          notes?: string | null
          project_id: string
          region?: string | null
          regions_focus?: string[]
          risk_appetite?: string
          short_name?: string | null
          stage_focus?: string[]
          ticket_max_usd?: number | null
          ticket_min_usd?: number | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          commodities?: string[]
          country?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          investor_type?: string
          is_active?: boolean
          legal_name?: string
          notes?: string | null
          project_id?: string
          region?: string | null
          regions_focus?: string[]
          risk_appetite?: string
          short_name?: string | null
          stage_focus?: string[]
          ticket_max_usd?: number | null
          ticket_min_usd?: number | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "investors_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "investors_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      job_logs: {
        Row: {
          created_at: string
          id: string
          job_id: string
          level: string
          message: string
          payload: Json | null
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          level?: string
          message: string
          payload?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          level?: string
          message?: string
          payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "job_logs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      job_queue: {
        Row: {
          attempts: number
          created_at: string
          created_by: string | null
          finished_at: string | null
          id: string
          kind: string
          last_error: string | null
          max_attempts: number
          payload: Json
          priority: number
          project_id: string | null
          result: Json | null
          scheduled_at: string
          started_at: string | null
          status: string
          updated_at: string
          worker_id: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          created_by?: string | null
          finished_at?: string | null
          id?: string
          kind: string
          last_error?: string | null
          max_attempts?: number
          payload?: Json
          priority?: number
          project_id?: string | null
          result?: Json | null
          scheduled_at?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          worker_id?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          created_by?: string | null
          finished_at?: string | null
          id?: string
          kind?: string
          last_error?: string | null
          max_attempts?: number
          payload?: Json
          priority?: number
          project_id?: string | null
          result?: Json | null
          scheduled_at?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_queue_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "job_queue_project_id_fkey"
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
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
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
      mag_correlation_zones: {
        Row: {
          anomaly_type: string | null
          au_grade: number | null
          buffer_radius_m: number
          computed_by: string | null
          correlation_score: number | null
          created_at: string
          cu_grade: number | null
          exploration_target_id: string | null
          geom: unknown
          geometry_geojson: Json
          gradient_mag: number | null
          id: string
          interpretation: string | null
          magnetic_grid_id: string | null
          mo_grade: number | null
          name: string | null
          project_id: string
          structural_trend: string | null
          tmi_background: number | null
          tmi_max: number | null
          tmi_mean: number | null
          updated_at: string
          zone_code: string
        }
        Insert: {
          anomaly_type?: string | null
          au_grade?: number | null
          buffer_radius_m?: number
          computed_by?: string | null
          correlation_score?: number | null
          created_at?: string
          cu_grade?: number | null
          exploration_target_id?: string | null
          geom?: unknown
          geometry_geojson: Json
          gradient_mag?: number | null
          id?: string
          interpretation?: string | null
          magnetic_grid_id?: string | null
          mo_grade?: number | null
          name?: string | null
          project_id: string
          structural_trend?: string | null
          tmi_background?: number | null
          tmi_max?: number | null
          tmi_mean?: number | null
          updated_at?: string
          zone_code: string
        }
        Update: {
          anomaly_type?: string | null
          au_grade?: number | null
          buffer_radius_m?: number
          computed_by?: string | null
          correlation_score?: number | null
          created_at?: string
          cu_grade?: number | null
          exploration_target_id?: string | null
          geom?: unknown
          geometry_geojson?: Json
          gradient_mag?: number | null
          id?: string
          interpretation?: string | null
          magnetic_grid_id?: string | null
          mo_grade?: number | null
          name?: string | null
          project_id?: string
          structural_trend?: string | null
          tmi_background?: number | null
          tmi_max?: number | null
          tmi_mean?: number | null
          updated_at?: string
          zone_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "mag_correlation_zones_exploration_target_id_fkey"
            columns: ["exploration_target_id"]
            isOneToOne: false
            referencedRelation: "exploration_targets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mag_correlation_zones_magnetic_grid_id_fkey"
            columns: ["magnetic_grid_id"]
            isOneToOne: false
            referencedRelation: "magnetic_grids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mag_correlation_zones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "mag_correlation_zones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      magnetic_derivatives: {
        Row: {
          computed_at: string | null
          created_at: string
          derivative_type: string
          error_message: string | null
          grid_id: string
          id: string
          params: Json
          project_id: string
          status: string
          storage_path: string | null
          updated_at: string
          value_max: number | null
          value_mean: number | null
          value_min: number | null
        }
        Insert: {
          computed_at?: string | null
          created_at?: string
          derivative_type: string
          error_message?: string | null
          grid_id: string
          id?: string
          params?: Json
          project_id: string
          status?: string
          storage_path?: string | null
          updated_at?: string
          value_max?: number | null
          value_mean?: number | null
          value_min?: number | null
        }
        Update: {
          computed_at?: string | null
          created_at?: string
          derivative_type?: string
          error_message?: string | null
          grid_id?: string
          id?: string
          params?: Json
          project_id?: string
          status?: string
          storage_path?: string | null
          updated_at?: string
          value_max?: number | null
          value_mean?: number | null
          value_min?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "magnetic_derivatives_grid_id_fkey"
            columns: ["grid_id"]
            isOneToOne: false
            referencedRelation: "magnetic_grids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "magnetic_derivatives_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "magnetic_derivatives_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      magnetic_grids: {
        Row: {
          acquisition_date: string | null
          bbox: number[] | null
          cell_size_m: number | null
          cols: number | null
          contractor: string | null
          created_at: string
          created_by: string
          crs_epsg: number
          error_message: string | null
          grid_type: string
          id: string
          name: string
          processing_notes: string | null
          project_id: string
          qa_flags: Json
          rows: number | null
          source_format: string
          status: string
          storage_path: string | null
          survey_id: string
          updated_at: string
          value_max: number | null
          value_mean: number | null
          value_min: number | null
        }
        Insert: {
          acquisition_date?: string | null
          bbox?: number[] | null
          cell_size_m?: number | null
          cols?: number | null
          contractor?: string | null
          created_at?: string
          created_by: string
          crs_epsg: number
          error_message?: string | null
          grid_type?: string
          id?: string
          name: string
          processing_notes?: string | null
          project_id: string
          qa_flags?: Json
          rows?: number | null
          source_format?: string
          status?: string
          storage_path?: string | null
          survey_id: string
          updated_at?: string
          value_max?: number | null
          value_mean?: number | null
          value_min?: number | null
        }
        Update: {
          acquisition_date?: string | null
          bbox?: number[] | null
          cell_size_m?: number | null
          cols?: number | null
          contractor?: string | null
          created_at?: string
          created_by?: string
          crs_epsg?: number
          error_message?: string | null
          grid_type?: string
          id?: string
          name?: string
          processing_notes?: string | null
          project_id?: string
          qa_flags?: Json
          rows?: number | null
          source_format?: string
          status?: string
          storage_path?: string | null
          survey_id?: string
          updated_at?: string
          value_max?: number | null
          value_mean?: number | null
          value_min?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "magnetic_grids_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "magnetic_grids_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "magnetic_grids_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "geophysics_surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      map_annotations: {
        Row: {
          campaign_id: string | null
          color: string
          created_at: string
          created_by: string
          id: string
          lat: number
          lng: number
          phase: string | null
          priority: string
          project_id: string
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          resolved_reason: string | null
          target_id: string | null
          text: string
          updated_at: string
        }
        Insert: {
          campaign_id?: string | null
          color?: string
          created_at?: string
          created_by: string
          id?: string
          lat: number
          lng: number
          phase?: string | null
          priority?: string
          project_id: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          resolved_reason?: string | null
          target_id?: string | null
          text: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string | null
          color?: string
          created_at?: string
          created_by?: string
          id?: string
          lat?: number
          lng?: number
          phase?: string | null
          priority?: string
          project_id?: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          resolved_reason?: string | null
          target_id?: string | null
          text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "map_annotations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "exploration_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "map_annotations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "map_annotations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "map_annotations_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "exploration_targets"
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
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "map_views_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_layer_reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          layer_key: string
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          layer_key: string
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          layer_key?: string
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mensuras: {
        Row: {
          acta_url: string | null
          created_at: string
          created_by: string
          fecha_mensura: string | null
          id: string
          notas: string | null
          pedimento_id: string
          perito: string | null
          plano_url: string | null
          project_id: string
          updated_at: string
        }
        Insert: {
          acta_url?: string | null
          created_at?: string
          created_by: string
          fecha_mensura?: string | null
          id?: string
          notas?: string | null
          pedimento_id: string
          perito?: string | null
          plano_url?: string | null
          project_id: string
          updated_at?: string
        }
        Update: {
          acta_url?: string | null
          created_at?: string
          created_by?: string
          fecha_mensura?: string | null
          id?: string
          notas?: string | null
          pedimento_id?: string
          perito?: string | null
          plano_url?: string | null
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensuras_pedimento_id_fkey"
            columns: ["pedimento_id"]
            isOneToOne: false
            referencedRelation: "pedimentos"
            referencedColumns: ["id"]
          },
        ]
      }
      mine_log_messages: {
        Row: {
          attachments: Json | null
          body: string
          created_at: string
          id: string
          project_id: string
          tags: string[] | null
          user_id: string
        }
        Insert: {
          attachments?: Json | null
          body: string
          created_at?: string
          id?: string
          project_id: string
          tags?: string[] | null
          user_id: string
        }
        Update: {
          attachments?: Json | null
          body?: string
          created_at?: string
          id?: string
          project_id?: string
          tags?: string[] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mine_log_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "mine_log_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      mine_shifts: {
        Row: {
          created_at: string
          created_by: string
          id: string
          notes: string | null
          project_id: string
          shift_code: string
          shift_date: string
          supervisor_id: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          notes?: string | null
          project_id: string
          shift_code: string
          shift_date: string
          supervisor_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          project_id?: string
          shift_code?: string
          shift_date?: string
          supervisor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mine_shifts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "mine_shifts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      mineral_deposits: {
        Row: {
          alteration_rock: string | null
          commodities: string[]
          commune: string | null
          country: string
          created_at: string
          deposit_model: string | null
          deposit_type: string | null
          dev_status: string | null
          discovery_year: number | null
          external_id: string
          fetched_at: string
          geom: unknown
          host_rock: string | null
          id: string
          lat: number | null
          lng: number | null
          name: string | null
          oper_type: string | null
          ore: string | null
          primary_commodity: string | null
          prod_size: string | null
          raw: Json
          region: string | null
          source: string
          source_url: string | null
          tectonic_setting: string | null
          updated_at: string
          work_type: string | null
          year_first_prod: number | null
          year_last_prod: number | null
        }
        Insert: {
          alteration_rock?: string | null
          commodities?: string[]
          commune?: string | null
          country?: string
          created_at?: string
          deposit_model?: string | null
          deposit_type?: string | null
          dev_status?: string | null
          discovery_year?: number | null
          external_id: string
          fetched_at?: string
          geom?: unknown
          host_rock?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string | null
          oper_type?: string | null
          ore?: string | null
          primary_commodity?: string | null
          prod_size?: string | null
          raw?: Json
          region?: string | null
          source: string
          source_url?: string | null
          tectonic_setting?: string | null
          updated_at?: string
          work_type?: string | null
          year_first_prod?: number | null
          year_last_prod?: number | null
        }
        Update: {
          alteration_rock?: string | null
          commodities?: string[]
          commune?: string | null
          country?: string
          created_at?: string
          deposit_model?: string | null
          deposit_type?: string | null
          dev_status?: string | null
          discovery_year?: number | null
          external_id?: string
          fetched_at?: string
          geom?: unknown
          host_rock?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string | null
          oper_type?: string | null
          ore?: string | null
          primary_commodity?: string | null
          prod_size?: string | null
          raw?: Json
          region?: string | null
          source?: string
          source_url?: string | null
          tectonic_setting?: string | null
          updated_at?: string
          work_type?: string | null
          year_first_prod?: number | null
          year_last_prod?: number | null
        }
        Relationships: []
      }
      mineral_deposits_ingest_runs: {
        Row: {
          created_by: string | null
          duration_ms: number | null
          error_message: string | null
          failed_count: number
          finished_at: string | null
          id: string
          inserted_count: number
          metadata: Json
          source: string
          started_at: string
          status: string
          total_features: number | null
          unchanged_count: number
          updated_count: number
        }
        Insert: {
          created_by?: string | null
          duration_ms?: number | null
          error_message?: string | null
          failed_count?: number
          finished_at?: string | null
          id?: string
          inserted_count?: number
          metadata?: Json
          source: string
          started_at?: string
          status?: string
          total_features?: number | null
          unchanged_count?: number
          updated_count?: number
        }
        Update: {
          created_by?: string | null
          duration_ms?: number | null
          error_message?: string | null
          failed_count?: number
          finished_at?: string | null
          id?: string
          inserted_count?: number
          metadata?: Json
          source?: string
          started_at?: string
          status?: string
          total_features?: number | null
          unchanged_count?: number
          updated_count?: number
        }
        Relationships: []
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
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
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
      mining_bulletins: {
        Row: {
          area_ha: number | null
          centroid_lat: number | null
          centroid_lng: number | null
          comuna: string | null
          concession_code: string | null
          concession_name: string | null
          content_hash: string
          created_at: string
          geometry_geojson: Json | null
          holder_name: string | null
          holder_rut: string | null
          id: string
          provincia: string | null
          publication_date: string | null
          publication_number: string | null
          publication_type: string
          raw_payload: Json | null
          region: string | null
          scraped_at: string
          source: string
          source_url: string | null
          updated_at: string
        }
        Insert: {
          area_ha?: number | null
          centroid_lat?: number | null
          centroid_lng?: number | null
          comuna?: string | null
          concession_code?: string | null
          concession_name?: string | null
          content_hash: string
          created_at?: string
          geometry_geojson?: Json | null
          holder_name?: string | null
          holder_rut?: string | null
          id?: string
          provincia?: string | null
          publication_date?: string | null
          publication_number?: string | null
          publication_type?: string
          raw_payload?: Json | null
          region?: string | null
          scraped_at?: string
          source?: string
          source_url?: string | null
          updated_at?: string
        }
        Update: {
          area_ha?: number | null
          centroid_lat?: number | null
          centroid_lng?: number | null
          comuna?: string | null
          concession_code?: string | null
          concession_name?: string | null
          content_hash?: string
          created_at?: string
          geometry_geojson?: Json | null
          holder_name?: string | null
          holder_rut?: string | null
          id?: string
          provincia?: string | null
          publication_date?: string | null
          publication_number?: string | null
          publication_type?: string
          raw_payload?: Json | null
          region?: string | null
          scraped_at?: string
          source?: string
          source_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      mining_concessions: {
        Row: {
          area_ha: number | null
          code: string
          commune: string | null
          concession_type: string
          created_at: string
          created_by: string
          datum: string | null
          expires_at: string | null
          external_id: string | null
          geom: unknown
          geometry_geojson: Json | null
          granted_at: string | null
          holder: string | null
          holder_id: string | null
          id: string
          last_synced_at: string | null
          metadata: Json
          name: string
          notes: string | null
          project_id: string
          provincia: string | null
          region: string | null
          rut_holder: string | null
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
          datum?: string | null
          expires_at?: string | null
          external_id?: string | null
          geom?: unknown
          geometry_geojson?: Json | null
          granted_at?: string | null
          holder?: string | null
          holder_id?: string | null
          id?: string
          last_synced_at?: string | null
          metadata?: Json
          name: string
          notes?: string | null
          project_id: string
          provincia?: string | null
          region?: string | null
          rut_holder?: string | null
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
          datum?: string | null
          expires_at?: string | null
          external_id?: string | null
          geom?: unknown
          geometry_geojson?: Json | null
          granted_at?: string | null
          holder?: string | null
          holder_id?: string | null
          id?: string
          last_synced_at?: string | null
          metadata?: Json
          name?: string
          notes?: string | null
          project_id?: string
          provincia?: string | null
          region?: string | null
          rut_holder?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mining_concessions_holder_id_fkey"
            columns: ["holder_id"]
            isOneToOne: false
            referencedRelation: "concession_holders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mining_concessions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "mining_concessions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      mining_court_cases: {
        Row: {
          case_number: string | null
          comuna: string | null
          content_hash: string
          court: string | null
          created_at: string
          defendant: string | null
          defendant_rut: string | null
          filed_at: string | null
          id: string
          jurisdiction: string | null
          last_movement_at: string | null
          matter: string | null
          plaintiff: string | null
          raw_payload: Json | null
          region: string | null
          scraped_at: string
          source: string
          source_url: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          case_number?: string | null
          comuna?: string | null
          content_hash: string
          court?: string | null
          created_at?: string
          defendant?: string | null
          defendant_rut?: string | null
          filed_at?: string | null
          id?: string
          jurisdiction?: string | null
          last_movement_at?: string | null
          matter?: string | null
          plaintiff?: string | null
          raw_payload?: Json | null
          region?: string | null
          scraped_at?: string
          source?: string
          source_url?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          case_number?: string | null
          comuna?: string | null
          content_hash?: string
          court?: string | null
          created_at?: string
          defendant?: string | null
          defendant_rut?: string | null
          filed_at?: string | null
          id?: string
          jurisdiction?: string | null
          last_movement_at?: string | null
          matter?: string | null
          plaintiff?: string | null
          raw_payload?: Json | null
          region?: string | null
          scraped_at?: string
          source?: string
          source_url?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      mining_installations: {
        Row: {
          categoria_faena: string | null
          comuna_faena: string | null
          comuna_instalacion: string | null
          cota: number | null
          created_at: string
          datum: string | null
          estado: string | null
          este: number | null
          external_id: string
          fetched_at: string
          geom: unknown
          huso: number | null
          id: string
          id_estado: number | null
          id_faena: number | null
          id_instalacion: number | null
          id_tipo_instalacion: number | null
          lat: number | null
          lng: number | null
          nombre_empresa: string | null
          nombre_faena: string | null
          nombre_instalacion: string | null
          norte: number | null
          provincia_faena: string | null
          provincia_instalacion: string | null
          raw: Json
          recurso_minero: string | null
          recurso_primario: string | null
          region_faena: string | null
          region_instalacion: string | null
          rut_empresa: string | null
          source: string
          tipo_instalacion: string | null
          tipo_recurso: string | null
          updated_at: string
        }
        Insert: {
          categoria_faena?: string | null
          comuna_faena?: string | null
          comuna_instalacion?: string | null
          cota?: number | null
          created_at?: string
          datum?: string | null
          estado?: string | null
          este?: number | null
          external_id: string
          fetched_at?: string
          geom?: unknown
          huso?: number | null
          id?: string
          id_estado?: number | null
          id_faena?: number | null
          id_instalacion?: number | null
          id_tipo_instalacion?: number | null
          lat?: number | null
          lng?: number | null
          nombre_empresa?: string | null
          nombre_faena?: string | null
          nombre_instalacion?: string | null
          norte?: number | null
          provincia_faena?: string | null
          provincia_instalacion?: string | null
          raw?: Json
          recurso_minero?: string | null
          recurso_primario?: string | null
          region_faena?: string | null
          region_instalacion?: string | null
          rut_empresa?: string | null
          source?: string
          tipo_instalacion?: string | null
          tipo_recurso?: string | null
          updated_at?: string
        }
        Update: {
          categoria_faena?: string | null
          comuna_faena?: string | null
          comuna_instalacion?: string | null
          cota?: number | null
          created_at?: string
          datum?: string | null
          estado?: string | null
          este?: number | null
          external_id?: string
          fetched_at?: string
          geom?: unknown
          huso?: number | null
          id?: string
          id_estado?: number | null
          id_faena?: number | null
          id_instalacion?: number | null
          id_tipo_instalacion?: number | null
          lat?: number | null
          lng?: number | null
          nombre_empresa?: string | null
          nombre_faena?: string | null
          nombre_instalacion?: string | null
          norte?: number | null
          provincia_faena?: string | null
          provincia_instalacion?: string | null
          raw?: Json
          recurso_minero?: string | null
          recurso_primario?: string | null
          region_faena?: string | null
          region_instalacion?: string | null
          rut_empresa?: string | null
          source?: string
          tipo_instalacion?: string | null
          tipo_recurso?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      mining_installations_ingest_runs: {
        Row: {
          created_at: string
          created_by: string | null
          duration_ms: number | null
          error_message: string | null
          failed_count: number | null
          finished_at: string | null
          id: string
          inserted_count: number | null
          metadata: Json
          source: string
          status: string
          total_features: number | null
          unchanged_count: number | null
          updated_count: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          duration_ms?: number | null
          error_message?: string | null
          failed_count?: number | null
          finished_at?: string | null
          id?: string
          inserted_count?: number | null
          metadata?: Json
          source: string
          status?: string
          total_features?: number | null
          unchanged_count?: number | null
          updated_count?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          duration_ms?: number | null
          error_message?: string | null
          failed_count?: number | null
          finished_at?: string | null
          id?: string
          inserted_count?: number | null
          metadata?: Json
          source?: string
          status?: string
          total_features?: number | null
          unchanged_count?: number | null
          updated_count?: number | null
        }
        Relationships: []
      }
      mining_owner_profiles: {
        Row: {
          company_name: string | null
          country: string
          created_at: string
          entity_type: string
          full_name: string
          id: string
          intent: string
          notes: string | null
          num_concessions: number
          phone: string | null
          primary_commodity: string | null
          region: string | null
          rejection_reason: string | null
          review_status: Database["public"]["Enums"]["review_status"]
          reviewed_at: string | null
          reviewed_by: string | null
          rut: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_name?: string | null
          country?: string
          created_at?: string
          entity_type: string
          full_name: string
          id?: string
          intent: string
          notes?: string | null
          num_concessions?: number
          phone?: string | null
          primary_commodity?: string | null
          region?: string | null
          rejection_reason?: string | null
          review_status?: Database["public"]["Enums"]["review_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          rut?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_name?: string | null
          country?: string
          created_at?: string
          entity_type?: string
          full_name?: string
          id?: string
          intent?: string
          notes?: string | null
          num_concessions?: number
          phone?: string | null
          primary_commodity?: string | null
          region?: string | null
          rejection_reason?: string | null
          review_status?: Database["public"]["Enums"]["review_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          rut?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      module_role_permissions: {
        Row: {
          can_edit: boolean
          can_view: boolean
          id: string
          module_key: string
          role: Database["public"]["Enums"]["workspace_function_role"]
          updated_at: string
        }
        Insert: {
          can_edit?: boolean
          can_view?: boolean
          id?: string
          module_key: string
          role: Database["public"]["Enums"]["workspace_function_role"]
          updated_at?: string
        }
        Update: {
          can_edit?: boolean
          can_view?: boolean
          id?: string
          module_key?: string
          role?: Database["public"]["Enums"]["workspace_function_role"]
          updated_at?: string
        }
        Relationships: []
      }
      ni43101_gap_findings: {
        Row: {
          category: string
          created_at: string
          description: string
          id: string
          project_id: string
          recommended_action: string | null
          report_id: string
          resolved_at: string | null
          resolved_by: string | null
          section_no: number | null
          severity: string
          status: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          description: string
          id?: string
          project_id: string
          recommended_action?: string | null
          report_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          section_no?: number | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          project_id?: string
          recommended_action?: string | null
          report_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          section_no?: number | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ni43101_gap_findings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "ni43101_gap_findings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ni43101_gap_findings_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "technical_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      ni43101_satellite_evidence_links: {
        Row: {
          created_at: string
          evidence_id: string
          evidence_snapshot: Json
          id: string
          linked_at: string
          linked_by: string
          project_id: string
          report_id: string
          revoked_reason: string | null
          section_no: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          evidence_id: string
          evidence_snapshot: Json
          id?: string
          linked_at?: string
          linked_by: string
          project_id: string
          report_id: string
          revoked_reason?: string | null
          section_no: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          evidence_id?: string
          evidence_snapshot?: Json
          id?: string
          linked_at?: string
          linked_by?: string
          project_id?: string
          report_id?: string
          revoked_reason?: string | null
          section_no?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ni43101_satellite_evidence_links_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "satellite_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ni43101_satellite_evidence_links_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "ni43101_satellite_evidence_links_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ni43101_satellite_evidence_links_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "technical_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      ni43101_satellite_layers: {
        Row: {
          confidence_pct: number | null
          created_at: string
          created_by: string
          geojson: Json
          id: string
          interpretation_md: string | null
          layer_type: string
          notes: string | null
          project_id: string
          source: string
          updated_at: string
          validated_at: string | null
          validated_by_qp_id: string | null
        }
        Insert: {
          confidence_pct?: number | null
          created_at?: string
          created_by: string
          geojson: Json
          id?: string
          interpretation_md?: string | null
          layer_type: string
          notes?: string | null
          project_id: string
          source: string
          updated_at?: string
          validated_at?: string | null
          validated_by_qp_id?: string | null
        }
        Update: {
          confidence_pct?: number | null
          created_at?: string
          created_by?: string
          geojson?: Json
          id?: string
          interpretation_md?: string | null
          layer_type?: string
          notes?: string | null
          project_id?: string
          source?: string
          updated_at?: string
          validated_at?: string | null
          validated_by_qp_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ni43101_satellite_layers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "ni43101_satellite_layers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ni43101_satellite_layers_validated_by_qp_id_fkey"
            columns: ["validated_by_qp_id"]
            isOneToOne: false
            referencedRelation: "qualified_persons"
            referencedColumns: ["id"]
          },
        ]
      }
      ni43101_section_catalogue: {
        Row: {
          code: string
          created_at: string
          description: string
          display_group: string
          gate_rules: Json
          min_evidence_types: string[]
          requires_field_visit: boolean
          requires_qp: boolean
          section_no: number
          title_en: string
          title_es: string
        }
        Insert: {
          code: string
          created_at?: string
          description: string
          display_group?: string
          gate_rules?: Json
          min_evidence_types?: string[]
          requires_field_visit?: boolean
          requires_qp?: boolean
          section_no: number
          title_en: string
          title_es: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          display_group?: string
          gate_rules?: Json
          min_evidence_types?: string[]
          requires_field_visit?: boolean
          requires_qp?: boolean
          section_no?: number
          title_en?: string
          title_es?: string
        }
        Relationships: []
      }
      onboarding_status: {
        Row: {
          completed_at: string | null
          completed_steps: string[]
          created_at: string
          current_step: string | null
          id: string
          metadata: Json
          started_at: string | null
          state: Database["public"]["Enums"]["onboarding_state"]
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_steps?: string[]
          created_at?: string
          current_step?: string | null
          id?: string
          metadata?: Json
          started_at?: string | null
          state?: Database["public"]["Enums"]["onboarding_state"]
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          completed_steps?: string[]
          created_at?: string
          current_step?: string | null
          id?: string
          metadata?: Json
          started_at?: string | null
          state?: Database["public"]["Enums"]["onboarding_state"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          joined_at: string
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          joined_at?: string
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          joined_at?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_subscriptions: {
        Row: {
          billing_cycle: string
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string
          id: string
          metadata: Json
          organization_id: string
          plan_id: string
          provider: string | null
          provider_customer_id: string | null
          provider_subscription_id: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          billing_cycle?: string
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string
          id?: string
          metadata?: Json
          organization_id: string
          plan_id: string
          provider?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          billing_cycle?: string
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string
          id?: string
          metadata?: Json
          organization_id?: string
          plan_id?: string
          provider?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "billing_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string
          id: string
          logo_url: string | null
          metadata: Json
          name: string
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          logo_url?: string | null
          metadata?: Json
          name: string
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          logo_url?: string | null
          metadata?: Json
          name?: string
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      pedimento_versions: {
        Row: {
          area_ha: number | null
          created_at: string
          created_by: string | null
          geometry_geojson: Json
          id: string
          legal_state: string | null
          note: string | null
          pedimento_id: string
          validation_result: Json | null
          version: number
          vertices_utm: Json
        }
        Insert: {
          area_ha?: number | null
          created_at?: string
          created_by?: string | null
          geometry_geojson: Json
          id?: string
          legal_state?: string | null
          note?: string | null
          pedimento_id: string
          validation_result?: Json | null
          version: number
          vertices_utm?: Json
        }
        Update: {
          area_ha?: number | null
          created_at?: string
          created_by?: string | null
          geometry_geojson?: Json
          id?: string
          legal_state?: string | null
          note?: string | null
          pedimento_id?: string
          validation_result?: Json | null
          version?: number
          vertices_utm?: Json
        }
        Relationships: [
          {
            foreignKeyName: "pedimento_versions_pedimento_id_fkey"
            columns: ["pedimento_id"]
            isOneToOne: false
            referencedRelation: "pedimentos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedimentos: {
        Row: {
          area_ha: number
          comuna: string | null
          conflictos: Json
          created_at: string
          created_by: string
          datum: string
          estado: string
          fecha_presentacion: string | null
          geometry_geojson: Json
          id: string
          juzgado: string | null
          legal_state: string
          metadata: Json
          mineral: string | null
          nombre: string
          notas: string | null
          pdf_escrito_url: string | null
          pdf_plano_url: string | null
          pertenencias: number | null
          project_id: string
          provincia: string | null
          region: string | null
          rol_tramite: string | null
          tipo: string
          titular_nombre: string | null
          titular_rut: string | null
          updated_at: string
          utm_zone: number | null
          vertices_utm: Json
        }
        Insert: {
          area_ha: number
          comuna?: string | null
          conflictos?: Json
          created_at?: string
          created_by: string
          datum?: string
          estado?: string
          fecha_presentacion?: string | null
          geometry_geojson: Json
          id?: string
          juzgado?: string | null
          legal_state?: string
          metadata?: Json
          mineral?: string | null
          nombre: string
          notas?: string | null
          pdf_escrito_url?: string | null
          pdf_plano_url?: string | null
          pertenencias?: number | null
          project_id: string
          provincia?: string | null
          region?: string | null
          rol_tramite?: string | null
          tipo: string
          titular_nombre?: string | null
          titular_rut?: string | null
          updated_at?: string
          utm_zone?: number | null
          vertices_utm?: Json
        }
        Update: {
          area_ha?: number
          comuna?: string | null
          conflictos?: Json
          created_at?: string
          created_by?: string
          datum?: string
          estado?: string
          fecha_presentacion?: string | null
          geometry_geojson?: Json
          id?: string
          juzgado?: string | null
          legal_state?: string
          metadata?: Json
          mineral?: string | null
          nombre?: string
          notas?: string | null
          pdf_escrito_url?: string | null
          pdf_plano_url?: string | null
          pertenencias?: number | null
          project_id?: string
          provincia?: string | null
          region?: string | null
          rol_tramite?: string | null
          tipo?: string
          titular_nombre?: string | null
          titular_rut?: string | null
          updated_at?: string
          utm_zone?: number | null
          vertices_utm?: Json
        }
        Relationships: [
          {
            foreignKeyName: "pedimentos_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "pedimentos_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      precios_metales: {
        Row: {
          ag_usd_oz: number | null
          au_usd_oz: number | null
          created_at: string
          cu_lme_usc_lb: number | null
          fecha: string
          inv_cu_tm: number | null
          mo_usd_lb: number | null
          source: string
          updated_at: string
        }
        Insert: {
          ag_usd_oz?: number | null
          au_usd_oz?: number | null
          created_at?: string
          cu_lme_usc_lb?: number | null
          fecha: string
          inv_cu_tm?: number | null
          mo_usd_lb?: number | null
          source?: string
          updated_at?: string
        }
        Update: {
          ag_usd_oz?: number | null
          au_usd_oz?: number | null
          created_at?: string
          cu_lme_usc_lb?: number | null
          fecha?: string
          inv_cu_tm?: number | null
          mo_usd_lb?: number | null
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"] | null
          account_type_selected_at: string | null
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
          account_type?: Database["public"]["Enums"]["account_type"] | null
          account_type_selected_at?: string | null
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
          account_type?: Database["public"]["Enums"]["account_type"] | null
          account_type_selected_at?: string | null
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
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_technical_brief: {
        Row: {
          conclusion: string | null
          created_at: string
          created_by: string
          executive_summary: string | null
          grade_scenarios: Json
          id: string
          metallurgy: Json
          mining_model: string | null
          petrology_interpretation: string | null
          project_id: string
          risks: Json
          source_documents: Json
          team: Json
          updated_at: string
          validation_plan: Json
        }
        Insert: {
          conclusion?: string | null
          created_at?: string
          created_by: string
          executive_summary?: string | null
          grade_scenarios?: Json
          id?: string
          metallurgy?: Json
          mining_model?: string | null
          petrology_interpretation?: string | null
          project_id: string
          risks?: Json
          source_documents?: Json
          team?: Json
          updated_at?: string
          validation_plan?: Json
        }
        Update: {
          conclusion?: string | null
          created_at?: string
          created_by?: string
          executive_summary?: string | null
          grade_scenarios?: Json
          id?: string
          metallurgy?: Json
          mining_model?: string | null
          petrology_interpretation?: string | null
          project_id?: string
          risks?: Json
          source_documents?: Json
          team?: Json
          updated_at?: string
          validation_plan?: Json
        }
        Relationships: [
          {
            foreignKeyName: "project_technical_brief_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_technical_brief_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
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
          crs_epsg: number
          description: string | null
          id: string
          investor_share_token: string | null
          investor_share_url: string | null
          is_public_map: boolean
          name: string
          organization_id: string
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
          crs_epsg?: number
          description?: string | null
          id?: string
          investor_share_token?: string | null
          investor_share_url?: string | null
          is_public_map?: boolean
          name: string
          organization_id: string
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
          crs_epsg?: number
          description?: string | null
          id?: string
          investor_share_token?: string | null
          investor_share_url?: string | null
          is_public_map?: boolean
          name?: string
          organization_id?: string
          region?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      property_data_room_files: {
        Row: {
          category: string | null
          created_at: string
          file_name: string
          file_path: string
          file_size_bytes: number | null
          id: string
          listing_id: string
          mime_type: string | null
          requires_nda: boolean
          uploaded_by: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          file_name: string
          file_path: string
          file_size_bytes?: number | null
          id?: string
          listing_id: string
          mime_type?: string | null
          requires_nda?: boolean
          uploaded_by: string
        }
        Update: {
          category?: string | null
          created_at?: string
          file_name?: string
          file_path?: string
          file_size_bytes?: number | null
          id?: string
          listing_id?: string
          mime_type?: string | null
          requires_nda?: boolean
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_data_room_files_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "property_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      property_deal_inquiries: {
        Row: {
          closed_at: string | null
          closed_reason: string | null
          created_at: string
          id: string
          inquirer_user_id: string
          listing_id: string
          message: string | null
          nda_ip: string | null
          nda_signature: string | null
          nda_signed_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_reason?: string | null
          created_at?: string
          id?: string
          inquirer_user_id: string
          listing_id: string
          message?: string | null
          nda_ip?: string | null
          nda_signature?: string | null
          nda_signed_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_reason?: string | null
          created_at?: string
          id?: string
          inquirer_user_id?: string
          listing_id?: string
          message?: string | null
          nda_ip?: string | null
          nda_signature?: string | null
          nda_signed_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_deal_inquiries_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "property_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      property_deal_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          inquiry_id: string
          read_at: string | null
          sender_user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          inquiry_id: string
          read_at?: string | null
          sender_user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          inquiry_id?: string
          read_at?: string | null
          sender_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_deal_messages_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "property_deal_inquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      property_listings: {
        Row: {
          area_ha: number | null
          asking_price_usd: number | null
          code: string | null
          commodity: string
          country: string
          cover_image_url: string | null
          created_at: string
          data_available: string[] | null
          featured_until: string | null
          geometry_geojson: Json | null
          id: string
          is_featured: boolean
          is_published: boolean
          listing_paid_until: string | null
          modality: string
          owner_user_id: string
          project_id: string | null
          region: string | null
          required_plan: string
          royalty_pct: number | null
          stage: string
          summary: string | null
          title: string
          updated_at: string
          views_count: number
        }
        Insert: {
          area_ha?: number | null
          asking_price_usd?: number | null
          code?: string | null
          commodity: string
          country?: string
          cover_image_url?: string | null
          created_at?: string
          data_available?: string[] | null
          featured_until?: string | null
          geometry_geojson?: Json | null
          id?: string
          is_featured?: boolean
          is_published?: boolean
          listing_paid_until?: string | null
          modality?: string
          owner_user_id: string
          project_id?: string | null
          region?: string | null
          required_plan?: string
          royalty_pct?: number | null
          stage?: string
          summary?: string | null
          title: string
          updated_at?: string
          views_count?: number
        }
        Update: {
          area_ha?: number | null
          asking_price_usd?: number | null
          code?: string | null
          commodity?: string
          country?: string
          cover_image_url?: string | null
          created_at?: string
          data_available?: string[] | null
          featured_until?: string | null
          geometry_geojson?: Json | null
          id?: string
          is_featured?: boolean
          is_published?: boolean
          listing_paid_until?: string | null
          modality?: string
          owner_user_id?: string
          project_id?: string | null
          region?: string | null
          required_plan?: string
          royalty_pct?: number | null
          stage?: string
          summary?: string | null
          title?: string
          updated_at?: string
          views_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "property_listings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "property_listings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
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
      qp_signed_layers: {
        Row: {
          created_at: string
          exp_at: string
          id: string
          layer_id: string
          payload: Json
          project_id: string
          revoked_at: string | null
          revoked_by: string | null
          revoked_reason: string | null
          signature: string
          signed_at: string
          signed_by: string
        }
        Insert: {
          created_at?: string
          exp_at: string
          id?: string
          layer_id: string
          payload: Json
          project_id: string
          revoked_at?: string | null
          revoked_by?: string | null
          revoked_reason?: string | null
          signature: string
          signed_at?: string
          signed_by: string
        }
        Update: {
          created_at?: string
          exp_at?: string
          id?: string
          layer_id?: string
          payload?: Json
          project_id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          revoked_reason?: string | null
          signature?: string
          signed_at?: string
          signed_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "qp_signed_layers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "qp_signed_layers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      qualified_persons: {
        Row: {
          accreditation_grade: string | null
          accreditation_type: string | null
          annual_fee_paid_until: string | null
          bio: string | null
          cdv_history: Json
          competency_areas: string[] | null
          country: string | null
          created_at: string
          cv_url: string | null
          full_name: string
          id: string
          independence_declared: boolean
          is_verified: boolean
          last_site_visit_date: string | null
          license_no: string
          profession: string
          province_state: string | null
          registration_body: string
          signature_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          accreditation_grade?: string | null
          accreditation_type?: string | null
          annual_fee_paid_until?: string | null
          bio?: string | null
          cdv_history?: Json
          competency_areas?: string[] | null
          country?: string | null
          created_at?: string
          cv_url?: string | null
          full_name: string
          id?: string
          independence_declared?: boolean
          is_verified?: boolean
          last_site_visit_date?: string | null
          license_no: string
          profession: string
          province_state?: string | null
          registration_body: string
          signature_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          accreditation_grade?: string | null
          accreditation_type?: string | null
          annual_fee_paid_until?: string | null
          bio?: string | null
          cdv_history?: Json
          competency_areas?: string[] | null
          country?: string | null
          created_at?: string
          cv_url?: string | null
          full_name?: string
          id?: string
          independence_declared?: boolean
          is_verified?: boolean
          last_site_visit_date?: string | null
          license_no?: string
          profession?: string
          province_state?: string | null
          registration_body?: string
          signature_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      report_evidence_links: {
        Row: {
          caption: string | null
          created_at: string
          created_by: string
          evidence_id: string | null
          evidence_type: string
          id: string
          project_id: string
          report_id: string
          rule_id: string | null
          url: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          created_by: string
          evidence_id?: string | null
          evidence_type: string
          id?: string
          project_id: string
          report_id: string
          rule_id?: string | null
          url?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          created_by?: string
          evidence_id?: string | null
          evidence_type?: string
          id?: string
          project_id?: string
          report_id?: string
          rule_id?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_evidence_links_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "report_evidence_links_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_evidence_links_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "technical_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_evidence_links_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "compliance_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      report_runs: {
        Row: {
          ai_model: string | null
          ai_provider: string
          concession_id: string | null
          created_at: string
          created_by: string
          error_message: string | null
          id: string
          language: string
          pdf_path: string | null
          project_id: string
          qp_name: string | null
          qp_number: string | null
          report_type: string
          sections: Json
          signed_url: string | null
          signed_url_expires_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          ai_model?: string | null
          ai_provider?: string
          concession_id?: string | null
          created_at?: string
          created_by?: string
          error_message?: string | null
          id?: string
          language?: string
          pdf_path?: string | null
          project_id: string
          qp_name?: string | null
          qp_number?: string | null
          report_type: string
          sections?: Json
          signed_url?: string | null
          signed_url_expires_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          ai_model?: string | null
          ai_provider?: string
          concession_id?: string | null
          created_at?: string
          created_by?: string
          error_message?: string | null
          id?: string
          language?: string
          pdf_path?: string | null
          project_id?: string
          qp_name?: string | null
          qp_number?: string | null
          report_type?: string
          sections?: Json
          signed_url?: string | null
          signed_url_expires_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      resource_block_economics: {
        Row: {
          block_id: string
          created_at: string
          extraction_year: number | null
          id: string
          in_pit: boolean
          insitu_value_usd: number | null
          is_ore: boolean
          margin_usd_t: number | null
          nsr_usd_t: number | null
          project_id: string
          scenario_id: string
          total_cost_usd_t: number | null
        }
        Insert: {
          block_id: string
          created_at?: string
          extraction_year?: number | null
          id?: string
          in_pit?: boolean
          insitu_value_usd?: number | null
          is_ore?: boolean
          margin_usd_t?: number | null
          nsr_usd_t?: number | null
          project_id: string
          scenario_id: string
          total_cost_usd_t?: number | null
        }
        Update: {
          block_id?: string
          created_at?: string
          extraction_year?: number | null
          id?: string
          in_pit?: boolean
          insitu_value_usd?: number | null
          is_ore?: boolean
          margin_usd_t?: number | null
          nsr_usd_t?: number | null
          project_id?: string
          scenario_id?: string
          total_cost_usd_t?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "resource_block_economics_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "resource_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_block_economics_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "resource_block_economics_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_block_economics_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "economic_scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_blocks: {
        Row: {
          classification: string | null
          created_at: string
          grade: number | null
          id: string
          ix: number
          iy: number
          iz: number
          model_id: string
          n_samples: number
          nearest_dist: number | null
          project_id: string
          variance: number | null
          x: number
          y: number
          z: number
        }
        Insert: {
          classification?: string | null
          created_at?: string
          grade?: number | null
          id?: string
          ix: number
          iy: number
          iz: number
          model_id: string
          n_samples?: number
          nearest_dist?: number | null
          project_id: string
          variance?: number | null
          x: number
          y: number
          z: number
        }
        Update: {
          classification?: string | null
          created_at?: string
          grade?: number | null
          id?: string
          ix?: number
          iy?: number
          iz?: number
          model_id?: string
          n_samples?: number
          nearest_dist?: number | null
          project_id?: string
          variance?: number | null
          x?: number
          y?: number
          z?: number
        }
        Relationships: [
          {
            foreignKeyName: "resource_blocks_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "resource_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_blocks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "resource_blocks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_composites: {
        Row: {
          created_at: string
          depth_from: number
          depth_to: number
          grade: number
          hole_code: string | null
          hole_id: string | null
          id: string
          length_m: number
          model_id: string
          project_id: string
          x: number
          y: number
          z: number
        }
        Insert: {
          created_at?: string
          depth_from: number
          depth_to: number
          grade: number
          hole_code?: string | null
          hole_id?: string | null
          id?: string
          length_m: number
          model_id: string
          project_id: string
          x: number
          y: number
          z: number
        }
        Update: {
          created_at?: string
          depth_from?: number
          depth_to?: number
          grade?: number
          hole_code?: string | null
          hole_id?: string | null
          id?: string
          length_m?: number
          model_id?: string
          project_id?: string
          x?: number
          y?: number
          z?: number
        }
        Relationships: [
          {
            foreignKeyName: "resource_composites_hole_id_fkey"
            columns: ["hole_id"]
            isOneToOne: false
            referencedRelation: "drill_holes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_composites_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "resource_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_composites_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "resource_composites_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_models: {
        Row: {
          bbox_max_x: number | null
          bbox_max_y: number | null
          bbox_max_z: number | null
          bbox_min_x: number | null
          bbox_min_y: number | null
          bbox_min_z: number | null
          block_size_x: number
          block_size_y: number
          block_size_z: number
          blocks_estimated: number | null
          blocks_total: number | null
          campaign_id: string | null
          commodity: string
          composite_length: number
          composites_count: number | null
          created_at: string
          created_by: string
          cutoff_grade: number | null
          density_t_m3: number
          estimated_at: string | null
          id: string
          max_samples: number
          mean_grade: number | null
          metal_content: number | null
          method: string
          min_samples: number
          name: string
          notes: string | null
          power: number
          project_id: string
          search_radius: number
          status: string
          tonnage_above_cutoff: number | null
          tonnage_total: number | null
          updated_at: string
        }
        Insert: {
          bbox_max_x?: number | null
          bbox_max_y?: number | null
          bbox_max_z?: number | null
          bbox_min_x?: number | null
          bbox_min_y?: number | null
          bbox_min_z?: number | null
          block_size_x?: number
          block_size_y?: number
          block_size_z?: number
          blocks_estimated?: number | null
          blocks_total?: number | null
          campaign_id?: string | null
          commodity?: string
          composite_length?: number
          composites_count?: number | null
          created_at?: string
          created_by: string
          cutoff_grade?: number | null
          density_t_m3?: number
          estimated_at?: string | null
          id?: string
          max_samples?: number
          mean_grade?: number | null
          metal_content?: number | null
          method?: string
          min_samples?: number
          name: string
          notes?: string | null
          power?: number
          project_id: string
          search_radius?: number
          status?: string
          tonnage_above_cutoff?: number | null
          tonnage_total?: number | null
          updated_at?: string
        }
        Update: {
          bbox_max_x?: number | null
          bbox_max_y?: number | null
          bbox_max_z?: number | null
          bbox_min_x?: number | null
          bbox_min_y?: number | null
          bbox_min_z?: number | null
          block_size_x?: number
          block_size_y?: number
          block_size_z?: number
          blocks_estimated?: number | null
          blocks_total?: number | null
          campaign_id?: string | null
          commodity?: string
          composite_length?: number
          composites_count?: number | null
          created_at?: string
          created_by?: string
          cutoff_grade?: number | null
          density_t_m3?: number
          estimated_at?: string | null
          id?: string
          max_samples?: number
          mean_grade?: number | null
          metal_content?: number | null
          method?: string
          min_samples?: number
          name?: string
          notes?: string | null
          power?: number
          project_id?: string
          search_radius?: number
          status?: string
          tonnage_above_cutoff?: number | null
          tonnage_total?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_models_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "exploration_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_models_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "resource_models_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
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
      satellite_analysis_jobs: {
        Row: {
          acquisition_date: string | null
          aoi_bbox: number[]
          aoi_geojson: Json | null
          clay_status: string
          clay_value: number | null
          cloud_cover_pct: number | null
          collection: string
          completed_at: string | null
          created_at: string
          created_by: string
          error_code: string | null
          error_message: string | null
          id: string
          iron_status: string
          iron_value: number | null
          ndvi_status: string
          ndvi_value: number | null
          project_id: string
          provider: string
          raw_stats: Json | null
          scene_id: string | null
          source: string
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          acquisition_date?: string | null
          aoi_bbox: number[]
          aoi_geojson?: Json | null
          clay_status?: string
          clay_value?: number | null
          cloud_cover_pct?: number | null
          collection?: string
          completed_at?: string | null
          created_at?: string
          created_by: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          iron_status?: string
          iron_value?: number | null
          ndvi_status?: string
          ndvi_value?: number | null
          project_id: string
          provider?: string
          raw_stats?: Json | null
          scene_id?: string | null
          source?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          acquisition_date?: string | null
          aoi_bbox?: number[]
          aoi_geojson?: Json | null
          clay_status?: string
          clay_value?: number | null
          cloud_cover_pct?: number | null
          collection?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          iron_status?: string
          iron_value?: number | null
          ndvi_status?: string
          ndvi_value?: number | null
          project_id?: string
          provider?: string
          raw_stats?: Json | null
          scene_id?: string | null
          source?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "satellite_analysis_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "satellite_analysis_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      satellite_analysis_runs: {
        Row: {
          aoi_geometry: Json | null
          bbox: number[] | null
          completed_at: string | null
          created_at: string
          created_by: string
          date_from: string | null
          date_to: string | null
          error_message: string | null
          evalscript_version: string | null
          external_scene_id: string | null
          id: string
          index_code: string
          max_cloud_cover_pct: number | null
          output_raster_url: string | null
          project_id: string
          provider: string
          sensor: string
          started_at: string | null
          stats: Json | null
          status: string
          storage_path: string | null
          updated_at: string
        }
        Insert: {
          aoi_geometry?: Json | null
          bbox?: number[] | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          date_from?: string | null
          date_to?: string | null
          error_message?: string | null
          evalscript_version?: string | null
          external_scene_id?: string | null
          id?: string
          index_code: string
          max_cloud_cover_pct?: number | null
          output_raster_url?: string | null
          project_id: string
          provider: string
          sensor: string
          started_at?: string | null
          stats?: Json | null
          status?: string
          storage_path?: string | null
          updated_at?: string
        }
        Update: {
          aoi_geometry?: Json | null
          bbox?: number[] | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          date_from?: string | null
          date_to?: string | null
          error_message?: string | null
          evalscript_version?: string | null
          external_scene_id?: string | null
          id?: string
          index_code?: string
          max_cloud_cover_pct?: number | null
          output_raster_url?: string | null
          project_id?: string
          provider?: string
          sensor?: string
          started_at?: string | null
          stats?: Json | null
          status?: string
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "satellite_analysis_runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "satellite_analysis_runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      satellite_anomalies: {
        Row: {
          area_ha: number | null
          bbox: number[] | null
          created_at: string
          created_by: string
          detected_at: string
          geometry: Json
          id: string
          index_code: string
          notes: string | null
          project_id: string
          run_id: string
          score: number
          severity: string
          updated_at: string
        }
        Insert: {
          area_ha?: number | null
          bbox?: number[] | null
          created_at?: string
          created_by: string
          detected_at?: string
          geometry: Json
          id?: string
          index_code: string
          notes?: string | null
          project_id: string
          run_id: string
          score: number
          severity?: string
          updated_at?: string
        }
        Update: {
          area_ha?: number | null
          bbox?: number[] | null
          created_at?: string
          created_by?: string
          detected_at?: string
          geometry?: Json
          id?: string
          index_code?: string
          notes?: string | null
          project_id?: string
          run_id?: string
          score?: number
          severity?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "satellite_anomalies_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "satellite_anomalies_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "satellite_anomalies_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "satellite_analysis_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      satellite_evidence: {
        Row: {
          anomaly_id: string | null
          bbox: number[]
          confidence_score: number
          created_at: string
          created_by: string
          disclaimer: string
          geometry: Json | null
          id: string
          index_code: string | null
          interpretation_md: string | null
          kind: string
          layer_id: string | null
          project_id: string
          qp_validation_status: string
          run_id: string | null
          source: Json
          storage_path: string | null
          target_id: string | null
          title: string
          updated_at: string
          validated_at: string | null
          validated_by_qp_id: string | null
          validation: Json | null
        }
        Insert: {
          anomaly_id?: string | null
          bbox: number[]
          confidence_score: number
          created_at?: string
          created_by: string
          disclaimer?: string
          geometry?: Json | null
          id?: string
          index_code?: string | null
          interpretation_md?: string | null
          kind: string
          layer_id?: string | null
          project_id: string
          qp_validation_status?: string
          run_id?: string | null
          source: Json
          storage_path?: string | null
          target_id?: string | null
          title: string
          updated_at?: string
          validated_at?: string | null
          validated_by_qp_id?: string | null
          validation?: Json | null
        }
        Update: {
          anomaly_id?: string | null
          bbox?: number[]
          confidence_score?: number
          created_at?: string
          created_by?: string
          disclaimer?: string
          geometry?: Json | null
          id?: string
          index_code?: string | null
          interpretation_md?: string | null
          kind?: string
          layer_id?: string | null
          project_id?: string
          qp_validation_status?: string
          run_id?: string | null
          source?: Json
          storage_path?: string | null
          target_id?: string | null
          title?: string
          updated_at?: string
          validated_at?: string | null
          validated_by_qp_id?: string | null
          validation?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "satellite_evidence_anomaly_id_fkey"
            columns: ["anomaly_id"]
            isOneToOne: false
            referencedRelation: "satellite_anomalies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "satellite_evidence_layer_id_fkey"
            columns: ["layer_id"]
            isOneToOne: false
            referencedRelation: "satellite_layers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "satellite_evidence_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "satellite_evidence_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "satellite_evidence_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "satellite_analysis_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "satellite_evidence_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "satellite_targets"
            referencedColumns: ["id"]
          },
        ]
      }
      satellite_evidence_reports: {
        Row: {
          anomalies_count: number
          anomalies_payload: Json
          aoi_bbox: number[]
          aoi_buffer_m: number
          aoi_geometry: Json | null
          aoi_label: string
          aoi_source: string
          clusters_count: number
          created_at: string
          created_by: string
          date_from: string
          date_to: string
          disclaimer: string
          evidence_table: Json
          id: string
          indices_computed: string[]
          internal_concessions_count: number
          is_demo: boolean
          neighbor_concessions_count: number
          ni43101_paragraph_md: string | null
          notes: string | null
          project_id: string
          prospectivity_score: number | null
          provider: string
          qp_review_status: string
          qp_validated_at: string | null
          qp_validated_by: string | null
          scene_cloud_cover_pct: number | null
          scene_collection: string
          scene_datetime: string | null
          scene_item_id: string | null
          targets_count: number
          targets_payload: Json
          updated_at: string
        }
        Insert: {
          anomalies_count?: number
          anomalies_payload?: Json
          aoi_bbox: number[]
          aoi_buffer_m?: number
          aoi_geometry?: Json | null
          aoi_label: string
          aoi_source?: string
          clusters_count?: number
          created_at?: string
          created_by: string
          date_from: string
          date_to: string
          disclaimer?: string
          evidence_table?: Json
          id?: string
          indices_computed?: string[]
          internal_concessions_count?: number
          is_demo?: boolean
          neighbor_concessions_count?: number
          ni43101_paragraph_md?: string | null
          notes?: string | null
          project_id: string
          prospectivity_score?: number | null
          provider?: string
          qp_review_status?: string
          qp_validated_at?: string | null
          qp_validated_by?: string | null
          scene_cloud_cover_pct?: number | null
          scene_collection?: string
          scene_datetime?: string | null
          scene_item_id?: string | null
          targets_count?: number
          targets_payload?: Json
          updated_at?: string
        }
        Update: {
          anomalies_count?: number
          anomalies_payload?: Json
          aoi_bbox?: number[]
          aoi_buffer_m?: number
          aoi_geometry?: Json | null
          aoi_label?: string
          aoi_source?: string
          clusters_count?: number
          created_at?: string
          created_by?: string
          date_from?: string
          date_to?: string
          disclaimer?: string
          evidence_table?: Json
          id?: string
          indices_computed?: string[]
          internal_concessions_count?: number
          is_demo?: boolean
          neighbor_concessions_count?: number
          ni43101_paragraph_md?: string | null
          notes?: string | null
          project_id?: string
          prospectivity_score?: number | null
          provider?: string
          qp_review_status?: string
          qp_validated_at?: string | null
          qp_validated_by?: string | null
          scene_cloud_cover_pct?: number | null
          scene_collection?: string
          scene_datetime?: string | null
          scene_item_id?: string | null
          targets_count?: number
          targets_payload?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "satellite_evidence_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "satellite_evidence_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      satellite_jobs: {
        Row: {
          aoi_geojson: Json | null
          created_at: string
          error_message: string | null
          evidence_id: string | null
          external_job_id: string | null
          id: string
          last_polled_at: string | null
          notes: string | null
          params: Json | null
          product_type: string | null
          project_id: string
          result_url: string | null
          run_id: string | null
          service: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          aoi_geojson?: Json | null
          created_at?: string
          error_message?: string | null
          evidence_id?: string | null
          external_job_id?: string | null
          id?: string
          last_polled_at?: string | null
          notes?: string | null
          params?: Json | null
          product_type?: string | null
          project_id: string
          result_url?: string | null
          run_id?: string | null
          service: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          aoi_geojson?: Json | null
          created_at?: string
          error_message?: string | null
          evidence_id?: string | null
          external_job_id?: string | null
          id?: string
          last_polled_at?: string | null
          notes?: string | null
          params?: Json | null
          product_type?: string | null
          project_id?: string
          result_url?: string | null
          run_id?: string | null
          service?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "satellite_jobs_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "satellite_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "satellite_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "satellite_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "satellite_jobs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "satellite_analysis_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      satellite_layer_cache: {
        Row: {
          acquisition_date: string | null
          bbox: number[]
          cache_key: string
          cloud_cover_pct: number | null
          collection: string
          created_at: string
          expires_at: string
          id: string
          scene_id: string | null
          tiles: Json
        }
        Insert: {
          acquisition_date?: string | null
          bbox: number[]
          cache_key: string
          cloud_cover_pct?: number | null
          collection: string
          created_at?: string
          expires_at?: string
          id?: string
          scene_id?: string | null
          tiles: Json
        }
        Update: {
          acquisition_date?: string | null
          bbox?: number[]
          cache_key?: string
          cloud_cover_pct?: number | null
          collection?: string
          created_at?: string
          expires_at?: string
          id?: string
          scene_id?: string | null
          tiles?: Json
        }
        Relationships: []
      }
      satellite_layers: {
        Row: {
          acquisition_date: string | null
          asset_hash: string | null
          bbox: number[] | null
          confidence_score: number | null
          created_at: string
          created_by: string
          external_scene_id: string | null
          geometry: Json | null
          id: string
          index_code: string | null
          layer_kind: string
          metadata: Json | null
          name: string
          project_id: string
          provider: string
          qp_validation_status: string
          run_id: string | null
          sensor: string | null
          storage_bucket: string | null
          storage_path: string | null
          tile_url_template: string | null
          updated_at: string
          validated_at: string | null
          validated_by_qp_id: string | null
        }
        Insert: {
          acquisition_date?: string | null
          asset_hash?: string | null
          bbox?: number[] | null
          confidence_score?: number | null
          created_at?: string
          created_by: string
          external_scene_id?: string | null
          geometry?: Json | null
          id?: string
          index_code?: string | null
          layer_kind?: string
          metadata?: Json | null
          name: string
          project_id: string
          provider: string
          qp_validation_status?: string
          run_id?: string | null
          sensor?: string | null
          storage_bucket?: string | null
          storage_path?: string | null
          tile_url_template?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by_qp_id?: string | null
        }
        Update: {
          acquisition_date?: string | null
          asset_hash?: string | null
          bbox?: number[] | null
          confidence_score?: number | null
          created_at?: string
          created_by?: string
          external_scene_id?: string | null
          geometry?: Json | null
          id?: string
          index_code?: string | null
          layer_kind?: string
          metadata?: Json | null
          name?: string
          project_id?: string
          provider?: string
          qp_validation_status?: string
          run_id?: string | null
          sensor?: string | null
          storage_bucket?: string | null
          storage_path?: string | null
          tile_url_template?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by_qp_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "satellite_layers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "satellite_layers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "satellite_layers_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "satellite_analysis_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      satellite_shared_views: {
        Row: {
          aoi_bbox: number[] | null
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          include_anomalies: boolean
          include_concessions: boolean
          include_targets: boolean
          project_id: string
          revoked_at: string | null
          run_id: string | null
          token: string
          updated_at: string
          watermark_label: string | null
        }
        Insert: {
          aoi_bbox?: number[] | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          include_anomalies?: boolean
          include_concessions?: boolean
          include_targets?: boolean
          project_id: string
          revoked_at?: string | null
          run_id?: string | null
          token?: string
          updated_at?: string
          watermark_label?: string | null
        }
        Update: {
          aoi_bbox?: number[] | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          include_anomalies?: boolean
          include_concessions?: boolean
          include_targets?: boolean
          project_id?: string
          revoked_at?: string | null
          run_id?: string | null
          token?: string
          updated_at?: string
          watermark_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "satellite_shared_views_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "satellite_shared_views_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      satellite_targets: {
        Row: {
          bbox: number[] | null
          commodity: string
          contributing_anomaly_ids: string[] | null
          created_at: string
          created_by: string
          geometry: Json
          id: string
          name: string
          project_id: string
          qp_validation_status: string
          rationale_md: string | null
          score: number
          updated_at: string
          validated_at: string | null
          validated_by_qp_id: string | null
        }
        Insert: {
          bbox?: number[] | null
          commodity?: string
          contributing_anomaly_ids?: string[] | null
          created_at?: string
          created_by: string
          geometry: Json
          id?: string
          name: string
          project_id: string
          qp_validation_status?: string
          rationale_md?: string | null
          score: number
          updated_at?: string
          validated_at?: string | null
          validated_by_qp_id?: string | null
        }
        Update: {
          bbox?: number[] | null
          commodity?: string
          contributing_anomaly_ids?: string[] | null
          created_at?: string
          created_by?: string
          geometry?: Json
          id?: string
          name?: string
          project_id?: string
          qp_validation_status?: string
          rationale_md?: string | null
          score?: number
          updated_at?: string
          validated_at?: string | null
          validated_by_qp_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "satellite_targets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "satellite_targets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      satellite_timeseries_points: {
        Row: {
          created_at: string
          id: string
          index_code: string
          lat: number | null
          layer_id: string | null
          lng: number | null
          metadata: Json | null
          observed_at: string
          project_id: string
          qa_flag: string | null
          run_id: string | null
          source: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          index_code: string
          lat?: number | null
          layer_id?: string | null
          lng?: number | null
          metadata?: Json | null
          observed_at: string
          project_id: string
          qa_flag?: string | null
          run_id?: string | null
          source?: string
          value: number
        }
        Update: {
          created_at?: string
          id?: string
          index_code?: string
          lat?: number | null
          layer_id?: string | null
          lng?: number | null
          metadata?: Json | null
          observed_at?: string
          project_id?: string
          qa_flag?: string | null
          run_id?: string | null
          source?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "satellite_timeseries_points_layer_id_fkey"
            columns: ["layer_id"]
            isOneToOne: false
            referencedRelation: "satellite_layers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "satellite_timeseries_points_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "satellite_timeseries_points_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "satellite_timeseries_points_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "satellite_analysis_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      scene_3d_cache: {
        Row: {
          created_by: string | null
          expires_at: string
          generated_at: string
          id: string
          options_hash: string
          payload: Json
          project_id: string
        }
        Insert: {
          created_by?: string | null
          expires_at?: string
          generated_at?: string
          id?: string
          options_hash: string
          payload: Json
          project_id: string
        }
        Update: {
          created_by?: string | null
          expires_at?: string
          generated_at?: string
          id?: string
          options_hash?: string
          payload?: Json
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scene_3d_cache_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "scene_3d_cache_project_id_fkey"
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
      shift_reports: {
        Row: {
          created_at: string
          created_by: string
          equipment_hours: number | null
          estimated_grade_gpt: number | null
          face_label: string | null
          hse_incidents: number | null
          hse_notes: string | null
          id: string
          ore_destination: string | null
          photos: Json | null
          project_id: string
          reported_at: string
          shift_id: string | null
          tonnes_extracted: number | null
        }
        Insert: {
          created_at?: string
          created_by: string
          equipment_hours?: number | null
          estimated_grade_gpt?: number | null
          face_label?: string | null
          hse_incidents?: number | null
          hse_notes?: string | null
          id?: string
          ore_destination?: string | null
          photos?: Json | null
          project_id: string
          reported_at?: string
          shift_id?: string | null
          tonnes_extracted?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string
          equipment_hours?: number | null
          estimated_grade_gpt?: number | null
          face_label?: string | null
          hse_incidents?: number | null
          hse_notes?: string | null
          id?: string
          ore_destination?: string | null
          photos?: Json | null
          project_id?: string
          reported_at?: string
          shift_id?: string | null
          tonnes_extracted?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shift_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "shift_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_reports_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "mine_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      signature_audit_trail: {
        Row: {
          action: string
          actor_name: string | null
          actor_user_id: string | null
          created_at: string
          envelope_id: string
          hash_chain: string | null
          id: string
          payload: Json | null
          project_id: string
        }
        Insert: {
          action: string
          actor_name?: string | null
          actor_user_id?: string | null
          created_at?: string
          envelope_id: string
          hash_chain?: string | null
          id?: string
          payload?: Json | null
          project_id: string
        }
        Update: {
          action?: string
          actor_name?: string | null
          actor_user_id?: string | null
          created_at?: string
          envelope_id?: string
          hash_chain?: string | null
          id?: string
          payload?: Json | null
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "signature_audit_trail_envelope_id_fkey"
            columns: ["envelope_id"]
            isOneToOne: false
            referencedRelation: "signature_envelopes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_audit_trail_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "signature_audit_trail_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      signature_envelopes: {
        Row: {
          completed_at: string | null
          completed_signers: number
          created_at: string
          created_by: string
          document_hash: string
          document_ref_id: string | null
          document_storage_path: string | null
          document_title: string
          document_type: string
          expires_at: string | null
          id: string
          metadata: Json | null
          project_id: string
          required_signers: number
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          completed_signers?: number
          created_at?: string
          created_by: string
          document_hash: string
          document_ref_id?: string | null
          document_storage_path?: string | null
          document_title: string
          document_type: string
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          project_id: string
          required_signers?: number
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          completed_signers?: number
          created_at?: string
          created_by?: string
          document_hash?: string
          document_ref_id?: string | null
          document_storage_path?: string | null
          document_title?: string
          document_type?: string
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          project_id?: string
          required_signers?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "signature_envelopes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "signature_envelopes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      stac_acquisitions: {
        Row: {
          acquisition_date: string
          assets: Json
          bbox_geojson: Json
          cached_at: string
          cloud_pct: number | null
          collection: string
          id: string
          project_id: string
          properties: Json
          scene_id: string
          stac_href: string | null
          thumbnail_url: string | null
        }
        Insert: {
          acquisition_date: string
          assets?: Json
          bbox_geojson: Json
          cached_at?: string
          cloud_pct?: number | null
          collection: string
          id?: string
          project_id: string
          properties?: Json
          scene_id: string
          stac_href?: string | null
          thumbnail_url?: string | null
        }
        Update: {
          acquisition_date?: string
          assets?: Json
          bbox_geojson?: Json
          cached_at?: string
          cloud_pct?: number | null
          collection?: string
          id?: string
          project_id?: string
          properties?: Json
          scene_id?: string
          stac_href?: string | null
          thumbnail_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stac_acquisitions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "stac_acquisitions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      stockpile_volumes: {
        Row: {
          area_m2: number | null
          base_elevation_m: number | null
          base_method: string
          campaign_id: string | null
          cells_analyzed: number | null
          created_at: string
          created_by: string
          id: string
          material: string | null
          max_height_m: number | null
          mean_height_m: number | null
          name: string
          notes: string | null
          pixel_size_m: number | null
          polygon_geojson: Json
          project_id: string
          raster_id: string
          updated_at: string
          volume_m3: number | null
        }
        Insert: {
          area_m2?: number | null
          base_elevation_m?: number | null
          base_method?: string
          campaign_id?: string | null
          cells_analyzed?: number | null
          created_at?: string
          created_by: string
          id?: string
          material?: string | null
          max_height_m?: number | null
          mean_height_m?: number | null
          name: string
          notes?: string | null
          pixel_size_m?: number | null
          polygon_geojson: Json
          project_id: string
          raster_id: string
          updated_at?: string
          volume_m3?: number | null
        }
        Update: {
          area_m2?: number | null
          base_elevation_m?: number | null
          base_method?: string
          campaign_id?: string | null
          cells_analyzed?: number | null
          created_at?: string
          created_by?: string
          id?: string
          material?: string | null
          max_height_m?: number | null
          mean_height_m?: number | null
          name?: string
          notes?: string | null
          pixel_size_m?: number | null
          polygon_geojson?: Json
          project_id?: string
          raster_id?: string
          updated_at?: string
          volume_m3?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stockpile_volumes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "exploration_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stockpile_volumes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "stockpile_volumes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stockpile_volumes_raster_id_fkey"
            columns: ["raster_id"]
            isOneToOne: false
            referencedRelation: "drone_rasters"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          active: boolean
          created_at: string
          features: Json
          id: string
          name: string
          price_clp: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          features?: Json
          id: string
          name: string
          price_clp?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          features?: Json
          id?: string
          name?: string
          price_clp?: number
        }
        Relationships: []
      }
      system_config: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      team_member_profiles: {
        Row: {
          area: string | null
          created_at: string
          full_name: string
          id: string
          notes: string | null
          phone: string | null
          rejection_reason: string | null
          requested_role: string
          review_status: Database["public"]["Enums"]["review_status"]
          reviewed_at: string | null
          reviewed_by: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          area?: string | null
          created_at?: string
          full_name: string
          id?: string
          notes?: string | null
          phone?: string | null
          rejection_reason?: string | null
          requested_role: string
          review_status?: Database["public"]["Enums"]["review_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          area?: string | null
          created_at?: string
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string | null
          rejection_reason?: string | null
          requested_role?: string
          review_status?: Database["public"]["Enums"]["review_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      technical_report_sections: {
        Row: {
          change_log: Json
          confidence_level: string
          content_md: string | null
          created_at: string
          data_sources: Json
          figures: Json | null
          gap_notes: string | null
          id: string
          project_id: string
          qp_comments: string | null
          qp_id: string | null
          references_ids: string[] | null
          report_id: string
          requires_qp_review: boolean
          section_no: number
          signature_hash: string | null
          signed_at: string | null
          status: string
          title: string
          updated_at: string
          updated_by: string | null
          word_count: number | null
        }
        Insert: {
          change_log?: Json
          confidence_level?: string
          content_md?: string | null
          created_at?: string
          data_sources?: Json
          figures?: Json | null
          gap_notes?: string | null
          id?: string
          project_id: string
          qp_comments?: string | null
          qp_id?: string | null
          references_ids?: string[] | null
          report_id: string
          requires_qp_review?: boolean
          section_no: number
          signature_hash?: string | null
          signed_at?: string | null
          status?: string
          title: string
          updated_at?: string
          updated_by?: string | null
          word_count?: number | null
        }
        Update: {
          change_log?: Json
          confidence_level?: string
          content_md?: string | null
          created_at?: string
          data_sources?: Json
          figures?: Json | null
          gap_notes?: string | null
          id?: string
          project_id?: string
          qp_comments?: string | null
          qp_id?: string | null
          references_ids?: string[] | null
          report_id?: string
          requires_qp_review?: boolean
          section_no?: number
          signature_hash?: string | null
          signed_at?: string | null
          status?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "technical_report_sections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "technical_report_sections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technical_report_sections_qp_id_fkey"
            columns: ["qp_id"]
            isOneToOne: false
            referencedRelation: "qualified_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technical_report_sections_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "technical_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      technical_report_versions: {
        Row: {
          generated_at: string
          generated_by: string
          hash_sha256: string
          id: string
          pdf_url: string | null
          project_id: string
          report_id: string
          snapshot: Json
          version_no: number
          watermark: string | null
        }
        Insert: {
          generated_at?: string
          generated_by: string
          hash_sha256: string
          id?: string
          pdf_url?: string | null
          project_id: string
          report_id: string
          snapshot: Json
          version_no: number
          watermark?: string | null
        }
        Update: {
          generated_at?: string
          generated_by?: string
          hash_sha256?: string
          id?: string
          pdf_url?: string | null
          project_id?: string
          report_id?: string
          snapshot?: Json
          version_no?: number
          watermark?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "technical_report_versions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "technical_report_versions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technical_report_versions_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "technical_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      technical_reports: {
        Row: {
          active_standards: Database["public"]["Enums"]["compliance_standard"][]
          compliance_evaluated_at: string | null
          compliance_score_cached: number | null
          compliance_threshold: number
          created_at: string
          created_by: string
          effective_date: string | null
          id: string
          lead_qp_id: string | null
          project_id: string
          report_type: string
          signature_date: string | null
          status: string
          summary: string | null
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          active_standards?: Database["public"]["Enums"]["compliance_standard"][]
          compliance_evaluated_at?: string | null
          compliance_score_cached?: number | null
          compliance_threshold?: number
          created_at?: string
          created_by: string
          effective_date?: string | null
          id?: string
          lead_qp_id?: string | null
          project_id: string
          report_type?: string
          signature_date?: string | null
          status?: string
          summary?: string | null
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          active_standards?: Database["public"]["Enums"]["compliance_standard"][]
          compliance_evaluated_at?: string | null
          compliance_score_cached?: number | null
          compliance_threshold?: number
          created_at?: string
          created_by?: string
          effective_date?: string | null
          id?: string
          lead_qp_id?: string | null
          project_id?: string
          report_type?: string
          signature_date?: string | null
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "technical_reports_lead_qp_id_fkey"
            columns: ["lead_qp_id"]
            isOneToOne: false
            referencedRelation: "qualified_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technical_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "technical_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          organization_id: string
          payload: Json | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          organization_id: string
          payload?: Json | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          organization_id?: string
          payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      term_sheet_share_views: {
        Row: {
          id: string
          ip: string | null
          share_id: string
          user_agent: string | null
          viewed_at: string
        }
        Insert: {
          id?: string
          ip?: string | null
          share_id: string
          user_agent?: string | null
          viewed_at?: string
        }
        Update: {
          id?: string
          ip?: string | null
          share_id?: string
          user_agent?: string | null
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "term_sheet_share_views_share_id_fkey"
            columns: ["share_id"]
            isOneToOne: false
            referencedRelation: "term_sheet_shares"
            referencedColumns: ["id"]
          },
        ]
      }
      term_sheet_shares: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          invitee_email: string | null
          label: string | null
          last_viewed_at: string | null
          max_uses: number | null
          passphrase_hash: string
          project_id: string
          revoked: boolean
          revoked_at: string | null
          revoked_by: string | null
          slug: string
          token: string
          view_count: number
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          invitee_email?: string | null
          label?: string | null
          last_viewed_at?: string | null
          max_uses?: number | null
          passphrase_hash: string
          project_id: string
          revoked?: boolean
          revoked_at?: string | null
          revoked_by?: string | null
          slug: string
          token: string
          view_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          invitee_email?: string | null
          label?: string | null
          last_viewed_at?: string | null
          max_uses?: number | null
          passphrase_hash?: string
          project_id?: string
          revoked?: boolean
          revoked_at?: string | null
          revoked_by?: string | null
          slug?: string
          token?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "term_sheet_shares_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "term_sheet_shares_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_counters: {
        Row: {
          id: string
          metric: string
          organization_id: string
          period_start: string
          updated_at: string
          value: number
        }
        Insert: {
          id?: string
          metric: string
          organization_id: string
          period_start: string
          updated_at?: string
          value?: number
        }
        Update: {
          id?: string
          metric?: string
          organization_id?: string
          period_start?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "usage_counters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_map_layer_prefs: {
        Row: {
          created_at: string
          id: string
          prefs: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          prefs?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          prefs?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          plan_id: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      validation_snapshots: {
        Row: {
          created_at: string
          created_by: string
          id: string
          project_id: string
          row_count: number
          status: string
          table_name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          project_id: string
          row_count?: number
          status: string
          table_name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          project_id?: string
          row_count?: number
          status?: string
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "validation_snapshots_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "validation_snapshots_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      watch_events: {
        Row: {
          cadastre_external_id: string | null
          created_at: string
          description: string | null
          event_type: string
          id: string
          notified_at: string | null
          payload: Json | null
          read_at: string | null
          severity: string
          subscription_id: string
          title: string
          user_id: string
        }
        Insert: {
          cadastre_external_id?: string | null
          created_at?: string
          description?: string | null
          event_type: string
          id?: string
          notified_at?: string | null
          payload?: Json | null
          read_at?: string | null
          severity?: string
          subscription_id: string
          title: string
          user_id: string
        }
        Update: {
          cadastre_external_id?: string | null
          created_at?: string
          description?: string | null
          event_type?: string
          id?: string
          notified_at?: string | null
          payload?: Json | null
          read_at?: string | null
          severity?: string
          subscription_id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watch_events_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "watch_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      watch_subscriptions: {
        Row: {
          active: boolean
          aoi_geom: unknown
          concession_external_id: string | null
          created_at: string
          holder_name: string | null
          holder_rut: string | null
          id: string
          kind: string
          label: string
          last_evaluated_at: string | null
          notify_email: boolean
          notify_inapp: boolean
          notify_webhook_url: string | null
          organization_id: string | null
          project_id: string | null
          region: string | null
          rules: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          aoi_geom?: unknown
          concession_external_id?: string | null
          created_at?: string
          holder_name?: string | null
          holder_rut?: string | null
          id?: string
          kind: string
          label: string
          last_evaluated_at?: string | null
          notify_email?: boolean
          notify_inapp?: boolean
          notify_webhook_url?: string | null
          organization_id?: string | null
          project_id?: string | null
          region?: string | null
          rules?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          aoi_geom?: unknown
          concession_external_id?: string | null
          created_at?: string
          holder_name?: string | null
          holder_rut?: string | null
          id?: string
          kind?: string
          label?: string
          last_evaluated_at?: string | null
          notify_email?: boolean
          notify_inapp?: boolean
          notify_webhook_url?: string | null
          organization_id?: string | null
          project_id?: string | null
          region?: string | null
          rules?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      workspace_function_roles: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["workspace_function_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          organization_id: string
          role: Database["public"]["Enums"]["workspace_function_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["workspace_function_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_function_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      concession_change_summary: {
        Row: {
          area_changes: number | null
          code: string | null
          concession_id: string | null
          holder_changes: number | null
          last_changed_at: string | null
          last_synced_at: string | null
          name: string | null
          project_id: string | null
          status_changes: number | null
          total_changes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mining_concessions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npv_por_proyecto"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "mining_concessions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      npv_por_proyecto: {
        Row: {
          ag_usd_oz: number | null
          au_usd_oz: number | null
          cochilco_proyeccion_2026_usd_lb: number | null
          cu_lme_usc_lb: number | null
          cu_usd_lb: number | null
          fecha: string | null
          mo_usd_lb: number | null
          npv_usdm_base: number | null
          project_code: string | null
          project_id: string | null
          project_name: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_project_invitation: { Args: { _token: string }; Returns: Json }
      archive_missing_cadastre: {
        Args: { _origen: string; _run_id: string; _run_started_at: string }
        Returns: number
      }
      cadastre_mvt: {
        Args: { _x: number; _y: number; _z: number }
        Returns: string
      }
      cadastre_sync_watchdog: { Args: never; Returns: number }
      can_access_module: {
        Args: {
          _module_key: string
          _need_edit?: boolean
          _org_id: string
          _user_id: string
        }
        Returns: boolean
      }
      can_access_pedimento: {
        Args: { _pedimento_id: string }
        Returns: boolean
      }
      check_catastro_conflict: {
        Args: { _lat: number; _lng: number; _project_id: string }
        Returns: {
          code: string
          concession_id: string
          holder: string
          name: string
          riesgo_legal: string
          status: string
        }[]
      }
      claim_next_job: {
        Args: { _kinds: string[]; _worker: string }
        Returns: {
          attempts: number
          created_at: string
          created_by: string | null
          finished_at: string | null
          id: string
          kind: string
          last_error: string | null
          max_attempts: number
          payload: Json
          priority: number
          project_id: string | null
          result: Json | null
          scheduled_at: string
          started_at: string | null
          status: string
          updated_at: string
          worker_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "job_queue"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      dispatch_process_jobs: { Args: { _batch_size?: number }; Returns: number }
      enqueue_job: {
        Args: {
          _delay_seconds?: number
          _kind: string
          _max_attempts?: number
          _payload?: Json
          _priority?: number
          _project_id?: string
        }
        Returns: string
      }
      geojson_to_geom: { Args: { _geo: Json }; Returns: unknown }
      get_concession_change_history: {
        Args: { _concession_id: string; _limit?: number }
        Returns: {
          changed_at: string
          changed_by: string
          field: string
          id: string
          new_value: string
          old_value: string
          source: string
        }[]
      }
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
      get_org_plan: {
        Args: { _org_id: string }
        Returns: {
          features: Json
          max_ai_calls_per_month: number
          max_jobs_per_month: number
          max_members: number
          max_projects: number
          max_storage_gb: number
          plan_code: string
          plan_name: string
          status: Database["public"]["Enums"]["subscription_status"]
        }[]
      }
      get_project_report_data: { Args: { _project_id: string }; Returns: Json }
      get_public_express_report: { Args: { _report_id: string }; Returns: Json }
      get_public_project_map: { Args: { _project_code: string }; Returns: Json }
      get_shared_investor_view: { Args: { _token: string }; Returns: Json }
      get_shared_satellite_view: { Args: { _token: string }; Returns: Json }
      get_targets_with_catastro: {
        Args: { _project_id: string }
        Returns: {
          code: string
          concession_code: string
          concession_holder: string
          concession_id: string
          concession_status: string
          geometry_geojson: Json
          lat: number
          lng: number
          name: string
          priority: string
          riesgo_legal: string
          score: number
          stage: string
          target_id: string
        }[]
      }
      get_targets_with_catastro_postgis: {
        Args: { _project_id: string }
        Returns: {
          code: string
          concession_code: string
          concession_holder: string
          concession_id: string
          concession_status: string
          lat: number
          lng: number
          name: string
          overlap_m2: number
          priority: string
          riesgo_legal: string
          score: number
          stage: string
          target_id: string
        }[]
      }
      get_user_plan: { Args: { _user_id: string }; Returns: string }
      has_data_room_access: {
        Args: { _data_room_id: string; _user_id: string }
        Returns: boolean
      }
      has_entitlement: {
        Args: { _feature: string; _user_id: string }
        Returns: boolean
      }
      has_org_role: {
        Args: {
          _org_id: string
          _roles: Database["public"]["Enums"]["org_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_project_role: {
        Args: {
          _project_id: string
          _roles: Database["public"]["Enums"]["project_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_workspace_function_role: {
        Args: {
          _org_id: string
          _roles: Database["public"]["Enums"]["workspace_function_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      increment_usage: {
        Args: { _delta?: number; _metric: string; _org_id: string }
        Returns: undefined
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_project_member: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      is_project_owner: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      mask_sensitive_jsonb: { Args: { _data: Json }; Returns: Json }
      match_holder_publications: {
        Args: { _holder_id: string }
        Returns: number
      }
      normalize_rut: { Args: { _rut: string }; Returns: string }
      record_ai_trace: {
        Args: {
          _context_sources?: Json
          _cost_usd?: number
          _created_by?: string
          _entity_id: string
          _entity_type: string
          _error?: string
          _inputs: Json
          _latency_ms?: number
          _model: string
          _model_version: string
          _outputs: Json
          _project_id: string
          _prompt_hash?: string
          _provider: string
          _qp_review_required?: boolean
          _recommendation_kind: string
          _status?: string
          _tokens_in?: number
          _tokens_out?: number
        }
        Returns: string
      }
      refresh_all_projects_catastro: { Args: never; Returns: number }
      refresh_all_projects_satellite: { Args: never; Returns: number }
      refresh_precios_global: { Args: never; Returns: number }
      requeue_stuck_jobs: { Args: { _older_than?: string }; Returns: number }
      schedule_compliance_evaluations: { Args: never; Returns: number }
      schedule_gold_spot_fetch: { Args: never; Returns: string }
      schedule_satellite_polling: { Args: never; Returns: number }
      search_cadastre: {
        Args: {
          _bbox?: unknown
          _limit?: number
          _offset?: number
          _origen?: string
          _q: string
          _region?: string
          _status?: string
        }
        Returns: {
          area_ha: number
          centroid_lat: number
          centroid_lng: number
          commune: string
          external_id: string
          holder_name: string
          holder_rut: string
          id: string
          name: string
          origen: string
          region: string
          rol: string
          score: number
          status: string
          tipo: string
          total_count: number
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      trigger_pipeline_async: {
        Args: { _project_id: string; _sources?: string[] }
        Returns: Json
      }
      update_project_center: {
        Args: {
          _lat: number
          _lng: number
          _move_principal?: boolean
          _project_id: string
        }
        Returns: Json
      }
      update_targets_risk_from_catastro: {
        Args: { _project_id: string }
        Returns: number
      }
      upsert_cadastre_feature: {
        Args: {
          _external_id: string
          _geometry_geojson: Json
          _origen: string
          _payload: Json
          _run_id?: string
        }
        Returns: string
      }
    }
    Enums: {
      account_type: "mining_owner" | "investor" | "geocapitals_team"
      alteration_assemblage:
        | "argillic"
        | "advanced_argillic"
        | "phyllic"
        | "propylitic"
        | "potassic"
        | "iron_oxide_gossan"
        | "silicic_cap"
        | "unclassified"
      app_role: "super_admin" | "support"
      compliance_standard:
        | "ni43101"
        | "jorc2012"
        | "samrec"
        | "perc"
        | "gkz"
        | "ch20235"
        | "sk1300"
      follow_up_category:
        | "catastro"
        | "satellite"
        | "sampling"
        | "pricing"
        | "geophysics"
        | "general"
      follow_up_priority: "low" | "medium" | "high" | "critical"
      follow_up_status: "open" | "in_progress" | "done" | "dismissed"
      hyperspectral_mineral:
        | "kaolinite"
        | "alunite"
        | "illite"
        | "sericite"
        | "muscovite"
        | "montmorillonite"
        | "chlorite"
        | "epidote"
        | "calcite"
        | "dolomite"
        | "hematite"
        | "goethite"
        | "jarosite"
        | "pyrite_oxidized"
        | "gypsum"
        | "silica"
        | "other"
      onboarding_state: "not_started" | "in_progress" | "completed"
      org_role: "owner" | "admin" | "member" | "viewer"
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
      review_status: "pending_review" | "approved" | "rejected"
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "incomplete"
      workspace_function_role: "admin" | "operador" | "analista"
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
      account_type: ["mining_owner", "investor", "geocapitals_team"],
      alteration_assemblage: [
        "argillic",
        "advanced_argillic",
        "phyllic",
        "propylitic",
        "potassic",
        "iron_oxide_gossan",
        "silicic_cap",
        "unclassified",
      ],
      app_role: ["super_admin", "support"],
      compliance_standard: [
        "ni43101",
        "jorc2012",
        "samrec",
        "perc",
        "gkz",
        "ch20235",
        "sk1300",
      ],
      follow_up_category: [
        "catastro",
        "satellite",
        "sampling",
        "pricing",
        "geophysics",
        "general",
      ],
      follow_up_priority: ["low", "medium", "high", "critical"],
      follow_up_status: ["open", "in_progress", "done", "dismissed"],
      hyperspectral_mineral: [
        "kaolinite",
        "alunite",
        "illite",
        "sericite",
        "muscovite",
        "montmorillonite",
        "chlorite",
        "epidote",
        "calcite",
        "dolomite",
        "hematite",
        "goethite",
        "jarosite",
        "pyrite_oxidized",
        "gypsum",
        "silica",
        "other",
      ],
      onboarding_state: ["not_started", "in_progress", "completed"],
      org_role: ["owner", "admin", "member", "viewer"],
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
      review_status: ["pending_review", "approved", "rejected"],
      subscription_status: [
        "trialing",
        "active",
        "past_due",
        "canceled",
        "incomplete",
      ],
      workspace_function_role: ["admin", "operador", "analista"],
    },
  },
} as const
