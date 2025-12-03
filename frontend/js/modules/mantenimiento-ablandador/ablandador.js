import {
    guardarMantenimientoAblandador as guardarMantenimientoAblandadorApi,
    obtenerClientes as obtenerClientesApi,
    obtenerEquiposAblandadorPorCliente,
    obtenerEquipoAblandadorPorSerie,
    crearEquipoAblandador,
    actualizarEquipoAblandador,
    detectarCambiosEquipo,
} from '../../api.js';
import { SignatureModal } from '../signature/signaturePad.js';
import { getCurrentUserName } from '../login/auth.js';

const SOFTENER_VIEW_ID = 'tab-ablandador';
const FORM_ID = 'softener-maintenance-form';
const SAVE_BUTTON_ID = 'softener-save-button';
const RESET_BUTTON_ID = 'softener-reset-button';
const AUTOFILL_BUTTON_ID = 'softener-autofill-button';
const REMITO_BUTTON_ID = 'softener-generar-remito-btn';
const REPORT_NUMBER_DISPLAY_ID = 'softener-report-number-display';
const AUTONOMIA_RECOMENDADA_ID = 'softener-autonomia-recomendada';
const AUTONOMIA_SETEO_ACTUAL_ID = 'softener-autonomia-seteo-actual';
const AUTONOMIA_AJUSTADA_ID = 'softener-autonomia-ajustada';
const VOLUMEN_RESINA_ID = 'softener-volumen-resina';
const FACTOR_PROTECCION_ID = 'softener-factor-proteccion';
const DUREZA_AGUA_CRUDA_ID = 'softener-dureza-agua-cruda';
const AUTONOMIA_RESTANTE_ID = 'softener-autonomia-restante';
const AUTONOMIA_RESTANTE_INFO_BTN_ID = 'softener-autonomia-restante-info-btn';
const AUTONOMIA_RESTANTE_INFO_POPUP_ID = 'softener-autonomia-restante-info-popup';
// IDs para la nueva sección: Configuración del cabezal
const CABEZAL_HORA_CABEZAL_FOUND_ID = 'softener-cabezal-hora-cabezal-found';
const CABEZAL_HORA_CABEZAL_LEFT_ID = 'softener-cabezal-hora-cabezal-left';
const CABEZAL_HORA_REGENERACION_FOUND_ID = 'softener-cabezal-hora-regeneracion-found';
const CABEZAL_HORA_REGENERACION_LEFT_ID = 'softener-cabezal-hora-regeneracion-left';

const CABEZAL_P1_FOUND_ID = 'softener-cabezal-p1-found';
const CABEZAL_P1_LEFT_ID = 'softener-cabezal-p1-left';
const CABEZAL_P2_FOUND_ID = 'softener-cabezal-p2-found';
const CABEZAL_P2_LEFT_ID = 'softener-cabezal-p2-left';
const CABEZAL_P3_FOUND_ID = 'softener-cabezal-p3-found';
const CABEZAL_P3_LEFT_ID = 'softener-cabezal-p3-left';
const CABEZAL_P4_FOUND_ID = 'softener-cabezal-p4-found';
const CABEZAL_P4_LEFT_ID = 'softener-cabezal-p4-left';

// Tipo de regeneración (sección B): Por Volumen | Por Tiempo
const SECCION_B_TIPO_REGENERACION_ID = 'softener-equipo-regeneracion-tipo';
const CABEZAL_FRECUENCIA_DIAS_FOUND_ID = 'softener-cabezal-frecuencia-dias-found';
const CABEZAL_FRECUENCIA_DIAS_LEFT_ID = 'softener-cabezal-frecuencia-dias-left';
const CABEZAL_FRECUENCIA_CONTAINER_ID = 'softener-cabezal-frecuencia-container';
// IDs para el popup de información del prefiltro
const PREFILTER_SELECT_ID = 'softener-equipo-prefiltro';
const PREFILTER_INFO_BTN_ID = 'softener-prefilter-info-btn';
const PREFILTER_INFO_POPUP_ID = 'softener-prefilter-info-popup';
const PREFILTRACION_SECTION_ID = 'softener-prefiltracion-section';
const CAMBIO_FILTRO_CONTAINER_ID = 'softener-cambio-filtro-container';
const CHECK_CAMBIO_FILTRO_ID = 'softener-check-cambio-filtro';
const DETALLE_CAMBIO_FILTRO_ID = 'softener-detalle-cambio-filtro';
const FILTRO_TIPO_INSTALADO_ID = 'softener-filtro-tipo-instalado';
const FILTRO_LOTE_SERIE_ID = 'softener-filtro-lote-serie';
// IDs para tren de prefiltrado
const PREFILTRO_TREN_CHECKBOX_ID = 'softener-prefiltro-tren';
const PREFILTRO_TREN_CONTAINER_ID = 'softener-prefiltro-tren-container';
const PREFILTRO_SIMPLE_CONTAINER_ID = 'softener-prefiltro-simple-container';
const PREFILTRO_ETAPAS_INPUT_ID = 'softener-prefiltro-etapas';
const PREFILTRO_ETAPAS_CONTAINER_ID = 'softener-prefiltro-etapas-container';

// IDs para cambio de filtro en checklist (Sección D) - modo simple y tren
const CAMBIO_FILTRO_TREN_CONTAINER_ID = 'softener-cambio-filtro-tren-container';
const CAMBIO_FILTRO_TREN_ETAPAS_ID = 'softener-cambio-filtro-tren-etapas';
const DETALLE_CAMBIO_FILTRO_TREN_ID = 'softener-detalle-cambio-filtro-tren';
const LOTES_TREN_CONTAINER_ID = 'softener-lotes-tren-container';

const PROTECTION_INFO_BTN_ID = 'softener-protection-info-btn';
const PROTECTION_INFO_POPUP_ID = 'softener-protection-info-popup';
const PROTECCION_ENTRADA_ID = 'softener-equipo-proteccion-entrada';
// Manómetros
const MANOMETRO_INFO_BTN_ID = 'softener-manometro-info-btn';
const MANOMETRO_INFO_POPUP_ID = 'softener-manometro-info-popup';
const MANOMETRO_SELECT_ID = 'softener-equipo-manometros';

// IDs de campos Sección B (Información del Equipo)
const EQUIPO_TIPO_ID = 'softener-equipo-tipo';
const EQUIPO_MODELO_ID = 'softener-equipo-modelo';
const EQUIPO_NUMERO_SERIE_ID = 'softener-equipo-numero-serie';
const EQUIPO_UBICACION_ID = 'softener-equipo-ubicacion';
const EQUIPO_NOTAS_ID = 'softener-equipo-notas';

// Estado de equipo precargado
let equipoActualCargado = null; // Equipo cargado desde BD
let equiposDelCliente = []; // Lista de equipos del cliente
let seccionBEditada = false; // Flag para detectar ediciones manuales
let seccionBDesbloqueada = false; // Flag para modo edición

const CLIENT_SELECT_ID = 'softener-cliente-nombre'; // Hidden input now
const CLIENT_SEARCH_ID = 'softener-cliente-search';
const CLIENT_DROPDOWN_ID = 'softener-cliente-dropdown';
const CLIENT_CLEAR_BTN_ID = 'softener-cliente-clear-btn';
const CLIENT_CONTAINER_ID = 'softener-cliente-autocomplete-container';
const CLIENT_OPTION_ATTRIBUTE = 'data-softener-client-option';
const CLIENT_KEY_ATTRIBUTE = 'data-softener-client-key';
const CLIENT_DETAIL_FIELD_IDS = Object.freeze([
    'softener-cliente-direccion',
    'softener-cliente-telefono',
    'softener-cliente-email',
    'softener-cliente-cuit',
]);
const CLIENT_DETAIL_EMPTY_CLASS = 'client-detail-empty';
const CLIENT_DETAIL_LOCKED_CLASS = 'client-detail-locked';

const CLIENT_NAME_FIELDS = Object.freeze([
    'nombre',
    'Nombre',
    'cliente',
    'Cliente',
    'razon_social',
    'RazonSocial',
]);

const CLIENT_ID_FIELDS = Object.freeze([
    'id',
    'ID',
    'id_cliente',
    'IdCliente',
    'codigo',
    'Codigo',
    'cuit',
    'CUIT',
]);

const CLIENT_FIELD_ALIASES = Object.freeze({
    direccion: ['direccion', 'Direccion', 'domicilio', 'Domicilio'],
    telefono: ['telefono', 'Telefono', 'tel', 'Tel'],
    email: ['email', 'Email', 'mail', 'Mail', 'correo', 'Correo'],
    cuit: ['cuit', 'CUIT'],
});

const clienteDataMap = new Map();
const clientDetailInputsWithListener = new WeakSet();
let clienteSelectChangeHandler = null;
let clientesLoaded = false;
let clientesLoadingPromise = null;
let clientAutocompleteInitialized = false;
let lastSavedMaintenanceId = null;

// Autocomplete state
let clientesListCache = [];
let selectedClientIndex = -1;

// Signature modal state
let signatureModal = null;
let pendingFormData = null;

function getElement(id) {
    return typeof document !== 'undefined' ? document.getElementById(id) : null;
}

// ===== Form Locked Overlay Functions =====
function showFormLockedOverlay() {
    const form = getElement(FORM_ID);
    if (!form) return;
    
    const formCards = form.querySelectorAll('.form-card');
    formCards.forEach(card => {
        // Verificar si ya tiene overlay
        if (card.querySelector('.form-card-overlay')) return;
        
        card.style.position = 'relative';
        const overlay = document.createElement('div');
        overlay.className = 'form-card-overlay';
        card.appendChild(overlay);
    });
    
    // Mostrar mensaje flotante
    let message = getElement('softener-form-locked-message');
    if (!message) {
        message = document.createElement('div');
        message.id = 'softener-form-locked-message';
        message.className = 'form-locked-floating-message';
        message.innerHTML = `
            <svg class="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <span>Reporte guardado - Continuá con el remito o creá uno nuevo</span>
        `;
        form.insertBefore(message, form.firstChild);
    }
    message.classList.remove('hidden');
}

function hideFormLockedOverlay() {
    const form = getElement(FORM_ID);
    if (!form) return;
    
    const overlays = form.querySelectorAll('.form-card-overlay');
    overlays.forEach(overlay => overlay.remove());
    
    const message = getElement('softener-form-locked-message');
    if (message) {
        message.classList.add('hidden');
    }
}
// ===== End Form Locked Overlay =====

function schedulePostReset(callback) {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(callback);
        return;
    }
    setTimeout(callback, 0);
}

function parseNumber(value) {
    if (value === null || value === undefined) {
        return null;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    const normalized = String(value).replace(',', '.').trim();
    if (!normalized) {
        return null;
    }
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
}

function getInputValue(id) {
    const element = getElement(id);
    if (!element) {
        return '';
    }
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
        return element.value.trim();
    }
    return '';
}

function getNumberValue(id) {
    return parseNumber(getInputValue(id));
}

function getCheckboxValue(id) {
    const element = getElement(id);
    if (element instanceof HTMLInputElement) {
        return Boolean(element.checked);
    }
    return false;
}

function setNumericFieldValue(id, value) {
    const element = getElement(id);
    if (!(element instanceof HTMLInputElement)) {
        return;
    }
    if (value === null || value === undefined || Number.isNaN(value)) {
        element.value = '';
        return;
    }
    const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
    element.value = Number.isFinite(rounded) ? rounded.toString() : '';
}

function setInputValue(id, value) {
    const element = getElement(id);
    if (!element) {
        return;
    }
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        element.value = value !== null && value !== undefined ? String(value) : '';
        element.dispatchEvent(new Event('input', { bubbles: true }));
    }
}

function setSelectValue(id, value) {
    const element = getElement(id);
    if (!(element instanceof HTMLSelectElement)) {
        return;
    }
    element.value = value !== null && value !== undefined ? String(value) : '';
    element.dispatchEvent(new Event('change', { bubbles: true }));
}

function setCheckboxValue(id, checked) {
    const element = getElement(id);
    if (!(element instanceof HTMLInputElement) || element.type !== 'checkbox') {
        return;
    }
    element.checked = Boolean(checked);
    element.dispatchEvent(new Event('change', { bubbles: true }));
}

function generateSoftenerReportNumber() {
    const now = new Date();
    const padZero = (num) => String(num).padStart(2, '0');
    const year = now.getFullYear().toString().slice(-2);
    const month = padZero(now.getMonth() + 1);
    const day = padZero(now.getDate());
    const hours = padZero(now.getHours());
    const minutes = padZero(now.getMinutes());
    const seconds = padZero(now.getSeconds());
    return `ABL-${year}${month}${day}-${hours}${minutes}${seconds}`;
}

function setReportNumber(reportNumber) {
    const display = getElement(REPORT_NUMBER_DISPLAY_ID);
    if (display) {
        display.textContent = reportNumber || 'ABL-PENDIENTE';
    }
}

function getClientSelection() {
    // Ahora usamos autocomplete: hidden input para ID, search input para nombre
    const hiddenInput = getElement(CLIENT_SELECT_ID);
    const searchInput = getElement(CLIENT_SEARCH_ID);
    
    const id = (hiddenInput?.value || '').trim();
    const name = (searchInput?.value || '').trim();

    return {
        id: id || name, // Si no hay ID, usar el nombre como fallback
        name: name || id,
    };
}

function normalizeString(value) {
    if (value === null || value === undefined) {
        return '';
    }
    return String(value).trim();
}

function getFirstAvailableField(source, fieldNames) {
    if (!source || typeof source !== 'object') {
        return '';
    }

    for (const field of fieldNames) {
        if (Object.prototype.hasOwnProperty.call(source, field)) {
            const normalized = normalizeString(source[field]);
            if (normalized) {
                return normalized;
            }
        }
    }

    return '';
}

function extractClientName(cliente) {
    return getFirstAvailableField(cliente, CLIENT_NAME_FIELDS);
}

function extractClientId(cliente) {
    return getFirstAvailableField(cliente, CLIENT_ID_FIELDS);
}

function createClientDetails(cliente) {
    return {
        direccion: getFirstAvailableField(cliente, CLIENT_FIELD_ALIASES.direccion),
        telefono: getFirstAvailableField(cliente, CLIENT_FIELD_ALIASES.telefono),
        email: getFirstAvailableField(cliente, CLIENT_FIELD_ALIASES.email),
        cuit: getFirstAvailableField(cliente, CLIENT_FIELD_ALIASES.cuit),
    };
}

