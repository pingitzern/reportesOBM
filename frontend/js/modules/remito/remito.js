import { COMPONENT_STAGES } from '../mantenimiento/templates.js';

function getElement(id) {
    return typeof document !== 'undefined' ? document.getElementById(id) : null;
}

function getSelectedOptionText(selectId) {
    const select = getElement(selectId);
    if (!(select instanceof HTMLSelectElement)) {
        return '';
    }

    const option = select.selectedOptions?.[0];
    return option ? option.textContent.trim() : '';
}

function getInputValue(id) {
    const element = getElement(id);
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
        return '';
    }
    return element.value.trim();
}

function cloneReportData(data) {
    if (!data || typeof data !== 'object') {
        return {};
    }

    try {
        return JSON.parse(JSON.stringify(data));
    } catch (error) {
        return { ...data };
    }
}

function normalizeString(value) {
    if (value === null || value === undefined) {
        return '';
    }

    const text = String(value).trim();
    return text;
}

function hasContent(value) {
    return Boolean(normalizeString(value));
}

function buildRepuestoDescripcion(item = {}) {
    const descripcion = [item.descripcion, item.detalle, item.detalles, item.title, item.nombre]
        .map(normalizeString)
        .filter(Boolean)
        .join(' - ');

    return descripcion;
}

function normalizeRepuestoItem(item = {}) {
    if (!item || typeof item !== 'object') {
        return { codigo: '', descripcion: '', cantidad: '' };
    }

    const codigo = normalizeString(item.codigo || item.id || item.codigo_repuesto || item.cod || item.codigoArticulo);
    const descripcion = buildRepuestoDescripcion(item);
    const cantidadRaw = item.cantidad ?? item.cant ?? item.unidades ?? '';
    const cantidadText = normalizeString(cantidadRaw);

    if (cantidadText) {
        const parsed = Number(String(cantidadText).replace(',', '.'));
        if (Number.isFinite(parsed) && parsed >= 0) {
            return { codigo, descripcion, cantidad: String(parsed) };
        }
    }

    return { codigo, descripcion, cantidad: cantidadText };
}

function isReplacementAction(value) {
    const normalized = normalizeString(value).toLowerCase();
    if (!normalized) {
        return false;
    }

    const replacementKeywords = ['cambi', 'reempl', 'instal', 'nuevo'];
    return replacementKeywords.some(keyword => normalized.includes(keyword));
}

function buildComponentStageLookup(stages) {
    if (!Array.isArray(stages)) {
        return {};
    }

    return stages.reduce((map, stage) => {
        if (stage?.id) {
            map[stage.id] = normalizeString(stage.title) || stage.id;
        }
        return map;
    }, {});
}

function buildStageIdList(stages) {
    const defaultIds = Array.from({ length: 6 }, (_, index) => `etapa${index + 1}`);

    if (!Array.isArray(stages) || stages.length === 0) {
        return defaultIds;
    }

    const providedIds = stages
        .map(stage => normalizeString(stage?.id))
        .filter(Boolean);

    const uniqueIds = new Set([...providedIds, ...defaultIds]);
    return Array.from(uniqueIds);
}

function buildComponentesFromReport(report, stages = COMPONENT_STAGES) {
    if (!report || typeof report !== 'object') {
        return [];
    }

    const stageLookup = buildComponentStageLookup(stages);
    const stageIds = buildStageIdList(stages);

    return stageIds.reduce((acc, stageId) => {
        const accionKey = `${stageId}_accion`;
        const detallesKey = `${stageId}_detalles`;

        const accion = normalizeString(report[accionKey]);
        const detalles = normalizeString(report[detallesKey]);

        if (!isReplacementAction(accion)) {
            return acc;
        }

        acc.push({
            accion,
            detalles,
            title: stageLookup[stageId] || stageId,
        });

        return acc;
    }, []);
}

function formatDateValue(rawDate) {
    const value = normalizeString(rawDate);
    if (!value) {
        return '';
    }

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
        return value;
    }

    const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
        const [, year, month, day] = isoMatch;
        return `${day}/${month}/${year}`;
    }

    const timestamp = Date.parse(value);
    if (!Number.isNaN(timestamp)) {
        const date = new Date(timestamp);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = String(date.getFullYear());
        return `${day}/${month}/${year}`;
    }

    return value;
}

function resolveReportValue(report, keys, fallback = '') {
    if (!report || typeof report !== 'object') {
        return fallback;
    }

    const candidates = Array.isArray(keys) ? keys : [keys];
    for (const key of candidates) {
        const value = normalizeString(report[key]);
        if (value) {
            return value;
        }
    }

    return fallback;
}

function setReadonlyInputValue(id, value) {
    const element = getElement(id);
    if (!(element instanceof HTMLInputElement)) {
        return;
    }

    element.value = normalizeString(value);
    element.readOnly = true;
    element.setAttribute('readonly', 'readonly');
}

