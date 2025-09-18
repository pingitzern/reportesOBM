import { API_URL } from './config.js';

const STORAGE_KEY = 'reportesOBM.user';

let cachedUser = null;
let listenersBound = false;
let pendingAuth = null;

function getUserInitials(name) {
    if (typeof name !== 'string') {
        return '';
    }

    const parts = name
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (parts.length === 0) {
        return '';
    }

    const initials = parts
        .slice(0, 2)
        .map(part => part.charAt(0).toUpperCase())
        .join('');

    return initials;
}

function setUserMenuOpen(isOpen) {
    const { panel, userMenuButton } = getElements();
    if (!panel || !userMenuButton) {
        return;
    }

    if (isOpen) {
        panel.classList.add('user-menu--open');
        userMenuButton.setAttribute('aria-expanded', 'true');
    } else {
        panel.classList.remove('user-menu--open');
        userMenuButton.setAttribute('aria-expanded', 'false');
    }
}

function toggleUserMenu() {
    const { panel } = getElements();
    if (!panel || panel.classList.contains('hidden')) {
        return;
    }

    const isOpen = panel.classList.contains('user-menu--open');
    setUserMenuOpen(!isOpen);
}

function handleUserMenuButtonClick(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    const { userMenuButton } = getElements();
    if (!userMenuButton || userMenuButton.disabled) {
        return;
    }

    toggleUserMenu();
}

function handleDocumentClick(event) {
    const { panel } = getElements();
    if (!panel || panel.classList.contains('hidden') || !panel.classList.contains('user-menu--open')) {
        return;
    }

    if (typeof panel.contains === 'function' && panel.contains(event.target)) {
        return;
    }

    setUserMenuOpen(false);
}

function handleDocumentKeydown(event) {
    if (event?.key !== 'Escape') {
        return;
    }

    const { panel } = getElements();
    if (!panel || panel.classList.contains('hidden') || !panel.classList.contains('user-menu--open')) {
        return;
    }

    setUserMenuOpen(false);
}

function getStorage() {
    if (typeof window !== 'undefined') {
        if (window.sessionStorage) {
            return window.sessionStorage;
        }
        if (window.localStorage) {
            return window.localStorage;
        }
    }
    if (typeof globalThis !== 'undefined') {
        if (globalThis.sessionStorage) {
            return globalThis.sessionStorage;
        }
        if (globalThis.localStorage) {
            return globalThis.localStorage;
        }
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

function loadStoredAuth() {
    if (cachedUser) {
        return cachedUser;
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
        const normalized = normalizeUser(parsed);
        if (normalized) {
            cachedUser = normalized;
            return cachedUser;
        }
    } catch (error) {
        console.warn('[auth] No se pudo leer la sesión almacenada:', error);
    }

    return null;
}

function persistAuth(auth) {
    const normalized = normalizeUser(auth);
    if (!normalized) {
        throw new Error('Los datos de usuario son inválidos.');
    }

    cachedUser = normalized;
    const storage = getStorage();
    if (storage) {
        const payload = {
            Nombre: normalized.nombre,
            Cargo: normalized.cargo,
            Rol: normalized.rol,
        };
        storage.setItem(STORAGE_KEY, JSON.stringify(payload));
    }
    updateUserPanel(normalized);
}

function clearStoredAuth() {
    cachedUser = null;
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

    return {
        modal: document.getElementById('login-modal'),
        form: document.getElementById('login-form'),
        error: document.getElementById('login-error'),
        mailInput: document.getElementById('login-mail'),
        passwordInput: document.getElementById('login-password'),
        logoutButton: document.getElementById('logout-button'),
        panel: document.getElementById('auth-user-panel'),
        userLabel: document.getElementById('current-user'),
        userMenuButton: document.getElementById('user-menu-button'),
        userMenuInitials: document.getElementById('user-menu-initials'),
        mainView: document.querySelector('.container'),
    };
}

function showLoginModal() {
    const { modal, error, mailInput } = getElements();
    if (modal) {
        modal.classList.remove('hidden');
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

function setMainViewVisible(isVisible) {
    const { mainView } = getElements();
    if (!mainView) {
        return;
    }

    if (isVisible) {
        mainView.classList.remove('hidden');
    } else {
        mainView.classList.add('hidden');
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

function updateUserPanel(auth) {
    const { panel, userLabel, logoutButton, userMenuButton, userMenuInitials } = getElements();
    if (!panel || !userLabel || !logoutButton || !userMenuButton || !userMenuInitials) {
        return;
    }

    setUserMenuOpen(false);

    const nombre = typeof auth?.nombre === 'string' ? auth.nombre.trim() : '';

    if (nombre) {
        const initials = getUserInitials(nombre) || nombre.charAt(0).toUpperCase();

        userLabel.textContent = nombre;
        userMenuInitials.textContent = initials;
        userMenuButton.disabled = false;
        userMenuButton.setAttribute('aria-label', `Abrir menú de ${nombre}`);
        panel.classList.remove('hidden');
        logoutButton.disabled = false;
    } else {
        userLabel.textContent = '';
        userMenuInitials.textContent = '';
        userMenuButton.disabled = true;
        userMenuButton.setAttribute('aria-label', 'Abrir menú de usuario');
        panel.classList.add('hidden');
        logoutButton.disabled = true;
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

function resolvePendingAuth(user) {
    if (pendingAuth && typeof pendingAuth.resolve === 'function') {
        pendingAuth.resolve(user);
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

    const normalized = normalizeUser(result.data);
    if (!normalized) {
        throw new Error('Mail o contraseña incorrectos');
    }

    return normalized;
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
        const user = await requestAuthentication({ mail, password });
        persistAuth(user);
        setMainViewVisible(true);
        hideLoginModal();
        resolvePendingAuth(user);
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
    setUserMenuOpen(false);
    clearStoredAuth();
    setMainViewVisible(false);
    showLoginModal();
    createPendingAuthPromise();
}

function bindEventListeners() {
    if (listenersBound) {
        return;
    }

    const { form, logoutButton, userMenuButton } = getElements();
    if (form) {
        form.addEventListener('submit', handleLoginSubmit);
    }
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }
    if (userMenuButton) {
        userMenuButton.addEventListener('click', handleUserMenuButtonClick);
    }
    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        document.addEventListener('click', handleDocumentClick);
        document.addEventListener('keydown', handleDocumentKeydown);
    }

    listenersBound = true;
}

export function getCurrentUser() {
    return loadStoredAuth();
}

export function getCurrentUserName() {
    const user = loadStoredAuth();
    return user?.nombre || '';
}

export function getCurrentUserRole() {
    const user = loadStoredAuth();
    return user?.rol || '';
}

export async function initializeAuth() {
    bindEventListeners();

    const storedUser = loadStoredAuth();
    if (storedUser) {
        updateUserPanel(storedUser);
        setMainViewVisible(true);
        hideLoginModal();
        return storedUser;
    }

    setMainViewVisible(false);
    showLoginModal();
    return createPendingAuthPromise();
}

export function logout() {
    handleLogout();
}

export async function requireAuthentication() {
    const user = loadStoredAuth();
    if (user) {
        return user;
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
};