function refreshClientDetailFieldState(element, { lockWhenFilled = false } = {}) {
    if (!(element instanceof HTMLInputElement)) {
        return;
    }

    const hasValue = normalizeString(element.value) !== '';

    if (lockWhenFilled && hasValue) {
        element.readOnly = true;
        element.disabled = false;
    } else if (!hasValue) {
        element.readOnly = false;
        element.disabled = false;
    }

    if (hasValue) {
        element.classList.remove(CLIENT_DETAIL_EMPTY_CLASS);
        if (lockWhenFilled) {
            element.classList.add(CLIENT_DETAIL_LOCKED_CLASS);
        }
    } else {
        element.classList.add(CLIENT_DETAIL_EMPTY_CLASS);
        element.classList.remove(CLIENT_DETAIL_LOCKED_CLASS);
    }
}

function setClientDetailValue(fieldId, value, options = {}) {
    const element = getElement(fieldId);
    if (!element) {
        return;
    }

    const normalizedValue = normalizeString(value);

    if ('value' in element) {
        element.value = normalizedValue;
    }

    if (element instanceof HTMLInputElement) {
        refreshClientDetailFieldState(element, { lockWhenFilled: Boolean(options.lockWhenFilled) });
    }
}

function applyClientDetails(details = {}) {
    setClientDetailValue('softener-cliente-direccion', details.direccion, { lockWhenFilled: true });
    setClientDetailValue('softener-cliente-telefono', details.telefono, { lockWhenFilled: true });
    setClientDetailValue('softener-cliente-email', details.email, { lockWhenFilled: true });
    setClientDetailValue('softener-cliente-cuit', details.cuit, { lockWhenFilled: true });
}

function clearClientDetails() {
    CLIENT_DETAIL_FIELD_IDS.forEach(fieldId => {
        setClientDetailValue(fieldId, '', { lockWhenFilled: false });
    });
}

function configureClientDetailFieldInteractions() {
    CLIENT_DETAIL_FIELD_IDS.forEach(fieldId => {
        const element = getElement(fieldId);
        if (!(element instanceof HTMLInputElement)) {
            return;
        }

        refreshClientDetailFieldState(element);

        if (!clientDetailInputsWithListener.has(element)) {
            element.addEventListener('input', () => {
                refreshClientDetailFieldState(element);
            });
            clientDetailInputsWithListener.add(element);
        }
    });
}

function updateClientDetailsFromSelect(selectElement) {
    if (!(selectElement instanceof HTMLSelectElement)) {
        clearClientDetails();
        return;
    }

    let selectedDetails = null;

    const selectedOption = selectElement.selectedOptions && selectElement.selectedOptions[0];
    if (selectedOption) {
        const optionKey = selectedOption.getAttribute(CLIENT_KEY_ATTRIBUTE);
        if (optionKey) {
            selectedDetails = clienteDataMap.get(optionKey) || null;
        }
    }

    if (!selectedDetails && typeof selectElement.selectedIndex === 'number' && selectElement.selectedIndex >= 0) {
        const optionByIndex = selectElement.options[selectElement.selectedIndex];
        if (optionByIndex) {
            const keyByIndex = optionByIndex.getAttribute(CLIENT_KEY_ATTRIBUTE);
            if (keyByIndex) {
                selectedDetails = clienteDataMap.get(keyByIndex) || null;
            }
        }
    }

    if (!selectedDetails) {
        selectedDetails = clienteDataMap.get(selectElement.value) || null;
    }

    if (selectedDetails) {
        applyClientDetails(selectedDetails);
    } else {
        clearClientDetails();
    }
}

function resetClientSelection() {
    // Limpiar el input de búsqueda del autocomplete
    const searchInput = getElement(CLIENT_SEARCH_ID);
    if (searchInput) {
        searchInput.value = '';
        searchInput.classList.remove('has-selection');
    }

    // Limpiar el input hidden con el ID del cliente
    const hiddenInput = getElement(CLIENT_SELECT_ID);
    if (hiddenInput) {
        hiddenInput.value = '';
    }
    
    // Ocultar botón de limpiar
    const clearBtn = getElement(CLIENT_CLEAR_BTN_ID);
    if (clearBtn) {
        clearBtn.classList.add('hidden');
    }

    // Ocultar el dropdown si está visible
    hideDropdown();

    clearClientDetails();
}

// ===== Autocomplete Functions =====
function normalizeForSearch(text) {
    if (!text) return '';
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .trim();
}

function highlightMatch(text, query) {
    if (!query || !text) return text;
    const normalizedText = normalizeForSearch(text);
    const normalizedQuery = normalizeForSearch(query);
    const index = normalizedText.indexOf(normalizedQuery);
    if (index === -1) return text;
    
    const before = text.slice(0, index);
    const match = text.slice(index, index + query.length);
    const after = text.slice(index + query.length);
    return `${before}<mark>${match}</mark>${after}`;
}

function filterClientes(query) {
    if (!query || query.length < 1) {
        return clientesListCache.slice(0, 10);
    }
    
    const normalizedQuery = normalizeForSearch(query);
    
    return clientesListCache
        .filter(cliente => {
            const name = normalizeForSearch(extractClientName(cliente));
            const direccion = normalizeForSearch(cliente.direccion || '');
            const cuit = normalizeForSearch(cliente.cuit || '');
            
            return name.includes(normalizedQuery) || 
                   direccion.includes(normalizedQuery) || 
                   cuit.includes(normalizedQuery);
        })
        .slice(0, 15);
}

function renderDropdown(clientes, query) {
    const dropdown = getElement(CLIENT_DROPDOWN_ID);
    if (!dropdown) return;
    
    if (clientes.length === 0) {
        dropdown.innerHTML = `
            <div class="cliente-dropdown-empty">
                No se encontraron clientes con "${query}"
            </div>
        `;
        dropdown.classList.remove('hidden');
        return;
    }
    
    dropdown.innerHTML = clientes.map((cliente, index) => {
        const name = extractClientName(cliente);
        const direccion = cliente.direccion || '';
        const highlightedName = highlightMatch(name, query);
        const highlightedDireccion = highlightMatch(direccion, query);
        const clientKey = `softener-cliente-${clientesListCache.indexOf(cliente)}`;
        
        return `
            <div class="cliente-dropdown-item ${index === selectedClientIndex ? 'selected' : ''}" 
                 data-cliente-key="${clientKey}"
                 data-cliente-index="${index}"
                 role="option"
                 tabindex="-1">
                <div class="cliente-dropdown-item-name">${highlightedName}</div>
                ${direccion ? `<div class="cliente-dropdown-item-detail">${highlightedDireccion}</div>` : ''}
            </div>
        `;
    }).join('');
    
    dropdown.classList.remove('hidden');
}

function hideDropdown() {
    const dropdown = getElement(CLIENT_DROPDOWN_ID);
    if (dropdown) {
        dropdown.classList.add('hidden');
    }
    selectedClientIndex = -1;
}

async function selectClient(clientKey) {
    const index = parseInt(clientKey.replace('softener-cliente-', ''), 10);
    const cliente = clientesListCache[index];
    if (!cliente) return;
    
    const searchInput = getElement(CLIENT_SEARCH_ID);
    const hiddenInput = getElement(CLIENT_SELECT_ID);
    const clearBtn = getElement(CLIENT_CLEAR_BTN_ID);
    
    const clientId = extractClientId(cliente) || extractClientName(cliente);
    const clientName = extractClientName(cliente);
    
    // Obtener el UUID real del cliente para buscar equipos
    const clienteUUID = cliente.id || null;
    
    if (hiddenInput) {
        hiddenInput.value = clientId;
        // Guardar también el UUID para uso posterior
        hiddenInput.dataset.clienteUuid = clienteUUID || '';
    }
    
    if (searchInput) {
        searchInput.value = clientName;
        searchInput.classList.add('has-selection');
    }
    
    if (clearBtn) {
        clearBtn.classList.remove('hidden');
    }
    
    // Store client details and apply them
    clienteDataMap.set(clientKey, createClientDetails(cliente));
    applyClientDetails(createClientDetails(cliente));
    
    hideDropdown();
    
    // Buscar y cargar equipos del cliente
    if (clienteUUID) {
        await cargarEquiposDelCliente(clienteUUID);
    }
}

function clearClientSelection() {
    const searchInput = getElement(CLIENT_SEARCH_ID);
    const hiddenInput = getElement(CLIENT_SELECT_ID);
    const clearBtn = getElement(CLIENT_CLEAR_BTN_ID);
    
    if (searchInput) {
        searchInput.value = '';
        searchInput.classList.remove('has-selection');
        searchInput.focus();
    }
    
    if (hiddenInput) {
        hiddenInput.value = '';
    }
    
    if (clearBtn) {
        clearBtn.classList.add('hidden');
    }
    
    clearClientDetails();
    hideDropdown();
    
    // Limpiar también los datos del equipo
    limpiarSeccionB();
}

// ============================================================================
// GESTIÓN DE EQUIPOS ABLANDADOR - Sección B
// ============================================================================

/**
 * Carga los equipos asociados a un cliente y muestra selector si hay más de uno
 */
async function cargarEquiposDelCliente(clienteUUID) {
    try {
        equiposDelCliente = await obtenerEquiposAblandadorPorCliente(clienteUUID);
        
        if (equiposDelCliente.length === 0) {
            // No hay equipos registrados - formulario vacío para nuevo equipo
            limpiarSeccionB();
            mostrarMensajeNuevoEquipo();
        } else if (equiposDelCliente.length === 1) {
            // Un solo equipo - autocompletar directamente
            cargarDatosEquipoEnFormulario(equiposDelCliente[0]);
        } else {
            // Múltiples equipos - mostrar selector
            mostrarSelectorEquipos(equiposDelCliente);
        }
    } catch (error) {
        console.error('Error cargando equipos del cliente:', error);
        limpiarSeccionB();
    }
}

/**
 * Muestra un mensaje indicando que es un equipo nuevo
 */
function mostrarMensajeNuevoEquipo() {
    const seccionB = getElement('softener-section-b');
    if (!seccionB) return;
    
    // Remover banner existente si hay
    const bannerExistente = seccionB.querySelector('.equipo-status-banner');
    if (bannerExistente) bannerExistente.remove();
    
    const banner = document.createElement('div');
    banner.className = 'equipo-status-banner mt-4 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg flex items-center gap-3';
    banner.innerHTML = `
        <svg class="w-5 h-5 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <div class="text-sm text-blue-700 dark:text-blue-300">
            <strong>Nuevo equipo:</strong> Este cliente no tiene equipos registrados. Los datos que cargues en esta sección se guardarán para futuros mantenimientos.
        </div>
    `;
    
    const titulo = seccionB.querySelector('h2');
    if (titulo) {
        titulo.parentNode.insertBefore(banner, titulo.nextSibling.nextSibling);
    }
    
    // Habilitar edición de campos
    habilitarEdicionSeccionB(true);
    seccionBDesbloqueada = true;
}

/**
 * Muestra un selector cuando el cliente tiene múltiples equipos
 */
function mostrarSelectorEquipos(equipos) {
    const seccionB = getElement('softener-section-b');
    if (!seccionB) return;
    
    // Remover selector/banner existente
    const existente = seccionB.querySelector('.equipo-selector-container, .equipo-status-banner');
    if (existente) existente.remove();
    
    const container = document.createElement('div');
    container.className = 'equipo-selector-container mt-4 p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg';
    
    const opciones = equipos.map((eq, idx) => {
        const serie = eq.numero_serie || 'Sin número de serie';
        const tipo = eq.tipo_ablandador || 'Custom';
        const ubicacion = eq.ubicacion || 'Sin ubicación';
        return `<option value="${idx}">${serie} - ${tipo} (${ubicacion})</option>`;
    }).join('');
    
    container.innerHTML = `
        <div class="flex items-center gap-3 mb-3">
            <svg class="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
            </svg>
            <span class="text-sm font-medium text-amber-700 dark:text-amber-300">Este cliente tiene ${equipos.length} equipos registrados. Seleccioná uno:</span>
        </div>
        <div class="flex gap-3 items-center">
            <select id="softener-equipo-selector" class="flex-1 rounded-md border border-amber-300 dark:border-amber-600 bg-white dark:bg-gray-800 p-2 text-gray-900 dark:text-gray-100">
                <option value="">-- Seleccionar equipo --</option>
                ${opciones}
                <option value="nuevo">➕ Registrar nuevo equipo</option>
            </select>
        </div>
    `;
    
    const titulo = seccionB.querySelector('h2');
    if (titulo) {
        titulo.parentNode.insertBefore(container, titulo.nextSibling.nextSibling);
    }
    
    // Event listener para el selector
    const selector = container.querySelector('#softener-equipo-selector');
    selector.addEventListener('change', (e) => {
        const valor = e.target.value;
        if (valor === '') {
            limpiarSeccionB(false); // No remover el selector
        } else if (valor === 'nuevo') {
            limpiarSeccionB(false);
            habilitarEdicionSeccionB(true);
            seccionBDesbloqueada = true;
            equipoActualCargado = null;
        } else {
            const idx = parseInt(valor, 10);
            cargarDatosEquipoEnFormulario(equipos[idx]);
        }
    });
}

/**
 * Carga los datos de un equipo en los campos de la sección B
 */
function cargarDatosEquipoEnFormulario(equipo) {
    if (!equipo) return;
    
    equipoActualCargado = equipo;
    seccionBEditada = false;
    
    // Mapeo de campos BD -> formulario
    setSelectValue(EQUIPO_TIPO_ID, equipo.tipo_ablandador);
    setInputValue(EQUIPO_MODELO_ID, equipo.modelo || '');
    setInputValue(VOLUMEN_RESINA_ID, equipo.volumen_resina || 25);
    setInputValue(EQUIPO_NUMERO_SERIE_ID, equipo.numero_serie || '');
    setSelectValue(EQUIPO_UBICACION_ID, equipo.ubicacion || '');
    setSelectValue(SECCION_B_TIPO_REGENERACION_ID, equipo.tipo_regeneracion || 'Por Volumen');
    
    // Cargar prefiltro - verificar si es tren
    let trenData = null;
    try {
        if (equipo.prefiltro && equipo.prefiltro.startsWith('{')) {
            trenData = JSON.parse(equipo.prefiltro);
        }
    } catch (e) {
        // No es JSON, es prefiltro simple
    }
    
    if (trenData && trenData.es_tren) {
        cargarTrenPrefiltrado(trenData);
    } else {
        cargarTrenPrefiltrado(null); // Reset a modo simple
        setSelectValue(PREFILTER_SELECT_ID, equipo.prefiltro || 'No Aplica');
    }
    
    setSelectValue(PROTECCION_ENTRADA_ID, equipo.proteccion_entrada || 'No Aplica');
    setSelectValue(MANOMETRO_SELECT_ID, equipo.manometros || 'No cuenta con manómetros');
    setInputValue(EQUIPO_NOTAS_ID, equipo.notas_equipo || '');
    
    // Actualizar cálculo de autonomía
    updateAutonomia();
    
    // Mostrar banner de equipo cargado
    mostrarBannerEquipoCargado(equipo);
    
    // Bloquear campos y agregar listeners de cambio
    habilitarEdicionSeccionB(false);
    attachSeccionBChangeListeners();
}

