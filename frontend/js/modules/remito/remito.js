import { COMPONENT_STAGES } from '../mantenimiento/templates.js';

function getElement(id) {
    return document.getElementById(id);
}

function getSelectedOptionText(selectElement) {
    if (!selectElement || !selectElement.selectedOptions?.length) {
        return '';
    }

    return textUtils.normalize(selectElement.selectedOptions[0].textContent);
}

function getRadioValue(name) {
    if (!name) {
        return '';
    }

    const checked = document.querySelector(`input[type="radio"][name="${name}"]:checked`);
    return checked ? textUtils.normalize(checked.value) : '';
}

function collectComponentData() {
    if (!Array.isArray(COMPONENT_STAGES)) {
        return [];
    }

    return COMPONENT_STAGES.map(stage => {
        const detailsInput = getElement(`${stage.id}_detalles`);
        const detalles = detailsInput ? textUtils.normalize(detailsInput.value) : '';
        const accion = getRadioValue(`${stage.id}_accion`);

        return {
            id: stage.id,
            title: stage.title,
            detalles,
            accion,
            cantidad: detailsInput?.dataset?.cantidad || '',
        };
    });
}

function getInputValueById(elementId) {
    if (!elementId) {
        return '';
    }

    const element = getElement(elementId);
    if (!element || !('value' in element)) {
        return '';
    }

    return textUtils.normalize(element.value);
}

const textUtils = {
    normalize(value, { fallback = '' } = {}) {
        if (value === null || value === undefined) {
            return fallback;
        }

        const text = String(value).trim();
        return text || fallback;
    },

    formatDateFromISO(isoDate) {
        if (!isoDate || typeof isoDate !== 'string') {
            return '';
        }

        const [datePart] = isoDate.split('T');
        const [yearStr, monthStr, dayStr] = (datePart || isoDate).split('-');

        const year = Number(yearStr);
        const month = Number(monthStr);
        const day = Number(dayStr);

        if ([year, month, day].some(Number.isNaN)) {
            return '';
        }

        const date = new Date(year, month - 1, day);
        if (Number.isNaN(date.getTime())) {
            return '';
        }

        return date.toLocaleDateString('es-AR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        });
    },
};

function formatReportDate(reportData) {
    if (!reportData || typeof reportData !== 'object') {
        return '';
    }

    const displayDate = textUtils.normalize(reportData.fecha_display);
    return displayDate || textUtils.formatDateFromISO(reportData.fecha);
}

function createReportSnapshot(datos = {}) {
    const clienteSelect = getElement('cliente');
    const fechaDisplayInput = getElement('fecha_display');

    let serializedData = {};
    try {
        serializedData = JSON.parse(JSON.stringify(datos || {}));
    } catch (error) {
        serializedData = { ...(datos || {}) };
    }

    const snapshot = {
        ...serializedData,
        cliente_nombre: getSelectedOptionText(clienteSelect),
        fecha_display: fechaDisplayInput ? textUtils.normalize(fechaDisplayInput.value) : '',
        componentes: collectComponentData(),
    };

    if (!snapshot.cliente_nombre) {
        snapshot.cliente_nombre = textUtils.normalize(snapshot.cliente);
    }

    const snapshotFallbackMap = {
        direccion: 'direccion',
        cliente_telefono: 'cliente_telefono',
        cliente_email: 'cliente_email',
        cliente_cuit: 'cliente_cuit',
    };

    Object.entries(snapshotFallbackMap).forEach(([fieldName, elementId]) => {
        if (!textUtils.normalize(snapshot[fieldName])) {
            const fieldValue = getInputValueById(elementId);
            if (fieldValue) {
                snapshot[fieldName] = fieldValue;
            }
        }
    });

    return snapshot;
}

function resolveRemitoNumberFromData(data = {}) {
    if (!data || typeof data !== 'object') {
        return '';
    }

    const candidates = [
        data.numero_remito,
        data.remito_numero,
        data.numeroRemito,
        data.remitoNumero,
        data.numero_remito_generado,
        data.numero_reporte,
    ];

    for (const candidate of candidates) {
        const normalized = textUtils.normalize(candidate);
        if (normalized) {
            return normalized;
        }
    }

    return '';
}

function resolveReportField(reportData, candidateKeys = []) {
    if (!reportData || typeof reportData !== 'object') {
        return '';
    }

    const keys = Array.isArray(candidateKeys) ? candidateKeys : [candidateKeys];
    for (const key of keys) {
        const value = textUtils.normalize(reportData[key]);
        if (value) {
            return value;
        }
    }

    return '';
}

function fillTextContent(elementId, value, { fallback = '---' } = {}) {
    const element = getElement(elementId);
    if (!element) {
        return;
    }

    const resolved = textUtils.normalize(value, { fallback });
    element.textContent = resolved;
}

function renderRemitoRepuestos(componentes = []) {
    const tableBody = getElement('remito-repuestos');
    if (!tableBody) {
        return;
    }

    tableBody.innerHTML = '';

    const changedComponents = componentes.filter(componento => textUtils.normalize(componento.accion) === 'Cambiado');

    if (!changedComponents.length) {
        const emptyRow = document.createElement('tr');
        const emptyCell = document.createElement('td');
        emptyCell.colSpan = 3;
        emptyCell.className = 'px-4 py-3 text-sm text-gray-500 text-center';
        emptyCell.textContent = 'No se registraron repuestos cambiados en este servicio.';
        emptyRow.appendChild(emptyCell);
        tableBody.appendChild(emptyRow);
        return;
    }

    changedComponents.forEach(componento => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50';

        const codigoCell = document.createElement('td');
        codigoCell.className = 'px-4 py-2 text-sm text-gray-700';
        codigoCell.textContent = textUtils.normalize(componento.id);

        const descripcionCell = document.createElement('td');
        descripcionCell.className = 'px-4 py-2 text-sm text-gray-700';
        const descripcionPartes = [
            textUtils.normalize(componento.title),
            textUtils.normalize(componento.detalles),
        ];
        descripcionCell.textContent = descripcionPartes.filter(Boolean).join(' - ') || 'Repuesto sin descripción';

        const cantidadCell = document.createElement('td');
        cantidadCell.className = 'px-4 py-2 text-sm text-right text-gray-700';
        const cantidad = Number(componento.cantidad);
        cantidadCell.textContent = !Number.isNaN(cantidad) && cantidad > 0 ? String(cantidad) : '1';

        row.append(codigoCell, descripcionCell, cantidadCell);
        tableBody.appendChild(row);
    });
}

