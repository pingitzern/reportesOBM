/* global __APP_VERSION__ */
import { showView } from './viewManager.js';
import * as api from './api.js';
import { initializeAuth, getCurrentUserRole } from './modules/login/auth.js';
import { initializeTheme } from './modules/theme/theme.js';
import { createDashboardModule } from './modules/dashboard/dashboard.js';
import { createMaintenanceModule } from './modules/mantenimiento/maintenance.js';
import { setCategoriaReporte } from './modules/mantenimiento/forms.js';
import { createSearchModule } from './modules/busqueda/busqueda.js';
import { createRemitoModule } from './modules/remito/remito.js';
import { createRemitosGestionModule } from './modules/remitos-gestion/remitos-gestion.js';
import { createMantenimientosGestionModule } from './modules/mantenimientos-gestion/mantenimientos-gestion.js';
import { createSoftenerModule } from './modules/mantenimiento-ablandador/ablandador.js';
import { createFeedbackModule } from './modules/feedback/feedback.js';
import { createAdminPanelModule } from './modules/admin/adminPanel.js';
import { initEquipmentHistory } from './modules/equipmentHistory/equipmentHistory.js';
import { supabase } from './supabaseClient.js';
import { mountScheduler } from './modules/agenda/index.tsx';

const {
    guardarMantenimiento,
    guardarMantenimientoAblandador,
    buscarMantenimientos,
    actualizarMantenimiento,
    eliminarMantenimiento,
    obtenerDashboard,
    obtenerClientes,
    obtenerRemitos,
    crearRemito,
    actualizarRemito,
    eliminarRemito,
    obtenerVersionServidor,
    enviarFeedbackTicket,
    obtenerUrlPdfRemito,
    guardarPdfRemito,
    generarPdfMantenimiento,
    obtenerUrlPdfMantenimiento,
} = api;

initializeTheme();

// Cargar Google Maps API si está configurada
const googleMapsApiKey = import.meta.env?.VITE_GOOGLE_MAPS_API_KEY || '';
if (googleMapsApiKey && typeof window.loadGoogleMaps === 'function') {
    window.loadGoogleMaps(googleMapsApiKey);
}

function navigateToMantenimientos() {
    showView('mantenimientos-gestion-view');
    setActiveNavigation(null, 'tab-mantenimientos-btn');
    // Recargar lista de mantenimientos
    if (appModules.mantenimientosGestion) {
        appModules.mantenimientosGestion.loadMantenimientos();
    }
}

// eslint-disable-next-line no-unused-vars
function navigateToDashboard() {
    showView('tab-dashboard');
    setActiveNavigation('dashboard');
}

const remitoModule = createRemitoModule({
    showView,
    crearRemito,
    guardarPdfRemito,
    navigateToDashboard: navigateToMantenimientos, // Ahora va a mantenimientos después del remito
    onRemitoComplete: () => {
        // Limpiar formularios de mantenimiento después de completar el remito
        if (appModules.maintenance && typeof appModules.maintenance.handleResetClick === 'function') {
            appModules.maintenance.handleResetClick();
        }
        if (appModules.softener && typeof appModules.softener.silentReset === 'function') {
            appModules.softener.silentReset();
        }
        // Volver al panel de mantenimientos
        navigateToMantenimientos();
    },
});

const maintenanceModule = createMaintenanceModule(
    {
        guardarMantenimiento,
        obtenerClientes,
    },
    {
        onReportSaved: datos => {
            remitoModule.handleMaintenanceSaved(datos);
        },
        onReportReset: () => {
            remitoModule.reset();
        },
    },
);

const searchModule = createSearchModule(
    {
        buscarMantenimientos,
        actualizarMantenimiento,
        eliminarMantenimiento,
    },
    {
        showView,
    },
);

const dashboardModule = createDashboardModule(
    { obtenerDashboard },
    { showView },
);

const remitosGestionModule = createRemitosGestionModule({
    obtenerRemitos,
    crearRemito,
    actualizarRemito,
    eliminarRemito,
    obtenerClientes,
    obtenerUrlPdfRemito,
    guardarPdfRemito,
});

