/* global __APP_VERSION__ */
import { showView } from './viewManager.js';
import {
    guardarMantenimiento,
    buscarMantenimientos,
    actualizarMantenimiento,
    eliminarMantenimiento,
    obtenerDashboard,
    obtenerClientes,
    crearRemito,
} from './api.js';
import { initializeAuth } from './modules/login/auth.js';
import { renderDashboard } from './modules/dashboard/dashboard.js';
import {
    configureClientSelect,
    generateReportNumber,
    getFormData,
    initializeForm,
    resetForm,
    setReportNumber,
} from './modules/mantenimiento/forms.js';
import {
    clearSearchResults,
    getEditFormValues,
    openEditModal,
    closeEditModal,
    renderSearchResults,
} from './modules/busqueda/search.js';
import { renderComponentStages, COMPONENT_STAGES } from './modules/mantenimiento/templates.js';

const appState = {
    lastSavedReport: null,
};

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
        const detailsInput = document.getElementById(`${stage.id}_detalles`);
        const detalles = detailsInput ? textUtils.normalize(detailsInput.value) : '';
        const accion = getRadioValue(`${stage.id}_accion`);

        return {
            id: stage.id,
            title: stage.title,
            detalles,
            accion,
        };
    });
}

function getInputValueById(elementId) {
    if (!elementId) {
        return '';
    }

    const element = document.getElementById(elementId);
    if (!element || !('value' in element)) {
        return '';
    }

    return textUtils.normalize(element.value);
}

function createReportSnapshot(datos = {}) {
    const clienteSelect = document.getElementById('cliente');
    const fechaDisplayInput = document.getElementById('fecha_display');

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
    const element = document.getElementById(elementId);
    if (!element) {
        return;
    }

    const resolved = textUtils.normalize(value, { fallback });
    element.textContent = resolved;
}

function renderRemitoRepuestos(componentes = []) {
    const tableBody = document.getElementById('remito-repuestos');
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

    const observaciones = document.getElementById('remito-observaciones');
    if (observaciones) {
        observaciones.value = textUtils.normalize(reportData.observaciones || reportData.resumen);
        observaciones.readOnly = false;
        observaciones.removeAttribute('readonly');
        observaciones.disabled = false;
    }

    renderRemitoRepuestos(Array.isArray(reportData.componentes) ? reportData.componentes : []);
}

