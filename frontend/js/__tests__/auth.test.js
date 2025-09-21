/**
 * @jest-environment node
 */

import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

const AUTH_STORAGE_KEY = 'reportesOBM.user';
const API_URL = 'https://auth.example.com/sesion';
const NOW = new Date('2024-01-01T12:00:00.000Z');

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
    const panel = {
        classList: createClassList(['hidden']),
    };
    const userLabel = { textContent: '' };
    const userRole = { textContent: '' };
    const logoutButton = { disabled: true, addEventListener: jest.fn() };
    const mainView = { classList: createClassList([]) };
    const loginContainer = { classList: createClassList([]) };
    const form = {
        addEventListener: jest.fn(),
        querySelectorAll: jest.fn(() => []),
        reset: jest.fn(),
    };
    const error = {
        textContent: '',
        classList: createClassList(['hidden']),
    };
    const mailInput = { value: '', focus: jest.fn() };
    const passwordInput = { value: '' };

    const elements = {
        panel,
        userLabel,
        userRole,
        logoutButton,
        mainView,
        loginContainer,
    };

    const map = {
        'auth-user-panel': panel,
        'current-user': userLabel,
        'current-user-role': userRole,
        'logout-button': logoutButton,
        'login-form': form,
        'login-error': error,
        'login-mail': mailInput,
        'login-password': passwordInput,
        'login-container': loginContainer,
    };

    global.document = {
        getElementById: jest.fn(id => (Object.prototype.hasOwnProperty.call(map, id) ? map[id] : null)),
        querySelector: jest.fn(selector => {
            if (selector === '.app-container') {
                return mainView;
            }
            if (selector === '.login-container') {
                return loginContainer;
            }
            return null;
        }),
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
        jest.useFakeTimers();
        jest.setSystemTime(NOW);
        jest.resetModules();
        storage = createStorageMock();
        global.sessionStorage = storage;
        global.localStorage = storage;
        elements = setupDocumentMock();
        global.fetch = jest.fn();
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.clearAllMocks();
        delete global.fetch;
        delete global.sessionStorage;
        delete global.localStorage;
        delete global.document;
        delete process.env.API_URL;
    });

    describe('persistAuth', () => {
        test('guarda la sesión y actualiza el panel de usuario', async () => {
            const { loadStoredAuth, persistAuth } = await getTestables();
            const expiresAt = new Date(NOW.getTime() + 60 * 60 * 1000).toISOString();
            const session = {
                user: { nombre: ' Ana ', cargo: ' Analista ', rol: 'Administradora' },
                token: ' token-123 ',
                expiresAt,
            };

            persistAuth(session);

            expect(storage.setItem).toHaveBeenCalledWith(
                AUTH_STORAGE_KEY,
                expect.any(String),
            );
            const storedPayload = JSON.parse(storage.setItem.mock.calls[0][1]);
            expect(storedPayload).toEqual({
                user: { nombre: 'Ana', cargo: 'Analista', rol: 'Administradora' },
                token: 'token-123',
                expiresAt,
            });
            expect(loadStoredAuth()).toEqual({
                user: { nombre: 'Ana', cargo: 'Analista', rol: 'Administradora' },
                token: 'token-123',
                expiresAt,
            });
            expect(elements.panel.classList.contains('hidden')).toBe(false);
            expect(elements.userLabel.textContent).toBe('Ana');
            expect(elements.userRole.textContent).toBe('Administradora');
            expect(elements.logoutButton.disabled).toBe(false);
        });

        test('no falla cuando localStorage no está disponible', async () => {
            delete global.sessionStorage;
            delete global.localStorage;
            const { loadStoredAuth, persistAuth } = await getTestables();
            const expiresAt = new Date(NOW.getTime() + 30 * 60 * 1000).toISOString();
            const session = {
                user: { nombre: 'Luis', cargo: 'Soporte', rol: 'Usuario' },
                token: ' token-offline ',
                expiresAt,
            };

            expect(() => persistAuth(session)).not.toThrow();
            expect(storage.setItem).not.toHaveBeenCalled();
            expect(loadStoredAuth()).toEqual({
                user: { nombre: 'Luis', cargo: 'Soporte', rol: 'Usuario' },
                token: 'token-offline',
                expiresAt,
            });
            expect(elements.panel.classList.contains('hidden')).toBe(false);
            expect(elements.userRole.textContent).toBe('Usuario');
        });
    });

    describe('clearStoredAuth', () => {
        test('elimina la sesión almacenada y oculta el panel', async () => {
            const { clearStoredAuth, loadStoredAuth, persistAuth } = await getTestables();
            const expiresAt = new Date(NOW.getTime() + 90 * 60 * 1000).toISOString();
            const session = {
                user: { nombre: 'Carla', cargo: 'Supervisora', rol: 'Gestora' },
                token: 'token-clear',
                expiresAt,
            };

            persistAuth(session);
            expect(loadStoredAuth()).toEqual(session);

            clearStoredAuth();

            expect(storage.removeItem).toHaveBeenCalledWith(AUTH_STORAGE_KEY);
            expect(storage.__store[AUTH_STORAGE_KEY]).toBeUndefined();
            expect(loadStoredAuth()).toBeNull();
            expect(elements.panel.classList.contains('hidden')).toBe(true);
            expect(elements.userLabel.textContent).toBe('');
            expect(elements.userRole.textContent).toBe('');
            expect(elements.logoutButton.disabled).toBe(true);
        });

        test('no falla cuando no existe almacenamiento disponible', async () => {
            delete global.sessionStorage;
            delete global.localStorage;
            const { clearStoredAuth } = await getTestables();

            elements.panel.classList.remove('hidden');
            elements.logoutButton.disabled = false;
            elements.userLabel.textContent = 'Demo';
            elements.userRole.textContent = 'Demo Rol';

            expect(() => clearStoredAuth()).not.toThrow();
            expect(storage.removeItem).not.toHaveBeenCalled();
            expect(elements.panel.classList.contains('hidden')).toBe(true);
            expect(elements.logoutButton.disabled).toBe(true);
            expect(elements.userLabel.textContent).toBe('');
            expect(elements.userRole.textContent).toBe('');
        });
    });

    describe('loadStoredAuth', () => {
        test('devuelve la sesión válida desde localStorage', async () => {
            const expiresAt = new Date(NOW.getTime() + 2 * 60 * 60 * 1000).toISOString();
            const storedAuth = {
                user: { nombre: 'Marina', cargo: 'Operaria', rol: 'Coordinadora' },
                token: 'token-123',
                expiresAt,
            };
            storage.__store[AUTH_STORAGE_KEY] = JSON.stringify(storedAuth);

            const { loadStoredAuth } = await getTestables();

            const session = loadStoredAuth();

            expect(storage.getItem).toHaveBeenCalledWith(AUTH_STORAGE_KEY);
            expect(session).toEqual(storedAuth);
        });

        test('usa la sesión en caché sin volver a consultar el almacenamiento', async () => {
            const expiresAt = new Date(NOW.getTime() + 45 * 60 * 1000).toISOString();
            const storedAuth = {
                user: { nombre: 'Pedro', cargo: 'Inspector', rol: 'Usuario' },
                token: 'token-cache',
                expiresAt,
            };
            storage.__store[AUTH_STORAGE_KEY] = JSON.stringify(storedAuth);

            const { loadStoredAuth } = await getTestables();

            const first = loadStoredAuth();
            expect(storage.getItem).toHaveBeenCalledTimes(1);

            const second = loadStoredAuth();

            expect(storage.getItem).toHaveBeenCalledTimes(1);
            expect(second).toBe(first);
            expect(first).toEqual(storedAuth);
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
            storage.__store[AUTH_STORAGE_KEY] = JSON.stringify({
                user: { nombre: 'SoloNombre', cargo: 'Operaria', rol: 'Analista' },
            });

            const { loadStoredAuth } = await getTestables();

            expect(loadStoredAuth()).toBeNull();
            expect(storage.removeItem).toHaveBeenCalledWith(AUTH_STORAGE_KEY);
        });

        test('devuelve null si el token expiró', async () => {
            const expired = new Date(NOW.getTime() - 5 * 60 * 1000).toISOString();
            storage.__store[AUTH_STORAGE_KEY] = JSON.stringify({
                user: { nombre: 'Juan', cargo: 'Técnico', rol: 'Usuario' },
                token: 'token-expired',
                expiresAt: expired,
            });

            const { loadStoredAuth } = await getTestables();

            expect(loadStoredAuth()).toBeNull();
            expect(storage.removeItem).toHaveBeenCalledWith(AUTH_STORAGE_KEY);
        });

        test('devuelve null si la fecha de expiración es inválida', async () => {
            storage.__store[AUTH_STORAGE_KEY] = JSON.stringify({
                user: { nombre: 'Marta', cargo: 'Operaria', rol: 'Gestora' },
                token: 'token-invalid-exp',
                expiresAt: 'no-es-una-fecha',
            });

            const { loadStoredAuth } = await getTestables();

            expect(loadStoredAuth()).toBeNull();
            expect(storage.removeItem).toHaveBeenCalledWith(AUTH_STORAGE_KEY);
        });
    });

    describe('requestAuthentication', () => {
        test('envía credenciales y devuelve la sesión autenticada', async () => {
            const payload = { mail: '  usuario@example.com  ', password: '  tokenLocal  ' };
            const expiresAt = new Date(NOW.getTime() + 30 * 60 * 1000).toISOString();
            const serverResponse = {
                result: 'success',
                data: {
                    token: ' token-remoto ',
                    expiresAt,
                    usuario: { Nombre: '  Usuario Remoto  ', Cargo: 'Operaciones', Rol: 'Supervisor' },
                },
            };
            const jsonMock = jest.fn().mockResolvedValue(serverResponse);
            global.fetch.mockResolvedValue({ ok: true, status: 200, json: jsonMock });

            const { requestAuthentication } = await getTestables();

            const session = await requestAuthentication(payload);

            expect(global.fetch).toHaveBeenCalledWith(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain; charset=utf-8' },
                body: JSON.stringify({
                    action: 'login',
                    mail: 'usuario@example.com',
                    password: 'tokenLocal',
                }),
            });
            expect(jsonMock).toHaveBeenCalledTimes(1);
            expect(session).toEqual({
                user: { nombre: 'Usuario Remoto', cargo: 'Operaciones', rol: 'Supervisor' },
                token: 'token-remoto',
                expiresAt,
            });
        });

        test('lanza error cuando la API responde con estado HTTP fallido', async () => {
            global.fetch.mockResolvedValue({ ok: false, status: 401, json: jest.fn() });
            const { requestAuthentication } = await getTestables();

            await expect(requestAuthentication({ mail: 'ana@example.com', password: '123' }))
                .rejects.toThrow('Mail o contraseña incorrectos');
        });

        test('lanza error cuando la respuesta indica fallo', async () => {
            const serverResponse = { result: 'error', error: 'Credenciales inválidas' };
            global.fetch.mockResolvedValue({ ok: true, status: 200, json: jest.fn().mockResolvedValue(serverResponse) });
            const { requestAuthentication } = await getTestables();

            await expect(requestAuthentication({ mail: 'ana@example.com', password: '123' }))
                .rejects.toThrow('Mail o contraseña incorrectos');
        });

        test('lanza error cuando la respuesta no es JSON válido', async () => {
            global.fetch.mockResolvedValue({ ok: true, status: 200, json: jest.fn().mockRejectedValue(new Error('parse error')) });
            const { requestAuthentication } = await getTestables();

            await expect(requestAuthentication({ mail: 'ana@example.com', password: '123' }))
                .rejects.toThrow('No se pudo interpretar la respuesta de autenticación.');
        });

        test('lanza error cuando el servidor no responde', async () => {
            global.fetch.mockRejectedValue(new TypeError('failed to fetch'));
            const { requestAuthentication } = await getTestables();

            await expect(requestAuthentication({ mail: 'ana@example.com', password: '123' }))
                .rejects.toThrow('No se pudo conectar con el servidor de autenticación.');
        });

        test('lanza error si falta la información del usuario', async () => {
            const expiresAt = new Date(NOW.getTime() + 15 * 60 * 1000).toISOString();
            const serverResponse = { result: 'success', data: { token: 'token-sin-usuario', expiresAt } };
            global.fetch.mockResolvedValue({ ok: true, status: 200, json: jest.fn().mockResolvedValue(serverResponse) });
            const { requestAuthentication } = await getTestables();

            await expect(requestAuthentication({ mail: '   ', password: 'abc' }))
                .rejects.toThrow('Mail o contraseña incorrectos');
        });

        test('lanza error si falta el token de sesión', async () => {
            const expiresAt = new Date(NOW.getTime() + 15 * 60 * 1000).toISOString();
            const serverResponse = {
                result: 'success',
                data: {
                    usuario: { Nombre: 'Ana', Cargo: 'Soporte', Rol: 'Usuario' },
                    expiresAt,
                },
            };
            global.fetch.mockResolvedValue({ ok: true, status: 200, json: jest.fn().mockResolvedValue(serverResponse) });
            const { requestAuthentication } = await getTestables();

            await expect(requestAuthentication({ mail: 'ana@example.com', password: '123' }))
                .rejects.toThrow('Mail o contraseña incorrectos');
        });

        test('lanza error si el token recibido está expirado', async () => {
            const expiresAt = new Date(NOW.getTime() - 5 * 60 * 1000).toISOString();
            const serverResponse = {
                result: 'success',
                data: {
                    token: 'token-expirado',
                    expiresAt,
                    usuario: { Nombre: 'Ana', Cargo: 'Soporte', Rol: 'Usuario' },
                },
            };
            global.fetch.mockResolvedValue({ ok: true, status: 200, json: jest.fn().mockResolvedValue(serverResponse) });
            const { requestAuthentication } = await getTestables();

            await expect(requestAuthentication({ mail: 'ana@example.com', password: '123' }))
                .rejects.toThrow('Mail o contraseña incorrectos');
        });

        test('lanza error cuando API_URL no está configurada', async () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            const { requestAuthentication } = await getTestables({ apiUrl: '' });

            await expect(requestAuthentication({ mail: 'ana@example.com', password: '123' }))
                .rejects.toThrow('API_URL no está configurada.');
            expect(global.fetch).not.toHaveBeenCalled();

            warnSpy.mockRestore();
        });
    });
});

