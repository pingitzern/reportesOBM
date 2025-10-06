import { obtenerRemitos } from '../../api.js';

const DEFAULT_PAGE_SIZE = 20;

const paginationState = {
    currentPage: 1,
    totalPages: 0,
    pageSize: DEFAULT_PAGE_SIZE,
};

let isLoading = false;

function getListadoContainer() {
    return document.getElementById('remitos-listado');
}

function getPaginationContainer() {
    return document.getElementById('remitos-pagination');
}

function sanitizeNumber(value, { allowZero = false, fallback = 1 } = {}) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return fallback;
    }
    const integer = Math.floor(numeric);
    if (allowZero && integer === 0) {
        return 0;
    }
    return integer > 0 ? integer : fallback;
}

function formatDate(value) {
    if (!value) {
        return '';
    }

    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
        return parsed.toLocaleDateString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });
    }

    return `${value}`.trim();
}

function resolveFieldValue(remito, keys) {
    if (!remito || typeof remito !== 'object') {
        return '';
    }

    for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i];
        if (typeof key === 'string' && key) {
            if (Object.prototype.hasOwnProperty.call(remito, key) && remito[key] !== undefined && remito[key] !== null) {
                const value = remito[key];
                if (typeof value === 'string') {
                    const trimmed = value.trim();
                    if (trimmed) {
                        return trimmed;
                    }
                } else if (value !== '') {
                    return value;
                }
            }
        }
    }

    return '';
}

function createCell(content) {
    const cell = document.createElement('td');
    cell.className = 'whitespace-nowrap px-6 py-4 text-sm text-gray-700';
    cell.textContent = content;
    return cell;
}

function createActionCell(remito) {
    const cell = document.createElement('td');
    cell.className = 'whitespace-nowrap px-6 py-4 text-sm font-medium text-blue-600';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2';
    button.textContent = 'Ver Detalle';

    const identifier = resolveFieldValue(remito, [
        'id',
        'remitoId',
        'numeroRemito',
        'numero_remito',
        'numero',
    ]);

    if (identifier) {
        button.dataset.remitoId = identifier;
    }

    cell.appendChild(button);
    return cell;
}

