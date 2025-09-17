import { LMIN_TO_GPD, LMIN_TO_LPH } from './config.js';

function getElement(id) {
    return document.getElementById(id);
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

    const rechazoFoundValue = rechazoFound ? `${rechazoFound} %` : '';
    const rechazoLeftValue = rechazoLeft ? `${rechazoLeft} %` : '';

    const rechazoFoundInput = getElement('rechazo_found');
    const rechazoFoundHiddenInput = getElement('rechazo_found_hidden');
    const rechazoLeftInput = getElement('rechazo_left');
    const rechazoLeftHiddenInput = getElement('rechazo_left_hidden');
    if (rechazoFoundInput) {
        rechazoFoundInput.value = rechazoFoundValue;
    }
    if (rechazoFoundHiddenInput) {
        rechazoFoundHiddenInput.value = rechazoFoundValue;
    }
    if (rechazoLeftInput) {
        rechazoLeftInput.value = rechazoLeftValue;
    }
    if (rechazoLeftHiddenInput) {
        rechazoLeftHiddenInput.value = rechazoLeftValue;
    }

    const relacionFound = caudalPermFound > 0 ? (caudalRechFound / caudalPermFound).toFixed(1) : '';
    const relacionLeft = caudalPermLeft > 0 ? (caudalRechLeft / caudalPermLeft).toFixed(1) : '';

    const relacionFoundValue = relacionFound ? `${relacionFound}:1` : '';
    const relacionLeftValue = relacionLeft ? `${relacionLeft}:1` : '';

    const relacionFoundInput = getElement('relacion_found');
    const relacionFoundHiddenInput = getElement('relacion_found_hidden');
    const relacionLeftInput = getElement('relacion_left');
    const relacionLeftHiddenInput = getElement('relacion_left_hidden');
    if (relacionFoundInput) {
        relacionFoundInput.value = relacionFoundValue;
    }
    if (relacionFoundHiddenInput) {
        relacionFoundHiddenInput.value = relacionFoundValue;
    }
    if (relacionLeftInput) {
        relacionLeftInput.value = relacionLeftValue;
    }
    if (relacionLeftHiddenInput) {
        relacionLeftHiddenInput.value = relacionLeftValue;
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

const STATUS_SELECT_SELECTOR = 'select[id$="_found"], select[id$="_left"]';

const STATUS_CLASS_BY_VALUE = {
    pasa: 'status-pass',
    no: 'status-pass',
    falla: 'status-fail',
    'no pasa': 'status-fail',
    sí: 'status-fail',
    si: 'status-fail',
    'n/a': 'status-na',
    'no aplica': 'status-na',
    na: 'status-na',
    '': 'status-na',
};

function setStatusColor(selectElement) {
    selectElement.classList.remove('status-pass', 'status-fail', 'status-na');
    const normalizedValue = String(selectElement.value ?? '').trim().toLowerCase();
    const statusClass = STATUS_CLASS_BY_VALUE[normalizedValue] || 'status-na';
    selectElement.classList.add(statusClass);
}

function applyStatusColorsToSelects() {
    const statusSelects = document.querySelectorAll(STATUS_SELECT_SELECTOR);
    statusSelects.forEach(setStatusColor);
}

function configureStatusSelects() {
    const statusSelects = document.querySelectorAll(STATUS_SELECT_SELECTOR);
    statusSelects.forEach(select => {
        setStatusColor(select);
        select.addEventListener('change', () => setStatusColor(select));
    });
}

const SANITIZACION_STATUS_MAP = {
    Realizada: 'success',
    'No Realizada': 'danger',
    'N/A': 'neutral',
};

function configureSanitizacionRadios() {
    const container = document.querySelector('.sanitizacion-options');
    if (!container) {
        return;
    }

    const radios = container.querySelectorAll('input[type="radio"][name="sanitizacion"]');
    if (!radios.length) {
        container.dataset.status = 'neutral';
        return;
    }

    const updateStatus = () => {
        const checked = container.querySelector('input[type="radio"][name="sanitizacion"]:checked');
        const statusKey = checked?.value || 'N/A';
        container.dataset.status = SANITIZACION_STATUS_MAP[statusKey] || 'neutral';
    };

    if (!container.dataset.sanitizacionConfigured) {
        radios.forEach(radio => {
            radio.addEventListener('change', updateStatus);
        });
        container.dataset.sanitizacionConfigured = 'true';
    }

    updateStatus();
}

function configureNumberInputs() {
    const inputs = document.querySelectorAll('input[type="number"]');
    inputs.forEach(input => {
        input.addEventListener('input', calculateAll);
    });
}

function clearDerivedFields() {
    [
        'rechazo_found',
        'rechazo_found_hidden',
        'rechazo_left',
        'rechazo_left_hidden',
        'relacion_found',
        'relacion_found_hidden',
        'relacion_left',
        'relacion_left_hidden',
    ].forEach(id => {
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

export function initializeForm() {
    setDefaultDate();
    configureNumberInputs();
    configureConversionInputs();
    configureStatusSelects();
    configureSanitizacionRadios();
    calculateAll();
}

export function resetForm() {
    const form = getElement('maintenance-form');
    if (form) {
        form.reset();
    }
    setDefaultDate();
    clearDerivedFields();
    clearConversionOutputs();
    applyStatusColorsToSelects();
    configureSanitizacionRadios();
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
