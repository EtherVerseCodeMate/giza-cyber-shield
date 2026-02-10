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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      adaptive_schemas: {
        Row: {
          adaptations: Json | null
          base_schema: Json
          created_at: string | null
          current_version: string
          evolution_triggers: Json | null
          id: string
          learning_metadata: Json | null
          organization_id: string
          performance_metrics: Json | null
          schema_name: string
          stig_compliance_mappings: Json | null
          updated_at: string | null
        }
        Insert: {
          adaptations?: Json | null
          base_schema: Json
          created_at?: string | null
          current_version?: string
          evolution_triggers?: Json | null
          id?: string
          learning_metadata?: Json | null
          organization_id: string
          performance_metrics?: Json | null
          schema_name: string
          stig_compliance_mappings?: Json | null
          updated_at?: string | null
        }
        Update: {
          adaptations?: Json | null
          base_schema?: Json
          created_at?: string | null
          current_version?: string
          evolution_triggers?: Json | null
          id?: string
          learning_metadata?: Json | null
          organization_id?: string
          performance_metrics?: Json | null
          schema_name?: string
          stig_compliance_mappings?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "adaptive_schemas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_roles: {
        Row: {
          created_at: string
          expires_at: string | null
          granted_at: string
          granted_by: string | null
          id: string
          is_active: boolean
          metadata: Json | null
          role_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json | null
          role_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json | null
          role_type?: string
          user_id?: string
        }
        Relationships: []
      }
      agent_actions: {
        Row: {
          action_context: string
          action_data: Json
          action_type: string
          agent_id: string
          approval_required: boolean | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          error_message: string | null
          execution_time_ms: number | null
          id: string
          organization_id: string
          risk_score: number | null
          success: boolean
        }
        Insert: {
          action_context: string
          action_data?: Json
          action_type: string
          agent_id: string
          approval_required?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          organization_id: string
          risk_score?: number | null
          success?: boolean
        }
        Update: {
          action_context?: string
          action_data?: Json
          action_type?: string
          agent_id?: string
          approval_required?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          organization_id?: string
          risk_score?: number | null
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "agent_actions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_performance: {
        Row: {
          agent_id: string
          id: string
          measurement_period_end: string
          measurement_period_start: string
          metadata: Json | null
          metric_type: string
          metric_value: number
          recorded_at: string
        }
        Insert: {
          agent_id: string
          id?: string
          measurement_period_end: string
          measurement_period_start: string
          metadata?: Json | null
          metric_type: string
          metric_value: number
          recorded_at?: string
        }
        Update: {
          agent_id?: string
          id?: string
          measurement_period_end?: string
          measurement_period_start?: string
          metadata?: Json | null
          metric_type?: string
          metric_value?: number
          recorded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_performance_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_permissions: {
        Row: {
          agent_id: string
          conditions: Json | null
          expires_at: string | null
          granted_at: string
          granted_by: string | null
          id: string
          permission_level: string
          resource_identifier: string
          resource_type: string
        }
        Insert: {
          agent_id: string
          conditions?: Json | null
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          permission_level: string
          resource_identifier: string
          resource_type: string
        }
        Update: {
          agent_id?: string
          conditions?: Json | null
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          permission_level?: string
          resource_identifier?: string
          resource_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_permissions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_tool_integrations: {
        Row: {
          agent_id: string
          api_endpoints: Json
          authentication_method: string
          created_at: string
          id: string
          integration_config: Json
          last_sync: string | null
          rate_limits: Json | null
          status: string
          tool_name: string
          tool_type: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          api_endpoints?: Json
          authentication_method?: string
          created_at?: string
          id?: string
          integration_config?: Json
          last_sync?: string | null
          rate_limits?: Json | null
          status?: string
          tool_name: string
          tool_type: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          api_endpoints?: Json
          authentication_method?: string
          created_at?: string
          id?: string
          integration_config?: Json
          last_sync?: string | null
          rate_limits?: Json | null
          status?: string
          tool_name?: string
          tool_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_tool_integrations_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_workflows: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          organization_id: string
          participating_agents: string[]
          status: string
          trigger_conditions: Json
          updated_at: string
          workflow_definition: Json
          workflow_name: string
          workflow_type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id: string
          participating_agents: string[]
          status?: string
          trigger_conditions?: Json
          updated_at?: string
          workflow_definition: Json
          workflow_name: string
          workflow_type: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string
          participating_agents?: string[]
          status?: string
          trigger_conditions?: Json
          updated_at?: string
          workflow_definition?: Json
          workflow_name?: string
          workflow_type?: string
        }
        Relationships: []
      }
      ai_agent_chats: {
        Row: {
          context: Json | null
          created_at: string | null
          id: string
          message: string
          message_type: string
          metadata: Json | null
          organization_id: string
          response: string | null
          session_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          context?: Json | null
          created_at?: string | null
          id?: string
          message: string
          message_type: string
          metadata?: Json | null
          organization_id: string
          response?: string | null
          session_id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          context?: Json | null
          created_at?: string | null
          id?: string
          message?: string
          message_type?: string
          metadata?: Json | null
          organization_id?: string
          response?: string | null
          session_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ai_agent_roles: {
        Row: {
          base_permissions: Json
          created_at: string
          description: string | null
          id: string
          role_name: string
          updated_at: string
        }
        Insert: {
          base_permissions?: Json
          created_at?: string
          description?: string | null
          id?: string
          role_name: string
          updated_at?: string
        }
        Update: {
          base_permissions?: Json
          created_at?: string
          description?: string | null
          id?: string
          role_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_agents: {
        Row: {
          agent_name: string
          agent_type: string
          capabilities: Json
          created_at: string
          created_by: string | null
          deployment_status: string
          id: string
          last_active: string | null
          learning_data: Json
          organization_id: string
          performance_metrics: Json
          permissions: Json
          role_id: string | null
          specialization: string
          status: string
          trust_level: number
          updated_at: string
        }
        Insert: {
          agent_name: string
          agent_type: string
          capabilities?: Json
          created_at?: string
          created_by?: string | null
          deployment_status?: string
          id?: string
          last_active?: string | null
          learning_data?: Json
          organization_id: string
          performance_metrics?: Json
          permissions?: Json
          role_id?: string | null
          specialization: string
          status?: string
          trust_level?: number
          updated_at?: string
        }
        Update: {
          agent_name?: string
          agent_type?: string
          capabilities?: Json
          created_at?: string
          created_by?: string | null
          deployment_status?: string
          id?: string
          last_active?: string | null
          learning_data?: Json
          organization_id?: string
          performance_metrics?: Json
          permissions?: Json
          role_id?: string | null
          specialization?: string
          status?: string
          trust_level?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agents_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "ai_agent_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_compliance_agents: {
        Row: {
          agent_name: string
          automations_executed: number | null
          confidence_score: number | null
          control_family: string
          created_at: string
          execution_status: string | null
          id: string
          last_execution: string | null
          learning_data: Json | null
          organization_id: string
          recommendations_generated: number | null
          updated_at: string
        }
        Insert: {
          agent_name: string
          automations_executed?: number | null
          confidence_score?: number | null
          control_family: string
          created_at?: string
          execution_status?: string | null
          id?: string
          last_execution?: string | null
          learning_data?: Json | null
          organization_id: string
          recommendations_generated?: number | null
          updated_at?: string
        }
        Update: {
          agent_name?: string
          automations_executed?: number | null
          confidence_score?: number | null
          control_family?: string
          created_at?: string
          execution_status?: string | null
          id?: string
          last_execution?: string | null
          learning_data?: Json | null
          organization_id?: string
          recommendations_generated?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      alert_rules: {
        Row: {
          actions: Json
          conditions: Json
          cooldown_minutes: number | null
          created_at: string
          created_by: string | null
          description: string | null
          enabled: boolean | null
          id: string
          last_triggered: string | null
          name: string
          organization_id: string | null
          rule_type: string
          severity: string
          trigger_count: number | null
          updated_at: string
        }
        Insert: {
          actions: Json
          conditions: Json
          cooldown_minutes?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          enabled?: boolean | null
          id?: string
          last_triggered?: string | null
          name: string
          organization_id?: string | null
          rule_type: string
          severity: string
          trigger_count?: number | null
          updated_at?: string
        }
        Update: {
          actions?: Json
          conditions?: Json
          cooldown_minutes?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          enabled?: boolean | null
          id?: string
          last_triggered?: string | null
          name?: string
          organization_id?: string | null
          rule_type?: string
          severity?: string
          trigger_count?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type: string
          assigned_to: string | null
          confidence_score: number | null
          created_at: string
          description: string | null
          escalated: boolean | null
          escalation_level: number | null
          id: string
          metadata: Json | null
          organization_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          risk_score: number | null
          severity: string
          sla_deadline: string | null
          source_id: string | null
          source_type: string
          status: string
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type: string
          assigned_to?: string | null
          confidence_score?: number | null
          created_at?: string
          description?: string | null
          escalated?: boolean | null
          escalation_level?: number | null
          id?: string
          metadata?: Json | null
          organization_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          risk_score?: number | null
          severity: string
          sla_deadline?: string | null
          source_id?: string | null
          source_type: string
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type?: string
          assigned_to?: string | null
          confidence_score?: number | null
          created_at?: string
          description?: string | null
          escalated?: boolean | null
          escalation_level?: number | null
          id?: string
          metadata?: Json | null
          organization_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          risk_score?: number | null
          severity?: string
          sla_deadline?: string | null
          source_id?: string | null
          source_type?: string
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      api_integrations: {
        Row: {
          api_type: string
          authentication_type: string
          created_at: string | null
          created_by: string | null
          data_mapping: Json | null
          endpoint_url: string
          failed_requests: number | null
          id: string
          integration_name: string
          is_active: boolean | null
          last_sync: string | null
          organization_id: string
          rate_limits: Json | null
          request_headers: Json | null
          successful_requests: number | null
          sync_frequency_minutes: number | null
          sync_status: string | null
          total_requests: number | null
          updated_at: string | null
        }
        Insert: {
          api_type: string
          authentication_type: string
          created_at?: string | null
          created_by?: string | null
          data_mapping?: Json | null
          endpoint_url: string
          failed_requests?: number | null
          id?: string
          integration_name: string
          is_active?: boolean | null
          last_sync?: string | null
          organization_id: string
          rate_limits?: Json | null
          request_headers?: Json | null
          successful_requests?: number | null
          sync_frequency_minutes?: number | null
          sync_status?: string | null
          total_requests?: number | null
          updated_at?: string | null
        }
        Update: {
          api_type?: string
          authentication_type?: string
          created_at?: string | null
          created_by?: string | null
          data_mapping?: Json | null
          endpoint_url?: string
          failed_requests?: number | null
          id?: string
          integration_name?: string
          is_active?: boolean | null
          last_sync?: string | null
          organization_id?: string
          rate_limits?: Json | null
          request_headers?: Json | null
          successful_requests?: number | null
          sync_frequency_minutes?: number | null
          sync_status?: string | null
          total_requests?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      asset_configuration_snapshots: {
        Row: {
          asset_id: string
          captured_at: string
          configuration_data: Json
          id: string
          metadata: Json | null
          organization_id: string
          snapshot_type: string
          stig_compliance_status: Json | null
        }
        Insert: {
          asset_id: string
          captured_at?: string
          configuration_data: Json
          id?: string
          metadata?: Json | null
          organization_id: string
          snapshot_type: string
          stig_compliance_status?: Json | null
        }
        Update: {
          asset_id?: string
          captured_at?: string
          configuration_data?: Json
          id?: string
          metadata?: Json | null
          organization_id?: string
          snapshot_type?: string
          stig_compliance_status?: Json | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: unknown
          resource_id: string | null
          resource_type: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: unknown
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: unknown
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      behavioral_analytics: {
        Row: {
          analysis_period_end: string
          analysis_period_start: string
          anomaly_score: number | null
          baseline_metrics: Json | null
          behavior_type: string
          current_metrics: Json | null
          detected_at: string | null
          entity_identifier: string
          entity_type: string
          id: string
          organization_id: string
          risk_level: string | null
          user_id: string | null
        }
        Insert: {
          analysis_period_end: string
          analysis_period_start: string
          anomaly_score?: number | null
          baseline_metrics?: Json | null
          behavior_type: string
          current_metrics?: Json | null
          detected_at?: string | null
          entity_identifier: string
          entity_type: string
          id?: string
          organization_id: string
          risk_level?: string | null
          user_id?: string | null
        }
        Update: {
          analysis_period_end?: string
          analysis_period_start?: string
          anomaly_score?: number | null
          baseline_metrics?: Json | null
          behavior_type?: string
          current_metrics?: Json | null
          detected_at?: string | null
          entity_identifier?: string
          entity_type?: string
          id?: string
          organization_id?: string
          risk_level?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      beta_enrollments: {
        Row: {
          beta_terms_accepted: boolean
          created_at: string
          cui_acknowledgment_signed: boolean
          current_asset_count: number
          enrolled_at: string
          expires_at: string | null
          id: string
          max_assets: number
          organization_id: string
          tier: string
          tier_pricing: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          beta_terms_accepted?: boolean
          created_at?: string
          cui_acknowledgment_signed?: boolean
          current_asset_count?: number
          enrolled_at?: string
          expires_at?: string | null
          id?: string
          max_assets?: number
          organization_id: string
          tier: string
          tier_pricing?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          beta_terms_accepted?: boolean
          created_at?: string
          cui_acknowledgment_signed?: boolean
          current_asset_count?: number
          enrolled_at?: string
          expires_at?: string | null
          id?: string
          max_assets?: number
          organization_id?: string
          tier?: string
          tier_pricing?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "beta_enrollments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      beta_usage_metrics: {
        Row: {
          assets_scanned: number | null
          bug_reports: Json | null
          created_at: string
          dashboard_sessions: number | null
          enrollment_id: string
          evidence_bundles_generated: number | null
          feature_requests: Json | null
          id: string
          metric_date: string
          stig_searches: number | null
          user_feedback_score: number | null
        }
        Insert: {
          assets_scanned?: number | null
          bug_reports?: Json | null
          created_at?: string
          dashboard_sessions?: number | null
          enrollment_id: string
          evidence_bundles_generated?: number | null
          feature_requests?: Json | null
          id?: string
          metric_date?: string
          stig_searches?: number | null
          user_feedback_score?: number | null
        }
        Update: {
          assets_scanned?: number | null
          bug_reports?: Json | null
          created_at?: string
          dashboard_sessions?: number | null
          enrollment_id?: string
          evidence_bundles_generated?: number | null
          feature_requests?: Json | null
          id?: string
          metric_date?: string
          stig_searches?: number | null
          user_feedback_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "beta_usage_metrics_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "beta_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_periods: {
        Row: {
          base_subscription_cost: number | null
          created_at: string
          id: string
          organization_id: string
          period_end: string
          period_start: string
          status: string
          stripe_invoice_id: string | null
          total_amount: number | null
          total_usage_cost: number | null
          updated_at: string
        }
        Insert: {
          base_subscription_cost?: number | null
          created_at?: string
          id?: string
          organization_id: string
          period_end: string
          period_start: string
          status?: string
          stripe_invoice_id?: string | null
          total_amount?: number | null
          total_usage_cost?: number | null
          updated_at?: string
        }
        Update: {
          base_subscription_cost?: number | null
          created_at?: string
          id?: string
          organization_id?: string
          period_end?: string
          period_start?: string
          status?: string
          stripe_invoice_id?: string | null
          total_amount?: number | null
          total_usage_cost?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          cart_id: string
          created_at: string | null
          id: string
          price_at_add: number
          product_id: string
          quantity: number
          updated_at: string | null
        }
        Insert: {
          cart_id: string
          created_at?: string | null
          id?: string
          price_at_add: number
          product_id: string
          quantity?: number
          updated_at?: string | null
        }
        Update: {
          cart_id?: string
          created_at?: string | null
          id?: string
          price_at_add?: number
          product_id?: string
          quantity?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "shopping_carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      cmmc_control_mappings: {
        Row: {
          automation_possible: boolean | null
          cmmc_control_id: string
          cmmc_domain: string
          cmmc_level: number
          cost_estimate: number | null
          created_at: string
          effort_estimate_hours: number | null
          id: string
          implementation_guidance: string | null
          implementation_priority: number | null
          mapping_strength: string
          platform_type: string
          stig_rule_id: string
          stig_title: string
          updated_at: string
          validation_criteria: Json | null
        }
        Insert: {
          automation_possible?: boolean | null
          cmmc_control_id: string
          cmmc_domain: string
          cmmc_level: number
          cost_estimate?: number | null
          created_at?: string
          effort_estimate_hours?: number | null
          id?: string
          implementation_guidance?: string | null
          implementation_priority?: number | null
          mapping_strength: string
          platform_type: string
          stig_rule_id: string
          stig_title: string
          updated_at?: string
          validation_criteria?: Json | null
        }
        Update: {
          automation_possible?: boolean | null
          cmmc_control_id?: string
          cmmc_domain?: string
          cmmc_level?: number
          cost_estimate?: number | null
          created_at?: string
          effort_estimate_hours?: number | null
          id?: string
          implementation_guidance?: string | null
          implementation_priority?: number | null
          mapping_strength?: string
          platform_type?: string
          stig_rule_id?: string
          stig_title?: string
          updated_at?: string
          validation_criteria?: Json | null
        }
        Relationships: []
      }
      cmmc_implementation_plans: {
        Row: {
          automated_implementations: number | null
          cmmc_level: number
          created_at: string
          created_by: string | null
          estimated_cost: number | null
          estimated_effort_hours: number | null
          id: string
          implementation_status: string | null
          manual_implementations: number | null
          organization_id: string
          plan_data: Json
          progress_percentage: number | null
          target_platforms: string[]
          total_stig_rules: number | null
          updated_at: string
        }
        Insert: {
          automated_implementations?: number | null
          cmmc_level: number
          created_at?: string
          created_by?: string | null
          estimated_cost?: number | null
          estimated_effort_hours?: number | null
          id?: string
          implementation_status?: string | null
          manual_implementations?: number | null
          organization_id: string
          plan_data?: Json
          progress_percentage?: number | null
          target_platforms?: string[]
          total_stig_rules?: number | null
          updated_at?: string
        }
        Update: {
          automated_implementations?: number | null
          cmmc_level?: number
          created_at?: string
          created_by?: string | null
          estimated_cost?: number | null
          estimated_effort_hours?: number | null
          id?: string
          implementation_status?: string | null
          manual_implementations?: number | null
          organization_id?: string
          plan_data?: Json
          progress_percentage?: number | null
          target_platforms?: string[]
          total_stig_rules?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      cmmc_stig_mappings: {
        Row: {
          cmmc_control_id: string
          cmmc_level: number
          created_at: string
          id: string
          mapping_strength: string
          notes: string | null
          stig_rule_id: string
          updated_at: string
        }
        Insert: {
          cmmc_control_id: string
          cmmc_level: number
          created_at?: string
          id?: string
          mapping_strength: string
          notes?: string | null
          stig_rule_id: string
          updated_at?: string
        }
        Update: {
          cmmc_control_id?: string
          cmmc_level?: number
          created_at?: string
          id?: string
          mapping_strength?: string
          notes?: string | null
          stig_rule_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      codex_agents: {
        Row: {
          agent_type: string
          ai_model: string
          capabilities: Json | null
          configuration: Json | null
          created_at: string | null
          id: string
          last_active: string | null
          name: string
          organization_id: string
          performance_metrics: Json | null
          specialized_knowledge: Json | null
          status: string
          updated_at: string | null
        }
        Insert: {
          agent_type: string
          ai_model: string
          capabilities?: Json | null
          configuration?: Json | null
          created_at?: string | null
          id?: string
          last_active?: string | null
          name: string
          organization_id: string
          performance_metrics?: Json | null
          specialized_knowledge?: Json | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          agent_type?: string
          ai_model?: string
          capabilities?: Json | null
          configuration?: Json | null
          created_at?: string | null
          id?: string
          last_active?: string | null
          name?: string
          organization_id?: string
          performance_metrics?: Json | null
          specialized_knowledge?: Json | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "codex_agents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_assessments: {
        Row: {
          actual_completion_date: string | null
          assessment_type: string
          assessor_name: string | null
          assessor_organization: string | null
          compliance_level: string | null
          created_at: string
          created_by: string | null
          description: string | null
          findings_summary: string | null
          framework_id: string | null
          id: string
          name: string
          next_assessment_due: string | null
          organization_id: string | null
          overall_score: number | null
          recommendations: string[] | null
          scope_description: string | null
          start_date: string | null
          status: string
          target_completion_date: string | null
          updated_at: string
        }
        Insert: {
          actual_completion_date?: string | null
          assessment_type: string
          assessor_name?: string | null
          assessor_organization?: string | null
          compliance_level?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          findings_summary?: string | null
          framework_id?: string | null
          id?: string
          name: string
          next_assessment_due?: string | null
          organization_id?: string | null
          overall_score?: number | null
          recommendations?: string[] | null
          scope_description?: string | null
          start_date?: string | null
          status?: string
          target_completion_date?: string | null
          updated_at?: string
        }
        Update: {
          actual_completion_date?: string | null
          assessment_type?: string
          assessor_name?: string | null
          assessor_organization?: string | null
          compliance_level?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          findings_summary?: string | null
          framework_id?: string | null
          id?: string
          name?: string
          next_assessment_due?: string | null
          organization_id?: string | null
          overall_score?: number | null
          recommendations?: string[] | null
          scope_description?: string | null
          start_date?: string | null
          status?: string
          target_completion_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_assessments_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "compliance_frameworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_assessments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_controls: {
        Row: {
          assessment_procedures: string | null
          automation_possible: boolean | null
          automation_query: string | null
          control_id: string
          control_type: string
          created_at: string
          description: string
          family: string | null
          framework_id: string | null
          id: string
          implementation_guidance: string | null
          priority: string | null
          related_controls: string[] | null
          required_evidence: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          assessment_procedures?: string | null
          automation_possible?: boolean | null
          automation_query?: string | null
          control_id: string
          control_type: string
          created_at?: string
          description: string
          family?: string | null
          framework_id?: string | null
          id?: string
          implementation_guidance?: string | null
          priority?: string | null
          related_controls?: string[] | null
          required_evidence?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          assessment_procedures?: string | null
          automation_possible?: boolean | null
          automation_query?: string | null
          control_id?: string
          control_type?: string
          created_at?: string
          description?: string
          family?: string | null
          framework_id?: string | null
          id?: string
          implementation_guidance?: string | null
          priority?: string | null
          related_controls?: string[] | null
          required_evidence?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_controls_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "compliance_frameworks"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_drift_events: {
        Row: {
          acknowledged: boolean | null
          acknowledged_at: string | null
          acknowledged_by: string | null
          asset_id: string
          auto_remediated: boolean | null
          current_state: Json
          detected_at: string
          detection_method: string
          drift_type: string
          id: string
          organization_id: string
          previous_state: Json
          remediation_action: string | null
          severity: string
          stig_rule_id: string
        }
        Insert: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          asset_id: string
          auto_remediated?: boolean | null
          current_state: Json
          detected_at?: string
          detection_method: string
          drift_type: string
          id?: string
          organization_id: string
          previous_state: Json
          remediation_action?: string | null
          severity: string
          stig_rule_id: string
        }
        Update: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          asset_id?: string
          auto_remediated?: boolean | null
          current_state?: Json
          detected_at?: string
          detection_method?: string
          drift_type?: string
          id?: string
          organization_id?: string
          previous_state?: Json
          remediation_action?: string | null
          severity?: string
          stig_rule_id?: string
        }
        Relationships: []
      }
      compliance_evidence: {
        Row: {
          collection_date: string | null
          collection_method: string | null
          control_assessment_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          evidence_type: string
          file_hash: string | null
          file_path: string | null
          id: string
          metadata: Json | null
          retention_period_days: number | null
          tags: string[] | null
          title: string
        }
        Insert: {
          collection_date?: string | null
          collection_method?: string | null
          control_assessment_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          evidence_type: string
          file_hash?: string | null
          file_path?: string | null
          id?: string
          metadata?: Json | null
          retention_period_days?: number | null
          tags?: string[] | null
          title: string
        }
        Update: {
          collection_date?: string | null
          collection_method?: string | null
          control_assessment_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          evidence_type?: string
          file_hash?: string | null
          file_path?: string | null
          id?: string
          metadata?: Json | null
          retention_period_days?: number | null
          tags?: string[] | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_evidence_control_assessment_id_fkey"
            columns: ["control_assessment_id"]
            isOneToOne: false
            referencedRelation: "control_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_exceptions: {
        Row: {
          approval_date: string | null
          approved_by: string | null
          assessment_id: string | null
          compensating_measures: string | null
          control_id: string | null
          created_at: string
          created_by: string | null
          exception_type: string
          expiration_date: string | null
          id: string
          justification: string
          last_review_date: string | null
          next_review_date: string | null
          review_frequency_days: number | null
          risk_level: string
          status: string | null
          title: string
          updated_at: string
        }
        Insert: {
          approval_date?: string | null
          approved_by?: string | null
          assessment_id?: string | null
          compensating_measures?: string | null
          control_id?: string | null
          created_at?: string
          created_by?: string | null
          exception_type: string
          expiration_date?: string | null
          id?: string
          justification: string
          last_review_date?: string | null
          next_review_date?: string | null
          review_frequency_days?: number | null
          risk_level: string
          status?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          approval_date?: string | null
          approved_by?: string | null
          assessment_id?: string | null
          compensating_measures?: string | null
          control_id?: string | null
          created_at?: string
          created_by?: string | null
          exception_type?: string
          expiration_date?: string | null
          id?: string
          justification?: string
          last_review_date?: string | null
          next_review_date?: string | null
          review_frequency_days?: number | null
          risk_level?: string
          status?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_exceptions_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "compliance_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_exceptions_control_id_fkey"
            columns: ["control_id"]
            isOneToOne: false
            referencedRelation: "compliance_controls"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_frameworks: {
        Row: {
          authority: string | null
          category: string
          created_at: string
          description: string | null
          enabled: boolean | null
          id: string
          metadata: Json | null
          name: string
          organization_id: string | null
          updated_at: string
          version: string
        }
        Insert: {
          authority?: string | null
          category: string
          created_at?: string
          description?: string | null
          enabled?: boolean | null
          id?: string
          metadata?: Json | null
          name: string
          organization_id?: string | null
          updated_at?: string
          version: string
        }
        Update: {
          authority?: string | null
          category?: string
          created_at?: string
          description?: string | null
          enabled?: boolean | null
          id?: string
          metadata?: Json | null
          name?: string
          organization_id?: string | null
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_frameworks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_implementations: {
        Row: {
          ai_recommendations: Json | null
          asset_id: string | null
          assigned_to: string | null
          control_id: string
          created_at: string
          evidence_collected: Json | null
          id: string
          implementation_date: string | null
          implementation_status: string
          next_review_date: string | null
          organization_id: string
          priority_score: number | null
          remediation_notes: string | null
          stig_rule_id: string | null
          updated_at: string
          validation_date: string | null
          validation_status: string | null
        }
        Insert: {
          ai_recommendations?: Json | null
          asset_id?: string | null
          assigned_to?: string | null
          control_id: string
          created_at?: string
          evidence_collected?: Json | null
          id?: string
          implementation_date?: string | null
          implementation_status?: string
          next_review_date?: string | null
          organization_id: string
          priority_score?: number | null
          remediation_notes?: string | null
          stig_rule_id?: string | null
          updated_at?: string
          validation_date?: string | null
          validation_status?: string | null
        }
        Update: {
          ai_recommendations?: Json | null
          asset_id?: string | null
          assigned_to?: string | null
          control_id?: string
          created_at?: string
          evidence_collected?: Json | null
          id?: string
          implementation_date?: string | null
          implementation_status?: string
          next_review_date?: string | null
          organization_id?: string
          priority_score?: number | null
          remediation_notes?: string | null
          stig_rule_id?: string | null
          updated_at?: string
          validation_date?: string | null
          validation_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_implementations_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "environment_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_reports: {
        Row: {
          compliance_percentage: number | null
          critical_findings: number | null
          generated_at: string
          generated_by: string | null
          high_findings: number | null
          id: string
          low_findings: number | null
          medium_findings: number | null
          organization_id: string
          report_data: Json
          report_name: string
          report_type: string
          scope_assets: string[] | null
          scope_stigs: string[] | null
          status: string
        }
        Insert: {
          compliance_percentage?: number | null
          critical_findings?: number | null
          generated_at?: string
          generated_by?: string | null
          high_findings?: number | null
          id?: string
          low_findings?: number | null
          medium_findings?: number | null
          organization_id: string
          report_data: Json
          report_name: string
          report_type: string
          scope_assets?: string[] | null
          scope_stigs?: string[] | null
          status?: string
        }
        Update: {
          compliance_percentage?: number | null
          critical_findings?: number | null
          generated_at?: string
          generated_by?: string | null
          high_findings?: number | null
          id?: string
          low_findings?: number | null
          medium_findings?: number | null
          organization_id?: string
          report_data?: Json
          report_name?: string
          report_type?: string
          scope_assets?: string[] | null
          scope_stigs?: string[] | null
          status?: string
        }
        Relationships: []
      }
      compliance_validation_results: {
        Row: {
          control_id: string
          evidence_links: Json | null
          findings: string | null
          framework_type: string
          id: string
          next_validation_due: string | null
          organization_id: string
          score: number | null
          status: string
          validated_at: string | null
          validation_type: string
        }
        Insert: {
          control_id: string
          evidence_links?: Json | null
          findings?: string | null
          framework_type: string
          id?: string
          next_validation_due?: string | null
          organization_id: string
          score?: number | null
          status: string
          validated_at?: string | null
          validation_type: string
        }
        Update: {
          control_id?: string
          evidence_links?: Json | null
          findings?: string | null
          framework_type?: string
          id?: string
          next_validation_due?: string | null
          organization_id?: string
          score?: number | null
          status?: string
          validated_at?: string | null
          validation_type?: string
        }
        Relationships: []
      }
      control_assessments: {
        Row: {
          assessment_id: string | null
          assessor_notes: string | null
          automation_result: Json | null
          compensating_controls: string | null
          control_id: string | null
          created_at: string
          effectiveness: string | null
          evidence_provided: string[] | null
          findings: string | null
          id: string
          implementation_score: number | null
          last_tested_date: string | null
          next_test_due: string | null
          recommendations: string | null
          status: string
          test_results: string | null
          updated_at: string
        }
        Insert: {
          assessment_id?: string | null
          assessor_notes?: string | null
          automation_result?: Json | null
          compensating_controls?: string | null
          control_id?: string | null
          created_at?: string
          effectiveness?: string | null
          evidence_provided?: string[] | null
          findings?: string | null
          id?: string
          implementation_score?: number | null
          last_tested_date?: string | null
          next_test_due?: string | null
          recommendations?: string | null
          status: string
          test_results?: string | null
          updated_at?: string
        }
        Update: {
          assessment_id?: string | null
          assessor_notes?: string | null
          automation_result?: Json | null
          compensating_controls?: string | null
          control_id?: string | null
          created_at?: string
          effectiveness?: string | null
          evidence_provided?: string[] | null
          findings?: string | null
          id?: string
          implementation_score?: number | null
          last_tested_date?: string | null
          next_test_due?: string | null
          recommendations?: string | null
          status?: string
          test_results?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "control_assessments_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "compliance_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "control_assessments_control_id_fkey"
            columns: ["control_id"]
            isOneToOne: false
            referencedRelation: "compliance_controls"
            referencedColumns: ["id"]
          },
        ]
      }
      cui_detection_log: {
        Row: {
          admin_review_required: boolean
          admin_reviewed_at: string | null
          admin_reviewed_by: string | null
          blocked: boolean
          detected_at: string
          detected_content: string | null
          detection_type: string
          enrollment_id: string | null
          id: string
          resolution_notes: string | null
          user_id: string | null
        }
        Insert: {
          admin_review_required?: boolean
          admin_reviewed_at?: string | null
          admin_reviewed_by?: string | null
          blocked?: boolean
          detected_at?: string
          detected_content?: string | null
          detection_type: string
          enrollment_id?: string | null
          id?: string
          resolution_notes?: string | null
          user_id?: string | null
        }
        Update: {
          admin_review_required?: boolean
          admin_reviewed_at?: string | null
          admin_reviewed_by?: string | null
          blocked?: boolean
          detected_at?: string
          detected_content?: string | null
          detection_type?: string
          enrollment_id?: string | null
          id?: string
          resolution_notes?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cui_detection_log_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "beta_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      data_source_connections: {
        Row: {
          adapter_id: string | null
          connection_config: Json
          connection_name: string
          connection_status: string
          created_at: string
          created_by: string | null
          credentials_config: Json
          discovery_results: Json | null
          environment_type: string
          id: string
          last_test: string | null
          organization_id: string
          test_results: Json | null
          updated_at: string
        }
        Insert: {
          adapter_id?: string | null
          connection_config?: Json
          connection_name: string
          connection_status?: string
          created_at?: string
          created_by?: string | null
          credentials_config?: Json
          discovery_results?: Json | null
          environment_type: string
          id?: string
          last_test?: string | null
          organization_id: string
          test_results?: Json | null
          updated_at?: string
        }
        Update: {
          adapter_id?: string | null
          connection_config?: Json
          connection_name?: string
          connection_status?: string
          created_at?: string
          created_by?: string | null
          credentials_config?: Json
          discovery_results?: Json | null
          environment_type?: string
          id?: string
          last_test?: string | null
          organization_id?: string
          test_results?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_source_connections_adapter_id_fkey"
            columns: ["adapter_id"]
            isOneToOne: false
            referencedRelation: "integration_adapters"
            referencedColumns: ["id"]
          },
        ]
      }
      digital_products: {
        Row: {
          active: boolean | null
          created_at: string
          description: string | null
          download_limit: number | null
          file_path: string | null
          id: string
          metadata: Json | null
          name: string
          price: number
          product_type: string
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          description?: string | null
          download_limit?: number | null
          file_path?: string | null
          id?: string
          metadata?: Json | null
          name: string
          price: number
          product_type: string
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          created_at?: string
          description?: string | null
          download_limit?: number | null
          file_path?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          price?: number
          product_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      disa_stigs_api_cache: {
        Row: {
          api_endpoint: string
          cache_expires_at: string
          cache_key: string
          cached_data: Json
          created_at: string
          id: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          api_endpoint: string
          cache_expires_at?: string
          cache_key: string
          cached_data?: Json
          created_at?: string
          id?: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          api_endpoint?: string
          cache_expires_at?: string
          cache_key?: string
          cached_data?: Json
          created_at?: string
          id?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      discovered_assets: {
        Row: {
          applicable_stigs: string[] | null
          asset_identifier: string
          asset_type: string
          compliance_status: Json | null
          discovered_services: Json | null
          discovery_job_id: string | null
          discovery_method: string
          first_discovered: string
          hostname: string | null
          id: string
          ip_addresses: unknown[] | null
          is_active: boolean
          last_discovered: string
          mac_addresses: string[] | null
          metadata: Json | null
          operating_system: string | null
          organization_id: string
          platform: string | null
          risk_score: number | null
          stig_version_mapping: Json | null
          system_info: Json | null
          version: string | null
        }
        Insert: {
          applicable_stigs?: string[] | null
          asset_identifier: string
          asset_type: string
          compliance_status?: Json | null
          discovered_services?: Json | null
          discovery_job_id?: string | null
          discovery_method: string
          first_discovered?: string
          hostname?: string | null
          id?: string
          ip_addresses?: unknown[] | null
          is_active?: boolean
          last_discovered?: string
          mac_addresses?: string[] | null
          metadata?: Json | null
          operating_system?: string | null
          organization_id: string
          platform?: string | null
          risk_score?: number | null
          stig_version_mapping?: Json | null
          system_info?: Json | null
          version?: string | null
        }
        Update: {
          applicable_stigs?: string[] | null
          asset_identifier?: string
          asset_type?: string
          compliance_status?: Json | null
          discovered_services?: Json | null
          discovery_job_id?: string | null
          discovery_method?: string
          first_discovered?: string
          hostname?: string | null
          id?: string
          ip_addresses?: unknown[] | null
          is_active?: boolean
          last_discovered?: string
          mac_addresses?: string[] | null
          metadata?: Json | null
          operating_system?: string | null
          organization_id?: string
          platform?: string | null
          risk_score?: number | null
          stig_version_mapping?: Json | null
          system_info?: Json | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discovered_assets_discovery_job_id_fkey"
            columns: ["discovery_job_id"]
            isOneToOne: false
            referencedRelation: "discovery_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_audit_trail: {
        Row: {
          compliance_flags: Json | null
          created_at: string
          discovery_execution_id: string | null
          event_details: Json
          event_severity: string
          event_type: string
          id: string
          nmap_command: string | null
          nmap_output: string | null
          organization_id: string
          security_context: Json | null
          source_ip: unknown
          user_id: string | null
        }
        Insert: {
          compliance_flags?: Json | null
          created_at?: string
          discovery_execution_id?: string | null
          event_details?: Json
          event_severity?: string
          event_type: string
          id?: string
          nmap_command?: string | null
          nmap_output?: string | null
          organization_id: string
          security_context?: Json | null
          source_ip?: unknown
          user_id?: string | null
        }
        Update: {
          compliance_flags?: Json | null
          created_at?: string
          discovery_execution_id?: string | null
          event_details?: Json
          event_severity?: string
          event_type?: string
          id?: string
          nmap_command?: string | null
          nmap_output?: string | null
          organization_id?: string
          security_context?: Json | null
          source_ip?: unknown
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discovery_audit_trail_discovery_execution_id_fkey"
            columns: ["discovery_execution_id"]
            isOneToOne: false
            referencedRelation: "discovery_executions"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_credentials: {
        Row: {
          created_at: string
          created_by: string | null
          credential_name: string
          credential_type: string
          encrypted_credentials: Json
          expires_at: string | null
          id: string
          is_active: boolean
          metadata: Json | null
          organization_id: string
          target_systems: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          credential_name: string
          credential_type: string
          encrypted_credentials: Json
          expires_at?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json | null
          organization_id: string
          target_systems?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          credential_name?: string
          credential_type?: string
          encrypted_credentials?: Json
          expires_at?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json | null
          organization_id?: string
          target_systems?: Json
          updated_at?: string
        }
        Relationships: []
      }
      discovery_executions: {
        Row: {
          assets_discovered: number | null
          assets_updated: number | null
          completed_at: string | null
          discovered_asset_ids: string[] | null
          discovery_job_id: string
          errors_count: number | null
          execution_log: Json | null
          execution_status: string
          id: string
          organization_id: string
          performance_metrics: Json | null
          started_at: string
        }
        Insert: {
          assets_discovered?: number | null
          assets_updated?: number | null
          completed_at?: string | null
          discovered_asset_ids?: string[] | null
          discovery_job_id: string
          errors_count?: number | null
          execution_log?: Json | null
          execution_status?: string
          id?: string
          organization_id: string
          performance_metrics?: Json | null
          started_at?: string
        }
        Update: {
          assets_discovered?: number | null
          assets_updated?: number | null
          completed_at?: string | null
          discovered_asset_ids?: string[] | null
          discovery_job_id?: string
          errors_count?: number | null
          execution_log?: Json | null
          execution_status?: string
          id?: string
          organization_id?: string
          performance_metrics?: Json | null
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discovery_executions_discovery_job_id_fkey"
            columns: ["discovery_job_id"]
            isOneToOne: false
            referencedRelation: "discovery_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_jobs: {
        Row: {
          created_at: string
          created_by: string | null
          credential_ids: string[] | null
          discovery_config: Json
          discovery_type: string
          id: string
          job_name: string
          last_run_at: string | null
          next_run_at: string | null
          organization_id: string
          schedule_config: Json | null
          status: string
          target_specification: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          credential_ids?: string[] | null
          discovery_config?: Json
          discovery_type: string
          id?: string
          job_name: string
          last_run_at?: string | null
          next_run_at?: string | null
          organization_id: string
          schedule_config?: Json | null
          status?: string
          target_specification: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          credential_ids?: string[] | null
          discovery_config?: Json
          discovery_type?: string
          id?: string
          job_name?: string
          last_run_at?: string | null
          next_run_at?: string | null
          organization_id?: string
          schedule_config?: Json | null
          status?: string
          target_specification?: Json
          updated_at?: string
        }
        Relationships: []
      }
      edr_integrations: {
        Row: {
          config: Json
          created_at: string | null
          edr_type: string
          id: string
          last_sync: string | null
          organization_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          config?: Json
          created_at?: string | null
          edr_type: string
          id?: string
          last_sync?: string | null
          organization_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          config?: Json
          created_at?: string | null
          edr_type?: string
          id?: string
          last_sync?: string | null
          organization_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      encryption_keys: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          key_metadata: Json | null
          key_name: string
          key_purpose: string
          key_version: number
          rotated_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_metadata?: Json | null
          key_name: string
          key_purpose: string
          key_version?: number
          rotated_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_metadata?: Json | null
          key_name?: string
          key_purpose?: string
          key_version?: number
          rotated_at?: string | null
        }
        Relationships: []
      }
      enhanced_open_controls_integrations: {
        Row: {
          api_endpoint: string
          authentication_method: string
          created_at: string
          data_mapping_rules: Json | null
          id: string
          integration_name: string
          is_active: boolean | null
          last_sync_timestamp: string | null
          organization_id: string
          performance_metrics: Json | null
          sync_error_log: Json | null
          sync_frequency_minutes: number | null
          sync_status: string | null
          updated_at: string
        }
        Insert: {
          api_endpoint: string
          authentication_method?: string
          created_at?: string
          data_mapping_rules?: Json | null
          id?: string
          integration_name: string
          is_active?: boolean | null
          last_sync_timestamp?: string | null
          organization_id: string
          performance_metrics?: Json | null
          sync_error_log?: Json | null
          sync_frequency_minutes?: number | null
          sync_status?: string | null
          updated_at?: string
        }
        Update: {
          api_endpoint?: string
          authentication_method?: string
          created_at?: string
          data_mapping_rules?: Json | null
          id?: string
          integration_name?: string
          is_active?: boolean | null
          last_sync_timestamp?: string | null
          organization_id?: string
          performance_metrics?: Json | null
          sync_error_log?: Json | null
          sync_frequency_minutes?: number | null
          sync_status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      enterprise_performance_analytics: {
        Row: {
          analytics_type: string
          compliance_scores: Json | null
          cost_impact_analysis: Json | null
          created_by: string | null
          generated_at: string
          id: string
          optimization_recommendations: Json | null
          organization_id: string
          performance_data: Json
          time_period_end: string
          time_period_start: string
          trend_analysis: Json | null
        }
        Insert: {
          analytics_type: string
          compliance_scores?: Json | null
          cost_impact_analysis?: Json | null
          created_by?: string | null
          generated_at?: string
          id?: string
          optimization_recommendations?: Json | null
          organization_id: string
          performance_data?: Json
          time_period_end: string
          time_period_start: string
          trend_analysis?: Json | null
        }
        Update: {
          analytics_type?: string
          compliance_scores?: Json | null
          cost_impact_analysis?: Json | null
          created_by?: string | null
          generated_at?: string
          id?: string
          optimization_recommendations?: Json | null
          organization_id?: string
          performance_data?: Json
          time_period_end?: string
          time_period_start?: string
          trend_analysis?: Json | null
        }
        Relationships: []
      }
      enterprise_schema_evolutions: {
        Row: {
          applied_at: string
          changes_applied: Json
          confidence_score: number | null
          created_by: string | null
          evolution_trigger: string
          evolution_version: string
          id: string
          organization_id: string
          performance_impact: Json | null
          rollback_available: boolean | null
          rollback_plan: Json | null
          schema_name: string
        }
        Insert: {
          applied_at?: string
          changes_applied?: Json
          confidence_score?: number | null
          created_by?: string | null
          evolution_trigger: string
          evolution_version: string
          id?: string
          organization_id: string
          performance_impact?: Json | null
          rollback_available?: boolean | null
          rollback_plan?: Json | null
          schema_name: string
        }
        Update: {
          applied_at?: string
          changes_applied?: Json
          confidence_score?: number | null
          created_by?: string | null
          evolution_trigger?: string
          evolution_version?: string
          id?: string
          organization_id?: string
          performance_impact?: Json | null
          rollback_available?: boolean | null
          rollback_plan?: Json | null
          schema_name?: string
        }
        Relationships: []
      }
      environment_assets: {
        Row: {
          asset_name: string
          asset_type: string
          compliance_status: Json | null
          created_at: string
          discovery_method: string | null
          hostname: string | null
          id: string
          ip_address: unknown
          last_scanned: string | null
          metadata: Json | null
          operating_system: string | null
          organization_id: string
          platform: string
          risk_score: number | null
          stig_applicability: Json | null
          updated_at: string
          version: string | null
        }
        Insert: {
          asset_name: string
          asset_type: string
          compliance_status?: Json | null
          created_at?: string
          discovery_method?: string | null
          hostname?: string | null
          id?: string
          ip_address?: unknown
          last_scanned?: string | null
          metadata?: Json | null
          operating_system?: string | null
          organization_id: string
          platform: string
          risk_score?: number | null
          stig_applicability?: Json | null
          updated_at?: string
          version?: string | null
        }
        Update: {
          asset_name?: string
          asset_type?: string
          compliance_status?: Json | null
          created_at?: string
          discovery_method?: string | null
          hostname?: string | null
          id?: string
          ip_address?: unknown
          last_scanned?: string | null
          metadata?: Json | null
          operating_system?: string | null
          organization_id?: string
          platform?: string
          risk_score?: number | null
          stig_applicability?: Json | null
          updated_at?: string
          version?: string | null
        }
        Relationships: []
      }
      environment_discoveries: {
        Row: {
          auto_configured: boolean | null
          confidence_score: number
          created_at: string | null
          detected_metadata: Json
          discovery_type: string
          id: string
          organization_id: string
          provider: string
          updated_at: string | null
        }
        Insert: {
          auto_configured?: boolean | null
          confidence_score: number
          created_at?: string | null
          detected_metadata?: Json
          discovery_type: string
          id?: string
          organization_id: string
          provider: string
          updated_at?: string | null
        }
        Update: {
          auto_configured?: boolean | null
          confidence_score?: number
          created_at?: string | null
          detected_metadata?: Json
          discovery_type?: string
          id?: string
          organization_id?: string
          provider?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "environment_discoveries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      escalation_rules: {
        Row: {
          created_at: string
          created_by: string | null
          enabled: boolean | null
          escalation_steps: Json
          id: string
          name: string
          severity_levels: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          enabled?: boolean | null
          escalation_steps: Json
          id?: string
          name: string
          severity_levels: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          enabled?: boolean | null
          escalation_steps?: Json
          id?: string
          name?: string
          severity_levels?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      event_processing_rules: {
        Row: {
          auto_resolve: boolean | null
          auto_tags: Json | null
          created_at: string | null
          enabled: boolean | null
          escalation_required: boolean | null
          event_type_pattern: string | null
          id: string
          priority: number | null
          rule_name: string
          severity_override: string | null
          source_pattern: string | null
          updated_at: string | null
        }
        Insert: {
          auto_resolve?: boolean | null
          auto_tags?: Json | null
          created_at?: string | null
          enabled?: boolean | null
          escalation_required?: boolean | null
          event_type_pattern?: string | null
          id?: string
          priority?: number | null
          rule_name: string
          severity_override?: string | null
          source_pattern?: string | null
          updated_at?: string | null
        }
        Update: {
          auto_resolve?: boolean | null
          auto_tags?: Json | null
          created_at?: string | null
          enabled?: boolean | null
          escalation_required?: boolean | null
          event_type_pattern?: string | null
          id?: string
          priority?: number | null
          rule_name?: string
          severity_override?: string | null
          source_pattern?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      event_sources: {
        Row: {
          api_key_hash: string | null
          auto_tag_rules: Json | null
          created_at: string | null
          enabled: boolean | null
          environment: string | null
          id: string
          ip_whitelist: unknown[] | null
          last_activity: string | null
          rate_limit_per_minute: number | null
          source_name: string
          source_type: string
          trusted: boolean | null
          updated_at: string | null
        }
        Insert: {
          api_key_hash?: string | null
          auto_tag_rules?: Json | null
          created_at?: string | null
          enabled?: boolean | null
          environment?: string | null
          id?: string
          ip_whitelist?: unknown[] | null
          last_activity?: string | null
          rate_limit_per_minute?: number | null
          source_name: string
          source_type: string
          trusted?: boolean | null
          updated_at?: string | null
        }
        Update: {
          api_key_hash?: string | null
          auto_tag_rules?: Json | null
          created_at?: string | null
          enabled?: boolean | null
          environment?: string | null
          id?: string
          ip_whitelist?: unknown[] | null
          last_activity?: string | null
          rate_limit_per_minute?: number | null
          source_name?: string
          source_type?: string
          trusted?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      evidence_bundles: {
        Row: {
          access_level: string
          bundle_hash: string
          bundle_name: string
          bundle_size_bytes: number | null
          bundle_type: string
          created_at: string
          created_by: string | null
          evidence_data: Json
          expiry_date: string | null
          id: string
          manifest: Json
          organization_id: string
          public_viewer_expires: string | null
          public_viewer_token: string | null
          scope_assets: string[] | null
          scope_controls: string[] | null
          scope_description: string | null
          scope_stig_rules: string[] | null
          signature: string | null
          signing_key_id: string | null
          storage_path: string | null
          updated_at: string
        }
        Insert: {
          access_level?: string
          bundle_hash: string
          bundle_name: string
          bundle_size_bytes?: number | null
          bundle_type?: string
          created_at?: string
          created_by?: string | null
          evidence_data?: Json
          expiry_date?: string | null
          id?: string
          manifest?: Json
          organization_id: string
          public_viewer_expires?: string | null
          public_viewer_token?: string | null
          scope_assets?: string[] | null
          scope_controls?: string[] | null
          scope_description?: string | null
          scope_stig_rules?: string[] | null
          signature?: string | null
          signing_key_id?: string | null
          storage_path?: string | null
          updated_at?: string
        }
        Update: {
          access_level?: string
          bundle_hash?: string
          bundle_name?: string
          bundle_size_bytes?: number | null
          bundle_type?: string
          created_at?: string
          created_by?: string | null
          evidence_data?: Json
          expiry_date?: string | null
          id?: string
          manifest?: Json
          organization_id?: string
          public_viewer_expires?: string | null
          public_viewer_token?: string | null
          scope_assets?: string[] | null
          scope_controls?: string[] | null
          scope_description?: string | null
          scope_stig_rules?: string[] | null
          signature?: string | null
          signing_key_id?: string | null
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      failed_login_attempts: {
        Row: {
          attempt_type: string | null
          attempted_at: string | null
          blocked_until: string | null
          email: string | null
          id: string
          ip_address: unknown
          user_agent: string | null
        }
        Insert: {
          attempt_type?: string | null
          attempted_at?: string | null
          blocked_until?: string | null
          email?: string | null
          id?: string
          ip_address?: unknown
          user_agent?: string | null
        }
        Update: {
          attempt_type?: string | null
          attempted_at?: string | null
          blocked_until?: string | null
          email?: string | null
          id?: string
          ip_address?: unknown
          user_agent?: string | null
        }
        Relationships: []
      }
      fim_baselines: {
        Row: {
          approved_by: string | null
          asset_id: string
          baseline_date: string
          baseline_metadata: Json | null
          baseline_name: string
          baseline_type: string
          created_at: string
          created_by: string | null
          expiry_date: string | null
          file_attributes: Json | null
          file_hash: string
          file_owner: string | null
          file_path: string
          file_permissions: string | null
          file_size: number | null
          id: string
          organization_id: string
          stig_rule_mappings: Json | null
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          asset_id: string
          baseline_date?: string
          baseline_metadata?: Json | null
          baseline_name: string
          baseline_type: string
          created_at?: string
          created_by?: string | null
          expiry_date?: string | null
          file_attributes?: Json | null
          file_hash: string
          file_owner?: string | null
          file_path: string
          file_permissions?: string | null
          file_size?: number | null
          id?: string
          organization_id: string
          stig_rule_mappings?: Json | null
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          asset_id?: string
          baseline_date?: string
          baseline_metadata?: Json | null
          baseline_name?: string
          baseline_type?: string
          created_at?: string
          created_by?: string | null
          expiry_date?: string | null
          file_attributes?: Json | null
          file_hash?: string
          file_owner?: string | null
          file_path?: string
          file_permissions?: string | null
          file_size?: number | null
          id?: string
          organization_id?: string
          stig_rule_mappings?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      fim_change_events: {
        Row: {
          acknowledged: boolean | null
          acknowledged_at: string | null
          acknowledged_by: string | null
          asset_id: string
          auto_remediated: boolean | null
          baseline_id: string | null
          change_details: Json
          change_type: string
          created_at: string
          current_hash: string | null
          detected_at: string
          detection_method: string
          file_path: string
          id: string
          organization_id: string
          previous_hash: string | null
          remediation_action: string | null
          risk_level: string
          stig_violations: Json | null
          threat_indicators: Json | null
        }
        Insert: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          asset_id: string
          auto_remediated?: boolean | null
          baseline_id?: string | null
          change_details?: Json
          change_type: string
          created_at?: string
          current_hash?: string | null
          detected_at?: string
          detection_method: string
          file_path: string
          id?: string
          organization_id: string
          previous_hash?: string | null
          remediation_action?: string | null
          risk_level?: string
          stig_violations?: Json | null
          threat_indicators?: Json | null
        }
        Update: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          asset_id?: string
          auto_remediated?: boolean | null
          baseline_id?: string | null
          change_details?: Json
          change_type?: string
          created_at?: string
          current_hash?: string | null
          detected_at?: string
          detection_method?: string
          file_path?: string
          id?: string
          organization_id?: string
          previous_hash?: string | null
          remediation_action?: string | null
          risk_level?: string
          stig_violations?: Json | null
          threat_indicators?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "fim_change_events_baseline_id_fkey"
            columns: ["baseline_id"]
            isOneToOne: false
            referencedRelation: "fim_baselines"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_components: {
        Row: {
          category: string
          component_name: string
          component_type: string
          configuration_schema: Json
          created_at: string
          created_by: string | null
          description: string | null
          execution_logic: Json
          id: string
          input_schema: Json | null
          is_public: boolean | null
          is_system_component: boolean | null
          organization_id: string | null
          output_schema: Json | null
          performance_benchmarks: Json | null
          stig_integration_config: Json | null
          updated_at: string
          usage_statistics: Json | null
          version: string
        }
        Insert: {
          category: string
          component_name: string
          component_type: string
          configuration_schema?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          execution_logic?: Json
          id?: string
          input_schema?: Json | null
          is_public?: boolean | null
          is_system_component?: boolean | null
          organization_id?: string | null
          output_schema?: Json | null
          performance_benchmarks?: Json | null
          stig_integration_config?: Json | null
          updated_at?: string
          usage_statistics?: Json | null
          version?: string
        }
        Update: {
          category?: string
          component_name?: string
          component_type?: string
          configuration_schema?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          execution_logic?: Json
          id?: string
          input_schema?: Json | null
          is_public?: boolean | null
          is_system_component?: boolean | null
          organization_id?: string | null
          output_schema?: Json | null
          performance_benchmarks?: Json | null
          stig_integration_config?: Json | null
          updated_at?: string
          usage_statistics?: Json | null
          version?: string
        }
        Relationships: []
      }
      flow_events: {
        Row: {
          correlation_id: string | null
          created_at: string
          error_details: Json | null
          event_data: Json
          event_type: string
          id: string
          organization_id: string
          priority: number | null
          processed_at: string | null
          processing_status: string
          retry_count: number | null
          scheduled_for: string | null
          source_flow_id: string | null
        }
        Insert: {
          correlation_id?: string | null
          created_at?: string
          error_details?: Json | null
          event_data?: Json
          event_type: string
          id?: string
          organization_id: string
          priority?: number | null
          processed_at?: string | null
          processing_status?: string
          retry_count?: number | null
          scheduled_for?: string | null
          source_flow_id?: string | null
        }
        Update: {
          correlation_id?: string | null
          created_at?: string
          error_details?: Json | null
          event_data?: Json
          event_type?: string
          id?: string
          organization_id?: string
          priority?: number | null
          processed_at?: string | null
          processing_status?: string
          retry_count?: number | null
          scheduled_for?: string | null
          source_flow_id?: string | null
        }
        Relationships: []
      }
      flow_executions: {
        Row: {
          completed_at: string | null
          created_at: string
          data_processed_count: number | null
          duration_ms: number | null
          error_details: Json | null
          execution_context: Json | null
          execution_status: string
          flow_id: string
          id: string
          organization_id: string
          performance_stats: Json | null
          started_at: string
          step_results: Json | null
          stig_compliance_results: Json | null
          trigger_data: Json | null
          trigger_type: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          data_processed_count?: number | null
          duration_ms?: number | null
          error_details?: Json | null
          execution_context?: Json | null
          execution_status?: string
          flow_id: string
          id?: string
          organization_id: string
          performance_stats?: Json | null
          started_at?: string
          step_results?: Json | null
          stig_compliance_results?: Json | null
          trigger_data?: Json | null
          trigger_type: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          data_processed_count?: number | null
          duration_ms?: number | null
          error_details?: Json | null
          execution_context?: Json | null
          execution_status?: string
          flow_id?: string
          id?: string
          organization_id?: string
          performance_stats?: Json | null
          started_at?: string
          step_results?: Json | null
          stig_compliance_results?: Json | null
          trigger_data?: Json | null
          trigger_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "flow_executions_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "integration_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      infrastructure_assets: {
        Row: {
          asset_type: string
          compliance_status: string | null
          discovered_at: string
          discovery_results: Json
          id: string
          last_updated: string
          organization_id: string
          risk_level: string | null
          target: string
        }
        Insert: {
          asset_type: string
          compliance_status?: string | null
          discovered_at?: string
          discovery_results?: Json
          id?: string
          last_updated?: string
          organization_id: string
          risk_level?: string | null
          target: string
        }
        Update: {
          asset_type?: string
          compliance_status?: string | null
          discovered_at?: string
          discovery_results?: Json
          id?: string
          last_updated?: string
          organization_id?: string
          risk_level?: string | null
          target?: string
        }
        Relationships: []
      }
      infrastructure_audit: {
        Row: {
          asset_identifier: string
          asset_type: string
          created_at: string | null
          id: string
          last_verified: string | null
          location: string
          metadata: Json | null
          organization_id: string
          security_status: string | null
          updated_at: string | null
        }
        Insert: {
          asset_identifier: string
          asset_type: string
          created_at?: string | null
          id?: string
          last_verified?: string | null
          location: string
          metadata?: Json | null
          organization_id: string
          security_status?: string | null
          updated_at?: string | null
        }
        Update: {
          asset_identifier?: string
          asset_type?: string
          created_at?: string | null
          id?: string
          last_verified?: string | null
          location?: string
          metadata?: Json | null
          organization_id?: string
          security_status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      integration_activity: {
        Row: {
          activity_type: string
          created_at: string
          details: Json | null
          duration_ms: number | null
          id: string
          integration_id: string | null
          message: string | null
          records_processed: number | null
          status: string
        }
        Insert: {
          activity_type: string
          created_at?: string
          details?: Json | null
          duration_ms?: number | null
          id?: string
          integration_id?: string | null
          message?: string | null
          records_processed?: number | null
          status: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          details?: Json | null
          duration_ms?: number | null
          id?: string
          integration_id?: string | null
          message?: string | null
          records_processed?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_activity_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integration_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_adapters: {
        Row: {
          adapter_name: string
          adapter_type: string
          authentication_config: Json
          created_at: string
          discovery_capabilities: Json
          id: string
          last_sync: string | null
          organization_id: string
          protocol_config: Json
          security_level: string
          status: string
          supported_environments: string[]
          updated_at: string
        }
        Insert: {
          adapter_name: string
          adapter_type: string
          authentication_config?: Json
          created_at?: string
          discovery_capabilities?: Json
          id?: string
          last_sync?: string | null
          organization_id: string
          protocol_config?: Json
          security_level?: string
          status?: string
          supported_environments?: string[]
          updated_at?: string
        }
        Update: {
          adapter_name?: string
          adapter_type?: string
          authentication_config?: Json
          created_at?: string
          discovery_capabilities?: Json
          id?: string
          last_sync?: string | null
          organization_id?: string
          protocol_config?: Json
          security_level?: string
          status?: string
          supported_environments?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      integration_analytics: {
        Row: {
          alerts_generated: number | null
          created_at: string
          data_volume_mb: number | null
          date: string
          events_processed: number | null
          id: string
          organization_id: string
          threats_detected: number | null
          uptime_percentage: number | null
          user_integration_id: string
        }
        Insert: {
          alerts_generated?: number | null
          created_at?: string
          data_volume_mb?: number | null
          date?: string
          events_processed?: number | null
          id?: string
          organization_id: string
          threats_detected?: number | null
          uptime_percentage?: number | null
          user_integration_id: string
        }
        Update: {
          alerts_generated?: number | null
          created_at?: string
          data_volume_mb?: number | null
          date?: string
          events_processed?: number | null
          id?: string
          organization_id?: string
          threats_detected?: number | null
          uptime_percentage?: number | null
          user_integration_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_analytics_user_integration_id_fkey"
            columns: ["user_integration_id"]
            isOneToOne: false
            referencedRelation: "user_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_configs: {
        Row: {
          config: Json
          created_at: string
          created_by: string | null
          credentials_stored: boolean | null
          description: string | null
          enabled: boolean | null
          error_message: string | null
          health_status: string | null
          id: string
          integration_type: string
          last_health_check: string | null
          last_sync: string | null
          name: string
          organization_id: string
          provider: string
          retry_count: number | null
          status: string | null
          sync_frequency_minutes: number | null
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          created_by?: string | null
          credentials_stored?: boolean | null
          description?: string | null
          enabled?: boolean | null
          error_message?: string | null
          health_status?: string | null
          id?: string
          integration_type: string
          last_health_check?: string | null
          last_sync?: string | null
          name: string
          organization_id: string
          provider: string
          retry_count?: number | null
          status?: string | null
          sync_frequency_minutes?: number | null
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string | null
          credentials_stored?: boolean | null
          description?: string | null
          enabled?: boolean | null
          error_message?: string | null
          health_status?: string | null
          id?: string
          integration_type?: string
          last_health_check?: string | null
          last_sync?: string | null
          name?: string
          organization_id?: string
          provider?: string
          retry_count?: number | null
          status?: string | null
          sync_frequency_minutes?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      integration_data_flows: {
        Row: {
          created_at: string
          data_type: string
          destination_system: string
          flow_rate_per_hour: number | null
          id: string
          integration_id: string | null
          last_data_received: string | null
          source_system: string
          total_records: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_type: string
          destination_system: string
          flow_rate_per_hour?: number | null
          id?: string
          integration_id?: string | null
          last_data_received?: string | null
          source_system: string
          total_records?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_type?: string
          destination_system?: string
          flow_rate_per_hour?: number | null
          id?: string
          integration_id?: string | null
          last_data_received?: string | null
          source_system?: string
          total_records?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_data_flows_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integration_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_flows: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          error_handling_config: Json | null
          execution_schedule: Json | null
          flow_definition: Json
          flow_name: string
          flow_type: string
          id: string
          is_template: boolean | null
          organization_id: string
          performance_metrics: Json | null
          status: string
          stig_compliance_config: Json | null
          template_category: string | null
          trigger_conditions: Json | null
          updated_at: string
          version: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          error_handling_config?: Json | null
          execution_schedule?: Json | null
          flow_definition?: Json
          flow_name: string
          flow_type?: string
          id?: string
          is_template?: boolean | null
          organization_id: string
          performance_metrics?: Json | null
          status?: string
          stig_compliance_config?: Json | null
          template_category?: string | null
          trigger_conditions?: Json | null
          updated_at?: string
          version?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          error_handling_config?: Json | null
          execution_schedule?: Json | null
          flow_definition?: Json
          flow_name?: string
          flow_type?: string
          id?: string
          is_template?: boolean | null
          organization_id?: string
          performance_metrics?: Json | null
          status?: string
          stig_compliance_config?: Json | null
          template_category?: string | null
          trigger_conditions?: Json | null
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      integration_patterns: {
        Row: {
          authentication_method: string | null
          auto_generated: boolean | null
          compliance_requirements: Json | null
          created_at: string | null
          data_mapping: Json | null
          id: string
          learned_optimizations: Json | null
          organization_id: string
          pattern_name: string
          performance_metrics: Json | null
          source_system: string
          success_rate: number | null
          target_system: string
          updated_at: string | null
        }
        Insert: {
          authentication_method?: string | null
          auto_generated?: boolean | null
          compliance_requirements?: Json | null
          created_at?: string | null
          data_mapping?: Json | null
          id?: string
          learned_optimizations?: Json | null
          organization_id: string
          pattern_name: string
          performance_metrics?: Json | null
          source_system: string
          success_rate?: number | null
          target_system: string
          updated_at?: string | null
        }
        Update: {
          authentication_method?: string | null
          auto_generated?: boolean | null
          compliance_requirements?: Json | null
          created_at?: string | null
          data_mapping?: Json | null
          id?: string
          learned_optimizations?: Json | null
          organization_id?: string
          pattern_name?: string
          performance_metrics?: Json | null
          source_system?: string
          success_rate?: number | null
          target_system?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_patterns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_tickets: {
        Row: {
          approved_at: string | null
          approver_id: string | null
          completed_at: string | null
          created_at: string
          description: string
          id: string
          integration_id: string
          justification: string | null
          organization_id: string
          priority: string
          rejection_reason: string | null
          requested_config: Json | null
          status: string
          ticket_type: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approver_id?: string | null
          completed_at?: string | null
          created_at?: string
          description: string
          id?: string
          integration_id: string
          justification?: string | null
          organization_id: string
          priority?: string
          rejection_reason?: string | null
          requested_config?: Json | null
          status?: string
          ticket_type: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approver_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string
          id?: string
          integration_id?: string
          justification?: string | null
          organization_id?: string
          priority?: string
          rejection_reason?: string | null
          requested_config?: Json | null
          status?: string
          ticket_type?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_tickets_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations_library"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations_library: {
        Row: {
          auth_type: string
          category: string
          compliance_standards: Json | null
          created_at: string
          description: string
          documentation_url: string | null
          id: string
          is_dod_approved: boolean | null
          is_popular: boolean | null
          logo_url: string | null
          name: string
          provider: string
          required_fields: Json
          supported_data_types: Json
          updated_at: string
        }
        Insert: {
          auth_type: string
          category: string
          compliance_standards?: Json | null
          created_at?: string
          description: string
          documentation_url?: string | null
          id?: string
          is_dod_approved?: boolean | null
          is_popular?: boolean | null
          logo_url?: string | null
          name: string
          provider: string
          required_fields?: Json
          supported_data_types?: Json
          updated_at?: string
        }
        Update: {
          auth_type?: string
          category?: string
          compliance_standards?: Json | null
          created_at?: string
          description?: string
          documentation_url?: string | null
          id?: string
          is_dod_approved?: boolean | null
          is_popular?: boolean | null
          logo_url?: string | null
          name?: string
          provider?: string
          required_fields?: Json
          supported_data_types?: Json
          updated_at?: string
        }
        Relationships: []
      }
      legal_document_audit: {
        Row: {
          action: string
          created_at: string
          document_id: string
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          document_id: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          document_id?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_document_audit_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "legal_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_document_permissions: {
        Row: {
          document_id: string
          expires_at: string | null
          granted_at: string
          granted_by: string
          id: string
          permission_type: string
          role: string | null
          user_id: string | null
        }
        Insert: {
          document_id: string
          expires_at?: string | null
          granted_at?: string
          granted_by: string
          id?: string
          permission_type: string
          role?: string | null
          user_id?: string | null
        }
        Update: {
          document_id?: string
          expires_at?: string | null
          granted_at?: string
          granted_by?: string
          id?: string
          permission_type?: string
          role?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "legal_document_permissions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "legal_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_documents: {
        Row: {
          access_level: string
          content: string
          created_at: string
          created_by: string
          document_type: string
          file_path: string | null
          file_size: number | null
          id: string
          metadata: Json | null
          mime_type: string | null
          organization_id: string
          status: string
          title: string
          updated_at: string
          updated_by: string | null
          version: string
        }
        Insert: {
          access_level?: string
          content: string
          created_at?: string
          created_by: string
          document_type: string
          file_path?: string | null
          file_size?: number | null
          id?: string
          metadata?: Json | null
          mime_type?: string | null
          organization_id: string
          status?: string
          title: string
          updated_at?: string
          updated_by?: string | null
          version?: string
        }
        Update: {
          access_level?: string
          content?: string
          created_at?: string
          created_by?: string
          document_type?: string
          file_path?: string | null
          file_size?: number | null
          id?: string
          metadata?: Json | null
          mime_type?: string | null
          organization_id?: string
          status?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      live_api_gateway_requests: {
        Row: {
          api_endpoint: string
          error_details: Json | null
          id: string
          ip_address: unknown
          organization_id: string
          request_id: string
          request_method: string
          request_payload: Json | null
          request_timestamp: string
          response_data: Json | null
          response_status: number
          response_time_ms: number
          user_agent: string | null
        }
        Insert: {
          api_endpoint: string
          error_details?: Json | null
          id?: string
          ip_address?: unknown
          organization_id: string
          request_id: string
          request_method: string
          request_payload?: Json | null
          request_timestamp?: string
          response_data?: Json | null
          response_status: number
          response_time_ms: number
          user_agent?: string | null
        }
        Update: {
          api_endpoint?: string
          error_details?: Json | null
          id?: string
          ip_address?: unknown
          organization_id?: string
          request_id?: string
          request_method?: string
          request_payload?: Json | null
          request_timestamp?: string
          response_data?: Json | null
          response_status?: number
          response_time_ms?: number
          user_agent?: string | null
        }
        Relationships: []
      }
      maintenance_windows: {
        Row: {
          affected_assets: string[] | null
          approval_required: boolean
          asset_tags: Json | null
          created_at: string
          created_by: string | null
          description: string | null
          end_time: string
          id: string
          max_concurrent_operations: number | null
          organization_id: string
          recurrence_pattern: string | null
          start_time: string
          status: string
          updated_at: string
          window_name: string
          window_type: string
        }
        Insert: {
          affected_assets?: string[] | null
          approval_required?: boolean
          asset_tags?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_time: string
          id?: string
          max_concurrent_operations?: number | null
          organization_id: string
          recurrence_pattern?: string | null
          start_time: string
          status?: string
          updated_at?: string
          window_name: string
          window_type?: string
        }
        Update: {
          affected_assets?: string[] | null
          approval_required?: boolean
          asset_tags?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_time?: string
          id?: string
          max_concurrent_operations?: number | null
          organization_id?: string
          recurrence_pattern?: string | null
          start_time?: string
          status?: string
          updated_at?: string
          window_name?: string
          window_type?: string
        }
        Relationships: []
      }
      master_data_models: {
        Row: {
          compliance_requirements: Json | null
          created_at: string
          domain: string
          id: string
          is_standard: boolean | null
          model_name: string
          model_type: string
          schema_definition: Json
          stig_mappings: Json | null
          transformation_templates: Json | null
          updated_at: string
          validation_rules: Json | null
          version: string
        }
        Insert: {
          compliance_requirements?: Json | null
          created_at?: string
          domain: string
          id?: string
          is_standard?: boolean | null
          model_name: string
          model_type: string
          schema_definition: Json
          stig_mappings?: Json | null
          transformation_templates?: Json | null
          updated_at?: string
          validation_rules?: Json | null
          version?: string
        }
        Update: {
          compliance_requirements?: Json | null
          created_at?: string
          domain?: string
          id?: string
          is_standard?: boolean | null
          model_name?: string
          model_type?: string
          schema_definition?: Json
          stig_mappings?: Json | null
          transformation_templates?: Json | null
          updated_at?: string
          validation_rules?: Json | null
          version?: string
        }
        Relationships: []
      }
      ml_training_datasets: {
        Row: {
          created_at: string
          data_freshness: string | null
          data_source: string
          dataset_name: string
          dataset_type: string
          id: string
          is_active: boolean | null
          model_metadata: Json | null
          organization_id: string
          quality_score: number | null
          training_data: Json
          updated_at: string
          validation_data: Json | null
        }
        Insert: {
          created_at?: string
          data_freshness?: string | null
          data_source: string
          dataset_name: string
          dataset_type: string
          id?: string
          is_active?: boolean | null
          model_metadata?: Json | null
          organization_id: string
          quality_score?: number | null
          training_data?: Json
          updated_at?: string
          validation_data?: Json | null
        }
        Update: {
          created_at?: string
          data_freshness?: string | null
          data_source?: string
          dataset_name?: string
          dataset_type?: string
          id?: string
          is_active?: boolean | null
          model_metadata?: Json | null
          organization_id?: string
          quality_score?: number | null
          training_data?: Json
          updated_at?: string
          validation_data?: Json | null
        }
        Relationships: []
      }
      monday_integration_config: {
        Row: {
          api_token_hash: string
          board_mappings: Json
          created_at: string | null
          id: string
          is_active: boolean | null
          last_sync_at: string | null
          organization_id: string
          sync_preferences: Json
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          api_token_hash: string
          board_mappings?: Json
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          organization_id: string
          sync_preferences?: Json
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          api_token_hash?: string
          board_mappings?: Json
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          organization_id?: string
          sync_preferences?: Json
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "monday_integration_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      monday_item_mappings: {
        Row: {
          created_at: string | null
          id: string
          last_synced_at: string | null
          local_entity_id: string
          local_entity_type: string
          monday_board_id: string
          monday_item_id: string
          organization_id: string
          sync_status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_synced_at?: string | null
          local_entity_id: string
          local_entity_type: string
          monday_board_id: string
          monday_item_id: string
          organization_id: string
          sync_status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          last_synced_at?: string | null
          local_entity_id?: string
          local_entity_type?: string
          monday_board_id?: string
          monday_item_id?: string
          organization_id?: string
          sync_status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "monday_item_mappings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      monday_sync_history: {
        Row: {
          created_at: string | null
          entity_id: string | null
          entity_type: string
          error_message: string | null
          id: string
          monday_board_id: string | null
          monday_item_id: string | null
          operation: string
          organization_id: string
          status: string
          sync_data: Json | null
          sync_type: string
        }
        Insert: {
          created_at?: string | null
          entity_id?: string | null
          entity_type: string
          error_message?: string | null
          id?: string
          monday_board_id?: string | null
          monday_item_id?: string | null
          operation: string
          organization_id: string
          status?: string
          sync_data?: Json | null
          sync_type: string
        }
        Update: {
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string
          error_message?: string | null
          id?: string
          monday_board_id?: string | null
          monday_item_id?: string | null
          operation?: string
          organization_id?: string
          status?: string
          sync_data?: Json | null
          sync_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "monday_sync_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      network_monitoring: {
        Row: {
          bytes_transferred: number | null
          connection_state: string | null
          destination_ip: unknown
          destination_port: number | null
          detected_at: string | null
          geolocation: Json | null
          id: string
          metadata: Json | null
          organization_id: string
          packets_count: number | null
          protocol: string
          source_ip: unknown
          source_port: number | null
          threat_score: number | null
        }
        Insert: {
          bytes_transferred?: number | null
          connection_state?: string | null
          destination_ip: unknown
          destination_port?: number | null
          detected_at?: string | null
          geolocation?: Json | null
          id?: string
          metadata?: Json | null
          organization_id: string
          packets_count?: number | null
          protocol: string
          source_ip: unknown
          source_port?: number | null
          threat_score?: number | null
        }
        Update: {
          bytes_transferred?: number | null
          connection_state?: string | null
          destination_ip?: unknown
          destination_port?: number | null
          detected_at?: string | null
          geolocation?: Json | null
          id?: string
          metadata?: Json | null
          organization_id?: string
          packets_count?: number | null
          protocol?: string
          source_ip?: unknown
          source_port?: number | null
          threat_score?: number | null
        }
        Relationships: []
      }
      nist_controls: {
        Row: {
          assessment_procedures: string | null
          automation_possible: boolean | null
          automation_query: string | null
          baseline_high: boolean | null
          baseline_low: boolean | null
          baseline_moderate: boolean | null
          baseline_privacy: boolean | null
          cmmc_mappings: Json | null
          control_id: string
          control_type: string
          created_at: string
          description: string
          family: string
          id: string
          implementation_guidance: string | null
          priority: string
          related_controls: string[] | null
          required_evidence: string[] | null
          stig_mappings: Json | null
          title: string
          updated_at: string
        }
        Insert: {
          assessment_procedures?: string | null
          automation_possible?: boolean | null
          automation_query?: string | null
          baseline_high?: boolean | null
          baseline_low?: boolean | null
          baseline_moderate?: boolean | null
          baseline_privacy?: boolean | null
          cmmc_mappings?: Json | null
          control_id: string
          control_type?: string
          created_at?: string
          description: string
          family: string
          id?: string
          implementation_guidance?: string | null
          priority?: string
          related_controls?: string[] | null
          required_evidence?: string[] | null
          stig_mappings?: Json | null
          title: string
          updated_at?: string
        }
        Update: {
          assessment_procedures?: string | null
          automation_possible?: boolean | null
          automation_query?: string | null
          baseline_high?: boolean | null
          baseline_low?: boolean | null
          baseline_moderate?: boolean | null
          baseline_privacy?: boolean | null
          cmmc_mappings?: Json | null
          control_id?: string
          control_type?: string
          created_at?: string
          description?: string
          family?: string
          id?: string
          implementation_guidance?: string | null
          priority?: string
          related_controls?: string[] | null
          required_evidence?: string[] | null
          stig_mappings?: Json | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      nmap_scan_results: {
        Row: {
          created_at: string
          discovered_hosts_count: number | null
          discovery_execution_id: string | null
          id: string
          json_summary: Json | null
          nmap_version: string | null
          open_ports_count: number | null
          organization_id: string
          os_fingerprints: Json | null
          performance_metrics: Json | null
          scan_completed_at: string | null
          scan_started_at: string
          scan_type: string
          script_results: Json | null
          security_violations: Json | null
          services_detected: Json | null
          target_specification: Json
          vulnerabilities_detected: Json | null
          xml_output: string | null
        }
        Insert: {
          created_at?: string
          discovered_hosts_count?: number | null
          discovery_execution_id?: string | null
          id?: string
          json_summary?: Json | null
          nmap_version?: string | null
          open_ports_count?: number | null
          organization_id: string
          os_fingerprints?: Json | null
          performance_metrics?: Json | null
          scan_completed_at?: string | null
          scan_started_at: string
          scan_type: string
          script_results?: Json | null
          security_violations?: Json | null
          services_detected?: Json | null
          target_specification: Json
          vulnerabilities_detected?: Json | null
          xml_output?: string | null
        }
        Update: {
          created_at?: string
          discovered_hosts_count?: number | null
          discovery_execution_id?: string | null
          id?: string
          json_summary?: Json | null
          nmap_version?: string | null
          open_ports_count?: number | null
          organization_id?: string
          os_fingerprints?: Json | null
          performance_metrics?: Json | null
          scan_completed_at?: string | null
          scan_started_at?: string
          scan_type?: string
          script_results?: Json | null
          security_violations?: Json | null
          services_detected?: Json | null
          target_specification?: Json
          vulnerabilities_detected?: Json | null
          xml_output?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nmap_scan_results_discovery_execution_id_fkey"
            columns: ["discovery_execution_id"]
            isOneToOne: false
            referencedRelation: "discovery_executions"
            referencedColumns: ["id"]
          },
        ]
      }
      normalized_stig_rules: {
        Row: {
          automation_available: boolean | null
          automation_script: Json | null
          cci_references: string[] | null
          check_content: string | null
          check_system: string | null
          created_at: string
          description: string | null
          fix_text: string | null
          id: string
          nist_controls: string[] | null
          platform_applicability: Json | null
          rule_id: string
          severity: string
          stig_feed_id: string | null
          title: string
          updated_at: string
          version: string
        }
        Insert: {
          automation_available?: boolean | null
          automation_script?: Json | null
          cci_references?: string[] | null
          check_content?: string | null
          check_system?: string | null
          created_at?: string
          description?: string | null
          fix_text?: string | null
          id?: string
          nist_controls?: string[] | null
          platform_applicability?: Json | null
          rule_id: string
          severity: string
          stig_feed_id?: string | null
          title: string
          updated_at?: string
          version: string
        }
        Update: {
          automation_available?: boolean | null
          automation_script?: Json | null
          cci_references?: string[] | null
          check_content?: string | null
          check_system?: string | null
          created_at?: string
          description?: string | null
          fix_text?: string | null
          id?: string
          nist_controls?: string[] | null
          platform_applicability?: Json | null
          rule_id?: string
          severity?: string
          stig_feed_id?: string | null
          title?: string
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          alert_id: string | null
          channel: string
          created_at: string
          data_classification: string | null
          delivered_at: string | null
          error_message: string | null
          external_id: string | null
          id: string
          message_content: Json | null
          recipient_email: string | null
          recipient_id: string | null
          recipient_phone: string | null
          sent_at: string | null
          status: string
        }
        Insert: {
          alert_id?: string | null
          channel: string
          created_at?: string
          data_classification?: string | null
          delivered_at?: string | null
          error_message?: string | null
          external_id?: string | null
          id?: string
          message_content?: Json | null
          recipient_email?: string | null
          recipient_id?: string | null
          recipient_phone?: string | null
          sent_at?: string | null
          status?: string
        }
        Update: {
          alert_id?: string | null
          channel?: string
          created_at?: string
          data_classification?: string | null
          delivered_at?: string | null
          error_message?: string | null
          external_id?: string | null
          id?: string
          message_content?: Json | null
          recipient_email?: string | null
          recipient_id?: string | null
          recipient_phone?: string | null
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_checklist_items: {
        Row: {
          completed: boolean | null
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          evidence_links: Json | null
          id: string
          item_description: string | null
          item_name: string
          notes: string | null
          onboarding_id: string
          phase: string
          required: boolean | null
        }
        Insert: {
          completed?: boolean | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          evidence_links?: Json | null
          id?: string
          item_description?: string | null
          item_name: string
          notes?: string | null
          onboarding_id: string
          phase: string
          required?: boolean | null
        }
        Update: {
          completed?: boolean | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          evidence_links?: Json | null
          id?: string
          item_description?: string | null
          item_name?: string
          notes?: string | null
          onboarding_id?: string
          phase?: string
          required?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_checklist_items_onboarding_id_fkey"
            columns: ["onboarding_id"]
            isOneToOne: false
            referencedRelation: "organization_onboarding"
            referencedColumns: ["id"]
          },
        ]
      }
      one_time_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          metadata: Json | null
          payment_type: string
          status: string
          stripe_session_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          metadata?: Json | null
          payment_type: string
          status?: string
          stripe_session_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          metadata?: Json | null
          payment_type?: string
          status?: string
          stripe_session_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      open_controls_integrations: {
        Row: {
          api_endpoint: string
          authentication_config: Json
          available_stigs: string[] | null
          created_at: string
          id: string
          last_sync_at: string | null
          organization_id: string
          sync_errors: Json | null
          sync_frequency_hours: number | null
          sync_status: string
          updated_at: string
        }
        Insert: {
          api_endpoint: string
          authentication_config?: Json
          available_stigs?: string[] | null
          created_at?: string
          id?: string
          last_sync_at?: string | null
          organization_id: string
          sync_errors?: Json | null
          sync_frequency_hours?: number | null
          sync_status?: string
          updated_at?: string
        }
        Update: {
          api_endpoint?: string
          authentication_config?: Json
          available_stigs?: string[] | null
          created_at?: string
          id?: string
          last_sync_at?: string | null
          organization_id?: string
          sync_errors?: Json | null
          sync_frequency_hours?: number | null
          sync_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_open_controls_org"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      open_controls_performance_metrics: {
        Row: {
          alert_threshold_exceeded: boolean | null
          created_at: string
          id: string
          measurement_timestamp: string
          metric_metadata: Json
          metric_name: string
          metric_type: string
          metric_value: number
          organization_id: string
          performance_trend: string | null
        }
        Insert: {
          alert_threshold_exceeded?: boolean | null
          created_at?: string
          id?: string
          measurement_timestamp?: string
          metric_metadata?: Json
          metric_name: string
          metric_type: string
          metric_value?: number
          organization_id: string
          performance_trend?: string | null
        }
        Update: {
          alert_threshold_exceeded?: boolean | null
          created_at?: string
          id?: string
          measurement_timestamp?: string
          metric_metadata?: Json
          metric_name?: string
          metric_type?: string
          metric_value?: number
          organization_id?: string
          performance_trend?: string | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string | null
          id: string
          order_id: string
          price_at_purchase: number
          product_id: string
          quantity: number
          subtotal: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          order_id: string
          price_at_purchase: number
          product_id: string
          quantity: number
          subtotal: number
        }
        Update: {
          created_at?: string | null
          id?: string
          order_id?: string
          price_at_purchase?: number
          product_id?: string
          quantity?: number
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          billing_address: Json | null
          cancelled_at: string | null
          created_at: string | null
          currency: string | null
          customer_email: string
          customer_phone: string | null
          delivered_at: string | null
          discount_amount: number | null
          fulfillment_status: string
          id: string
          notes: string | null
          order_number: string
          order_status: string
          organization_id: string
          paid_at: string | null
          payment_method: string | null
          payment_status: string
          shipped_at: string | null
          shipping_address: Json
          shipping_amount: number | null
          shipping_method: string | null
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          subtotal: number
          tax_amount: number | null
          total_amount: number
          tracking_number: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          billing_address?: Json | null
          cancelled_at?: string | null
          created_at?: string | null
          currency?: string | null
          customer_email: string
          customer_phone?: string | null
          delivered_at?: string | null
          discount_amount?: number | null
          fulfillment_status?: string
          id?: string
          notes?: string | null
          order_number: string
          order_status?: string
          organization_id: string
          paid_at?: string | null
          payment_method?: string | null
          payment_status?: string
          shipped_at?: string | null
          shipping_address: Json
          shipping_amount?: number | null
          shipping_method?: string | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          subtotal: number
          tax_amount?: number | null
          total_amount: number
          tracking_number?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          billing_address?: Json | null
          cancelled_at?: string | null
          created_at?: string | null
          currency?: string | null
          customer_email?: string
          customer_phone?: string | null
          delivered_at?: string | null
          discount_amount?: number | null
          fulfillment_status?: string
          id?: string
          notes?: string | null
          order_number?: string
          order_status?: string
          organization_id?: string
          paid_at?: string | null
          payment_method?: string | null
          payment_status?: string
          shipped_at?: string | null
          shipping_address?: Json
          shipping_amount?: number | null
          shipping_method?: string | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          subtotal?: number
          tax_amount?: number | null
          total_amount?: number
          tracking_number?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_integrations: {
        Row: {
          authentication_data: Json
          configuration: Json
          created_at: string | null
          created_by: string | null
          error_message: string | null
          id: string
          integration_name: string
          integration_type: string
          is_active: boolean | null
          last_sync: string | null
          organization_id: string
          sync_settings: Json | null
          sync_status: string | null
          updated_at: string | null
          webhook_endpoints: Json | null
        }
        Insert: {
          authentication_data: Json
          configuration: Json
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          id?: string
          integration_name: string
          integration_type: string
          is_active?: boolean | null
          last_sync?: string | null
          organization_id: string
          sync_settings?: Json | null
          sync_status?: string | null
          updated_at?: string | null
          webhook_endpoints?: Json | null
        }
        Update: {
          authentication_data?: Json
          configuration?: Json
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          id?: string
          integration_name?: string
          integration_type?: string
          is_active?: boolean | null
          last_sync?: string | null
          organization_id?: string
          sync_settings?: Json | null
          sync_status?: string | null
          updated_at?: string | null
          webhook_endpoints?: Json | null
        }
        Relationships: []
      }
      organization_onboarding: {
        Row: {
          assigned_lead: string | null
          completed_at: string | null
          created_at: string | null
          current_phase: string
          discovery_results: Json | null
          id: string
          intake_data: Json | null
          integration_config: Json | null
          milestones: Json | null
          organization_id: string
          phase_status: Json
          started_at: string | null
          technical_lead: string | null
          training_progress: Json | null
          updated_at: string | null
        }
        Insert: {
          assigned_lead?: string | null
          completed_at?: string | null
          created_at?: string | null
          current_phase?: string
          discovery_results?: Json | null
          id?: string
          intake_data?: Json | null
          integration_config?: Json | null
          milestones?: Json | null
          organization_id: string
          phase_status?: Json
          started_at?: string | null
          technical_lead?: string | null
          training_progress?: Json | null
          updated_at?: string | null
        }
        Update: {
          assigned_lead?: string | null
          completed_at?: string | null
          created_at?: string | null
          current_phase?: string
          discovery_results?: Json | null
          id?: string
          intake_data?: Json | null
          integration_config?: Json | null
          milestones?: Json | null
          organization_id?: string
          phase_status?: Json
          started_at?: string | null
          technical_lead?: string | null
          training_progress?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_onboarding_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_settings: {
        Row: {
          created_at: string | null
          id: string
          mfa_policy: Json | null
          organization_id: string | null
          security_policies: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          mfa_policy?: Json | null
          organization_id?: string | null
          security_policies?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          mfa_policy?: Json | null
          organization_id?: string | null
          security_policies?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          domain: string | null
          id: string
          logo_url: string | null
          max_storage_gb: number | null
          max_users: number | null
          name: string
          settings: Json | null
          slug: string
          subscription_tier: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          domain?: string | null
          id?: string
          logo_url?: string | null
          max_storage_gb?: number | null
          max_users?: number | null
          name: string
          settings?: Json | null
          slug: string
          subscription_tier?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          domain?: string | null
          id?: string
          logo_url?: string | null
          max_storage_gb?: number | null
          max_users?: number | null
          name?: string
          settings?: Json | null
          slug?: string
          subscription_tier?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      password_reset_otps: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          otp_code: string
          used: boolean
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          id?: string
          otp_code: string
          used?: boolean
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          otp_code?: string
          used?: boolean
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      performance_metrics: {
        Row: {
          id: string
          metadata: Json | null
          metric_name: string
          metric_type: string
          organization_id: string
          recorded_at: string | null
          value: number
        }
        Insert: {
          id?: string
          metadata?: Json | null
          metric_name: string
          metric_type: string
          organization_id: string
          recorded_at?: string | null
          value: number
        }
        Update: {
          id?: string
          metadata?: Json | null
          metric_name?: string
          metric_type?: string
          organization_id?: string
          recorded_at?: string | null
          value?: number
        }
        Relationships: []
      }
      polymorphic_apis: {
        Row: {
          api_name: string
          authentication: Json | null
          auto_evolution_enabled: boolean | null
          created_at: string | null
          endpoints: Json | null
          evolution_stage: string
          id: string
          learning_metadata: Json | null
          organization_id: string
          palantir_advantage: number | null
          performance_score: number | null
          rate_limits: Json | null
          stig_validations: Json | null
          updated_at: string | null
          version: string
        }
        Insert: {
          api_name: string
          authentication?: Json | null
          auto_evolution_enabled?: boolean | null
          created_at?: string | null
          endpoints?: Json | null
          evolution_stage?: string
          id?: string
          learning_metadata?: Json | null
          organization_id: string
          palantir_advantage?: number | null
          performance_score?: number | null
          rate_limits?: Json | null
          stig_validations?: Json | null
          updated_at?: string | null
          version?: string
        }
        Update: {
          api_name?: string
          authentication?: Json | null
          auto_evolution_enabled?: boolean | null
          created_at?: string | null
          endpoints?: Json | null
          evolution_stage?: string
          id?: string
          learning_metadata?: Json | null
          organization_id?: string
          palantir_advantage?: number | null
          performance_score?: number | null
          rate_limits?: Json | null
          stig_validations?: Json | null
          updated_at?: string | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "polymorphic_apis_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          parent_category_id: string | null
          seo_description: string | null
          seo_keywords: string[] | null
          seo_title: string | null
          slug: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          parent_category_id?: string | null
          seo_description?: string | null
          seo_keywords?: string[] | null
          seo_title?: string | null
          slug: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          parent_category_id?: string | null
          seo_description?: string | null
          seo_keywords?: string[] | null
          seo_title?: string | null
          slug?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_parent_category_id_fkey"
            columns: ["parent_category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          alt_text: string | null
          created_at: string | null
          id: string
          image_url: string
          is_primary: boolean | null
          product_id: string
          sort_order: number | null
        }
        Insert: {
          alt_text?: string | null
          created_at?: string | null
          id?: string
          image_url: string
          is_primary?: boolean | null
          product_id: string
          sort_order?: number | null
        }
        Update: {
          alt_text?: string | null
          created_at?: string | null
          id?: string
          image_url?: string
          is_primary?: boolean | null
          product_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          compare_at_price: number | null
          cost_price: number | null
          created_at: string | null
          currency: string | null
          datasheet_url: string | null
          dimensions_inches: string | null
          features: string[] | null
          full_description: string | null
          id: string
          inventory_quantity: number | null
          is_active: boolean | null
          is_featured: boolean | null
          long_description: string | null
          low_stock_threshold: number | null
          manufacturer: string | null
          manufacturer_part_number: string | null
          name: string
          organization_id: string
          price: number
          seo_description: string | null
          seo_keywords: string[] | null
          seo_title: string | null
          short_description: string | null
          sku: string
          slug: string
          sort_order: number | null
          specifications: Json | null
          stock_status: string | null
          updated_at: string | null
          warranty_info: string | null
          weight_lbs: number | null
        }
        Insert: {
          category_id?: string | null
          compare_at_price?: number | null
          cost_price?: number | null
          created_at?: string | null
          currency?: string | null
          datasheet_url?: string | null
          dimensions_inches?: string | null
          features?: string[] | null
          full_description?: string | null
          id?: string
          inventory_quantity?: number | null
          is_active?: boolean | null
          is_featured?: boolean | null
          long_description?: string | null
          low_stock_threshold?: number | null
          manufacturer?: string | null
          manufacturer_part_number?: string | null
          name: string
          organization_id: string
          price: number
          seo_description?: string | null
          seo_keywords?: string[] | null
          seo_title?: string | null
          short_description?: string | null
          sku: string
          slug: string
          sort_order?: number | null
          specifications?: Json | null
          stock_status?: string | null
          updated_at?: string | null
          warranty_info?: string | null
          weight_lbs?: number | null
        }
        Update: {
          category_id?: string | null
          compare_at_price?: number | null
          cost_price?: number | null
          created_at?: string | null
          currency?: string | null
          datasheet_url?: string | null
          dimensions_inches?: string | null
          features?: string[] | null
          full_description?: string | null
          id?: string
          inventory_quantity?: number | null
          is_active?: boolean | null
          is_featured?: boolean | null
          long_description?: string | null
          low_stock_threshold?: number | null
          manufacturer?: string | null
          manufacturer_part_number?: string | null
          name?: string
          organization_id?: string
          price?: number
          seo_description?: string | null
          seo_keywords?: string[] | null
          seo_title?: string | null
          short_description?: string | null
          sku?: string
          slug?: string
          sort_order?: number | null
          specifications?: Json | null
          stock_status?: string | null
          updated_at?: string | null
          warranty_info?: string | null
          weight_lbs?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          data_classification: string | null
          department: string | null
          emergency_access_codes: string[] | null
          full_name: string | null
          id: string
          is_trial_active: boolean | null
          master_admin: boolean | null
          mfa_backup_codes: string[] | null
          mfa_enabled: boolean | null
          plan_type: string | null
          role: string | null
          security_clearance: string | null
          trial_ends_at: string | null
          trial_starts_at: string | null
          trusted_devices: Json | null
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          created_at?: string
          data_classification?: string | null
          department?: string | null
          emergency_access_codes?: string[] | null
          full_name?: string | null
          id?: string
          is_trial_active?: boolean | null
          master_admin?: boolean | null
          mfa_backup_codes?: string[] | null
          mfa_enabled?: boolean | null
          plan_type?: string | null
          role?: string | null
          security_clearance?: string | null
          trial_ends_at?: string | null
          trial_starts_at?: string | null
          trusted_devices?: Json | null
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          created_at?: string
          data_classification?: string | null
          department?: string | null
          emergency_access_codes?: string[] | null
          full_name?: string | null
          id?: string
          is_trial_active?: boolean | null
          master_admin?: boolean | null
          mfa_backup_codes?: string[] | null
          mfa_enabled?: boolean | null
          plan_type?: string | null
          role?: string | null
          security_clearance?: string | null
          trial_ends_at?: string | null
          trial_starts_at?: string | null
          trusted_devices?: Json | null
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      referrals: {
        Row: {
          conversion_date: string | null
          created_at: string
          id: string
          referral_code: string
          referred_user_id: string | null
          referrer_user_id: string | null
          reward_amount: number | null
          reward_type: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          conversion_date?: string | null
          created_at?: string
          id?: string
          referral_code: string
          referred_user_id?: string | null
          referrer_user_id?: string | null
          reward_amount?: number | null
          reward_type?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          conversion_date?: string | null
          created_at?: string
          id?: string
          referral_code?: string
          referred_user_id?: string | null
          referrer_user_id?: string | null
          reward_amount?: number | null
          reward_type?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      remediation_activities: {
        Row: {
          action_type: string
          dry_run: boolean | null
          executed_at: string
          execution_status: string | null
          id: string
          organization_id: string
          results: Json
          success_rate: number | null
          successful_actions: number | null
          targets: Json
          total_actions: number | null
        }
        Insert: {
          action_type: string
          dry_run?: boolean | null
          executed_at?: string
          execution_status?: string | null
          id?: string
          organization_id: string
          results?: Json
          success_rate?: number | null
          successful_actions?: number | null
          targets?: Json
          total_actions?: number | null
        }
        Update: {
          action_type?: string
          dry_run?: boolean | null
          executed_at?: string
          execution_status?: string | null
          id?: string
          organization_id?: string
          results?: Json
          success_rate?: number | null
          successful_actions?: number | null
          targets?: Json
          total_actions?: number | null
        }
        Relationships: []
      }
      remediation_plans: {
        Row: {
          approval_requirements: Json
          approved_at: string | null
          approved_by: string[] | null
          asset_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          dry_run_supported: boolean
          estimated_duration_minutes: number | null
          executed_at: string | null
          execution_log: Json | null
          id: string
          maintenance_window_required: boolean
          organization_id: string
          ot_safe: boolean
          plan_name: string
          plan_type: string
          remediation_steps: Json
          risk_level: string
          rollback_steps: Json
          status: string
          stig_rule_id: string
          updated_at: string
          validation_tests: Json
        }
        Insert: {
          approval_requirements?: Json
          approved_at?: string | null
          approved_by?: string[] | null
          asset_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          dry_run_supported?: boolean
          estimated_duration_minutes?: number | null
          executed_at?: string | null
          execution_log?: Json | null
          id?: string
          maintenance_window_required?: boolean
          organization_id: string
          ot_safe?: boolean
          plan_name: string
          plan_type?: string
          remediation_steps?: Json
          risk_level?: string
          rollback_steps?: Json
          status?: string
          stig_rule_id: string
          updated_at?: string
          validation_tests?: Json
        }
        Update: {
          approval_requirements?: Json
          approved_at?: string | null
          approved_by?: string[] | null
          asset_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          dry_run_supported?: boolean
          estimated_duration_minutes?: number | null
          executed_at?: string | null
          execution_log?: Json | null
          id?: string
          maintenance_window_required?: boolean
          organization_id?: string
          ot_safe?: boolean
          plan_name?: string
          plan_type?: string
          remediation_steps?: Json
          risk_level?: string
          rollback_steps?: Json
          status?: string
          stig_rule_id?: string
          updated_at?: string
          validation_tests?: Json
        }
        Relationships: []
      }
      remediation_playbooks: {
        Row: {
          auto_execute: boolean | null
          created_at: string
          created_by: string | null
          description: string | null
          execution_count: number | null
          id: string
          organization_id: string
          platform: string
          playbook_name: string
          remediation_script: string
          risk_level: string
          rollback_script: string | null
          stig_rule_id: string
          success_rate: number | null
          updated_at: string
          validation_script: string
        }
        Insert: {
          auto_execute?: boolean | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          execution_count?: number | null
          id?: string
          organization_id: string
          platform: string
          playbook_name: string
          remediation_script: string
          risk_level?: string
          rollback_script?: string | null
          stig_rule_id: string
          success_rate?: number | null
          updated_at?: string
          validation_script: string
        }
        Update: {
          auto_execute?: boolean | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          execution_count?: number | null
          id?: string
          organization_id?: string
          platform?: string
          playbook_name?: string
          remediation_script?: string
          risk_level?: string
          rollback_script?: string | null
          stig_rule_id?: string
          success_rate?: number | null
          updated_at?: string
          validation_script?: string
        }
        Relationships: []
      }
      remediation_tasks: {
        Row: {
          action_type: string
          asset_id: string | null
          completed_at: string | null
          created_at: string
          description: string
          estimated_time_minutes: number | null
          id: string
          priority: string
          result: string | null
          started_at: string | null
          status: string
          updated_at: string
          user_id: string | null
          vulnerability_id: string
        }
        Insert: {
          action_type: string
          asset_id?: string | null
          completed_at?: string | null
          created_at?: string
          description: string
          estimated_time_minutes?: number | null
          id?: string
          priority: string
          result?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          vulnerability_id: string
        }
        Update: {
          action_type?: string
          asset_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string
          estimated_time_minutes?: number | null
          id?: string
          priority?: string
          result?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          vulnerability_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "remediation_tasks_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "security_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_usage: {
        Row: {
          billing_period: string
          cost_per_unit: number
          created_at: string
          id: string
          metadata: Json | null
          organization_id: string
          quantity: number
          resource_type: string
          total_cost: number | null
          unit: string
          user_id: string | null
        }
        Insert: {
          billing_period?: string
          cost_per_unit?: number
          created_at?: string
          id?: string
          metadata?: Json | null
          organization_id: string
          quantity?: number
          resource_type: string
          total_cost?: number | null
          unit: string
          user_id?: string | null
        }
        Update: {
          billing_period?: string
          cost_per_unit?: number
          created_at?: string
          id?: string
          metadata?: Json | null
          organization_id?: string
          quantity?: number
          resource_type?: string
          total_cost?: number | null
          unit?: string
          user_id?: string | null
        }
        Relationships: []
      }
      script_executions: {
        Row: {
          asset_id: string
          completed_at: string | null
          created_at: string
          executed_at: string | null
          executed_by: string | null
          execution_duration_ms: number | null
          execution_mode: string
          execution_status: string
          exit_code: number | null
          id: string
          metadata: Json | null
          organization_id: string
          remediation_plan_id: string | null
          script_content: string
          script_type: string
          stderr_output: string | null
          stdout_output: string | null
        }
        Insert: {
          asset_id: string
          completed_at?: string | null
          created_at?: string
          executed_at?: string | null
          executed_by?: string | null
          execution_duration_ms?: number | null
          execution_mode?: string
          execution_status?: string
          exit_code?: number | null
          id?: string
          metadata?: Json | null
          organization_id: string
          remediation_plan_id?: string | null
          script_content: string
          script_type: string
          stderr_output?: string | null
          stdout_output?: string | null
        }
        Update: {
          asset_id?: string
          completed_at?: string | null
          created_at?: string
          executed_at?: string | null
          executed_by?: string | null
          execution_duration_ms?: number | null
          execution_mode?: string
          execution_status?: string
          exit_code?: number | null
          id?: string
          metadata?: Json | null
          organization_id?: string
          remediation_plan_id?: string | null
          script_content?: string
          script_type?: string
          stderr_output?: string | null
          stdout_output?: string | null
        }
        Relationships: []
      }
      secure_discovery_credentials: {
        Row: {
          access_pattern: Json | null
          created_at: string
          created_by: string | null
          credential_fingerprint: string | null
          credential_name: string
          credential_type: string
          encrypted_credentials: string
          encryption_key_id: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          last_accessed_by: string | null
          last_used_at: string | null
          max_concurrent_uses: number | null
          metadata: Json | null
          mfa_required: boolean | null
          organization_id: string
          target_systems: Json
          updated_at: string
          usage_count: number | null
        }
        Insert: {
          access_pattern?: Json | null
          created_at?: string
          created_by?: string | null
          credential_fingerprint?: string | null
          credential_name: string
          credential_type: string
          encrypted_credentials: string
          encryption_key_id?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_accessed_by?: string | null
          last_used_at?: string | null
          max_concurrent_uses?: number | null
          metadata?: Json | null
          mfa_required?: boolean | null
          organization_id: string
          target_systems?: Json
          updated_at?: string
          usage_count?: number | null
        }
        Update: {
          access_pattern?: Json | null
          created_at?: string
          created_by?: string | null
          credential_fingerprint?: string | null
          credential_name?: string
          credential_type?: string
          encrypted_credentials?: string
          encryption_key_id?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_accessed_by?: string | null
          last_used_at?: string | null
          max_concurrent_uses?: number | null
          metadata?: Json | null
          mfa_required?: boolean | null
          organization_id?: string
          target_systems?: Json
          updated_at?: string
          usage_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "secure_discovery_credentials_encryption_key_id_fkey"
            columns: ["encryption_key_id"]
            isOneToOne: false
            referencedRelation: "encryption_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      security_alerts: {
        Row: {
          alert_category: string
          alert_type: string
          auto_contained: boolean
          created_at: string
          description: string
          id: string
          metadata: Json
          organization_id: string | null
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          tester_id: string | null
        }
        Insert: {
          alert_category?: string
          alert_type: string
          auto_contained?: boolean
          created_at?: string
          description: string
          id?: string
          metadata?: Json
          organization_id?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity: string
          tester_id?: string | null
        }
        Update: {
          alert_category?: string
          alert_type?: string
          auto_contained?: boolean
          created_at?: string
          description?: string
          id?: string
          metadata?: Json
          organization_id?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          tester_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_alerts_tester_id_fkey"
            columns: ["tester_id"]
            isOneToOne: false
            referencedRelation: "third_party_testers"
            referencedColumns: ["id"]
          },
        ]
      }
      security_assets: {
        Row: {
          created_at: string
          id: string
          last_scanned: string
          metadata: Json | null
          name: string
          protection_level: string
          status: string
          type: string
          updated_at: string
          user_id: string | null
          vulnerabilities: Json | null
        }
        Insert: {
          created_at?: string
          id: string
          last_scanned?: string
          metadata?: Json | null
          name: string
          protection_level?: string
          status: string
          type: string
          updated_at?: string
          user_id?: string | null
          vulnerabilities?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          last_scanned?: string
          metadata?: Json | null
          name?: string
          protection_level?: string
          status?: string
          type?: string
          updated_at?: string
          user_id?: string | null
          vulnerabilities?: Json | null
        }
        Relationships: []
      }
      security_audit_enhanced: {
        Row: {
          action: string
          audit_type: string
          detected_at: string | null
          findings: Json | null
          id: string
          organization_id: string | null
          remediation_status: string | null
          resolved_at: string | null
          resource_id: string | null
          resource_type: string
          risk_level: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          audit_type: string
          detected_at?: string | null
          findings?: Json | null
          id?: string
          organization_id?: string | null
          remediation_status?: string | null
          resolved_at?: string | null
          resource_id?: string | null
          resource_type: string
          risk_level?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          audit_type?: string
          detected_at?: string | null
          findings?: Json | null
          id?: string
          organization_id?: string | null
          remediation_status?: string | null
          resolved_at?: string | null
          resource_id?: string | null
          resource_type?: string
          risk_level?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      security_devices: {
        Row: {
          created_at: string | null
          device_fingerprint: string
          device_name: string
          device_type: string | null
          id: string
          is_trusted: boolean | null
          last_used: string | null
          location_info: string | null
          risk_score: number | null
          trusted_until: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_fingerprint: string
          device_name: string
          device_type?: string | null
          id?: string
          is_trusted?: boolean | null
          last_used?: string | null
          location_info?: string | null
          risk_score?: number | null
          trusted_until?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_fingerprint?: string
          device_name?: string
          device_type?: string | null
          id?: string
          is_trusted?: boolean | null
          last_used?: string | null
          location_info?: string | null
          risk_score?: number | null
          trusted_until?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      security_events: {
        Row: {
          archived: boolean | null
          archived_at: string | null
          archived_by: string | null
          created_at: string
          details: Json | null
          event_tags: Json | null
          event_type: string
          id: string
          organization_id: string | null
          resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string | null
          source_ip: unknown
          source_metadata: Json | null
          source_system: string | null
        }
        Insert: {
          archived?: boolean | null
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          details?: Json | null
          event_tags?: Json | null
          event_type: string
          id?: string
          organization_id?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string | null
          source_ip?: unknown
          source_metadata?: Json | null
          source_system?: string | null
        }
        Update: {
          archived?: boolean | null
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          details?: Json | null
          event_tags?: Json | null
          event_type?: string
          id?: string
          organization_id?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string | null
          source_ip?: unknown
          source_metadata?: Json | null
          source_system?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      security_monitoring: {
        Row: {
          created_at: string | null
          details: Json | null
          event_type: string
          id: string
          ip_address: unknown
          severity: string
          source_id: string | null
          source_table: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          event_type: string
          id?: string
          ip_address?: unknown
          severity: string
          source_id?: string | null
          source_table?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          event_type?: string
          id?: string
          ip_address?: unknown
          severity?: string
          source_id?: string | null
          source_table?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      security_monitoring_events: {
        Row: {
          acknowledged: boolean | null
          acknowledged_at: string | null
          acknowledged_by: string | null
          auto_remediation_triggered: boolean | null
          correlation_id: string | null
          created_at: string
          event_details: Json
          event_severity: string
          event_type: string
          id: string
          organization_id: string
          remediation_actions: Json | null
          source_ip: unknown
          source_system: string
          target_assets: string[] | null
        }
        Insert: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          auto_remediation_triggered?: boolean | null
          correlation_id?: string | null
          created_at?: string
          event_details?: Json
          event_severity?: string
          event_type: string
          id?: string
          organization_id: string
          remediation_actions?: Json | null
          source_ip?: unknown
          source_system: string
          target_assets?: string[] | null
        }
        Update: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          auto_remediation_triggered?: boolean | null
          correlation_id?: string | null
          created_at?: string
          event_details?: Json
          event_severity?: string
          event_type?: string
          id?: string
          organization_id?: string
          remediation_actions?: Json | null
          source_ip?: unknown
          source_system?: string
          target_assets?: string[] | null
        }
        Relationships: []
      }
      session_security_events: {
        Row: {
          created_at: string | null
          details: Json | null
          device_fingerprint: string | null
          event_type: string
          id: string
          ip_address: unknown
          risk_level: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          device_fingerprint?: string | null
          event_type: string
          id?: string
          ip_address?: unknown
          risk_level?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          device_fingerprint?: string | null
          event_type?: string
          id?: string
          ip_address?: unknown
          risk_level?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      shopping_carts: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          session_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          session_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          session_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      siem_integrations: {
        Row: {
          config: Json
          created_at: string | null
          id: string
          last_sync: string | null
          organization_id: string
          siem_type: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          config?: Json
          created_at?: string | null
          id?: string
          last_sync?: string | null
          organization_id: string
          siem_type: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          config?: Json
          created_at?: string | null
          id?: string
          last_sync?: string | null
          organization_id?: string
          siem_type?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      software_bill_of_materials: {
        Row: {
          asset_id: string | null
          compliance_status: Json | null
          component_name: string
          component_type: string
          component_version: string | null
          cpe_identifier: string | null
          detection_method: string | null
          first_detected: string
          hash_sha256: string | null
          id: string
          is_verified: boolean | null
          last_verified: string
          license: string | null
          metadata: Json | null
          organization_id: string
          purl_identifier: string | null
          risk_score: number | null
          vendor: string | null
          vulnerability_count: number | null
        }
        Insert: {
          asset_id?: string | null
          compliance_status?: Json | null
          component_name: string
          component_type: string
          component_version?: string | null
          cpe_identifier?: string | null
          detection_method?: string | null
          first_detected?: string
          hash_sha256?: string | null
          id?: string
          is_verified?: boolean | null
          last_verified?: string
          license?: string | null
          metadata?: Json | null
          organization_id: string
          purl_identifier?: string | null
          risk_score?: number | null
          vendor?: string | null
          vulnerability_count?: number | null
        }
        Update: {
          asset_id?: string | null
          compliance_status?: Json | null
          component_name?: string
          component_type?: string
          component_version?: string | null
          cpe_identifier?: string | null
          detection_method?: string | null
          first_detected?: string
          hash_sha256?: string | null
          id?: string
          is_verified?: boolean | null
          last_verified?: string
          license?: string | null
          metadata?: Json | null
          organization_id?: string
          purl_identifier?: string | null
          risk_score?: number | null
          vendor?: string | null
          vulnerability_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "software_bill_of_materials_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "discovered_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      stig_ai_analyses: {
        Row: {
          ai_findings: Json
          analysis_metadata: Json | null
          analysis_scope: Json
          analysis_type: string
          analyzed_at: string
          asset_id: string | null
          confidence_score: number | null
          estimated_impact: string | null
          expires_at: string | null
          id: string
          implementation_priority: number | null
          organization_id: string
          recommendations: Json
          stig_rules_analyzed: string[]
        }
        Insert: {
          ai_findings?: Json
          analysis_metadata?: Json | null
          analysis_scope?: Json
          analysis_type: string
          analyzed_at?: string
          asset_id?: string | null
          confidence_score?: number | null
          estimated_impact?: string | null
          expires_at?: string | null
          id?: string
          implementation_priority?: number | null
          organization_id: string
          recommendations?: Json
          stig_rules_analyzed?: string[]
        }
        Update: {
          ai_findings?: Json
          analysis_metadata?: Json | null
          analysis_scope?: Json
          analysis_type?: string
          analyzed_at?: string
          asset_id?: string | null
          confidence_score?: number | null
          estimated_impact?: string | null
          expires_at?: string | null
          id?: string
          implementation_priority?: number | null
          organization_id?: string
          recommendations?: Json
          stig_rules_analyzed?: string[]
        }
        Relationships: []
      }
      stig_ai_verifications: {
        Row: {
          ai_model_version: string | null
          confidence_score: number
          configuration_id: string
          environment_context: Json
          id: string
          organization_id: string
          recommendations: Json | null
          risk_assessment: Json | null
          verification_details: string | null
          verification_status: string
          verification_type: string
          verified_at: string
        }
        Insert: {
          ai_model_version?: string | null
          confidence_score?: number
          configuration_id: string
          environment_context?: Json
          id?: string
          organization_id: string
          recommendations?: Json | null
          risk_assessment?: Json | null
          verification_details?: string | null
          verification_status: string
          verification_type: string
          verified_at?: string
        }
        Update: {
          ai_model_version?: string | null
          confidence_score?: number
          configuration_id?: string
          environment_context?: Json
          id?: string
          organization_id?: string
          recommendations?: Json | null
          risk_assessment?: Json | null
          verification_details?: string | null
          verification_status?: string
          verification_type?: string
          verified_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stig_ai_verifications_configuration_id_fkey"
            columns: ["configuration_id"]
            isOneToOne: false
            referencedRelation: "stig_trusted_configurations"
            referencedColumns: ["id"]
          },
        ]
      }
      stig_alert_rules: {
        Row: {
          alert_conditions: Json
          created_at: string
          created_by: string | null
          enabled: boolean | null
          escalation_rules: Json | null
          id: string
          notification_channels: Json
          organization_id: string
          rule_name: string
          severity: string
          stig_rule_ids: string[] | null
          updated_at: string
        }
        Insert: {
          alert_conditions: Json
          created_at?: string
          created_by?: string | null
          enabled?: boolean | null
          escalation_rules?: Json | null
          id?: string
          notification_channels: Json
          organization_id: string
          rule_name: string
          severity: string
          stig_rule_ids?: string[] | null
          updated_at?: string
        }
        Update: {
          alert_conditions?: Json
          created_at?: string
          created_by?: string | null
          enabled?: boolean | null
          escalation_rules?: Json | null
          id?: string
          notification_channels?: Json
          organization_id?: string
          rule_name?: string
          severity?: string
          stig_rule_ids?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      stig_analytics_metrics: {
        Row: {
          asset_scope: Json | null
          created_at: string | null
          id: string
          measurement_period_end: string
          measurement_period_start: string
          metadata: Json | null
          metric_type: string
          metric_unit: string | null
          metric_value: number
          organization_id: string
          stig_scope: Json | null
          updated_at: string | null
        }
        Insert: {
          asset_scope?: Json | null
          created_at?: string | null
          id?: string
          measurement_period_end: string
          measurement_period_start: string
          metadata?: Json | null
          metric_type: string
          metric_unit?: string | null
          metric_value: number
          organization_id: string
          stig_scope?: Json | null
          updated_at?: string | null
        }
        Update: {
          asset_scope?: Json | null
          created_at?: string | null
          id?: string
          measurement_period_end?: string
          measurement_period_start?: string
          metadata?: Json | null
          metric_type?: string
          metric_unit?: string | null
          metric_value?: number
          organization_id?: string
          stig_scope?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      stig_applicability_rules: {
        Row: {
          created_at: string
          exclusion_rules: Json | null
          id: string
          platform_patterns: Json
          priority: number | null
          service_requirements: Json | null
          stig_id: string
          stig_title: string
          stig_version: string
          updated_at: string
          version_patterns: Json
        }
        Insert: {
          created_at?: string
          exclusion_rules?: Json | null
          id?: string
          platform_patterns: Json
          priority?: number | null
          service_requirements?: Json | null
          stig_id: string
          stig_title: string
          stig_version: string
          updated_at?: string
          version_patterns: Json
        }
        Update: {
          created_at?: string
          exclusion_rules?: Json | null
          id?: string
          platform_patterns?: Json
          priority?: number | null
          service_requirements?: Json | null
          stig_id?: string
          stig_title?: string
          stig_version?: string
          updated_at?: string
          version_patterns?: Json
        }
        Relationships: []
      }
      stig_automation_rules: {
        Row: {
          actions: Json
          conditions: Json
          cooldown_minutes: number | null
          created_at: string | null
          created_by: string | null
          enabled: boolean | null
          failure_count: number | null
          id: string
          last_triggered: string | null
          organization_id: string
          priority: number | null
          rule_name: string
          rule_type: string
          success_count: number | null
          trigger_count: number | null
          updated_at: string | null
        }
        Insert: {
          actions: Json
          conditions: Json
          cooldown_minutes?: number | null
          created_at?: string | null
          created_by?: string | null
          enabled?: boolean | null
          failure_count?: number | null
          id?: string
          last_triggered?: string | null
          organization_id: string
          priority?: number | null
          rule_name: string
          rule_type: string
          success_count?: number | null
          trigger_count?: number | null
          updated_at?: string | null
        }
        Update: {
          actions?: Json
          conditions?: Json
          cooldown_minutes?: number | null
          created_at?: string | null
          created_by?: string | null
          enabled?: boolean | null
          failure_count?: number | null
          id?: string
          last_triggered?: string | null
          organization_id?: string
          priority?: number | null
          rule_name?: string
          rule_type?: string
          success_count?: number | null
          trigger_count?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      stig_baselines: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          baseline_name: string
          configuration: Json
          created_at: string
          id: string
          implementation_status: string
          organization_id: string
          platform: string
          risk_tolerance: string
          stig_id: string
          stig_version: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          baseline_name: string
          configuration?: Json
          created_at?: string
          id?: string
          implementation_status?: string
          organization_id: string
          platform: string
          risk_tolerance?: string
          stig_id: string
          stig_version: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          baseline_name?: string
          configuration?: Json
          created_at?: string
          id?: string
          implementation_status?: string
          organization_id?: string
          platform?: string
          risk_tolerance?: string
          stig_id?: string
          stig_version?: string
          updated_at?: string
        }
        Relationships: []
      }
      stig_compliance_policies: {
        Row: {
          approvers: Json | null
          compliance_threshold: number | null
          created_at: string | null
          created_by: string | null
          enforcement_level: string | null
          id: string
          is_active: boolean | null
          next_review_date: string | null
          organization_id: string
          policy_definition: Json
          policy_name: string
          policy_owner: string | null
          policy_type: string
          review_frequency_days: number | null
          target_scope: Json
          updated_at: string | null
          violation_actions: Json | null
        }
        Insert: {
          approvers?: Json | null
          compliance_threshold?: number | null
          created_at?: string | null
          created_by?: string | null
          enforcement_level?: string | null
          id?: string
          is_active?: boolean | null
          next_review_date?: string | null
          organization_id: string
          policy_definition: Json
          policy_name: string
          policy_owner?: string | null
          policy_type: string
          review_frequency_days?: number | null
          target_scope: Json
          updated_at?: string | null
          violation_actions?: Json | null
        }
        Update: {
          approvers?: Json | null
          compliance_threshold?: number | null
          created_at?: string | null
          created_by?: string | null
          enforcement_level?: string | null
          id?: string
          is_active?: boolean | null
          next_review_date?: string | null
          organization_id?: string
          policy_definition?: Json
          policy_name?: string
          policy_owner?: string | null
          policy_type?: string
          review_frequency_days?: number | null
          target_scope?: Json
          updated_at?: string | null
          violation_actions?: Json | null
        }
        Relationships: []
      }
      stig_compliance_reports: {
        Row: {
          compliance_percentage: number | null
          critical_findings: number | null
          generated_at: string | null
          generated_by: string | null
          high_findings: number | null
          id: string
          low_findings: number | null
          medium_findings: number | null
          organization_id: string
          recommendations: Json | null
          report_data: Json
          report_format: string | null
          report_name: string
          report_scope: Json
          report_type: string
          status: string | null
          trend_analysis: Json | null
        }
        Insert: {
          compliance_percentage?: number | null
          critical_findings?: number | null
          generated_at?: string | null
          generated_by?: string | null
          high_findings?: number | null
          id?: string
          low_findings?: number | null
          medium_findings?: number | null
          organization_id: string
          recommendations?: Json | null
          report_data: Json
          report_format?: string | null
          report_name: string
          report_scope: Json
          report_type: string
          status?: string | null
          trend_analysis?: Json | null
        }
        Update: {
          compliance_percentage?: number | null
          critical_findings?: number | null
          generated_at?: string | null
          generated_by?: string | null
          high_findings?: number | null
          id?: string
          low_findings?: number | null
          medium_findings?: number | null
          organization_id?: string
          recommendations?: Json | null
          report_data?: Json
          report_format?: string | null
          report_name?: string
          report_scope?: Json
          report_type?: string
          status?: string | null
          trend_analysis?: Json | null
        }
        Relationships: []
      }
      stig_compliance_validations: {
        Row: {
          asset_id: string
          automated_fix_available: boolean | null
          compliance_status: string
          created_at: string
          evidence_collected: Json | null
          id: string
          last_validation_date: string
          next_validation_due: string | null
          organization_id: string
          remediation_plan: string | null
          remediation_priority: number | null
          remediation_required: boolean | null
          risk_assessment: Json | null
          stig_rule_id: string
          updated_at: string
          validated_by: string | null
          validation_confidence: number | null
          validation_frequency_days: number | null
          validation_result: Json
          validation_type: string
        }
        Insert: {
          asset_id: string
          automated_fix_available?: boolean | null
          compliance_status: string
          created_at?: string
          evidence_collected?: Json | null
          id?: string
          last_validation_date?: string
          next_validation_due?: string | null
          organization_id: string
          remediation_plan?: string | null
          remediation_priority?: number | null
          remediation_required?: boolean | null
          risk_assessment?: Json | null
          stig_rule_id: string
          updated_at?: string
          validated_by?: string | null
          validation_confidence?: number | null
          validation_frequency_days?: number | null
          validation_result?: Json
          validation_type: string
        }
        Update: {
          asset_id?: string
          automated_fix_available?: boolean | null
          compliance_status?: string
          created_at?: string
          evidence_collected?: Json | null
          id?: string
          last_validation_date?: string
          next_validation_due?: string | null
          organization_id?: string
          remediation_plan?: string | null
          remediation_priority?: number | null
          remediation_required?: boolean | null
          risk_assessment?: Json | null
          stig_rule_id?: string
          updated_at?: string
          validated_by?: string | null
          validation_confidence?: number | null
          validation_frequency_days?: number | null
          validation_result?: Json
          validation_type?: string
        }
        Relationships: []
      }
      stig_configuration_baselines: {
        Row: {
          asset_id: string
          captured_at: string
          compliance_status: string
          configuration_data: Json
          configuration_hash: string
          created_at: string
          id: string
          organization_id: string
          risk_score: number | null
          snapshot_type: string
          stig_rule_id: string
          validated_by: string | null
        }
        Insert: {
          asset_id: string
          captured_at?: string
          compliance_status: string
          configuration_data: Json
          configuration_hash: string
          created_at?: string
          id?: string
          organization_id: string
          risk_score?: number | null
          snapshot_type: string
          stig_rule_id: string
          validated_by?: string | null
        }
        Update: {
          asset_id?: string
          captured_at?: string
          compliance_status?: string
          configuration_data?: Json
          configuration_hash?: string
          created_at?: string
          id?: string
          organization_id?: string
          risk_score?: number | null
          snapshot_type?: string
          stig_rule_id?: string
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_stig_baselines_org"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      stig_drift_events: {
        Row: {
          acknowledged: boolean | null
          acknowledged_at: string | null
          acknowledged_by: string | null
          asset_id: string
          auto_remediated: boolean | null
          created_at: string
          current_state: Json
          detected_at: string
          detection_method: string
          drift_type: string
          id: string
          organization_id: string
          previous_state: Json
          remediation_action: string | null
          severity: string
          stig_rule_id: string
        }
        Insert: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          asset_id: string
          auto_remediated?: boolean | null
          created_at?: string
          current_state: Json
          detected_at?: string
          detection_method: string
          drift_type: string
          id?: string
          organization_id: string
          previous_state: Json
          remediation_action?: string | null
          severity: string
          stig_rule_id: string
        }
        Update: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          asset_id?: string
          auto_remediated?: boolean | null
          created_at?: string
          current_state?: Json
          detected_at?: string
          detection_method?: string
          drift_type?: string
          id?: string
          organization_id?: string
          previous_state?: Json
          remediation_action?: string | null
          severity?: string
          stig_rule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_stig_drift_org"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      stig_evidence: {
        Row: {
          access_review_notes: string | null
          asset_id: string
          collection_method: string
          collection_timestamp: string
          created_at: string
          evidence_data: Json
          evidence_type: string
          file_hash: string | null
          file_path: string | null
          id: string
          last_access_review_date: string | null
          metadata: Json | null
          organization_id: string
          retention_period_days: number | null
          reviewed_by: string | null
          stig_rule_id: string
        }
        Insert: {
          access_review_notes?: string | null
          asset_id: string
          collection_method: string
          collection_timestamp?: string
          created_at?: string
          evidence_data: Json
          evidence_type: string
          file_hash?: string | null
          file_path?: string | null
          id?: string
          last_access_review_date?: string | null
          metadata?: Json | null
          organization_id: string
          retention_period_days?: number | null
          reviewed_by?: string | null
          stig_rule_id: string
        }
        Update: {
          access_review_notes?: string | null
          asset_id?: string
          collection_method?: string
          collection_timestamp?: string
          created_at?: string
          evidence_data?: Json
          evidence_type?: string
          file_hash?: string | null
          file_path?: string | null
          id?: string
          last_access_review_date?: string | null
          metadata?: Json | null
          organization_id?: string
          retention_period_days?: number | null
          reviewed_by?: string | null
          stig_rule_id?: string
        }
        Relationships: []
      }
      stig_feeds: {
        Row: {
          auto_update: boolean
          created_at: string
          enabled: boolean
          feed_name: string
          feed_type: string
          feed_url: string
          id: string
          ingestion_log: Json | null
          ingestion_status: string
          last_ingested: string | null
          last_updated: string | null
          product_name: string
          product_version: string | null
          rules_count: number | null
          stig_version: string | null
          update_frequency_hours: number | null
          updated_at: string
        }
        Insert: {
          auto_update?: boolean
          created_at?: string
          enabled?: boolean
          feed_name: string
          feed_type?: string
          feed_url: string
          id?: string
          ingestion_log?: Json | null
          ingestion_status?: string
          last_ingested?: string | null
          last_updated?: string | null
          product_name: string
          product_version?: string | null
          rules_count?: number | null
          stig_version?: string | null
          update_frequency_hours?: number | null
          updated_at?: string
        }
        Update: {
          auto_update?: boolean
          created_at?: string
          enabled?: boolean
          feed_name?: string
          feed_type?: string
          feed_url?: string
          id?: string
          ingestion_log?: Json | null
          ingestion_status?: string
          last_ingested?: string | null
          last_updated?: string | null
          product_name?: string
          product_version?: string | null
          rules_count?: number | null
          stig_version?: string | null
          update_frequency_hours?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      stig_flow_templates: {
        Row: {
          automation_percentage: number | null
          compliance_level: string
          created_at: string
          deployment_instructions: string | null
          estimated_implementation_hours: number | null
          flow_definition: Json
          id: string
          prerequisite_stigs: Json | null
          stig_family: string
          template_name: string
          updated_at: string
          validation_criteria: Json | null
        }
        Insert: {
          automation_percentage?: number | null
          compliance_level: string
          created_at?: string
          deployment_instructions?: string | null
          estimated_implementation_hours?: number | null
          flow_definition: Json
          id?: string
          prerequisite_stigs?: Json | null
          stig_family: string
          template_name: string
          updated_at?: string
          validation_criteria?: Json | null
        }
        Update: {
          automation_percentage?: number | null
          compliance_level?: string
          created_at?: string
          deployment_instructions?: string | null
          estimated_implementation_hours?: number | null
          flow_definition?: Json
          id?: string
          prerequisite_stigs?: Json | null
          stig_family?: string
          template_name?: string
          updated_at?: string
          validation_criteria?: Json | null
        }
        Relationships: []
      }
      stig_intelligence_feeds: {
        Row: {
          authentication_config: Json | null
          created_at: string
          feed_name: string
          feed_type: string
          feed_url: string | null
          id: string
          is_active: boolean | null
          last_sync_at: string | null
          next_sync_at: string | null
          records_updated: number | null
          sync_errors: Json | null
          sync_frequency_hours: number | null
          sync_status: string | null
          updated_at: string
        }
        Insert: {
          authentication_config?: Json | null
          created_at?: string
          feed_name: string
          feed_type: string
          feed_url?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          next_sync_at?: string | null
          records_updated?: number | null
          sync_errors?: Json | null
          sync_frequency_hours?: number | null
          sync_status?: string | null
          updated_at?: string
        }
        Update: {
          authentication_config?: Json | null
          created_at?: string
          feed_name?: string
          feed_type?: string
          feed_url?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          next_sync_at?: string | null
          records_updated?: number | null
          sync_errors?: Json | null
          sync_frequency_hours?: number | null
          sync_status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      stig_monitoring_agents: {
        Row: {
          agent_name: string
          agent_type: string
          configuration: Json
          created_at: string
          deployment_config: Json | null
          deployment_mode: string
          id: string
          last_heartbeat: string | null
          operational_mode: string
          organization_id: string
          performance_metrics: Json
          status: string
          supported_stigs: string[]
          target_platforms: string[]
          updated_at: string
        }
        Insert: {
          agent_name: string
          agent_type: string
          configuration?: Json
          created_at?: string
          deployment_config?: Json | null
          deployment_mode: string
          id?: string
          last_heartbeat?: string | null
          operational_mode: string
          organization_id: string
          performance_metrics?: Json
          status: string
          supported_stigs?: string[]
          target_platforms?: string[]
          updated_at?: string
        }
        Update: {
          agent_name?: string
          agent_type?: string
          configuration?: Json
          created_at?: string
          deployment_config?: Json | null
          deployment_mode?: string
          id?: string
          last_heartbeat?: string | null
          operational_mode?: string
          organization_id?: string
          performance_metrics?: Json
          status?: string
          supported_stigs?: string[]
          target_platforms?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_stig_agents_org"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      stig_remediation_actions: {
        Row: {
          actions_taken: string[] | null
          created_at: string
          drift_event_id: string | null
          executed_at: string | null
          executed_by: string | null
          id: string
          impact_assessment: Json | null
          organization_id: string
          remediation_type: string
          rollback_enabled: boolean | null
          rollback_plan: Json | null
          status: string
          verification_required: boolean | null
          verification_results: Json | null
          violation_id: string | null
        }
        Insert: {
          actions_taken?: string[] | null
          created_at?: string
          drift_event_id?: string | null
          executed_at?: string | null
          executed_by?: string | null
          id?: string
          impact_assessment?: Json | null
          organization_id: string
          remediation_type: string
          rollback_enabled?: boolean | null
          rollback_plan?: Json | null
          status: string
          verification_required?: boolean | null
          verification_results?: Json | null
          violation_id?: string | null
        }
        Update: {
          actions_taken?: string[] | null
          created_at?: string
          drift_event_id?: string | null
          executed_at?: string | null
          executed_by?: string | null
          id?: string
          impact_assessment?: Json | null
          organization_id?: string
          remediation_type?: string
          rollback_enabled?: boolean | null
          rollback_plan?: Json | null
          status?: string
          verification_required?: boolean | null
          verification_results?: Json | null
          violation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_stig_remediation_drift"
            columns: ["drift_event_id"]
            isOneToOne: false
            referencedRelation: "stig_drift_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_stig_remediation_org"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      stig_remediation_executions: {
        Row: {
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          asset_id: string
          completed_at: string | null
          error_message: string | null
          execution_duration_seconds: number | null
          execution_log: Json | null
          execution_status: string | null
          id: string
          organization_id: string
          remediation_data: Json | null
          started_at: string | null
          stig_rule_id: string
          workflow_id: string
        }
        Insert: {
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          asset_id: string
          completed_at?: string | null
          error_message?: string | null
          execution_duration_seconds?: number | null
          execution_log?: Json | null
          execution_status?: string | null
          id?: string
          organization_id: string
          remediation_data?: Json | null
          started_at?: string | null
          stig_rule_id: string
          workflow_id: string
        }
        Update: {
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          asset_id?: string
          completed_at?: string | null
          error_message?: string | null
          execution_duration_seconds?: number | null
          execution_log?: Json | null
          execution_status?: string | null
          id?: string
          organization_id?: string
          remediation_data?: Json | null
          started_at?: string | null
          stig_rule_id?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stig_remediation_executions_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "stig_remediation_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      stig_remediation_workflows: {
        Row: {
          approval_required: boolean | null
          created_at: string | null
          created_by: string | null
          execution_count: number | null
          id: string
          is_active: boolean | null
          last_execution: string | null
          organization_id: string
          remediation_steps: Json
          risk_level: string | null
          success_rate: number | null
          target_platforms: Json | null
          target_stig_rules: Json | null
          trigger_conditions: Json
          updated_at: string | null
          workflow_name: string
          workflow_type: string
        }
        Insert: {
          approval_required?: boolean | null
          created_at?: string | null
          created_by?: string | null
          execution_count?: number | null
          id?: string
          is_active?: boolean | null
          last_execution?: string | null
          organization_id: string
          remediation_steps: Json
          risk_level?: string | null
          success_rate?: number | null
          target_platforms?: Json | null
          target_stig_rules?: Json | null
          trigger_conditions: Json
          updated_at?: string | null
          workflow_name: string
          workflow_type: string
        }
        Update: {
          approval_required?: boolean | null
          created_at?: string | null
          created_by?: string | null
          execution_count?: number | null
          id?: string
          is_active?: boolean | null
          last_execution?: string | null
          organization_id?: string
          remediation_steps?: Json
          risk_level?: string | null
          success_rate?: number | null
          target_platforms?: Json | null
          target_stig_rules?: Json | null
          trigger_conditions?: Json
          updated_at?: string | null
          workflow_name?: string
          workflow_type?: string
        }
        Relationships: []
      }
      stig_rule_implementations: {
        Row: {
          asset_id: string
          compliance_status: string
          configuration_script: string | null
          created_at: string
          evidence_collected: Json | null
          id: string
          implementation_method: string
          implementation_status: string
          last_checked: string | null
          last_remediated: string | null
          organization_id: string
          remediation_notes: string | null
          rule_title: string
          severity: string
          stig_rule_id: string
          updated_at: string
          validation_script: string | null
        }
        Insert: {
          asset_id: string
          compliance_status?: string
          configuration_script?: string | null
          created_at?: string
          evidence_collected?: Json | null
          id?: string
          implementation_method: string
          implementation_status?: string
          last_checked?: string | null
          last_remediated?: string | null
          organization_id: string
          remediation_notes?: string | null
          rule_title: string
          severity: string
          stig_rule_id: string
          updated_at?: string
          validation_script?: string | null
        }
        Update: {
          asset_id?: string
          compliance_status?: string
          configuration_script?: string | null
          created_at?: string
          evidence_collected?: Json | null
          id?: string
          implementation_method?: string
          implementation_status?: string
          last_checked?: string | null
          last_remediated?: string | null
          organization_id?: string
          remediation_notes?: string | null
          rule_title?: string
          severity?: string
          stig_rule_id?: string
          updated_at?: string
          validation_script?: string | null
        }
        Relationships: []
      }
      stig_rules: {
        Row: {
          automation_script: string | null
          check_content: string | null
          created_at: string
          description: string
          fix_text: string | null
          id: string
          implementation_status: string | null
          nist_control_mappings: string[] | null
          platform: string
          severity: string
          stig_id: string
          title: string
          updated_at: string
          validation_query: string | null
        }
        Insert: {
          automation_script?: string | null
          check_content?: string | null
          created_at?: string
          description: string
          fix_text?: string | null
          id?: string
          implementation_status?: string | null
          nist_control_mappings?: string[] | null
          platform: string
          severity: string
          stig_id: string
          title: string
          updated_at?: string
          validation_query?: string | null
        }
        Update: {
          automation_script?: string | null
          check_content?: string | null
          created_at?: string
          description?: string
          fix_text?: string | null
          id?: string
          implementation_status?: string | null
          nist_control_mappings?: string[] | null
          platform?: string
          severity?: string
          stig_id?: string
          title?: string
          updated_at?: string
          validation_query?: string | null
        }
        Relationships: []
      }
      stig_threat_correlations: {
        Row: {
          automated_response_triggered: boolean | null
          correlated_stig_rules: string[]
          correlation_confidence: number | null
          correlation_details: string | null
          detected_at: string
          expires_at: string | null
          id: string
          mitigation_recommendations: Json | null
          organization_id: string
          risk_elevation: string
          threat_indicator: string
          threat_intelligence: Json
          threat_source: string
          threat_type: string
        }
        Insert: {
          automated_response_triggered?: boolean | null
          correlated_stig_rules?: string[]
          correlation_confidence?: number | null
          correlation_details?: string | null
          detected_at?: string
          expires_at?: string | null
          id?: string
          mitigation_recommendations?: Json | null
          organization_id: string
          risk_elevation: string
          threat_indicator: string
          threat_intelligence?: Json
          threat_source: string
          threat_type: string
        }
        Update: {
          automated_response_triggered?: boolean | null
          correlated_stig_rules?: string[]
          correlation_confidence?: number | null
          correlation_details?: string | null
          detected_at?: string
          expires_at?: string | null
          id?: string
          mitigation_recommendations?: Json | null
          organization_id?: string
          risk_elevation?: string
          threat_indicator?: string
          threat_intelligence?: Json
          threat_source?: string
          threat_type?: string
        }
        Relationships: []
      }
      stig_trusted_configurations: {
        Row: {
          ai_verification_date: string | null
          ai_verified: boolean | null
          approval_date: string | null
          confidence_score: number | null
          configuration_template: Json
          created_at: string
          created_by: string | null
          disa_approved: boolean | null
          id: string
          implementation_guidance: string | null
          organization_id: string
          platform_type: string
          stig_id: string
          stig_version: string
          updated_at: string
          validation_rules: Json
          vendor_specific_notes: string | null
        }
        Insert: {
          ai_verification_date?: string | null
          ai_verified?: boolean | null
          approval_date?: string | null
          confidence_score?: number | null
          configuration_template?: Json
          created_at?: string
          created_by?: string | null
          disa_approved?: boolean | null
          id?: string
          implementation_guidance?: string | null
          organization_id: string
          platform_type: string
          stig_id: string
          stig_version: string
          updated_at?: string
          validation_rules?: Json
          vendor_specific_notes?: string | null
        }
        Update: {
          ai_verification_date?: string | null
          ai_verified?: boolean | null
          approval_date?: string | null
          confidence_score?: number | null
          configuration_template?: Json
          created_at?: string
          created_by?: string | null
          disa_approved?: boolean | null
          id?: string
          implementation_guidance?: string | null
          organization_id?: string
          platform_type?: string
          stig_id?: string
          stig_version?: string
          updated_at?: string
          validation_rules?: Json
          vendor_specific_notes?: string | null
        }
        Relationships: []
      }
      stig_trusted_registry: {
        Row: {
          compliance_frameworks: string[] | null
          configuration_data: Json
          configuration_name: string
          created_at: string
          created_by: string | null
          cryptographic_hash: string
          digital_signature: string | null
          id: string
          metadata: Json | null
          organization_id: string | null
          platform: string
          risk_assessment: Json | null
          source_type: string
          stig_id: string
          success_rate: number | null
          trust_level: number
          updated_at: string
          usage_count: number | null
          validation_status: string
        }
        Insert: {
          compliance_frameworks?: string[] | null
          configuration_data: Json
          configuration_name: string
          created_at?: string
          created_by?: string | null
          cryptographic_hash: string
          digital_signature?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string | null
          platform: string
          risk_assessment?: Json | null
          source_type: string
          stig_id: string
          success_rate?: number | null
          trust_level?: number
          updated_at?: string
          usage_count?: number | null
          validation_status: string
        }
        Update: {
          compliance_frameworks?: string[] | null
          configuration_data?: Json
          configuration_name?: string
          created_at?: string
          created_by?: string | null
          cryptographic_hash?: string
          digital_signature?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string | null
          platform?: string
          risk_assessment?: Json | null
          source_type?: string
          stig_id?: string
          success_rate?: number | null
          trust_level?: number
          updated_at?: string
          usage_count?: number | null
          validation_status?: string
        }
        Relationships: []
      }
      subscribers: {
        Row: {
          created_at: string
          data_classification: string | null
          email: string
          id: string
          stripe_customer_id: string | null
          subscribed: boolean
          subscription_end: string | null
          subscription_tier: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          data_classification?: string | null
          email: string
          id?: string
          stripe_customer_id?: string | null
          subscribed?: boolean
          subscription_end?: string | null
          subscription_tier?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          data_classification?: string | null
          email?: string
          id?: string
          stripe_customer_id?: string | null
          subscribed?: boolean
          subscription_end?: string | null
          subscription_tier?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          billing_cycle: string | null
          billing_period_end: string | null
          billing_period_start: string | null
          created_at: string
          features: Json | null
          id: string
          max_storage_gb: number | null
          max_users: number | null
          organization_id: string
          plan_type: string
          price_per_month: number | null
          status: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          billing_cycle?: string | null
          billing_period_end?: string | null
          billing_period_start?: string | null
          created_at?: string
          features?: Json | null
          id?: string
          max_storage_gb?: number | null
          max_users?: number | null
          organization_id: string
          plan_type?: string
          price_per_month?: number | null
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          billing_cycle?: string | null
          billing_period_end?: string | null
          billing_period_start?: string | null
          created_at?: string
          features?: Json | null
          id?: string
          max_storage_gb?: number | null
          max_users?: number | null
          organization_id?: string
          plan_type?: string
          price_per_month?: number | null
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      swarm_performance_metrics: {
        Row: {
          created_at: string | null
          id: string
          metric_metadata: Json | null
          metric_type: string
          metric_value: number
          organization_id: string
          recorded_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          metric_metadata?: Json | null
          metric_type: string
          metric_value: number
          organization_id: string
          recorded_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          metric_metadata?: Json | null
          metric_type?: string
          metric_value?: number
          organization_id?: string
          recorded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "swarm_performance_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      swarm_tasks: {
        Row: {
          assigned_agents: Json | null
          completed_at: string | null
          created_at: string | null
          error_details: Json | null
          execution_strategy: string
          id: string
          input_data: Json | null
          organization_id: string
          output_data: Json | null
          priority: string
          progress_percentage: number | null
          status: string
          task_type: string
          updated_at: string | null
        }
        Insert: {
          assigned_agents?: Json | null
          completed_at?: string | null
          created_at?: string | null
          error_details?: Json | null
          execution_strategy?: string
          id?: string
          input_data?: Json | null
          organization_id: string
          output_data?: Json | null
          priority?: string
          progress_percentage?: number | null
          status?: string
          task_type: string
          updated_at?: string | null
        }
        Update: {
          assigned_agents?: Json | null
          completed_at?: string | null
          created_at?: string | null
          error_details?: Json | null
          execution_strategy?: string
          id?: string
          input_data?: Json | null
          organization_id?: string
          output_data?: Json | null
          priority?: string
          progress_percentage?: number | null
          status?: string
          task_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "swarm_tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      system_health_checks: {
        Row: {
          check_type: string
          checked_at: string | null
          details: Json | null
          id: string
          response_time_ms: number | null
          status: string
        }
        Insert: {
          check_type: string
          checked_at?: string | null
          details?: Json | null
          id?: string
          response_time_ms?: number | null
          status: string
        }
        Update: {
          check_type?: string
          checked_at?: string | null
          details?: Json | null
          id?: string
          response_time_ms?: number | null
          status?: string
        }
        Relationships: []
      }
      tester_activities: {
        Row: {
          activity_type: string
          details: Json
          flagged: boolean
          id: string
          organization_id: string | null
          resource_accessed: string
          risk_score: number
          session_id: string | null
          source_ip: unknown
          tester_id: string
          timestamp: string
          user_agent: string | null
        }
        Insert: {
          activity_type: string
          details?: Json
          flagged?: boolean
          id?: string
          organization_id?: string | null
          resource_accessed: string
          risk_score?: number
          session_id?: string | null
          source_ip?: unknown
          tester_id: string
          timestamp?: string
          user_agent?: string | null
        }
        Update: {
          activity_type?: string
          details?: Json
          flagged?: boolean
          id?: string
          organization_id?: string | null
          resource_accessed?: string
          risk_score?: number
          session_id?: string | null
          source_ip?: unknown
          tester_id?: string
          timestamp?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tester_activities_tester_id_fkey"
            columns: ["tester_id"]
            isOneToOne: false
            referencedRelation: "third_party_testers"
            referencedColumns: ["id"]
          },
        ]
      }
      third_party_testers: {
        Row: {
          access_level: string
          contact_email: string
          contact_name: string
          containment_rules: Json
          created_at: string
          created_by: string
          end_date: string
          id: string
          monitoring_enabled: boolean
          organization_id: string | null
          organization_name: string
          risk_assessment: string
          start_date: string
          status: string
          suspended_at: string | null
          suspension_reason: string | null
          testing_scope: string
          updated_at: string
        }
        Insert: {
          access_level: string
          contact_email: string
          contact_name: string
          containment_rules?: Json
          created_at?: string
          created_by: string
          end_date: string
          id?: string
          monitoring_enabled?: boolean
          organization_id?: string | null
          organization_name: string
          risk_assessment?: string
          start_date: string
          status?: string
          suspended_at?: string | null
          suspension_reason?: string | null
          testing_scope: string
          updated_at?: string
        }
        Update: {
          access_level?: string
          contact_email?: string
          contact_name?: string
          containment_rules?: Json
          created_at?: string
          created_by?: string
          end_date?: string
          id?: string
          monitoring_enabled?: boolean
          organization_id?: string | null
          organization_name?: string
          risk_assessment?: string
          start_date?: string
          status?: string
          suspended_at?: string | null
          suspension_reason?: string | null
          testing_scope?: string
          updated_at?: string
        }
        Relationships: []
      }
      threat_feeds: {
        Row: {
          api_config: Json | null
          created_at: string | null
          feed_name: string
          feed_type: string
          feed_url: string | null
          id: string
          indicators_count: number | null
          last_update: string | null
          organization_id: string
          provider: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          api_config?: Json | null
          created_at?: string | null
          feed_name: string
          feed_type: string
          feed_url?: string | null
          id?: string
          indicators_count?: number | null
          last_update?: string | null
          organization_id: string
          provider: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          api_config?: Json | null
          created_at?: string | null
          feed_name?: string
          feed_type?: string
          feed_url?: string | null
          id?: string
          indicators_count?: number | null
          last_update?: string | null
          organization_id?: string
          provider?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      threat_intelligence: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          indicator_type: string
          indicator_value: string
          organization_id: string | null
          source: string
          threat_level: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          indicator_type: string
          indicator_value: string
          organization_id?: string | null
          source: string
          threat_level?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          indicator_type?: string
          indicator_value?: string
          organization_id?: string | null
          source?: string
          threat_level?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "threat_intelligence_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      threat_intelligence_matches: {
        Row: {
          asset_id: string | null
          confidence_score: number | null
          discovery_execution_id: string | null
          false_positive: boolean | null
          first_detected: string
          id: string
          indicator_type: string
          is_confirmed: boolean | null
          last_seen: string
          organization_id: string
          remediation_status: string | null
          severity_level: string | null
          threat_category: string | null
          threat_details: Json | null
          threat_indicator: string
          threat_source: string
        }
        Insert: {
          asset_id?: string | null
          confidence_score?: number | null
          discovery_execution_id?: string | null
          false_positive?: boolean | null
          first_detected?: string
          id?: string
          indicator_type: string
          is_confirmed?: boolean | null
          last_seen?: string
          organization_id: string
          remediation_status?: string | null
          severity_level?: string | null
          threat_category?: string | null
          threat_details?: Json | null
          threat_indicator: string
          threat_source: string
        }
        Update: {
          asset_id?: string | null
          confidence_score?: number | null
          discovery_execution_id?: string | null
          false_positive?: boolean | null
          first_detected?: string
          id?: string
          indicator_type?: string
          is_confirmed?: boolean | null
          last_seen?: string
          organization_id?: string
          remediation_status?: string | null
          severity_level?: string | null
          threat_category?: string | null
          threat_details?: Json | null
          threat_indicator?: string
          threat_source?: string
        }
        Relationships: [
          {
            foreignKeyName: "threat_intelligence_matches_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "discovered_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "threat_intelligence_matches_discovery_execution_id_fkey"
            columns: ["discovery_execution_id"]
            isOneToOne: false
            referencedRelation: "discovery_executions"
            referencedColumns: ["id"]
          },
        ]
      }
      threat_investigations: {
        Row: {
          created_at: string | null
          created_by: string | null
          external_references: Json | null
          id: string
          indicator_type: string
          investigation_notes: string | null
          investigation_status: string | null
          organization_id: string
          real_or_simulated: string | null
          threat_indicator: string
          threat_level: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          external_references?: Json | null
          id?: string
          indicator_type: string
          investigation_notes?: string | null
          investigation_status?: string | null
          organization_id: string
          real_or_simulated?: string | null
          threat_indicator: string
          threat_level?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          external_references?: Json | null
          id?: string
          indicator_type?: string
          investigation_notes?: string | null
          investigation_status?: string | null
          organization_id?: string
          real_or_simulated?: string | null
          threat_indicator?: string
          threat_level?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      transformation_rules: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          id: string
          is_reusable: boolean | null
          jsonata_expression: string | null
          organization_id: string | null
          performance_metrics: Json | null
          rule_name: string
          source_schema_id: string | null
          stig_compliance_rules: Json | null
          target_schema_id: string | null
          transformation_logic: Json
          updated_at: string
          validation_tests: Json | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_reusable?: boolean | null
          jsonata_expression?: string | null
          organization_id?: string | null
          performance_metrics?: Json | null
          rule_name: string
          source_schema_id?: string | null
          stig_compliance_rules?: Json | null
          target_schema_id?: string | null
          transformation_logic: Json
          updated_at?: string
          validation_tests?: Json | null
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_reusable?: boolean | null
          jsonata_expression?: string | null
          organization_id?: string | null
          performance_metrics?: Json | null
          rule_name?: string
          source_schema_id?: string | null
          stig_compliance_rules?: Json | null
          target_schema_id?: string | null
          transformation_logic?: Json
          updated_at?: string
          validation_tests?: Json | null
        }
        Relationships: []
      }
      trusted_devices: {
        Row: {
          device_fingerprint: string
          device_name: string | null
          expires_at: string | null
          id: string
          ip_address: unknown
          is_active: boolean | null
          last_used: string | null
          trusted_at: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          device_fingerprint: string
          device_name?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: unknown
          is_active?: boolean | null
          last_used?: string | null
          trusted_at?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          device_fingerprint?: string
          device_name?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: unknown
          is_active?: boolean | null
          last_used?: string | null
          trusted_at?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      trusted_file_registry: {
        Row: {
          added_by: string | null
          certificate_chain: Json | null
          created_at: string
          digital_signature: Json | null
          file_category: string
          file_hash: string
          file_name: string
          file_path_pattern: string | null
          id: string
          last_seen: string | null
          organization_id: string
          stig_compliance_status: Json | null
          threat_intelligence_score: number | null
          trust_level: number
          updated_at: string
          usage_count: number | null
          vendor_info: Json | null
          verification_date: string | null
          verified_by: string | null
          whitelist_reason: string | null
        }
        Insert: {
          added_by?: string | null
          certificate_chain?: Json | null
          created_at?: string
          digital_signature?: Json | null
          file_category: string
          file_hash: string
          file_name: string
          file_path_pattern?: string | null
          id?: string
          last_seen?: string | null
          organization_id: string
          stig_compliance_status?: Json | null
          threat_intelligence_score?: number | null
          trust_level?: number
          updated_at?: string
          usage_count?: number | null
          vendor_info?: Json | null
          verification_date?: string | null
          verified_by?: string | null
          whitelist_reason?: string | null
        }
        Update: {
          added_by?: string | null
          certificate_chain?: Json | null
          created_at?: string
          digital_signature?: Json | null
          file_category?: string
          file_hash?: string
          file_name?: string
          file_path_pattern?: string | null
          id?: string
          last_seen?: string | null
          organization_id?: string
          stig_compliance_status?: Json | null
          threat_intelligence_score?: number | null
          trust_level?: number
          updated_at?: string
          usage_count?: number | null
          vendor_info?: Json | null
          verification_date?: string | null
          verified_by?: string | null
          whitelist_reason?: string | null
        }
        Relationships: []
      }
      usage_quotas: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          overage_rate: number | null
          quota_limit: number
          quota_period: string
          resource_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          overage_rate?: number | null
          quota_limit: number
          quota_period?: string
          resource_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          overage_rate?: number | null
          quota_limit?: number
          quota_period?: string
          resource_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_agreements: {
        Row: {
          accepted_at: string
          agreement_type: string
          agreement_version: string
          created_at: string
          id: string
          ip_address: unknown
          metadata: Json | null
          organization_id: string | null
          revoked_at: string | null
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          accepted_at?: string
          agreement_type: string
          agreement_version?: string
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          organization_id?: string | null
          revoked_at?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          accepted_at?: string
          agreement_type?: string
          agreement_version?: string
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          organization_id?: string | null
          revoked_at?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_agreements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_integrations: {
        Row: {
          config: Json
          created_at: string
          created_by: string | null
          encrypted_credentials: string | null
          error_message: string | null
          health_status: string | null
          id: string
          integration_id: string
          last_sync: string | null
          name: string
          organization_id: string
          status: string
          sync_frequency: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          created_by?: string | null
          encrypted_credentials?: string | null
          error_message?: string | null
          health_status?: string | null
          id?: string
          integration_id: string
          last_sync?: string | null
          name: string
          organization_id: string
          status?: string
          sync_frequency?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string | null
          encrypted_credentials?: string | null
          error_message?: string | null
          health_status?: string | null
          id?: string
          integration_id?: string
          last_sync?: string | null
          name?: string
          organization_id?: string
          status?: string
          sync_frequency?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_integrations_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations_library"
            referencedColumns: ["id"]
          },
        ]
      }
      user_organizations: {
        Row: {
          created_at: string
          id: string
          invited_at: string | null
          invited_by: string | null
          joined_at: string | null
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          joined_at?: string | null
          organization_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          joined_at?: string | null
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_organizations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_organizations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_organizations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_organizations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_organizations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_roles: {
        Row: {
          granted_at: string
          granted_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vulnerability_scans: {
        Row: {
          critical_count: number | null
          high_count: number | null
          id: string
          low_count: number | null
          medium_count: number | null
          organization_id: string
          results: Json
          scan_date: string
          scan_status: string | null
          scan_type: string
          targets: Json
          total_vulnerabilities: number | null
        }
        Insert: {
          critical_count?: number | null
          high_count?: number | null
          id?: string
          low_count?: number | null
          medium_count?: number | null
          organization_id: string
          results?: Json
          scan_date?: string
          scan_status?: string | null
          scan_type: string
          targets?: Json
          total_vulnerabilities?: number | null
        }
        Update: {
          critical_count?: number | null
          high_count?: number | null
          id?: string
          low_count?: number | null
          medium_count?: number | null
          organization_id?: string
          results?: Json
          scan_date?: string
          scan_status?: string | null
          scan_type?: string
          targets?: Json
          total_vulnerabilities?: number | null
        }
        Relationships: []
      }
      webhook_activity: {
        Row: {
          created_at: string | null
          endpoint: string | null
          id: string
          payload_hash: string | null
          processing_time_ms: number | null
          rate_limit_applied: boolean | null
          source: string
          source_ip: unknown
          user_agent: string | null
          validation_result: Json | null
        }
        Insert: {
          created_at?: string | null
          endpoint?: string | null
          id?: string
          payload_hash?: string | null
          processing_time_ms?: number | null
          rate_limit_applied?: boolean | null
          source: string
          source_ip?: unknown
          user_agent?: string | null
          validation_result?: Json | null
        }
        Update: {
          created_at?: string | null
          endpoint?: string | null
          id?: string
          payload_hash?: string | null
          processing_time_ms?: number | null
          rate_limit_applied?: boolean | null
          source?: string
          source_ip?: unknown
          user_agent?: string | null
          validation_result?: Json | null
        }
        Relationships: []
      }
      zero_trust_access_decisions: {
        Row: {
          conditions_applied: Json | null
          confidence_score: number
          context_data: Json | null
          decision: string
          decision_timestamp: string
          factors_evaluated: Json
          id: string
          ip_address: unknown
          organization_id: string
          policy_violations: Json | null
          resource_id: string | null
          resource_type: string
          session_id: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          conditions_applied?: Json | null
          confidence_score: number
          context_data?: Json | null
          decision: string
          decision_timestamp?: string
          factors_evaluated?: Json
          id?: string
          ip_address?: unknown
          organization_id: string
          policy_violations?: Json | null
          resource_id?: string | null
          resource_type: string
          session_id?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          conditions_applied?: Json | null
          confidence_score?: number
          context_data?: Json | null
          decision?: string
          decision_timestamp?: string
          factors_evaluated?: Json
          id?: string
          ip_address?: unknown
          organization_id?: string
          policy_violations?: Json | null
          resource_id?: string | null
          resource_type?: string
          session_id?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      zero_trust_device_assessments: {
        Row: {
          assessment_timestamp: string
          behavioral_score: number | null
          compliance_status: Json | null
          device_fingerprint: string
          id: string
          last_validation: string | null
          network_context: Json | null
          organization_id: string
          remediation_actions: Json | null
          remediation_required: boolean | null
          risk_factors: Json | null
          security_posture: Json | null
          trust_score: number
          user_id: string
          validation_result: string | null
        }
        Insert: {
          assessment_timestamp?: string
          behavioral_score?: number | null
          compliance_status?: Json | null
          device_fingerprint: string
          id?: string
          last_validation?: string | null
          network_context?: Json | null
          organization_id: string
          remediation_actions?: Json | null
          remediation_required?: boolean | null
          risk_factors?: Json | null
          security_posture?: Json | null
          trust_score: number
          user_id: string
          validation_result?: string | null
        }
        Update: {
          assessment_timestamp?: string
          behavioral_score?: number | null
          compliance_status?: Json | null
          device_fingerprint?: string
          id?: string
          last_validation?: string | null
          network_context?: Json | null
          organization_id?: string
          remediation_actions?: Json | null
          remediation_required?: boolean | null
          risk_factors?: Json | null
          security_posture?: Json | null
          trust_score?: number
          user_id?: string
          validation_result?: string | null
        }
        Relationships: []
      }
      zero_trust_network_segments: {
        Row: {
          access_policies: Json
          allowed_protocols: Json | null
          created_at: string
          id: string
          isolation_rules: Json | null
          micro_segmentation_enabled: boolean | null
          monitoring_level: string | null
          network_ranges: Json
          organization_id: string
          segment_name: string
          segment_type: string
          updated_at: string
        }
        Insert: {
          access_policies?: Json
          allowed_protocols?: Json | null
          created_at?: string
          id?: string
          isolation_rules?: Json | null
          micro_segmentation_enabled?: boolean | null
          monitoring_level?: string | null
          network_ranges?: Json
          organization_id: string
          segment_name: string
          segment_type: string
          updated_at?: string
        }
        Update: {
          access_policies?: Json
          allowed_protocols?: Json | null
          created_at?: string
          id?: string
          isolation_rules?: Json | null
          micro_segmentation_enabled?: boolean | null
          monitoring_level?: string | null
          network_ranges?: Json
          organization_id?: string
          segment_name?: string
          segment_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      zero_trust_policies: {
        Row: {
          actions: Json
          conditions: Json
          created_at: string
          created_by: string | null
          enabled: boolean | null
          enforcement_level: string | null
          id: string
          organization_id: string
          policy_config: Json
          policy_name: string
          policy_type: string
          risk_threshold: number | null
          updated_at: string
        }
        Insert: {
          actions?: Json
          conditions?: Json
          created_at?: string
          created_by?: string | null
          enabled?: boolean | null
          enforcement_level?: string | null
          id?: string
          organization_id: string
          policy_config?: Json
          policy_name: string
          policy_type: string
          risk_threshold?: number | null
          updated_at?: string
        }
        Update: {
          actions?: Json
          conditions?: Json
          created_at?: string
          created_by?: string | null
          enabled?: boolean | null
          enforcement_level?: string | null
          id?: string
          organization_id?: string
          policy_config?: Json
          policy_name?: string
          policy_type?: string
          risk_threshold?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      zero_trust_risk_assessments: {
        Row: {
          assessment_timestamp: string
          assessment_type: string
          behavioral_anomalies: Json | null
          compliance_score: number | null
          expires_at: string | null
          id: string
          organization_id: string
          overall_risk_score: number
          recommendations: Json | null
          risk_categories: Json
          status: string | null
          subject_id: string
          threat_indicators: Json | null
          vulnerability_score: number | null
        }
        Insert: {
          assessment_timestamp?: string
          assessment_type: string
          behavioral_anomalies?: Json | null
          compliance_score?: number | null
          expires_at?: string | null
          id?: string
          organization_id: string
          overall_risk_score: number
          recommendations?: Json | null
          risk_categories?: Json
          status?: string | null
          subject_id: string
          threat_indicators?: Json | null
          vulnerability_score?: number | null
        }
        Update: {
          assessment_timestamp?: string
          assessment_type?: string
          behavioral_anomalies?: Json | null
          compliance_score?: number | null
          expires_at?: string | null
          id?: string
          organization_id?: string
          overall_risk_score?: number
          recommendations?: Json | null
          risk_categories?: Json
          status?: string | null
          subject_id?: string
          threat_indicators?: Json | null
          vulnerability_score?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      notifications_secure: {
        Row: {
          alert_id: string | null
          channel: string | null
          created_at: string | null
          delivered_at: string | null
          error_message: string | null
          external_id: string | null
          id: string | null
          message_content: Json | null
          recipient_email: string | null
          recipient_id: string | null
          recipient_phone: string | null
          sent_at: string | null
          status: string | null
        }
        Insert: {
          alert_id?: string | null
          channel?: string | null
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          external_id?: string | null
          id?: string | null
          message_content?: never
          recipient_email?: never
          recipient_id?: string | null
          recipient_phone?: never
          sent_at?: string | null
          status?: string | null
        }
        Update: {
          alert_id?: string | null
          channel?: string | null
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          external_id?: string | null
          id?: string | null
          message_content?: never
          recipient_email?: never
          recipient_id?: string | null
          recipient_phone?: never
          sent_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles_secure: {
        Row: {
          created_at: string | null
          department: string | null
          full_name: string | null
          id: string | null
          is_trial_active: boolean | null
          master_admin: boolean | null
          mfa_enabled: boolean | null
          mfa_status: string | null
          plan_type: string | null
          role: string | null
          security_clearance: string | null
          trial_ends_at: string | null
          trial_starts_at: string | null
          updated_at: string | null
          user_id: string | null
          username: string | null
        }
        Insert: {
          created_at?: string | null
          department?: never
          full_name?: never
          id?: string | null
          is_trial_active?: boolean | null
          master_admin?: boolean | null
          mfa_enabled?: boolean | null
          mfa_status?: never
          plan_type?: string | null
          role?: string | null
          security_clearance?: never
          trial_ends_at?: string | null
          trial_starts_at?: string | null
          updated_at?: string | null
          user_id?: string | null
          username?: string | null
        }
        Update: {
          created_at?: string | null
          department?: never
          full_name?: never
          id?: string | null
          is_trial_active?: boolean | null
          master_admin?: boolean | null
          mfa_enabled?: boolean | null
          mfa_status?: never
          plan_type?: string | null
          role?: string | null
          security_clearance?: never
          trial_ends_at?: string | null
          trial_starts_at?: string | null
          updated_at?: string | null
          user_id?: string | null
          username?: string | null
        }
        Relationships: []
      }
      usage_costs_summary: {
        Row: {
          avg_cost_per_unit: number | null
          billing_period: string | null
          organization_id: string | null
          resource_type: string | null
          total_cost: number | null
          total_quantity: number | null
          unit: string | null
          usage_events: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      analyze_component_vulnerabilities: {
        Args: {
          component_name: string
          component_version: string
          cpe_identifier?: string
        }
        Returns: Json
      }
      can_view_full_pii: { Args: never; Returns: boolean }
      check_beta_asset_limit: { Args: { user_uuid: string }; Returns: boolean }
      check_document_permission: {
        Args: { doc_id: string; permission: string; user_uuid: string }
        Returns: boolean
      }
      check_security_policy_compliance: { Args: never; Returns: Json }
      cleanup_expired_guest_carts: { Args: never; Returns: number }
      cleanup_expired_password_reset_otps: { Args: never; Returns: number }
      comprehensive_security_audit: {
        Args: never
        Returns: {
          audit_type: string
          details: Json
          findings_count: number
          severity: string
        }[]
      }
      correlate_fim_changes_with_threats: {
        Args: { change_event_id: string; threat_indicators?: Json }
        Returns: Json
      }
      correlate_security_alerts: { Args: never; Returns: undefined }
      correlate_security_events: {
        Args: {
          event_details: Json
          event_type: string
          organization_id: string
          source_ip?: unknown
        }
        Returns: string
      }
      decrypt_credential_data: {
        Args: { encrypted_data: string; key_name?: string }
        Returns: Json
      }
      decrypt_sensitive_data: {
        Args: { encrypted_data: string; key_name?: string }
        Returns: string
      }
      encrypt_credential_data: {
        Args: { credential_data: Json; key_name?: string }
        Returns: string
      }
      encrypt_sensitive_data: {
        Args: { data_text: string; key_name?: string }
        Returns: string
      }
      get_available_adapters: {
        Args: { env_type?: string; org_id: string }
        Returns: Json
      }
      get_beta_tier: { Args: { user_uuid: string }; Returns: string }
      get_current_user_role: { Args: never; Returns: string }
      get_evidence_requiring_review: {
        Args: never
        Returns: {
          collection_date: string
          days_since_review: number
          evidence_id: string
          retention_expires_at: string
        }[]
      }
      get_notification_analytics: {
        Args: never
        Returns: {
          channels: Json
          delivered_count: number
          failed_count: number
          pending_count: number
          sent_count: number
          total_notifications: number
        }[]
      }
      get_sanitized_integration_config: {
        Args: { config_id: string }
        Returns: Json
      }
      get_trial_days_remaining: { Args: { user_uuid: string }; Returns: number }
      get_user_organizations: { Args: never; Returns: string[] }
      get_user_role_in_organization: {
        Args: { org_id: string }
        Returns: string
      }
      get_user_security_clearance: {
        Args: { user_uuid?: string }
        Returns: string
      }
      has_accepted_all_agreements: {
        Args: { user_uuid: string }
        Returns: boolean
      }
      has_admin_role: { Args: { role_name: string }; Returns: boolean }
      has_beta_access: { Args: { user_uuid: string }; Returns: boolean }
      has_enterprise_access: { Args: { user_uuid: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_security_clearance: {
        Args: { required_level?: string }
        Returns: boolean
      }
      is_account_locked: { Args: { user_email: string }; Returns: boolean }
      is_master_admin: { Args: never; Returns: boolean }
      is_organization_member: { Args: { org_id: string }; Returns: boolean }
      is_trial_active: { Args: { user_uuid: string }; Returns: boolean }
      log_clearance_access: {
        Args: {
          access_granted: boolean
          required_clearance: string
          resource_id: string
          resource_type: string
        }
        Returns: undefined
      }
      log_document_action: {
        Args: {
          action_name: string
          doc_id: string
          new_vals?: Json
          old_vals?: Json
        }
        Returns: undefined
      }
      log_security_event: {
        Args: { details?: Json; event_type: string; severity?: string }
        Returns: undefined
      }
      log_security_event_enhanced: {
        Args: {
          details?: Json
          event_type: string
          severity?: string
          user_context?: Json
        }
        Returns: string
      }
      log_security_monitoring_event: {
        Args: {
          p_details?: Json
          p_event_type: string
          p_severity?: string
          p_source_id?: string
          p_source_table?: string
        }
        Returns: undefined
      }
      log_sensitive_data_access: {
        Args: { access_type: string; record_id: string; table_name: string }
        Returns: undefined
      }
      log_sensitive_data_access_enhanced: {
        Args: {
          access_type: string
          data_classification?: string
          record_id: string
          table_name: string
        }
        Returns: undefined
      }
      log_sensitive_data_access_v2: {
        Args: {
          access_type: string
          classification?: string
          table_name: string
        }
        Returns: undefined
      }
      log_sensitive_operation: {
        Args: {
          details?: Json
          operation_type: string
          record_id?: string
          table_name: string
        }
        Returns: undefined
      }
      log_session_security_event: {
        Args: {
          p_details?: Json
          p_device_fingerprint?: string
          p_event_type: string
          p_risk_level?: string
        }
        Returns: undefined
      }
      log_system_audit: {
        Args: {
          p_action: string
          p_details?: Json
          p_resource_id?: string
          p_resource_type?: string
          p_user_id?: string
        }
        Returns: undefined
      }
      log_third_party_security_event: {
        Args: {
          p_details?: Json
          p_event_type: string
          p_severity?: string
          p_tester_id: string
        }
        Returns: string
      }
      log_user_action: {
        Args: {
          action_type: string
          details?: Json
          resource_id?: string
          resource_type?: string
        }
        Returns: undefined
      }
      mask_email: { Args: { email: string }; Returns: string }
      mask_phone: { Args: { phone: string }; Returns: string }
      match_asset_to_stigs: {
        Args: {
          asset_os: string
          asset_platform: string
          asset_version: string
          detected_services?: Json
        }
        Returns: Json
      }
      meets_security_clearance: {
        Args: { required_level: string; user_uuid?: string }
        Returns: boolean
      }
      is_sunsum_diminished: {
        Args: {
          user_email: string
        }
        Returns: boolean
      }
      monitor_failed_auth_attempts: { Args: never; Returns: undefined }
      record_failed_login: {
        Args: {
          client_ip?: unknown
          client_user_agent?: string
          user_email: string
        }
        Returns: undefined
      }
      record_ritual_lapse: {
        Args: {
          client_ip?: unknown
          client_user_agent?: string
          user_email: string
        }
        Returns: undefined
      }
      rotate_encryption_keys: { Args: never; Returns: boolean }
      secure_cleanup_expired_otps: { Args: never; Returns: number }
      track_resource_usage: {
        Args: {
          p_metadata?: Json
          p_organization_id: string
          p_quantity: number
          p_resource_type: string
          p_unit: string
        }
        Returns: string
      }
      validate_password_strength: { Args: { password: string }; Returns: Json }
      validate_security_configuration: { Args: never; Returns: Json }
      validate_stig_compliance_automated: {
        Args: { asset_id: string; org_id: string; stig_rules?: string[] }
        Returns: Json
      }
    }
    Enums: {
      app_role:
      | "admin"
      | "analyst"
      | "compliance_officer"
      | "operator"
      | "viewer"
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
      app_role: [
        "admin",
        "analyst",
        "compliance_officer",
        "operator",
        "viewer",
      ],
    },
  },
} as const
