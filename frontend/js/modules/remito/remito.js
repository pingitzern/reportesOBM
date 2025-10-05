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

function renderRepuestosList(repuestos = []) {
    const tbody = getElement('remito-repuestos-body');
    if (!(tbody instanceof HTMLElement)) {
        return;
    }

    tbody.innerHTML = '';

    if (!Array.isArray(repuestos) || repuestos.length === 0) {
        const emptyRow = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 3;
        cell.className = 'px-4 py-3 text-sm text-gray-500 text-center';
        cell.textContent = 'Sin repuestos registrados.';
        emptyRow.appendChild(cell);
        tbody.appendChild(emptyRow);
        return;
    }

    repuestos.forEach(item => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50';

        const codigoCell = document.createElement('td');
        codigoCell.className = 'px-4 py-2 text-sm text-gray-700';
        codigoCell.textContent = normalizeString(item.codigo || item.id || '');

        const descripcionCell = document.createElement('td');
        descripcionCell.className = 'px-4 py-2 text-sm text-gray-700';
        const descripcion = [item.descripcion, item.detalle, item.detalles, item.title]
            .map(normalizeString)
            .filter(Boolean)
            .join(' - ');
        descripcionCell.textContent = descripcion || 'Repuesto sin descripción';

        const cantidadCell = document.createElement('td');
        cantidadCell.className = 'px-4 py-2 text-sm text-right text-gray-700';
        const cantidad = Number(item.cantidad);
        cantidadCell.textContent = Number.isFinite(cantidad) && cantidad > 0 ? String(cantidad) : '1';

        row.append(codigoCell, descripcionCell, cantidadCell);
        tbody.appendChild(row);
    });
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

    const repuestos = Array.isArray(report.repuestos)
        ? report.repuestos
        : Array.isArray(report.componentes)
            ? report.componentes.filter(item => normalizeString(item.accion) === 'Cambiado' || normalizeString(item.cantidad))
            : [];

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
