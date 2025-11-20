import {
    guardarMantenimientoAblandador as guardarMantenimientoAblandadorApi,
    generarPdfAblandador as generarPdfAblandadorApi,
    obtenerClientes as obtenerClientesApi,
} from '../../api.js';

const SOFTENER_VIEW_ID = 'tab-ablandador';
const FORM_ID = 'softener-maintenance-form';
const SAVE_BUTTON_ID = 'softener-save-button';
const RESET_BUTTON_ID = 'softener-reset-button';
const AUTOFILL_BUTTON_ID = 'softener-autofill-button';
const PDF_BUTTON_ID = 'softener-pdf-button';
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
const PROTECTION_INFO_BTN_ID = 'softener-protection-info-btn';
const PROTECTION_INFO_POPUP_ID = 'softener-protection-info-popup';
const PROTECCION_ENTRADA_ID = 'softener-equipo-proteccion-entrada';
// Manómetros
const MANOMETRO_INFO_BTN_ID = 'softener-manometro-info-btn';
const MANOMETRO_INFO_POPUP_ID = 'softener-manometro-info-popup';
const MANOMETRO_SELECT_ID = 'softener-equipo-manometros';
const CLIENT_SELECT_ID = 'softener-cliente-nombre';
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

function getElement(id) {
    return typeof document !== 'undefined' ? document.getElementById(id) : null;
}

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
    const select = getElement(CLIENT_SELECT_ID);
    if (!(select instanceof HTMLSelectElement)) {
        clearClientDetails();
        return;
    }

    const placeholderOption = select.querySelector('option[value=""]');
    if (placeholderOption) {
        placeholderOption.selected = true;
        select.value = placeholderOption.value;
    } else if (select.options.length > 0) {
        select.selectedIndex = 0;
    } else {
        select.value = '';
    }

    clearClientDetails();
}

