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
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "mining_concessions"
            referencedColumns: ["id"]
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
            referencedRelation: "mining_concessions"
            referencedColumns: ["id"]
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
            referencedRelation: "mining_concessions"
            referencedColumns: ["id"]
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
            referencedRelation: "mining_concessions"
            referencedColumns: ["id"]
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
          project_id: string
          resolved: boolean
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
          project_id: string
          resolved?: boolean
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
          project_id?: string
          resolved?: boolean
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
          geometry_geojson: Json | null
          granted_at: string | null
          holder: string | null
          holder_id: string | null
          id: string
          last_synced_at: string | null
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
          geometry_geojson?: Json | null
          granted_at?: string | null
          holder?: string | null
          holder_id?: string | null
          id?: string
          last_synced_at?: string | null
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
          geometry_geojson?: Json | null
          granted_at?: string | null
          holder?: string | null
          holder_id?: string | null
          id?: string
          last_synced_at?: string | null
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
          geometry_geojson: Json | null
          id: string
          is_published: boolean
          modality: string
          owner_user_id: string
          project_id: string | null
          region: string | null
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
          geometry_geojson?: Json | null
          id?: string
          is_published?: boolean
          modality?: string
          owner_user_id: string
          project_id?: string | null
          region?: string | null
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
          geometry_geojson?: Json | null
          id?: string
          is_published?: boolean
          modality?: string
          owner_user_id?: string
          project_id?: string | null
          region?: string | null
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
      qualified_persons: {
        Row: {
          bio: string | null
          competency_areas: string[] | null
          created_at: string
          cv_url: string | null
          full_name: string
          id: string
          is_verified: boolean
          license_no: string
          profession: string
          registration_body: string
          signature_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bio?: string | null
          competency_areas?: string[] | null
          created_at?: string
          cv_url?: string | null
          full_name: string
          id?: string
          is_verified?: boolean
          license_no: string
          profession: string
          registration_body: string
          signature_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bio?: string | null
          competency_areas?: string[] | null
          created_at?: string
          cv_url?: string | null
          full_name?: string
          id?: string
          is_verified?: boolean
          license_no?: string
          profession?: string
          registration_body?: string
          signature_url?: string | null
          updated_at?: string
          user_id?: string
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
      technical_report_sections: {
        Row: {
          content_md: string | null
          created_at: string
          figures: Json | null
          id: string
          project_id: string
          qp_id: string | null
          references_ids: string[] | null
          report_id: string
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
          content_md?: string | null
          created_at?: string
          figures?: Json | null
          id?: string
          project_id: string
          qp_id?: string | null
          references_ids?: string[] | null
          report_id: string
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
          content_md?: string | null
          created_at?: string
          figures?: Json | null
          id?: string
          project_id?: string
          qp_id?: string | null
          references_ids?: string[] | null
          report_id?: string
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
            referencedRelation: "projects"
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
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
      match_holder_publications: {
        Args: { _holder_id: string }
        Returns: number
      }
      normalize_rut: { Args: { _rut: string }; Returns: string }
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
