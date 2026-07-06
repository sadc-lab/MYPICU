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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      autoreg_study_results: {
        Row: {
          computed_at: string
          created_at: string
          curve: Json | null
          duration_hours: number | null
          file_name: string | null
          id: string
          lower_limit: number | null
          min_prx: number | null
          optimal_ppc: number | null
          rolling: Json | null
          sample_count: number | null
          study_patient_code: string | null
          study_patient_id: string
          study_patient_label: string | null
          upper_limit: number | null
          user_id: string
        }
        Insert: {
          computed_at?: string
          created_at?: string
          curve?: Json | null
          duration_hours?: number | null
          file_name?: string | null
          id?: string
          lower_limit?: number | null
          min_prx?: number | null
          optimal_ppc?: number | null
          rolling?: Json | null
          sample_count?: number | null
          study_patient_code?: string | null
          study_patient_id: string
          study_patient_label?: string | null
          upper_limit?: number | null
          user_id: string
        }
        Update: {
          computed_at?: string
          created_at?: string
          curve?: Json | null
          duration_hours?: number | null
          file_name?: string | null
          id?: string
          lower_limit?: number | null
          min_prx?: number | null
          optimal_ppc?: number | null
          rolling?: Json | null
          sample_count?: number | null
          study_patient_code?: string | null
          study_patient_id?: string
          study_patient_label?: string | null
          upper_limit?: number | null
          user_id?: string
        }
        Relationships: []
      }
      patient_clinical_info: {
        Row: {
          data: Json
          id: number
          info_type: string
          patient_id: string
        }
        Insert: {
          data: Json
          id?: never
          info_type: string
          patient_id: string
        }
        Update: {
          data?: Json
          id?: never
          info_type?: string
          patient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_patient_clinical_info_patient"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_medications: {
        Row: {
          charttime: string
          drugname: string
          id: number
          medication_type: string
          patient_id: string
          valeur: string | null
          variable: string | null
        }
        Insert: {
          charttime: string
          drugname: string
          id?: never
          medication_type: string
          patient_id: string
          valeur?: string | null
          variable?: string | null
        }
        Update: {
          charttime?: string
          drugname?: string
          id?: never
          medication_type?: string
          patient_id?: string
          valeur?: string | null
          variable?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_patient_medications_patient"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_objectives: {
        Row: {
          content: string
          created_at: string
          id: number
          organ: string
          patient_id: string
          sort_order: number
          type: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: never
          organ: string
          patient_id: string
          sort_order?: number
          type: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: never
          organ?: string
          patient_id?: string
          sort_order?: number
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_objectives_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_validity: {
        Row: {
          hour_index: number
          id: number
          indicator_key: string
          is_adherent: boolean
          patient_id: string
        }
        Insert: {
          hour_index: number
          id?: never
          indicator_key: string
          is_adherent: boolean
          patient_id: string
        }
        Update: {
          hour_index?: number
          id?: never
          indicator_key?: string
          is_adherent?: boolean
          patient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_patient_validity_patient"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_vitals: {
        Row: {
          charttime: string
          id: number
          patient_id: string
          valeur: number | null
          variable_key: string
        }
        Insert: {
          charttime: string
          id?: never
          patient_id: string
          valeur?: number | null
          variable_key: string
        }
        Update: {
          charttime?: string
          id?: never
          patient_id?: string
          valeur?: number | null
          variable_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_patient_vitals_patient"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          adherence: number | null
          age: string
          allergies: string | null
          brain_score: number | null
          created_at: string | null
          diagnosis: string
          exam: string | null
          gcs: number | null
          heart_score: number | null
          id: string
          intolerances: string | null
          kidney_score: number | null
          lungs_score: number | null
          name: string
          pelod_score: number | null
          picu_id: string
          priority: string
          tour: string | null
          updated_at: string | null
          ward: string | null
          weight: string
        }
        Insert: {
          adherence?: number | null
          age: string
          allergies?: string | null
          brain_score?: number | null
          created_at?: string | null
          diagnosis: string
          exam?: string | null
          gcs?: number | null
          heart_score?: number | null
          id: string
          intolerances?: string | null
          kidney_score?: number | null
          lungs_score?: number | null
          name: string
          pelod_score?: number | null
          picu_id: string
          priority?: string
          tour?: string | null
          updated_at?: string | null
          ward?: string | null
          weight: string
        }
        Update: {
          adherence?: number | null
          age?: string
          allergies?: string | null
          brain_score?: number | null
          created_at?: string | null
          diagnosis?: string
          exam?: string | null
          gcs?: number | null
          heart_score?: number | null
          id?: string
          intolerances?: string | null
          kidney_score?: number | null
          lungs_score?: number | null
          name?: string
          pelod_score?: number | null
          picu_id?: string
          priority?: string
          tour?: string | null
          updated_at?: string | null
          ward?: string | null
          weight?: string
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