function renderRemitoView(reportData) {
    if (!reportData || typeof reportData !== 'object') {
        return;
    }

    const numeroRemito = resolveRemitoNumberFromData(reportData);
    fillTextContent('remito-numero', numeroRemito);
    fillTextContent('remito-fecha', formatReportDate(reportData), { fallback: '--/--/----' });
    fillTextContent('remito-cliente', resolveReportField(reportData, [
        'cliente_nombre',
        'cliente',
        'razon_social',
        'razonSocial',
        'clienteNombre',
    ]));
    fillTextContent('remito-cliente-direccion', resolveReportField(reportData, [
        'direccion',
        'cliente_direccion',
        'domicilio',
        'clienteDireccion',
    ]));
    fillTextContent('remito-cliente-telefono', resolveReportField(reportData, [
        'cliente_telefono',
        'telefono',
        'telefono_cliente',
        'clienteTelefono',
    ]));
    fillTextContent('remito-cliente-email', resolveReportField(reportData, [
        'cliente_email',
        'email',
        'clienteEmail',
    ]));
    fillTextContent('remito-cliente-cuit', resolveReportField(reportData, [
        'cliente_cuit',
        'cuit',
        'clienteCuit',
    ]));

    const equipoValue = textUtils.normalize(reportData.equipo || reportData.modelo || reportData.id_interna);
    fillTextContent('remito-equipo', equipoValue);
    fillTextContent('remito-equipo-modelo', resolveReportField(reportData, [
        'modelo',
        'equipo_modelo',
        'modelo_equipo',
    ]));
    fillTextContent('remito-equipo-serie', resolveReportField(reportData, [
        'n_serie',
        'numero_serie',
        'serie',
    ]));
    fillTextContent('remito-equipo-interno', resolveReportField(reportData, [
        'id_interna',
        'activo',
        'codigo_interno',
    ]));
    fillTextContent('remito-equipo-ubicacion', resolveReportField(reportData, [
        'ubicacion',
        'direccion',
        'cliente_direccion',
    ]));
    fillTextContent('remito-equipo-tecnico', resolveReportField(reportData, [
        'tecnico',
        'tecnico_asignado',
        'tecnicoAsignado',
    ]));

    const observaciones = getElement('remito-observaciones');
    if (observaciones) {
        observaciones.value = textUtils.normalize(reportData.observaciones || reportData.resumen);
        observaciones.readOnly = false;
        observaciones.removeAttribute('readonly');
        observaciones.disabled = false;
    }

    renderRemitoRepuestos(Array.isArray(reportData.componentes) ? reportData.componentes : []);
}

