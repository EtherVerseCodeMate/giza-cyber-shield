/**
 * useOmnibusConnector.ts
 * SouHimBou AI — KHEPRA Omnibus Connector hook
 *
 * Wires the omnibus-connector Supabase Edge Function into React Query.
 * Every action is a type-safe call to the real edge function.
 *
 * Author: SecRed Knowledge Inc. / NouchiX
 * IP: SOUHIMBOU DOH KONE LLC, exclusively licensed to SecRed Knowledge Inc.
 */

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ConnectorCategory = 'siem' | 'soar' | 'edr' | 'cloud' | 'iam' | 'threat_intel' | 'llm' | 'custom';

export interface ConnectorProfile {
  id: string;
  name: string;
  connector_type: string;
  category: ConnectorCategory;
  base_url: string;
  auth_method: string;
  fitness_score: number;
  success_rate: number;
  health_status: 'pending' | 'healthy' | 'degraded' | 'disconnected' | 'auth_error';
  status: 'pending' | 'active' | 'paused' | 'deleted';
  last_pull_at: string | null;
  last_push_at: string | null;
  created_at: string;
  recent_success_rate?: number | null;
  recent_schema_coverage?: number | null;
  total_events_last_10?: number;
}

export interface ConnectorDefinition {
  connector_type: string;
  display_name: string;
  category: ConnectorCategory;
  auth_methods: string[];
  required_fields: string[];
  default_model?: string;
}

export interface RegisterConnectorInput {
  name: string;
  connector_type: string;
  base_url?: string;
  auth_method?: string;
  vault_secret_id?: string;
  pull_config?: Record<string, any>;
  push_config?: Record<string, any>;
}

export interface InferenceInput {
  connector_id?: string;
  messages?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  prompt?: string;
  model?: string;
  system_prompt?: string;
  max_tokens?: number;
  temperature?: number;
}

export interface InferenceResult {
  provider: string;
  model: string;
  content: string;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  cost_usd: number;
  latency_ms: number;
  prompt_guard: { blocked: boolean; violation_type: string; reason: string };
}

export interface UsageSummary {
  today: {
    calls: number;
    tokens_in: number;
    tokens_out: number;
    cost_usd: number;
    errors: number;
  };
  tier: string;
  calls_this_hour: number;
  calls_today: number;
}

// ── Core invoke helper ────────────────────────────────────────────────────────

