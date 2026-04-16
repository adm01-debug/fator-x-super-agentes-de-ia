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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      access_blocked_log: {
        Row: {
          country_code: string | null
          created_at: string
          id: string
          ip_address: string | null
          metadata: Json | null
          reason: string
          user_agent: string | null
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          country_code?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          reason: string
          user_agent?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          country_code?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          reason?: string
          user_agent?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_blocked_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_installed_skills: {
        Row: {
          agent_id: string
          config_overrides: Json | null
          id: string
          installed_at: string
          skill_id: string
        }
        Insert: {
          agent_id: string
          config_overrides?: Json | null
          id?: string
          installed_at?: string
          skill_id: string
        }
        Update: {
          agent_id?: string
          config_overrides?: Json | null
          id?: string
          installed_at?: string
          skill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_installed_skills_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_installed_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skill_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_installed_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skill_registry_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_memories: {
        Row: {
          content: string
          created_at: string
          id: string
          memory_type: string
          relevance_score: number | null
          source: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          memory_type?: string
          relevance_score?: number | null
          source?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          memory_type?: string
          relevance_score?: number | null
          source?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_memories_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_skills: {
        Row: {
          agent_id: string
          confidence: number
          created_at: string
          description: string
          failure_count: number
          id: string
          pattern: string
          skill_name: string
          source_trace_id: string | null
          success_count: number
          updated_at: string
        }
        Insert: {
          agent_id: string
          confidence?: number
          created_at?: string
          description?: string
          failure_count?: number
          id?: string
          pattern?: string
          skill_name: string
          source_trace_id?: string | null
          success_count?: number
          updated_at?: string
        }
        Update: {
          agent_id?: string
          confidence?: number
          created_at?: string
          description?: string
          failure_count?: number
          id?: string
          pattern?: string
          skill_name?: string
          source_trace_id?: string | null
          success_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_skills_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_templates: {
        Row: {
          category: string | null
          config: Json
          created_at: string | null
          created_by: string | null
          description: string | null
          icon: string | null
          id: string
          is_public: boolean | null
          name: string
          usage_count: number | null
        }
        Insert: {
          category?: string | null
          config?: Json
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_public?: boolean | null
          name: string
          usage_count?: number | null
        }
        Update: {
          category?: string | null
          config?: Json
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_public?: boolean | null
          name?: string
          usage_count?: number | null
        }
        Relationships: []
      }
      agent_traces: {
        Row: {
          agent_id: string
          cost_usd: number | null
          created_at: string
          event: string
          id: string
          input: Json | null
          latency_ms: number | null
          level: Database["public"]["Enums"]["trace_level"] | null
          metadata: Json | null
          output: Json | null
          session_id: string | null
          tokens_used: number | null
          user_id: string
        }
        Insert: {
          agent_id: string
          cost_usd?: number | null
          created_at?: string
          event: string
          id?: string
          input?: Json | null
          latency_ms?: number | null
          level?: Database["public"]["Enums"]["trace_level"] | null
          metadata?: Json | null
          output?: Json | null
          session_id?: string | null
          tokens_used?: number | null
          user_id: string
        }
        Update: {
          agent_id?: string
          cost_usd?: number | null
          created_at?: string
          event?: string
          id?: string
          input?: Json | null
          latency_ms?: number | null
          level?: Database["public"]["Enums"]["trace_level"] | null
          metadata?: Json | null
          output?: Json | null
          session_id?: string | null
          tokens_used?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_traces_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_usage: {
        Row: {
          agent_id: string
          avg_latency_ms: number | null
          created_at: string
          date: string
          error_count: number | null
          id: string
          requests: number | null
          tokens_input: number | null
          tokens_output: number | null
          total_cost_usd: number | null
          user_id: string
        }
        Insert: {
          agent_id: string
          avg_latency_ms?: number | null
          created_at?: string
          date?: string
          error_count?: number | null
          id?: string
          requests?: number | null
          tokens_input?: number | null
          tokens_output?: number | null
          total_cost_usd?: number | null
          user_id: string
        }
        Update: {
          agent_id?: string
          avg_latency_ms?: number | null
          created_at?: string
          date?: string
          error_count?: number | null
          id?: string
          requests?: number | null
          tokens_input?: number | null
          tokens_output?: number | null
          total_cost_usd?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_usage_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_versions: {
        Row: {
          agent_id: string
          change_summary: string | null
          config: Json
          created_at: string
          created_by: string | null
          id: string
          mission: string | null
          model: string | null
          name: string | null
          persona: string | null
          version: number
        }
        Insert: {
          agent_id: string
          change_summary?: string | null
          config?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          mission?: string | null
          model?: string | null
          name?: string | null
          persona?: string | null
          version?: number
        }
        Update: {
          agent_id?: string
          change_summary?: string | null
          config?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          mission?: string | null
          model?: string | null
          name?: string | null
          persona?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "agent_versions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          avatar_emoji: string | null
          config: Json
          created_at: string
          id: string
          is_template: boolean | null
          mission: string | null
          model: string | null
          name: string
          persona: string | null
          reasoning: string | null
          status: Database["public"]["Enums"]["agent_status"] | null
          tags: string[] | null
          template_category: string | null
          updated_at: string
          user_id: string
          version: number | null
          workspace_id: string | null
        }
        Insert: {
          avatar_emoji?: string | null
          config?: Json
          created_at?: string
          id?: string
          is_template?: boolean | null
          mission?: string | null
          model?: string | null
          name: string
          persona?: string | null
          reasoning?: string | null
          status?: Database["public"]["Enums"]["agent_status"] | null
          tags?: string[] | null
          template_category?: string | null
          updated_at?: string
          user_id: string
          version?: number | null
          workspace_id?: string | null
        }
        Update: {
          avatar_emoji?: string | null
          config?: Json
          created_at?: string
          id?: string
          is_template?: boolean | null
          mission?: string | null
          model?: string | null
          name?: string
          persona?: string | null
          reasoning?: string | null
          status?: Database["public"]["Enums"]["agent_status"] | null
          tags?: string[] | null
          template_category?: string | null
          updated_at?: string
          user_id?: string
          version?: number | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          agent_id: string | null
          created_at: string | null
          id: string
          is_resolved: boolean | null
          message: string | null
          resolved_at: string | null
          severity: string | null
          title: string
          workspace_id: string | null
        }
        Insert: {
          agent_id?: string | null
          created_at?: string | null
          id?: string
          is_resolved?: boolean | null
          message?: string | null
          resolved_at?: string | null
          severity?: string | null
          title: string
          workspace_id?: string | null
        }
        Update: {
          agent_id?: string | null
          created_at?: string | null
          id?: string
          is_resolved?: boolean | null
          message?: string | null
          resolved_at?: string | null
          severity?: string | null
          title?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alerts_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          scopes: string[] | null
          updated_at: string | null
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          scopes?: string[] | null
          updated_at?: string | null
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          scopes?: string[] | null
          updated_at?: string | null
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          ip_address: string | null
          metadata: Json | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      budgets: {
        Row: {
          alert_threshold: number | null
          created_at: string | null
          current_usd: number | null
          id: string
          is_active: boolean | null
          limit_usd: number
          name: string
          period: string | null
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          alert_threshold?: number | null
          created_at?: string | null
          current_usd?: number | null
          id?: string
          is_active?: boolean | null
          limit_usd?: number
          name?: string
          period?: string | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          alert_threshold?: number | null
          created_at?: string | null
          current_usd?: number | null
          id?: string
          is_active?: boolean | null
          limit_usd?: number
          name?: string
          period?: string | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budgets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string | null
          document_id: string | null
          embedding_status: string | null
          id: string
          metadata: Json | null
          token_count: number | null
        }
        Insert: {
          chunk_index?: number
          content: string
          created_at?: string | null
          document_id?: string | null
          embedding_status?: string | null
          id?: string
          metadata?: Json | null
          token_count?: number | null
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string | null
          document_id?: string | null
          embedding_status?: string | null
          id?: string
          metadata?: Json | null
          token_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          knowledge_base_id: string | null
          metadata: Json | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          knowledge_base_id?: string | null
          metadata?: Json | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          knowledge_base_id?: string | null
          metadata?: Json | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collections_knowledge_base_id_fkey"
            columns: ["knowledge_base_id"]
            isOneToOne: false
            referencedRelation: "knowledge_bases"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_records: {
        Row: {
          consent_type: string
          created_at: string
          granted: boolean
          id: string
          ip_address: string | null
          metadata: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          consent_type: string
          created_at?: string
          granted?: boolean
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          consent_type?: string
          created_at?: string
          granted?: boolean
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      data_deletion_requests: {
        Row: {
          completed_at: string | null
          id: string
          metadata: Json | null
          reason: string | null
          requested_at: string
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          metadata?: Json | null
          reason?: string | null
          requested_at?: string
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          metadata?: Json | null
          reason?: string | null
          requested_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      deploy_connections: {
        Row: {
          agent_id: string
          channel: string
          config: Json | null
          created_at: string
          error_message: string | null
          id: string
          last_message_at: string | null
          message_count: number | null
          status: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          agent_id: string
          channel: string
          config?: Json | null
          created_at?: string
          error_message?: string | null
          id?: string
          last_message_at?: string | null
          message_count?: number | null
          status?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          agent_id?: string
          channel?: string
          config?: Json | null
          created_at?: string
          error_message?: string | null
          id?: string
          last_message_at?: string | null
          message_count?: number | null
          status?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deploy_connections_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deploy_connections_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          collection_id: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          mime_type: string | null
          size_bytes: number | null
          source_type: string | null
          source_url: string | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          collection_id?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          mime_type?: string | null
          size_bytes?: number | null
          source_type?: string | null
          source_url?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          collection_id?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          mime_type?: string | null
          size_bytes?: number | null
          source_type?: string | null
          source_url?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      environments: {
        Row: {
          config: Json | null
          created_at: string | null
          id: string
          name: string
          workspace_id: string | null
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          id?: string
          name?: string
          workspace_id?: string | null
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          id?: string
          name?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "environments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_datasets: {
        Row: {
          case_count: number | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          case_count?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          case_count?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_datasets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_runs: {
        Row: {
          agent_id: string | null
          completed_at: string | null
          created_at: string | null
          id: string
          name: string
          pass_rate: number | null
          results: Json | null
          status: string | null
          test_cases: number | null
          workspace_id: string | null
        }
        Insert: {
          agent_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          name: string
          pass_rate?: number | null
          results?: Json | null
          status?: string | null
          test_cases?: number | null
          workspace_id?: string | null
        }
        Update: {
          agent_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          name?: string
          pass_rate?: number | null
          results?: Json | null
          status?: string | null
          test_cases?: number | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_runs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      forensic_snapshots: {
        Row: {
          agent_id: string
          chain_hash: string
          created_at: string
          decision_rationale: string
          decision_type: string
          execution_id: string
          id: string
          input_hash: string
          metadata: Json | null
          output_hash: string
          previous_hash: string
          state_after: Json
          state_before: Json
          step_index: number
        }
        Insert: {
          agent_id: string
          chain_hash: string
          created_at?: string
          decision_rationale?: string
          decision_type?: string
          execution_id: string
          id?: string
          input_hash: string
          metadata?: Json | null
          output_hash: string
          previous_hash?: string
          state_after?: Json
          state_before?: Json
          step_index?: number
        }
        Update: {
          agent_id?: string
          chain_hash?: string
          created_at?: string
          decision_rationale?: string
          decision_type?: string
          execution_id?: string
          id?: string
          input_hash?: string
          metadata?: Json | null
          output_hash?: string
          previous_hash?: string
          state_after?: Json
          state_before?: Json
          step_index?: number
        }
        Relationships: []
      }
      geo_allowed_countries: {
        Row: {
          country_code: string
          country_name: string | null
          created_at: string
          created_by: string | null
          id: string
          workspace_id: string
        }
        Insert: {
          country_code: string
          country_name?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          workspace_id: string
        }
        Update: {
          country_code?: string
          country_name?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "geo_allowed_countries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      guardrail_policies: {
        Row: {
          config: Json | null
          created_at: string | null
          id: string
          is_enabled: boolean | null
          name: string
          type: string
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          name: string
          type?: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          name?: string
          type?: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guardrail_policies_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ip_whitelist: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          ip_address: string
          is_active: boolean
          label: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          ip_address: string
          is_active?: boolean
          label?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          ip_address?: string
          is_active?: boolean
          label?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ip_whitelist_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_bases: {
        Row: {
          chunk_count: number | null
          created_at: string | null
          description: string | null
          document_count: number | null
          embedding_model: string | null
          id: string
          name: string
          status: string | null
          updated_at: string | null
          vector_db: string | null
          workspace_id: string | null
        }
        Insert: {
          chunk_count?: number | null
          created_at?: string | null
          description?: string | null
          document_count?: number | null
          embedding_model?: string | null
          id?: string
          name: string
          status?: string | null
          updated_at?: string | null
          vector_db?: string | null
          workspace_id?: string | null
        }
        Update: {
          chunk_count?: number | null
          created_at?: string | null
          description?: string | null
          document_count?: number | null
          embedding_model?: string | null
          id?: string
          name?: string
          status?: string | null
          updated_at?: string | null
          vector_db?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_bases_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      model_pricing: {
        Row: {
          created_at: string
          id: string
          input_cost_per_1k: number
          model_pattern: string
          output_cost_per_1k: number
        }
        Insert: {
          created_at?: string
          id?: string
          input_cost_per_1k?: number
          model_pattern: string
          output_cost_per_1k?: number
        }
        Update: {
          created_at?: string
          id?: string
          input_cost_per_1k?: number
          model_pattern?: string
          output_cost_per_1k?: number
        }
        Relationships: []
      }
      oracle_history: {
        Row: {
          chairman_model: string | null
          confidence_score: number | null
          consensus_degree: number | null
          created_at: string
          enable_thinking: boolean | null
          id: string
          mode: string
          models_used: number | null
          preset_id: string
          preset_name: string | null
          query: string
          results: Json
          total_cost_usd: number | null
          total_latency_ms: number | null
          total_tokens: number | null
          user_id: string
        }
        Insert: {
          chairman_model?: string | null
          confidence_score?: number | null
          consensus_degree?: number | null
          created_at?: string
          enable_thinking?: boolean | null
          id?: string
          mode: string
          models_used?: number | null
          preset_id: string
          preset_name?: string | null
          query: string
          results?: Json
          total_cost_usd?: number | null
          total_latency_ms?: number | null
          total_tokens?: number | null
          user_id: string
        }
        Update: {
          chairman_model?: string | null
          confidence_score?: number | null
          consensus_degree?: number | null
          created_at?: string
          enable_thinking?: boolean | null
          id?: string
          mode?: string
          models_used?: number | null
          preset_id?: string
          preset_name?: string | null
          query?: string
          results?: Json
          total_cost_usd?: number | null
          total_latency_ms?: number | null
          total_tokens?: number | null
          user_id?: string
        }
        Relationships: []
      }
      permissions: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          key: string
          module: string
          name: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          key: string
          module: string
          name: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          key?: string
          module?: string
          name?: string
        }
        Relationships: []
      }
      prompt_versions: {
        Row: {
          agent_id: string
          change_summary: string | null
          content: string
          created_at: string
          id: string
          is_active: boolean | null
          user_id: string
          version: number
        }
        Insert: {
          agent_id: string
          change_summary?: string | null
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          user_id: string
          version?: number
        }
        Update: {
          agent_id?: string
          change_summary?: string | null
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "prompt_versions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          color: string
          created_at: string
          description: string | null
          icon: string
          id: string
          is_active: boolean
          is_system: boolean
          key: string
          level: number
          name: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          key: string
          level?: number
          name: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          key?: string
          level?: number
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      session_traces: {
        Row: {
          cost_usd: number | null
          created_at: string | null
          id: string
          input: Json | null
          latency_ms: number | null
          metadata: Json | null
          output: Json | null
          session_id: string | null
          tokens_used: number | null
          trace_type: string
        }
        Insert: {
          cost_usd?: number | null
          created_at?: string | null
          id?: string
          input?: Json | null
          latency_ms?: number | null
          metadata?: Json | null
          output?: Json | null
          session_id?: string | null
          tokens_used?: number | null
          trace_type?: string
        }
        Update: {
          cost_usd?: number | null
          created_at?: string | null
          id?: string
          input?: Json | null
          latency_ms?: number | null
          metadata?: Json | null
          output?: Json | null
          session_id?: string | null
          tokens_used?: number | null
          trace_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_traces_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          agent_id: string | null
          ended_at: string | null
          id: string
          metadata: Json | null
          started_at: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          agent_id?: string | null
          ended_at?: string | null
          id?: string
          metadata?: Json | null
          started_at?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          agent_id?: string | null
          ended_at?: string | null
          id?: string
          metadata?: Json | null
          started_at?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_registry: {
        Row: {
          author: string
          category: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          install_count: number
          is_public: boolean
          is_verified: boolean
          mcp_server_url: string | null
          name: string
          rating: number
          skill_config: Json
          slug: string
          tags: string[] | null
          updated_at: string
          version: string
        }
        Insert: {
          author?: string
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          install_count?: number
          is_public?: boolean
          is_verified?: boolean
          mcp_server_url?: string | null
          name: string
          rating?: number
          skill_config?: Json
          slug: string
          tags?: string[] | null
          updated_at?: string
          version?: string
        }
        Update: {
          author?: string
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          install_count?: number
          is_public?: boolean
          is_verified?: boolean
          mcp_server_url?: string | null
          name?: string
          rating?: number
          skill_config?: Json
          slug?: string
          tags?: string[] | null
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      test_cases: {
        Row: {
          created_at: string | null
          dataset_id: string | null
          expected_output: string | null
          id: string
          input: string
          metadata: Json | null
          tags: string[] | null
        }
        Insert: {
          created_at?: string | null
          dataset_id?: string | null
          expected_output?: string | null
          id?: string
          input: string
          metadata?: Json | null
          tags?: string[] | null
        }
        Update: {
          created_at?: string | null
          dataset_id?: string | null
          expected_output?: string | null
          id?: string
          input?: string
          metadata?: Json | null
          tags?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "test_cases_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "evaluation_datasets"
            referencedColumns: ["id"]
          },
        ]
      }
      tool_integrations: {
        Row: {
          config: Json | null
          created_at: string | null
          description: string | null
          id: string
          is_enabled: boolean | null
          name: string
          type: string
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_enabled?: boolean | null
          name: string
          type?: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_enabled?: boolean | null
          name?: string
          type?: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tool_integrations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tool_policies: {
        Row: {
          agent_id: string
          config: Json | null
          created_at: string | null
          environment: string | null
          id: string
          is_allowed: boolean | null
          max_calls_per_run: number | null
          requires_approval: boolean | null
          tool_integration_id: string | null
        }
        Insert: {
          agent_id: string
          config?: Json | null
          created_at?: string | null
          environment?: string | null
          id?: string
          is_allowed?: boolean | null
          max_calls_per_run?: number | null
          requires_approval?: boolean | null
          tool_integration_id?: string | null
        }
        Update: {
          agent_id?: string
          config?: Json | null
          created_at?: string | null
          environment?: string | null
          id?: string
          is_allowed?: boolean | null
          max_calls_per_run?: number | null
          requires_approval?: boolean | null
          tool_integration_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tool_policies_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tool_policies_tool_integration_id_fkey"
            columns: ["tool_integration_id"]
            isOneToOne: false
            referencedRelation: "tool_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      trace_events: {
        Row: {
          created_at: string | null
          data: Json | null
          event_type: string
          id: string
          session_trace_id: string | null
        }
        Insert: {
          created_at?: string | null
          data?: Json | null
          event_type: string
          id?: string
          session_trace_id?: string | null
        }
        Update: {
          created_at?: string | null
          data?: Json | null
          event_type?: string
          id?: string
          session_trace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trace_events_session_trace_id_fkey"
            columns: ["session_trace_id"]
            isOneToOne: false
            referencedRelation: "session_traces"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_records: {
        Row: {
          agent_id: string | null
          cost_usd: number | null
          created_at: string | null
          id: string
          metadata: Json | null
          record_type: string
          tokens: number | null
          workspace_id: string | null
        }
        Insert: {
          agent_id?: string | null
          cost_usd?: number | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          record_type?: string
          tokens?: number | null
          workspace_id?: string | null
        }
        Update: {
          agent_id?: string | null
          cost_usd?: number | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          record_type?: string
          tokens?: number | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_records_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_records_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_2fa: {
        Row: {
          backup_codes: string[]
          created_at: string
          enabled: boolean
          id: string
          last_verified_at: string | null
          secret: string
          updated_at: string
          user_id: string
        }
        Insert: {
          backup_codes?: string[]
          created_at?: string
          enabled?: boolean
          id?: string
          last_verified_at?: string | null
          secret: string
          updated_at?: string
          user_id: string
        }
        Update: {
          backup_codes?: string[]
          created_at?: string
          enabled?: boolean
          id?: string
          last_verified_at?: string | null
          secret?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          assigned_by: string | null
          created_at: string
          id: string
          role_key: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          role_key: string
          user_id: string
          workspace_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          role_key?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      vector_indexes: {
        Row: {
          config: Json | null
          created_at: string | null
          dimensions: number | null
          id: string
          knowledge_base_id: string | null
          model: string | null
          provider: string | null
          status: string | null
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          dimensions?: number | null
          id?: string
          knowledge_base_id?: string | null
          model?: string | null
          provider?: string | null
          status?: string | null
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          dimensions?: number | null
          id?: string
          knowledge_base_id?: string | null
          model?: string | null
          provider?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vector_indexes_knowledge_base_id_fkey"
            columns: ["knowledge_base_id"]
            isOneToOne: false
            referencedRelation: "knowledge_bases"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          current_step: number | null
          error: string | null
          id: string
          output: Json | null
          started_at: string | null
          status: string
          total_steps: number | null
          workflow_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_step?: number | null
          error?: string | null
          id?: string
          output?: Json | null
          started_at?: string | null
          status?: string
          total_steps?: number | null
          workflow_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_step?: number | null
          error?: string | null
          id?: string
          output?: Json | null
          started_at?: string | null
          status?: string
          total_steps?: number | null
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_runs_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_steps: {
        Row: {
          agent_id: string | null
          config: Json | null
          created_at: string | null
          id: string
          name: string
          role: string | null
          step_order: number
          workflow_id: string | null
        }
        Insert: {
          agent_id?: string | null
          config?: Json | null
          created_at?: string | null
          id?: string
          name: string
          role?: string | null
          step_order?: number
          workflow_id?: string | null
        }
        Update: {
          agent_id?: string | null
          config?: Json | null
          created_at?: string | null
          id?: string
          name?: string
          role?: string | null
          step_order?: number
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_steps_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_steps_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflows: {
        Row: {
          config: Json | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          status: string | null
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          status?: string | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          status?: string | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflows_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          accepted_at: string | null
          email: string | null
          id: string
          invited_at: string | null
          name: string | null
          role: string | null
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          email?: string | null
          id?: string
          invited_at?: string | null
          name?: string | null
          role?: string | null
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          email?: string | null
          id?: string
          invited_at?: string | null
          name?: string | null
          role?: string | null
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_secrets: {
        Row: {
          created_at: string | null
          encrypted_value: string | null
          id: string
          key_name: string
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          encrypted_value?: string | null
          id?: string
          key_name: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          encrypted_value?: string | null
          id?: string
          key_name?: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workspace_secrets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string | null
          id: string
          max_agents: number | null
          name: string
          owner_id: string | null
          plan: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          max_agents?: number | null
          name?: string
          owner_id?: string | null
          plan?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          max_agents?: number | null
          name?: string
          owner_id?: string | null
          plan?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      audit_log_safe: {
        Row: {
          action: string | null
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string | null
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string | null
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string | null
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      skill_registry_safe: {
        Row: {
          author: string | null
          category: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string | null
          install_count: number | null
          is_public: boolean | null
          is_verified: boolean | null
          mcp_server_url: string | null
          name: string | null
          rating: number | null
          skill_config: Json | null
          slug: string | null
          tags: string[] | null
          updated_at: string | null
          version: string | null
        }
        Insert: {
          author?: string | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string | null
          install_count?: number | null
          is_public?: boolean | null
          is_verified?: boolean | null
          mcp_server_url?: never
          name?: string | null
          rating?: number | null
          skill_config?: Json | null
          slug?: string | null
          tags?: string[] | null
          updated_at?: string | null
          version?: string | null
        }
        Update: {
          author?: string | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string | null
          install_count?: number | null
          is_public?: boolean | null
          is_verified?: boolean | null
          mcp_server_url?: never
          name?: string | null
          rating?: number | null
          skill_config?: Json | null
          slug?: string | null
          tags?: string[] | null
          updated_at?: string | null
          version?: string | null
        }
        Relationships: []
      }
      workspace_members_directory: {
        Row: {
          accepted_at: string | null
          email: string | null
          id: string | null
          name: string | null
          role: string | null
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          email?: never
          id?: string | null
          name?: string | null
          role?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          email?: never
          id?: string | null
          name?: string | null
          role?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members_safe: {
        Row: {
          accepted_at: string | null
          email: string | null
          id: string | null
          invited_at: string | null
          name: string | null
          role: string | null
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          email?: never
          id?: string | null
          invited_at?: string | null
          name?: never
          role?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          email?: never
          id?: string | null
          invited_at?: string | null
          name?: never
          role?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_workspace_invitation: {
        Args: { p_member_id: string }
        Returns: undefined
      }
      get_masked_secrets: {
        Args: { p_workspace_id: string }
        Returns: {
          created_at: string
          id: string
          key_name: string
          masked_value: string
          updated_at: string
        }[]
      }
      get_user_workspace_ids: { Args: { _user_id: string }; Returns: string[] }
      increment_skill_installs: {
        Args: { p_skill_id: string }
        Returns: undefined
      }
      is_workspace_admin: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      log_audit_entry: {
        Args: {
          p_action: string
          p_entity_id?: string
          p_entity_type: string
          p_metadata?: Json
        }
        Returns: undefined
      }
    }
    Enums: {
      agent_status:
        | "draft"
        | "configured"
        | "testing"
        | "staging"
        | "review"
        | "production"
        | "monitoring"
        | "deprecated"
        | "archived"
      trace_level: "debug" | "info" | "warning" | "error" | "critical"
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
      agent_status: [
        "draft",
        "configured",
        "testing",
        "staging",
        "review",
        "production",
        "monitoring",
        "deprecated",
        "archived",
      ],
      trace_level: ["debug", "info", "warning", "error", "critical"],
    },
  },
} as const