function setGenerarRemitoButtonEnabled(enabled) {
    const generarRemitoBtn = getElement('generarRemitoButton');
    if (!generarRemitoBtn) {
        return;
    }

    if (enabled) {
        generarRemitoBtn.disabled = false;
        generarRemitoBtn.removeAttribute('disabled');
        return;
    }

    generarRemitoBtn.disabled = true;
    if (!generarRemitoBtn.hasAttribute('disabled')) {
        generarRemitoBtn.setAttribute('disabled', 'disabled');
    }
}

function extractRemitoNumberFromResponse(data) {
    if (!data) {
        return '';
    }

    if (typeof data === 'string') {
        return textUtils.normalize(data);
    }

    if (typeof data !== 'object') {
        return '';
    }

    const directNumber = resolveRemitoNumberFromData(data);
    if (directNumber) {
        return directNumber;
    }

    if (typeof data.remito === 'string') {
        return textUtils.normalize(data.remito);
    }

    if (data.remito && typeof data.remito === 'object') {
        return resolveRemitoNumberFromData(data.remito);
    }

    return '';
}

export function createRemitoModule({ crearRemito, showView }) {
    let lastSavedReport = null;
    let eventsInitialized = false;

    function ensureReportAvailable() {
        if (!lastSavedReport) {
            setGenerarRemitoButtonEnabled(false);
            alert('Primero debes guardar un mantenimiento para generar el remito.');
            return false;
        }

        return true;
    }

    function handleMaintenanceSaved(datos) {
        lastSavedReport = createReportSnapshot(datos);
        setGenerarRemitoButtonEnabled(true);
    }

    function reset() {
        lastSavedReport = null;
        setGenerarRemitoButtonEnabled(false);
    }

    function handleGenerarRemitoClick() {
        if (!ensureReportAvailable()) {
            return false;
        }

        renderRemitoView(lastSavedReport);
        showView('remito-servicio');
        return true;
    }

    async function handleFinalizarRemitoClick() {
        if (!lastSavedReport) {
            alert('No hay datos disponibles para generar el remito. Guarda un mantenimiento primero.');
            return;
        }

        const finalizarBtn = getElement('finalizarRemitoButton');
        const observacionesInput = getElement('remito-observaciones');
        const observaciones = observacionesInput ? observacionesInput.value : '';

        let originalText = '';
        if (finalizarBtn) {
            originalText = finalizarBtn.textContent || '';
            finalizarBtn.textContent = 'Generando remito...';
            finalizarBtn.disabled = true;
        }

        try {
            const responseData = await crearRemito({
                reporte: lastSavedReport,
                observaciones,
            });

            lastSavedReport.observaciones = observaciones;

            const remitoNumber = extractRemitoNumberFromResponse(responseData);
            if (remitoNumber) {
                lastSavedReport.numero_remito = remitoNumber;
                fillTextContent('remito-numero', remitoNumber);
            }

            alert('✅ Remito generado correctamente.');
        } catch (error) {
            console.error('Error al generar remito:', error);
            const message = error?.message || 'Error desconocido al generar el remito.';
            alert(`❌ Error al generar el remito: ${message}`);
        } finally {
            if (finalizarBtn) {
                finalizarBtn.textContent = originalText || 'Finalizar y Generar Remito';
                finalizarBtn.disabled = false;
            }
        }
    }

    function initialize() {
        if (eventsInitialized) {
            return;
        }

        setGenerarRemitoButtonEnabled(Boolean(lastSavedReport));

        const generarRemitoBtn = getElement('generarRemitoButton');
        if (generarRemitoBtn) {
            generarRemitoBtn.addEventListener('click', event => {
                event.preventDefault();
                handleGenerarRemitoClick();
            });
        }

        const finalizarRemitoBtn = getElement('finalizarRemitoButton');
        if (finalizarRemitoBtn) {
            finalizarRemitoBtn.addEventListener('click', event => {
                event.preventDefault();
                handleFinalizarRemitoClick();
            });
        }

        eventsInitialized = true;
    }

    function setLastSavedReportForTests(data) {
        lastSavedReport = data || null;
    }

    function getLastSavedReportForTests() {
        return lastSavedReport;
    }

    return {
        initialize,
        handleMaintenanceSaved,
        reset,
        handleGenerarRemitoClick,
        handleFinalizarRemitoClick,
        setLastSavedReportForTests,
        getLastSavedReportForTests,
    };
}

