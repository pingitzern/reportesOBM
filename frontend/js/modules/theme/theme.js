const THEME_STORAGE_KEY = 'reportesOBM.theme';
export const THEME_LIGHT = 'light';
export const THEME_DARK = 'dark';

let currentTheme = THEME_LIGHT;
let explicitPreference = false;
let systemMediaQuery = null;
const listeners = new Set();

function getStorage() {
    if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage;
    }
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
        return globalThis.localStorage;
    }
    return null;
}

function notify(theme) {
    listeners.forEach(listener => {
        if (typeof listener === 'function') {
            try {
                listener(theme);
            } catch (error) {
                console.warn('[theme] Error ejecutando listener:', error);
            }
        }
    });
}

function applyThemeClass(theme) {
    if (typeof document === 'undefined') {
        return;
    }
    const root = document.documentElement;
    if (!root || !root.classList) {
        return;
    }
    const isDark = theme === THEME_DARK;
    root.classList.toggle('dark-theme', isDark);
    root.dataset.theme = theme;
}

function getStoredTheme() {
    const storage = getStorage();
    if (!storage) {
        return null;
    }
    try {
        const value = storage.getItem(THEME_STORAGE_KEY);
        if (value === THEME_DARK || value === THEME_LIGHT) {
            return value;
        }
    } catch (error) {
        console.warn('[theme] No se pudo leer la preferencia almacenada:', error);
    }
    return null;
}

function storeTheme(theme) {
    const storage = getStorage();
    if (!storage) {
        return;
    }
    try {
        storage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
        console.warn('[theme] No se pudo guardar la preferencia de tema:', error);
    }
}

function clearStoredTheme() {
    const storage = getStorage();
    if (!storage) {
        return;
    }
    try {
        storage.removeItem(THEME_STORAGE_KEY);
    } catch (error) {
        console.warn('[theme] No se pudo limpiar la preferencia de tema:', error);
    }
}

function getSystemTheme() {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return THEME_LIGHT;
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? THEME_DARK
        : THEME_LIGHT;
}

function handleSystemPreferenceChange(event) {
    if (explicitPreference) {
        return;
    }
    const theme = event?.matches ? THEME_DARK : THEME_LIGHT;
    setTheme(theme, { persist: false, explicit: false });
}

function ensureSystemListener() {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return;
    }
    if (systemMediaQuery) {
        return;
    }
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = handleSystemPreferenceChange;
    if (typeof mediaQuery.addEventListener === 'function') {
        mediaQuery.addEventListener('change', handler);
    } else if (typeof mediaQuery.addListener === 'function') {
        mediaQuery.addListener(handler);
    }
    systemMediaQuery = mediaQuery;
}

export function initializeTheme() {
    const stored = getStoredTheme();
    explicitPreference = Boolean(stored);
    const initialTheme = stored || getSystemTheme();

    currentTheme = initialTheme;
    applyThemeClass(initialTheme);
    ensureSystemListener();
    notify(initialTheme);

    return initialTheme;
}

export function getCurrentTheme() {
    return currentTheme;
}

export function isDarkTheme() {
    return currentTheme === THEME_DARK;
}

export function setTheme(theme, { persist = true, explicit = true } = {}) {
    const normalized = theme === THEME_DARK ? THEME_DARK : THEME_LIGHT;
    if (normalized === currentTheme) {
        if (explicit) {
            explicitPreference = true;
        }
        if (persist) {
            storeTheme(normalized);
        }
        return normalized;
    }

    currentTheme = normalized;
    applyThemeClass(normalized);

    if (persist) {
        storeTheme(normalized);
    } else if (!explicit) {
        clearStoredTheme();
    }

    if (explicit) {
        explicitPreference = true;
    }

    notify(normalized);
    return normalized;
}

export function toggleTheme() {
    return setTheme(isDarkTheme() ? THEME_LIGHT : THEME_DARK);
}

export function onThemeChange(listener) {
    if (typeof listener !== 'function') {
        return () => {};
    }
    listeners.add(listener);
    listener(currentTheme);
    return () => {
        listeners.delete(listener);
    };
}

export function clearThemePreference() {
    clearStoredTheme();
    explicitPreference = false;
    setTheme(getSystemTheme(), { persist: false, explicit: false });
}

