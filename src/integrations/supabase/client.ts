// This file is kept for backward compatibility with existing components
// but should be deprecated in favor of using the backend API
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// ⚠️ SECURITY WARNING: DO NOT hardcode credentials here
// These should be loaded from environment variables
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('⚠️ Supabase credentials not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.');
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