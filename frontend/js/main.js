/* global __APP_VERSION__ */
import { API_URL } from './config.js';
import { initializeAuth } from './auth.js';
import { guardarMantenimiento, buscarMantenimientos, actualizarMantenimiento, eliminarMantenimiento, obtenerDashboard, obtenerClientes } from './api.js';
import { renderDashboard } from './dashboard.js';
import { configureClientSelect, generateReportNumber, getFormData, initializeForm, resetForm, setReportNumber } from './forms.js';
import { clearSearchResults, getEditFormValues, openEditModal, closeEditModal, renderSearchResults } from './search.js';
import { renderComponentStages, COMPONENT_STAGES } from './templates.js';

const isApiConfigured = typeof API_URL === 'string' && API_URL.length > 0;

if (!isApiConfigured) {
    console.warn('API_URL no configurado. Configura window.__APP_CONFIG__.API_URL o la variable de entorno API_URL.');
}

let lastSavedReport = null;

const REMITO_FIELD_GROUPS = [
    {
        type: 'fields',
        title: 'Datos del Servicio',
        columns: 2,
        fields: [
            { key: 'numero_reporte', label: 'Número de Reporte' },
            { key: 'fecha', label: 'Fecha del Servicio', formatter: formatDateValue },
            { key: 'proximo_mant', label: 'Próximo Mantenimiento', formatter: formatDateValue },
            { key: 'tecnico', label: 'Técnico Asignado' },
        ],
    },
    {
        type: 'fields',
        title: 'Datos del Cliente',
        columns: 2,
        fields: [
            { key: 'cliente', label: 'Cliente' },
            { key: 'direccion', label: 'Dirección' },
            { key: 'cliente_telefono', label: 'Teléfono' },
            { key: 'cliente_email', label: 'Email' },
            { key: 'cliente_cuit', label: 'CUIT' },
        ],
    },
    {
        type: 'fields',
        title: 'Datos del Equipo',
        columns: 2,
        fields: [
            { key: 'modelo', label: 'Modelo del Equipo' },
            { key: 'id_interna', label: 'ID Interna / Activo N°' },
            { key: 'n_serie', label: 'Número de Serie' },
        ],
    },
    {
        type: 'pairs',
        title: 'Parámetros de Operación',
        description: 'Valores registrados antes (As Found) y después (As Left) del mantenimiento.',
    },
    {
        type: 'components',
        title: 'Registro de Componentes',
        description: 'Detalle de las etapas intervenidas durante el mantenimiento.',
    },
    {
        type: 'fields',
        title: 'Sanitización y Resumen',
        columns: 1,
        fields: [
            { key: 'sanitizacion', label: 'Sanitización del Sistema' },
            { key: 'resumen', label: 'Resumen y Recomendaciones', multiline: true, rows: 6, fullWidth: true },
        ],
    },
];

const REMITO_PARAMETER_PAIRS = [
    { label: 'Fugas visibles', foundKey: 'fugas_found', leftKey: 'fugas_left' },
    { label: 'Conductividad Agua de Red (µS/cm)', foundKey: 'cond_red_found', leftKey: 'cond_red_left' },
    { label: 'Conductividad Permeado (µS/cm)', foundKey: 'cond_perm_found', leftKey: 'cond_perm_left' },
    { label: '% de Rechazo Iónico', foundKey: 'rechazo_found', leftKey: 'rechazo_left' },
    { label: 'Presión Entrada a Membrana (bar)', foundKey: 'presion_found', leftKey: 'presion_left' },
    { label: 'Caudal de Permeado (l/min)', foundKey: 'caudal_perm_found', leftKey: 'caudal_perm_left' },
    { label: 'Caudal de Rechazo (l/min)', foundKey: 'caudal_rech_found', leftKey: 'caudal_rech_left' },
    { label: 'Relación Rechazo : Permeado', foundKey: 'relacion_found', leftKey: 'relacion_left' },
    { label: 'Precarga del tanque (bar)', foundKey: 'precarga_found', leftKey: 'precarga_left' },
    { label: 'Test Presostato Alta', foundKey: 'presostato_alta_found', leftKey: 'presostato_alta_left' },
    { label: 'Test Presostato Baja', foundKey: 'presostato_baja_found', leftKey: 'presostato_baja_left' },
];