function clearReadonlyInputs(ids = []) {
    ids.forEach(id => {
        const element = getElement(id);
        if (element instanceof HTMLInputElement) {
            element.value = '';
            element.readOnly = true;
            element.setAttribute('readonly', 'readonly');
        }
    });
}

function createRepuestoRow(data = {}, { forceDefaultCantidad = false } = {}) {
    if (typeof document === 'undefined') {
        return null;
    }

    const { codigo = '', descripcion = '', cantidad = '' } = data;
    const resolvedCantidad = forceDefaultCantidad && !hasContent(cantidad) ? '1' : cantidad;

    const row = document.createElement('tr');
    row.className = 'remito-repuesto-row transition-colors duration-150 hover:bg-gray-50';

    const codigoCell = document.createElement('td');
    codigoCell.className = 'px-4 py-3 align-top';
    const codigoInput = document.createElement('input');
    codigoInput.type = 'text';
    codigoInput.name = 'repuesto-codigo';
    codigoInput.placeholder = 'Código del repuesto';
    codigoInput.value = codigo;
    codigoInput.dataset.field = 'codigo';
    codigoInput.className = 'repuestos-table-input';
    codigoCell.appendChild(codigoInput);

    const descripcionCell = document.createElement('td');
    descripcionCell.className = 'px-4 py-3 align-top';
    const descripcionInput = document.createElement('input');
    descripcionInput.type = 'text';
    descripcionInput.name = 'repuesto-descripcion';
    descripcionInput.placeholder = 'Descripción del repuesto';
    descripcionInput.value = descripcion;
    descripcionInput.dataset.field = 'descripcion';
    descripcionInput.className = 'repuestos-table-input';
    descripcionCell.appendChild(descripcionInput);

    const cantidadCell = document.createElement('td');
    cantidadCell.className = 'px-4 py-3 align-top text-right';
    const cantidadInput = document.createElement('input');
    cantidadInput.type = 'number';
    cantidadInput.name = 'repuesto-cantidad';
    cantidadInput.placeholder = '0';
    cantidadInput.inputMode = 'numeric';
    cantidadInput.min = '0';
    cantidadInput.step = '1';
    cantidadInput.value = resolvedCantidad;
    cantidadInput.dataset.field = 'cantidad';
    cantidadInput.className = 'repuestos-table-input text-right';
    cantidadCell.appendChild(cantidadInput);

    row.append(codigoCell, descripcionCell, cantidadCell);
    return row;
}

function renderRepuestosList(repuestos = []) {
    const tbody = getElement('remito-repuestos-body');
    if (!(tbody instanceof HTMLElement)) {
        return;
    }

    tbody.innerHTML = '';

    if (!Array.isArray(repuestos) || repuestos.length === 0) {
        const emptyRow = createRepuestoRow();
        if (emptyRow) {
            tbody.appendChild(emptyRow);
        }
        return;
    }

    repuestos.forEach(item => {
        const normalized = normalizeRepuestoItem(item);
        const hasValues = hasContent(normalized.codigo) || hasContent(normalized.descripcion) || hasContent(normalized.cantidad);
        const row = createRepuestoRow(normalized, { forceDefaultCantidad: hasValues });
        if (row) {
            tbody.appendChild(row);
        }
    });
}

function normalizeCantidadValue(value) {
    const textValue = normalizeString(value);
    if (!textValue) {
        return '';
    }

    const numericValue = Number(textValue.replace(',', '.'));
    if (Number.isFinite(numericValue)) {
        return String(numericValue);
    }

    return textValue;
}

function collectRepuestosFromForm() {
    const tbody = getElement('remito-repuestos-body');
    if (!(tbody instanceof HTMLElement)) {
        return [];
    }

    const rows = Array.from(tbody.querySelectorAll('tr'));
    return rows.reduce((acc, row) => {
        const inputs = Array.from(row.querySelectorAll('input[data-field]'));
        if (inputs.length === 0) {
            return acc;
        }

        const item = { codigo: '', descripcion: '', cantidad: '' };

        inputs.forEach(input => {
            if (!(input instanceof HTMLInputElement)) {
                return;
            }

            const field = input.dataset.field;
            if (!field) {
                return;
            }

            if (field === 'cantidad') {
                item.cantidad = normalizeCantidadValue(input.value);
            } else {
                item[field] = normalizeString(input.value);
            }
        });

        const hasValues = hasContent(item.codigo) || hasContent(item.descripcion) || hasContent(item.cantidad);
        if (hasValues) {
            acc.push(item);
        }

        return acc;
    }, []);
}

