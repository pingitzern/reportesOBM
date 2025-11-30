import { supabase } from '../../supabaseClient.js';
import {
    THEME_DARK,
    THEME_LIGHT,
    getCurrentTheme,
    onThemeChange,
    setTheme,
} from '../theme/theme.js';

const STORAGE_KEY = 'reportesOBM.user';
const REMEMBER_KEY = 'reportesOBM.remember';

let cachedSession = null;
let useLocalStorage = true; // Por defecto usa localStorage
let listenersBound = false;
let pendingAuth = null;
let menuIsOpen = false;
let documentMenuHandlersActive = false;
let unsubscribeThemeChange = null;

function getStorage() {
    if (typeof window === 'undefined') {
        return null;
    }
    
    // Si "recordarme" está activo, usar localStorage (persiste al cerrar navegador)
    // Si no, usar sessionStorage (se limpia al cerrar pestaña/navegador)
    if (useLocalStorage) {
        return window.localStorage || null;
    }
    return window.sessionStorage || null;
}

// Siempre usa localStorage para la preferencia de "recordarme"
function getRememberStorage() {
    if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage;
    }
    return null;
}

function loadRememberPreference() {
    const storage = getRememberStorage();
    if (!storage) return true; // Por defecto recordar
    const value = storage.getItem(REMEMBER_KEY);
    return value !== 'false'; // Si no existe o es 'true', recordar
}

