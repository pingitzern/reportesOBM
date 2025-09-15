import { LMIN_TO_GPD, LMIN_TO_LPH } from './config.js';

function getElement(id) {
    return document.getElementById(id);
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
    const fechaInput = getElement('fecha');
    if (fechaInput) {
        const today = new Date();
        fechaInput.value = today.toLocaleDateString('es-AR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        });
    }
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

    data.numero_reporte = `REP-${Date.now()}`;

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
