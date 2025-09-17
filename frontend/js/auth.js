import { API_URL } from './config.js';

const STORAGE_KEY = 'reportesOBM.auth';

let cachedAuth = null;
let listenersBound = false;
let pendingAuth = null;
let menuIsOpen = false;
let documentMenuHandlersActive = false;

function getStorage() {
    if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage;
    }
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
        return globalThis.localStorage;
    }
    return null;
}

function loadStoredAuth() {
    if (cachedAuth) {
        return cachedAuth;
    }

    const storage = getStorage();
    if (!storage) {
        return null;
    }

    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
        return null;
    }

    try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
            const token = typeof parsed.token === 'string' ? parsed.token : '';
            const usuario = typeof parsed.usuario === 'string' ? parsed.usuario : '';
            if (token && usuario) {
                cachedAuth = { token, usuario };
                return cachedAuth;
            }
        }
    } catch (error) {
        console.warn('[auth] No se pudo leer la sesión almacenada:', error);
    }

    return null;
}

function persistAuth(auth) {
    cachedAuth = auth;
    const storage = getStorage();
    if (storage) {
        storage.setItem(STORAGE_KEY, JSON.stringify(auth));
    }
    updateUserPanel(auth);
}

function clearStoredAuth() {
    cachedAuth = null;
    const storage = getStorage();
    if (storage) {
        storage.removeItem(STORAGE_KEY);
    }
    updateUserPanel(null);
}

function getElements() {
    if (typeof document === 'undefined') {
        return {};
    }

    const panel = document.getElementById('auth-user-panel');
    const menu = document.getElementById('user-menu');
    let userNameDisplay = null;
    let helpLink = null;
    let settingsLink = null;

    if (menu && typeof menu.querySelector === 'function') {
        userNameDisplay = menu.querySelector('[data-user-name]')
            || menu.querySelector('.user-menu__user-name')
            || null;
        helpLink = menu.querySelector('[data-auth-action="help"]');
        settingsLink = menu.querySelector('[data-auth-action="settings"]');
    }

    if (menu && typeof menu.querySelectorAll === 'function') {
        const normalizeText = value => (typeof value === 'string' ? value.trim().toLowerCase() : '');
        const items = Array.from(menu.querySelectorAll('[role="menuitem"]') || []);

        if (!helpLink) {
            helpLink = items.find(item => normalizeText(item?.textContent) === 'ayuda') || null;
        }
        if (!settingsLink) {
            settingsLink = items.find(item => normalizeText(item?.textContent) === 'configuración') || null;
        }
        if (!userNameDisplay) {
            userNameDisplay = items.find(item => item?.dataset?.userName) || null;
        }
    }

    return {
        modal: document.getElementById('login-modal'),
        form: document.getElementById('login-form'),
        error: document.getElementById('login-error'),
        usuarioInput: document.getElementById('login-usuario'),
        tokenInput: document.getElementById('login-token'),
        logoutButton: document.getElementById('logout-button'),
        panel,
        menuButton: document.getElementById('user-menu-toggle'),
        menu,
        helpLink,
        settingsLink,
        userNameDisplay,
    };
}

function showLoginModal() {
    const { modal, error, usuarioInput } = getElements();
    if (modal) {
        modal.classList.remove('hidden');
    }
    if (error) {
        error.textContent = '';
        error.classList.add('hidden');
    }
    if (usuarioInput) {
        usuarioInput.focus();
    }
}

function hideLoginModal() {
    const { modal, form, error } = getElements();
    if (modal) {
        modal.classList.add('hidden');
    }
    if (form) {
        form.reset();
    }
    if (error) {
        error.textContent = '';
        error.classList.add('hidden');
    }
}

function setFormLoading(form, isLoading) {
    if (!form) {
        return;
    }
    const inputs = form.querySelectorAll('input');
    inputs.forEach(input => {
        input.disabled = isLoading;
    });

    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) {
        if (isLoading) {
            submitButton.dataset.originalText = submitButton.textContent;
            submitButton.textContent = 'Ingresando...';
            submitButton.disabled = true;
        } else {
            submitButton.textContent = submitButton.dataset.originalText || 'Ingresar';
            submitButton.disabled = false;
            delete submitButton.dataset.originalText;
        }
    }
}

function displayError(message) {
    const { error } = getElements();
    if (!error) {
        return;
    }
    error.textContent = message;
    error.classList.remove('hidden');
}

function isTargetWithinMenu(target, ...elements) {
    if (!target) {
        return false;
    }

    return elements.some(element => {
        if (!element) {
            return false;
        }
        if (target === element) {
            return true;
        }
        if (typeof element.contains === 'function') {
            try {
                return element.contains(target);
            } catch (error) {
                return false;
            }
        }
        return false;
    });
}

function activateDocumentHandlers() {
    if (documentMenuHandlersActive || typeof document === 'undefined' || typeof document.addEventListener !== 'function') {
        return;
    }
    document.addEventListener('click', handleDocumentClick);
    document.addEventListener('keydown', handleDocumentKeydown);
    documentMenuHandlersActive = true;
}