function buildTable(remitos) {
    const table = document.createElement('table');
    table.className = 'min-w-full divide-y divide-gray-200';

    const thead = document.createElement('thead');
    thead.className = 'bg-gray-50';

    const headerRow = document.createElement('tr');
    const headers = ['Número de Remito', 'Fecha', 'Cliente', 'Número de Reporte', 'Acciones'];

    headers.forEach((headerText) => {
        const th = document.createElement('th');
        th.scope = 'col';
        th.className = 'px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500';
        th.textContent = headerText;
        headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    tbody.className = 'divide-y divide-gray-200 bg-white';

    remitos.forEach((remito) => {
        const row = document.createElement('tr');

        const numeroRemito = resolveFieldValue(remito, [
            'numeroRemito',
            'numero_remito',
            'numeroRemitoSistema',
            'numero',
            'remito',
        ]);

        const fecha = formatDate(resolveFieldValue(remito, [
            'fecha',
            'fechaRemito',
            'fecha_servicio',
            'fechaServicio',
        ]));

        const cliente = resolveFieldValue(remito, [
            'cliente',
            'clienteNombre',
            'razonSocial',
            'nombreCliente',
        ]);

        const numeroReporte = resolveFieldValue(remito, [
            'numeroReporte',
            'numero_reporte',
            'reporte',
            'numeroReporteAsociado',
        ]);

        row.appendChild(createCell(numeroRemito));
        row.appendChild(createCell(fecha));
        row.appendChild(createCell(cliente));
        row.appendChild(createCell(numeroReporte));
        row.appendChild(createActionCell(remito));

        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    return table;
}

function renderPagination(container) {
    if (!container) {
        return;
    }

    container.innerHTML = '';

    if (paginationState.totalPages <= 0) {
        const message = document.createElement('p');
        message.className = 'text-sm text-gray-500';
        message.textContent = 'Sin remitos para mostrar.';
        container.appendChild(message);
        return;
    }

    const info = document.createElement('span');
    info.className = 'text-sm text-gray-600';
    info.textContent = `Página ${paginationState.currentPage} de ${paginationState.totalPages}`;

    const controls = document.createElement('div');
    controls.className = 'flex items-center gap-2';

    const prevButton = document.createElement('button');
    prevButton.type = 'button';
    prevButton.textContent = 'Anterior';
    prevButton.className = 'rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
    prevButton.disabled = isLoading || paginationState.currentPage <= 1;
    prevButton.addEventListener('click', () => {
        if (paginationState.currentPage > 1) {
            renderListado({ page: paginationState.currentPage - 1 });
        }
    });

    const nextButton = document.createElement('button');
    nextButton.type = 'button';
    nextButton.textContent = 'Siguiente';
    nextButton.className = 'rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
    nextButton.disabled = isLoading || paginationState.currentPage >= paginationState.totalPages;
    nextButton.addEventListener('click', () => {
        if (paginationState.currentPage < paginationState.totalPages) {
            renderListado({ page: paginationState.currentPage + 1 });
        }
    });

    controls.appendChild(prevButton);
    controls.appendChild(nextButton);

    container.appendChild(info);
    container.appendChild(controls);
}

function showLoadingState(container) {
    if (!container) {
        return;
    }

    container.innerHTML = '';
    const loadingMessage = document.createElement('p');
    loadingMessage.className = 'text-gray-500';
    loadingMessage.textContent = 'Cargando remitos...';
    container.appendChild(loadingMessage);
}

function showError(container, message) {
    if (!container) {
        return;
    }

    container.innerHTML = '';
    const errorMessage = document.createElement('p');
    errorMessage.className = 'text-red-600';
    errorMessage.textContent = message;
    container.appendChild(errorMessage);
}

function showEmptyState(container) {
    if (!container) {
        return;
    }

    container.innerHTML = '';
    const emptyMessage = document.createElement('p');
    emptyMessage.className = 'text-gray-500';
    emptyMessage.textContent = 'No se encontraron remitos para los criterios seleccionados.';
    container.appendChild(emptyMessage);
}

export async function renderListado({ page } = {}) {
    if (isLoading) {
        return;
    }

    const listadoContainer = getListadoContainer();
    const paginationContainer = getPaginationContainer();

    if (!listadoContainer) {
        console.warn('No se encontró el contenedor para el listado de remitos.');
        return;
    }

    const requestedPage = sanitizeNumber(page, { fallback: 1 });
    const pageSize = paginationState.pageSize;

    isLoading = true;
    showLoadingState(listadoContainer);
    if (paginationContainer) {
        renderPagination(paginationContainer);
    }

    try {
        const response = await obtenerRemitos({
            page: requestedPage,
            pageSize,
        });

        const remitos = Array.isArray(response?.remitos) ? response.remitos : [];
        const totalPages = sanitizeNumber(response?.totalPages, { allowZero: true, fallback: 0 });
        const currentPage = totalPages === 0
            ? 0
            : Math.min(
                sanitizeNumber(response?.currentPage, { fallback: requestedPage }),
                totalPages,
            );

        paginationState.currentPage = currentPage || 0;
        paginationState.totalPages = totalPages;

        if (!remitos.length) {
            showEmptyState(listadoContainer);
        } else {
            listadoContainer.innerHTML = '';
            listadoContainer.appendChild(buildTable(remitos));
        }

        if (paginationContainer) {
            renderPagination(paginationContainer);
        }
    } catch (error) {
        const message = error?.message || 'No se pudieron cargar los remitos.';
        showError(listadoContainer, message);
        if (paginationContainer) {
            paginationContainer.innerHTML = '';
        }
        throw error;
    } finally {
        isLoading = false;
    }
}

export const __testables__ = {
    resolveFieldValue,
    formatDate,
};