/**
 * Muestra banner indicando que los datos fueron precargados
 */
function mostrarBannerEquipoCargado(equipo) {
    const seccionB = getElement('softener-section-b');
    if (!seccionB) return;
    
    // Remover banner/selector existente
    const existente = seccionB.querySelector('.equipo-status-banner, .equipo-selector-container');
    if (existente) existente.remove();
    
    const banner = document.createElement('div');
    banner.className = 'equipo-status-banner mt-4 p-3 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700 rounded-lg';
    banner.innerHTML = `
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
                <svg class="w-5 h-5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <div class="text-sm text-emerald-700 dark:text-emerald-300">
                    <strong>Equipo cargado:</strong> ${equipo.numero_serie || 'Sin serie'} - ${equipo.tipo_ablandador || 'Custom'}
                    <span class="text-xs text-emerald-600 dark:text-emerald-400 ml-2">(Última actualización: ${formatearFecha(equipo.updated_at)})</span>
                </div>
            </div>
            <button type="button" id="softener-editar-equipo-btn" class="px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-800 hover:bg-emerald-200 dark:hover:bg-emerald-700 rounded-md transition-colors">
                ✏️ Editar configuración
            </button>
        </div>
    `;
    
    const titulo = seccionB.querySelector('h2');
    if (titulo) {
        titulo.parentNode.insertBefore(banner, titulo.nextSibling.nextSibling);
    }
    
    // Event listener para botón de editar
    const btnEditar = banner.querySelector('#softener-editar-equipo-btn');
    btnEditar.addEventListener('click', () => {
        habilitarEdicionSeccionB(true);
        seccionBDesbloqueada = true;
        btnEditar.textContent = '🔓 Modo edición activo';
        btnEditar.disabled = true;
        btnEditar.classList.add('opacity-50', 'cursor-not-allowed');
    });
}

/**
 * Formatea una fecha ISO a formato legible
 */
function formatearFecha(fechaISO) {
    if (!fechaISO) return 'N/A';
    try {
        const fecha = new Date(fechaISO);
        return fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
        return 'N/A';
    }
}

/**
 * Habilita o deshabilita la edición de campos de la sección B
 */
function habilitarEdicionSeccionB(habilitar) {
    const campos = [
        EQUIPO_TIPO_ID,
        EQUIPO_MODELO_ID,
        VOLUMEN_RESINA_ID,
        EQUIPO_NUMERO_SERIE_ID,
        EQUIPO_UBICACION_ID,
        SECCION_B_TIPO_REGENERACION_ID,
        PREFILTER_SELECT_ID,
        PROTECCION_ENTRADA_ID,
        MANOMETRO_SELECT_ID,
        EQUIPO_NOTAS_ID,
    ];
    
    campos.forEach(id => {
        const el = getElement(id);
        if (el) {
            if (habilitar) {
                el.removeAttribute('readonly');
                el.disabled = false;
                el.classList.remove('bg-gray-100', 'dark:bg-gray-700', 'cursor-not-allowed', 'opacity-75');
            } else {
                // Para selects, usamos disabled; para inputs, readonly
                if (el.tagName === 'SELECT') {
                    el.disabled = true;
                } else {
                    el.readOnly = true;
                }
                el.classList.add('bg-gray-100', 'dark:bg-gray-700', 'cursor-not-allowed', 'opacity-75');
            }
        }
    });
    
    // El número de serie siempre debe ser editable si es nuevo equipo
    if (habilitar && !equipoActualCargado) {
        const serieInput = getElement(EQUIPO_NUMERO_SERIE_ID);
        if (serieInput) {
            serieInput.classList.remove('opacity-75');
        }
    }
}

/**
 * Limpia los campos de la sección B
 */
function limpiarSeccionB(removerBanner = true) {
    equipoActualCargado = null;
    equiposDelCliente = [];
    seccionBEditada = false;
    seccionBDesbloqueada = false;
    
    // Limpiar campos
    setSelectValue(EQUIPO_TIPO_ID, 'Custom');
    setInputValue(EQUIPO_MODELO_ID, '');
    setInputValue(VOLUMEN_RESINA_ID, 25);
    setInputValue(EQUIPO_NUMERO_SERIE_ID, '');
    setSelectValue(EQUIPO_UBICACION_ID, '');
    setSelectValue(SECCION_B_TIPO_REGENERACION_ID, 'Por Volumen');
    setSelectValue(PREFILTER_SELECT_ID, 'No Aplica');
    setSelectValue(PROTECCION_ENTRADA_ID, 'No Aplica');
    setSelectValue(MANOMETRO_SELECT_ID, 'No cuenta con manómetros');
    setInputValue(EQUIPO_NOTAS_ID, '');
    
    // Reset tren de prefiltrado
    cargarTrenPrefiltrado(null);
    
    // Remover banner/selector si corresponde
    if (removerBanner) {
        const seccionB = getElement('softener-section-b');
        if (seccionB) {
            const banner = seccionB.querySelector('.equipo-status-banner, .equipo-selector-container');
            if (banner) banner.remove();
        }
    }
    
    // Habilitar edición
    habilitarEdicionSeccionB(true);
}

/**
 * Adjunta listeners para detectar cambios en la sección B
 */
function attachSeccionBChangeListeners() {
    const campos = [
        EQUIPO_TIPO_ID,
        EQUIPO_MODELO_ID,
        VOLUMEN_RESINA_ID,
        EQUIPO_UBICACION_ID,
        SECCION_B_TIPO_REGENERACION_ID,
        PREFILTER_SELECT_ID,
        PROTECCION_ENTRADA_ID,
        MANOMETRO_SELECT_ID,
        EQUIPO_NOTAS_ID,
    ];
    
    campos.forEach(id => {
        const el = getElement(id);
        if (el && !el.dataset.seccionBListener) {
            el.addEventListener('change', () => {
                if (seccionBDesbloqueada) {
                    seccionBEditada = true;
                }
            });
            el.addEventListener('input', () => {
                if (seccionBDesbloqueada) {
                    seccionBEditada = true;
                }
            });
            el.dataset.seccionBListener = 'true';
        }
    });
}

/**
 * Obtiene los datos actuales de la sección B del formulario
 */
function obtenerDatosSeccionB() {
    // Verificar si es tren de prefiltrado
    const trenData = obtenerValoresTrenPrefiltrado();
    
    return {
        tipo_ablandador: getSelectValue(EQUIPO_TIPO_ID) || 'Custom',
        modelo: getInputValue(EQUIPO_MODELO_ID) || '',
        volumen_resina: parseFloat(getInputValue(VOLUMEN_RESINA_ID)) || 25,
        numero_serie: getInputValue(EQUIPO_NUMERO_SERIE_ID)?.trim() || '',
        ubicacion: getSelectValue(EQUIPO_UBICACION_ID) || '',
        tipo_regeneracion: getSelectValue(SECCION_B_TIPO_REGENERACION_ID) || 'Por Volumen',
        prefiltro: trenData ? JSON.stringify(trenData) : (getSelectValue(PREFILTER_SELECT_ID) || 'No Aplica'),
        prefiltro_tren: trenData, // Datos estructurados del tren (null si no es tren)
        proteccion_entrada: getSelectValue(PROTECCION_ENTRADA_ID) || 'No Aplica',
        manometros: getSelectValue(MANOMETRO_SELECT_ID) || 'No cuenta con manómetros',
        notas_equipo: getInputValue(EQUIPO_NOTAS_ID) || '',
    };
}

/**
 * Verifica y maneja cambios en la configuración del equipo al guardar
 * @returns {Promise<{continuar: boolean, equipoId: string|null}>}
 */
async function verificarYGuardarEquipo() {
    const hiddenInput = getElement(CLIENT_SELECT_ID);
    const clienteUUID = hiddenInput?.dataset?.clienteUuid;
    
    if (!clienteUUID) {
        // No hay cliente seleccionado con UUID válido
        return { continuar: true, equipoId: null };
    }
    
    const datosFormulario = obtenerDatosSeccionB();
    const numeroSerie = datosFormulario.numero_serie;
    
    if (!numeroSerie) {
        alert('⚠️ El número de serie es obligatorio para registrar el equipo.');
        return { continuar: false, equipoId: null };
    }
    
    const tecnicoActual = getCurrentUserName() || 'Sistema';
    
    // Caso 1: Es un equipo nuevo (no había equipo cargado)
    if (!equipoActualCargado) {
        try {
            // Verificar si ya existe un equipo con ese número de serie para este cliente
            const equipoExistente = await obtenerEquipoAblandadorPorSerie(clienteUUID, numeroSerie);
            
            if (equipoExistente) {
                alert(`⚠️ Ya existe un equipo con el número de serie "${numeroSerie}" para este cliente.\n\nSi es el mismo equipo, seleccionalo de la lista.`);
                return { continuar: false, equipoId: null };
            }
            
            // Crear nuevo equipo
            const nuevoEquipo = await crearEquipoAblandador({
                cliente_id: clienteUUID,
                ...datosFormulario,
                created_by: tecnicoActual,
            });
            
            console.log('✅ Nuevo equipo creado:', nuevoEquipo.id);
            return { continuar: true, equipoId: nuevoEquipo.id };
        } catch (error) {
            console.error('Error creando equipo:', error);
            alert(`❌ Error al registrar el equipo: ${error.message}`);
            return { continuar: false, equipoId: null };
        }
    }
    
    // Caso 2: Hay equipo cargado - verificar si hubo cambios
    if (seccionBEditada && seccionBDesbloqueada) {
        const { hayCambios, cambios } = detectarCambiosEquipo(equipoActualCargado, datosFormulario);
        
        if (hayCambios) {
            // Mostrar modal de confirmación
            const detallesCambios = Object.entries(cambios)
                .map(([campo, { anterior, nuevo }]) => `• ${formatearNombreCampo(campo)}: "${anterior || '(vacío)'}" → "${nuevo || '(vacío)'}"`)
                .join('\n');
            
            const mensaje = `Se detectaron cambios en la configuración del equipo:\n\n${detallesCambios}\n\n¿Desea actualizar la ficha del equipo para futuros mantenimientos?`;
            
            const actualizarFicha = confirm(mensaje);
            
            if (actualizarFicha) {
                try {
                    await actualizarEquipoAblandador(equipoActualCargado.id, {
                        ...datosFormulario,
                        updated_by: tecnicoActual,
                    });
                    console.log('✅ Equipo actualizado:', equipoActualCargado.id);
                } catch (error) {
                    console.error('Error actualizando equipo:', error);
                    alert(`⚠️ No se pudo actualizar la ficha del equipo: ${error.message}\n\nEl mantenimiento se guardará de todas formas.`);
                }
            }
        }
    }
    
    return { continuar: true, equipoId: equipoActualCargado?.id || null };
}

/**
 * Formatea el nombre de un campo para mostrar al usuario
 */
function formatearNombreCampo(campo) {
    const nombres = {
        tipo_ablandador: 'Tipo de ablandador',
        modelo: 'Modelo',
        volumen_resina: 'Volumen de resina',
        ubicacion: 'Ubicación',
        tipo_regeneracion: 'Tipo de regeneración',
        prefiltro: 'Prefiltro',
        proteccion_entrada: 'Protección de entrada',
        manometros: 'Manómetros',
        notas_equipo: 'Notas del equipo',
    };
    return nombres[campo] || campo;
}

/**
 * Helper para obtener valor de un select
 */
function getSelectValue(id) {
    const el = getElement(id);
    return el?.value || '';
}

function initializeClientAutocomplete() {
    if (clientAutocompleteInitialized) return;
    
    const searchInput = getElement(CLIENT_SEARCH_ID);
    const dropdown = getElement(CLIENT_DROPDOWN_ID);
    const clearBtn = getElement(CLIENT_CLEAR_BTN_ID);
    
    if (!searchInput || !dropdown) return;
    
    // Input event - filter as user types
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value;
        searchInput.classList.remove('has-selection');
        
        // Clear hidden input when user modifies search
        const hiddenInput = getElement(CLIENT_SELECT_ID);
        if (hiddenInput) {
            hiddenInput.value = '';
        }
        
        if (clearBtn) {
            clearBtn.classList.toggle('hidden', !query);
        }
        
        const filtered = filterClientes(query);
        selectedClientIndex = -1;
        renderDropdown(filtered, query);
    });
    
    // Focus event - show dropdown
    searchInput.addEventListener('focus', () => {
        const query = searchInput.value;
        if (!searchInput.classList.contains('has-selection')) {
            const filtered = filterClientes(query);
            renderDropdown(filtered, query);
        }
    });
    
    // Keyboard navigation
    searchInput.addEventListener('keydown', (e) => {
        const items = dropdown.querySelectorAll('.cliente-dropdown-item');
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedClientIndex = Math.min(selectedClientIndex + 1, items.length - 1);
            updateDropdownSelection(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedClientIndex = Math.max(selectedClientIndex - 1, 0);
            updateDropdownSelection(items);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedClientIndex >= 0 && items[selectedClientIndex]) {
                const clientKey = items[selectedClientIndex].dataset.clienteKey;
                selectClient(clientKey);
            }
        } else if (e.key === 'Escape') {
            hideDropdown();
        }
    });
    
    // Click on dropdown item
    dropdown.addEventListener('click', (e) => {
        const item = e.target.closest('.cliente-dropdown-item');
        if (item) {
            const clientKey = item.dataset.clienteKey;
            selectClient(clientKey);
        }
    });
    
    // Clear button
    if (clearBtn) {
        clearBtn.addEventListener('click', (e) => {
            e.preventDefault();
            clearClientSelection();
        });
    }
    
    // Click outside to close
    document.addEventListener('click', (e) => {
        const container = getElement(CLIENT_CONTAINER_ID);
        if (container && !container.contains(e.target)) {
            hideDropdown();
        }
    });
    
    clientAutocompleteInitialized = true;
}

