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

const matchesSelector = (element, selector) => {
    if (!element || !selector) {
        return false;
    }

    const selectors = selector.split(',').map(token => token.trim()).filter(Boolean);
    return selectors.some(sel => {
        if (!sel) {
            return false;
        }
        if (sel.startsWith('.')) {
            const className = sel.slice(1);
            return Boolean(element.classList?.contains(className));
        }
        if (sel.startsWith('#')) {
            return element.id === sel.slice(1);
        }
        if (sel.startsWith('[') && sel.endsWith(']')) {
            const content = sel.slice(1, -1);
            const [attrNamePart, attrValuePart] = content.split('=');
            const attrName = attrNamePart.trim();
            const normalizedValue = attrValuePart?.trim()?.replace(/^['"]|['"]$/g, '');

            let value = element.getAttribute?.(attrName);
            if (value === undefined && attrName.startsWith('data-') && element.dataset) {
                const dataKey = attrName
                    .slice(5)
                    .replace(/-([a-z])/g, (_, char) => char.toUpperCase());
                if (Object.prototype.hasOwnProperty.call(element.dataset, dataKey)) {
                    value = element.dataset[dataKey];
                }
            }

            if (attrValuePart === undefined) {
                return value !== undefined;
            }
            return value === normalizedValue;
        }
        return false;
    });
};

const createElementStub = ({ initialClasses = [], textContent = '', disabled = false } = {}) => {
    const attributes = {};
    const dataset = {};
    const listeners = {};

    const element = {
        disabled,
        textContent,
        classList: createClassList(initialClasses),
        dataset,
        attributes,
        listeners,
        addEventListener: jest.fn((type, handler) => {
            if (!listeners[type]) {
                listeners[type] = new Set();
            }
            listeners[type].add(handler);
        }),
        removeEventListener: jest.fn((type, handler) => {
            if (listeners[type]) {
                listeners[type].delete(handler);
            }
        }),
        dispatchEvent: jest.fn(event => {
            const type = event?.type;
            if (!type || !listeners[type]) {
                return;
            }
            listeners[type].forEach(handler => {
                handler(event);
            });
        }),
        setAttribute: jest.fn((name, value) => {
            attributes[name] = String(value);
            if (name.startsWith('data-')) {
                const dataKey = name
                    .slice(5)
                    .replace(/-([a-z])/g, (_, char) => char.toUpperCase());
                dataset[dataKey] = String(value);
            }
            if (name === 'role') {
                element.role = String(value);
            }
        }),
        getAttribute: jest.fn(name => {
            if (Object.prototype.hasOwnProperty.call(attributes, name)) {
                return attributes[name];
            }
            if (name.startsWith('data-')) {
                const dataKey = name
                    .slice(5)
                    .replace(/-([a-z])/g, (_, char) => char.toUpperCase());
                if (Object.prototype.hasOwnProperty.call(dataset, dataKey)) {
                    return dataset[dataKey];
                }
            }
            return undefined;
        }),
        focus: jest.fn(),
    };

    element.children = [];
    element.appendChild = child => {
        element.children.push(child);
        if (child && typeof child === 'object') {
            child.parentElement = element;
        }
    };

    element.contains = jest.fn(target => {
        if (!target) {
            return false;
        }
        if (target === element) {
            return true;
        }
        return element.children.some(child => (typeof child?.contains === 'function'
            ? child.contains(target)
            : child === target));
    });

    element.querySelectorAll = jest.fn(selector => {
        const results = [];
        const visit = node => {
            if (!node) {
                return;
            }
            if (node !== element && matchesSelector(node, selector)) {
                results.push(node);
            }
            if (Array.isArray(node.children)) {
                node.children.forEach(visit);
            }
        };
        element.children.forEach(visit);
        return results;
    });

    element.querySelector = jest.fn(selector => element.querySelectorAll(selector)[0] || null);

    return element;
};

const setupDocumentMock = () => {
    const panel = createElementStub({ initialClasses: ['hidden'] });
    panel.id = 'auth-user-panel';

    const menuButton = createElementStub();
    menuButton.id = 'user-menu-toggle';
    menuButton.disabled = true;
    menuButton.setAttribute('aria-expanded', 'false');

    const menu = createElementStub({ initialClasses: ['hidden'] });
    menu.id = 'user-menu';
    menu.setAttribute('aria-hidden', 'true');

    const userNameDisplay = createElementStub();
    userNameDisplay.setAttribute('data-user-name', '');

    const helpLink = createElementStub();
    helpLink.textContent = 'Ayuda';
    helpLink.setAttribute('role', 'menuitem');
    helpLink.setAttribute('data-auth-action', 'help');

    const settingsLink = createElementStub();
    settingsLink.textContent = 'Configuración';
    settingsLink.setAttribute('role', 'menuitem');
    settingsLink.setAttribute('data-auth-action', 'settings');

    const logoutButton = createElementStub();
    logoutButton.id = 'logout-button';
    logoutButton.disabled = true;
    logoutButton.setAttribute('role', 'menuitem');

    menu.appendChild(userNameDisplay);
    menu.appendChild(helpLink);
    menu.appendChild(settingsLink);
    menu.appendChild(logoutButton);

    panel.appendChild(menuButton);
    panel.appendChild(menu);

    const docListeners = {};

    const elements = {
        panel,
        menuButton,
        menu,
        userNameDisplay,
        helpLink,
        settingsLink,
        logoutButton,
    };

    const map = {
        'auth-user-panel': panel,
        'user-menu-toggle': menuButton,
        'user-menu': menu,
        'logout-button': logoutButton,
        'login-modal': null,
        'login-form': null,
        'login-error': null,
        'login-usuario': null,
        'login-token': null,
    };

    global.document = {
        getElementById: jest.fn(id => map[id] || null),
        addEventListener: jest.fn((type, handler) => {
            if (!docListeners[type]) {
                docListeners[type] = new Set();
            }
            docListeners[type].add(handler);
        }),
        removeEventListener: jest.fn((type, handler) => {
            if (docListeners[type]) {
                docListeners[type].delete(handler);
            }
        }),
        dispatchEvent: jest.fn(() => true),
        __listeners: docListeners,
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
            expect(elements.menuButton.disabled).toBe(false);
            expect(elements.menuButton.getAttribute('aria-expanded')).toBe('false');
            expect(elements.menu.classList.contains('hidden')).toBe(true);
            expect(elements.menu.getAttribute('aria-hidden')).toBe('true');
            expect(elements.userNameDisplay.textContent).toBe('Ana');
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
            expect(elements.menuButton.disabled).toBe(false);
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
            expect(elements.menuButton.disabled).toBe(true);
            expect(elements.menuButton.getAttribute('aria-expanded')).toBe('false');
            expect(elements.menu.classList.contains('hidden')).toBe(true);
            expect(elements.menu.getAttribute('aria-hidden')).toBe('true');
            expect(elements.userNameDisplay.textContent).toBe('');
            expect(elements.logoutButton.disabled).toBe(true);
        });

        test('no falla cuando no existe almacenamiento disponible', async () => {
            delete global.localStorage;
            const { clearStoredAuth } = await getTestables();

            elements.panel.classList.remove('hidden');
            elements.menuButton.disabled = false;
            elements.menuButton.setAttribute('aria-expanded', 'true');
            elements.menu.classList.remove('hidden');
            elements.menu.setAttribute('aria-hidden', 'false');
            elements.logoutButton.disabled = false;
            elements.userNameDisplay.textContent = 'Demo';

            expect(() => clearStoredAuth()).not.toThrow();
            expect(storage.removeItem).not.toHaveBeenCalled();
            expect(elements.panel.classList.contains('hidden')).toBe(true);
            expect(elements.logoutButton.disabled).toBe(true);
            expect(elements.menuButton.disabled).toBe(true);
            expect(elements.menuButton.getAttribute('aria-expanded')).toBe('false');
            expect(elements.menu.classList.contains('hidden')).toBe(true);
            expect(elements.menu.getAttribute('aria-hidden')).toBe('true');
            expect(elements.userNameDisplay.textContent).toBe('');
        });
    });

    describe('user menu interactions', () => {
        test('abre y cierra el menú con el botón de usuario', async () => {
            const { bindEventListeners, persistAuth } = await getTestables();
            bindEventListeners();
            persistAuth({ token: 'token-menu', usuario: 'Laura' });

            const [buttonHandler] = Array.from(elements.menuButton.listeners.click);
            expect(typeof buttonHandler).toBe('function');

            const clickEvent = { preventDefault: jest.fn(), stopPropagation: jest.fn(), target: elements.menuButton };
            buttonHandler(clickEvent);

            expect(elements.menu.classList.contains('hidden')).toBe(false);
            expect(elements.menu.getAttribute('aria-hidden')).toBe('false');
            expect(elements.menuButton.getAttribute('aria-expanded')).toBe('true');
            expect(global.document.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
            expect(global.document.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));

            buttonHandler(clickEvent);

            expect(elements.menu.classList.contains('hidden')).toBe(true);
            expect(elements.menuButton.getAttribute('aria-expanded')).toBe('false');
            expect(global.document.removeEventListener).toHaveBeenCalledWith('click', expect.any(Function));
            expect(global.document.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
        });

        test('cierra el menú al hacer clic fuera y al presionar Escape', async () => {
            const { bindEventListeners, persistAuth } = await getTestables();
            bindEventListeners();
            persistAuth({ token: 'token-menu', usuario: 'Laura' });

            const [buttonHandler] = Array.from(elements.menuButton.listeners.click);
            const clickEvent = { preventDefault: jest.fn(), stopPropagation: jest.fn(), target: elements.menuButton };
            buttonHandler(clickEvent);

            expect(elements.menu.classList.contains('hidden')).toBe(false);

            const [documentClickHandler] = Array.from(global.document.__listeners.click || []);
            expect(typeof documentClickHandler).toBe('function');
            documentClickHandler({ target: {} });

            expect(elements.menu.classList.contains('hidden')).toBe(true);
            expect(elements.menuButton.getAttribute('aria-expanded')).toBe('false');

            buttonHandler(clickEvent);
            expect(elements.menu.classList.contains('hidden')).toBe(false);

            const [documentKeyHandler] = Array.from(global.document.__listeners.keydown || []);
            expect(typeof documentKeyHandler).toBe('function');
            documentKeyHandler({ key: 'Escape' });

            expect(elements.menu.classList.contains('hidden')).toBe(true);
            expect(elements.menuButton.focus).toHaveBeenCalled();
        });

        test('emite eventos de navegación para Ayuda y Configuración', async () => {
            const { bindEventListeners, persistAuth } = await getTestables();
            bindEventListeners();
            persistAuth({ token: 'token-menu', usuario: 'Laura' });

            const [buttonHandler] = Array.from(elements.menuButton.listeners.click);
            const clickEvent = { preventDefault: jest.fn(), stopPropagation: jest.fn(), target: elements.menuButton };
            buttonHandler(clickEvent);

            const [helpHandler] = Array.from(elements.helpLink.listeners.click || []);
            expect(typeof helpHandler).toBe('function');
            const helpPreventDefault = jest.fn();
            helpHandler({ preventDefault: helpPreventDefault, stopPropagation: jest.fn(), target: elements.helpLink });

            expect(helpPreventDefault).toHaveBeenCalled();
            expect(global.document.dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({
                type: 'auth:navigate',
                detail: { action: 'help' },
            }));
            expect(elements.menu.classList.contains('hidden')).toBe(true);

            buttonHandler(clickEvent);
            global.document.dispatchEvent.mockClear();

            const [settingsHandler] = Array.from(elements.settingsLink.listeners.click || []);
            expect(typeof settingsHandler).toBe('function');
            const settingsPreventDefault = jest.fn();
            settingsHandler({ preventDefault: settingsPreventDefault, stopPropagation: jest.fn(), target: elements.settingsLink });

            expect(settingsPreventDefault).toHaveBeenCalled();
            expect(global.document.dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({
                type: 'auth:navigate',
                detail: { action: 'settings' },
            }));
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