function saveRememberPreference(remember) {
    const storage = getRememberStorage();
    if (storage) {
        storage.setItem(REMEMBER_KEY, remember ? 'true' : 'false');
    }
    useLocalStorage = remember;
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

    // Intentar cargar de localStorage primero, luego sessionStorage
    const storages = typeof window !== 'undefined' 
        ? [window.localStorage, window.sessionStorage].filter(Boolean)
        : [];
    
    for (const storage of storages) {
        const raw = storage.getItem(STORAGE_KEY);
        if (!raw) continue;

        try {
            const parsed = JSON.parse(raw);
            const normalized = buildSession({
                user: parsed?.user ?? parsed?.usuario ?? parsed,
                token: parsed?.token,
                expiresAt: parsed?.expiresAt,
            });

            if (normalized) {
                cachedSession = normalized;
                // Detectar qué storage tenía la sesión válida
                useLocalStorage = (storage === window.localStorage);
                return cachedSession;
            }
        } catch (error) {
            console.warn('[auth] No se pudo leer la sesión almacenada:', error);
        }

        storage.removeItem(STORAGE_KEY);
    }
    
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
    // Limpiar de ambos storages para asegurar logout completo
    if (typeof window !== 'undefined') {
        window.localStorage?.removeItem(STORAGE_KEY);
        window.sessionStorage?.removeItem(STORAGE_KEY);
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
    let themeToggleState = null;

    if (menu && typeof menu.querySelector === 'function') {
        userNameDisplay = menu.querySelector('[data-user-name]')
            || menu.querySelector('.user-menu__user-name')
            || null;
        helpLink = menu.querySelector('[data-auth-action="help"]');
        settingsLink = menu.querySelector('[data-auth-action="settings"]');
        themeToggleState = menu.querySelector('[data-theme-state]');
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
        mainView: document.getElementById('main-view'),
        loginContainer: document.getElementById('login-container'),
        form: document.getElementById('login-form'),
        error: document.getElementById('login-error'),
        mailInput: document.getElementById('login-mail'),
        passwordInput: document.getElementById('login-password'),
        rememberCheckbox: document.getElementById('login-remember'),
        // Password reset elements
        forgotPasswordLink: document.getElementById('forgot-password-link'),
        resetPasswordForm: document.getElementById('reset-password-form'),
        resetEmailInput: document.getElementById('reset-email'),
        resetError: document.getElementById('reset-error'),
        backToLoginLink: document.getElementById('back-to-login-link'),
        // Email sent confirmation
        resetEmailSent: document.getElementById('reset-email-sent'),
        backToLoginFromSent: document.getElementById('back-to-login-from-sent'),
        // New password form elements (after clicking email link)
        newPasswordForm: document.getElementById('new-password-form'),
        newPasswordInput: document.getElementById('new-password'),
        confirmPasswordInput: document.getElementById('confirm-password'),
        newPasswordError: document.getElementById('new-password-error'),
        newPasswordSuccess: document.getElementById('new-password-success'),
        loginCardHeader: document.querySelector('.login-card__header'),
        logoutButton: document.getElementById('logout-button'),
        panel,
        menuButton: document.getElementById('user-menu-toggle'),
        menu,
        helpLink,
        settingsLink,
        userNameDisplay,
        themeToggle: document.getElementById('theme-toggle'),
        themeToggleState,
    };
}

function updateThemeToggleUI(theme) {
    const { themeToggle, themeToggleState } = getElements();
    if (!themeToggle) {
        return;
    }

    const isDark = theme === THEME_DARK;
    themeToggle.checked = isDark;
    themeToggle.setAttribute?.('aria-checked', isDark ? 'true' : 'false');

    if (themeToggleState) {
        themeToggleState.textContent = isDark ? 'Activado' : 'Desactivado';
    }
}

function handleThemeToggleChange(event) {
    event?.stopPropagation?.();
    const isChecked = Boolean(event?.target?.checked);
    setTheme(isChecked ? THEME_DARK : THEME_LIGHT);
}

function showLoginModal() {
    const { loginContainer, error, mailInput, rememberCheckbox } = getElements();
    if (loginContainer) {
        loginContainer.classList.remove('hidden');
    }
    if (error) {
        error.textContent = '';
        error.classList.add('hidden');
    }
    // Restaurar preferencia de "recordarme"
    if (rememberCheckbox) {
        rememberCheckbox.checked = loadRememberPreference();
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

    const displayName = typeof auth?.usuario === 'string'
        ? auth.usuario.trim()
        : typeof auth?.nombre === 'string'
            ? auth.nombre.trim()
            : '';
    const isAuthenticated = Boolean(displayName);

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
            userNameDisplay.textContent = displayName;
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

function buildSessionFromSupabase(data) {
    if (!data || !data.session) {
        return null;
    }

    const supabaseUser = data.session.user || data.user;
    if (!supabaseUser) {
        return null;
    }

    const profile = extractUserProfileFromSupabase(supabaseUser);
    const expiresAt = typeof data.session.expires_at === 'number'
        ? new Date(data.session.expires_at * 1000)
        : null;

    return buildSession({
        user: profile,
        token: data.session.access_token,
        expiresAt,
    });
}

function extractUserProfileFromSupabase(user) {
    const metadata = (user && user.user_metadata) || {};
    const appMetadata = (user && user.app_metadata) || {};

    const nombre = [metadata.nombre, metadata.full_name, metadata.fullName, metadata.name, user?.email]
        .find(value => typeof value === 'string' && value.trim());

    const cargo = [metadata.cargo, metadata.position]
        .find(value => typeof value === 'string' && value.trim());

    const rol = [metadata.rol, metadata.role, appMetadata.role, appMetadata.rol]
        .find(value => typeof value === 'string' && value.trim()) || 'tecnico';

    return {
        nombre: (nombre || 'Usuario').trim(),
        cargo: (cargo || '').trim(),
        rol: rol.trim(),
    };
}

async function syncSupabaseSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
        console.warn('[auth] No se pudo verificar la sesión de Supabase', error);
        clearStoredAuth();
        return null;
    }

    const session = buildSessionFromSupabase(data);
    if (session) {
        persistAuth(session);
        return session;
    }

    clearStoredAuth();
    return null;
}

async function requestAuthentication({ mail, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email: typeof mail === 'string' ? mail.trim() : '',
        password: typeof password === 'string' ? password.trim() : '',
    });

    if (error) {
        console.warn('[auth] Supabase login failed', error);
        throw new Error('Credenciales inválidas. Verificá tu mail y contraseña.');
    }

    const session = buildSessionFromSupabase(data);
    if (!session) {
        throw new Error('No se pudo iniciar sesión.');
    }

    return session;
}

async function handleLoginSubmit(event) {
    event.preventDefault();

    const { form, mailInput, passwordInput, rememberCheckbox } = getElements();
    if (!form || !(form instanceof HTMLFormElement)) {
        return;
    }

    const mail = mailInput?.value || '';
    const password = passwordInput?.value || '';
    const remember = rememberCheckbox?.checked ?? true;

    if (!mail.trim() || !password.trim()) {
        displayError('Completa el mail y la contraseña.');
        return;
    }

    // Guardar preferencia de "recordarme" y configurar storage
    saveRememberPreference(remember);

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

    try {
        await supabase.auth.signOut();
    } catch (error) {
        console.warn('[auth] Error al cerrar sesión en Supabase', error);
    } finally {
        // Limpiar el estado de recovery mode
        isPasswordRecoveryMode = false;
        
        closeUserMenu();
        clearStoredAuth();
        setMainViewVisible(false);
        
        // Mostrar el formulario de login normal (no el de nueva contraseña)
        showLoginForm();
        createPendingAuthPromise();
    }

}