function deactivateDocumentHandlers() {
    if (!documentMenuHandlersActive || typeof document === 'undefined' || typeof document.removeEventListener !== 'function') {
        return;
    }
    document.removeEventListener('click', handleDocumentClick);
    document.removeEventListener('keydown', handleDocumentKeydown);
    documentMenuHandlersActive = false;
}

function openUserMenu() {
    const { menuButton, menu } = getElements();
    if (!menuButton || menuButton.disabled || !menu) {
        return;
    }

    if (menu.classList?.remove) {
        menu.classList.remove('hidden');
    }
    if (typeof menu.setAttribute === 'function') {
        menu.setAttribute('aria-hidden', 'false');
    }
    if (typeof menuButton.setAttribute === 'function') {
        menuButton.setAttribute('aria-expanded', 'true');
    }

    menuIsOpen = true;
    activateDocumentHandlers();
}

function closeUserMenu(options = {}) {
    const { focusButton = false } = options;
    const { menuButton, menu } = getElements();

    menuIsOpen = false;

    if (menu?.classList?.add) {
        menu.classList.add('hidden');
    }
    if (typeof menu?.setAttribute === 'function') {
        menu.setAttribute('aria-hidden', 'true');
    }
    if (typeof menuButton?.setAttribute === 'function') {
        menuButton.setAttribute('aria-expanded', 'false');
    }

    deactivateDocumentHandlers();

    if (focusButton && typeof menuButton?.focus === 'function') {
        menuButton.focus();
    }
}

function handleDocumentClick(event) {
    if (!menuIsOpen) {
        return;
    }

    const { panel, menuButton, menu } = getElements();
    if (isTargetWithinMenu(event?.target, panel, menuButton, menu)) {
        return;
    }

    closeUserMenu();
}

function handleDocumentKeydown(event) {
    if (!menuIsOpen) {
        return;
    }

    const key = event?.key || event?.code;
    if (key === 'Escape' || key === 'Esc') {
        closeUserMenu({ focusButton: true });
    }
}

function handleMenuButtonClick(event) {
    if (event) {
        event.preventDefault?.();
        event.stopPropagation?.();
    }

    const { menuButton } = getElements();
    if (!menuButton || menuButton.disabled) {
        return;
    }

    if (menuIsOpen) {
        closeUserMenu();
    } else {
        openUserMenu();
    }
}

function emitAuthNavigation(action) {
    if (typeof document === 'undefined' || typeof document.dispatchEvent !== 'function') {
        return;
    }

    const detail = { action };
    let eventConstructor = null;

    if (typeof window !== 'undefined' && typeof window.CustomEvent === 'function') {
        eventConstructor = window.CustomEvent;
    } else if (typeof CustomEvent === 'function') {
        eventConstructor = CustomEvent;
    }

    if (eventConstructor) {
        document.dispatchEvent(new eventConstructor('auth:navigate', { detail }));
        return;
    }

    if (typeof Event === 'function') {
        const fallbackEvent = new Event('auth:navigate');
        fallbackEvent.detail = detail;
        document.dispatchEvent(fallbackEvent);
        return;
    }

    document.dispatchEvent({ type: 'auth:navigate', detail });
}

function handleMenuNavigation(event, action) {
    if (event) {
        event.preventDefault?.();
        event.stopPropagation?.();
    }
    closeUserMenu();
    emitAuthNavigation(action);
}

function handleHelpClick(event) {
    handleMenuNavigation(event, 'help');
}

function handleSettingsClick(event) {
    handleMenuNavigation(event, 'settings');
}

function updateUserPanel(auth) {
    const {
        panel,
        menuButton,
        menu,
        logoutButton,
        userNameDisplay,
    } = getElements();

    const isAuthenticated = Boolean(auth && auth.usuario);

    if (!panel && !menuButton && !menu && !logoutButton && !userNameDisplay) {
        return;
    }

    if (isAuthenticated) {
        panel?.classList?.remove?.('hidden');
        if (menuButton) {
            menuButton.disabled = false;
            menuButton.setAttribute?.('aria-expanded', menuIsOpen ? 'true' : 'false');
        }
        if (menu) {
            if (menuIsOpen) {
                menu.classList?.remove?.('hidden');
                menu.setAttribute?.('aria-hidden', 'false');
            } else {
                menu.classList?.add?.('hidden');
                menu.setAttribute?.('aria-hidden', 'true');
            }
        }
        if (logoutButton) {
            logoutButton.disabled = false;
        }
        if (userNameDisplay) {
            userNameDisplay.textContent = auth.usuario;
            userNameDisplay.classList?.remove?.('hidden');
        }
    } else {
        if (userNameDisplay) {
            userNameDisplay.textContent = '';
            userNameDisplay.classList?.add?.('hidden');
        }
        closeUserMenu();
        panel?.classList?.add?.('hidden');
        if (menuButton) {
            menuButton.disabled = true;
            menuButton.setAttribute?.('aria-expanded', 'false');
        }
        menu?.setAttribute?.('aria-hidden', 'true');
        if (logoutButton) {
            logoutButton.disabled = true;
        }
    }
}