function addEmptyRepuestoRow({ focus = false } = {}) {
    const tbody = getElement('remito-repuestos-body');
    if (!(tbody instanceof HTMLElement)) {
        return;
    }

    const row = createRepuestoRow();
    if (!row) {
        return;
    }

    tbody.appendChild(row);

    if (focus) {
        const firstInput = row.querySelector('input');
        if (firstInput instanceof HTMLInputElement) {
            firstInput.focus();
        }
    }
}

function createReportSnapshot(rawData) {
    const snapshot = cloneReportData(rawData);

    if (!snapshot.clienteNombre) {
        snapshot.clienteNombre = getSelectedOptionText('cliente') || snapshot.cliente || snapshot.cliente_nombre;
    }

    snapshot.direccion = snapshot.direccion || getInputValue('direccion');
    snapshot.cliente_telefono = snapshot.cliente_telefono || getInputValue('cliente_telefono');
    snapshot.cliente_email = snapshot.cliente_email || getInputValue('cliente_email');
    snapshot.cliente_cuit = snapshot.cliente_cuit || getInputValue('cliente_cuit');
    snapshot.fecha_display = snapshot.fecha_display || getInputValue('fecha_display');

    const componentesDerivados = buildComponentesFromReport(snapshot);
    snapshot.componentes = componentesDerivados;

    if (!Array.isArray(snapshot.repuestos) || snapshot.repuestos.length === 0) {
        snapshot.repuestos = componentesDerivados.map(item => ({ ...item }));
    }

    return snapshot;
}

function populateRemitoForm(report) {
    if (!report || typeof report !== 'object') {
        return;
    }

    const numeroRemito = resolveReportValue(report, ['NumeroRemito', 'numero_remito', 'remitoNumero', 'numero_reporte']);
    const fechaRemito = formatDateValue(resolveReportValue(report, ['fecha_display', 'fecha']));

    setReadonlyInputValue('remito-numero', numeroRemito);
    setReadonlyInputValue('remito-fecha', fechaRemito);
    setReadonlyInputValue('remito-cliente-nombre', resolveReportValue(report, ['clienteNombre', 'cliente_nombre', 'cliente']));
    setReadonlyInputValue('remito-cliente-direccion', resolveReportValue(report, ['direccion', 'cliente_direccion', 'ubicacion']));
    setReadonlyInputValue('remito-cliente-telefono', resolveReportValue(report, ['cliente_telefono', 'telefono_cliente', 'telefono']));
    setReadonlyInputValue('remito-cliente-email', resolveReportValue(report, ['cliente_email', 'email']));
    setReadonlyInputValue('remito-cliente-cuit', resolveReportValue(report, ['cliente_cuit', 'cuit']));

    const descripcionEquipo = resolveReportValue(report, ['equipo', 'modelo', 'descripcion_equipo']);
    setReadonlyInputValue('remito-equipo-descripcion', descripcionEquipo);
    setReadonlyInputValue('remito-equipo-modelo', resolveReportValue(report, ['modelo', 'modelo_equipo']));
    setReadonlyInputValue('remito-equipo-serie', resolveReportValue(report, ['n_serie', 'numero_serie']));
    setReadonlyInputValue('remito-equipo-interno', resolveReportValue(report, ['id_interna', 'codigo_interno']));
    setReadonlyInputValue('remito-equipo-ubicacion', resolveReportValue(report, ['ubicacion', 'direccion', 'cliente_direccion']));
    setReadonlyInputValue('remito-equipo-tecnico', resolveReportValue(report, ['tecnico', 'tecnico_asignado']));

    const observaciones = getElement('remito-observaciones');
    if (observaciones instanceof HTMLTextAreaElement) {
        const texto = normalizeString(report.observaciones || report.resumen || '');
        observaciones.value = texto;
        observaciones.removeAttribute('readonly');
    }

    const componentesDerivados = Array.isArray(report.componentes) && report.componentes.length > 0
        ? report.componentes
        : buildComponentesFromReport(report);

    const repuestos = Array.isArray(report.repuestos) && report.repuestos.length > 0
        ? report.repuestos
        : componentesDerivados;

    renderRepuestosList(repuestos);
}

function disableButton(buttonId) {
    const button = getElement(buttonId);
    if (button instanceof HTMLButtonElement) {
        button.disabled = true;
        button.setAttribute('disabled', 'disabled');
    }
}

function enableButton(buttonId) {
    const button = getElement(buttonId);
    if (button instanceof HTMLButtonElement) {
        button.disabled = false;
        button.removeAttribute('disabled');
    }
}