function clearErrorOnInput() {
    const { error } = getElements();
    if (error && !error.classList.contains('hidden')) {
        error.textContent = '';
        error.classList.add('hidden');
    }
}

function clearResetMessages() {
    const { resetError, resetSuccess } = getElements();
    if (resetError) {
        resetError.textContent = '';
        resetError.classList.add('hidden');
    }
    if (resetSuccess) {
        resetSuccess.textContent = '';
        resetSuccess.classList.add('hidden');
    }
}

function showForgotPasswordForm() {
    const { form, resetPasswordForm, resetEmailInput } = getElements();
    if (form) {
        form.classList.add('hidden');
    }
    if (resetPasswordForm) {
        resetPasswordForm.classList.remove('hidden');
    }
    clearResetMessages();
    if (resetEmailInput) {
        resetEmailInput.value = '';
        resetEmailInput.focus();
    }
}

function showLoginForm() {
    const { form, resetPasswordForm, newPasswordForm, resetEmailSent, loginCardHeader, loginContainer, mailInput } = getElements();
    
    // Mostrar el container de login
    if (loginContainer) {
        loginContainer.classList.remove('hidden');
    }
    
    // Mostrar el header
    if (loginCardHeader) {
        loginCardHeader.classList.remove('hidden');
    }
    
    // Ocultar otros formularios y pantallas
    if (resetPasswordForm) {
        resetPasswordForm.classList.add('hidden');
    }
    if (newPasswordForm) {
        newPasswordForm.classList.add('hidden');
    }
    if (resetEmailSent) {
        resetEmailSent.classList.add('hidden');
    }
    
    // Mostrar el formulario de login
    if (form) {
        form.classList.remove('hidden');
    }
    
    clearResetMessages();
    clearNewPasswordMessages();
    
    if (mailInput) {
        mailInput.focus();
    }
}

function displayResetError(message) {
    const { resetError, resetSuccess } = getElements();
    if (resetSuccess) {
        resetSuccess.classList.add('hidden');
    }
    if (resetError) {
        resetError.textContent = message;
        resetError.classList.remove('hidden');
    }
}

function showEmailSentConfirmation() {
    const { resetPasswordForm, resetEmailSent, loginCardHeader } = getElements();
    
    // Ocultar el formulario de reset
    if (resetPasswordForm) {
        resetPasswordForm.classList.add('hidden');
    }
    
    // Ocultar el header original
    if (loginCardHeader) {
        loginCardHeader.classList.add('hidden');
    }
    
    // Mostrar la confirmación
    if (resetEmailSent) {
        resetEmailSent.classList.remove('hidden');
    }
}

async function handlePasswordReset(email) {
    // Construir la URL de redirección (misma app, sin hash para que Supabase pueda agregar los tokens)
    const redirectUrl = `${window.location.origin}${window.location.pathname}`;
    
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: redirectUrl,
    });

    if (error) {
        throw new Error('No se pudo enviar el correo. Verificá que el email sea correcto.');
    }
}

async function handleResetFormSubmit(event) {
    event.preventDefault();

    const { resetPasswordForm, resetEmailInput } = getElements();
    if (!resetPasswordForm) return;

    const email = resetEmailInput?.value || '';
    if (!email.trim()) {
        displayResetError('Ingresa tu email.');
        return;
    }

    setFormLoading(resetPasswordForm, true);
    try {
        await handlePasswordReset(email);
        // Mostrar pantalla de confirmación
        showEmailSentConfirmation();
        if (resetEmailInput) {
            resetEmailInput.value = '';
        }
    } catch (error) {
        displayResetError(error?.message || 'No se pudo enviar el correo.');
    } finally {
        setFormLoading(resetPasswordForm, false);
    }
}

// === NUEVA CONTRASEÑA (después de clic en email) ===

function showNewPasswordForm() {
    const { form, resetPasswordForm, newPasswordForm, loginCardHeader, newPasswordInput } = getElements();
    
    // Ocultar otros formularios
    if (form) form.classList.add('hidden');
    if (resetPasswordForm) resetPasswordForm.classList.add('hidden');
    if (loginCardHeader) loginCardHeader.classList.add('hidden');
    
    // Mostrar formulario de nueva contraseña
    if (newPasswordForm) {
        newPasswordForm.classList.remove('hidden');
    }
    
    clearNewPasswordMessages();
    if (newPasswordInput) {
        newPasswordInput.value = '';
        newPasswordInput.focus();
    }
}

