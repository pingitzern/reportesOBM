import { API_URL } from './config.js';

const STORAGE_KEY = 'reportesOBM.user';

let cachedSession = null;
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

function normalizeUser(user) {
    if (!user || typeof user !== 'object') {
        return null;
    }

    const nombre = typeof user.nombre === 'string'
        ? user.nombre.trim()
        : typeof user.Nombre === 'string'
            ? user.Nombre.trim()
            : '';

    const cargo = typeof user.cargo === 'string'
        ? user.cargo.trim()
        : typeof user.Cargo === 'string'
            ? user.Cargo.trim()
            : '';

    const rol = typeof user.rol === 'string'
        ? user.rol.trim()
        : typeof user.Rol === 'string'
            ? user.Rol.trim()
            : '';

    if (!nombre || !rol) {
        return null;
    }

    return { nombre, cargo, rol };
}

function normalizeToken(token) {
    return typeof token === 'string' ? token.trim() : '';
}

function normalizeExpiresAt(value) {
    if (value === undefined || value === null) {
        return { value: null, valid: true };
    }
    if (value instanceof Date) {
        return Number.isNaN(value.getTime())
            ? { value: null, valid: false }
            : { value: value.toISOString(), valid: true };
    }
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            return { value: null, valid: false };
        }
        const asDate = new Date(value);
        return Number.isNaN(asDate.getTime())
            ? { value: null, valid: false }
            : { value: asDate.toISOString(), valid: true };
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            return { value: null, valid: true };
        }
        return { value: trimmed, valid: true };
    }
    return { value: null, valid: false };
}

function isTokenActive(token, expiresAt) {
    if (!token) {
        return false;
    }
    if (!expiresAt) {
        return true;
    }

    const expiration = new Date(expiresAt);
    if (Number.isNaN(expiration.getTime())) {
        return false;
    }

    return expiration.getTime() > Date.now();
}

function buildSession({ user, token, expiresAt }) {
    const normalizedUser = normalizeUser(user);
    const normalizedToken = normalizeToken(token);
    const { value: normalizedExpiresAt, valid: expiresAtValid } = normalizeExpiresAt(expiresAt);

    if (!normalizedUser || !normalizedToken || !expiresAtValid) {
        return null;
    }

    if (!isTokenActive(normalizedToken, normalizedExpiresAt)) {
        return null;
    }

    return {
        user: normalizedUser,
        token: normalizedToken,
        expiresAt: normalizedExpiresAt,
    };
}

function loadStoredAuth() {
    if (cachedSession && isTokenActive(cachedSession.token, cachedSession.expiresAt)) {
        return cachedSession;
    }

    cachedSession = null;

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
        const normalized = buildSession({
            user: parsed?.user ?? parsed?.usuario ?? parsed,
            token: parsed?.token,
            expiresAt: parsed?.expiresAt,
        });

        if (normalized) {
            cachedSession = normalized;
            return cachedSession;
        }
    } catch (error) {
        console.warn('[auth] No se pudo leer la sesión almacenada:', error);
        return null;
    }

    storage.removeItem(STORAGE_KEY);
    return null;
}

function persistAuth(auth) {
    const normalized = buildSession({
        user: auth?.user ?? auth?.usuario,
        token: auth?.token,
        expiresAt: auth?.expiresAt,
    });

    if (!normalized) {
        throw new Error('Los datos de sesión son inválidos.');
    }

    cachedSession = normalized;
    const storage = getStorage();
    if (storage) {
        storage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    }
    updateUserPanel(normalized.user);
}

function clearStoredAuth() {
    cachedSession = null;
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
        loginContainer: document.getElementById('login-container'),
        form: document.getElementById('login-form'),
        error: document.getElementById('login-error'),
        mailInput: document.getElementById('login-mail'),
        passwordInput: document.getElementById('login-password'),
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
    const { loginContainer, error, mailInput } = getElements();
    if (loginContainer) {
        loginContainer.classList.remove('hidden');
    }
    if (error) {
        error.textContent = '';
        error.classList.add('hidden');
    }
    if (mailInput) {
        mailInput.focus();
    }
}

function hideLoginModal() {
    const { loginContainer, form, error } = getElements();
    if (loginContainer) {
        loginContainer.classList.add('hidden');
    }
    if (form) {
        form.reset();
    }
    if (error) {
        error.textContent = '';
        error.classList.add('hidden');
    }
}