function updateDropdownSelection(items) {
    items.forEach((item, index) => {
        item.classList.toggle('selected', index === selectedClientIndex);
        if (index === selectedClientIndex) {
            item.scrollIntoView({ block: 'nearest' });
        }
    });
}

function populateClientSelect(clientes = []) {
    // Store clients for autocomplete
    clientesListCache = Array.isArray(clientes) ? clientes : [];
    
    // Clear and rebuild the data map
    clienteDataMap.clear();
    clientesListCache.forEach((cliente, index) => {
        if (!cliente || typeof cliente !== 'object') return;
        const clientKey = `softener-cliente-${index}`;
        clienteDataMap.set(clientKey, createClientDetails(cliente));
    });
    
    // Initialize autocomplete if not already done
    initializeClientAutocomplete();
    
    // If there was a previous selection, try to restore it
    const hiddenInput = getElement(CLIENT_SELECT_ID);
    const searchInput = getElement(CLIENT_SEARCH_ID);
    
    if (hiddenInput && hiddenInput.value && searchInput) {
        // Find the client by ID
        const existingClient = clientesListCache.find(c => {
            const id = extractClientId(c) || extractClientName(c);
            return id === hiddenInput.value;
        });
        
        if (existingClient) {
            searchInput.value = extractClientName(existingClient);
            searchInput.classList.add('has-selection');
            const clearBtn = getElement(CLIENT_CLEAR_BTN_ID);
            if (clearBtn) clearBtn.classList.remove('hidden');
        }
    }
}

async function loadClientes(obtenerClientesFn) {
    if (clientesLoaded) {
        return;
    }

    if (clientesLoadingPromise) {
        await clientesLoadingPromise;
        return;
    }

    if (typeof obtenerClientesFn !== 'function') {
        return;
    }

    clientesLoadingPromise = (async () => {
        let retries = 3;
        let delay = 500;
        
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const clientes = await obtenerClientesFn({ forceRefresh: false });
                populateClientSelect(clientes);
                clientesLoaded = true;
                return; // Éxito, salir
            } catch (error) {
                console.warn(`Intento ${attempt}/${retries} de cargar clientes falló:`, error);
                
                if (attempt < retries) {
                    // Esperar antes del próximo intento
                    await new Promise(resolve => setTimeout(resolve, delay));
                    delay *= 2; // Incrementar delay exponencialmente
                } else {
                    // Último intento falló, mostrar error
                    console.error('Error al cargar clientes para ablandador después de varios intentos:', error);
                    populateClientSelect([]);
                    // No mostrar alert para mejor UX - los campos siguen siendo editables
                }
            }
        }
        clientesLoadingPromise = null;
    })();

    await clientesLoadingPromise;
}

function setDefaultServiceDate() {
    const dateInput = getElement('softener-fecha-servicio');
    if (dateInput instanceof HTMLInputElement && !dateInput.value) {
        const today = new Date();
        const iso = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 10);
        dateInput.value = iso;
    }
}

function setDefaultResinVolume() {
    const volumenInput = getElement(VOLUMEN_RESINA_ID);
    if (volumenInput instanceof HTMLInputElement && !volumenInput.value) {
        volumenInput.value = '25';
    }
}

function normalizeDateValue(value) {
    if (!value) {
        return '';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }
    const iso = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 10);
    return iso;
}

function buildSection(entries) {
    const section = {};
    entries.forEach(([key, value, options]) => {
        const includeEmpty = Boolean(options && options.includeEmpty);
        if (value === undefined) {
            return;
        }
        if (value === '' && !includeEmpty) {
            return;
        }
        if (value === null && !includeEmpty) {
            return;
        }
        section[key] = value;
    });
    return section;
}

function setElementDisabled(id, disabled) {
    const el = getElement(id);
    if (!el) return;
    if ('disabled' in el) el.disabled = Boolean(disabled);
}

function updateCabezalFrequencyState() {
    // Mostrar/habilitar la frecuencia sólo si en la Sección B se seleccionó 'Por Tiempo'
    const tipo = getInputValue(SECCION_B_TIPO_REGENERACION_ID);
    const enabled = tipo === 'Por Tiempo';

    // ocultar/mostrar todo el contenedor de frecuencia
    const container = getElement(CABEZAL_FRECUENCIA_CONTAINER_ID);
    if (container && container.style) {
        container.style.display = enabled ? '' : 'none';
    }

    // controlar disabled de los inputs también por seguridad
    setElementDisabled(CABEZAL_FRECUENCIA_DIAS_FOUND_ID, !enabled);
    setElementDisabled(CABEZAL_FRECUENCIA_DIAS_LEFT_ID, !enabled);

    // si quedó deshabilitado, limpiamos valores
    if (!enabled) {
        const ef = getElement(CABEZAL_FRECUENCIA_DIAS_FOUND_ID);
        if (ef && 'value' in ef) ef.value = '';
        const el = getElement(CABEZAL_FRECUENCIA_DIAS_LEFT_ID);
        if (el && 'value' in el) el.value = '';
    }
}

function attachCabezalListeners() {
    const tipoSeccionB = getElement(SECCION_B_TIPO_REGENERACION_ID);
    if (tipoSeccionB instanceof HTMLSelectElement) {
        tipoSeccionB.addEventListener('change', updateCabezalFrequencyState);
    }
}

// --- Popup de ayuda para Prefiltro ---
function hidePrefilterInfo() {
    const btn = getElement(PREFILTER_INFO_BTN_ID);
    const popup = getElement(PREFILTER_INFO_POPUP_ID);
    if (popup && popup.classList) popup.classList.add('hidden');
    if (btn) btn.setAttribute('aria-expanded', 'false');
    if (popup) popup.setAttribute('aria-hidden', 'true');
}

function showPrefilterInfo() {
    const btn = getElement(PREFILTER_INFO_BTN_ID);
    const popup = getElement(PREFILTER_INFO_POPUP_ID);
    if (popup && popup.classList) popup.classList.remove('hidden');
    if (btn) btn.setAttribute('aria-expanded', 'true');
    if (popup) popup.setAttribute('aria-hidden', 'false');
}

function attachPrefilterInfoListeners() {
    const btn = getElement(PREFILTER_INFO_BTN_ID);
    const popup = getElement(PREFILTER_INFO_POPUP_ID);

    if (!(btn instanceof HTMLButtonElement) || !popup) return;

    btn.addEventListener('click', event => {
        event.stopPropagation();
        const isHidden = popup.classList.contains('hidden');
        if (isHidden) {
            showPrefilterInfo();
        } else {
            hidePrefilterInfo();
        }
    });

    // Cerrar al hacer click fuera
    document.addEventListener('click', (ev) => {
        if (!popup.classList.contains('hidden')) {
            const target = ev.target;
            if (!(popup.contains(target) || btn.contains(target))) {
                hidePrefilterInfo();
            }
        }
    });

    // Esc para cerrar
    document.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape') {
            hidePrefilterInfo();
        }
    });
}

// ============================================================================
// TREN DE PREFILTRADO - Múltiples etapas de filtración
// ============================================================================

const PREFILTRO_OPTIONS = [
    { value: 'No Aplica', label: 'No Aplica' },
    { value: 'Particulas - Mini Blue (10"x2.5")', label: 'Partículas - Mini Blue (10"x2.5")' },
    { value: 'Particulas - XL (20"x2.5")', label: 'Partículas - XL (20"x2.5")' },
    { value: 'Particulas - Jumbo (10"x4.5")', label: 'Partículas - Jumbo (10"x4.5")' },
    { value: 'Particulas - Big Blue (20"x4.5")', label: 'Partículas - Big Blue (20"x4.5")' },
    { value: 'CAB - Mini Blue (10"x2.5")', label: 'CAB - Mini Blue (10"x2.5")' },
    { value: 'CAB - XL (20"x2.5")', label: 'CAB - XL (20"x2.5")' },
    { value: 'CAB - Jumbo (10"x4.5")', label: 'CAB - Jumbo (10"x4.5")' },
    { value: 'CAB - Big Blue (20"x4.5")', label: 'CAB - Big Blue (20"x4.5")' },
    { value: 'GAC - Mini Blue (10"x2.5")', label: 'GAC - Mini Blue (10"x2.5")' },
    { value: 'GAC - XL (20"x2.5")', label: 'GAC - XL (20"x2.5")' },
    { value: 'GAC - Jumbo (10"x4.5")', label: 'GAC - Jumbo (10"x4.5")' },
    { value: 'GAC - Big Blue (20"x4.5")', label: 'GAC - Big Blue (20"x4.5")' },
];

/**
 * Genera los selectores dinámicos para cada etapa del tren de prefiltrado
 */
function generarSelectoresEtapas(numEtapas) {
    const container = getElement(PREFILTRO_ETAPAS_CONTAINER_ID);
    if (!container) return;
    
    container.innerHTML = '';
    
    for (let i = 1; i <= numEtapas; i++) {
        const etapaDiv = document.createElement('div');
        etapaDiv.className = 'flex items-center gap-2';
        
        const label = document.createElement('label');
        label.className = 'text-xs font-medium text-gray-700 dark:text-gray-300 w-16 flex-shrink-0';
        label.textContent = `Etapa ${i}:`;
        label.setAttribute('for', `softener-prefiltro-etapa-${i}`);
        
        const select = document.createElement('select');
        select.id = `softener-prefiltro-etapa-${i}`;
        select.name = `prefiltro_etapa_${i}`;
        select.className = 'flex-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-1.5 text-sm text-gray-900 dark:text-gray-100 focus:border-emerald-500 focus:outline-none';
        
        PREFILTRO_OPTIONS.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            select.appendChild(option);
        });
        
        etapaDiv.appendChild(label);
        etapaDiv.appendChild(select);
        container.appendChild(etapaDiv);
    }
}

/**
 * Obtiene los valores de todas las etapas del tren
 */
function obtenerValoresTrenPrefiltrado() {
    const checkbox = getElement(PREFILTRO_TREN_CHECKBOX_ID);
    if (!checkbox || !checkbox.checked) {
        return null; // No es tren
    }
    
    const numEtapas = parseInt(getInputValue(PREFILTRO_ETAPAS_INPUT_ID)) || 0;
    const etapas = [];
    
    for (let i = 1; i <= numEtapas; i++) {
        const select = getElement(`softener-prefiltro-etapa-${i}`);
        if (select) {
            etapas.push({
                etapa: i,
                tipo: select.value
            });
        }
    }
    
    return {
        es_tren: true,
        num_etapas: numEtapas,
        etapas: etapas
    };
}

/**
 * Carga los valores del tren de prefiltrado desde la BD
 */
function cargarTrenPrefiltrado(trenData) {
    const checkbox = getElement(PREFILTRO_TREN_CHECKBOX_ID);
    const etapasInput = getElement(PREFILTRO_ETAPAS_INPUT_ID);
    const trenContainer = getElement(PREFILTRO_TREN_CONTAINER_ID);
    const simpleContainer = getElement(PREFILTRO_SIMPLE_CONTAINER_ID);
    
    if (!trenData || !trenData.es_tren) {
        // No es tren - mostrar selector simple
        if (checkbox) checkbox.checked = false;
        if (trenContainer) trenContainer.classList.add('hidden');
        if (simpleContainer) simpleContainer.classList.remove('hidden');
        return;
    }
    
    // Es tren - configurar
    if (checkbox) checkbox.checked = true;
    if (trenContainer) trenContainer.classList.remove('hidden');
    if (simpleContainer) simpleContainer.classList.add('hidden');
    
    if (etapasInput) {
        etapasInput.value = trenData.num_etapas || 2;
    }
    
    // Generar selectores y cargar valores
    generarSelectoresEtapas(trenData.num_etapas || 2);
    
    // Cargar valores de cada etapa
    if (trenData.etapas && Array.isArray(trenData.etapas)) {
        trenData.etapas.forEach(etapa => {
            const select = getElement(`softener-prefiltro-etapa-${etapa.etapa}`);
            if (select) {
                select.value = etapa.tipo;
            }
        });
    }
}

/**
 * Inicializa los listeners para el tren de prefiltrado
 */
function attachTrenPrefiltradoListeners() {
    const checkbox = getElement(PREFILTRO_TREN_CHECKBOX_ID);
    const etapasInput = getElement(PREFILTRO_ETAPAS_INPUT_ID);
    const trenContainer = getElement(PREFILTRO_TREN_CONTAINER_ID);
    const simpleContainer = getElement(PREFILTRO_SIMPLE_CONTAINER_ID);
    
    if (!checkbox) return;
    
    // Toggle tren on/off
    checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
            if (trenContainer) trenContainer.classList.remove('hidden');
            if (simpleContainer) simpleContainer.classList.add('hidden');
            // Generar selectores iniciales
            const numEtapas = parseInt(etapasInput?.value) || 2;
            generarSelectoresEtapas(numEtapas);
        } else {
            if (trenContainer) trenContainer.classList.add('hidden');
            if (simpleContainer) simpleContainer.classList.remove('hidden');
        }
        
        // Actualizar la sección de cambio de filtros en checklist
        updatePrefiltroCambioVisibility();
        
        // Marcar sección B como editada
        if (seccionBDesbloqueada) {
            seccionBEditada = true;
        }
    });
    
    // Cambio en número de etapas
    if (etapasInput) {
        etapasInput.addEventListener('change', () => {
            const numEtapas = parseInt(etapasInput.value) || 2;
            // Limitar entre 2 y 6
            const limitado = Math.max(2, Math.min(6, numEtapas));
            etapasInput.value = limitado;
            generarSelectoresEtapas(limitado);
            
            // Actualizar checkboxes de cambio de filtro después de generar selectores
            setTimeout(() => {
                generarCheckboxesCambioFiltroTren();
            }, 50);
            
            if (seccionBDesbloqueada) {
                seccionBEditada = true;
            }
        });
    }
}

function hideProtectionInfo() {
    const btn = getElement(PROTECTION_INFO_BTN_ID);
    const popup = getElement(PROTECTION_INFO_POPUP_ID);
    if (popup && popup.classList) popup.classList.add('hidden');
    if (btn) btn.setAttribute('aria-expanded', 'false');
    if (popup) popup.setAttribute('aria-hidden', 'true');
}

function showProtectionInfo() {
    const btn = getElement(PROTECTION_INFO_BTN_ID);
    const popup = getElement(PROTECTION_INFO_POPUP_ID);
    if (popup && popup.classList) popup.classList.remove('hidden');
    if (btn) btn.setAttribute('aria-expanded', 'true');
    if (popup) popup.setAttribute('aria-hidden', 'false');
}