function clearNewPasswordMessages() {
    const { newPasswordError, newPasswordSuccess } = getElements();
    if (newPasswordError) {
        newPasswordError.textContent = '';
        newPasswordError.classList.add('hidden');
    }
    if (newPasswordSuccess) {
        newPasswordSuccess.textContent = '';
        newPasswordSuccess.classList.add('hidden');
    }
}

function displayNewPasswordError(message) {
    const { newPasswordError, newPasswordSuccess } = getElements();
    if (newPasswordSuccess) newPasswordSuccess.classList.add('hidden');
    if (newPasswordError) {
        newPasswordError.textContent = message;
        newPasswordError.classList.remove('hidden');
    }
}

function displayNewPasswordSuccess(message) {
    const { newPasswordError, newPasswordSuccess } = getElements();
    if (newPasswordError) newPasswordError.classList.add('hidden');
    if (newPasswordSuccess) {
        newPasswordSuccess.textContent = message;
        newPasswordSuccess.classList.remove('hidden');
    }
}

async function handleNewPasswordSubmit(event) {
    event.preventDefault();

    const { newPasswordForm, newPasswordInput, confirmPasswordInput } = getElements();
    if (!newPasswordForm) return;

    const newPassword = newPasswordInput?.value || '';
    const confirmPassword = confirmPasswordInput?.value || '';

    if (!newPassword.trim()) {
        displayNewPasswordError('Ingresa tu nueva contraseña.');
        return;
    }

    if (newPassword.length < 6) {
        displayNewPasswordError('La contraseña debe tener al menos 6 caracteres.');
        return;
    }

    if (newPassword !== confirmPassword) {
        displayNewPasswordError('Las contraseñas no coinciden.');
        return;
    }

    setFormLoading(newPasswordForm, true);
    try {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        
        if (error) {
            throw new Error(error.message || 'No se pudo actualizar la contraseña.');
        }

        displayNewPasswordSuccess('¡Contraseña actualizada correctamente! Ingresando...');
        
        // Limpiar el hash de la URL
        if (window.history?.replaceState) {
            window.history.replaceState(null, '', window.location.pathname);
        }

        // Esperar un momento y luego sincronizar sesión para entrar al dashboard
        setTimeout(async () => {
            const session = await syncSupabaseSession();
            if (session) {
                setMainViewVisible(true);
                hideLoginModal();
                resolvePendingAuth(session);
            }
        }, 1500);

    } catch (error) {
        displayNewPasswordError(error?.message || 'No se pudo actualizar la contraseña.');
    } finally {
        setFormLoading(newPasswordForm, false);
    }
}

// Escuchar eventos de autenticación de Supabase (PASSWORD_RECOVERY)
let authStateListenerSetup = false;
let isPasswordRecoveryMode = false;

function setupAuthStateListener() {
    if (authStateListenerSetup) return;
    authStateListenerSetup = true;
    
    supabase.auth.onAuthStateChange((event, session) => {
        console.log('[auth] Auth state change:', event, session ? 'with session' : 'no session');
        
        if (event === 'PASSWORD_RECOVERY') {
            console.log('[auth] PASSWORD_RECOVERY event detected');
            isPasswordRecoveryMode = true;
            // El usuario hizo clic en el link del email de recuperación
            showNewPasswordForm();
        }
    });
}

// Detectar si la URL tiene fragmento de recovery (type=recovery en el hash o query params)
function checkUrlForPasswordRecovery() {
    if (typeof window === 'undefined') return false;
    
    const hash = window.location.hash;
    const search = window.location.search;
    
    // Supabase puede añadir tokens en el hash o en query params
    const isRecoveryHash = hash.includes('type=recovery') || hash.includes('type%3Drecovery');
    const isRecoveryQuery = search.includes('type=recovery');
    const hasErrorDescription = hash.includes('error_description') || search.includes('error_description');
    
    // También detectar si hay access_token (indica que Supabase procesó el recovery)
    const hasAccessToken = hash.includes('access_token') || search.includes('access_token');
    
    const isRecovery = isRecoveryHash || isRecoveryQuery || (hasAccessToken && (isRecoveryHash || isRecoveryQuery));
    
    if (isRecovery || hasAccessToken) {
        console.log('[auth] Password recovery detected - hash:', isRecoveryHash, 'query:', isRecoveryQuery, 'hasToken:', hasAccessToken);
        isPasswordRecoveryMode = true;
        return true;
    }
    
    // Verificar si hay error en el hash (token expirado, etc.)
    if (hasErrorDescription) {
        console.log('[auth] Error in recovery URL detected');
        return true; // Mostrar el form de recovery para que puedan pedir otro link
    }
    
    return false;
}

