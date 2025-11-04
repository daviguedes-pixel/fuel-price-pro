// This file is kept for backward compatibility with existing components
// but should be deprecated in favor of using the backend API
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Supabase configuration - using hardcoded values as fallback since env vars may not load in all environments
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://ijygsxwfmribbjymxhaf.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqeWdzeHdmbXJpYmJqeW14aGFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczNDMzOTcsImV4cCI6MjA3MjkxOTM5N30.p_c6M_7eUJcOU2bmuOhx6Na7mQC6cRNEMsHMOlQJuMc";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Supabase credentials missing');
}

// This client is deprecated - use the backend API instead
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});

// ⚠️ DEPRECATION NOTICE:
// This direct Supabase client should not be used for authenticated operations.
// Use the backend API (api.ts) for secure data operations.