function attachProtectionInfoListeners() {
    const btn = getElement(PROTECTION_INFO_BTN_ID);
    const popup = getElement(PROTECTION_INFO_POPUP_ID);

    if (!(btn instanceof HTMLButtonElement) || !popup) return;

    btn.addEventListener('click', event => {
        event.stopPropagation();
        const isHidden = popup.classList.contains('hidden');
        if (isHidden) {
            showProtectionInfo();
        } else {
            hideProtectionInfo();
        }
    });

    document.addEventListener('click', (ev) => {
        if (!popup.classList.contains('hidden')) {
            const target = ev.target;
            if (!(popup.contains(target) || btn.contains(target))) {
                hideProtectionInfo();
            }
        }
    });

    document.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape') {
            hideProtectionInfo();
        }
    });
}

// --- Manómetros: popup + state ---
function hideManometroInfo() {
    const btn = getElement(MANOMETRO_INFO_BTN_ID);
    const popup = getElement(MANOMETRO_INFO_POPUP_ID);
    if (popup && popup.classList) popup.classList.add('hidden');
    if (btn) btn.setAttribute('aria-expanded', 'false');
    if (popup) popup.setAttribute('aria-hidden', 'true');
}

function showManometroInfo() {
    const btn = getElement(MANOMETRO_INFO_BTN_ID);
    const popup = getElement(MANOMETRO_INFO_POPUP_ID);
    if (popup && popup.classList) popup.classList.remove('hidden');
    if (btn) btn.setAttribute('aria-expanded', 'true');
    if (popup) popup.setAttribute('aria-hidden', 'false');
}

function attachManometroInfoListeners() {
    const btn = getElement(MANOMETRO_INFO_BTN_ID);
    const popup = getElement(MANOMETRO_INFO_POPUP_ID);
    if (!(btn instanceof HTMLButtonElement) || !popup) return;

    btn.addEventListener('click', event => {
        event.stopPropagation();
        const isHidden = popup.classList.contains('hidden');
        if (isHidden) {
            showManometroInfo();
        } else {
            hideManometroInfo();
        }
    });

    document.addEventListener('click', (ev) => {
        if (!popup.classList.contains('hidden')) {
            const target = ev.target;
            if (!(popup.contains(target) || btn.contains(target))) {
                hideManometroInfo();
            }
        }
    });

    document.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape') {
            hideManometroInfo();
        }
    });
}

function hideAutonomiaRestanteInfo() {
    const popup = getElement(AUTONOMIA_RESTANTE_INFO_POPUP_ID);
    const btn = getElement(AUTONOMIA_RESTANTE_INFO_BTN_ID);
    if (popup && popup.classList) popup.classList.add('hidden');
    if (btn) btn.setAttribute('aria-expanded', 'false');
    if (popup) popup.setAttribute('aria-hidden', 'true');
}

function showAutonomiaRestanteInfo() {
    const popup = getElement(AUTONOMIA_RESTANTE_INFO_POPUP_ID);
    const btn = getElement(AUTONOMIA_RESTANTE_INFO_BTN_ID);
    if (popup && popup.classList) popup.classList.remove('hidden');
    if (btn) btn.setAttribute('aria-expanded', 'true');
    if (popup) popup.setAttribute('aria-hidden', 'false');
}

function attachAutonomiaRestanteInfoListeners() {
    const btn = getElement(AUTONOMIA_RESTANTE_INFO_BTN_ID);
    const popup = getElement(AUTONOMIA_RESTANTE_INFO_POPUP_ID);
    if (!(btn instanceof HTMLButtonElement) || !popup) return;

    btn.addEventListener('click', event => {
        event.stopPropagation();
        const isHidden = popup.classList.contains('hidden');
        if (isHidden) {
            showAutonomiaRestanteInfo();
        } else {
            hideAutonomiaRestanteInfo();
        }
    });

    document.addEventListener('click', (ev) => {
        if (!popup.classList.contains('hidden')) {
            const target = ev.target;
            if (!(popup.contains(target) || btn.contains(target))) {
                hideAutonomiaRestanteInfo();
            }
        }
    });

    document.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape') {
            hideAutonomiaRestanteInfo();
        }
    });
}

function updatePrefiltroCambioVisibility() {
    const prefiltroValue = getInputValue(PREFILTER_SELECT_ID);
    const section = getElement(PREFILTRACION_SECTION_ID);
    const containerSimple = getElement(CAMBIO_FILTRO_CONTAINER_ID);
    const containerTren = getElement(CAMBIO_FILTRO_TREN_CONTAINER_ID);
    const tipoFiltroInput = getElement(FILTRO_TIPO_INSTALADO_ID);
    const trenCheckbox = getElement(PREFILTRO_TREN_CHECKBOX_ID);
    
    // Verificar si está en modo tren
    const esTren = trenCheckbox instanceof HTMLInputElement && trenCheckbox.checked;
    
    // Mostrar toda la sección solo si hay prefiltro configurado (no vacío y no "No Aplica")
    const tienePrefiltro = prefiltroValue && prefiltroValue.trim() !== '' && prefiltroValue !== 'No Aplica';
    
    // Controlar visibilidad de toda la sección
    if (section) {
        if (tienePrefiltro) {
            section.classList.remove('hidden');
        } else {
            section.classList.add('hidden');
        }
    }
    
    // Si no hay prefiltro, ocultar ambos containers
    if (!tienePrefiltro) {
        if (containerSimple) containerSimple.classList.add('hidden');
        if (containerTren) containerTren.classList.add('hidden');
        // Limpiar campos cuando se oculta
        const checkCambio = getElement(CHECK_CAMBIO_FILTRO_ID);
        if (checkCambio instanceof HTMLInputElement) {
            checkCambio.checked = false;
        }
        updateDetalleCambioFiltro();
        return;
    }
    
    // Determinar qué container mostrar según modo
    if (esTren) {
        // Modo tren: ocultar simple, mostrar tren y generar checkboxes dinámicos
        if (containerSimple) containerSimple.classList.add('hidden');
        if (containerTren) {
            containerTren.classList.remove('hidden');
            generarCheckboxesCambioFiltroTren();
        }
    } else {
        // Modo simple: mostrar simple, ocultar tren
        if (containerSimple) {
            containerSimple.classList.remove('hidden');
            // Heredar el tipo de filtro configurado
            if (tipoFiltroInput) {
                tipoFiltroInput.value = prefiltroValue;
            }
        }
        if (containerTren) containerTren.classList.add('hidden');
    }
}

/**
 * Genera los checkboxes dinámicos para el cambio de filtros en modo tren
 * Basado en las etapas configuradas en la Sección B
 */
function generarCheckboxesCambioFiltroTren() {
    const etapasContainer = getElement(CAMBIO_FILTRO_TREN_ETAPAS_ID);
    if (!etapasContainer) return;
    
    // Obtener las etapas configuradas en Sección B
    const etapas = obtenerEtapasTrenConfiguradas();
    
    if (etapas.length === 0) {
        etapasContainer.innerHTML = `
            <p class="text-sm text-gray-500 dark:text-gray-400 italic">
                No hay etapas de tren configuradas en la Sección B
            </p>
        `;
        return;
    }
    
    // Generar checkboxes para cada etapa
    let html = '';
    etapas.forEach((etapa, index) => {
        const checkboxId = `softener-cambio-filtro-etapa-${index}`;
        html += `
            <label class="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-2 shadow-sm dark:border-gray-600 dark:bg-gray-800">
                <input type="checkbox" 
                       id="${checkboxId}" 
                       data-etapa-index="${index}"
                       data-etapa-nombre="${etapa}"
                       class="cambio-filtro-etapa-checkbox mt-1 h-5 w-5 rounded border-gray-300 text-amber-600 focus:ring-amber-500 dark:border-gray-500">
                <span class="text-sm text-gray-700 dark:text-gray-300">
                    <strong>Etapa ${index + 1}:</strong> ${etapa}
                </span>
            </label>
        `;
    });
    
    etapasContainer.innerHTML = html;
    
    // Agregar listeners a los checkboxes generados
    attachCambioFiltroTrenListeners();
}

/**
 * Obtiene las etapas de tren configuradas en la Sección B
 * @returns {string[]} Array con los nombres de las etapas
 */
function obtenerEtapasTrenConfiguradas() {
    const etapas = [];
    const selectoresEtapas = document.querySelectorAll('#' + PREFILTRO_ETAPAS_CONTAINER_ID + ' select');
    
    selectoresEtapas.forEach((select) => {
        if (select instanceof HTMLSelectElement && select.value) {
            etapas.push(select.value);
        }
    });
    
    return etapas;
}

/**
 * Agrega listeners a los checkboxes de cambio de filtro en modo tren
 */
function attachCambioFiltroTrenListeners() {
    const checkboxes = document.querySelectorAll('.cambio-filtro-etapa-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            updateDetalleCambioFiltroTren();
        });
    });
}

/**
 * Actualiza la visibilidad del detalle de lotes/series para modo tren
 * Solo muestra los inputs de lote para las etapas que tienen checkbox marcado
 */
function updateDetalleCambioFiltroTren() {
    const detalleContainer = getElement(DETALLE_CAMBIO_FILTRO_TREN_ID);
    const lotesContainer = getElement(LOTES_TREN_CONTAINER_ID);
    
    if (!detalleContainer || !lotesContainer) return;
    
    // Obtener checkboxes marcados
    const checkboxesMarcados = document.querySelectorAll('.cambio-filtro-etapa-checkbox:checked');
    
    if (checkboxesMarcados.length === 0) {
        detalleContainer.classList.add('hidden');
        lotesContainer.innerHTML = '';
        return;
    }
    
    // Mostrar container de detalle
    detalleContainer.classList.remove('hidden');
    
    // Generar inputs de lote/serie para cada etapa marcada
    let html = '';
    checkboxesMarcados.forEach((checkbox) => {
        if (checkbox instanceof HTMLInputElement) {
            const index = checkbox.dataset.etapaIndex;
            const nombre = checkbox.dataset.etapaNombre;
            const inputId = `softener-lote-etapa-${index}`;
            
            html += `
                <div class="flex flex-col sm:flex-row sm:items-center gap-2">
                    <label class="text-xs font-medium text-gray-600 dark:text-gray-400 min-w-[120px]">
                        Etapa ${parseInt(index) + 1} (${nombre}):
                    </label>
                    <input type="text" 
                           id="${inputId}" 
                           data-etapa-index="${index}"
                           class="lote-etapa-input flex-1 rounded-md border border-gray-300 bg-white p-2 text-sm text-gray-900 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-amber-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" 
                           placeholder="Lote o serie del filtro">
                </div>
            `;
        }
    });
    
    lotesContainer.innerHTML = html;
}

/**
 * Obtiene los datos del cambio de filtros para modo tren
 * @returns {Object} Objeto con los datos del cambio de filtros en modo tren
 */
function obtenerDatosCambioFiltroTren() {
    const trenCheckbox = getElement(PREFILTRO_TREN_CHECKBOX_ID);
    const esTren = trenCheckbox instanceof HTMLInputElement && trenCheckbox.checked;
    
    if (!esTren) {
        return null;
    }
    
    const etapas = obtenerEtapasTrenConfiguradas();
    const filtrosCambiados = [];
    
    // Obtener checkboxes marcados
    const checkboxes = document.querySelectorAll('.cambio-filtro-etapa-checkbox:checked');
    
    checkboxes.forEach((checkbox) => {
        if (checkbox instanceof HTMLInputElement) {
            const index = parseInt(checkbox.dataset.etapaIndex || '0', 10);
            const nombre = checkbox.dataset.etapaNombre || '';
            
            // Buscar el input de lote correspondiente
            const loteInput = document.getElementById(`softener-lote-etapa-${index}`);
            const lote = loteInput instanceof HTMLInputElement ? loteInput.value : '';
            
            filtrosCambiados.push({
                etapa: index + 1,
                tipo: nombre,
                lote_serie: lote
            });
        }
    });
    
    return {
        es_tren: true,
        total_etapas: etapas.length,
        etapas_configuradas: etapas,
        filtros_cambiados: filtrosCambiados
    };
}

function updateDetalleCambioFiltro() {
    const checkCambio = getElement(CHECK_CAMBIO_FILTRO_ID);
    const detalleContainer = getElement(DETALLE_CAMBIO_FILTRO_ID);
    
    if (!detalleContainer) return;
    
    const isChecked = checkCambio instanceof HTMLInputElement && checkCambio.checked;
    
    if (isChecked) {
        detalleContainer.classList.remove('hidden');
    } else {
        detalleContainer.classList.add('hidden');
        // Limpiar campo de lote/serie cuando se oculta
        const loteSerieInput = getElement(FILTRO_LOTE_SERIE_ID);
        if (loteSerieInput instanceof HTMLInputElement) {
            loteSerieInput.value = '';
        }
    }
}

function attachPrefiltroCambioListeners() {
    // Listener para cambios en el select de prefiltro
    const prefiltroSelect = getElement(PREFILTER_SELECT_ID);
    if (prefiltroSelect instanceof HTMLSelectElement) {
        prefiltroSelect.addEventListener('change', () => {
            updatePrefiltroCambioVisibility();
        });
    }
    
    // Listener para el checkbox de "¿Realizó cambio de filtro?" (modo simple)
    const checkCambio = getElement(CHECK_CAMBIO_FILTRO_ID);
    if (checkCambio instanceof HTMLInputElement) {
        checkCambio.addEventListener('change', () => {
            updateDetalleCambioFiltro();
        });
    }
    
    // Listener para cambios en el checkbox "Tren" de Sección B
    const trenCheckbox = getElement(PREFILTRO_TREN_CHECKBOX_ID);
    if (trenCheckbox instanceof HTMLInputElement) {
        trenCheckbox.addEventListener('change', () => {
            updatePrefiltroCambioVisibility();
        });
    }
    
    // Listener para cambios en la cantidad de etapas del tren
    const etapasInput = getElement(PREFILTRO_ETAPAS_INPUT_ID);
    if (etapasInput instanceof HTMLInputElement) {
        etapasInput.addEventListener('change', () => {
            // Pequeño delay para que se generen los selectores primero
            setTimeout(() => {
                updatePrefiltroCambioVisibility();
            }, 100);
        });
    }
    
    // Observer para detectar cambios en los selectores de etapas del tren
    const etapasContainer = getElement(PREFILTRO_ETAPAS_CONTAINER_ID);
    if (etapasContainer) {
        // Usar MutationObserver para detectar cuando se agregan/cambian selectores
        const observer = new MutationObserver(() => {
            // Actualizar los checkboxes de cambio de filtro cuando cambian las etapas
            const trenCheckbox = getElement(PREFILTRO_TREN_CHECKBOX_ID);
            if (trenCheckbox instanceof HTMLInputElement && trenCheckbox.checked) {
                setTimeout(() => {
                    generarCheckboxesCambioFiltroTren();
                }, 100);
            }
        });
        
        observer.observe(etapasContainer, { childList: true, subtree: true });
        
        // También agregar listener de cambio a los selectores existentes
        etapasContainer.addEventListener('change', (e) => {
            if (e.target instanceof HTMLSelectElement) {
                generarCheckboxesCambioFiltroTren();
            }
        });
    }
}

