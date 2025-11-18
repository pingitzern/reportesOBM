// Jest setup: provide defaults and mocks for browser globals used in tests
if (typeof global !== 'undefined') {
  try {
    // ensure a default API_URL is available to avoid config warnings
    if (typeof window !== 'undefined') {
      window.__APP_CONFIG__ = window.__APP_CONFIG__ || { API_URL: 'http://test' };
      // provide a no-op alert implementation (jsdom may not implement it)
      if (typeof window.alert !== 'function') {
        window.alert = () => {};
      }
    }

    // also set process env fallback
    if (!process.env.VITE_API_URL && !process.env.API_URL) {
      process.env.API_URL = process.env.VITE_API_URL = 'http://test';
    }

    if (typeof global.alert !== 'function') {
      global.alert = () => {};
    }
  } catch (e) {
    // swallow setup errors to avoid failing tests on non-standard envs
    // eslint-disable-next-line no-console
    console.warn('jest.setup: error applying test shims', e);
  }
}

// Optional: filter noisy console messages coming from code that expects runtime env
(() => {
  const origWarn = console.warn.bind(console);
  console.warn = (...args) => {
    try {
      const first = args[0] && String(args[0]);
      if (first && first.indexOf('API_URL no está configurada') !== -1) {
        return; // ignore this noisy config warning in tests
      }
    } catch (e) {
      // ignore errors during setup shim installation
      // console.debug('jest.setup shim error', e);
    }
    return origWarn(...args);
  };

  const origError = console.error.bind(console);
  console.error = (...args) => {
    try {
      const first = args[0] && String(args[0]);
      if (first) {
        if (first.indexOf('Error al cargar clientes para ablandador') !== -1) return;
        if (first.indexOf('Not implemented: window.alert') !== -1) return;
        if (first.indexOf('No hay una sesión activa') !== -1) return;
      }
    } catch (e) {
      // ignore errors when filtering console output
      // console.debug('jest.setup console filter error', e);
    }
    return origError(...args);
  };
})();
