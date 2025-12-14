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
      adinkra_symbols: {
        Row: {
          adjacency_matrix: Json
          category: Database["public"]["Enums"]["adinkra_category"]
          created_at: string | null
          cultural_weight: number
          id: string
          meaning: string
          name: string
          transformation_rules: Json
          trust_implications: Json
          unicode_symbol: string
          updated_at: string | null
        }
        Insert: {
          adjacency_matrix: Json
          category: Database["public"]["Enums"]["adinkra_category"]
          created_at?: string | null
          cultural_weight?: number
          id?: string
          meaning: string
          name: string
          transformation_rules?: Json
          trust_implications?: Json
          unicode_symbol: string
          updated_at?: string | null
        }
        Update: {
          adjacency_matrix?: Json
          category?: Database["public"]["Enums"]["adinkra_category"]
          created_at?: string | null
          cultural_weight?: number
          id?: string
          meaning?: string
          name?: string
          transformation_rules?: Json
          trust_implications?: Json
          unicode_symbol?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      agent_registry: {
        Row: {
          adinkra_signature: string
          agent_name: string
          assigned_symbol_id: string | null
          behavioral_pattern: Json | null
          created_at: string
          cultural_fingerprint: Json | null
          environment_id: string | null
          id: string
          is_active: boolean
          last_seen: string | null
          last_verification: string | null
          metadata: Json | null
          pubkey: string
          trust_matrix: Json | null
          trust_score: number
          updated_at: string
        }
        Insert: {
          adinkra_signature: string
          agent_name: string
          assigned_symbol_id?: string | null
          behavioral_pattern?: Json | null
          created_at?: string
          cultural_fingerprint?: Json | null
          environment_id?: string | null
          id?: string
          is_active?: boolean
          last_seen?: string | null
          last_verification?: string | null
          metadata?: Json | null
          pubkey: string
          trust_matrix?: Json | null
          trust_score?: number
          updated_at?: string
        }
        Update: {
          adinkra_signature?: string
          agent_name?: string
          assigned_symbol_id?: string | null
          behavioral_pattern?: Json | null
          created_at?: string
          cultural_fingerprint?: Json | null
          environment_id?: string | null
          id?: string
          is_active?: boolean
          last_seen?: string | null
          last_verification?: string | null
          metadata?: Json | null
          pubkey?: string
          trust_matrix?: Json | null
          trust_score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_registry_assigned_symbol_id_fkey"
            columns: ["assigned_symbol_id"]
            isOneToOne: false
            referencedRelation: "adinkra_symbols"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_registry_environment_id_fkey"
            columns: ["environment_id"]
            isOneToOne: false
            referencedRelation: "secured_environments"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_intel: {
        Row: {
          asset_metadata: Json
          asset_name: string
          asset_type: Database["public"]["Enums"]["asset_type"]
          discovered_at: string
          discovered_by: string | null
          id: string
          is_monitored: boolean
          last_assessed: string
          risk_score: number
          threat_indicators: Json | null
        }
        Insert: {
          asset_metadata?: Json
          asset_name: string
          asset_type: Database["public"]["Enums"]["asset_type"]
          discovered_at?: string
          discovered_by?: string | null
          id?: string
          is_monitored?: boolean
          last_assessed?: string
          risk_score?: number
          threat_indicators?: Json | null
        }
        Update: {
          asset_metadata?: Json
          asset_name?: string
          asset_type?: Database["public"]["Enums"]["asset_type"]
          discovered_at?: string
          discovered_by?: string | null
          id?: string
          is_monitored?: boolean
          last_assessed?: string
          risk_score?: number
          threat_indicators?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_intel_discovered_by_fkey"
            columns: ["discovered_by"]
            isOneToOne: false
            referencedRelation: "agent_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_tasks: {
        Row: {
          assigned_to: string | null
          automation_data: Json | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          priority: number
          related_asset_id: string | null
          related_policy_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["task_status"]
          task_type: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          automation_data?: Json | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: number
          related_asset_id?: string | null
          related_policy_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          task_type: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          automation_data?: Json | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: number
          related_asset_id?: string | null
          related_policy_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          task_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_tasks_related_asset_id_fkey"
            columns: ["related_asset_id"]
            isOneToOne: false
            referencedRelation: "asset_intel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_tasks_related_policy_id_fkey"
            columns: ["related_policy_id"]
            isOneToOne: false
            referencedRelation: "policy_vault"
            referencedColumns: ["id"]
          },
        ]
      }
      consulting_access: {
        Row: {
          advisory_approved: boolean
          advisory_approved_at: string | null
          advisory_approved_by: string | null
          advisory_requested: boolean
          advisory_requested_at: string | null
          created_at: string
          diagnostic_paid: boolean
          diagnostic_paid_at: string | null
          id: string
          stripe_customer_id: string | null
          subscription_id: string | null
          subscription_status: string | null
          subscription_updated_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          advisory_approved?: boolean
          advisory_approved_at?: string | null
          advisory_approved_by?: string | null
          advisory_requested?: boolean
          advisory_requested_at?: string | null
          created_at?: string
          diagnostic_paid?: boolean
          diagnostic_paid_at?: string | null
          id?: string
          stripe_customer_id?: string | null
          subscription_id?: string | null
          subscription_status?: string | null
          subscription_updated_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          advisory_approved?: boolean
          advisory_approved_at?: string | null
          advisory_approved_by?: string | null
          advisory_requested?: boolean
          advisory_requested_at?: string | null
          created_at?: string
          diagnostic_paid?: boolean
          diagnostic_paid_at?: string | null
          id?: string
          stripe_customer_id?: string | null
          subscription_id?: string | null
          subscription_status?: string | null
          subscription_updated_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cultural_policies: {
        Row: {
          applicable_environments: string[] | null
          created_at: string | null
          created_by: string | null
          cultural_context: string
          enforcement_matrix: Json
          id: string
          is_active: boolean
          policy_name: string
          symbolic_logic: Json
          trust_requirements: Json
          updated_at: string | null
          version: number
          violation_consequences: Json
        }
        Insert: {
          applicable_environments?: string[] | null
          created_at?: string | null
          created_by?: string | null
          cultural_context: string
          enforcement_matrix: Json
          id?: string
          is_active?: boolean
          policy_name: string
          symbolic_logic: Json
          trust_requirements?: Json
          updated_at?: string | null
          version?: number
          violation_consequences?: Json
        }
        Update: {
          applicable_environments?: string[] | null
          created_at?: string | null
          created_by?: string | null
          cultural_context?: string
          enforcement_matrix?: Json
          id?: string
          is_active?: boolean
          policy_name?: string
          symbolic_logic?: Json
          trust_requirements?: Json
          updated_at?: string | null
          version?: number
          violation_consequences?: Json
        }
        Relationships: []
      }
      investigation_sessions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          name: string
          status: string
          targets: string[] | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          name: string
          status?: string
          targets?: string[] | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          status?: string
          targets?: string[] | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      khepra_admin_users: {
        Row: {
          activated_at: string | null
          admin_level: string
          created_at: string
          created_by: string | null
          cultural_fingerprint: string | null
          id: string
          is_active: boolean
          permissions: Json
          trust_score: number
          user_id: string
        }
        Insert: {
          activated_at?: string | null
          admin_level?: string
          created_at?: string
          created_by?: string | null
          cultural_fingerprint?: string | null
          id?: string
          is_active?: boolean
          permissions?: Json
          trust_score?: number
          user_id: string
        }
        Update: {
          activated_at?: string | null
          admin_level?: string
          created_at?: string
          created_by?: string | null
          cultural_fingerprint?: string | null
          id?: string
          is_active?: boolean
          permissions?: Json
          trust_score?: number
          user_id?: string
        }
        Relationships: []
      }
      khepra_secret_keys: {
        Row: {
          created_at: string
          created_by: string | null
          cultural_context: Json | null
          expires_at: string | null
          id: string
          is_active: boolean
          key_hash: string
          key_name: string
          key_type: string
          last_used_at: string | null
          security_level: number
          usage_count: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          cultural_context?: Json | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash: string
          key_name: string
          key_type: string
          last_used_at?: string | null
          security_level?: number
          usage_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          cultural_context?: Json | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash?: string
          key_name?: string
          key_type?: string
          last_used_at?: string | null
          security_level?: number
          usage_count?: number
        }
        Relationships: []
      }
      matrix_operations_log: {
        Row: {
          cultural_context: string | null
          environment_id: string | null
          execution_time_ms: number
          id: string
          input_matrix: Json
          operation_type: Database["public"]["Enums"]["matrix_operation"]
          output_matrix: Json
          source_agent_id: string | null
          symbol_used_id: string | null
          target_agent_id: string | null
          timestamp: string | null
          transformation_applied: Json
          verification_result: boolean
        }
        Insert: {
          cultural_context?: string | null
          environment_id?: string | null
          execution_time_ms: number
          id?: string
          input_matrix: Json
          operation_type: Database["public"]["Enums"]["matrix_operation"]
          output_matrix: Json
          source_agent_id?: string | null
          symbol_used_id?: string | null
          target_agent_id?: string | null
          timestamp?: string | null
          transformation_applied: Json
          verification_result: boolean
        }
        Update: {
          cultural_context?: string | null
          environment_id?: string | null
          execution_time_ms?: number
          id?: string
          input_matrix?: Json
          operation_type?: Database["public"]["Enums"]["matrix_operation"]
          output_matrix?: Json
          source_agent_id?: string | null
          symbol_used_id?: string | null
          target_agent_id?: string | null
          timestamp?: string | null
          transformation_applied?: Json
          verification_result?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "matrix_operations_log_environment_id_fkey"
            columns: ["environment_id"]
            isOneToOne: false
            referencedRelation: "secured_environments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matrix_operations_log_symbol_used_id_fkey"
            columns: ["symbol_used_id"]
            isOneToOne: false
            referencedRelation: "adinkra_symbols"
            referencedColumns: ["id"]
          },
        ]
      }
      osint_investigations: {
        Row: {
          created_at: string
          error_message: string | null
          execution_time_ms: number | null
          id: string
          parameters: Json | null
          results: Json | null
          status: string
          target: string
          tool_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          parameters?: Json | null
          results?: Json | null
          status?: string
          target: string
          tool_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          parameters?: Json | null
          results?: Json | null
          status?: string
          target?: string
          tool_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "osint_investigations_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "osint_tools"
            referencedColumns: ["id"]
          },
        ]
      }
      osint_tools: {
        Row: {
          category: string
          created_at: string
          description: string | null
          docker_image: string | null
          github_repo: string
          id: string
          input_format: Json
          is_active: boolean
          language: string | null
          last_updated: string | null
          name: string
          output_format: Json
          stars: number | null
          topics: string[] | null
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          docker_image?: string | null
          github_repo: string
          id?: string
          input_format?: Json
          is_active?: boolean
          language?: string | null
          last_updated?: string | null
          name: string
          output_format?: Json
          stars?: number | null
          topics?: string[] | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          docker_image?: string | null
          github_repo?: string
          id?: string
          input_format?: Json
          is_active?: boolean
          language?: string | null
          last_updated?: string | null
          name?: string
          output_format?: Json
          stars?: number | null
          topics?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      policy_vault: {
        Row: {
          category: Database["public"]["Enums"]["policy_category"]
          created_at: string
          created_by: string | null
          encrypted_content: string
          id: string
          is_active: boolean
          policy_name: string
          updated_at: string
          version: number
        }
        Insert: {
          category: Database["public"]["Enums"]["policy_category"]
          created_at?: string
          created_by?: string | null
          encrypted_content: string
          id?: string
          is_active?: boolean
          policy_name: string
          updated_at?: string
          version?: number
        }
        Update: {
          category?: Database["public"]["Enums"]["policy_category"]
          created_at?: string
          created_by?: string | null
          encrypted_content?: string
          id?: string
          is_active?: boolean
          policy_name?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      processed_stripe_events: {
        Row: {
          event_id: string
          metadata: Json | null
          processed_at: string
          stripe_event_type: string
        }
        Insert: {
          event_id: string
          metadata?: Json | null
          processed_at?: string
          stripe_event_type: string
        }
        Update: {
          event_id?: string
          metadata?: Json | null
          processed_at?: string
          stripe_event_type?: string
        }
        Relationships: []
      }
      readyprose_document_orders: {
        Row: {
          created_at: string
          file_url: string | null
          generated_content: string | null
          id: string
          payment_status: string
          questionnaire_responses: Json
          status: string
          stripe_payment_intent_id: string | null
          template_id: string
          total_amount_cents: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_url?: string | null
          generated_content?: string | null
          id?: string
          payment_status?: string
          questionnaire_responses?: Json
          status?: string
          stripe_payment_intent_id?: string | null
          template_id: string
          total_amount_cents: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_url?: string | null
          generated_content?: string | null
          id?: string
          payment_status?: string
          questionnaire_responses?: Json
          status?: string
          stripe_payment_intent_id?: string | null
          template_id?: string
          total_amount_cents?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "readyprose_document_orders_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "readyprose_document_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      readyprose_document_templates: {
        Row: {
          created_at: string
          description: string | null
          document_type: string
          fields_schema: Json
          id: string
          is_active: boolean
          jurisdiction: string
          name: string
          price_cents: number
          template_content: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          document_type: string
          fields_schema?: Json
          id?: string
          is_active?: boolean
          jurisdiction: string
          name: string
          price_cents?: number
          template_content: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          document_type?: string
          fields_schema?: Json
          id?: string
          is_active?: boolean
          jurisdiction?: string
          name?: string
          price_cents?: number
          template_content?: string
          updated_at?: string
        }
        Relationships: []
      }
      readyprose_questionnaire_sessions: {
        Row: {
          ai_conversation: Json
          created_at: string
          current_step: number
          id: string
          is_completed: boolean
          responses: Json
          template_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_conversation?: Json
          created_at?: string
          current_step?: number
          id?: string
          is_completed?: boolean
          responses?: Json
          template_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_conversation?: Json
          created_at?: string
          current_step?: number
          id?: string
          is_completed?: boolean
          responses?: Json
          template_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "readyprose_questionnaire_sessions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "readyprose_document_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      readyprose_user_profiles: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          phone: string | null
          state: string | null
          updated_at: string
          user_id: string
          zip_code: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          phone?: string | null
          state?: string | null
          updated_at?: string
          user_id: string
          zip_code?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          phone?: string | null
          state?: string | null
          updated_at?: string
          user_id?: string
          zip_code?: string | null
        }
        Relationships: []
      }
      secured_environments: {
        Row: {
          agent_count: number
          created_at: string | null
          environment_name: string
          environment_type: string
          id: string
          last_matrix_operation: string | null
          metadata: Json
          primary_symbol_id: string | null
          protection_matrix: Json
          state: Database["public"]["Enums"]["environment_state"]
          trust_matrix: Json
          updated_at: string | null
        }
        Insert: {
          agent_count?: number
          created_at?: string | null
          environment_name: string
          environment_type: string
          id?: string
          last_matrix_operation?: string | null
          metadata?: Json
          primary_symbol_id?: string | null
          protection_matrix?: Json
          state?: Database["public"]["Enums"]["environment_state"]
          trust_matrix?: Json
          updated_at?: string | null
        }
        Update: {
          agent_count?: number
          created_at?: string | null
          environment_name?: string
          environment_type?: string
          id?: string
          last_matrix_operation?: string | null
          metadata?: Json
          primary_symbol_id?: string | null
          protection_matrix?: Json
          state?: Database["public"]["Enums"]["environment_state"]
          trust_matrix?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "secured_environments_primary_symbol_id_fkey"
            columns: ["primary_symbol_id"]
            isOneToOne: false
            referencedRelation: "adinkra_symbols"
            referencedColumns: ["id"]
          },
        ]
      }
      session_investigations: {
        Row: {
          investigation_id: string
          session_id: string
        }
        Insert: {
          investigation_id: string
          session_id: string
        }
        Update: {
          investigation_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_investigations_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "osint_investigations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_investigations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "investigation_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      symbolic_threats: {
        Row: {
          affected_environments: string[] | null
          created_at: string | null
          cultural_implications: Json
          detection_rules: Json
          first_detected: string | null
          id: string
          is_active: boolean
          last_seen: string | null
          metadata: Json
          mitigation_symbol_id: string | null
          severity_score: number
          symbolic_signature: Json
          threat_category: string
          threat_name: string
        }
        Insert: {
          affected_environments?: string[] | null
          created_at?: string | null
          cultural_implications?: Json
          detection_rules?: Json
          first_detected?: string | null
          id?: string
          is_active?: boolean
          last_seen?: string | null
          metadata?: Json
          mitigation_symbol_id?: string | null
          severity_score: number
          symbolic_signature: Json
          threat_category: string
          threat_name: string
        }
        Update: {
          affected_environments?: string[] | null
          created_at?: string | null
          cultural_implications?: Json
          detection_rules?: Json
          first_detected?: string | null
          id?: string
          is_active?: boolean
          last_seen?: string | null
          metadata?: Json
          mitigation_symbol_id?: string | null
          severity_score?: number
          symbolic_signature?: Json
          threat_category?: string
          threat_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "symbolic_threats_mitigation_symbol_id_fkey"
            columns: ["mitigation_symbol_id"]
            isOneToOne: false
            referencedRelation: "adinkra_symbols"
            referencedColumns: ["id"]
          },
        ]
      }
      telemetry_logs: {
        Row: {
          agent_id: string | null
          correlation_id: string | null
          event_data: Json
          event_type: string
          id: string
          severity: Database["public"]["Enums"]["event_severity"]
          source_ip: unknown
          timestamp: string
          user_agent: string | null
        }
        Insert: {
          agent_id?: string | null
          correlation_id?: string | null
          event_data?: Json
          event_type: string
          id?: string
          severity?: Database["public"]["Enums"]["event_severity"]
          source_ip?: unknown
          timestamp?: string
          user_agent?: string | null
        }
        Update: {
          agent_id?: string | null
          correlation_id?: string | null
          event_data?: Json
          event_type?: string
          id?: string
          severity?: Database["public"]["Enums"]["event_severity"]
          source_ip?: unknown
          timestamp?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telemetry_logs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      template_orders: {
        Row: {
          amount_cents: number
          created_at: string
          generated_document: string | null
          id: string
          payment_status: string
          responses: Json
          session_id: string | null
          status: string
          template_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          generated_document?: string | null
          id?: string
          payment_status?: string
          responses?: Json
          session_id?: string | null
          status?: string
          template_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          generated_document?: string | null
          id?: string
          payment_status?: string
          responses?: Json
          session_id?: string | null
          status?: string
          template_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_orders_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "template_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_orders_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      template_sessions: {
        Row: {
          created_at: string
          id: string
          responses: Json
          status: string
          template_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          responses?: Json
          status?: string
          template_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          responses?: Json
          status?: string
          template_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_sessions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          category: string
          content: string
          created_at: string
          description: string | null
          fields: Json
          id: string
          is_active: boolean
          name: string
          price_cents: number
          updated_at: string
        }
        Insert: {
          category: string
          content: string
          created_at?: string
          description?: string | null
          fields?: Json
          id?: string
          is_active?: boolean
          name: string
          price_cents?: number
          updated_at?: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          description?: string | null
          fields?: Json
          id?: string
          is_active?: boolean
          name?: string
          price_cents?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          culture_fingerprint: string | null
          display_name: string | null
          id: string
          last_login: string | null
          org_id: string | null
          permissions: Json | null
          preferences: Json | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          culture_fingerprint?: string | null
          display_name?: string | null
          id?: string
          last_login?: string | null
          org_id?: string | null
          permissions?: Json | null
          preferences?: Json | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          culture_fingerprint?: string | null
          display_name?: string | null
          id?: string
          last_login?: string | null
          org_id?: string | null
          permissions?: Json | null
          preferences?: Json | null
          role?: Database["public"]["Enums"]["user_role"]
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
      check_auth_rate_limit: {
        Args: { user_identifier: string }
        Returns: boolean
      }
      check_auth_rate_limit_enhanced: {
        Args: { user_identifier: string }
        Returns: boolean
      }
      get_document_template_by_id: {
        Args: { template_id: string }
        Returns: {
          created_at: string
          description: string
          document_type: string
          fields_schema: Json
          id: string
          is_active: boolean
          jurisdiction: string
          name: string
          price_cents: number
          template_content: string
          updated_at: string
        }[]
      }
      get_document_templates: {
        Args: { filters_json?: Json }
        Returns: {
          created_at: string
          description: string
          document_type: string
          fields_schema: Json
          id: string
          is_active: boolean
          jurisdiction: string
          name: string
          price_cents: number
          template_content: string
          updated_at: string
        }[]
      }
      get_template_document_types: { Args: never; Returns: string[] }
      get_template_jurisdictions: { Args: never; Returns: string[] }
      sanitize_user_input: { Args: { input_text: string }; Returns: string }
      validate_admin_permissions: {
        Args: { permissions_json: Json }
        Returns: boolean
      }
      validate_cultural_input: {
        Args: { input_text: string }
        Returns: boolean
      }
      validate_key_metadata: {
        Args: { key_name: string; key_type: string }
        Returns: boolean
      }
      validate_osint_parameters: { Args: { params: Json }; Returns: boolean }
      validate_sensitive_input: {
        Args: { input_text: string }
        Returns: boolean
      }
    }
    Enums: {
      adinkra_category:
        | "trust"
        | "protection"
        | "wisdom"
        | "strength"
        | "unity"
        | "justice"
        | "leadership"
        | "transformation"
      agent_trust_level:
        | "untrusted"
        | "provisional"
        | "verified"
        | "trusted"
        | "sentinel"
      asset_type: "data" | "model" | "api" | "infrastructure" | "agent"
      environment_state:
        | "initializing"
        | "secured"
        | "monitoring"
        | "threat_detected"
        | "compromised"
        | "recovering"
      event_severity: "low" | "medium" | "high" | "critical"
      matrix_operation:
        | "identity"
        | "transformation"
        | "verification"
        | "propagation"
        | "validation"
        | "enforcement"
      policy_category: "cultural" | "compliance" | "security" | "operational"
      task_status:
        | "pending"
        | "in_progress"
        | "completed"
        | "failed"
        | "overdue"
      user_role: "admin" | "operator" | "analyst" | "viewer"
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
      adinkra_category: [
        "trust",
        "protection",
        "wisdom",
        "strength",
        "unity",
        "justice",
        "leadership",
        "transformation",
      ],
      agent_trust_level: [
        "untrusted",
        "provisional",
        "verified",
        "trusted",
        "sentinel",
      ],
      asset_type: ["data", "model", "api", "infrastructure", "agent"],
      environment_state: [
        "initializing",
        "secured",
        "monitoring",
        "threat_detected",
        "compromised",
        "recovering",
      ],
      event_severity: ["low", "medium", "high", "critical"],
      matrix_operation: [
        "identity",
        "transformation",
        "verification",
        "propagation",
        "validation",
        "enforcement",
      ],
      policy_category: ["cultural", "compliance", "security", "operational"],
      task_status: ["pending", "in_progress", "completed", "failed", "overdue"],
      user_role: ["admin", "operator", "analyst", "viewer"],
    },
  },
} as const
