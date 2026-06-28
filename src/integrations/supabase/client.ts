// src/integrations/supabase/client.ts
//
// LIVE MODE — Real Supabase client connected to xjknkjbrjgljuovaazeu.
// Schema: public (tables are in public schema, not the api schema which is the PostgREST default).
//
// Previous stub (sovereign ASAF bridge) returned null for all queries.
// This replaces it with the real client so pages render actual data.
//
// Future sovereign migration: swap createClient for the ASAF stub when
// NEXT_PUBLIC_SOVEREIGN_MODE=true is set in the environment.

import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  'https://xjknkjbrjgljuovaazeu.supabase.co';

const supabaseAnon =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhqa25ramJyamdsanVvdmFhemV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4NTMzNDksImV4cCI6MjA3MTQyOTM0OX0.ioWr3_viAbWJHAaHnBxQrzSXtgUlcAAjrPWEsoSh6sk';


export const supabase = createClient<Database>(supabaseUrl, supabaseAnon, {
  db: {
    schema: 'public',   // Tables live in public, not the api default schema
  },
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

export type { Database } from './types';