const softenerModule = createSoftenerModule({
    showView,
    guardarMantenimientoAblandador,
    obtenerClientes,
    remitoModule,
    onMaintenanceSaved: (reportData) => {
        if (remitoModule && typeof remitoModule.handleMaintenanceSaved === 'function') {
            remitoModule.handleMaintenanceSaved(reportData);
        }
    },
});

const feedbackModule = createFeedbackModule({
    enviarFeedbackTicket,
});

const adminPanelModule = createAdminPanelModule();

const mantenimientosGestionModule = createMantenimientosGestionModule({
    buscarMantenimientos,
    generarPdfMantenimiento,
    obtenerUrlPdfMantenimiento,
    showView,
    onNuevoReporte: () => openMaintenanceTypeModal(),
});

const appModules = {
    maintenance: maintenanceModule,
    remito: remitoModule,
    search: searchModule,
    dashboard: dashboardModule,
    remitosGestion: remitosGestionModule,
    mantenimientosGestion: mantenimientosGestionModule,
    softener: softenerModule,
    feedback: feedbackModule,
    adminPanel: adminPanelModule,
};

const SECTION_LABELS = Object.freeze({
    'tab-dashboard': 'Dashboard',
    'mantenimientos-gestion-view': 'Mantenimientos',
    'tab-nuevo': 'Mantenimiento Ósmosis',
    'tab-ablandador': 'Mantenimiento Ablandador',
    'tab-buscar': 'Buscar y Editar',
    'remito-view': 'Generación de Remito',
    'remitos-gestion-view': 'Gestión de Remitos',
    'admin-panel-view': 'Panel de Administración',
});

function resolveSectionTitle(viewId) {
    if (typeof viewId === 'string' && SECTION_LABELS[viewId]) {
        return SECTION_LABELS[viewId];
    }
    return 'Portal de Gestión';
}

function updateSectionTitle(viewId) {
    const target = document.getElementById('current-section-title');
    if (!target) {
        return;
    }
    target.textContent = resolveSectionTitle(viewId);
}

document.addEventListener('view:changed', event => {
    const viewId = event?.detail?.viewId;
    if (!viewId) {
        return;
    }
    updateSectionTitle(viewId);
});

function setTextOrHide(element, text) {
    if (!element) {
        return;
    }

    if (typeof text === 'string' && text.trim()) {
        element.textContent = text.trim();
        element.classList.remove('hidden');
    } else {
        element.textContent = '';
        element.classList.add('hidden');
    }
}

function showAppVersion() {
    const versionElement = document.getElementById('app-version-menu');
    if (!versionElement) {
        return;
    }

    if (typeof __APP_VERSION__ !== 'undefined') {
        const versionValue = `${__APP_VERSION__}`.trim();
        if (versionValue) {
            setTextOrHide(versionElement, `Frontend v${versionValue}`);
            return;
        }
    }

    setTextOrHide(versionElement, '');
}

function formatScriptVersion(rawInfo) {
    if (!rawInfo) {
        return '';
    }

    if (typeof rawInfo === 'string') {
        const trimmed = rawInfo.trim();
        return trimmed ? `Scripts ${trimmed}` : '';
    }

    if (typeof rawInfo !== 'object') {
        return '';
    }

    const info = rawInfo;
    const parts = [];

    if (info.versionNumber !== undefined && info.versionNumber !== null) {
        parts.push(`#${info.versionNumber}`);
    }

    if (typeof info.description === 'string' && info.description.trim()) {
        parts.push(info.description.trim());
    }

    if (!parts.length && typeof info.label === 'string' && info.label.trim()) {
        parts.push(info.label.trim());
    }

    if (!parts.length && typeof info.deploymentId === 'string' && info.deploymentId.trim()) {
        parts.push(`ID ${info.deploymentId.trim()}`);
    }

    let label = parts.join(' – ');

    if (typeof info.generatedAt === 'string') {
        const generatedDate = new Date(info.generatedAt);
        if (!Number.isNaN(generatedDate.getTime())) {
            const locale = navigator?.language || 'es-AR';
            const formattedDate = generatedDate.toLocaleString(locale, {
                dateStyle: 'short',
                timeStyle: 'short',
            });
            if (formattedDate) {
                label = label ? `${label} · ${formattedDate}` : formattedDate;
            }
        }
    }

    return label ? `Scripts ${label}` : '';
}