// Extraer tokens del hash o query params de la URL para establecer la sesión
async function processRecoveryTokenFromUrl() {
    if (typeof window === 'undefined') return null;
    
    const fullHash = window.location.hash;
    const fullSearch = window.location.search;
    console.log('[auth] Full hash:', fullHash);
    console.log('[auth] Full search:', fullSearch);
    
    // Combinar hash y query params para buscar tokens
    let searchString = '';
    
    // Primero intentar del hash (sin el #)
    if (fullHash && fullHash.length > 1) {
        searchString = fullHash.substring(1);
        if (searchString.startsWith('/')) {
            searchString = searchString.substring(1);
        }
    }
    
    // Si no hay nada en el hash, intentar de los query params
    if (!searchString && fullSearch && fullSearch.length > 1) {
        searchString = fullSearch.substring(1);
    }
    
    if (!searchString) {
        console.log('[auth] No hash or search params to parse');
        return null;
    }
    
    // Intentar parsear como query string
    const params = new URLSearchParams(searchString);
    let accessToken = params.get('access_token');
    let refreshToken = params.get('refresh_token');
    let type = params.get('type');
    
    // Si no funcionó, intentar parseo manual
    if (!accessToken && searchString.includes('access_token=')) {
        const tokenMatch = searchString.match(/access_token=([^&]+)/);
        if (tokenMatch) {
            accessToken = decodeURIComponent(tokenMatch[1]);
        }
    }
    
    if (!refreshToken && searchString.includes('refresh_token=')) {
        const refreshMatch = searchString.match(/refresh_token=([^&]+)/);
        if (refreshMatch) {
            refreshToken = decodeURIComponent(refreshMatch[1]);
        }
    }
    
    if (!type && searchString.includes('type=')) {
        const typeMatch = searchString.match(/type=([^&]+)/);
        if (typeMatch) {
            type = decodeURIComponent(typeMatch[1]);
        }
    }
    
    console.log('[auth] Parsed - type:', type, 'has access_token:', !!accessToken, 'token length:', accessToken?.length);
    
    // Verificar si hay un error en la URL (token expirado, etc.)
    const errorDescription = params.get('error_description');
    if (errorDescription) {
        console.error('[auth] Recovery error:', errorDescription);
        return { error: decodeURIComponent(errorDescription) };
    }
    
    if (accessToken) {
        try {
            // Establecer la sesión usando los tokens del URL
            const { data, error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken || '',
            });
            
            if (error) {
                console.error('[auth] Error setting session from recovery token:', error);
                return null;
            }
            
            console.log('[auth] Session established from recovery token');
            return data.session;
        } catch (err) {
            console.error('[auth] Exception setting recovery session:', err);
            return null;
        }
    }
    
    return null;
}