export function createRemitoModule({ showView, apiUrl, getToken } = {}) {
    let lastSavedReport = null;
    let eventsInitialized = false;

    function ensureReportAvailable() {
        if (!lastSavedReport) {
            disableButton('generar-remito-btn');
            window.alert?.('Primero debés guardar el mantenimiento para generar el remito.');
            return false;
        }
        return true;
    }

    function handleMaintenanceSaved(reportData) {
        lastSavedReport = createReportSnapshot(reportData);
        enableButton('generar-remito-btn');
    }

    function reset() {
        lastSavedReport = null;
        disableButton('generar-remito-btn');
        clearReadonlyInputs([
            'remito-numero',
            'remito-fecha',
            'remito-cliente-nombre',
            'remito-cliente-direccion',
            'remito-cliente-telefono',
            'remito-cliente-email',
            'remito-cliente-cuit',
            'remito-equipo-descripcion',
            'remito-equipo-modelo',
            'remito-equipo-serie',
            'remito-equipo-interno',
            'remito-equipo-ubicacion',
            'remito-equipo-tecnico',
        ]);
        renderRepuestosList([]);
        const observaciones = getElement('remito-observaciones');
        if (observaciones instanceof HTMLTextAreaElement) {
            observaciones.value = '';
        }
    }

    function handleGenerarRemitoClick() {
        if (!ensureReportAvailable()) {
            return false;
        }

        populateRemitoForm(lastSavedReport);
        if (typeof showView === 'function') {
            showView('remito-view');
        }
        return true;
    }

    async function handleFinalizarRemitoClick() {
        if (!lastSavedReport) {
            window.alert?.('No hay datos disponibles para generar el remito. Guardá el mantenimiento primero.');
            return;
        }

        const observacionesElement = getElement('remito-observaciones');
        const observaciones = observacionesElement instanceof HTMLTextAreaElement ? observacionesElement.value.trim() : '';

        const repuestosEditados = collectRepuestosFromForm();
        lastSavedReport.repuestos = repuestosEditados;
        if (repuestosEditados.length > 0) {
            lastSavedReport.componentes = [];
        }
        renderRepuestosList(repuestosEditados);

        const finalizarBtn = getElement('finalizar-remito-btn');
        let originalText = '';
        if (finalizarBtn instanceof HTMLButtonElement) {
            originalText = finalizarBtn.textContent || '';
            finalizarBtn.textContent = 'Generando remito...';
            finalizarBtn.disabled = true;
        }

        try {
            if (!apiUrl) {
                throw new Error('La URL del servicio no está configurada.');
            }

            const token = typeof getToken === 'function' ? normalizeString(getToken()) : '';
            if (!token) {
                throw new Error('No hay una sesión activa. Ingresá nuevamente.');
            }

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain; charset=utf-8',
                },
                body: JSON.stringify({
                    action: 'crear_remito',
                    token,
                    reporteData: lastSavedReport,
                    observaciones,
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            let payload;
            try {
                payload = await response.json();
            } catch (error) {
                throw new Error('No se pudo interpretar la respuesta del servidor.');
            }

            if (payload?.result !== 'success') {
                const message = normalizeString(payload?.error || payload?.message) || 'No fue posible generar el remito.';
                throw new Error(message);
            }

            const numeroRemito = normalizeString(payload?.data?.NumeroRemito);
            if (numeroRemito) {
                lastSavedReport.NumeroRemito = numeroRemito;
                setReadonlyInputValue('remito-numero', numeroRemito);
            }

            if (observaciones) {
                lastSavedReport.observaciones = observaciones;
            }

            window.alert?.('✅ Remito generado correctamente.');
        } catch (error) {
            console.error('Error al generar el remito:', error);
            const message = error instanceof Error ? error.message : 'Error desconocido al generar el remito.';
            window.alert?.(`❌ ${message}`);
        } finally {
            if (finalizarBtn instanceof HTMLButtonElement) {
                finalizarBtn.textContent = originalText || 'Finalizar y Guardar Remito';
                finalizarBtn.disabled = false;
            }
        }
    }

    function initialize() {
        if (eventsInitialized) {
            return;
        }

        disableButton('generar-remito-btn');
        renderRepuestosList([]);

        const generarBtn = getElement('generar-remito-btn');
        if (generarBtn instanceof HTMLButtonElement) {
            generarBtn.addEventListener('click', event => {
                event.preventDefault();
                handleGenerarRemitoClick();
            });
        }

        const finalizarBtn = getElement('finalizar-remito-btn');
        if (finalizarBtn instanceof HTMLButtonElement) {
            finalizarBtn.addEventListener('click', event => {
                event.preventDefault();
                void handleFinalizarRemitoClick();
            });
        }

        const agregarRepuestoBtn = getElement('remito-agregar-repuesto');
        if (agregarRepuestoBtn instanceof HTMLButtonElement) {
            agregarRepuestoBtn.addEventListener('click', event => {
                event.preventDefault();
                addEmptyRepuestoRow({ focus: true });
            });
        }

        eventsInitialized = true;
    }

    function setLastSavedReportForTests(data) {
        lastSavedReport = data ? cloneReportData(data) : null;
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