function updateManometroState() {
    const val = getInputValue(MANOMETRO_SELECT_ID);
    
    // Solo mostrar sección y campos de presión si tiene "Manómetros IN / OUT"
    const showPressure = val === 'Manómetros IN / OUT';
    
    // Controlar visibilidad de toda la sección de presiones
    const presionesSection = getElement('softener-presiones-section');
    if (presionesSection) {
        if (showPressure) {
            presionesSection.classList.remove('hidden');
        } else {
            presionesSection.classList.add('hidden');
        }
    }
    
    const containerIds = [
        'softener-presion-entrada-found-container',
        'softener-presion-salida-found-container',
        'softener-deltaP-found-container',
        'softener-presion-entrada-left-container',
        'softener-presion-salida-left-container',
        'softener-deltaP-left-container'
    ];
    
    containerIds.forEach(id => {
        const container = getElement(id);
        if (container && container.style) {
            container.style.display = showPressure ? '' : 'none';
        }
    });
    
    // Si ocultamos, limpiamos valores
    if (!showPressure) {
        const inputIds = [
            'softener-presion-entrada-as-found',
            'softener-presion-salida-as-found',
            'softener-presion-entrada-as-left',
            'softener-presion-salida-as-left'
        ];
        inputIds.forEach(id => {
            const el = getElement(id);
            if (el && 'value' in el) el.value = '';
        });
        // Limpiar badges deltaP
        clearDeltaBadge('softener-deltaP-found');
        clearDeltaBadge('softener-deltaP-left');
    }
}

function attachManometroListeners() {
    const select = getElement(MANOMETRO_SELECT_ID);
    if (select instanceof HTMLSelectElement) {
        select.addEventListener('change', updateManometroState);
    }
    // inicializar estado según valor por defecto
    updateManometroState();
}

// --- DeltaP (presión diferencial) ---
function formatBar(value) {
    if (value === null || value === undefined || Number.isNaN(value)) return '--';
    return `${Number(value).toFixed(2)} bar`;
}

function clearDeltaBadge(id) {
    const el = getElement(id);
    if (!el) return;
    el.textContent = '--';
    el.className = 'inline-block rounded-full px-4 py-2 text-sm font-semibold bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100';
}

function setDeltaBadge(id, value, level) {
    // level: 'green' | 'yellow' | 'red' | 'neutral'
    const el = getElement(id);
    if (!el) return;
    if (value === null || value === undefined || Number.isNaN(value)) {
        clearDeltaBadge(id);
        return;
    }
    el.textContent = formatBar(value);

    // reset to base then add color
    const base = 'inline-block rounded-full px-4 py-2 text-sm font-semibold';
    let classes = base;
    switch (level) {
        case 'green':
            classes += ' bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100';
            break;
        case 'yellow':
            classes += ' bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100';
            break;
        case 'red':
            classes += ' bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100';
            break;
        default:
            classes += ' bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100';
    }
    el.className = classes;
}

function updateDeltaP() {
    const entradaFound = getNumberValue('softener-presion-entrada-as-found');
    const salidaFound = getNumberValue('softener-presion-salida-as-found');
    const entradaLeft = getNumberValue('softener-presion-entrada-as-left');
    const salidaLeft = getNumberValue('softener-presion-salida-as-left');

    // compute delta = entrada - salida (positive when entrada > salida). Use absolute value for coloring.
    const deltaFound = (entradaFound === null || salidaFound === null) ? null : Math.abs(entradaFound - salidaFound);
    const deltaLeft = (entradaLeft === null || salidaLeft === null) ? null : Math.abs(entradaLeft - salidaLeft);

    // thresholds: <0.3 green, 0.3-0.5 yellow, >=0.5 red
    function levelFor(delta) {
        if (delta === null) return 'neutral';
        if (delta < 0.3) return 'green';
        if (delta < 0.5) return 'yellow';
        return 'red';
    }

    if (deltaFound === null) {
        clearDeltaBadge('softener-deltaP-found');
    } else {
        setDeltaBadge('softener-deltaP-found', deltaFound, levelFor(deltaFound));
    }

    if (deltaLeft === null) {
        clearDeltaBadge('softener-deltaP-left');
    } else {
        setDeltaBadge('softener-deltaP-left', deltaLeft, levelFor(deltaLeft));
    }
}

function attachDeltaPListeners() {
    const ids = [
        'softener-presion-entrada-as-found',
        'softener-presion-entrada-as-left',
        'softener-presion-salida-as-found',
        'softener-presion-salida-as-left'
    ];
    ids.forEach(id => {
        const el = getElement(id);
        if (el instanceof HTMLInputElement) {
            el.addEventListener('input', updateDeltaP);
        }
    });
    // initialize
    updateDeltaP();
}

function resetCabezalSection() {
    // establecer valores por defecto y estado inicial
    // Hora actual del cabezal (As Found) -> ahora (HH:MM)
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const nowTime = `${hh}:${mm}`;

    const horaFound = getElement(CABEZAL_HORA_CABEZAL_FOUND_ID);
    if (horaFound && 'value' in horaFound) horaFound.value = nowTime;


    // Aplicar los mismos defaults también a As Left (según requerimiento)
    const horaLeft = getElement(CABEZAL_HORA_CABEZAL_LEFT_ID);
    if (horaLeft && 'value' in horaLeft) horaLeft.value = nowTime;

    // Hora de regeneración por defecto 02:00
    const regenFound = getElement(CABEZAL_HORA_REGENERACION_FOUND_ID);
    if (regenFound && 'value' in regenFound) regenFound.value = '02:00';
    const regenLeft = getElement(CABEZAL_HORA_REGENERACION_LEFT_ID);
    if (regenLeft && 'value' in regenLeft) regenLeft.value = '02:00';

    // Ciclos por defecto
    const defaults = {
        [CABEZAL_P1_FOUND_ID]: '15',
        [CABEZAL_P2_FOUND_ID]: '60',
        [CABEZAL_P3_FOUND_ID]: '10',
        [CABEZAL_P4_FOUND_ID]: '5',
        [CABEZAL_P1_LEFT_ID]: '15',
        [CABEZAL_P2_LEFT_ID]: '60',
        [CABEZAL_P3_LEFT_ID]: '10',
        [CABEZAL_P4_LEFT_ID]: '5',
    };
    Object.keys(defaults).forEach(id => {
        const el = getElement(id);
        if (el && 'value' in el) el.value = defaults[id];
    });

    // frecuencia por defecto vacía y estado según Sección B
    updateCabezalFrequencyState();
}

function autoFillSoftenerForm() {
    // Datos de clientes de ejemplo
    const clientes = [
        'Industria La Plata S.A.',
        'Laboratorio Farmacéutico del Norte',
        'Hotel & Spa Las Termas',
        'Edificio Residencial Torres del Mar',
        'Complejo Deportivo Municipal'
    ];
    const direcciones = [
        'Av. Principal 1234',
        'Calle Independencia 567',
        'Boulevard San Martín 890',
        'Ruta Nacional 9 Km 45',
        'Parque Industrial Sector B'
    ];
    const localidades = [
        'La Plata, Buenos Aires',
        'Rosario, Santa Fe',
        'Córdoba Capital',
        'Mendoza, Mendoza',
        'Mar del Plata, Buenos Aires'
    ];
    
    const idx = Math.floor(Math.random() * clientes.length);
    
    // Sección A - Cliente y Servicio
    // El campo cliente ahora es un autocomplete
    const clienteValue = clientes[idx];
    const searchInput = getElement(CLIENT_SEARCH_ID);
    const hiddenInput = getElement(CLIENT_SELECT_ID);
    const clearBtn = getElement(CLIENT_CLEAR_BTN_ID);
    
    if (searchInput) {
        searchInput.value = clienteValue;
        searchInput.classList.add('has-selection');
    }
    if (hiddenInput) {
        hiddenInput.value = clienteValue;
    }
    if (clearBtn) {
        clearBtn.classList.remove('hidden');
    }
    
    setInputValue('softener-cliente-direccion', direcciones[idx]);
    setInputValue('softener-cliente-localidad', localidades[idx]);
    setInputValue('softener-cliente-contacto', 'Juan Pérez');
    setInputValue('softener-cliente-telefono', '011-4567-8900');
    setInputValue('softener-cliente-email', 'contacto@cliente.com.ar');
    setInputValue('softener-cliente-cuit', '30-12345678-9');
    
    // Fecha de servicio: hoy
    const today = new Date().toISOString().split('T')[0];
    setInputValue('softener-fecha-servicio', today);
    
    // Técnico responsable (es un input text, no select)
    const tecnicos = ['Carlos Rodríguez', 'Miguel Fernández', 'Roberto García', 'Fernando López'];
    setInputValue('softener-tecnico', tecnicos[Math.floor(Math.random() * tecnicos.length)]);
    
    // Sección B - Equipo
    const tipos = ['Todo en uno', 'Custom', 'Industrial'];
    const modelos = ['ECO-SOFT-50', 'ULTRA-SOFT-75', 'DUPLEX-SOFT-100', 'PREMIUM-SOFT-60'];
    const ubicaciones = ['Lavadero', 'Patio', 'Terraza', 'Gabinete', 'Sala de Máquinas'];
    
    setSelectValue('softener-equipo-tipo', tipos[Math.floor(Math.random() * tipos.length)]);
    setInputValue('softener-equipo-modelo', modelos[Math.floor(Math.random() * modelos.length)]);
    setInputValue('softener-equipo-numero-serie', 'ABL-2024-' + Math.floor(Math.random() * 9000 + 1000));
    setSelectValue('softener-equipo-ubicacion', ubicaciones[Math.floor(Math.random() * ubicaciones.length)]);
    setInputValue(VOLUMEN_RESINA_ID, (Math.floor(Math.random() * 8) + 3) * 10); // 30-100L
    
    setSelectValue(SECCION_B_TIPO_REGENERACION_ID, Math.random() > 0.5 ? 'Por Volumen' : 'Por Tiempo');
    
    // Prefiltro con opciones variadas
    const prefiltros = [
        'No Aplica',
        'Particulas - Mini Blue (10"x2.5")',
        'Particulas - XL (20"x2.5")',
        'CAB - Mini Blue (10"x2.5")',
        'CAB - Jumbo (10"x4.5")',
        'GAC - Mini Blue (10"x2.5")'
    ];
    setSelectValue(PREFILTER_SELECT_ID, prefiltros[Math.floor(Math.random() * prefiltros.length)]);
    
    // Protección de entrada
    const protecciones = ['No Aplica', 'Sin Protección', 'VRP', 'VA', 'VRP + VA'];
    setSelectValue(PROTECCION_ENTRADA_ID, protecciones[Math.floor(Math.random() * protecciones.length)]);
    
    // Manómetros - valores correctos según el HTML
    const manometrosOpciones = ['No cuenta con manómetros', 'Manómetro IN', 'Manómetros IN / OUT'];
    setSelectValue(MANOMETRO_SELECT_ID, manometrosOpciones[Math.floor(Math.random() * manometrosOpciones.length)]);
    
    setInputValue('softener-equipo-notas', 'Equipo en operación normal. Sin novedades reportadas.');
    
    // Sección C - Parámetros
    const durezaValues = [450, 520, 680, 750, 820, 550, 620];
    setInputValue(DUREZA_AGUA_CRUDA_ID, durezaValues[Math.floor(Math.random() * durezaValues.length)]);
    setInputValue(AUTONOMIA_RESTANTE_ID, Math.floor(Math.random() * 200) + 50);
    setInputValue(AUTONOMIA_SETEO_ACTUAL_ID, Math.floor(Math.random() * 150) + 100);
    
    const aplicarProteccion = Math.random() > 0.5;
    const checkProteccion = getElement(FACTOR_PROTECCION_ID);
    if (checkProteccion instanceof HTMLInputElement) {
        checkProteccion.checked = aplicarProteccion;
    }
    
    // Configuración del Cabezal
    const horaActual = new Date().toTimeString().slice(0, 5);
    setInputValue(CABEZAL_HORA_CABEZAL_FOUND_ID, horaActual);
    setInputValue(CABEZAL_HORA_CABEZAL_LEFT_ID, horaActual);
    setInputValue(CABEZAL_HORA_REGENERACION_FOUND_ID, '02:00');
    setInputValue(CABEZAL_HORA_REGENERACION_LEFT_ID, '02:00');
    
    setInputValue(CABEZAL_P1_FOUND_ID, 10);
    setInputValue(CABEZAL_P1_LEFT_ID, 10);
    setInputValue(CABEZAL_P2_FOUND_ID, 60);
    setInputValue(CABEZAL_P2_LEFT_ID, 60);
    setInputValue(CABEZAL_P3_FOUND_ID, 10);
    setInputValue(CABEZAL_P3_LEFT_ID, 10);
    setInputValue(CABEZAL_P4_FOUND_ID, 5);
    setInputValue(CABEZAL_P4_LEFT_ID, 5);
    
    // Frecuencia solo si "Por Tiempo"
    const tipoRegen = getInputValue(SECCION_B_TIPO_REGENERACION_ID);
    if (tipoRegen === 'Por Tiempo') {
        setInputValue(CABEZAL_FRECUENCIA_DIAS_FOUND_ID, Math.floor(Math.random() * 5) + 2);
        setInputValue(CABEZAL_FRECUENCIA_DIAS_LEFT_ID, Math.floor(Math.random() * 5) + 2);
    }
    
    // Sección D - Checklist
    setCheckboxValue('softener-check-fugas', Math.random() > 0.8);
    
    // Cambio de filtro
    const cambioFiltro = Math.random() > 0.6;
    setCheckboxValue(CHECK_CAMBIO_FILTRO_ID, cambioFiltro);
    if (cambioFiltro) {
        const prefiltroValue = getInputValue(PREFILTER_SELECT_ID);
        setInputValue(FILTRO_TIPO_INSTALADO_ID, prefiltroValue);
        setInputValue(FILTRO_LOTE_SERIE_ID, 'LOTE-' + Math.floor(Math.random() * 9000 + 1000));
    }
    
    setCheckboxValue('softener-check-limpieza-tanque', Math.random() > 0.7);
    setCheckboxValue('softener-check-nivel-agua', Math.random() > 0.3);
    setCheckboxValue('softener-check-carga-sal', Math.random() > 0.4);
    setCheckboxValue('softener-check-hora-correcta', Math.random() > 0.2);
    setCheckboxValue('softener-check-parametros-ciclo', Math.random() > 0.3);
    setCheckboxValue('softener-check-ajuste-autonomia', Math.random() > 0.5);
    setCheckboxValue('softener-check-regeneracion-manual', Math.random() > 0.8);
    
    setInputValue('softener-check-otros', '');
    setInputValue('softener-check-observaciones', 'Sistema funcionando correctamente. Parámetros dentro de rango normal.');
    
    // Sección E - Resumen
    const trabajos = [
        'Mantenimiento preventivo completo. Verificación de ciclos y parámetros.',
        'Cambio de prefiltro y ajuste de autonomía según dureza detectada.',
        'Servicio de rutina. Carga de sal y limpieza de tanque salero.',
        'Calibración de cabezal y verificación de presiones del sistema.'
    ];
    setInputValue('softener-resumen-trabajo', trabajos[Math.floor(Math.random() * trabajos.length)]);
    
    const recomendaciones = [
        'Monitorear dureza de salida semanalmente.',
        'Verificar nivel de sal mensualmente.',
        'Próximo mantenimiento en 6 meses o según autonomía.',
        'Controlar presiones de entrada periódicamente.'
    ];
    setInputValue('softener-resumen-recomendaciones', recomendaciones[Math.floor(Math.random() * recomendaciones.length)]);
    
    // Próximo servicio: 6 meses
    const nextService = new Date();
    nextService.setMonth(nextService.getMonth() + 6);
    setInputValue('softener-resumen-proximo-servicio', nextService.toISOString().split('T')[0]);
    
    setInputValue('softener-resumen-materiales', 'Sal pellets x 25kg, Cartucho prefiltro 5µm');
    setInputValue('softener-resumen-notas-cliente', 'Cliente conforme con el servicio realizado.');
    
    // Sección F - Condiciones de Operación
    const manometros = getInputValue(MANOMETRO_SELECT_ID);
    if (manometros === 'Manómetros IN/OUT') {
        setInputValue('softener-presion-entrada-as-found', (Math.random() * 2 + 2).toFixed(2));
        setInputValue('softener-presion-entrada-as-left', (Math.random() * 2 + 2).toFixed(2));
        setInputValue('softener-presion-salida-as-found', (Math.random() * 1.5 + 1.5).toFixed(2));
        setInputValue('softener-presion-salida-as-left', (Math.random() * 1.5 + 1.5).toFixed(2));
    }
    
    setSelectValue('softener-nivel-sal-as-found', ['Adecuado', 'Bajo', 'Alto'][Math.floor(Math.random() * 3)]);
    setSelectValue('softener-nivel-sal-as-left', 'Adecuado');
    setSelectValue('softener-temperatura-ambiente', ['Controlada', 'Alta (>30°C)', 'Variable'][Math.floor(Math.random() * 3)]);
    setSelectValue('softener-estado-gabinete', ['Óptimo', 'Bueno', 'Regular'][Math.floor(Math.random() * 3)]);
    
    setInputValue('softener-param-test-cloro-found', (Math.random() * 2).toFixed(2));
    setInputValue('softener-param-test-cloro-left', (Math.random() * 2).toFixed(2));
    setInputValue('softener-param-dureza-salida-found', Math.floor(Math.random() * 30));
    setInputValue('softener-param-dureza-salida-left', Math.floor(Math.random() * 20));
    
    setInputValue('softener-condiciones-observaciones', 'Ambiente controlado. Sin exposición a humedad excesiva.');
    
    // Sección G - Cierre
    setSelectValue('softener-conformidad-cliente', ['Conforme', 'Con observaciones'][Math.floor(Math.random() * 2)]);
    setInputValue('softener-representante-cliente', 'Responsable de Mantenimiento');
    setSelectValue('softener-medio-confirmacion', ['Firma en sitio', 'Correo electrónico'][Math.floor(Math.random() * 2)]);
    setCheckboxValue('softener-requiere-seguimiento', Math.random() > 0.7);
    setInputValue('softener-observaciones-finales', 'Servicio completado satisfactoriamente.');
    
    // Actualizar cálculos
    updateAutonomia();
    updateCabezalFrequencyState();
    updatePrefiltroCambioVisibility();
    updateManometroState();
    updateDeltaP('found');
    updateDeltaP('left');
}

