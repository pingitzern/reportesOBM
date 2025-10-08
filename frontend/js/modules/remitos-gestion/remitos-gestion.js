import { obtenerRemitos } from '../../api.js';

const DEFAULT_PAGE_SIZE = 20;

function pickValue(source, keys) {
    if (!source || typeof source !== 'object' || !Array.isArray(keys)) {
        return undefined;
    }

    for (const key of keys) {
        if (!key || typeof key !== 'string') {
            continue;
        }

        const value = source[key];
        if (value !== undefined && value !== null && value !== '') {
            return value;
        }
    }

    return undefined;
}

function sanitizeString(value) {
    if (value === null || value === undefined) {
        return '';
    }

    if (typeof value === 'string') {
        return value.trim();
    }

    if (typeof value === 'number') {
        return Number.isFinite(value) ? String(value) : '';
    }

    if (Object.prototype.toString.call(value) === '[object Date]' && !Number.isNaN(value.getTime())) {
        try {
            return value.toLocaleDateString('es-AR');
        } catch (error) {
            return value.toISOString();
        }
    }

    return String(value).trim();
}

function formatIsoToDisplay(value) {
    if (value === null || value === undefined) {
        return '';
    }

    if (Object.prototype.toString.call(value) === '[object Date]' && !Number.isNaN(value.getTime())) {
        try {
            return value.toLocaleDateString('es-AR');
        } catch (error) {
            return value.toISOString();
        }
    }

    if (typeof value === 'number') {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) {
            try {
                return parsed.toLocaleDateString('es-AR');
            } catch (error) {
                return parsed.toISOString().split('T')[0] || '';
            }
        }
        return '';
    }

    if (typeof value !== 'string') {
        return '';
    }

    const trimmed = value.trim();
    if (!trimmed) {
        return '';
    }

    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
        return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
        try {
            return parsed.toLocaleDateString('es-AR');
        } catch (error) {
            return trimmed;
        }
    }

    return trimmed;
}

