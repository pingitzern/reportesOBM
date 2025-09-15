import { LMIN_TO_GPD, LMIN_TO_LPH } from './config.js';

function getElement(id) {
    return document.getElementById(id);
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

function getValue(id) {
    return getElement(id)?.value || '';
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
    return {
        cliente: getValue('cliente'),
        fecha: getValue('fecha'),
        direccion: getValue('direccion'),
        tecnico: getValue('tecnico'),
        modelo: getValue('modelo'),
        id_interna: getValue('id_interna'),
        n_serie: getValue('n_serie'),
        proximo_mant: getValue('proximo_mant'),
        fugas_found: getValue('fugas_found'),
        fugas_left: getValue('fugas_left'),
        cond_red_found: getValue('cond_red_found') || 0,
        cond_red_left: getValue('cond_red_left') || 0,
        cond_perm_found: getValue('cond_perm_found') || 0,
        cond_perm_left: getValue('cond_perm_left') || 0,
        rechazo_found: getValue('rechazo_found'),
        rechazo_left: getValue('rechazo_left'),
        presion_found: getValue('presion_found') || 0,
        presion_left: getValue('presion_left') || 0,
        caudal_perm_found: getValue('caudal_perm_found') || 0,
        caudal_perm_left: getValue('caudal_perm_left') || 0,
        caudal_rech_found: getValue('caudal_rech_found') || 0,
        caudal_rech_left: getValue('caudal_rech_left') || 0,
        relacion_found: getValue('relacion_found'),
        relacion_left: getValue('relacion_left'),
        precarga_found: getValue('precarga_found') || 0,
        precarga_left: getValue('precarga_left') || 0,
        presostato_alta_found: getValue('presostato_alta_found'),
        presostato_alta_left: getValue('presostato_alta_left'),
        presostato_baja_found: getValue('presostato_baja_found'),
        presostato_baja_left: getValue('presostato_baja_left'),
        etapa1_detalles: getValue('etapa1_detalles'),
        etapa1_accion: document.querySelector('input[name="etapa1_action"]:checked')?.value || '',
        etapa2_detalles: getValue('etapa2_detalles'),
        etapa2_accion: document.querySelector('input[name="etapa2_action"]:checked')?.value || '',
        etapa3_detalles: getValue('etapa3_detalles'),
        etapa3_accion: document.querySelector('input[name="etapa3_action"]:checked')?.value || '',
        etapa4_detalles: getValue('etapa4_detalles'),
        etapa4_accion: document.querySelector('input[name="etapa4_action"]:checked')?.value || '',
        etapa5_detalles: getValue('etapa5_detalles'),
        etapa5_accion: document.querySelector('input[name="etapa5_action"]:checked')?.value || '',
        etapa6_detalles: getValue('etapa6_detalles'),
        etapa6_accion: document.querySelector('input[name="etapa6_action"]:checked')?.value || '',
        sanitizacion: getValue('sanitizacion_status'),
        resumen: getValue('resumen'),
        numero_reporte: `REP-${Date.now()}`,
    };
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
