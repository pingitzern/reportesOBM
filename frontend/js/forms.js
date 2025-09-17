import { LMIN_TO_GPD, LMIN_TO_LPH } from './config.js';

function getElement(id) {
    return document.getElementById(id);
}

const CLIENT_OPTION_ATTRIBUTE = 'data-cliente-option';
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
let clienteSelectChangeHandler = null;

function normalizeStringValue(value) {
    if (value === null || value === undefined) {
        return '';
    }

    const stringValue = String(value);
    return stringValue.trim();
}

function getFirstAvailableField(source, fieldNames) {
    if (!source || typeof source !== 'object') {
        return '';
    }

    for (const key of fieldNames) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
            const normalized = normalizeStringValue(source[key]);
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

function setClientDetailValue(fieldId, value) {
    const element = getElement(fieldId);
    if (element) {
        element.value = normalizeStringValue(value);
    }
}

function applyClientDetails(details = {}) {
    setClientDetailValue('cliente_direccion', details.direccion);
    setClientDetailValue('cliente_telefono', details.telefono);
    setClientDetailValue('cliente_email', details.email);
    setClientDetailValue('cliente_cuit', details.cuit);
}

function clearClientDetails() {
    applyClientDetails({});
}

function updateClientDetailsFromSelect(selectElement) {
    if (!selectElement) {
        clearClientDetails();
        return;
    }

    let selectedDetails = null;
    const optionFromCollection =
        selectElement.selectedOptions && selectElement.selectedOptions.length > 0
            ? selectElement.selectedOptions[0]
            : null;
    const optionFromIndex =
        typeof selectElement.selectedIndex === 'number' && selectElement.selectedIndex >= 0
            ? selectElement.options[selectElement.selectedIndex]
            : null;

    if (optionFromCollection) {
        const keyFromCollection = optionFromCollection.getAttribute('data-cliente-key');
        if (keyFromCollection) {
            selectedDetails = clienteDataMap.get(keyFromCollection) || null;
        }
    }

    const shouldCheckIndex =
        !selectedDetails || (optionFromIndex && optionFromCollection && optionFromCollection !== optionFromIndex);

    if (shouldCheckIndex && optionFromIndex) {
        const keyFromIndex = optionFromIndex.getAttribute('data-cliente-key');
        if (keyFromIndex) {
            const detailsFromIndex = clienteDataMap.get(keyFromIndex);
            if (detailsFromIndex) {
                selectedDetails = detailsFromIndex;
            }
        }
    }

    if (!selectedDetails) {
        selectedDetails = clienteDataMap.get(selectElement.value);
    }

    if (selectedDetails) {
        applyClientDetails(selectedDetails);
    } else {
        clearClientDetails();
    }
}

function resetClientSelection() {
    const select = getElement('cliente');
    if (!select) {
        clearClientDetails();
        return;
    }

    if (select.options.length > 0) {
        const placeholderOption = select.querySelector('option[value=""]');
        if (placeholderOption) {
            placeholderOption.selected = true;
            select.value = placeholderOption.value;
        } else {
            select.selectedIndex = 0;
        }
    } else {
        select.value = '';
    }

    clearClientDetails();
}

function padWithZero(value) {
    return String(value).padStart(2, '0');
}

function isDateInstance(value) {
    return Object.prototype.toString.call(value) === '[object Date]';
}

function isValidDate(value) {
    return isDateInstance(value) && !Number.isNaN(value.getTime());
}

function toDateFromParts(year, monthIndex, day) {
    const date = new Date(year, monthIndex, day);
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    if (date.getFullYear() !== year || date.getMonth() !== monthIndex || date.getDate() !== day) {
        return null;
    }

    return date;
}

function formatDateToISO(date) {
    if (!isValidDate(date)) {
        return '';
    }

    return `${date.getFullYear()}-${padWithZero(date.getMonth() + 1)}-${padWithZero(date.getDate())}`;
}

export function normalizeDateToISO(value) {
    if (value === null || value === undefined || value === '') {
        return '';
    }

    if (isValidDate(value)) {
        return formatDateToISO(value);
    }

    if (typeof value === 'number') {
        return formatDateToISO(new Date(value));
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            return '';
        }

        let match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
        if (match) {
            const year = Number(match[1]);
            const month = Number(match[2]);
            const day = Number(match[3]);
            const isoDate = toDateFromParts(year, month - 1, day);
            return isoDate ? formatDateToISO(isoDate) : '';
        }

        match = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
        if (match) {
            const year = Number(match[1]);
            const month = Number(match[2]);
            const day = Number(match[3]);
            const yearFirstDate = toDateFromParts(year, month - 1, day);
            return yearFirstDate ? formatDateToISO(yearFirstDate) : '';
        }

        match = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
        if (match) {
            const day = Number(match[1]);
            const month = Number(match[2]);
            const year = Number(match[3]);
            const dayFirstDate = toDateFromParts(year, month - 1, day);
            return dayFirstDate ? formatDateToISO(dayFirstDate) : '';
        }

        const parsedDate = new Date(trimmed);
        return formatDateToISO(parsedDate);
    }

    if (typeof value === 'object') {
        const candidate = new Date(value);
        return formatDateToISO(candidate);
    }

    return '';
}