function cloneReportData(data) {
    if (!data || typeof data !== 'object') {
        return {};
    }
    try {
        return JSON.parse(JSON.stringify(data));
    } catch (error) {
        console.warn('No se pudo clonar el reporte para el remito:', error);
        return { ...data };
    }
}

function formatDateValue(value) {
    if (!value) {
        return '';
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return `${value}`.trim();
    }

    return parsed.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}

function formatDisplayValue(value) {
    if (Array.isArray(value)) {
        return value.map(item => formatDisplayValue(item)).join(', ');
    }
    if (value === null || value === undefined) {
        return '';
    }
    return `${value}`.trim();
}

function createRemitoCardElements(title, description) {
    const card = document.createElement('div');
    card.className = 'form-card';

    const section = document.createElement('div');
    section.className = 'form-section';

    if (title) {
        const heading = document.createElement('h3');
        heading.className = 'text-xl font-semibold text-gray-800 mb-4';
        heading.textContent = title;
        section.appendChild(heading);
    }

    if (description) {
        const descriptionEl = document.createElement('p');
        descriptionEl.className = 'text-sm text-gray-500 mb-4';
        descriptionEl.textContent = description;
        section.appendChild(descriptionEl);
    }

    card.appendChild(section);
    return { card, section };
}

function createReadOnlyControl(value, { multiline = false, rows, id } = {}) {
    const normalized = formatDisplayValue(value);

    if (multiline) {
        const textarea = document.createElement('textarea');
        textarea.className = 'w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-100 text-gray-800';
        textarea.value = normalized;
        textarea.readOnly = true;
        textarea.setAttribute('aria-readonly', 'true');
        textarea.rows = typeof rows === 'number' && rows > 0 ? rows : 4;
        textarea.tabIndex = -1;
        if (id) {
            textarea.id = id;
        }
        return textarea;
    }

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-100 text-gray-800';
    input.value = normalized;
    input.readOnly = true;
    input.setAttribute('aria-readonly', 'true');
    input.tabIndex = -1;
    if (id) {
        input.id = id;
    }
    return input;
}

function renderRemitoFieldsGroup(group, data) {
    const { card, section } = createRemitoCardElements(group.title, group.description);
    const grid = document.createElement('div');
    const columnsClass = group.columns === 1 ? 'md:grid-cols-1' : 'md:grid-cols-2';
    grid.className = `grid grid-cols-1 ${columnsClass} gap-x-6 gap-y-4`;

    group.fields.forEach(field => {
        const wrapper = document.createElement('div');
        wrapper.className = 'input-group flex flex-col gap-1';
        if (field.fullWidth) {
            wrapper.classList.add('md:col-span-2');
        }

        const label = document.createElement('label');
        label.className = 'font-semibold text-gray-700';
        const labelText = field.label || field.key;
        label.textContent = labelText;

        const fieldId = `remito-${field.key}`;
        label.setAttribute('for', fieldId);

        const formatter = typeof field.formatter === 'function' ? field.formatter : formatDisplayValue;
        const value = formatter(data[field.key], data);
        const control = createReadOnlyControl(value, {
            multiline: Boolean(field.multiline),
            rows: field.rows,
            id: fieldId,
        });

        wrapper.appendChild(label);
        wrapper.appendChild(control);
        grid.appendChild(wrapper);
    });

    section.appendChild(grid);
    return card;
}