function collectFormData() {
    const reportNumber = generateSoftenerReportNumber();
    const { id: clientId, name: clientName } = getClientSelection();

    const metadata = {
        formulario: 'mantenimiento_ablandador',
        version: '3.1',
        generado_en: new Date().toISOString(),
        numero_reporte: reportNumber,
    };

    const seccionA = buildSection([
        ['nombre', clientName],
        ['direccion', getInputValue('softener-cliente-direccion')],
        ['localidad', getInputValue('softener-cliente-localidad')],
        ['contacto', getInputValue('softener-cliente-contacto')],
        ['telefono', getInputValue('softener-cliente-telefono')],
        ['email', getInputValue('softener-cliente-email')],
        ['cuit', getInputValue('softener-cliente-cuit')],
        ['fecha_servicio', normalizeDateValue(getInputValue('softener-fecha-servicio'))],
        ['tecnico', getInputValue('softener-tecnico')],
    ]);

    const volumenResina = getNumberValue(VOLUMEN_RESINA_ID);
    const durezaAguaCruda = getNumberValue(DUREZA_AGUA_CRUDA_ID);
    const autonomiaRestante = getNumberValue(AUTONOMIA_RESTANTE_ID);
    const autonomiaRecomendada = getNumberValue(AUTONOMIA_RECOMENDADA_ID);
    const seteoActualAutonomia = getNumberValue(AUTONOMIA_SETEO_ACTUAL_ID);
    const aplicarProteccion = getCheckboxValue(FACTOR_PROTECCION_ID);
    const autonomiaAjustada = getCheckboxValue(AUTONOMIA_AJUSTADA_ID);

    const presionEntradaAsFound = getNumberValue('softener-param-presion-entrada-found');
    const presionEntradaAsLeft = getNumberValue('softener-param-presion-entrada-left');
    const testCloroAsFound = getNumberValue('softener-param-test-cloro-found');
    const testCloroAsLeft = getNumberValue('softener-param-test-cloro-left');
    const durezaSalidaAsFound = getNumberValue('softener-param-dureza-salida-found');
    const durezaSalidaAsLeft = getNumberValue('softener-param-dureza-salida-left');

    // Obtener datos del tren de prefiltrado si está configurado
    const trenPrefiltradoConfig = obtenerValoresTrenPrefiltrado();

    const seccionB = buildSection([
        ['tipo', getInputValue('softener-equipo-tipo')],
        ['modelo', getInputValue('softener-equipo-modelo')],
        ['numero_serie', getInputValue('softener-equipo-numero-serie')],
        ['ubicacion', getInputValue('softener-equipo-ubicacion')],
        ['volumen_resina', volumenResina],
        ['notas_equipo', getInputValue('softener-equipo-notas')],
        ['tipo_regeneracion', getInputValue(SECCION_B_TIPO_REGENERACION_ID)],
        ['prefiltro', trenPrefiltradoConfig ? null : getInputValue('softener-equipo-prefiltro')],
        ['tren_prefiltrado', trenPrefiltradoConfig],
        ['proteccion_entrada', getInputValue(PROTECCION_ENTRADA_ID)],
        ['manometros', getInputValue(MANOMETRO_SELECT_ID)],
    ]);

    const seccionBParametrosOperacion = buildSection([
        ['presion_entrada_as_found', presionEntradaAsFound],
        ['presion_entrada_as_left', presionEntradaAsLeft],
        ['test_cloro_entrada_as_found', testCloroAsFound],
        ['test_cloro_entrada_as_left', testCloroAsLeft],
        ['dureza_salida_as_found', durezaSalidaAsFound],
        ['dureza_salida_as_left', durezaSalidaAsLeft],
    ]);

    const seccionC = buildSection([
        ['dureza_agua_cruda', durezaAguaCruda],
        ['autonomia_restante', autonomiaRestante],
        ['seteo_actual_autonomia', seteoActualAutonomia],
        ['aplicar_proteccion_20', aplicarProteccion],
        ['autonomia_recomendada', autonomiaRecomendada],
        ['autonomia_ajustada_valor_calculado', autonomiaAjustada],
    ]);

    // Obtener datos de cambio de filtro (modo simple o tren)
    const datosCambioFiltroTren = obtenerDatosCambioFiltroTren();
    const esTrenPrefiltrado = datosCambioFiltroTren !== null;
    
    const seccionD = buildSection([
        // Inspección General
        ['inspeccion_fugas', getCheckboxValue('softener-check-fugas')],
        // Sistema de Prefiltración - modo simple
        ['cambio_filtro_realizado', esTrenPrefiltrado ? false : getCheckboxValue(CHECK_CAMBIO_FILTRO_ID)],
        ['filtro_tipo_instalado', esTrenPrefiltrado ? '' : getInputValue(FILTRO_TIPO_INSTALADO_ID)],
        ['filtro_lote_serie', esTrenPrefiltrado ? '' : getInputValue(FILTRO_LOTE_SERIE_ID)],
        // Sistema de Prefiltración - modo tren
        ['tren_prefiltrado', datosCambioFiltroTren],
        // Tanque Salero
        ['limpieza_tanque_sal', getCheckboxValue('softener-check-limpieza-tanque')],
        ['verificacion_nivel_agua', getCheckboxValue('softener-check-nivel-agua')],
        ['carga_sal', getCheckboxValue('softener-check-carga-sal')],
        // Cabezal (Válvula)
        ['verificacion_hora', getCheckboxValue('softener-check-hora-correcta')],
        ['verificacion_parametros_ciclo', getCheckboxValue('softener-check-parametros-ciclo')],
        ['ajuste_autonomia', getCheckboxValue('softener-check-ajuste-autonomia')],
        ['regeneracion_manual', getCheckboxValue('softener-check-regeneracion-manual')],
        // Campos adicionales
        ['otros', getInputValue('softener-check-otros')],
        ['observaciones', getInputValue('softener-check-observaciones')],
    ]);

    const seccionE = buildSection([
        ['trabajo_realizado', getInputValue('softener-resumen-trabajo')],
        ['recomendaciones', getInputValue('softener-resumen-recomendaciones')],
        ['proximo_servicio', normalizeDateValue(getInputValue('softener-resumen-proximo-servicio'))],
        ['materiales', getInputValue('softener-resumen-materiales')],
        ['comentarios_cliente', getInputValue('softener-resumen-notas-cliente')],
    ]);

    const seccionF = buildSection([
        ['presion_entrada_as_found', getNumberValue('softener-presion-entrada-as-found')],
        ['presion_entrada_as_left', getNumberValue('softener-presion-entrada-as-left')],
        ['presion_salida_as_found', getNumberValue('softener-presion-salida-as-found')],
        ['presion_salida_as_left', getNumberValue('softener-presion-salida-as-left')],
        ['nivel_sal_as_found', getInputValue('softener-nivel-sal-as-found')],
        ['nivel_sal_as_left', getInputValue('softener-nivel-sal-as-left')],
        ['temperatura_ambiente', getInputValue('softener-temperatura-ambiente')],
        ['estado_gabinete', getInputValue('softener-estado-gabinete')],
        ['observaciones', getInputValue('softener-condiciones-observaciones')],
    ]);

    const seccionG = buildSection([
        ['conformidad_cliente', getInputValue('softener-conformidad-cliente')],
        ['representante_cliente', getInputValue('softener-representante-cliente')],
        ['medio_confirmacion', getInputValue('softener-medio-confirmacion')],
        ['requiere_seguimiento', getCheckboxValue('softener-requiere-seguimiento')],
        ['observaciones_finales', getInputValue('softener-observaciones-finales')],
    ]);

    const payload = {
        metadata,
        // Campos en nivel superior para compatibilidad con remito
        cliente: clientName,
        direccion: seccionA.direccion,
        cliente_telefono: seccionA.telefono,
        cliente_email: seccionA.email,
        cliente_cuit: seccionA.cuit,
        numero_reporte: reportNumber,
        // Secciones estructuradas
        seccion_A_cliente: { ...seccionA, id: clientId },
        seccion_B_equipo: seccionB,
        seccion_C_parametros: seccionC,
        seccion_D_checklist: seccionD,
        seccion_E_resumen: seccionE,
        seccion_F_condiciones: seccionF,
        seccion_G_cierre: seccionG,
    };

    if (Object.keys(seccionBParametrosOperacion).length > 0) {
        payload.seccion_B_parametros_operacion = seccionBParametrosOperacion;
    }

    const seccionCabezal = buildSection([
        ['hora_cabezal_as_found', getInputValue(CABEZAL_HORA_CABEZAL_FOUND_ID)],
        ['hora_cabezal_as_left', getInputValue(CABEZAL_HORA_CABEZAL_LEFT_ID)],
        ['hora_regeneracion_as_found', getInputValue(CABEZAL_HORA_REGENERACION_FOUND_ID)],
        ['hora_regeneracion_as_left', getInputValue(CABEZAL_HORA_REGENERACION_LEFT_ID)],

        ['p1_retrolavado_min_found', getNumberValue(CABEZAL_P1_FOUND_ID)],
        ['p1_retrolavado_min_left', getNumberValue(CABEZAL_P1_LEFT_ID)],
        ['p2_salmuera_min_found', getNumberValue(CABEZAL_P2_FOUND_ID)],
        ['p2_salmuera_min_left', getNumberValue(CABEZAL_P2_LEFT_ID)],
        ['p3_enjuague_min_found', getNumberValue(CABEZAL_P3_FOUND_ID)],
        ['p3_enjuague_min_left', getNumberValue(CABEZAL_P3_LEFT_ID)],
        ['p4_llenado_salero_min_found', getNumberValue(CABEZAL_P4_FOUND_ID)],
        ['p4_llenado_salero_min_left', getNumberValue(CABEZAL_P4_LEFT_ID)],
        ['frecuencia_dias_found', getNumberValue(CABEZAL_FRECUENCIA_DIAS_FOUND_ID)],
        ['frecuencia_dias_left', getNumberValue(CABEZAL_FRECUENCIA_DIAS_LEFT_ID)],
    ]);

    if (Object.keys(seccionCabezal).length > 0) {
        payload.seccion_C_cabezal = seccionCabezal;
    }

    if (clientId) {
        payload.client_id = clientId;
        payload.clienteId = clientId;
    }

    return payload;
}

