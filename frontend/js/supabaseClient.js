/*import { createClient } from '@supabase/supabase-js';

const runtimeConfig = typeof window !== 'undefined' ? window.__APP_CONFIG__ || {} : {};
const importMetaEnv = typeof import.meta !== 'undefined' && import.meta && import.meta.env ? import.meta.env : {};
const runtimeProcess =
  typeof globalThis !== 'undefined' && typeof globalThis.process === 'object'
    ? globalThis.process
    : undefined;

const supabaseUrl =
  importMetaEnv.VITE_SUPABASE_URL ??
  runtimeConfig.VITE_SUPABASE_URL ??
  runtimeConfig.SUPABASE_URL ??
  runtimeProcess?.env?.VITE_SUPABASE_URL ??
  runtimeProcess?.env?.SUPABASE_URL;

const supabaseAnonKey =
  importMetaEnv.VITE_SUPABASE_ANON_KEY ??
  runtimeConfig.VITE_SUPABASE_ANON_KEY ??
  runtimeConfig.SUPABASE_ANON_KEY ??
  runtimeProcess?.env?.VITE_SUPABASE_ANON_KEY ??
  runtimeProcess?.env?.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  const message =
    'Supabase credentials are missing. Define VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (or inject them via window.__APP_CONFIG__).';
  console.error(message);
  throw new Error(message);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
*/
import { createClient } from '@supabase/supabase-js'

// PEGA TUS DATOS REALES AQUÍ DIRECTAMENTE (Hardcode)
const supabaseUrl = "https://nvoihnnwpzeofzexblyg.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52b2lobm53cHplb2Z6ZXhibHlnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mzk0NDk3MCwiZXhwIjoyMDc5NTIwOTcwfQ.sUV2BVWxd5KDJ_CU6oh5hCbkcOMNAq0Y-8BHm9q-v5A"
export const supabase = createClient(supabaseUrl, supabaseKey)
