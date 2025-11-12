/* global __APP_VERSION__ */
import { showView } from './viewManager.js';
import * as api from './api.js';
import { API_URL } from './config.js';
import { initializeAuth, getCurrentToken } from './modules/login/auth.js';
import { initializeTheme } from './modules/theme/theme.js';
import { createDashboardModule } from './modules/dashboard/dashboard.js';
import { createMaintenanceModule } from './modules/mantenimiento/maintenance.js';
import { createSearchModule } from './modules/busqueda/busqueda.js';
import { createRemitoModule } from './modules/remito/remito.js';
import { createRemitosGestionModule } from './modules/remitos-gestion/remitos-gestion.js';

const {
    guardarMantenimiento,
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
} = api;

initializeTheme();

const remitoModule = createRemitoModule({
    showView,
    apiUrl: API_URL,
    getToken: getCurrentToken,
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
});

const appModules = {
    maintenance: maintenanceModule,
    remito: remitoModule,
    search: searchModule,
    dashboard: dashboardModule,
    remitosGestion: remitosGestionModule,
};

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
    const versionElement = document.getElementById('app-version');
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

async function showScriptVersion() {
    const versionElement = document.getElementById('script-version');
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
    showView('tab-nuevo');
    setActiveNavigation('nuevo');
}

function showSearchTab() {
    appModules.search.show();
    setActiveNavigation('buscar');
}

async function showDashboardTab() {
    setActiveNavigation('dashboard');
    await appModules.dashboard.show();
}

function initializeNavigation() {
    const tabNuevoBtn = document.getElementById('tab-nuevo-btn');
    if (tabNuevoBtn) {
        tabNuevoBtn.addEventListener('click', () => {
            showMaintenanceTab();
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
}

async function initializeApp() {
    showAppVersion();
    void showScriptVersion();
    initializeNavigation();
    appModules.remito.initialize();
    appModules.search.initialize();
    appModules.remitosGestion.initialize();

    try {
        await initializeAuth();
        await appModules.maintenance.initialize();
        await showDashboardTab();
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