function populateClientSelect(clientes = []) {
    const select = getElement(CLIENT_SELECT_ID);
    if (!(select instanceof HTMLSelectElement)) {
        return;
    }

    const clientesArray = Array.isArray(clientes) ? clientes : [];
    const previousValue = select.value;
    const previousOption = select.selectedOptions && select.selectedOptions[0];
    const previousKey = previousOption ? previousOption.getAttribute(CLIENT_KEY_ATTRIBUTE) : null;
    const placeholderOption = select.querySelector('option[value=""]');

    select.querySelectorAll(`option[${CLIENT_OPTION_ATTRIBUTE}="true"]`).forEach(option => option.remove());
    clienteDataMap.clear();

    const fragment = document.createDocumentFragment();

    clientesArray.forEach((cliente, index) => {
        if (!cliente || typeof cliente !== 'object') {
            return;
        }

        const optionValue = extractClientId(cliente) || extractClientName(cliente);
        if (!optionValue) {
            return;
        }

        const optionLabel = extractClientName(cliente) || optionValue;
        const option = document.createElement('option');
        option.value = optionValue;
        option.textContent = optionLabel;
        const key = `softener-cliente-${index}`;
        option.setAttribute(CLIENT_OPTION_ATTRIBUTE, 'true');
        option.setAttribute(CLIENT_KEY_ATTRIBUTE, key);
        fragment.appendChild(option);

        clienteDataMap.set(key, createClientDetails(cliente));
    });

    select.appendChild(fragment);

    if (clienteSelectChangeHandler) {
        select.removeEventListener('change', clienteSelectChangeHandler);
    }

    clienteSelectChangeHandler = () => {
        updateClientDetailsFromSelect(select);
    };

    select.addEventListener('change', clienteSelectChangeHandler);

    let selectionRestored = false;

    if (previousKey) {
        const matchingOption = select.querySelector(`option[${CLIENT_KEY_ATTRIBUTE}="${previousKey}"]`);
        if (matchingOption) {
            matchingOption.selected = true;
            select.value = matchingOption.value;
            selectionRestored = true;
        }
    }

    if (!selectionRestored && previousValue) {
        select.value = previousValue;
        selectionRestored = select.value === previousValue && select.selectedIndex !== -1;
    }

    if (selectionRestored) {
        updateClientDetailsFromSelect(select);
    } else {
        if (placeholderOption) {
            placeholderOption.selected = true;
            select.value = placeholderOption.value;
        } else if (select.options.length > 0) {
            select.selectedIndex = 0;
        } else {
            select.value = '';
        }
        clearClientDetails();
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

function initializeClientAutocomplete(obtenerClientesFn) {
    if (!clientAutocompleteInitialized) {
        configureClientDetailFieldInteractions();
        resetClientSelection();
        clientAutocompleteInitialized = true;
    }

    if (typeof obtenerClientesFn === 'function') {
        loadClientes(obtenerClientesFn);
    }
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
    const container = getElement(CAMBIO_FILTRO_CONTAINER_ID);
    const tipoFiltroInput = getElement(FILTRO_TIPO_INSTALADO_ID);
    
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
    
    if (!container) return;
    
    if (tienePrefiltro) {
        container.classList.remove('hidden');
        // Heredar el tipo de filtro configurado
        if (tipoFiltroInput) {
            tipoFiltroInput.value = prefiltroValue;
        }
    } else {
        container.classList.add('hidden');
        // Limpiar campos cuando se oculta
        const checkCambio = getElement(CHECK_CAMBIO_FILTRO_ID);
        if (checkCambio instanceof HTMLInputElement) {
            checkCambio.checked = false;
        }
        updateDetalleCambioFiltro();
    }
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
    
    // Listener para el checkbox de "¿Realizó cambio de filtro?"
    const checkCambio = getElement(CHECK_CAMBIO_FILTRO_ID);
    if (checkCambio instanceof HTMLInputElement) {
        checkCambio.addEventListener('change', () => {
            updateDetalleCambioFiltro();
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
    // El campo cliente es un select, agregar la opción si no existe
    const clienteSelect = getElement('softener-cliente-nombre');
    if (clienteSelect instanceof HTMLSelectElement) {
        const clienteValue = clientes[idx];
        let optionExists = false;
        
        for (let i = 0; i < clienteSelect.options.length; i++) {
            if (clienteSelect.options[i].value === clienteValue) {
                optionExists = true;
                break;
            }
        }
        
        if (!optionExists) {
            const option = document.createElement('option');
            option.value = clienteValue;
            option.textContent = clienteValue;
            clienteSelect.appendChild(option);
        }
        
        setSelectValue('softener-cliente-nombre', clienteValue);
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
    
    const metadata = {
        formulario: 'mantenimiento_ablandador',
        version: '3.1',
        generado_en: new Date().toISOString(),
        numero_reporte: reportNumber,
    };

    const seccionA = buildSection([
        ['nombre', getInputValue('softener-cliente-nombre')],
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

    const seccionB = buildSection([
        ['tipo', getInputValue('softener-equipo-tipo')],
        ['modelo', getInputValue('softener-equipo-modelo')],
        ['numero_serie', getInputValue('softener-equipo-numero-serie')],
        ['ubicacion', getInputValue('softener-equipo-ubicacion')],
        ['volumen_resina', volumenResina],
        ['notas_equipo', getInputValue('softener-equipo-notas')],
        ['tipo_regeneracion', getInputValue(SECCION_B_TIPO_REGENERACION_ID)],
        ['prefiltro', getInputValue('softener-equipo-prefiltro')],
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

    const seccionD = buildSection([
        // Inspección General
        ['inspeccion_fugas', getCheckboxValue('softener-check-fugas')],
        // Sistema de Prefiltración
        ['cambio_filtro_realizado', getCheckboxValue(CHECK_CAMBIO_FILTRO_ID)],
        ['filtro_tipo_instalado', getInputValue(FILTRO_TIPO_INSTALADO_ID)],
        ['filtro_lote_serie', getInputValue(FILTRO_LOTE_SERIE_ID)],
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
        cliente: seccionA.nombre,
        direccion: seccionA.direccion,
        cliente_telefono: seccionA.telefono,
        cliente_email: seccionA.email,
        cliente_cuit: seccionA.cuit,
        numero_reporte: reportNumber,
        // Secciones estructuradas
        seccion_A_cliente: seccionA,
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
        const pdfButton = getElement(PDF_BUTTON_ID);
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
        if (pdfButton instanceof HTMLButtonElement) {
            pdfButton.disabled = true;
        }
        if (remitoButton instanceof HTMLButtonElement) {
            remitoButton.disabled = true;
        }

        isReportSaved = false;
        lastSavedPayload = null;
    }

    function setButtonsToSavedState() {
        // Estado guardado: reporte ya guardado
        const autofillButton = getElement(AUTOFILL_BUTTON_ID);
        const resetButton = getElement(RESET_BUTTON_ID);
        const saveButton = getElement(SAVE_BUTTON_ID);
        const pdfButton = getElement(PDF_BUTTON_ID);
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
        if (pdfButton instanceof HTMLButtonElement) {
            pdfButton.disabled = false;
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

        const pdfButton = getElement(PDF_BUTTON_ID);
        if (pdfButton instanceof HTMLButtonElement) {
            pdfButton.addEventListener('click', async event => {
                event.preventDefault();
                await handlePdfClick(pdfButton);
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

        // Limpiar formulario
        form.reset();
        
        setTimeout(() => {
            resetClientSelection();
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

    async function handlePdfClick(pdfButton) {
        if (!lastSavedPayload) {
            alert('⚠️ Primero debes guardar el mantenimiento antes de generar el PDF.');
            return;
        }

        const originalText = pdfButton.textContent;
        pdfButton.disabled = true;
        pdfButton.textContent = 'Generando PDF...';

        try {
            const result = await generarPdfAblandadorApi({ payload: lastSavedPayload });
            
            console.log('Respuesta PDF:', result);
            
            // Verificar si la respuesta es válida
            const data = result?.data || result;
            
            if (data?.success || data?.pdfGenerated) {
                const numeroReporte = data.numeroReporte || 'SIN-ID';
                const driveInfo = data.drive;
                
                // Verificar si se guardó en Drive
                if (driveInfo?.url && driveInfo?.fileId) {
                    const message = `✅ PDF generado y guardado en Drive exitosamente!\n\nReporte N°: ${numeroReporte}\nArchivo: ${driveInfo.fileName || 'PDF'}\n\n¿Deseas abrir el PDF?`;
                    if (confirm(message)) {
                        window.open(driveInfo.url, '_blank');
                    }
                } else if (driveInfo?.saved === false) {
                    alert(`✅ PDF generado correctamente.\n\nReporte N°: ${numeroReporte}\n\n⚠️ No se pudo guardar en Drive: ${driveInfo.message || 'Error desconocido'}`);
                } else {
                    alert(`✅ PDF generado correctamente.\n\nReporte N°: ${numeroReporte}`);
                }
            } else {
                throw new Error(data?.message || 'Respuesta inesperada del servidor');
            }
        } catch (error) {
            console.error('Error al generar PDF de ablandador:', error);
            const message = error?.message || 'No se pudo generar el PDF.';
            alert(`❌ Error: ${message}`);
        } finally {
            pdfButton.disabled = false;
            pdfButton.textContent = originalText;
        }
    }

    async function handleSaveClick(saveButton) {
        const form = getElement(FORM_ID);
        if (!(form instanceof HTMLFormElement)) {
            alert('El formulario de mantenimiento de ablandador no está disponible.');
            return;
        }

        const originalText = saveButton.textContent;
        saveButton.disabled = true;
        saveButton.textContent = 'Guardando...';

        let saved = false;
        try {
            updateAutonomia();
            const payload = collectFormData();
            if (typeof guardarMantenimientoFn !== 'function') {
                throw new Error('Servicio de mantenimiento de ablandador no disponible.');
            }

            await guardarMantenimientoFn({ payload });
            
            // Actualizar el número de reporte en pantalla
            const reportNumber = payload.metadata?.numero_reporte || 'ABL-PENDIENTE';
            setReportNumber(reportNumber);
            
            // Guardar el payload para poder generar el PDF
            lastSavedPayload = payload;
            
            // Notificar al módulo de remito que hay un nuevo reporte guardado
            if (typeof onMaintenanceSaved === 'function') {
                onMaintenanceSaved(payload);
            }
            
            // Marcar como guardado exitosamente
            saved = true;
            
            // Restaurar texto del botón antes de cambiar al estado guardado
            saveButton.textContent = originalText;
            
            // Cambiar al estado "guardado"
            setButtonsToSavedState();
            
            alert(`✅ Mantenimiento de ablandador guardado correctamente.\n\nReporte N°: ${reportNumber}\n\nAhora podés generar el PDF o el Remito.\nPara crear un nuevo reporte, hacé clic en "Nuevo Reporte".`);
        } catch (error) {
            console.error('Error al guardar mantenimiento de ablandador:', error);
            const message = error?.message || 'No se pudieron guardar los datos del mantenimiento.';
            alert(`❌ Error al guardar los datos: ${message}`);
            // Restaurar el botón solo si hubo error
            saveButton.disabled = false;
            saveButton.textContent = originalText;
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
        setDefaultServiceDate();
        setDefaultResinVolume();
        updateAutonomia();
        updatePrefiltroCambioVisibility();
        initializeClientAutocomplete(obtenerClientesFn);
        attachAutonomiaListeners();
        attachCabezalListeners();
        attachPrefilterInfoListeners();
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
    };
}

export default createSoftenerModule;