// eslint-disable-next-line no-unused-vars
async function showScriptVersion() {
    const versionElement = document.getElementById('script-version-menu');
    if (!versionElement) {
        return;
    }

    try {
        const info = await obtenerVersionServidor();
        const formatted = formatScriptVersion(info);
        if (formatted) {
            setTextOrHide(versionElement, formatted);
        } else {
            setTextOrHide(versionElement, 'Scripts versión no disponible');
        }
    } catch (error) {
        console.error('No se pudo obtener la versión de los scripts:', error);
        setTextOrHide(versionElement, 'Scripts versión no disponible');
    }
}

function initializeHelpToggle() {
    const helpButton = document.getElementById('help-menu-item');
    const helpInfo = document.getElementById('help-info');

    if (helpButton && helpInfo) {
        helpButton.addEventListener('click', (e) => {
            e.preventDefault();
            helpInfo.classList.toggle('hidden');
        });
    }
}

function setActiveNavigation(tabName, customButtonId) {
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    let tabButton = null;

    if (typeof customButtonId === 'string' && customButtonId) {
        tabButton = document.getElementById(customButtonId);
    }

    if (!tabButton && typeof tabName === 'string' && tabName) {
        tabButton = document.getElementById(`tab-${tabName}-btn`);
    }

    if (tabButton) {
        tabButton.classList.add('active');
    }
}

function showMaintenanceTab() {
    // Limpiar formulario de ablandador al cambiar a ósmosis
    if (appModules.softener && typeof appModules.softener.silentReset === 'function') {
        appModules.softener.silentReset();
    }
    setCategoriaReporte('osmosis');
    showView('tab-nuevo');
    setActiveNavigation('nuevo');
}

function showSoftenerTab() {
    // Limpiar formulario de ósmosis al cambiar a ablandador
    if (appModules.maintenance && typeof appModules.maintenance.handleResetClick === 'function') {
        appModules.maintenance.handleResetClick();
    }
    setCategoriaReporte('ablandador');
    appModules.softener.show();
    setActiveNavigation('nuevo');
}

function getMaintenanceModalElements() {
    return {
        modal: document.getElementById('maintenance-type-modal'),
        backdrop: document.getElementById('maintenance-type-backdrop'),
    };
}

function openMaintenanceTypeModal() {
    const { modal, backdrop } = getMaintenanceModalElements();
    if (backdrop) {
        backdrop.classList.remove('hidden');
    }
    if (modal) {
        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');
    }
}

function closeMaintenanceTypeModal() {
    const { modal, backdrop } = getMaintenanceModalElements();
    if (backdrop) {
        backdrop.classList.add('hidden');
    }
    if (modal) {
        modal.classList.add('hidden');
        modal.setAttribute('aria-hidden', 'true');
    }
}

function showSearchTab() {
    appModules.search.show();
    setActiveNavigation('buscar');
}

let historyInitialized = false;

async function showDashboardTab() {
    setActiveNavigation('dashboard');
    await appModules.dashboard.show();

    // Inicializar historial de equipos una sola vez
    if (!historyInitialized) {
        const target = document.getElementById('equipment-history-target');
        if (target) {
            await initEquipmentHistory(api, supabase, target);
            historyInitialized = true;
        }
    }
}

