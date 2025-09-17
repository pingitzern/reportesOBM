/**
 * @jest-environment node
 */

import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

const AUTH_STORAGE_KEY = 'reportesOBM.auth';
const API_URL = 'https://auth.example.com/sesion';

const loadAuthModule = async ({ apiUrl = API_URL } = {}) => {
    if (apiUrl === undefined) {
        delete process.env.API_URL;
    } else {
        process.env.API_URL = apiUrl;
    }

    return import('../auth.js');
};

const createStorageMock = (initial = {}) => {
    const store = { ...initial };
    return {
        getItem: jest.fn(key => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null)),
        setItem: jest.fn((key, value) => {
            store[key] = String(value);
        }),
        removeItem: jest.fn(key => {
            delete store[key];
        }),
        clear: jest.fn(() => {
            Object.keys(store).forEach(prop => {
                delete store[prop];
            });
        }),
        __store: store,
    };
};

const createClassList = initial => {
    const classes = new Set(initial);
    return {
        add: cls => {
            classes.add(cls);
        },
        remove: cls => {
            classes.delete(cls);
        },
        contains: cls => classes.has(cls),
        has: cls => classes.has(cls),
        toArray: () => Array.from(classes),
    };
};

const setupDocumentMock = () => {
    const panel = { classList: createClassList(['hidden']) };
    const userLabel = { textContent: '' };
    const logoutButton = { disabled: true };

    const elements = {
        panel,
        userLabel,
        logoutButton,
    };

    const map = {
        'auth-user-panel': panel,
        'current-user': userLabel,
        'logout-button': logoutButton,
    };

    global.document = {
        getElementById: jest.fn(id => map[id] || null),
    };

    return elements;
};

const getTestables = async options => {
    const module = await loadAuthModule(options);
    return module.__testables__;
};

