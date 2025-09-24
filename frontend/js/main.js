/* global __APP_VERSION__ */
import { API_URL } from './config.js';
import { initializeAuth } from './auth.js';
import { guardarMantenimiento, buscarMantenimientos, actualizarMantenimiento, eliminarMantenimiento, obtenerDashboard, obtenerClientes } from './api.js';
import { renderDashboard } from './dashboard.js';
import { configureClientSelect, generateReportNumber, getFormData, initializeForm, resetForm, setReportNumber } from './forms.js';
import { clearSearchResults, getEditFormValues, openEditModal, closeEditModal, renderSearchResults } from './search.js';
import { renderComponentStages } from './templates.js';

const isApiConfigured = typeof API_URL === 'string' && API_URL.length > 0;

if (!isApiConfigured) {
    console.warn('API_URL no configurado. Configura window.__APP_CONFIG__.API_URL o la variable de entorno API_URL.');
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

    if (tabName === 'dashboard') {
        loadDashboard();
    }
}

async function handleGuardarClick() {
    const guardarBtn = document.getElementById('guardarButton');
    const generarRemitoBtn = document.getElementById('generarRemitoButton');
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
        alert('✅ Mantenimiento guardado correctamente en el sistema');

        if (generarRemitoBtn) {
            generarRemitoBtn.disabled = false;
        }

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