function initializeNavigation() {
    const tabMantenimientosBtn = document.getElementById('tab-mantenimientos-btn');
    if (tabMantenimientosBtn) {
        tabMantenimientosBtn.addEventListener('click', () => {
            showView('mantenimientos-gestion-view');
            setActiveNavigation(null, 'tab-mantenimientos-btn');
            appModules.mantenimientosGestion.loadMantenimientos();
        });
    }

    const tabBuscarBtn = document.getElementById('tab-buscar-btn');
    if (tabBuscarBtn) {
        tabBuscarBtn.addEventListener('click', () => {
            showSearchTab();
        });
    }

    const tabDashboardBtn = document.getElementById('tab-dashboard-btn');
    if (tabDashboardBtn) {
        tabDashboardBtn.addEventListener('click', () => {
            void showDashboardTab();
        });
    }

    const remitosBtn = document.getElementById('nav-remitos-btn');
    if (remitosBtn) {
        remitosBtn.addEventListener('click', () => {
            showView('remitos-gestion-view');
            setActiveNavigation(null, 'nav-remitos-btn');
            void remitosGestionModule.renderListado({ page: 1 });
        });
    }

    // Agenda button - lazy load scheduler
    let schedulerMounted = false;
    const agendaBtn = document.getElementById('nav-agenda-btn');
    if (agendaBtn) {
        agendaBtn.addEventListener('click', () => {
            showView('agenda-view');
            setActiveNavigation(null, 'nav-agenda-btn');
            if (!schedulerMounted) {
                mountScheduler('scheduler-root');
                schedulerMounted = true;
            }
        });
    }

    const modalOsmosisBtn = document.getElementById('maintenance-type-osmosis');
    if (modalOsmosisBtn) {
        modalOsmosisBtn.addEventListener('click', () => {
            showMaintenanceTab();
            closeMaintenanceTypeModal();
        });
    }

    const modalSoftenerBtn = document.getElementById('maintenance-type-softener');
    if (modalSoftenerBtn) {
        modalSoftenerBtn.addEventListener('click', () => {
            showSoftenerTab();
            closeMaintenanceTypeModal();
        });
    }

    const modalCancelBtn = document.getElementById('maintenance-type-cancel');
    if (modalCancelBtn) {
        modalCancelBtn.addEventListener('click', () => {
            closeMaintenanceTypeModal();
        });
    }

    const { modal, backdrop } = getMaintenanceModalElements();
    if (backdrop) {
        backdrop.addEventListener('click', () => {
            closeMaintenanceTypeModal();
        });
    }

    if (modal) {
        modal.addEventListener('click', event => {
            if (event.target === modal) {
                closeMaintenanceTypeModal();
            }
        });
    }
}

async function initializeApp() {
    showAppVersion();
    // showScriptVersion(); // Disabled while legacy API is offline
    initializeNavigation();
    initializeHelpToggle();
    appModules.feedback.initialize();
    // Inicializar módulos que no requieren autenticación
    appModules.remito.initialize();
    appModules.search.initialize();
    appModules.remitosGestion.initialize();
    appModules.mantenimientosGestion.initialize();

    try {
        // Primero autenticar
        await initializeAuth();

        // Inicializar panel de administración (muestra/oculta opción según rol)
        appModules.adminPanel.init();

        // Después inicializar módulos que requieren datos del backend
        await appModules.maintenance.initialize();
        appModules.softener.initialize();

        // Redirigir según el rol del usuario
        const userRole = getCurrentUserRole();
        console.log('[main] Usuario autenticado con rol:', userRole);

        if (userRole === 'Administrador' || userRole === 'admin') {
            // Admins van al dashboard
            showView('tab-dashboard');
            setActiveNavigation('dashboard');
            appModules.dashboard.show();
        } else if (userRole === 'Técnico' || userRole === 'tecnico') {
            // Técnicos van a gestión de remitos
            showView('remitos-gestion-view');
            setActiveNavigation('remitos');
            // Cargar el listado de remitos automáticamente
            void appModules.remitosGestion.renderListado({ page: 1 });
        } else {
            // Fallback: mostrar panel de mantenimientos
            showView('mantenimientos-gestion-view');
            setActiveNavigation(null, 'tab-mantenimientos-btn');
            appModules.mantenimientosGestion.loadMantenimientos();
        }
    } catch (error) {
        console.error('Error inicializando la aplicación:', error);
        alert('No se pudo inicializar la aplicación. Revisa la consola para más detalles.');
    }
}

export const __testables__ = {
    handleGuardarClick: () => appModules.maintenance.handleGuardarClick(),
    handleGenerarRemitoClick: () => appModules.remito.handleGenerarRemitoClick(),
    handleFinalizarRemitoClick: () => appModules.remito.handleFinalizarRemitoClick(),
    showView,
    setLastSavedReportDataForTests: data => appModules.remito.setLastSavedReportForTests(data),
    getLastSavedReportDataForTests: () => appModules.remito.getLastSavedReportForTests(),
    initializeRemitoModuleForTests: () => appModules.remito.initialize(),
};

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