function createPendingAuthPromise() {
    if (pendingAuth) {
        return pendingAuth.promise;
    }

    let resolveFn;
    let rejectFn;
    const promise = new Promise((resolve, reject) => {
        resolveFn = resolve;
        rejectFn = reject;
    });

    pendingAuth = {
        promise,
        resolve: resolveFn,
        reject: rejectFn,
    };

    return promise;
}

function resolvePendingAuth(usuario) {
    if (pendingAuth && typeof pendingAuth.resolve === 'function') {
        pendingAuth.resolve(usuario);
    }
    pendingAuth = null;
}

async function requestAuthentication({ usuario, token }) {
    if (!API_URL) {
        throw new Error('API_URL no está configurada.');
    }

    const payload = {
        action: 'login',
        usuario: typeof usuario === 'string' ? usuario.trim() : '',
        token: typeof token === 'string' ? token.trim() : '',
    };

    let response;
    try {
        response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
            },
            body: JSON.stringify(payload),
        });
    } catch (error) {
        if (error?.name === 'AbortError') {
            throw new Error('La solicitud de autenticación excedió el tiempo de espera.');
        }
        if (error instanceof TypeError) {
            throw new Error('No se pudo conectar con el servidor de autenticación.');
        }
        throw new Error(error?.message || 'Error inesperado al iniciar sesión.');
    }

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    let result;
    try {
        result = await response.json();
    } catch (error) {
        throw new Error('No se pudo interpretar la respuesta de autenticación.');
    }

    if (result.result !== 'success') {
        throw new Error(result.error || 'Credenciales inválidas.');
    }

    const data = result.data || {};
    const resolvedUser = typeof data.usuario === 'string' && data.usuario.trim()
        ? data.usuario.trim()
        : payload.usuario;

    if (!resolvedUser) {
        throw new Error('La respuesta del servidor no incluye el usuario autenticado.');
    }

    return {
        token: payload.token,
        usuario: resolvedUser,
    };
}

async function handleLoginSubmit(event) {
    event.preventDefault();

    const { form, tokenInput, usuarioInput } = getElements();
    if (!form || !(form instanceof HTMLFormElement)) {
        return;
    }

    const token = tokenInput?.value || '';
    const usuario = usuarioInput?.value || '';

    if (!token.trim() || !usuario.trim()) {
        displayError('Completa el usuario y el token de acceso.');
        return;
    }

    setFormLoading(form, true);
    try {
        const auth = await requestAuthentication({ token, usuario });
        persistAuth(auth);
        hideLoginModal();
        resolvePendingAuth(auth.usuario);
    } catch (error) {
        displayError(error?.message || 'No se pudo iniciar sesión.');
    } finally {
        setFormLoading(form, false);
    }
}

function handleLogout(event) {
    if (event) {
        event.preventDefault();
    }
    closeUserMenu();
    clearStoredAuth();
    showLoginModal();
    createPendingAuthPromise();
}

function bindEventListeners() {
    if (listenersBound) {
        return;
    }

    const { form, logoutButton, menuButton, helpLink, settingsLink } = getElements();
    if (form) {
        form.addEventListener('submit', handleLoginSubmit);
    }
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }
    if (menuButton) {
        menuButton.addEventListener('click', handleMenuButtonClick);
    }
    if (helpLink) {
        helpLink.addEventListener('click', handleHelpClick);
    }
    if (settingsLink) {
        settingsLink.addEventListener('click', handleSettingsClick);
    }

    listenersBound = true;
}

export function getAuthPayload() {
    const auth = loadStoredAuth();
    if (!auth || !auth.token || !auth.usuario) {
        throw new Error('Sesión no autenticada. Vuelve a iniciar sesión.');
    }
    return { token: auth.token, usuario: auth.usuario };
}

export async function initializeAuth() {
    bindEventListeners();

    const existingAuth = loadStoredAuth();
    if (existingAuth && existingAuth.token && existingAuth.usuario) {
        try {
            const auth = await requestAuthentication(existingAuth);
            persistAuth(auth);
            hideLoginModal();
            return auth.usuario;
        } catch (error) {
            console.warn('[auth] Sesión almacenada inválida:', error);
            clearStoredAuth();
        }
    }

    updateUserPanel(null);
    showLoginModal();
    return createPendingAuthPromise();
}

export function logout() {
    handleLogout();
}

export async function requireAuthentication() {
    try {
        const auth = getAuthPayload();
        return auth.usuario;
    } catch (error) {
        showLoginModal();
        return createPendingAuthPromise();
    }
}

export const __testables__ = {
    loadStoredAuth,
    persistAuth,
    clearStoredAuth,
    requestAuthentication,
    updateUserPanel,
    bindEventListeners,
};
