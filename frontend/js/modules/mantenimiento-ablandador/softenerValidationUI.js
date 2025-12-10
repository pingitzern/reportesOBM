/**
 * UI de Alertas de Validación para Formulario de Ablandadores
 * Muestra un panel flotante colapsable con las alertas activas.
 */

import { validateSoftenerForm, hasBlockingErrors, getBlockingErrors } from './softenerValidator.js';

// =========================================================================
// CONFIGURACIÓN
// =========================================================================

const DEBOUNCE_MS = 1500;
const CONTAINER_ID = 'softener-validation-alerts';
const TOGGLE_ID = 'softener-validation-toggle';

// =========================================================================
// ESTADO
// =========================================================================

let debounceTimer = null;
let currentAlerts = [];
let isInitialized = false;
let isExpanded = true;

// =========================================================================
// UI
// =========================================================================

function createAlertContainer() {
    // Verificar si ya existe
    if (document.getElementById(CONTAINER_ID)) return;

    // Contenedor principal (siempre visible)
    const wrapper = document.createElement('div');
    wrapper.id = 'softener-validation-wrapper';
    wrapper.className = 'fixed bottom-4 left-4 z-40 pointer-events-auto';

    // Botón toggle (ícono colapsado)
    const toggle = document.createElement('button');
    toggle.id = TOGGLE_ID;
    toggle.className = 'hidden bg-gray-800 hover:bg-gray-700 text-white rounded-full w-14 h-14 shadow-xl flex items-center justify-center cursor-pointer transition-all hover:scale-110';
    toggle.setAttribute('aria-label', 'Mostrar alertas de validación');
    toggle.innerHTML = `
        <span id="softener-toggle-badge" class="text-lg font-bold"></span>
    `;

    // Panel expandido
    const container = document.createElement('div');
    container.id = CONTAINER_ID;
    container.className = 'w-80 max-h-96 overflow-y-auto space-y-0';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-label', 'Alertas de validación');

    wrapper.appendChild(toggle);
    wrapper.appendChild(container);
    document.body.appendChild(wrapper);

    // Event: click en toggle para expandir
    toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        expandPanel();
    });

    // Event: click fuera del panel para colapsar
    document.addEventListener('click', handleClickOutside);
}

function handleClickOutside(e) {
    const wrapper = document.getElementById('softener-validation-wrapper');
    const container = document.getElementById(CONTAINER_ID);

    if (!wrapper || !container) return;

    // Si el click fue dentro del wrapper, no hacer nada
    if (wrapper.contains(e.target)) return;

    // Si hay alertas y está expandido, colapsar
    if (currentAlerts.length > 0 && isExpanded) {
        collapsePanel();
    }
}

function collapsePanel() {
    const container = document.getElementById(CONTAINER_ID);
    const toggle = document.getElementById(TOGGLE_ID);

    if (!container || !toggle) return;

    container.classList.add('hidden');
    toggle.classList.remove('hidden');
    toggle.classList.add('flex');
    isExpanded = false;

    // Actualizar badge del toggle
    updateToggleBadge();
}

function expandPanel() {
    const container = document.getElementById(CONTAINER_ID);
    const toggle = document.getElementById(TOGGLE_ID);

    if (!container || !toggle) return;

    container.classList.remove('hidden');
    toggle.classList.add('hidden');
    toggle.classList.remove('flex');
    isExpanded = true;

    // Re-renderizar alertas
    renderAlerts(currentAlerts);
}

function updateToggleBadge() {
    const badge = document.getElementById('softener-toggle-badge');
    if (!badge) return;

    const errors = currentAlerts.filter(a => a.type === 'error').length;
    const warnings = currentAlerts.filter(a => a.type === 'warning').length;
    const tips = currentAlerts.filter(a => a.type === 'tip').length;

    // Mostrar el ícono más prioritario
    if (errors > 0) {
        badge.textContent = `🚨${errors}`;
    } else if (warnings > 0) {
        badge.textContent = `⚠️${warnings}`;
    } else if (tips > 0) {
        badge.textContent = `💡${tips}`;
    } else {
        badge.textContent = '✅';
    }
}