describe('auth helpers', () => {
    let storage;
    let elements;

    beforeEach(() => {
        jest.resetModules();
        storage = createStorageMock();
        global.localStorage = storage;
        elements = setupDocumentMock();
        global.fetch = jest.fn();
    });

    afterEach(() => {
        jest.clearAllMocks();
        delete global.fetch;
        delete global.localStorage;
        delete global.document;
        delete process.env.API_URL;
    });

    describe('persistAuth', () => {
        test('guarda la sesión y actualiza el panel de usuario', async () => {
            const { loadStoredAuth, persistAuth } = await getTestables();
            const auth = { token: 'token-123', usuario: 'Ana' };

            persistAuth(auth);

            expect(storage.setItem).toHaveBeenCalledWith(AUTH_STORAGE_KEY, JSON.stringify(auth));
            expect(loadStoredAuth()).toEqual(auth);
            expect(elements.panel.classList.contains('hidden')).toBe(false);
            expect(elements.userLabel.textContent).toBe('Ana');
            expect(elements.logoutButton.disabled).toBe(false);
        });

        test('no falla cuando localStorage no está disponible', async () => {
            delete global.localStorage;
            const { loadStoredAuth, persistAuth } = await getTestables();
            const auth = { token: 'token-456', usuario: 'Luis' };

            expect(() => persistAuth(auth)).not.toThrow();
            expect(storage.setItem).not.toHaveBeenCalled();
            expect(loadStoredAuth()).toEqual(auth);
            expect(elements.panel.classList.contains('hidden')).toBe(false);
        });
    });

    describe('clearStoredAuth', () => {
        test('elimina la sesión almacenada y oculta el panel', async () => {
            const { clearStoredAuth, loadStoredAuth, persistAuth } = await getTestables();
            const auth = { token: 'token-789', usuario: 'Carla' };

            persistAuth(auth);
            expect(loadStoredAuth()).toEqual(auth);

            clearStoredAuth();

            expect(storage.removeItem).toHaveBeenCalledWith(AUTH_STORAGE_KEY);
            expect(storage.__store[AUTH_STORAGE_KEY]).toBeUndefined();
            expect(loadStoredAuth()).toBeNull();
            expect(elements.panel.classList.contains('hidden')).toBe(true);
            expect(elements.userLabel.textContent).toBe('');
            expect(elements.logoutButton.disabled).toBe(true);
        });

        test('no falla cuando no existe almacenamiento disponible', async () => {
            delete global.localStorage;
            const { clearStoredAuth } = await getTestables();

            elements.panel.classList.remove('hidden');
            elements.logoutButton.disabled = false;
            elements.userLabel.textContent = 'Demo';

            expect(() => clearStoredAuth()).not.toThrow();
            expect(storage.removeItem).not.toHaveBeenCalled();
            expect(elements.panel.classList.contains('hidden')).toBe(true);
            expect(elements.logoutButton.disabled).toBe(true);
            expect(elements.userLabel.textContent).toBe('');
        });
    });

    describe('loadStoredAuth', () => {
        test('devuelve la sesión válida desde localStorage', async () => {
            const storedAuth = { token: 'token-abc', usuario: 'Marina' };
            storage.__store[AUTH_STORAGE_KEY] = JSON.stringify(storedAuth);

            const { loadStoredAuth } = await getTestables();

            const auth = loadStoredAuth();

            expect(storage.getItem).toHaveBeenCalledWith(AUTH_STORAGE_KEY);
            expect(auth).toEqual(storedAuth);
        });

        test('usa la sesión en caché sin volver a consultar el almacenamiento', async () => {
            const storedAuth = { token: 'token-cache', usuario: 'Pedro' };
            storage.__store[AUTH_STORAGE_KEY] = JSON.stringify(storedAuth);

            const { loadStoredAuth } = await getTestables();

            const first = loadStoredAuth();
            expect(storage.getItem).toHaveBeenCalledTimes(1);

            const second = loadStoredAuth();

            expect(storage.getItem).toHaveBeenCalledTimes(1);
            expect(second).toBe(first);
        });

        test('devuelve null si el JSON almacenado es inválido', async () => {
            storage.__store[AUTH_STORAGE_KEY] = '{invalid json';
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

            const { loadStoredAuth } = await getTestables();

            expect(loadStoredAuth()).toBeNull();
            expect(storage.getItem).toHaveBeenCalledWith(AUTH_STORAGE_KEY);

            warnSpy.mockRestore();
        });

        test('devuelve null si faltan datos obligatorios', async () => {
            storage.__store[AUTH_STORAGE_KEY] = JSON.stringify({ token: 'token-only' });

            const { loadStoredAuth } = await getTestables();

            expect(loadStoredAuth()).toBeNull();
        });
    });

    describe('requestAuthentication', () => {
        test('envía credenciales y devuelve el usuario autenticado', async () => {
            const payload = { usuario: '  usuarioLocal  ', token: '  tokenLocal  ' };
            const serverResponse = { result: 'success', data: { usuario: '  Usuario Remoto  ' } };
            const jsonMock = jest.fn().mockResolvedValue(serverResponse);
            global.fetch.mockResolvedValue({ ok: true, status: 200, json: jsonMock });

            const { requestAuthentication } = await getTestables();

            const auth = await requestAuthentication(payload);

            expect(global.fetch).toHaveBeenCalledWith(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain; charset=utf-8' },
                body: JSON.stringify({
                    action: 'login',
                    usuario: 'usuarioLocal',
                    token: 'tokenLocal',
                }),
            });
            expect(jsonMock).toHaveBeenCalledTimes(1);
            expect(auth).toEqual({ token: 'tokenLocal', usuario: 'Usuario Remoto' });
        });

        test('lanza error cuando la API responde con estado HTTP fallido', async () => {
            global.fetch.mockResolvedValue({ ok: false, status: 401, json: jest.fn() });
            const { requestAuthentication } = await getTestables();

            await expect(requestAuthentication({ usuario: 'Ana', token: '123' })).rejects.toThrow('HTTP 401');
        });

        test('lanza error cuando la respuesta indica fallo', async () => {
            const serverResponse = { result: 'error', error: 'Credenciales inválidas' };
            global.fetch.mockResolvedValue({ ok: true, status: 200, json: jest.fn().mockResolvedValue(serverResponse) });
            const { requestAuthentication } = await getTestables();

            await expect(requestAuthentication({ usuario: 'Ana', token: '123' })).rejects.toThrow('Credenciales inválidas');
        });

        test('lanza error cuando la respuesta no es JSON válido', async () => {
            global.fetch.mockResolvedValue({ ok: true, status: 200, json: jest.fn().mockRejectedValue(new Error('parse error')) });
            const { requestAuthentication } = await getTestables();

            await expect(requestAuthentication({ usuario: 'Ana', token: '123' })).rejects.toThrow('No se pudo interpretar la respuesta de autenticación.');
        });

        test('lanza error cuando el servidor no responde', async () => {
            global.fetch.mockRejectedValue(new TypeError('failed to fetch'));
            const { requestAuthentication } = await getTestables();

            await expect(requestAuthentication({ usuario: 'Ana', token: '123' })).rejects.toThrow('No se pudo conectar con el servidor de autenticación.');
        });

        test('lanza error si no se recibe el usuario autenticado', async () => {
            const serverResponse = { result: 'success', data: {} };
            global.fetch.mockResolvedValue({ ok: true, status: 200, json: jest.fn().mockResolvedValue(serverResponse) });
            const { requestAuthentication } = await getTestables();

            await expect(requestAuthentication({ usuario: '   ', token: 'abc' })).rejects.toThrow('La respuesta del servidor no incluye el usuario autenticado.');
        });

        test('lanza error cuando API_URL no está configurada', async () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            const { requestAuthentication } = await getTestables({ apiUrl: '' });

            await expect(requestAuthentication({ usuario: 'Ana', token: '123' })).rejects.toThrow('API_URL no está configurada.');
            expect(global.fetch).not.toHaveBeenCalled();

            warnSpy.mockRestore();
        });
    });
});