async function omnibusInvoke<T = any>(action: string, payload: Record<string, any> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('omnibus-connector', {
    body: { action, ...payload },
  });
  if (error) throw new Error(error.message || 'Omnibus connector error');
  if (data?.error) throw new Error(data.error);
  return data as T;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useOmnibusConnector() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // ── Catalog ─────────────────────────────────────────────────────────────────
  const catalogQuery = useQuery({
    queryKey: ['omnibus', 'catalog'],
    queryFn: () => omnibusInvoke<{ connectors: ConnectorDefinition[]; categories: string[]; tier: string }>('get_catalog'),
    staleTime: 5 * 60 * 1000, // catalog is static, cache 5 min
  });

  // ── Connector list ───────────────────────────────────────────────────────────
  const connectorsQuery = useQuery({
    queryKey: ['omnibus', 'connectors'],
    queryFn: () => omnibusInvoke<{ connectors: ConnectorProfile[]; total: number; summary: any }>('list_connectors'),
    refetchInterval: 30_000,
  });

  // ── Usage ────────────────────────────────────────────────────────────────────
  const usageQuery = useQuery({
    queryKey: ['omnibus', 'usage'],
    queryFn: () => omnibusInvoke<UsageSummary>('usage'),
    refetchInterval: 60_000,
  });

  // ── Register ─────────────────────────────────────────────────────────────────
  const registerMutation = useMutation({
    mutationFn: (input: RegisterConnectorInput) =>
      omnibusInvoke<{ connector: ConnectorProfile; seeded_schema_fields: number }>('register_connector', input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['omnibus', 'connectors'] });
      toast({ title: 'Connector registered', description: `${data.connector.name} added. Run a connection test to activate.` });
    },
    onError: (err: Error) => toast({ title: 'Registration failed', description: err.message, variant: 'destructive' }),
  });

  // ── Test connection ───────────────────────────────────────────────────────────
  const testMutation = useMutation({
    mutationFn: (connector_id: string) =>
      omnibusInvoke<{ health_status: string; test_result: any }>('test_connector', { connector_id }),
    onSuccess: (data, connector_id) => {
      queryClient.invalidateQueries({ queryKey: ['omnibus', 'connectors'] });
      const ok = data.health_status === 'healthy';
      toast({
        title: ok ? '✅ Connection healthy' : '⚠️ Connection failed',
        description: ok ? `Connector is active and responding.` : `Status: ${data.health_status}. Check credentials.`,
        variant: ok ? 'default' : 'destructive',
      });
    },
    onError: (err: Error) => toast({ title: 'Test failed', description: err.message, variant: 'destructive' }),
  });

  // ── Pull data ─────────────────────────────────────────────────────────────────
  const pullMutation = useMutation({
    mutationFn: ({ connector_id, since, limit }: { connector_id: string; since?: string; limit?: number }) =>
      omnibusInvoke<{ records: any[]; schema_coverage: number; latency_ms: number }>('pull_data', { connector_id, since, limit }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['omnibus', 'connectors'] });
      toast({ title: 'Pull complete', description: `${data.records.length} records · ${data.latency_ms}ms · ${Math.round(data.schema_coverage * 100)}% schema coverage` });
    },
    onError: (err: Error) => toast({ title: 'Pull failed', description: err.message, variant: 'destructive' }),
  });

  // ── Inference (LLM) ───────────────────────────────────────────────────────────
  const inferenceMutation = useMutation({
    mutationFn: (input: InferenceInput) =>
      omnibusInvoke<InferenceResult>('inference', input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['omnibus', 'usage'] });
      if (data.prompt_guard.violation_type !== 'none') {
        toast({ title: '⚠️ Prompt guard flagged content', description: data.prompt_guard.violation_type, variant: 'destructive' });
      }
    },
    onError: (err: Error) => toast({ title: 'Inference failed', description: err.message, variant: 'destructive' }),
  });

  // ── Learn schema (trigger EA) ─────────────────────────────────────────────────
  const learnMutation = useMutation({
    mutationFn: (connector_id: string) =>
      omnibusInvoke<{ status: string; new_fitness?: number; heuristic_suggestions?: any[] }>('learn_schema', { connector_id }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['omnibus', 'connectors'] });
      toast({
        title: data.status === 'schema_updated' ? '🧬 EA schema updated' : '💡 Schema suggestions ready',
        description: data.new_fitness ? `New fitness: ${Math.round(data.new_fitness * 100)}%` : 'Review heuristic suggestions',
      });
    },
    onError: (err: Error) => toast({ title: 'Schema learning failed', description: err.message, variant: 'destructive' }),
  });

  // ── Delete ────────────────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (connector_id: string) => omnibusInvoke('delete_connector', { connector_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['omnibus', 'connectors'] });
      toast({ title: 'Connector removed' });
    },
  });

  return {
    // queries
    catalog:    catalogQuery.data?.connectors ?? [],
    categories: catalogQuery.data?.categories ?? [],
    tier:       catalogQuery.data?.tier ?? 'saas',
    connectors: connectorsQuery.data?.connectors ?? [],
    connectorSummary: connectorsQuery.data?.summary,
    usage:      usageQuery.data,
    isLoading:  connectorsQuery.isLoading || catalogQuery.isLoading,
    isRefetching: connectorsQuery.isRefetching,
    // mutations
    register:   registerMutation.mutateAsync,
    isRegistering: registerMutation.isPending,
    test:       testMutation.mutate,
    isTesting:  testMutation.isPending,
    testingId:  testMutation.variables as string | undefined,
    pull:       pullMutation.mutateAsync,
    isPulling:  pullMutation.isPending,
    inference:  inferenceMutation.mutateAsync,
    isInferring: inferenceMutation.isPending,
    learnSchema: learnMutation.mutate,
    isLearning:  learnMutation.isPending,
    deleteConnector: deleteMutation.mutate,
  };
}
