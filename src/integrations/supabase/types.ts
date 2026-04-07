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
          workspace_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          memory_type?: string
          relevance_score?: number | null
          source?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          memory_type?: string
          relevance_score?: number | null
          source?: string | null
          updated_at?: string
          workspace_id?: string | null
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
      agent_permissions: {
        Row: {
          agent_id: string
          created_at: string | null
          granted_by: string | null
          id: string
          permission_level: string
          user_id: string
        }
        Insert: {
          agent_id: string
          created_at?: string | null
          granted_by?: string | null
          id?: string
          permission_level?: string
          user_id: string
        }
        Update: {
          agent_id?: string
          created_at?: string | null
          granted_by?: string | null
          id?: string
          permission_level?: string
          user_id?: string
        }
        Relationships: []
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
      batch_jobs: {
        Row: {
          completed_at: string | null
          config: Json | null
          created_at: string | null
          error: string | null
          failed_items: number | null
          id: string
          processed_items: number | null
          started_at: string | null
          status: string | null
          total_items: number | null
          type: string
          workspace_id: string | null
        }
        Insert: {
          completed_at?: string | null
          config?: Json | null
          created_at?: string | null
          error?: string | null
          failed_items?: number | null
          id?: string
          processed_items?: number | null
          started_at?: string | null
          status?: string | null
          total_items?: number | null
          type: string
          workspace_id?: string | null
        }
        Update: {
          completed_at?: string | null
          config?: Json | null
          created_at?: string | null
          error?: string | null
          failed_items?: number | null
          id?: string
          processed_items?: number | null
          started_at?: string | null
          status?: string | null
          total_items?: number | null
          type?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batch_jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
          bm25_tsvector: unknown
          chunk_index: number
          chunk_level: string | null
          content: string
          created_at: string | null
          document_id: string | null
          embedding: string | null
          embedding_status: string | null
          id: string
          l0_abstract: string | null
          l1_overview: string | null
          metadata: Json | null
          parent_chunk_id: string | null
          token_count: number | null
        }
        Insert: {
          bm25_tsvector?: unknown
          chunk_index?: number
          chunk_level?: string | null
          content: string
          created_at?: string | null
          document_id?: string | null
          embedding?: string | null
          embedding_status?: string | null
          id?: string
          l0_abstract?: string | null
          l1_overview?: string | null
          metadata?: Json | null
          parent_chunk_id?: string | null
          token_count?: number | null
        }
        Update: {
          bm25_tsvector?: unknown
          chunk_index?: number
          chunk_level?: string | null
          content?: string
          created_at?: string | null
          document_id?: string | null
          embedding?: string | null
          embedding_status?: string | null
          id?: string
          l0_abstract?: string | null
          l1_overview?: string | null
          metadata?: Json | null
          parent_chunk_id?: string | null
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
          {
            foreignKeyName: "chunks_parent_chunk_id_fkey"
            columns: ["parent_chunk_id"]
            isOneToOne: false
            referencedRelation: "chunks"
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
      credential_audit_logs: {
        Row: {
          action: string
          created_at: string | null
          credential_id: string | null
          details: Json | null
          id: string
          ip_address: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          credential_id?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          credential_id?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credential_audit_logs_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "credential_vault"
            referencedColumns: ["id"]
          },
        ]
      }
      credential_vault: {
        Row: {
          created_at: string | null
          created_by: string | null
          encrypted_value: string
          expires_at: string | null
          id: string
          last_rotated_at: string | null
          metadata: Json | null
          name: string
          provider: string
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          encrypted_value: string
          expires_at?: string | null
          id?: string
          last_rotated_at?: string | null
          metadata?: Json | null
          name: string
          provider: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          encrypted_value?: string
          expires_at?: string | null
          id?: string
          last_rotated_at?: string | null
          metadata?: Json | null
          name?: string
          provider?: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credential_vault_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      cron_schedule_executions: {
        Row: {
          completed_at: string | null
          duration_ms: number | null
          error: string | null
          id: string
          output: Json | null
          schedule_id: string | null
          started_at: string | null
          status: string | null
        }
        Insert: {
          completed_at?: string | null
          duration_ms?: number | null
          error?: string | null
          id?: string
          output?: Json | null
          schedule_id?: string | null
          started_at?: string | null
          status?: string | null
        }
        Update: {
          completed_at?: string | null
          duration_ms?: number | null
          error?: string | null
          id?: string
          output?: Json | null
          schedule_id?: string | null
          started_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cron_schedule_executions_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "cron_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      cron_schedules: {
        Row: {
          created_at: string | null
          cron_expression: string
          edge_function: string
          id: string
          is_active: boolean | null
          last_run_at: string | null
          name: string
          next_run_at: string | null
          payload: Json | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          cron_expression: string
          edge_function: string
          id?: string
          is_active?: boolean | null
          last_run_at?: string | null
          name: string
          next_run_at?: string | null
          payload?: Json | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          cron_expression?: string
          edge_function?: string
          id?: string
          is_active?: boolean | null
          last_run_at?: string | null
          name?: string
          next_run_at?: string | null
          payload?: Json | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cron_schedules_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
      dead_letter_queue: {
        Row: {
          attempts: number | null
          created_at: string | null
          error: string | null
          id: string
          original_item_id: string | null
          original_queue_id: string | null
          payload: Json
        }
        Insert: {
          attempts?: number | null
          created_at?: string | null
          error?: string | null
          id?: string
          original_item_id?: string | null
          original_queue_id?: string | null
          payload?: Json
        }
        Update: {
          attempts?: number | null
          created_at?: string | null
          error?: string | null
          id?: string
          original_item_id?: string | null
          original_queue_id?: string | null
          payload?: Json
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
      embedding_configs: {
        Row: {
          created_at: string | null
          dimension: number
          hybrid_search: boolean | null
          id: string
          knowledge_base_id: string | null
          provider: string
          reranker_model: string | null
          reranker_top_k: number | null
          task: string
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          dimension?: number
          hybrid_search?: boolean | null
          id?: string
          knowledge_base_id?: string | null
          provider?: string
          reranker_model?: string | null
          reranker_top_k?: number | null
          task?: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          dimension?: number
          hybrid_search?: boolean | null
          id?: string
          knowledge_base_id?: string | null
          provider?: string
          reranker_model?: string | null
          reranker_top_k?: number | null
          task?: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "embedding_configs_knowledge_base_id_fkey"
            columns: ["knowledge_base_id"]
            isOneToOne: false
            referencedRelation: "knowledge_bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "embedding_configs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
      finetune_jobs: {
        Row: {
          agent_id: string | null
          completed_at: string | null
          config: Json | null
          created_at: string | null
          dataset_path: string | null
          error: string | null
          id: string
          model_name: string
          progress: number | null
          result: Json | null
          started_at: string | null
          status: string | null
          workspace_id: string | null
        }
        Insert: {
          agent_id?: string | null
          completed_at?: string | null
          config?: Json | null
          created_at?: string | null
          dataset_path?: string | null
          error?: string | null
          id?: string
          model_name: string
          progress?: number | null
          result?: Json | null
          started_at?: string | null
          status?: string | null
          workspace_id?: string | null
        }
        Update: {
          agent_id?: string | null
          completed_at?: string | null
          config?: Json | null
          created_at?: string | null
          dataset_path?: string | null
          error?: string | null
          id?: string
          model_name?: string
          progress?: number | null
          result?: Json | null
          started_at?: string | null
          status?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finetune_jobs_workspace_id_fkey"
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
      guardrail_ml_logs: {
        Row: {
          agent_id: string | null
          all_passed: boolean | null
          blocked_layers: string[] | null
          created_at: string | null
          direction: string
          id: string
          latency_ms: number | null
          scores: Json | null
          text_preview: string | null
          workspace_id: string | null
        }
        Insert: {
          agent_id?: string | null
          all_passed?: boolean | null
          blocked_layers?: string[] | null
          created_at?: string | null
          direction: string
          id?: string
          latency_ms?: number | null
          scores?: Json | null
          text_preview?: string | null
          workspace_id?: string | null
        }
        Update: {
          agent_id?: string | null
          all_passed?: boolean | null
          blocked_layers?: string[] | null
          created_at?: string | null
          direction?: string
          id?: string
          latency_ms?: number | null
          scores?: Json | null
          text_preview?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guardrail_ml_logs_workspace_id_fkey"
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
      hf_config: {
        Row: {
          created_at: string | null
          id: string
          is_secret: boolean | null
          key: string
          updated_at: string | null
          value: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_secret?: boolean | null
          key: string
          updated_at?: string | null
          value?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_secret?: boolean | null
          key?: string
          updated_at?: string | null
          value?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hf_config_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      installed_templates: {
        Row: {
          agent_id: string | null
          created_at: string | null
          id: string
          installed_by: string | null
          template_id: string | null
          workspace_id: string | null
        }
        Insert: {
          agent_id?: string | null
          created_at?: string | null
          id?: string
          installed_by?: string | null
          template_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          agent_id?: string | null
          created_at?: string | null
          id?: string
          installed_by?: string | null
          template_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "installed_templates_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "agent_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installed_templates_workspace_id_fkey"
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
      mcp_servers: {
        Row: {
          auth_config: Json | null
          auth_type: string | null
          created_at: string | null
          created_by: string | null
          error: string | null
          id: string
          is_active: boolean | null
          last_connected_at: string | null
          name: string
          resources_discovered: Json | null
          status: string | null
          tools_discovered: Json | null
          transport: string | null
          updated_at: string | null
          url: string
          workspace_id: string | null
        }
        Insert: {
          auth_config?: Json | null
          auth_type?: string | null
          created_at?: string | null
          created_by?: string | null
          error?: string | null
          id?: string
          is_active?: boolean | null
          last_connected_at?: string | null
          name: string
          resources_discovered?: Json | null
          status?: string | null
          tools_discovered?: Json | null
          transport?: string | null
          updated_at?: string | null
          url: string
          workspace_id?: string | null
        }
        Update: {
          auth_config?: Json | null
          auth_type?: string | null
          created_at?: string | null
          created_by?: string | null
          error?: string | null
          id?: string
          is_active?: boolean | null
          last_connected_at?: string | null
          name?: string
          resources_discovered?: Json | null
          status?: string | null
          tools_discovered?: Json | null
          transport?: string | null
          updated_at?: string | null
          url?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mcp_servers_workspace_id_fkey"
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
      model_pricing_v2: {
        Row: {
          active_params: string | null
          capabilities: string[] | null
          context_window: number | null
          created_at: string | null
          id: string
          input_cost_per_1m: number
          model: string
          output_cost_per_1m: number
          provider: string
          tier: string
          total_params: string | null
        }
        Insert: {
          active_params?: string | null
          capabilities?: string[] | null
          context_window?: number | null
          created_at?: string | null
          id?: string
          input_cost_per_1m?: number
          model: string
          output_cost_per_1m?: number
          provider: string
          tier?: string
          total_params?: string | null
        }
        Update: {
          active_params?: string | null
          capabilities?: string[] | null
          context_window?: number | null
          created_at?: string | null
          id?: string
          input_cost_per_1m?: number
          model?: string
          output_cost_per_1m?: number
          provider?: string
          tier?: string
          total_params?: string | null
        }
        Relationships: []
      }
      nlp_extractions: {
        Row: {
          created_at: string | null
          entities: Json | null
          id: string
          pipeline_version: string
          processing_time_ms: number | null
          raw_text: string
          sentiment_label: string | null
          sentiment_score: number | null
          source_id: string | null
          source_type: string
          structured_order: Json | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          entities?: Json | null
          id?: string
          pipeline_version?: string
          processing_time_ms?: number | null
          raw_text: string
          sentiment_label?: string | null
          sentiment_score?: number | null
          source_id?: string | null
          source_type?: string
          structured_order?: Json | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          entities?: Json | null
          id?: string
          pipeline_version?: string
          processing_time_ms?: number | null
          raw_text?: string
          sentiment_label?: string | null
          sentiment_score?: number | null
          source_id?: string | null
          source_type?: string
          structured_order?: Json | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nlp_extractions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_templates: {
        Row: {
          body_template: string
          channel: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          subject: string | null
          variables: Json | null
          workspace_id: string | null
        }
        Insert: {
          body_template: string
          channel?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          subject?: string | null
          variables?: Json | null
          workspace_id?: string | null
        }
        Update: {
          body_template?: string
          channel?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          subject?: string | null
          variables?: Json | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          body: string | null
          created_at: string | null
          id: string
          is_read: boolean | null
          metadata: Json | null
          title: string
          type: string
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          action_url?: string | null
          body?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          metadata?: Json | null
          title: string
          type?: string
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          action_url?: string | null
          body?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          metadata?: Json | null
          title?: string
          type?: string
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
          created_at: string | null
          description: string | null
          id: string
          is_system: boolean | null
          key: string
          module: string
          name: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean | null
          key: string
          module: string
          name: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean | null
          key?: string
          module?: string
          name?: string
        }
        Relationships: []
      }
      prompt_ab_tests: {
        Row: {
          agent_id: string | null
          completed_at: string | null
          created_at: string | null
          id: string
          metrics: Json | null
          name: string
          started_at: string | null
          status: string | null
          traffic_split: number | null
          variant_a_prompt_id: string | null
          variant_b_prompt_id: string | null
          winner: string | null
        }
        Insert: {
          agent_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          metrics?: Json | null
          name: string
          started_at?: string | null
          status?: string | null
          traffic_split?: number | null
          variant_a_prompt_id?: string | null
          variant_b_prompt_id?: string | null
          winner?: string | null
        }
        Update: {
          agent_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          metrics?: Json | null
          name?: string
          started_at?: string | null
          status?: string | null
          traffic_split?: number | null
          variant_a_prompt_id?: string | null
          variant_b_prompt_id?: string | null
          winner?: string | null
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
      queue_items: {
        Row: {
          attempts: number | null
          completed_at: string | null
          created_at: string | null
          error: string | null
          id: string
          locked_at: string | null
          locked_by: string | null
          max_attempts: number | null
          payload: Json
          priority: number | null
          queue_id: string | null
          status: string | null
        }
        Insert: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string | null
          error?: string | null
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number | null
          payload?: Json
          priority?: number | null
          queue_id?: string | null
          status?: string | null
        }
        Update: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string | null
          error?: string | null
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number | null
          payload?: Json
          priority?: number | null
          queue_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "queue_items_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "task_queues"
            referencedColumns: ["id"]
          },
        ]
      }
      ragas_scores: {
        Row: {
          agent_id: string | null
          answer: string
          answer_correctness: number | null
          answer_relevancy: number | null
          context_precision: number | null
          context_recall: number | null
          contexts_count: number | null
          created_at: string | null
          evaluation_run_id: string | null
          faithfulness: number | null
          id: string
          model_used: string | null
          overall_score: number | null
          query: string
          workspace_id: string | null
        }
        Insert: {
          agent_id?: string | null
          answer: string
          answer_correctness?: number | null
          answer_relevancy?: number | null
          context_precision?: number | null
          context_recall?: number | null
          contexts_count?: number | null
          created_at?: string | null
          evaluation_run_id?: string | null
          faithfulness?: number | null
          id?: string
          model_used?: string | null
          overall_score?: number | null
          query: string
          workspace_id?: string | null
        }
        Update: {
          agent_id?: string | null
          answer?: string
          answer_correctness?: number | null
          answer_relevancy?: number | null
          context_precision?: number | null
          context_recall?: number | null
          contexts_count?: number | null
          created_at?: string | null
          evaluation_run_id?: string | null
          faithfulness?: number | null
          id?: string
          model_used?: string | null
          overall_score?: number | null
          query?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ragas_scores_evaluation_run_id_fkey"
            columns: ["evaluation_run_id"]
            isOneToOne: false
            referencedRelation: "evaluation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ragas_scores_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_logs: {
        Row: {
          created_at: string | null
          endpoint: string
          id: string
          identifier: string
          ip_address: string | null
          limit_name: string
          max_requests: number
          request_count: number | null
          user_agent: string | null
          was_blocked: boolean | null
          window_ms: number
        }
        Insert: {
          created_at?: string | null
          endpoint: string
          id?: string
          identifier: string
          ip_address?: string | null
          limit_name: string
          max_requests: number
          request_count?: number | null
          user_agent?: string | null
          was_blocked?: boolean | null
          window_ms: number
        }
        Update: {
          created_at?: string | null
          endpoint?: string
          id?: string
          identifier?: string
          ip_address?: string | null
          limit_name?: string
          max_requests?: number
          request_count?: number | null
          user_agent?: string | null
          was_blocked?: boolean | null
          window_ms?: number
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string | null
          id: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string | null
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
          color: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          is_system: boolean | null
          key: string
          level: number
          name: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          key: string
          level?: number
          name: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          key?: string
          level?: number
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      security_events: {
        Row: {
          created_at: string | null
          details: Json | null
          event_type: string
          id: string
          ip_address: string | null
          severity: string | null
          user_agent: string | null
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          event_type: string
          id?: string
          ip_address?: string | null
          severity?: string | null
          user_agent?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          event_type?: string
          id?: string
          ip_address?: string | null
          severity?: string | null
          user_agent?: string | null
          user_id?: string | null
          workspace_id?: string | null
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
      task_queues: {
        Row: {
          created_at: string | null
          id: string
          max_concurrency: number | null
          name: string
          status: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          max_concurrency?: number | null
          name: string
          status?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          max_concurrency?: number | null
          name?: string
          status?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_queues_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
      user_roles: {
        Row: {
          assigned_by: string | null
          created_at: string | null
          id: string
          role_key: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string | null
          id?: string
          role_key: string
          user_id: string
          workspace_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string | null
          id?: string
          role_key?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_key_fkey"
            columns: ["role_key"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["key"]
          },
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
      webhook_endpoints: {
        Row: {
          agent_id: string | null
          created_at: string | null
          events: string[] | null
          id: string
          is_active: boolean | null
          last_triggered_at: string | null
          name: string
          secret: string | null
          trigger_count: number | null
          updated_at: string | null
          url: string
          workspace_id: string | null
        }
        Insert: {
          agent_id?: string | null
          created_at?: string | null
          events?: string[] | null
          id?: string
          is_active?: boolean | null
          last_triggered_at?: string | null
          name: string
          secret?: string | null
          trigger_count?: number | null
          updated_at?: string | null
          url: string
          workspace_id?: string | null
        }
        Update: {
          agent_id?: string | null
          created_at?: string | null
          events?: string[] | null
          id?: string
          is_active?: boolean | null
          last_triggered_at?: string | null
          name?: string
          secret?: string | null
          trigger_count?: number | null
          updated_at?: string | null
          url?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_endpoints_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          latency_ms: number | null
          payload: Json | null
          response_body: string | null
          response_status: number | null
          webhook_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          latency_ms?: number | null
          payload?: Json | null
          response_body?: string | null
          response_status?: number | null
          webhook_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          latency_ms?: number | null
          payload?: Json | null
          response_body?: string | null
          response_status?: number | null
          webhook_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "webhook_endpoints"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_checkpoints: {
        Row: {
          created_at: string | null
          id: string
          state: Json
          step_index: number
          workflow_run_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          state?: Json
          step_index: number
          workflow_run_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          state?: Json
          step_index?: number
          workflow_run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_checkpoints_workflow_run_id_fkey"
            columns: ["workflow_run_id"]
            isOneToOne: false
            referencedRelation: "workflow_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_executions: {
        Row: {
          completed_at: string | null
          cost_total: number | null
          error: string | null
          id: string
          input: Json | null
          output: Json | null
          started_at: string | null
          status: string | null
          tokens_total: number | null
          trigger_type: string | null
          workflow_id: string | null
        }
        Insert: {
          completed_at?: string | null
          cost_total?: number | null
          error?: string | null
          id?: string
          input?: Json | null
          output?: Json | null
          started_at?: string | null
          status?: string | null
          tokens_total?: number | null
          trigger_type?: string | null
          workflow_id?: string | null
        }
        Update: {
          completed_at?: string | null
          cost_total?: number | null
          error?: string | null
          id?: string
          input?: Json | null
          output?: Json | null
          started_at?: string | null
          status?: string | null
          tokens_total?: number | null
          trigger_type?: string | null
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_executions_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_handoffs: {
        Row: {
          context: Json | null
          created_at: string | null
          from_agent_id: string | null
          id: string
          status: string | null
          to_agent_id: string | null
          workflow_run_id: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string | null
          from_agent_id?: string | null
          id?: string
          status?: string | null
          to_agent_id?: string | null
          workflow_run_id?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string | null
          from_agent_id?: string | null
          id?: string
          status?: string | null
          to_agent_id?: string | null
          workflow_run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_handoffs_workflow_run_id_fkey"
            columns: ["workflow_run_id"]
            isOneToOne: false
            referencedRelation: "workflow_runs"
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
      workflow_step_runs: {
        Row: {
          completed_at: string | null
          cost_usd: number | null
          error: string | null
          id: string
          input: Json | null
          latency_ms: number | null
          output: Json | null
          started_at: string | null
          status: string | null
          step_order: number | null
          tokens_used: number | null
          workflow_run_id: string | null
          workflow_step_id: string | null
        }
        Insert: {
          completed_at?: string | null
          cost_usd?: number | null
          error?: string | null
          id?: string
          input?: Json | null
          latency_ms?: number | null
          output?: Json | null
          started_at?: string | null
          status?: string | null
          step_order?: number | null
          tokens_used?: number | null
          workflow_run_id?: string | null
          workflow_step_id?: string | null
        }
        Update: {
          completed_at?: string | null
          cost_usd?: number | null
          error?: string | null
          id?: string
          input?: Json | null
          latency_ms?: number | null
          output?: Json | null
          started_at?: string | null
          status?: string | null
          step_order?: number | null
          tokens_used?: number | null
          workflow_run_id?: string | null
          workflow_step_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_step_runs_workflow_run_id_fkey"
            columns: ["workflow_run_id"]
            isOneToOne: false
            referencedRelation: "workflow_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_steps: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error: string | null
          id: string
          input: Json | null
          node_id: string | null
          output: Json | null
          started_at: string | null
          status: string | null
          step_index: number
          workflow_run_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error?: string | null
          id?: string
          input?: Json | null
          node_id?: string | null
          output?: Json | null
          started_at?: string | null
          status?: string | null
          step_index?: number
          workflow_run_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error?: string | null
          id?: string
          input?: Json | null
          node_id?: string | null
          output?: Json | null
          started_at?: string | null
          status?: string | null
          step_index?: number
          workflow_run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_steps_workflow_run_id_fkey"
            columns: ["workflow_run_id"]
            isOneToOne: false
            referencedRelation: "workflow_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      workflows: {
        Row: {
          created_at: string | null
          created_by: string | null
          definition: Json
          description: string | null
          id: string
          name: string
          status: string | null
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          definition?: Json
          description?: string | null
          id?: string
          name: string
          status?: string | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          definition?: Json
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
          role: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          email?: string | null
          id?: string
          invited_at?: string | null
          name?: string | null
          role?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          email?: string | null
          id?: string
          invited_at?: string | null
          name?: string | null
          role?: string
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
          key_value: string | null
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          encrypted_value?: string | null
          id?: string
          key_name: string
          key_value?: string | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          encrypted_value?: string | null
          id?: string
          key_name?: string
          key_value?: string | null
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
          config: Json | null
          created_at: string | null
          id: string
          name: string
          owner_id: string
          plan: string | null
          slug: string | null
          updated_at: string | null
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          id?: string
          name: string
          owner_id: string
          plan?: string | null
          slug?: string | null
          updated_at?: string | null
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          id?: string
          name?: string
          owner_id?: string
          plan?: string | null
          slug?: string | null
          updated_at?: string | null
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
      v_guardrail_dashboard: {
        Row: {
          avg_latency_ms: number | null
          blocked: number | null
          day: string | null
          direction: string | null
          passed: number | null
          total_checks: number | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guardrail_ml_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      v_model_catalog: {
        Row: {
          active_params: string | null
          capabilities: string[] | null
          context_window: number | null
          cost_tier: string | null
          input_cost_per_1m: number | null
          model: string | null
          output_cost_per_1m: number | null
          provider: string | null
          tier: string | null
          total_params: string | null
        }
        Insert: {
          active_params?: string | null
          capabilities?: string[] | null
          context_window?: number | null
          cost_tier?: never
          input_cost_per_1m?: number | null
          model?: string | null
          output_cost_per_1m?: number | null
          provider?: string | null
          tier?: string | null
          total_params?: string | null
        }
        Update: {
          active_params?: string | null
          capabilities?: string[] | null
          context_window?: number | null
          cost_tier?: never
          input_cost_per_1m?: number | null
          model?: string | null
          output_cost_per_1m?: number | null
          provider?: string | null
          tier?: string | null
          total_params?: string | null
        }
        Relationships: []
      }
      v_nlp_analytics: {
        Row: {
          avg_processing_ms: number | null
          day: string | null
          negative_count: number | null
          neutral_count: number | null
          positive_count: number | null
          source_type: string | null
          total_extractions: number | null
          urgent_count: number | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nlp_extractions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      v_ragas_by_agent: {
        Row: {
          agent_id: string | null
          avg_answer_correctness: number | null
          avg_answer_relevancy: number | null
          avg_context_precision: number | null
          avg_context_recall: number | null
          avg_faithfulness: number | null
          avg_overall_score: number | null
          first_eval: string | null
          last_eval: string | null
          total_evaluations: number | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ragas_scores_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members_directory: {
        Row: {
          accepted_at: string | null
          avatar_url: string | null
          email: string | null
          full_name: string | null
          id: string | null
          invited_at: string | null
          rbac_role: string | null
          role: string | null
          user_id: string | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_key_fkey"
            columns: ["rbac_role"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["key"]
          },
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
      estimate_cost: {
        Args: {
          p_input_tokens: number
          p_model: string
          p_output_tokens: number
        }
        Returns: {
          input_cost: number
          model: string
          output_cost: number
          total_cost: number
        }[]
      }
      find_cheapest_model: {
        Args: { p_capability: string }
        Returns: {
          input_cost_per_1m: number
          model: string
          output_cost_per_1m: number
          provider: string
          tier: string
        }[]
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
      get_ragas_avg: {
        Args: { p_agent_id: string }
        Returns: {
          avg_answer_correctness: number
          avg_answer_relevancy: number
          avg_context_precision: number
          avg_context_recall: number
          avg_faithfulness: number
          avg_overall_score: number
          total_evaluations: number
        }[]
      }
      get_user_workspace_ids: { Args: { _user_id: string }; Returns: string[] }
      increment_skill_installs: {
        Args: { p_skill_id: string }
        Returns: undefined
      }
      increment_template_installs: {
        Args: { template_uuid: string }
        Returns: undefined
      }
      increment_webhook_counter: {
        Args: { webhook_uuid: string }
        Returns: undefined
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
      match_documents: {
        Args: {
          match_count?: number
          match_threshold?: number
          p_knowledge_base_id?: string
          query_embedding: string
        }
        Returns: {
          content: string
          id: string
          metadata: Json
          similarity: number
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      user_has_permission: {
        Args: {
          p_permission_key: string
          p_user_id: string
          p_workspace_id: string
        }
        Returns: boolean
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

