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
      drill_core_logs: {
        Row: {
          ag_gpt: number | null
          alteration: string | null
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
        ]
      }
      drill_holes: {
        Row: {
          actual_depth: number | null
          azimuth: number | null
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
          started_at: string | null
          status: string
          target_zone: string | null
          updated_at: string
        }
        Insert: {
          actual_depth?: number | null
          azimuth?: number | null
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
          started_at?: string | null
          status?: string
          target_zone?: string | null
          updated_at?: string
        }
        Update: {
          actual_depth?: number | null
          azimuth?: number | null
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
          started_at?: string | null
          status?: string
          target_zone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sampling_results: {
        Row: {
          ag_gpt: number | null
          as_ppm: number | null
          au_gpt: number | null
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
          as_ppm?: number | null
          au_gpt?: number | null
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
          as_ppm?: number | null
          au_gpt?: number | null
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
          sample_code?: string
          sample_type?: string
          sampled_at?: string | null
          sb_ppm?: number | null
          updated_at?: string
          zn_ppm?: number | null
          zone?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