function renderAlerts(alerts) {
    const container = document.getElementById(CONTAINER_ID);
    const toggle = document.getElementById(TOGGLE_ID);

    if (!container || !toggle) return;

    // Limpiar contenedor
    container.innerHTML = '';

    if (alerts.length === 0) {
        container.classList.add('hidden');
        toggle.classList.add('hidden');
        return;
    }

    // Si está colapsado, solo actualizar el badge
    if (!isExpanded) {
        updateToggleBadge();
        return;
    }

    container.classList.remove('hidden');
    toggle.classList.add('hidden');

    // Agrupar por tipo
    const errors = alerts.filter(a => a.type === 'error');
    const warnings = alerts.filter(a => a.type === 'warning');
    const tips = alerts.filter(a => a.type === 'tip');

    // Función para crear una alerta
    function createAlertElement(alert) {
        const div = document.createElement('div');

        let bgClass, borderClass, textClass, icon;
        switch (alert.type) {
            case 'error':
                bgClass = 'bg-red-50 dark:bg-red-900/30';
                borderClass = 'border-red-300 dark:border-red-700';
                textClass = 'text-red-800 dark:text-red-200';
                icon = '🚨';
                break;
            case 'warning':
                bgClass = 'bg-amber-50 dark:bg-amber-900/30';
                borderClass = 'border-amber-300 dark:border-amber-700';
                textClass = 'text-amber-800 dark:text-amber-200';
                icon = '⚠️';
                break;
            case 'tip':
                bgClass = 'bg-blue-50 dark:bg-blue-900/30';
                borderClass = 'border-blue-300 dark:border-blue-700';
                textClass = 'text-blue-800 dark:text-blue-200';
                icon = '💡';
                break;
        }

        div.className = `${bgClass} ${borderClass} ${textClass} border rounded-lg p-3 shadow-lg text-sm flex items-start gap-2 cursor-pointer hover:shadow-xl transition-shadow`;
        div.innerHTML = `
            <span class="flex-shrink-0">${icon}</span>
            <span class="flex-1">${alert.message}</span>
        `;

        // Al hacer clic, ir al campo
        if (alert.fieldId) {
            div.addEventListener('click', (e) => {
                e.stopPropagation();
                const field = document.getElementById(alert.fieldId);
                if (field) {
                    field.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    field.focus();
                    field.classList.add('ring-2', 'ring-red-500');
                    setTimeout(() => {
                        field.classList.remove('ring-2', 'ring-red-500');
                    }, 2000);
                }
            });
        }

        return div;
    }

    // Header con botón minimizar
    const header = document.createElement('div');
    header.className = 'bg-gray-800 text-white rounded-t-lg px-3 py-2 flex justify-between items-center';
    header.innerHTML = `
        <span class="font-semibold text-sm">
            ${errors.length > 0 ? `🚨 ${errors.length}` : ''}
            ${warnings.length > 0 ? `⚠️ ${warnings.length}` : ''}
            ${tips.length > 0 ? `💡 ${tips.length}` : ''}
        </span>
        <button id="softener-alerts-minimize" class="text-white/70 hover:text-white text-lg leading-none" title="Minimizar">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
            </svg>
        </button>
    `;
    container.appendChild(header);

    // Botón minimizar
    header.querySelector('#softener-alerts-minimize').addEventListener('click', (e) => {
        e.stopPropagation();
        collapsePanel();
    });

    // Contenedor de alertas (scrolleable)
    const alertsWrapper = document.createElement('div');
    alertsWrapper.className = 'bg-white dark:bg-gray-800 rounded-b-lg shadow-xl border border-gray-200 dark:border-gray-700 p-2 space-y-2 max-h-72 overflow-y-auto';

    // Errores primero
    errors.forEach(a => alertsWrapper.appendChild(createAlertElement(a)));
    warnings.forEach(a => alertsWrapper.appendChild(createAlertElement(a)));
    tips.forEach(a => alertsWrapper.appendChild(createAlertElement(a)));

    container.appendChild(alertsWrapper);
}

// =========================================================================
// LÓGICA DE VALIDACIÓN
// =========================================================================

function runValidation() {
    currentAlerts = validateSoftenerForm();

    if (isExpanded) {
        renderAlerts(currentAlerts);
    } else {
        updateToggleBadge();
    }
}

function scheduleValidation() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(runValidation, DEBOUNCE_MS);
}

// =========================================================================
// INTEGRACIÓN
// =========================================================================

/**
 * Inicializa el sistema de validación para el formulario de ablandadores
 * @param {string} formId - ID del formulario a observar
 */
export function initSoftenerValidation(formId) {
    if (isInitialized) return;

    const form = document.getElementById(formId);
    if (!form) {
        console.warn('SoftenerValidation: Form not found:', formId);
        return;
    }

    // Crear contenedor de UI
    createAlertContainer();

    // Escuchar cambios en el formulario
    form.addEventListener('input', scheduleValidation);
    form.addEventListener('change', scheduleValidation);

    // Escuchar cambios de vista para mostrar/ocultar el panel
    document.addEventListener('view:changed', (e) => {
        const viewId = e.detail?.viewId;
        if (viewId === 'tab-ablandador') {
            showValidationPanel();
        } else {
            hideValidationPanel();
        }
    });

    // Validación inicial después de un pequeño delay
    setTimeout(runValidation, 500);

    isInitialized = true;
    console.log('✅ Sistema de validación de ablandador inicializado');
}

/**
 * Verifica si el formulario puede ser guardado (sin errores críticos)
 */
export function canSaveForm() {
    return !hasBlockingErrors();
}

/**
 * Muestra los errores que bloquean el guardado
 */
export function showBlockingErrors() {
    const errors = getBlockingErrors();
    if (errors.length > 0) {
        isExpanded = true;
        renderAlerts(errors);
    }
    return errors;
}

/**
 * Fuerza una validación inmediata
 */
export function forceValidation() {
    clearTimeout(debounceTimer);
    runValidation();
}

/**
 * Destruye el sistema de validación
 */
export function destroySoftenerValidation() {
    const wrapper = document.getElementById('softener-validation-wrapper');
    if (wrapper) {
        wrapper.remove();
    }
    document.removeEventListener('click', handleClickOutside);
    isInitialized = false;
}

/**
 * Oculta el panel de validación (cuando se sale de la pestaña)
 */
export function hideValidationPanel() {
    const wrapper = document.getElementById('softener-validation-wrapper');
    if (wrapper) {
        wrapper.style.display = 'none';
    }
}

/**
 * Muestra el panel de validación (cuando se entra a la pestaña)
 */
export function showValidationPanel() {
    const wrapper = document.getElementById('softener-validation-wrapper');
    if (wrapper) {
        wrapper.style.display = '';
        // Forzar validación al volver a la pestaña
        runValidation();
    }
}
