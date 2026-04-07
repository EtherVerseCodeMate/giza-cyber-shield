// src/integrations/supabase/client.ts
//
// SOVEREIGN MODE — Supabase client replaced with local ASAF API stub.
//
// This stub satisfies all existing import sites that reference `supabase.rpc()`,
// `supabase.from()`, `supabase.auth.*`, etc. without throwing runtime errors.
// All data operations return empty successful responses so views render
// gracefully without a Supabase connection.
//
// Long-term: individual views will be migrated to call the ASAF agent API
// directly. This stub is the zero-disruption bridge during that migration.
//
// ASAF agent API: http://localhost:45444/api/v1/

const ASAF_API = 'http://localhost:45444/api/v1';

// Lightweight fetch wrapper for ASAF agent calls
const asafFetch = async (path: string, opts?: RequestInit) => {
  try {
    const resp = await fetch(`${ASAF_API}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...opts,
    });
    if (resp.ok) return resp.json();
  } catch {
    // Agent offline — return empty data gracefully
  }
  return null;
};

// ── Query builder stub ────────────────────────────────────────────────────────
// Mimics the Supabase PostgREST builder enough to prevent crashes.
// Returns { data: [], error: null } for all queries.

const makeQueryStub = (table: string) => ({
  select: (_cols?: string) => makeQueryStub(table),
  insert: (_row: any) => ({ data: null, error: null }),
  update: (_row: any) => makeQueryStub(table),
  upsert: (_row: any) => ({ data: null, error: null }),
  delete: () => makeQueryStub(table),
  eq: (_col: string, _val: any) => makeQueryStub(table),
  neq: (_col: string, _val: any) => makeQueryStub(table),
  gt: (_col: string, _val: any) => makeQueryStub(table),
  gte: (_col: string, _val: any) => makeQueryStub(table),
  lt: (_col: string, _val: any) => makeQueryStub(table),
  lte: (_col: string, _val: any) => makeQueryStub(table),
  in: (_col: string, _vals: any[]) => makeQueryStub(table),
  is: (_col: string, _val: any) => makeQueryStub(table),
  ilike: (_col: string, _val: string) => makeQueryStub(table),
  order: (_col: string, _opts?: any) => makeQueryStub(table),
  limit: (_n: number) => makeQueryStub(table),
  range: (_from: number, _to: number) => makeQueryStub(table),
  single: () => Promise.resolve({ data: null, error: null }),
  maybeSingle: () => Promise.resolve({ data: null, error: null }),
  then: (resolve: (v: any) => any) => Promise.resolve({ data: [], error: null }).then(resolve),
});

// ── Auth stub ─────────────────────────────────────────────────────────────────
// Auth operations are handled by AuthProvider.tsx — this stub is a no-op fallback.

const authStub = {
  getSession: () => Promise.resolve({ data: { session: null }, error: null }),
  onAuthStateChange: (_cb: any) => ({ data: { subscription: { unsubscribe: () => {} } } }),
  signInWithPassword: async (_creds: any) => ({ data: null, error: { message: 'Use license key auth' } }),
  signUp: async (_creds: any) => ({ data: null, error: null }),
  signOut: async () => ({ error: null }),
  resetPasswordForEmail: async (_email: string, _opts?: any) => ({ error: null }),
};

// ── RPC stub ──────────────────────────────────────────────────────────────────
// Maps known RPC calls to ASAF agent endpoints where available.

const rpc = async (fnName: string, params?: any) => {
  // Route known RPC functions to ASAF agent
  const rpcRoutes: Record<string, string> = {
    'get_current_user_role': '/me/role',
    'is_sunsum_diminished': '/auth/lockout-check',
    'record_ritual_lapse': '/auth/record-failure',
  };

  const route = rpcRoutes[fnName];
  if (route) {
    const result = await asafFetch(route, {
      method: 'POST',
      body: JSON.stringify(params ?? {}),
    });
    return { data: result ?? null, error: null };
  }

  // Unknown RPC — return null gracefully
  console.debug(`[ASAF-STUB] Unmapped RPC: ${fnName}`, params);
  return { data: null, error: null };
};

// ── Storage stub ──────────────────────────────────────────────────────────────

const storage = {
  from: (_bucket: string) => ({
    upload: async (_path: string, _file: any) => ({ data: null, error: null }),
    download: async (_path: string) => ({ data: null, error: null }),
    getPublicUrl: (_path: string) => ({ data: { publicUrl: '' } }),
    list: async (_prefix?: string) => ({ data: [], error: null }),
    remove: async (_paths: string[]) => ({ data: null, error: null }),
  }),
};

// ── Main export ───────────────────────────────────────────────────────────────

export const supabase = {
  auth: authStub,
  rpc,
  storage,
  from: (table: string) => makeQueryStub(table),
  channel: (_name: string) => ({
    on: (_event: string, _filter: any, _cb: any) => ({ subscribe: () => {} }),
    subscribe: () => ({}),
    unsubscribe: () => {},
  }),
  removeChannel: (_ch: any) => {},
};

// Type re-export for files that import from types.ts
export type { Database } from './types';