function formatDateForDisplayFromISO(isoDate) {
    if (!isoDate) {
        return '';
    }

    const [yearStr, monthStr, dayStr] = isoDate.split('-');
    if (!yearStr || !monthStr || !dayStr) {
        return '';
    }

    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);

    if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
        return '';
    }

    const displayDate = new Date(year, month - 1, day);
    if (Number.isNaN(displayDate.getTime())) {
        return '';
    }

    return displayDate.toLocaleDateString('es-AR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
}

function setServiceDateValue(value) {
    const isoDate = normalizeDateToISO(value);
    const fechaInput = getElement('fecha');
    if (fechaInput) {
        fechaInput.value = isoDate;
    }

    const fechaDisplayInput = getElement('fecha_display');
    if (fechaDisplayInput) {
        fechaDisplayInput.value = formatDateForDisplayFromISO(isoDate);
    }
}

export function serializeForm(formElement) {
    if (!(formElement instanceof HTMLFormElement)) {
        return {};
    }

    const formData = new FormData(formElement);
    const data = {};

    formData.forEach((value, key) => {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            if (!Array.isArray(data[key])) {
                data[key] = [data[key]];
            }
            data[key].push(value);
        } else {
            data[key] = value;
        }
    });

    const radioNames = new Set();
    formElement
        .querySelectorAll('input[type="radio"][name]')
        .forEach(radio => radioNames.add(radio.name));

    radioNames.forEach(name => {
        if (!Object.prototype.hasOwnProperty.call(data, name)) {
            data[name] = '';
        }
    });

    return data;
}

function setDefaultDate() {
    setServiceDateValue(new Date());
}

function calculateAll() {
    const condRedFound = parseFloat(getElement('cond_red_found')?.value) || 0;
    const condPermFound = parseFloat(getElement('cond_perm_found')?.value) || 0;
    const condRedLeft = parseFloat(getElement('cond_red_left')?.value) || 0;
    const condPermLeft = parseFloat(getElement('cond_perm_left')?.value) || 0;

    const caudalPermFound = parseFloat(getElement('caudal_perm_found')?.value) || 0;
    const caudalRechFound = parseFloat(getElement('caudal_rech_found')?.value) || 0;
    const caudalPermLeft = parseFloat(getElement('caudal_perm_left')?.value) || 0;
    const caudalRechLeft = parseFloat(getElement('caudal_rech_left')?.value) || 0;

    const rechazoFound = condRedFound > 0 ? ((1 - (condPermFound / condRedFound)) * 100).toFixed(2) : '';
    const rechazoLeft = condRedLeft > 0 ? ((1 - (condPermLeft / condRedLeft)) * 100).toFixed(2) : '';

    const rechazoFoundInput = getElement('rechazo_found');
    const rechazoLeftInput = getElement('rechazo_left');
    if (rechazoFoundInput) {
        rechazoFoundInput.value = rechazoFound ? `${rechazoFound} %` : '';
    }
    if (rechazoLeftInput) {
        rechazoLeftInput.value = rechazoLeft ? `${rechazoLeft} %` : '';
    }

    const relacionFound = caudalPermFound > 0 ? (caudalRechFound / caudalPermFound).toFixed(1) : '';
    const relacionLeft = caudalPermLeft > 0 ? (caudalRechLeft / caudalPermLeft).toFixed(1) : '';

    const relacionFoundInput = getElement('relacion_found');
    const relacionLeftInput = getElement('relacion_left');
    if (relacionFoundInput) {
        relacionFoundInput.value = relacionFound ? `${relacionFound}:1` : '';
    }
    if (relacionLeftInput) {
        relacionLeftInput.value = relacionLeft ? `${relacionLeft}:1` : '';
    }
}

function updateConversions(inputEl, outputEl) {
    const lmin = parseFloat(inputEl.value);
    if (!Number.isNaN(lmin) && lmin >= 0) {
        const lph = lmin * LMIN_TO_LPH;
        const gpd = lmin * LMIN_TO_GPD;
        outputEl.textContent = `(${lph.toFixed(1)} l/h | ${gpd.toFixed(0)} GPD)`;
    } else {
        outputEl.textContent = '';
    }
}

function configureConversionInputs() {
    const conversionPairs = [
        ['caudal_perm_found', 'caudal_perm_found_conv'],
        ['caudal_perm_left', 'caudal_perm_left_conv'],
        ['caudal_rech_found', 'caudal_rech_found_conv'],
        ['caudal_rech_left', 'caudal_rech_left_conv'],
    ];

    conversionPairs.forEach(([inputId, outputId]) => {
        const input = getElement(inputId);
        const output = getElement(outputId);
        if (input && output) {
            input.addEventListener('input', () => updateConversions(input, output));
        }
    });
}

