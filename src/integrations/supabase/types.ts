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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      alert_events: {
        Row: {
          channel: string
          created_at: string
          error: string | null
          id: string
          monitor_id: string
          provider: string
          provider_message_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          monitor_id: string
          provider?: string
          provider_message_id?: string | null
          status: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          monitor_id?: string
          provider?: string
          provider_message_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      devices: {
        Row: {
          created_at: string | null
          id: string
          token: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          token: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          token?: string
          user_id?: string | null
        }
        Relationships: []
      }
      monitor_checks: {
        Row: {
          checked_at: string
          error_message: string | null
          id: string
          monitor_id: string
          response_time: number | null
          status: string
        }
        Insert: {
          checked_at?: string
          error_message?: string | null
          id?: string
          monitor_id: string
          response_time?: number | null
          status: string
        }
        Update: {
          checked_at?: string
          error_message?: string | null
          id?: string
          monitor_id?: string
          response_time?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "monitor_checks_monitor_id_fkey"
            columns: ["monitor_id"]
            isOneToOne: false
            referencedRelation: "monitors"
            referencedColumns: ["id"]
          },
        ]
      }
      monitors: {
        Row: {
          alert_cooldown_minutes: number
          created_at: string
          error_message: string | null
          id: string
          last_alert_sent: string | null
          last_alert_sent_at: string | null
          last_checked: string | null
          monitoring_interval: number | null
          name: string
          response_time: number | null
          status: string
          updated_at: string
          uptime_percentage: number | null
          url: string
          user_id: string
        }
        Insert: {
          alert_cooldown_minutes?: number
          created_at?: string
          error_message?: string | null
          id?: string
          last_alert_sent?: string | null
          last_alert_sent_at?: string | null
          last_checked?: string | null
          monitoring_interval?: number | null
          name: string
          response_time?: number | null
          status?: string
          updated_at?: string
          uptime_percentage?: number | null
          url: string
          user_id: string
        }
        Update: {
          alert_cooldown_minutes?: number
          created_at?: string
          error_message?: string | null
          id?: string
          last_alert_sent?: string | null
          last_alert_sent_at?: string | null
          last_checked?: string | null
          monitoring_interval?: number | null
          name?: string
          response_time?: number | null
          status?: string
          updated_at?: string
          uptime_percentage?: number | null
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          company: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
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
