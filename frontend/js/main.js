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

