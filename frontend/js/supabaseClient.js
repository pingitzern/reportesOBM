import { createClient } from '@supabase/supabase-js';

// Detect if running in Jest test environment
const isTestEnv = typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test';

// Obtener credenciales desde variables de entorno (Vite)
const runtimeConfig = typeof window !== 'undefined' ? window.__APP_CONFIG__ || {} : {};
const importMetaEnv = typeof import.meta !== 'undefined' && import.meta && import.meta.env ? import.meta.env : {};

const supabaseUrl =
  importMetaEnv.VITE_SUPABASE_URL ??
  runtimeConfig.VITE_SUPABASE_URL ??
  runtimeConfig.SUPABASE_URL;

const supabaseAnonKey =
  importMetaEnv.VITE_SUPABASE_ANON_KEY ??
  runtimeConfig.VITE_SUPABASE_ANON_KEY ??
  runtimeConfig.SUPABASE_ANON_KEY;

// In test environment, use dummy values if not provided
const finalUrl = supabaseUrl || (isTestEnv ? 'https://test.supabase.co' : null);
const finalKey = supabaseAnonKey || (isTestEnv ? 'test-anon-key' : null);

if (!finalUrl || !finalKey) {
  const message =
    '[supabaseClient] Credenciales de Supabase no encontradas. Define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en el archivo .env';
  console.error(message);
  throw new Error(message);
}

// Configuración del cliente con auto-refresh de tokens
export const supabase = createClient(finalUrl, finalKey, {
  auth: {
    autoRefreshToken: true,      // Refresca el token automáticamente antes de expirar
    persistSession: true,         // Persiste la sesión en storage
    detectSessionInUrl: false,    // No usamos OAuth redirects
  },
});