function setGenerarRemitoButtonEnabled(enabled) {
    const generarRemitoBtn = document.getElementById('generarRemitoButton');
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

function handleGenerarRemitoClick() {
    if (!appState.lastSavedReport) {
        setGenerarRemitoButtonEnabled(false);
        alert('Primero debes guardar un mantenimiento para generar el remito.');
        return false;
    }

    renderRemitoView(appState.lastSavedReport);
    return true;
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

async function handleFinalizarRemitoClick() {
    if (!appState.lastSavedReport) {
        alert('No hay datos disponibles para generar el remito. Guarda un mantenimiento primero.');
        return;
    }

    const finalizarBtn = document.getElementById('finalizarRemitoButton');
    const observacionesInput = document.getElementById('remito-observaciones');
    const observaciones = observacionesInput ? observacionesInput.value : '';

    let originalText = '';
    if (finalizarBtn) {
        originalText = finalizarBtn.textContent || '';
        finalizarBtn.textContent = 'Generando remito...';
        finalizarBtn.disabled = true;
    }

    try {
        const responseData = await crearRemito({
            reporte: appState.lastSavedReport,
            observaciones,
        });

        appState.lastSavedReport.observaciones = observaciones;

        const remitoNumber = extractRemitoNumberFromResponse(responseData);
        if (remitoNumber) {
            appState.lastSavedReport.numero_remito = remitoNumber;
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

function showAppVersion() {
    const versionElement = document.getElementById('app-version');
    if (!versionElement) {
        return;
    }

    if (typeof __APP_VERSION__ !== 'undefined') {
        const versionValue = `${__APP_VERSION__}`.trim();
        if (versionValue) {
            versionElement.textContent = `Versión ${versionValue}`;
            versionElement.classList.remove('hidden');
            return;
        }
    }

    versionElement.textContent = '';
    versionElement.classList.add('hidden');
}

async function loadDashboard() {
    try {
        const data = await obtenerDashboard();
        renderDashboard(data);
    } catch (error) {
        console.error('Error cargando dashboard:', error);
    }
}

function activateTab(tabName) {
    const viewId = `tab-${tabName}`;
    showView(viewId);

    document.querySelectorAll('.tab-content').forEach(tab => {
        if (tab.id === viewId) {
            tab.classList.remove('hidden');
            return;
        }
        tab.classList.add('hidden');
    });

    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    const tabButton = document.getElementById(`tab-${tabName}-btn`);
    if (tabButton) {
        tabButton.classList.add('active');
    }

    if (tabName === 'dashboard') {
        loadDashboard();
    }
}

async function handleGuardarClick() {
    const guardarBtn = document.getElementById('guardarButton');
    if (!guardarBtn) {
        return;
    }

    const originalText = guardarBtn.textContent;
    guardarBtn.textContent = 'Guardando...';
    guardarBtn.disabled = true;

    try {
        const reportNumber = generateReportNumber();
        const datos = getFormData();
        if (datos && typeof datos === 'object') {
            datos.numero_reporte = reportNumber;
        }

        await guardarMantenimiento(datos);
        appState.lastSavedReport = createReportSnapshot(datos);
        alert('✅ Mantenimiento guardado correctamente en el sistema');

        setGenerarRemitoButtonEnabled(true);

        setReportNumber(reportNumber);
    } catch (error) {
        console.error('Error al guardar mantenimiento:', error);
        const message = error?.message || 'Error desconocido al guardar los datos.';
        alert(`❌ Error al guardar los datos: ${message}`);
    } finally {
        guardarBtn.textContent = originalText;
        guardarBtn.disabled = false;
    }
}

async function handleBuscarClick() {
    const filtros = {
        cliente: document.getElementById('buscar-cliente')?.value || '',
        tecnico: document.getElementById('buscar-tecnico')?.value || '',
        fecha: document.getElementById('buscar-fecha')?.value || '',
    };

    try {
        const resultados = await buscarMantenimientos(filtros);
        renderSearchResults(resultados, {
            onEdit: handleEditarMantenimiento,
            onDelete: handleEliminarMantenimiento,
        });
    } catch (error) {
        console.error('Error buscando mantenimientos:', error);
        const message = error?.message || 'Error desconocido al buscar mantenimientos.';
        alert(`❌ Error al buscar mantenimientos: ${message}`);
    }
}

function handleLimpiarBusqueda() {
    const inputs = ['buscar-cliente', 'buscar-tecnico', 'buscar-fecha'];
    inputs.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.value = '';
        }
    });
    clearSearchResults();
}

function handleEditarMantenimiento(mantenimiento) {
    if (!mantenimiento) {
        return;
    }
    openEditModal(mantenimiento);
}

async function handleEliminarMantenimiento(mantenimiento) {
    if (!mantenimiento?.ID_Unico) {
        return;
    }

    const confirmacion = window.confirm('¿Estás seguro de que quieres eliminar este mantenimiento?');
    if (!confirmacion) {
        return;
    }

    try {
        await eliminarMantenimiento(mantenimiento.ID_Unico);
        alert('✅ Mantenimiento eliminado correctamente');
        await handleBuscarClick();
    } catch (error) {
        console.error('Error eliminando mantenimiento:', error);
        alert('Error al eliminar mantenimiento');
    }
}

async function handleGuardarEdicion() {
    try {
        const datos = getEditFormValues();
        await actualizarMantenimiento(datos);
        alert('✅ Cambios guardados correctamente');
        closeEditModal();
        await handleBuscarClick();
    } catch (error) {
        console.error('Error guardando cambios:', error);
        alert('Error al guardar cambios');
    }
}

function initializeNavigation() {
    const tabNuevoBtn = document.getElementById('tab-nuevo-btn');
    if (tabNuevoBtn) {
        tabNuevoBtn.addEventListener('click', () => activateTab('nuevo'));
    }

    const tabBuscarBtn = document.getElementById('tab-buscar-btn');
    if (tabBuscarBtn) {
        tabBuscarBtn.addEventListener('click', () => activateTab('buscar'));
    }

    const tabDashboardBtn = document.getElementById('tab-dashboard-btn');
    if (tabDashboardBtn) {
        tabDashboardBtn.addEventListener('click', () => activateTab('dashboard'));
    }
}

function initializeMaintenanceEvents() {
    const guardarBtn = document.getElementById('guardarButton');
    if (guardarBtn) {
        guardarBtn.addEventListener('click', handleGuardarClick);
    }

    const resetBtn = document.getElementById('resetButton');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetForm);
    }

    const generarRemitoBtn = document.getElementById('generarRemitoButton');
    if (generarRemitoBtn) {
        generarRemitoBtn.addEventListener('click', () => {
            if (handleGenerarRemitoClick()) {
                showView('remito-servicio');
            }
        });
    }

    const finalizarRemitoBtn = document.getElementById('finalizarRemitoButton');
    if (finalizarRemitoBtn) {
        finalizarRemitoBtn.addEventListener('click', handleFinalizarRemitoClick);
    }
}

