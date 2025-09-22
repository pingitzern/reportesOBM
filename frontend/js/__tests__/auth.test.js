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

    const mainView = createElementStub({ initialClasses: ['hidden'] });
    mainView.id = 'main-view';

    const loginContainer = createElementStub({ initialClasses: ['hidden'] });
    loginContainer.id = 'login-container';

    const error = createElementStub({ initialClasses: ['hidden'] });
    error.id = 'login-error';

    const docListeners = {};

    const elements = {
        panel,
        menuButton,
        menu,
        userNameDisplay,
        helpLink,
        settingsLink,

        logoutButton,
        mainView,
        loginContainer,
        error,
    };

    const map = {
        'auth-user-panel': panel,
        'user-menu-toggle': menuButton,
        'user-menu': menu,
        'logout-button': logoutButton,
        'main-view': mainView,
        'login-container': loginContainer,
        'login-form': null,
        'login-error': error,
        'login-mail': null,
        'login-password': null,
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

            expect(elements.menuButton.disabled).toBe(false);
            expect(elements.menuButton.getAttribute('aria-expanded')).toBe('false');
            expect(elements.menu.classList.contains('hidden')).toBe(true);
            expect(elements.menu.getAttribute('aria-hidden')).toBe('true');
            expect(elements.userNameDisplay.textContent).toBe('Ana');

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
            expect(elements.userNameDisplay.textContent).toBe('Luis');
        });
    });

    describe('getCurrentToken', () => {
        test('devuelve el token actual normalizado cuando existe sesión', async () => {
            const module = await loadAuthModule();
            const { persistAuth } = module.__testables__;
            const expiresAt = new Date(NOW.getTime() + 15 * 60 * 1000).toISOString();

            persistAuth({
                user: { nombre: 'Ana', cargo: 'Analista', rol: 'Admin' },
                token: ' token-xyz ',
                expiresAt,
            });

            expect(module.getCurrentToken()).toBe('token-xyz');
        });

        test('devuelve null cuando no hay sesión activa', async () => {
            const module = await loadAuthModule();

            expect(module.getCurrentToken()).toBeNull();
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
            expect(elements.menuButton.disabled).toBe(true);
            expect(elements.menuButton.getAttribute('aria-expanded')).toBe('false');
            expect(elements.menu.classList.contains('hidden')).toBe(true);
            expect(elements.menu.getAttribute('aria-hidden')).toBe('true');
            expect(elements.userNameDisplay.textContent).toBe('');
            expect(elements.logoutButton.disabled).toBe(true);
        });

        test('no falla cuando no existe almacenamiento disponible', async () => {
            delete global.sessionStorage;
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

            expect(elements.userNameDisplay.textContent).toBe('');
            expect(elements.userNameDisplay.classList.contains('hidden')).toBe(true);
        });
    });

    describe('logout', () => {
        test('envía la petición de logout con el token y limpia el estado', async () => {
            const module = await loadAuthModule();
            const { persistAuth } = module.__testables__;
            const expiresAt = new Date(NOW.getTime() + 30 * 60 * 1000).toISOString();

            persistAuth({
                user: { nombre: 'Laura', cargo: 'Operaria', rol: 'Supervisora' },
                token: 'token-activo',
                expiresAt,
            });

            elements.mainView.classList.remove('hidden');
            elements.loginContainer.classList.add('hidden');
            global.fetch.mockResolvedValue({ ok: true, status: 200 });

            await module.logout();

            expect(global.fetch).toHaveBeenCalledWith(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain; charset=utf-8' },
                body: JSON.stringify({ action: 'logout', token: 'token-activo' }),
            });
            expect(storage.removeItem).toHaveBeenCalledWith(AUTH_STORAGE_KEY);
            expect(module.getCurrentToken()).toBeNull();
            expect(elements.panel.classList.contains('hidden')).toBe(true);
            expect(elements.logoutButton.disabled).toBe(true);
            expect(elements.mainView.classList.contains('hidden')).toBe(true);
            expect(elements.loginContainer.classList.contains('hidden')).toBe(false);
        });

        test('limpia el estado aunque la petición de logout falle', async () => {
            const module = await loadAuthModule();
            const { persistAuth } = module.__testables__;
            const expiresAt = new Date(NOW.getTime() + 45 * 60 * 1000).toISOString();

            persistAuth({
                user: { nombre: 'Sofía', cargo: 'Analista', rol: 'Usuaria' },
                token: 'token-error',
                expiresAt,
            });

            elements.mainView.classList.remove('hidden');
            elements.loginContainer.classList.add('hidden');
            global.fetch.mockRejectedValue(new TypeError('Fallo de red'));

            await module.logout();

            expect(global.fetch).toHaveBeenCalledWith(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain; charset=utf-8' },
                body: JSON.stringify({ action: 'logout', token: 'token-error' }),
            });
            expect(storage.removeItem).toHaveBeenCalledWith(AUTH_STORAGE_KEY);
            expect(module.getCurrentToken()).toBeNull();
            expect(elements.panel.classList.contains('hidden')).toBe(true);
            expect(elements.logoutButton.disabled).toBe(true);
            expect(elements.mainView.classList.contains('hidden')).toBe(true);
            expect(elements.loginContainer.classList.contains('hidden')).toBe(false);
        });
    });

    describe('handleSessionExpiration', () => {
        test('limpia la sesión y muestra el mensaje de expiración', async () => {
            const module = await loadAuthModule();
            const { persistAuth, loadStoredAuth } = module.__testables__;
            const expiresAt = new Date(NOW.getTime() + 30 * 60 * 1000).toISOString();

            persistAuth({
                user: { nombre: 'Carlos', cargo: 'Supervisor', rol: 'Administrador' },
                token: 'token-activo',
                expiresAt,
            });

            expect(loadStoredAuth()).not.toBeNull();
            elements.panel.classList.remove('hidden');
            elements.logoutButton.disabled = false;
            elements.loginContainer.classList.add('hidden');
            elements.mainView.classList.remove('hidden');
            elements.error.classList.add('hidden');
            elements.error.textContent = '';

            await module.handleSessionExpiration();

            expect(module.getCurrentToken()).toBeNull();
            expect(storage.removeItem).toHaveBeenCalledWith(AUTH_STORAGE_KEY);
            expect(elements.panel.classList.contains('hidden')).toBe(true);
            expect(elements.logoutButton.disabled).toBe(true);
            expect(elements.loginContainer.classList.contains('hidden')).toBe(false);
            expect(elements.mainView.classList.contains('hidden')).toBe(true);
            expect(elements.error.textContent).toBe('Tu sesión ha expirado. Por favor, ingresá de nuevo.');
            expect(elements.error.classList.contains('hidden')).toBe(false);

            expect(elements.menuButton.disabled).toBe(true);
            expect(elements.menuButton.getAttribute('aria-expanded')).toBe('false');
            expect(elements.menu.classList.contains('hidden')).toBe(true);
            expect(elements.menu.getAttribute('aria-hidden')).toBe('true');
            expect(elements.userNameDisplay.textContent).toBe('');
        });
    });

    describe('user menu interactions', () => {
        const createMenuSession = () => ({
            token: 'token-menu',
            expiresAt: new Date(NOW.getTime() + 45 * 60 * 1000).toISOString(),
            usuario: {
                Nombre: 'Laura',
                Rol: 'Supervisora',
                mail: 'laura@example.com',
            },
        });

        test('abre y cierra el menú con el botón de usuario', async () => {
            const { bindEventListeners, persistAuth } = await getTestables();
            bindEventListeners();
            persistAuth(createMenuSession());

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
            persistAuth(createMenuSession());

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
            persistAuth(createMenuSession());

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