function setStatusColor(selectElement) {
    selectElement.classList.remove('status-pass', 'status-fail', 'status-na');
    const value = selectElement.value;
    if (value === 'Pasa' || value === 'Realizada' || value === 'No') {
        selectElement.classList.add('status-pass');
    } else if (value === 'Falla' || value === 'No Realizada' || value === 'Sí') {
        selectElement.classList.add('status-fail');
    } else {
        selectElement.classList.add('status-na');
    }
}

function applyStatusColors() {
    const statusSelects = document.querySelectorAll('select[id$="_found"], select[id$="_left"], select#sanitizacion_status');
    statusSelects.forEach(setStatusColor);
}

function configureStatusSelects() {
    const statusSelects = document.querySelectorAll('select[id$="_found"], select[id$="_left"], select#sanitizacion_status');
    statusSelects.forEach(select => {
        setStatusColor(select);
        select.addEventListener('change', () => setStatusColor(select));
    });
}

function configureNumberInputs() {
    const inputs = document.querySelectorAll('input[type="number"]');
    inputs.forEach(input => {
        input.addEventListener('input', calculateAll);
    });
}

function clearDerivedFields() {
    ['rechazo_found', 'rechazo_left', 'relacion_found', 'relacion_left'].forEach(id => {
        const element = getElement(id);
        if (element) {
            element.value = '';
        }
    });
}

function clearConversionOutputs() {
    ['caudal_perm_found_conv', 'caudal_perm_left_conv', 'caudal_rech_found_conv', 'caudal_rech_left_conv'].forEach(id => {
        const element = getElement(id);
        if (element) {
            element.textContent = '';
        }
    });
}

export function configureClientSelect(clientes = []) {
    const select = getElement('cliente');
    if (!select) {
        return;
    }

    const clientesArray = Array.isArray(clientes) ? clientes : [];
    const previousValue = select.value;
    const previousSelectedOption = select.selectedOptions && select.selectedOptions[0];
    const previousDataKey = previousSelectedOption
        ? previousSelectedOption.getAttribute('data-cliente-key')
        : null;
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
        const clientKey = `cliente-${index}`;
        option.setAttribute('data-cliente-key', clientKey);
        option.setAttribute(CLIENT_OPTION_ATTRIBUTE, 'true');
        fragment.appendChild(option);

        clienteDataMap.set(clientKey, createClientDetails(cliente));
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

    if (previousDataKey) {
        const matchingOption = select.querySelector(`option[data-cliente-key="${previousDataKey}"]`);
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

export function initializeForm() {
    setDefaultDate();
    configureNumberInputs();
    configureConversionInputs();
    configureStatusSelects();
    calculateAll();
}

export function resetForm() {
    const form = getElement('maintenance-form');
    if (form) {
        form.reset();
    }
    resetClientSelection();
    setDefaultDate();
    clearDerivedFields();
    clearConversionOutputs();
    applyStatusColors();
}

export function getFormData() {
    const form = getElement('maintenance-form');
    if (!(form instanceof HTMLFormElement)) {
        return {};
    }

    const data = serializeForm(form);

    if (Object.prototype.hasOwnProperty.call(data, 'fecha')) {
        const isoFecha = normalizeDateToISO(data.fecha);
        data.fecha = isoFecha || normalizeDateToISO(new Date());
    }

    if (Object.prototype.hasOwnProperty.call(data, 'proximo_mant')) {
        data.proximo_mant = normalizeDateToISO(data.proximo_mant);
    }
    const numericFields = [
        'cond_red_found',
        'cond_red_left',
        'cond_perm_found',
        'cond_perm_left',
        'presion_found',
        'presion_left',
        'caudal_perm_found',
        'caudal_perm_left',
        'caudal_rech_found',
        'caudal_rech_left',
        'precarga_found',
        'precarga_left',
    ];

    numericFields.forEach(field => {
        if (Object.prototype.hasOwnProperty.call(data, field) && data[field] === '') {
            data[field] = 0;
        }
    });

    return data;
}

export function setReportNumber(reportNumber) {
    const display = getElement('report-number-display');
    if (display) {
        display.textContent = reportNumber;
    }
}

export function generateReportNumber() {
    const now = new Date();
    const padZero = (num) => String(num).padStart(2, '0');
    const timestamp = `${now.getFullYear()}${padZero(now.getMonth() + 1)}${padZero(now.getDate())}-${padZero(now.getHours())}${padZero(now.getMinutes())}${padZero(now.getSeconds())}`;
    return `REP-${timestamp}`;
}

export const __testables__ = {
    calculateAll,
    updateConversions,
};