function renderRemitoParametersGroup(group, data) {
    const { card, section } = createRemitoCardElements(group.title, group.description);
    const table = document.createElement('table');
    table.className = 'min-w-full divide-y divide-gray-200 border border-gray-200';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const headers = ['Parámetro', "Estado Inicial ('As Found')", "Estado Final ('As Left')"];
    headers.forEach((headerText, index) => {
        const th = document.createElement('th');
        th.scope = 'col';
        th.className = `px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 ${index === 0 ? '' : 'text-center'}`.trim();
        th.textContent = headerText;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);

    const tbody = document.createElement('tbody');
    tbody.className = 'divide-y divide-gray-200 bg-white';

    const pairs = Array.isArray(group.pairs) && group.pairs.length ? group.pairs : REMITO_PARAMETER_PAIRS;

    pairs.forEach(pair => {
        const row = document.createElement('tr');
        row.className = 'odd:bg-gray-50';

        const labelCell = document.createElement('td');
        labelCell.className = 'px-4 py-2 text-sm font-medium text-gray-700';
        labelCell.textContent = pair.label;

        const foundCell = document.createElement('td');
        foundCell.className = 'px-4 py-2 text-center';
        const foundValue = formatDisplayValue(data[pair.foundKey]);
        foundCell.appendChild(createReadOnlyControl(foundValue, { id: `remito-${pair.foundKey}` }));

        const leftCell = document.createElement('td');
        leftCell.className = 'px-4 py-2 text-center';
        const leftValue = formatDisplayValue(data[pair.leftKey]);
        leftCell.appendChild(createReadOnlyControl(leftValue, { id: `remito-${pair.leftKey}` }));

        row.append(labelCell, foundCell, leftCell);
        tbody.appendChild(row);
    });

    table.append(thead, tbody);
    section.appendChild(table);
    return card;
}

function renderRemitoComponentsGroup(group, data) {
    const { card, section } = createRemitoCardElements(group.title, group.description);
    const table = document.createElement('table');
    table.className = 'min-w-full divide-y divide-gray-200 border border-gray-200';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const headerLabels = ['Etapa', 'Detalle del Componente', 'Acción Realizada'];
    headerLabels.forEach((label, index) => {
        const th = document.createElement('th');
        th.scope = 'col';
        th.className = `px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 ${index === 0 ? '' : 'text-center'}`.trim();
        th.textContent = label;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);

    const tbody = document.createElement('tbody');
    tbody.className = 'divide-y divide-gray-200 bg-white';

    const stages = Array.isArray(COMPONENT_STAGES) ? COMPONENT_STAGES : [];
    stages.forEach(stage => {
        const row = document.createElement('tr');
        row.className = 'odd:bg-gray-50';

        const stageCell = document.createElement('td');
        stageCell.className = 'px-4 py-2 text-sm font-medium text-gray-700';
        stageCell.textContent = stage.title || stage.id;

        const detailsCell = document.createElement('td');
        detailsCell.className = 'px-4 py-2';
        const detailsKey = `${stage.id}_detalles`;
        detailsCell.appendChild(createReadOnlyControl(data[detailsKey], { id: `remito-${detailsKey}` }));

        const actionCell = document.createElement('td');
        actionCell.className = 'px-4 py-2 text-center';
        const actionKey = `${stage.id}_accion`;
        actionCell.appendChild(createReadOnlyControl(data[actionKey], { id: `remito-${actionKey}` }));

        row.append(stageCell, detailsCell, actionCell);
        tbody.appendChild(row);
    });

    table.append(thead, tbody);
    section.appendChild(table);
    return card;
}

function getRemitoSectionsContainer() {
    return document.getElementById('remito-sections');
}

function updateRemitoHeader(data) {
    const reportNumberEl = document.getElementById('remito-report-number');
    const reportDateEl = document.getElementById('remito-report-date');

    if (reportNumberEl) {
        reportNumberEl.textContent = formatDisplayValue(data?.numero_reporte) || '—';
    }

    if (reportDateEl) {
        const formattedDate = formatDateValue(data?.fecha) || '—';
        reportDateEl.textContent = formattedDate;
    }
}

function populateRemitoView(data) {
    const sectionsContainer = getRemitoSectionsContainer();
    if (!sectionsContainer) {
        return;
    }

    sectionsContainer.innerHTML = '';
    updateRemitoHeader(data);

    REMITO_FIELD_GROUPS.forEach(group => {
        if (group.type === 'fields') {
            sectionsContainer.appendChild(renderRemitoFieldsGroup(group, data));
        } else if (group.type === 'pairs') {
            sectionsContainer.appendChild(renderRemitoParametersGroup(group, data));
        } else if (group.type === 'components') {
            sectionsContainer.appendChild(renderRemitoComponentsGroup(group, data));
        }
    });
}

function showMaintenanceView() {
    const maintenanceView = document.getElementById('maintenance-view');
    const remitoView = document.getElementById('remito-view');

    if (maintenanceView) {
        maintenanceView.classList.remove('hidden');
    }

    if (remitoView) {
        remitoView.classList.add('hidden');
    }
}

function showRemitoView() {
    if (!lastSavedReport) {
        alert('Para generar el remito primero debes guardar el mantenimiento.');
        return;
    }

    populateRemitoView(lastSavedReport);

    const maintenanceView = document.getElementById('maintenance-view');
    const remitoView = document.getElementById('remito-view');

    if (maintenanceView) {
        maintenanceView.classList.add('hidden');
    }

    if (remitoView) {
        remitoView.classList.remove('hidden');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
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

function showTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));

    const tabElement = document.getElementById(`tab-${tabName}`);
    if (tabElement) {
        tabElement.classList.remove('hidden');
    }

    const tabButton = document.getElementById(`tab-${tabName}-btn`);
    if (tabButton) {
        tabButton.classList.add('active');
    }

    if (tabName === 'nuevo') {
        showMaintenanceView();
    } else if (tabName === 'dashboard') {
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
        lastSavedReport = cloneReportData(datos);
        alert('✅ Mantenimiento guardado correctamente en el sistema');

        setReportNumber(reportNumber);

        setTimeout(() => {
            try {
                window.print();
            } catch (printError) {
                console.error('Error al imprimir el mantenimiento guardado:', printError);
            } finally {
                resetForm();
            }
        }, 500);
    } catch (error) {
        console.error('Error al guardar mantenimiento:', error);
        const message = error?.message || 'Error desconocido al guardar los datos.';
        alert(`❌ Error al guardar los datos: ${message}`);
    } finally {
        guardarBtn.textContent = originalText;
        guardarBtn.disabled = false;
    }
}

function handleGenerarRemitoClick() {
    showRemitoView();
}

function handleVolverFormularioClick() {
    showMaintenanceView();
}

function handleImprimirRemitoClick() {
    try {
        window.print();
    } catch (error) {
        console.error('Error al imprimir el remito:', error);
    }
}

export const __testables__ = {
    handleGuardarClick,
};

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

async function loadDashboard() {
    try {
        const data = await obtenerDashboard();
        renderDashboard(data);
    } catch (error) {
        console.error('Error cargando dashboard:', error);
    }
}

function attachEventListeners() {
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
        generarRemitoBtn.addEventListener('click', (event) => {
            event.preventDefault();
            handleGenerarRemitoClick();
        });
    }

    const volverFormularioBtn = document.getElementById('volverFormularioButton');
    if (volverFormularioBtn) {
        volverFormularioBtn.addEventListener('click', (event) => {
            event.preventDefault();
            handleVolverFormularioClick();
        });
    }

    const imprimirRemitoBtn = document.getElementById('imprimirRemitoButton');
    if (imprimirRemitoBtn) {
        imprimirRemitoBtn.addEventListener('click', (event) => {
            event.preventDefault();
            handleImprimirRemitoClick();
        });
    }

    const buscarBtn = document.getElementById('buscar-btn');
    if (buscarBtn) {
        buscarBtn.addEventListener('click', (event) => {
            event.preventDefault();
            handleBuscarClick();
        });
    }

    const limpiarBtn = document.getElementById('limpiar-btn');
    if (limpiarBtn) {
        limpiarBtn.addEventListener('click', (event) => {
            event.preventDefault();
            handleLimpiarBusqueda();
        });
    }

    const cancelarEdicionBtn = document.getElementById('cancelar-edicion-btn');
    if (cancelarEdicionBtn) {
        cancelarEdicionBtn.addEventListener('click', (event) => {
            event.preventDefault();
            closeEditModal();
        });
    }

    const guardarEdicionBtn = document.getElementById('guardar-edicion-btn');
    if (guardarEdicionBtn) {
        guardarEdicionBtn.addEventListener('click', (event) => {
            event.preventDefault();
            handleGuardarEdicion();
        });
    }

    const tabNuevoBtn = document.getElementById('tab-nuevo-btn');
    if (tabNuevoBtn) {
        tabNuevoBtn.addEventListener('click', () => showTab('nuevo'));
    }

    const tabBuscarBtn = document.getElementById('tab-buscar-btn');
    if (tabBuscarBtn) {
        tabBuscarBtn.addEventListener('click', () => showTab('buscar'));
    }

    const tabDashboardBtn = document.getElementById('tab-dashboard-btn');
    if (tabDashboardBtn) {
        tabDashboardBtn.addEventListener('click', () => showTab('dashboard'));
    }
}

async function initializeSystem() {
    await initializeAuth();
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
    attachEventListeners();
    showTab('nuevo');
}

document.addEventListener('DOMContentLoaded', () => {
    showAppVersion();
    initializeSystem().catch(error => {
        console.error('Error inicializando la aplicación:', error);
        alert('No se pudo inicializar la aplicación. Revisa la consola para más detalles.');
    });
});
