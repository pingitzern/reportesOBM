const runtimeConfig = typeof window !== 'undefined' ? window.__APP_CONFIG__ : undefined;

const browserApiUrl = runtimeConfig && typeof runtimeConfig.API_URL === 'string'
    ? runtimeConfig.API_URL.trim()
    : '';

let resolvedApiUrl = browserApiUrl;

if (!resolvedApiUrl) {
    const viteEnv =
        typeof import.meta !== 'undefined' && import.meta && typeof import.meta.env === 'object'
            ? import.meta.env
            : undefined;

    if (viteEnv && typeof viteEnv.VITE_API_URL === 'string') {
        resolvedApiUrl = viteEnv.VITE_API_URL.trim();
    }
}

const runtimeProcess =
    typeof globalThis !== 'undefined' && typeof globalThis.process === 'object'
        ? globalThis.process
        : undefined;

if (
    !resolvedApiUrl &&
    runtimeProcess &&
    runtimeProcess.env &&
    typeof runtimeProcess.env.API_URL === 'string'
) {
    resolvedApiUrl = runtimeProcess.env.API_URL;
}

if (!resolvedApiUrl) {
    console.warn('[config] API_URL no está configurada. Define window.__APP_CONFIG__.API_URL o la variable de entorno VITE_API_URL/API_URL.');
}

export const API_URL = resolvedApiUrl;
export const LMIN_TO_LPH = 60;
export const LMIN_TO_GPD = (60 * 24) / 3.78541;