function bindEventListeners() {
    if (listenersBound) {
        return;
    }

    const { form, logoutButton, menuButton, helpLink, settingsLink, themeToggle, mailInput, passwordInput } = getElements();
    if (form) {
        form.addEventListener('submit', handleLoginSubmit);
    }
    // Limpiar error cuando el usuario empieza a escribir
    if (mailInput) {
        mailInput.addEventListener('input', clearErrorOnInput);
    }
    if (passwordInput) {
        passwordInput.addEventListener('input', clearErrorOnInput);
    }
    // Password reset event listeners
    const { forgotPasswordLink, resetPasswordForm, resetEmailInput, backToLoginLink } = getElements();
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', showForgotPasswordForm);
    }
    if (resetPasswordForm) {
        resetPasswordForm.addEventListener('submit', handleResetFormSubmit);
    }
    if (resetEmailInput) {
        resetEmailInput.addEventListener('input', clearResetMessages);
    }
    if (backToLoginLink) {
        backToLoginLink.addEventListener('click', showLoginForm);
    }
    // Email sent confirmation - back button
    const { backToLoginFromSent } = getElements();
    if (backToLoginFromSent) {
        backToLoginFromSent.addEventListener('click', showLoginForm);
    }
    // New password form event listeners
    const { newPasswordForm, newPasswordInput, confirmPasswordInput } = getElements();
    if (newPasswordForm) {
        newPasswordForm.addEventListener('submit', handleNewPasswordSubmit);
    }
    if (newPasswordInput) {
        newPasswordInput.addEventListener('input', clearNewPasswordMessages);
    }
    if (confirmPasswordInput) {
        confirmPasswordInput.addEventListener('input', clearNewPasswordMessages);
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
    if (themeToggle) {
        themeToggle.addEventListener('change', handleThemeToggleChange);
        if (!unsubscribeThemeChange) {
            unsubscribeThemeChange = onThemeChange(updateThemeToggleUI);
        } else {
            updateThemeToggleUI(getCurrentTheme());
        }
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

// ⚠️ SOLO PARA DESARROLLO - Token mock cuando el login está desactivado
// IMPORTANTE: Para que funcione correctamente con el backend, debes:
// 1. Establecer DEV_MODE = false (RECOMENDADO)
// 2. O modificar el backend para aceptar peticiones sin token
const DEV_MODE = false; // Activar solo si se necesita modo desarrollo sin autenticación real
const DEV_USER = {
    nombre: 'Modo desarrollo',
    cargo: 'UI Preview',
    rol: 'Administrador',
};
const DEV_TOKEN = 'dev-token-' + Date.now();

export function isDevMode() {
    return DEV_MODE;
}

export function getCurrentToken() {
    // Si estamos en modo desarrollo, retornar token mock
    if (DEV_MODE) {
        return DEV_TOKEN;
    }
    
    const session = loadStoredAuth();
    const token = typeof session?.token === 'string' ? session.token.trim() : '';
    return token || null;
}

export async function initializeAuth() {
    // Cargar preferencia de "recordarme" antes de cualquier operación de storage
    useLocalStorage = loadRememberPreference();
    
    // IMPORTANTE: Configurar el listener ANTES de cualquier operación de sesión
    // para capturar el evento PASSWORD_RECOVERY que Supabase dispara automáticamente
    setupAuthStateListener();
    
    // Verificar si la URL indica que es un flujo de password recovery
    const isRecoveryUrl = checkUrlForPasswordRecovery();
    
    bindEventListeners();

    // En modo desarrollo, omitir el inicio de sesión y mostrar la app inmediatamente
    if (DEV_MODE) {
        const devSession = buildSession({
            user: DEV_USER,
            token: DEV_TOKEN,
            expiresAt: null,
        });
        if (devSession) {
            persistAuth(devSession);
            setMainViewVisible(true);
            hideLoginModal();
            return devSession;
        }
    }

    // Si es un recovery URL, procesar el token y mostrar el formulario
    if (isRecoveryUrl) {
        console.log('[auth] Recovery URL detected, processing token...');
        
        // Mostrar el login container
        setMainViewVisible(false);
        const { loginContainer } = getElements();
        if (loginContainer) {
            loginContainer.classList.remove('hidden');
        }
        
        // Procesar el token del hash para establecer la sesión
        const recoveryResult = await processRecoveryTokenFromUrl();
        
        // Si hay un error (token expirado, etc.), mostrar el mensaje
        if (recoveryResult && recoveryResult.error) {
            console.log('[auth] Recovery token error:', recoveryResult.error);
            showForgotPasswordForm();
            displayResetError('El enlace ha expirado. Solicitá uno nuevo.');
            return createPendingAuthPromise();
        }
        
        if (recoveryResult) {
            console.log('[auth] Recovery session established, showing password form');
            isPasswordRecoveryMode = true;
        } else {
            console.log('[auth] Could not establish recovery session, but showing form anyway');
        }
        
        // Limpiar la URL del hash/query params
        if (window.history?.replaceState) {
            window.history.replaceState(null, '', window.location.pathname);
        }
        
        // Mostrar el formulario de nueva contraseña
        showNewPasswordForm();
        return createPendingAuthPromise();
    }

    const activeSession = await syncSupabaseSession();
    if (activeSession) {
        updateUserPanel(activeSession.user);
        setMainViewVisible(true);
        hideLoginModal();
        return activeSession;
    }

    clearStoredAuth();
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
    if (DEV_MODE) {
        return loadStoredAuth() || buildSession({ user: DEV_USER, token: DEV_TOKEN, expiresAt: null });
    }

    const session = await syncSupabaseSession();
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