function setMainViewVisible(isVisible) {
    const { mainView, loginContainer } = getElements();
    if (mainView) {
        if (isVisible) {
            mainView.classList.remove('hidden');
        } else {
            mainView.classList.add('hidden');
        }
    }

    if (loginContainer) {
        if (isVisible) {
            loginContainer.classList.add('hidden');
        } else {
            loginContainer.classList.remove('hidden');
        }
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
            submitButton.textContent = submitButton.dataset.originalText || 'Iniciar sesión';
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

function resolvePendingAuth(session) {
    if (pendingAuth && typeof pendingAuth.resolve === 'function') {
        pendingAuth.resolve(session);
    }
    pendingAuth = null;
}

async function requestAuthentication({ mail, password }) {
    if (!API_URL) {
        throw new Error('API_URL no está configurada.');
    }

    const payload = {
        action: 'login',
        mail: typeof mail === 'string' ? mail.trim() : '',
        password: typeof password === 'string' ? password.trim() : '',
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
        if (response.status === 401 || response.status === 403) {
            throw new Error('Mail o contraseña incorrectos');
        }
        throw new Error(`HTTP ${response.status}`);
    }

    let result;
    try {
        result = await response.json();
    } catch (error) {
        throw new Error('No se pudo interpretar la respuesta de autenticación.');
    }

    if (result.result !== 'success') {
        throw new Error('Mail o contraseña incorrectos');
    }

    const session = buildSession({
        user: result.data?.usuario ?? result.data?.user ?? result.data,
        token: result.data?.token,
        expiresAt: result.data?.expiresAt,
    });

    if (!session) {
        throw new Error('Mail o contraseña incorrectos');
    }

    return session;
}

async function handleLoginSubmit(event) {
    event.preventDefault();

    const { form, mailInput, passwordInput } = getElements();
    if (!form || !(form instanceof HTMLFormElement)) {
        return;
    }

    const mail = mailInput?.value || '';
    const password = passwordInput?.value || '';

    if (!mail.trim() || !password.trim()) {
        displayError('Completa el mail y la contraseña.');
        return;
    }

    setFormLoading(form, true);
    try {
        const session = await requestAuthentication({ mail, password });
        persistAuth(session);
        setMainViewVisible(true);
        hideLoginModal();
        resolvePendingAuth(session);
    } catch (error) {
        displayError(error?.message || 'No se pudo iniciar sesión.');
    } finally {
        setFormLoading(form, false);
    }
}

async function handleLogout(event) {
    if (event) {
        event.preventDefault();
    }


    const session = loadStoredAuth();
    const token = typeof session?.token === 'string' ? session.token.trim() : '';

    try {
        if (API_URL && token) {
            await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain; charset=utf-8',
                },
                body: JSON.stringify({
                    action: 'logout',
                    token,
                }),
            });
        }
    } catch (error) {
        // Ignorar errores de red para no bloquear el cierre de sesión local.
    } finally {
        clearStoredAuth();
        setMainViewVisible(false);
        showLoginModal();
        createPendingAuthPromise();
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

export function getCurrentUser() {
    const session = loadStoredAuth();
    return session?.user || null;
}

export function getCurrentUserName() {
    const session = loadStoredAuth();
    return session?.user?.nombre || '';
}

export function getCurrentUserRole() {
    const session = loadStoredAuth();
    return session?.user?.rol || '';
}

export function getCurrentToken() {
    const session = loadStoredAuth();
    const token = typeof session?.token === 'string' ? session.token.trim() : '';
    return token || null;
}

export async function initializeAuth() {
    bindEventListeners();

    const storedSession = loadStoredAuth();
    if (storedSession) {
        updateUserPanel(storedSession.user);
        setMainViewVisible(true);
        hideLoginModal();
        return storedSession;
    }
    setMainViewVisible(false);

    updateUserPanel(null);

    showLoginModal();
    return createPendingAuthPromise();
}

export function logout() {
    return handleLogout();
}

export async function handleSessionExpiration() {
    await handleLogout();
    displayError('Tu sesión ha expirado. Por favor, ingresá de nuevo.');
}

export async function requireAuthentication() {
    const session = loadStoredAuth();
    if (session) {
        return session;
    }

    setMainViewVisible(false);
    showLoginModal();
    return createPendingAuthPromise();
}

export const __testables__ = {
    loadStoredAuth,
    persistAuth,
    clearStoredAuth,
    requestAuthentication,
    updateUserPanel,
    bindEventListeners,
};