function updateAutonomia() {
    const volumenResina = getNumberValue(VOLUMEN_RESINA_ID);
    const durezaEntrada = getNumberValue(DUREZA_AGUA_CRUDA_ID);
    const aplicarFactor = getCheckboxValue(FACTOR_PROTECCION_ID);

    let autonomiaRecomendada = null;

    if (volumenResina !== null && durezaEntrada !== null && durezaEntrada > 0) {
        const durezaNormalizada = durezaEntrada / 10;
        if (durezaNormalizada > 0) {
            const resultado = (volumenResina * 6) / durezaNormalizada;
            if (Number.isFinite(resultado)) {
                autonomiaRecomendada = aplicarFactor ? resultado * 0.8 : resultado;
            }
        }
    }

    setNumericFieldValue(AUTONOMIA_RECOMENDADA_ID, autonomiaRecomendada);
    
    // Validar dureza del agua cruda
    validateDurezaAguaCruda(durezaEntrada);
}

function validateDurezaAguaCruda(dureza) {
    const input = getElement(DUREZA_AGUA_CRUDA_ID);
    const warning = getElement('softener-dureza-warning');
    
    if (!input) return;
    
    const isHigh = dureza !== null && dureza >= 650;
    
    // Cambiar color del input
    if (isHigh) {
        input.classList.remove('border-gray-300', 'focus:border-emerald-500', 'focus:ring-emerald-200');
        input.classList.add('border-red-500', 'focus:border-red-600', 'focus:ring-red-200', 'bg-red-50', 'dark:bg-red-900/20');
    } else {
        input.classList.remove('border-red-500', 'focus:border-red-600', 'focus:ring-red-200', 'bg-red-50', 'dark:bg-red-900/20');
        input.classList.add('border-gray-300', 'focus:border-emerald-500', 'focus:ring-emerald-200');
    }
    
    // Mostrar/ocultar advertencia
    if (warning) {
        if (isHigh) {
            warning.classList.remove('hidden');
        } else {
            warning.classList.add('hidden');
        }
    }
}


export function createSoftenerModule(deps = {}) {
    const {
        showView,
        guardarMantenimientoAblandador: guardarAblandadorCustom,
        obtenerClientes: obtenerClientesCustom,
        remitoModule,
        onMaintenanceSaved,
    } = deps;
    let initialized = false;
    let lastSavedPayload = null;
    let isReportSaved = false; // Nuevo: controlar si el reporte está guardado
    const guardarMantenimientoFn = typeof guardarAblandadorCustom === 'function'
        ? guardarAblandadorCustom
        : guardarMantenimientoAblandadorApi;
    const obtenerClientesFn = typeof obtenerClientesCustom === 'function'
        ? obtenerClientesCustom
        : obtenerClientesApi;

    // ===== CONTROL DE FLUJO DE BOTONES =====
    function setButtonsToInitialState() {
        // Estado inicial: formulario nuevo
        const autofillButton = getElement(AUTOFILL_BUTTON_ID);
        const resetButton = getElement(RESET_BUTTON_ID);
        const saveButton = getElement(SAVE_BUTTON_ID);
        const remitoButton = getElement(REMITO_BUTTON_ID);

        if (autofillButton instanceof HTMLButtonElement) {
            autofillButton.disabled = false;
        }
        if (resetButton instanceof HTMLButtonElement) {
            resetButton.disabled = false;
            resetButton.textContent = 'Limpiar Formulario';
        }
        if (saveButton instanceof HTMLButtonElement) {
            saveButton.disabled = false;
            saveButton.textContent = 'Guardar Mantenimiento';
            saveButton.style.cursor = '';
        }
        if (remitoButton instanceof HTMLButtonElement) {
            remitoButton.disabled = true;
        }

        isReportSaved = false;
        lastSavedPayload = null;
        lastSavedMaintenanceId = null;
    }

    function setButtonsToSavedState() {
        // Estado guardado: reporte ya guardado
        const autofillButton = getElement(AUTOFILL_BUTTON_ID);
        const resetButton = getElement(RESET_BUTTON_ID);
        const saveButton = getElement(SAVE_BUTTON_ID);
        const remitoButton = getElement(REMITO_BUTTON_ID);

        if (autofillButton instanceof HTMLButtonElement) {
            autofillButton.disabled = true;
        }
        if (resetButton instanceof HTMLButtonElement) {
            resetButton.disabled = false;
            resetButton.textContent = 'Nuevo Reporte';
        }
        if (saveButton instanceof HTMLButtonElement) {
            saveButton.disabled = true;
            saveButton.textContent = 'Guardar Mantenimiento';
            saveButton.style.cursor = 'not-allowed';
        }
        if (remitoButton instanceof HTMLButtonElement) {
            remitoButton.disabled = false;
        }

        isReportSaved = true;
    }
    // ===== FIN CONTROL DE FLUJO =====


    function attachAutonomiaListeners() {
        const triggerIds = [
            VOLUMEN_RESINA_ID,
            DUREZA_AGUA_CRUDA_ID,
        ];
        triggerIds.forEach(id => {
            const element = getElement(id);
            if (element instanceof HTMLInputElement) {
                element.addEventListener('input', updateAutonomia);
            }
        });

        const factorCheckbox = getElement(FACTOR_PROTECCION_ID);
        if (factorCheckbox instanceof HTMLInputElement) {
            factorCheckbox.addEventListener('change', updateAutonomia);
        }
    }

    function attachFormHandlers() {
        const form = getElement(FORM_ID);
        if (!(form instanceof HTMLFormElement)) {
            return;
        }

        form.addEventListener('reset', () => {
            schedulePostReset(() => {
                resetClientSelection();
                setDefaultServiceDate();
                setDefaultResinVolume();
                resetCabezalSection();
                updateAutonomia();
                updatePrefiltroCambioVisibility();
            });
        });

        const saveButton = getElement(SAVE_BUTTON_ID);
        if (saveButton instanceof HTMLButtonElement) {
            saveButton.addEventListener('click', async event => {
                event.preventDefault();
                await handleSaveClick(saveButton);
            });
        }

        const resetButton = getElement(RESET_BUTTON_ID);
        if (resetButton instanceof HTMLButtonElement) {
            resetButton.addEventListener('click', event => {
                event.preventDefault();
                handleResetOrNewReport();
            });
        }

        const autofillButton = getElement(AUTOFILL_BUTTON_ID);
        if (autofillButton instanceof HTMLButtonElement) {
            autofillButton.addEventListener('click', event => {
                event.preventDefault();
                autoFillSoftenerForm();
            });
        }

        const remitoButton = getElement(REMITO_BUTTON_ID);
        if (remitoButton instanceof HTMLButtonElement) {
            remitoButton.addEventListener('click', event => {
                event.preventDefault();
                handleRemitoClick();
            });
        }
    }

    function performFormReset() {
        const form = getElement(FORM_ID);
        if (!(form instanceof HTMLFormElement)) {
            return;
        }

        // Ocultar overlay de formulario bloqueado
        hideFormLockedOverlay();

        // Limpiar formulario
        form.reset();
        
        setTimeout(() => {
            setTechnicianFromLogin(); // Re-establecer técnico desde login
            resetClientSelection();
            limpiarSeccionB(); // Limpiar sección B y estado de equipos
            setDefaultServiceDate();
            setDefaultResinVolume();
            resetCabezalSection();
            updateAutonomia();
            updatePrefiltroCambioVisibility();
            setReportNumber('ABL-PENDIENTE');
            
            // Volver al estado inicial
            setButtonsToInitialState();
        }, 0);
    }

    function handleResetOrNewReport() {
        const form = getElement(FORM_ID);
        if (!(form instanceof HTMLFormElement)) {
            return;
        }

        if (isReportSaved) {
            // Si el reporte está guardado, preguntar si quiere crear uno nuevo
            const confirmNew = confirm('¿Querés crear un nuevo reporte?\n\nSe limpiará el formulario actual.');
            if (!confirmNew) {
                return;
            }
        }

        performFormReset();
    }

    // Reset silencioso para usar al cambiar de tab
    function silentReset() {
        performFormReset();
    }

    function handleRemitoClick() {
        if (!lastSavedPayload) {
            alert('⚠️ Primero debés guardar el mantenimiento antes de generar el remito.');
            return;
        }

        // Llamar directamente al método del módulo de remito
        if (remitoModule && typeof remitoModule.handleGenerarRemitoClick === 'function') {
            remitoModule.handleGenerarRemitoClick();
        } else {
            alert('⚠️ El módulo de remito no está disponible.');
        }
    }

    async function handleSaveClick(saveButton) {
        const form = getElement(FORM_ID);
        if (!(form instanceof HTMLFormElement)) {
            alert('El formulario de mantenimiento de ablandador no está disponible.');
            return;
        }

        updateAutonomia();
        
        // Verificar y guardar/actualizar equipo antes de continuar
        const { continuar, equipoId } = await verificarYGuardarEquipo();
        if (!continuar) {
            return; // El usuario canceló o hubo un error con el equipo
        }
        
        const payload = collectFormData();
        
        // Agregar referencia al equipo si existe
        if (equipoId) {
            payload.equipo_ablandador_id = equipoId;
        }
        
        if (typeof guardarMantenimientoFn !== 'function') {
            alert('Servicio de mantenimiento de ablandador no disponible.');
            return;
        }

        // Guardar datos pendientes y abrir modal de firmas
        pendingFormData = payload;
        
        // Obtener nombre del técnico del formulario si existe
        const tecnicoInput = getElement('softener-tecnico') || document.querySelector('[name="tecnico"]');
        const technicianName = tecnicoInput?.value || '';
        
        // Crear o abrir modal de firmas
        if (!signatureModal) {
            signatureModal = new SignatureModal({
                onComplete: handleSignaturesComplete,
                onCancel: handleSignaturesCancel,
                technicianName: technicianName
            });
        }
        
        signatureModal.open(technicianName);
    }
    
    async function handleSignaturesComplete(signatures) {
        const saveButton = getElement(SAVE_BUTTON_ID);
        if (!saveButton || !pendingFormData) {
            return;
        }

        const originalText = saveButton.textContent;
        saveButton.textContent = 'Guardando...';
        saveButton.disabled = true;

        try {
            // Agregar firmas a los datos del formulario
            pendingFormData.firmas = {
                tecnico: {
                    imagen: signatures.technician.image,
                    nombre: signatures.technician.name,
                    fecha: signatures.technician.timestamp
                },
                cliente: {
                    imagen: signatures.client.image,
                    nombre: signatures.client.name,
                    fecha: signatures.client.timestamp
                }
            };

            const result = await guardarMantenimientoFn({ payload: pendingFormData });
            const maintenanceId = result?.maintenanceId || result?.id || result?.data?.id || null;
            if (maintenanceId) {
                pendingFormData.maintenanceId = maintenanceId;
                lastSavedMaintenanceId = maintenanceId;
            }
            
            // Actualizar el número de reporte en pantalla
            const reportNumber = pendingFormData.metadata?.numero_reporte || 'ABL-PENDIENTE';
            setReportNumber(reportNumber);
            
            // Guardar el payload para poder generar el PDF
            lastSavedPayload = pendingFormData;
            
            // Notificar al módulo de remito que hay un nuevo reporte guardado
            if (typeof onMaintenanceSaved === 'function') {
                onMaintenanceSaved(pendingFormData);
            }

            // Limpiar datos pendientes
            pendingFormData = null;
            
            // Restaurar texto del botón antes de cambiar al estado guardado
            saveButton.textContent = originalText;
            
            // Cambiar al estado "guardado"
            setButtonsToSavedState();
            
            // Mostrar overlay de formulario bloqueado
            showFormLockedOverlay();
            
            alert(`✅ Mantenimiento de ablandador guardado correctamente con firmas.\n\nReporte N°: ${reportNumber}\n\nAhora podés generar el PDF o el Remito.\nPara crear un nuevo reporte, hacé clic en "Nuevo Reporte".`);
        } catch (error) {
            console.error('Error al guardar mantenimiento de ablandador:', error);
            const message = error?.message || 'No se pudieron guardar los datos del mantenimiento.';
            alert(`❌ Error al guardar los datos: ${message}`);
            // Restaurar el botón solo si hubo error
            saveButton.disabled = false;
            saveButton.textContent = originalText;
        }
    }
    
    function handleSignaturesCancel() {
        pendingFormData = null;
        // El usuario canceló, no hacer nada más
    }

    // Establecer el técnico asignado desde el usuario logueado
    function setTechnicianFromLogin() {
        const tecnicoInput = getElement('softener-tecnico');
        if (tecnicoInput && tecnicoInput instanceof HTMLInputElement) {
            const userName = getCurrentUserName();
            if (userName) {
                tecnicoInput.value = userName;
                // Hacer el campo readonly para evitar edición manual
                tecnicoInput.readOnly = true;
                tecnicoInput.classList.add('bg-gray-100', 'dark:bg-gray-700', 'cursor-not-allowed');
            }
        }
    }

    function ensureInitialized() {
        if (initialized) {
            return;
        }
        const form = getElement(FORM_ID);
        if (!(form instanceof HTMLFormElement)) {
            return;
        }
        setTechnicianFromLogin();
        setDefaultServiceDate();
        setDefaultResinVolume();
        updateAutonomia();
        updatePrefiltroCambioVisibility();
        
        // Cargar clientes y luego inicializar autocomplete
        loadClientes(obtenerClientesFn).then(() => {
            initializeClientAutocomplete();
        });
        
        attachAutonomiaListeners();
        attachCabezalListeners();
        attachPrefilterInfoListeners();
        attachTrenPrefiltradoListeners();
        attachProtectionInfoListeners();
        attachManometroInfoListeners();
        attachAutonomiaRestanteInfoListeners();
        attachPrefiltroCambioListeners();
        attachManometroListeners();
        attachDeltaPListeners();
        resetCabezalSection();
        attachFormHandlers();
        
        // Establecer estado inicial de botones
        setButtonsToInitialState();
        
        initialized = true;
    }

    function initialize() {
        ensureInitialized();
    }

    function show() {
        ensureInitialized();
        if (typeof showView === 'function') {
            showView(SOFTENER_VIEW_ID);
        }
    }

    return {
        initialize,
        show,
        reset: handleResetOrNewReport,
        silentReset,
    };
}

export default createSoftenerModule;