function formatDateValue(primary, isoValue) {
    const primaryValue = sanitizeString(primary);
    if (primaryValue) {
        return primaryValue;
    }

    return formatIsoToDisplay(isoValue);
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getDisplayValue(value) {
    const sanitized = sanitizeString(value);
    return sanitized || '—';
}

function normalizeRemitoForDisplay(remito) {
    if (!remito || typeof remito !== 'object') {
        return {
            numeroRemito: '',
            numeroReporte: '',
            cliente: '',
            fechaRemito: '',
            fechaRemitoISO: '',
            fechaServicio: '',
            fechaServicioISO: '',
            tecnico: '',
            observaciones: '',
            direccion: '',
            telefono: '',
            email: '',
            reporteId: '',
        };
    }

    const fechaRemitoISO = remito.fechaRemitoISO ?? remito.FechaRemitoISO;
    const fechaServicioISO = remito.fechaServicioISO ?? remito.FechaServicioISO;

    const numeroRemitoValue = pickValue(remito, ['numeroRemito', 'NumeroRemito']);
    const numeroReporteValue = pickValue(remito, ['numeroReporte', 'NumeroReporte']);
    const clienteValue = pickValue(remito, ['cliente', 'Cliente', 'NombreCliente']);
    const fechaRemitoValue = pickValue(remito, ['fechaRemito', 'FechaRemito', 'FechaCreacion']);
    const fechaRemitoIsoValue = pickValue(remito, ['fechaRemitoISO', 'FechaRemitoISO', 'FechaCreacionISO']);
    const fechaServicioValue = pickValue(remito, ['fechaServicio', 'FechaServicio']);
    const tecnicoValue = pickValue(remito, ['tecnico', 'Tecnico', 'MailTecnico']);
    const observacionesValue = pickValue(remito, ['observaciones', 'Observaciones']);
    const direccionValue = pickValue(remito, ['direccion', 'Direccion']);
    const telefonoValue = pickValue(remito, ['telefono', 'Telefono']);
    const emailValue = pickValue(remito, ['email', 'Email', 'MailCliente']);
    const reporteIdValue = pickValue(remito, ['reporteId', 'ReporteID', 'IdUnico', 'IDInterna']);

    return {
        numeroRemito: sanitizeString(numeroRemitoValue),
        numeroReporte: sanitizeString(numeroReporteValue),
        cliente: sanitizeString(clienteValue),
        fechaRemito: formatDateValue(
            fechaRemitoValue,
            fechaRemitoIsoValue ?? fechaRemitoISO
        ),
        fechaRemitoISO: sanitizeString(fechaRemitoIsoValue ?? fechaRemitoISO),
        fechaServicio: formatDateValue(fechaServicioValue, fechaServicioISO),
        fechaServicioISO: sanitizeString(fechaServicioISO),
        tecnico: sanitizeString(tecnicoValue),
        observaciones: sanitizeString(observacionesValue),
        direccion: sanitizeString(direccionValue),
        telefono: sanitizeString(telefonoValue),
        email: sanitizeString(emailValue),
        reporteId: sanitizeString(reporteIdValue),
    };
}

const state = {
    remitos: [],
    currentPage: 1,
    totalPages: 0,
    totalItems: 0,
    pageSize: DEFAULT_PAGE_SIZE,
    isLoading: false,
    lastError: null,
};

function getContainerElement() {
    return document.getElementById('remitos-gestion-container');
}

function showLoadingState() {
    const container = getContainerElement();
    if (!container) {
        return;
    }

    container.innerHTML = `
        <div class="flex items-center justify-center rounded-xl border border-gray-200 bg-white p-10 shadow-sm">
            <span class="text-gray-600 text-sm font-medium">Cargando remitos...</span>
        </div>
    `;
}

function showErrorState(message) {
    const container = getContainerElement();
    if (!container) {
        return;
    }

    const safeMessage = escapeHtml(message || 'Ocurrió un error inesperado al obtener los remitos.');

    container.innerHTML = `
        <div class="rounded-xl border border-red-200 bg-red-50 p-6 shadow-sm">
            <h3 class="text-base font-semibold text-red-700 mb-2">No se pudieron cargar los remitos</h3>
            <p class="text-sm text-red-600 mb-4">${safeMessage}</p>
            <button type="button" class="inline-flex items-center rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1" data-remitos-action="reload">
                Reintentar
            </button>
        </div>
    `;
}

function showEmptyState() {
    const container = getContainerElement();
    if (!container) {
        return;
    }

    container.innerHTML = `
        <div class="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center shadow-sm">
            <h3 class="text-lg font-semibold text-gray-700 mb-2">No se encontraron remitos</h3>
            <p class="text-gray-500 mb-6">Aún no hay remitos generados o no coinciden con los filtros seleccionados.</p>
            <button type="button" class="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1" data-remitos-action="reload">
                Actualizar
            </button>
        </div>
    `;
}

function showTableState() {
    const container = getContainerElement();
    if (!container) {
        return;
    }

    const rowsHtml = state.remitos
        .map((remito, index) => {
            const numeroRemito = escapeHtml(getDisplayValue(remito.numeroRemito));
            const fecha = escapeHtml(getDisplayValue(remito.fechaRemito));
            const cliente = escapeHtml(getDisplayValue(remito.cliente));
            const numeroReporte = escapeHtml(getDisplayValue(remito.numeroReporte));

            return `
                <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-700">${numeroRemito}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${fecha}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${cliente}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${numeroReporte}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-right">
                        <button type="button" class="text-sm font-semibold text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2" data-remito-detalle="${index}">
                            Ver Detalle
                        </button>
                    </td>
                </tr>
            `;
        })
        .join('');

    const paginationInfo = state.totalPages > 0
        ? `Página ${state.currentPage} de ${state.totalPages}`
        : 'Página 1 de 1';

    const firstItemIndex = (state.currentPage - 1) * state.pageSize + 1;
    const lastItemIndex = firstItemIndex + state.remitos.length - 1;
    const summaryInfo = state.totalItems > 0
        ? `Mostrando ${firstItemIndex} - ${lastItemIndex} de ${state.totalItems} remitos`
        : '';

    const prevDisabled = state.currentPage <= 1 ? 'disabled' : '';
    const nextDisabled = state.totalPages === 0 || state.currentPage >= state.totalPages ? 'disabled' : '';

    container.innerHTML = `
        <div class="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div class="flex flex-col gap-2 border-b border-gray-100 px-6 py-4 md:flex-row md:items-center md:justify-between">
                <h3 class="text-lg font-semibold text-gray-800">Listado de Remitos</h3>
                <span class="text-sm text-gray-500">${escapeHtml(paginationInfo)}</span>
            </div>
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Número de Remito</th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Fecha</th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Cliente</th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Número de Reporte</th>
                            <th scope="col" class="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Acciones</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200 bg-white">
                        ${rowsHtml}
                    </tbody>
                </table>
            </div>
            <div class="flex flex-col gap-3 border-t border-gray-100 px-6 py-4 md:flex-row md:items-center md:justify-between">
                <div class="text-sm text-gray-500">${escapeHtml(summaryInfo)}</div>
                <div class="flex items-center gap-3">
                    <button type="button" class="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60" data-remitos-action="prev" ${prevDisabled}>
                        Anterior
                    </button>
                    <button type="button" class="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60" data-remitos-action="next" ${nextDisabled}>
                        Siguiente
                    </button>
                </div>
            </div>
        </div>
    `;
}

function handleDetalleRemito(index) {
    if (!Array.isArray(state.remitos) || state.remitos.length === 0) {
        return;
    }

    if (!Number.isFinite(index) || index < 0 || index >= state.remitos.length) {
        return;
    }

    const remito = state.remitos[index];
    if (!remito) {
        return;
    }

    const lines = [
        `Número de Remito: ${getDisplayValue(remito.numeroRemito)}`,
        `Fecha del Remito: ${getDisplayValue(remito.fechaRemito)}`,
        `Cliente: ${getDisplayValue(remito.cliente)}`,
        `Número de Reporte: ${getDisplayValue(remito.numeroReporte)}`,
    ];

    const optionalFields = [
        ['ID del Reporte', remito.reporteId],
        ['Fecha del Servicio', remito.fechaServicio],
        ['Técnico', remito.tecnico],
        ['Dirección', remito.direccion],
        ['Teléfono', remito.telefono],
        ['Email', remito.email],
        ['Observaciones', remito.observaciones],
    ];

    optionalFields.forEach(([label, value]) => {
        const sanitized = sanitizeString(value);
        if (sanitized) {
            lines.push(`${label}: ${sanitized}`);
        }
    });

    const message = lines.join('\n');
    if (message && typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert(message);
    }
}

function handleAction(action) {
    if (!action || state.isLoading) {
        return;
    }

    if (action === 'prev') {
        if (state.currentPage > 1) {
            void renderListado({ page: state.currentPage - 1 });
        }
        return;
    }

    if (action === 'next') {
        if (state.totalPages > 0 && state.currentPage < state.totalPages) {
            void renderListado({ page: state.currentPage + 1 });
        }
        return;
    }

    if (action === 'reload') {
        const targetPage = state.currentPage && state.currentPage > 0 ? state.currentPage : 1;
        void renderListado({ page: targetPage });
    }
}

function handleContainerClick(event) {
    const actionButton = event.target.closest('[data-remitos-action]');
    if (actionButton) {
        event.preventDefault();
        handleAction(actionButton.dataset.remitosAction);
        return;
    }

    const detalleButton = event.target.closest('[data-remito-detalle]');
    if (detalleButton) {
        event.preventDefault();
        const index = Number.parseInt(detalleButton.dataset.remitoDetalle, 10);
        if (Number.isFinite(index)) {
            handleDetalleRemito(index);
        }
    }
}

async function renderListado({ page } = {}) {
    const requestedPage = Number.isFinite(Number(page)) && Number(page) > 0
        ? Math.floor(Number(page))
        : (state.currentPage && state.currentPage > 0 ? state.currentPage : 1);

    state.isLoading = true;
    state.lastError = null;
    showLoadingState();

    try {
        const data = await obtenerRemitos({ page: requestedPage, pageSize: state.pageSize });

        const remitos = Array.isArray(data?.remitos) ? data.remitos : [];
        state.remitos = remitos.map((item) => normalizeRemitoForDisplay(item));

        const totalPages = Number(data?.totalPages);
        state.totalPages = Number.isFinite(totalPages) && totalPages >= 0 ? totalPages : 0;

        const totalItems = Number(data?.totalItems);
        state.totalItems = Number.isFinite(totalItems) && totalItems >= 0 ? totalItems : state.remitos.length;

        const reportedPageSize = Number(data?.pageSize);
        if (Number.isFinite(reportedPageSize) && reportedPageSize > 0) {
            state.pageSize = Math.floor(reportedPageSize);
        }

        let currentPage = Number(data?.currentPage);
        if (!Number.isFinite(currentPage) || currentPage <= 0) {
            currentPage = state.totalPages > 0 ? 1 : 0;
        }
        state.currentPage = currentPage;

        if (!state.remitos.length) {
            showEmptyState();
        } else {
            showTableState();
        }
    } catch (error) {
        state.lastError = error;
        const message = error?.message || 'No se pudieron obtener los remitos.';
        showErrorState(message);
    } finally {
        state.isLoading = false;
    }
}

export function createRemitosGestionModule() {
    let initialized = false;

    function initialize() {
        if (initialized) {
            return;
        }

        const container = getContainerElement();
        if (!container) {
            console.warn('No se encontró el contenedor de gestión de remitos.');
            return;
        }

        container.addEventListener('click', handleContainerClick);
        initialized = true;
    }

    return {
        initialize,
        renderListado,
    };
}

export const __testables__ = {
    sanitizeString,
    formatIsoToDisplay,
    formatDateValue,
    escapeHtml,
    normalizeRemitoForDisplay,
    state,
};