function initializeSearchEvents() {
    const buscarBtn = document.getElementById('buscar-btn');
    if (buscarBtn) {
        buscarBtn.addEventListener('click', event => {
            event.preventDefault();
            handleBuscarClick();
        });
    }

    const limpiarBtn = document.getElementById('limpiar-btn');
    if (limpiarBtn) {
        limpiarBtn.addEventListener('click', event => {
            event.preventDefault();
            handleLimpiarBusqueda();
        });
    }

    const cancelarEdicionBtn = document.getElementById('cancelar-edicion-btn');
    if (cancelarEdicionBtn) {
        cancelarEdicionBtn.addEventListener('click', event => {
            event.preventDefault();
            closeEditModal();
        });
    }

    const guardarEdicionBtn = document.getElementById('guardar-edicion-btn');
    if (guardarEdicionBtn) {
        guardarEdicionBtn.addEventListener('click', event => {
            event.preventDefault();
            handleGuardarEdicion();
        });
    }
}

async function prepareMaintenanceModule() {
    renderComponentStages();

    let clientes = [];
    try {
        clientes = await obtenerClientes();
    } catch (error) {
        console.error('Error cargando clientes:', error);
        const detalle = error?.message ? ` Detalle: ${error.message}` : '';
        alert(`No se pudieron cargar los datos de clientes. Podrás completar los campos manualmente.${detalle}`);
    }

    configureClientSelect(clientes);
    initializeForm();
    setGenerarRemitoButtonEnabled(false);
}

async function initializeApp() {
    showAppVersion();
    initializeNavigation();
    initializeMaintenanceEvents();
    initializeSearchEvents();

    try {
        await initializeAuth();
        await prepareMaintenanceModule();
        activateTab('dashboard');
    } catch (error) {
        console.error('Error inicializando la aplicación:', error);
        alert('No se pudo inicializar la aplicación. Revisa la consola para más detalles.');
    }
}

export const __testables__ = {
    handleGuardarClick,
    handleGenerarRemitoClick,
    handleFinalizarRemitoClick,
    showView,
    setLastSavedReportDataForTests(data) {
        appState.lastSavedReport = data;
    },
    getLastSavedReportDataForTests() {
        return appState.lastSavedReport;
    },
};

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});
