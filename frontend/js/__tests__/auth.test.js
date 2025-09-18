/**
 * @jest-environment node
 */

import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

const AUTH_STORAGE_KEY = 'reportesOBM.user';
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
    const panel = {
        classList: createClassList(['hidden']),
        contains: jest.fn(() => false),
    };
    const userLabel = { textContent: '' };
    const logoutButton = { disabled: true, addEventListener: jest.fn() };
    const userMenuButton = {
        disabled: true,
        attributes: { 'aria-expanded': 'false' },
        setAttribute: jest.fn((name, value) => {
            userMenuButton.attributes[name] = value;
        }),
        getAttribute: jest.fn(name => userMenuButton.attributes[name]),
        addEventListener: jest.fn(),
    };
    const userMenuInitials = { textContent: '' };
    const mainView = { classList: createClassList([]) };

    const elements = {
        panel,
        userLabel,
        logoutButton,
        userMenuButton,
        userMenuInitials,
        mainView,
    };

    const map = {
        'auth-user-panel': panel,
        'current-user': userLabel,
        'logout-button': logoutButton,
        'user-menu-button': userMenuButton,
        'user-menu-initials': userMenuInitials,
    };

    global.document = {
        getElementById: jest.fn(id => map[id] || null),
        querySelector: jest.fn(selector => (selector === '.container' ? mainView : null)),
        addEventListener: jest.fn(),
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
        global.sessionStorage = storage;
        global.localStorage = storage;
        elements = setupDocumentMock();
        global.fetch = jest.fn();
    });

    afterEach(() => {
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
            const auth = { nombre: ' Ana ', cargo: ' Analista ', rol: 'Administradora' };

            persistAuth(auth);

            expect(storage.setItem).toHaveBeenCalledWith(
                AUTH_STORAGE_KEY,
                JSON.stringify({ Nombre: 'Ana', Cargo: 'Analista', Rol: 'Administradora' }),
            );
            expect(loadStoredAuth()).toEqual({ nombre: 'Ana', cargo: 'Analista', rol: 'Administradora' });
            expect(elements.panel.classList.contains('hidden')).toBe(false);
            expect(elements.userLabel.textContent).toBe('Ana');
            expect(elements.userMenuInitials.textContent).toBe('A');
            expect(elements.userMenuButton.disabled).toBe(false);
            expect(elements.userMenuButton.attributes['aria-expanded']).toBe('false');
            expect(elements.userMenuButton.attributes['aria-label']).toBe('Abrir menú de Ana');
            expect(elements.logoutButton.disabled).toBe(false);
        });

        test('no falla cuando localStorage no está disponible', async () => {
            delete global.sessionStorage;
            delete global.localStorage;
            const { loadStoredAuth, persistAuth } = await getTestables();
            const auth = { nombre: 'Luis', cargo: 'Soporte', rol: 'Usuario' };

            expect(() => persistAuth(auth)).not.toThrow();
            expect(storage.setItem).not.toHaveBeenCalled();
            expect(loadStoredAuth()).toEqual(auth);
            expect(elements.panel.classList.contains('hidden')).toBe(false);
            expect(elements.userMenuInitials.textContent).toBe('L');
        });
    });

    describe('clearStoredAuth', () => {
        test('elimina la sesión almacenada y oculta el panel', async () => {
            const { clearStoredAuth, loadStoredAuth, persistAuth } = await getTestables();
            const auth = { nombre: 'Carla', cargo: 'Supervisora', rol: 'Gestora' };

            persistAuth(auth);
            expect(loadStoredAuth()).toEqual(auth);

            clearStoredAuth();

            expect(storage.removeItem).toHaveBeenCalledWith(AUTH_STORAGE_KEY);
            expect(storage.__store[AUTH_STORAGE_KEY]).toBeUndefined();
            expect(loadStoredAuth()).toBeNull();
            expect(elements.panel.classList.contains('hidden')).toBe(true);
            expect(elements.userLabel.textContent).toBe('');
            expect(elements.userMenuInitials.textContent).toBe('');
            expect(elements.userMenuButton.disabled).toBe(true);
            expect(elements.userMenuButton.attributes['aria-label']).toBe('Abrir menú de usuario');
            expect(elements.logoutButton.disabled).toBe(true);
        });

        test('no falla cuando no existe almacenamiento disponible', async () => {
            delete global.sessionStorage;
            delete global.localStorage;
            const { clearStoredAuth } = await getTestables();

            elements.panel.classList.remove('hidden');
            elements.logoutButton.disabled = false;
            elements.userLabel.textContent = 'Demo';
            elements.userMenuInitials.textContent = 'D';
            elements.userMenuButton.disabled = false;
            elements.userMenuButton.attributes['aria-label'] = 'Abrir menú de Demo';

            expect(() => clearStoredAuth()).not.toThrow();
            expect(storage.removeItem).not.toHaveBeenCalled();
            expect(elements.panel.classList.contains('hidden')).toBe(true);
            expect(elements.logoutButton.disabled).toBe(true);
            expect(elements.userLabel.textContent).toBe('');
            expect(elements.userMenuInitials.textContent).toBe('');
            expect(elements.userMenuButton.disabled).toBe(true);
            expect(elements.userMenuButton.attributes['aria-label']).toBe('Abrir menú de usuario');
        });
    });

    describe('loadStoredAuth', () => {
        test('devuelve la sesión válida desde localStorage', async () => {
            const storedAuth = { Nombre: 'Marina', Cargo: 'Operaria', Rol: 'Coordinadora' };
            storage.__store[AUTH_STORAGE_KEY] = JSON.stringify(storedAuth);

            const { loadStoredAuth } = await getTestables();

            const auth = loadStoredAuth();

            expect(storage.getItem).toHaveBeenCalledWith(AUTH_STORAGE_KEY);
            expect(auth).toEqual({ nombre: 'Marina', cargo: 'Operaria', rol: 'Coordinadora' });
        });

        test('usa la sesión en caché sin volver a consultar el almacenamiento', async () => {
            const storedAuth = { Nombre: 'Pedro', Cargo: 'Inspector', Rol: 'Usuario' };
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
            storage.__store[AUTH_STORAGE_KEY] = JSON.stringify({ Nombre: 'SoloNombre' });

            const { loadStoredAuth } = await getTestables();

            expect(loadStoredAuth()).toBeNull();
        });
    });

    describe('requestAuthentication', () => {
        test('envía credenciales y devuelve el usuario autenticado', async () => {
            const payload = { mail: '  usuario@example.com  ', password: '  tokenLocal  ' };
            const serverResponse = {
                result: 'success',
                data: { Nombre: '  Usuario Remoto  ', Cargo: 'Operaciones', Rol: 'Supervisor' },
            };
            const jsonMock = jest.fn().mockResolvedValue(serverResponse);
            global.fetch.mockResolvedValue({ ok: true, status: 200, json: jsonMock });

            const { requestAuthentication } = await getTestables();

            const auth = await requestAuthentication(payload);

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
            expect(auth).toEqual({ nombre: 'Usuario Remoto', cargo: 'Operaciones', rol: 'Supervisor' });
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

        test('lanza error si no se recibe el usuario autenticado', async () => {
            const serverResponse = { result: 'success', data: {} };
            global.fetch.mockResolvedValue({ ok: true, status: 200, json: jest.fn().mockResolvedValue(serverResponse) });
            const { requestAuthentication } = await getTestables();

            await expect(requestAuthentication({ mail: '   ', password: 'abc' }))
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

