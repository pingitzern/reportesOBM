import { API_URL } from './config.js';

const STORAGE_KEY = 'reportesOBM.user';

let cachedUser = null;
let listenersBound = false;
let pendingAuth = null;

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
        loginContainer: document.getElementById('login-container'),
        form: document.getElementById('login-form'),
        error: document.getElementById('login-error'),
        mailInput: document.getElementById('login-mail'),
        passwordInput: document.getElementById('login-password'),
        logoutButton: document.getElementById('logout-button'),
        panel: document.getElementById('auth-user-panel'),
        userLabel: document.getElementById('current-user'),
        userRole: document.getElementById('current-user-role'),
        mainView: document.querySelector('.app-container'),
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

function updateUserPanel(auth) {
    const { panel, userLabel, userRole, logoutButton } = getElements();
    if (!panel || !userLabel || !logoutButton) {
        return;
    }

    const nombre = typeof auth?.nombre === 'string' ? auth.nombre.trim() : '';
    const rol = typeof auth?.rol === 'string' ? auth.rol.trim() : '';
    const cargo = typeof auth?.cargo === 'string' ? auth.cargo.trim() : '';
    const roleLabel = rol || cargo;

    if (nombre) {
        userLabel.textContent = nombre;
        if (userRole) {
            userRole.textContent = roleLabel || '';
        }
        panel.classList.remove('hidden');
        logoutButton.disabled = false;
    } else {
        userLabel.textContent = '';
        if (userRole) {
            userRole.textContent = '';
        }
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
    clearStoredAuth();
    setMainViewVisible(false);
    showLoginModal();
    createPendingAuthPromise();
}

function bindEventListeners() {
    if (listenersBound) {
        return;
    }

    const { form, logoutButton } = getElements();
    if (form) {
        form.addEventListener('submit', handleLoginSubmit);
    }
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
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
