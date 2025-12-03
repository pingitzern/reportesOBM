/**
 * Módulo de Gestión de Mantenimientos
 * Panel centralizado para ver, buscar y crear reportes de mantenimiento
 */

const DEFAULT_PAGE_SIZE = 15;

// Estado del módulo
let state = {
    mantenimientos: [],
    filteredMantenimientos: [],
    currentPage: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    filters: {
        tipo: 'todos', // 'todos', 'osmosis', 'softener'
        cliente: '',
        tecnico: '',
        fechaDesde: '',
        fechaHasta: '',
    },
    stats: {
        total: 0,
        osmosis: 0,
        ablandador: 0,
        esteMes: 0,
    },
    isLoading: false,
    pdfGenerating: {}, // Track which PDFs are being generated
};

// Dependencias inyectadas
let deps = {
    buscarMantenimientos: null,
    generarPdfMantenimiento: null,
    obtenerUrlPdfMantenimiento: null,
    showView: null,
    onNuevoReporte: null,
};

// ============================================================================
// INICIALIZACIÓN
// ============================================================================

export function createMantenimientosGestionModule(dependencies) {
    deps = { ...deps, ...dependencies };

    return {
        initialize,
        loadMantenimientos,
        navigateToPanel,
        refresh: loadMantenimientos,
    };
}

function initialize() {
    bindEventListeners();
    console.log('[mantenimientos-gestion] Módulo inicializado');
}

function bindEventListeners() {
    // Botón nuevo reporte
    const btnNuevo = document.getElementById('mant-gestion-nuevo-btn');
    if (btnNuevo) {
        btnNuevo.addEventListener('click', handleNuevoReporte);
    }

    // Filtros
    const filterTipo = document.getElementById('mant-gestion-filter-tipo');
    if (filterTipo) {
        filterTipo.addEventListener('change', handleFilterChange);
    }

    const searchInput = document.getElementById('mant-gestion-search');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleSearchChange, 300));
    }

    const filterFechaDesde = document.getElementById('mant-gestion-fecha-desde');
    const filterFechaHasta = document.getElementById('mant-gestion-fecha-hasta');
    if (filterFechaDesde) {
        filterFechaDesde.addEventListener('change', handleFilterChange);
    }
    if (filterFechaHasta) {
        filterFechaHasta.addEventListener('change', handleFilterChange);
    }

    // Paginación
    const btnPrev = document.getElementById('mant-gestion-prev-btn');
    const btnNext = document.getElementById('mant-gestion-next-btn');
    if (btnPrev) btnPrev.addEventListener('click', () => changePage(-1));
    if (btnNext) btnNext.addEventListener('click', () => changePage(1));

    // Tabs de estadísticas (filtros rápidos)
    document.querySelectorAll('[data-mant-filter]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tipo = e.currentTarget.dataset.mantFilter;
            setQuickFilter(tipo);
        });
    });
}

// ============================================================================
// NAVEGACIÓN
// ============================================================================

export function navigateToPanel() {
    if (deps.showView) {
        deps.showView('mantenimientos-gestion-view');
    }
    loadMantenimientos();
}

// ============================================================================
// CARGA DE DATOS
// ============================================================================

async function loadMantenimientos() {
    if (!deps.buscarMantenimientos) {
        console.error('[mantenimientos-gestion] buscarMantenimientos no configurado');
        return;
    }

    state.isLoading = true;
    renderLoadingState();

    try {
        // Cargar todos los mantenimientos (el filtrado se hace en cliente para mejor UX)
        const data = await deps.buscarMantenimientos({});
        state.mantenimientos = data || [];
        
        // Calcular estadísticas
        calculateStats();
        
        // Aplicar filtros
        applyFilters();
        
        // Renderizar
        renderStats();
        renderTable();
        renderPagination();
    } catch (error) {
        console.error('[mantenimientos-gestion] Error cargando mantenimientos:', error);
        renderError('No se pudieron cargar los mantenimientos');
    } finally {
        state.isLoading = false;
    }
}

function calculateStats() {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    state.stats = {
        total: state.mantenimientos.length,
        osmosis: state.mantenimientos.filter(m => m.type === 'osmosis' || m.type === 'ro').length,
        ablandador: state.mantenimientos.filter(m => m.type === 'softener' || m.type === 'ablandador').length,
        esteMes: state.mantenimientos.filter(m => {
            const fecha = new Date(m.Fecha_Servicio || m.fecha_servicio);
            return fecha >= firstDayOfMonth;
        }).length,
    };
}

// ============================================================================
// FILTRADO
// ============================================================================

function applyFilters() {
    let filtered = [...state.mantenimientos];

    // Filtro por tipo
    if (state.filters.tipo !== 'todos') {
        filtered = filtered.filter(m => {
            const tipo = m.type || '';
            if (state.filters.tipo === 'osmosis') {
                return tipo === 'osmosis' || tipo === 'ro';
            } else if (state.filters.tipo === 'ablandador') {
                return tipo === 'softener' || tipo === 'ablandador';
            }
            return true;
        });
    }

    // Filtro por búsqueda (cliente o técnico)
    if (state.filters.cliente) {
        const search = state.filters.cliente.toLowerCase();
        filtered = filtered.filter(m => {
            const cliente = (m.Cliente || m.cliente || '').toLowerCase();
            const tecnico = (m.Tecnico_Asignado || m.tecnico || '').toLowerCase();
            return cliente.includes(search) || tecnico.includes(search);
        });
    }

    // Filtro por fecha desde
    if (state.filters.fechaDesde) {
        const desde = new Date(state.filters.fechaDesde);
        filtered = filtered.filter(m => {
            const fecha = new Date(m.Fecha_Servicio || m.fecha_servicio);
            return fecha >= desde;
        });
    }

    // Filtro por fecha hasta
    if (state.filters.fechaHasta) {
        const hasta = new Date(state.filters.fechaHasta);
        hasta.setHours(23, 59, 59, 999);
        filtered = filtered.filter(m => {
            const fecha = new Date(m.Fecha_Servicio || m.fecha_servicio);
            return fecha <= hasta;
        });
    }

    state.filteredMantenimientos = filtered;
    state.currentPage = 1;
}

function handleFilterChange() {
    const filterTipo = document.getElementById('mant-gestion-filter-tipo');
    const filterFechaDesde = document.getElementById('mant-gestion-fecha-desde');
    const filterFechaHasta = document.getElementById('mant-gestion-fecha-hasta');

    state.filters.tipo = filterTipo?.value || 'todos';
    state.filters.fechaDesde = filterFechaDesde?.value || '';
    state.filters.fechaHasta = filterFechaHasta?.value || '';

    applyFilters();
    renderTable();
    renderPagination();
    updateQuickFilterButtons();
}

function handleSearchChange(e) {
    state.filters.cliente = e.target.value || '';
    applyFilters();
    renderTable();
    renderPagination();
}

function setQuickFilter(tipo) {
    state.filters.tipo = tipo;
    const filterTipo = document.getElementById('mant-gestion-filter-tipo');
    if (filterTipo) filterTipo.value = tipo;
    
    applyFilters();
    renderTable();
    renderPagination();
    updateQuickFilterButtons();
}

function updateQuickFilterButtons() {
    document.querySelectorAll('[data-mant-filter]').forEach(btn => {
        const isActive = btn.dataset.mantFilter === state.filters.tipo;
        btn.classList.toggle('ring-2', isActive);
        btn.classList.toggle('ring-offset-2', isActive);
    });
}

// ============================================================================
// PAGINACIÓN
// ============================================================================

function changePage(delta) {
    const totalPages = Math.ceil(state.filteredMantenimientos.length / state.pageSize);
    const newPage = state.currentPage + delta;
    
    if (newPage >= 1 && newPage <= totalPages) {
        state.currentPage = newPage;
        renderTable();
        renderPagination();
    }
}

function getPagedData() {
    const start = (state.currentPage - 1) * state.pageSize;
    const end = start + state.pageSize;
    return state.filteredMantenimientos.slice(start, end);
}

// ============================================================================
// RENDERIZADO
// ============================================================================

function renderStats() {
    const statTotal = document.getElementById('mant-stat-total');
    const statOsmosis = document.getElementById('mant-stat-osmosis');
    const statAblandador = document.getElementById('mant-stat-ablandador');
    const statMes = document.getElementById('mant-stat-mes');

    if (statTotal) statTotal.textContent = state.stats.total;
    if (statOsmosis) statOsmosis.textContent = state.stats.osmosis;
    if (statAblandador) statAblandador.textContent = state.stats.ablandador;
    if (statMes) statMes.textContent = state.stats.esteMes;
}

function renderTable() {
    const tbody = document.getElementById('mant-gestion-tbody');
    if (!tbody) return;

    const pageData = getPagedData();

    if (pageData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-12 text-center">
                    <div class="flex flex-col items-center gap-3">
                        <svg class="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        <p class="text-gray-500 font-medium">No se encontraron mantenimientos</p>
                        <p class="text-gray-400 text-sm">Probá ajustando los filtros o creá un nuevo reporte</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = pageData.map(m => renderTableRow(m)).join('');

    // Bind eventos de acciones
    tbody.querySelectorAll('[data-action="ver"]').forEach(btn => {
        btn.addEventListener('click', () => handleVerDetalle(btn.dataset.id));
    });

    // Bind eventos de PDF
    tbody.querySelectorAll('[data-action="pdf"]').forEach(btn => {
        btn.addEventListener('click', () => handleDescargarPdf(btn.dataset.id));
    });
}

function renderTableRow(m) {
    const fecha = formatDate(m.Fecha_Servicio || m.fecha_servicio);
    const cliente = escapeHtml(m.Cliente || m.cliente || '—');
    const tecnico = escapeHtml(m.Tecnico_Asignado || m.tecnico || '—');
    const equipo = escapeHtml(m.Modelo_Equipo || m.modelo || '—');
    const tipo = m.type || 'osmosis';
    const id = m.ID_Unico || m.id;
    const hasPdf = !!m.pdf_path;
    const isGenerating = state.pdfGenerating[id];
    
    const tipoLabel = tipo === 'softener' || tipo === 'ablandador' ? 'Ablandador' : 'Ósmosis';
    const tipoBadgeClass = tipo === 'softener' || tipo === 'ablandador' 
        ? 'bg-emerald-100 text-emerald-700' 
        : 'bg-blue-100 text-blue-700';

    // Botón PDF con estados
    const pdfButtonClass = hasPdf 
        ? 'text-green-600 hover:text-green-800 hover:bg-green-50' 
        : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50';
    const pdfButtonTitle = isGenerating 
        ? 'Generando PDF...' 
        : hasPdf 
            ? 'Descargar PDF' 
            : 'Generar PDF';
    const pdfIcon = isGenerating
        ? `<div class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>`
        : `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
               <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 11v6m0 0l-2-2m2 2l2-2" />
           </svg>`;

    return `
        <tr class="hover:bg-gray-50 transition-colors">
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="text-sm font-medium text-gray-900">${fecha}</span>
            </td>
            <td class="px-6 py-4">
                <div class="text-sm font-medium text-gray-900">${cliente}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="text-sm text-gray-600">${tecnico}</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="text-sm text-gray-600">${equipo}</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${tipoBadgeClass}">
                    ${tipoLabel}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right">
                <div class="flex items-center justify-end gap-1">
                    <button data-action="pdf" data-id="${id}" ${isGenerating ? 'disabled' : ''}
                            title="${pdfButtonTitle}"
                            class="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium ${pdfButtonClass} rounded-lg transition-colors disabled:opacity-50">
                        ${pdfIcon}
                        PDF
                    </button>
                    <button data-action="ver" data-id="${id}" 
                            class="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        Ver
                    </button>
                </div>
            </td>
        </tr>
    `;
}

function renderPagination() {
    const totalItems = state.filteredMantenimientos.length;
    const totalPages = Math.ceil(totalItems / state.pageSize);
    const start = (state.currentPage - 1) * state.pageSize + 1;
    const end = Math.min(state.currentPage * state.pageSize, totalItems);

    const infoEl = document.getElementById('mant-gestion-info');
    const prevBtn = document.getElementById('mant-gestion-prev-btn');
    const nextBtn = document.getElementById('mant-gestion-next-btn');

    if (infoEl) {
        infoEl.textContent = totalItems > 0 
            ? `Mostrando ${start}-${end} de ${totalItems} mantenimientos`
            : 'Sin resultados';
    }

    if (prevBtn) {
        prevBtn.disabled = state.currentPage <= 1;
    }
    if (nextBtn) {
        nextBtn.disabled = state.currentPage >= totalPages;
    }
}

function renderLoadingState() {
    const tbody = document.getElementById('mant-gestion-tbody');
    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="6" class="px-6 py-12 text-center">
                <div class="flex flex-col items-center gap-3">
                    <div class="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                    <p class="text-gray-500">Cargando mantenimientos...</p>
                </div>
            </td>
        </tr>
    `;
}

function renderError(message) {
    const tbody = document.getElementById('mant-gestion-tbody');
    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="6" class="px-6 py-12 text-center">
                <div class="flex flex-col items-center gap-3">
                    <svg class="w-12 h-12 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p class="text-gray-500 font-medium">${escapeHtml(message)}</p>
                    <button onclick="location.reload()" class="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
                        Reintentar
                    </button>
                </div>
            </td>
        </tr>
    `;
}

// ============================================================================
// ACCIONES
// ============================================================================

function handleNuevoReporte() {
    if (deps.onNuevoReporte) {
        deps.onNuevoReporte();
    }
}

function handleVerDetalle(id) {
    // Por ahora, ir a la vista de búsqueda con el ID
    // En el futuro podemos crear una vista de detalle dedicada
    console.log('[mantenimientos-gestion] Ver detalle:', id);
    
    // Buscar el mantenimiento
    const mantenimiento = state.mantenimientos.find(m => (m.ID_Unico || m.id) === id);
    if (!mantenimiento) return;

    // Navegar a búsqueda con el cliente prellenado
    if (deps.showView) {
        deps.showView('tab-buscar');
        // Prellenar búsqueda con el cliente
        const searchInput = document.getElementById('buscarCliente');
        if (searchInput && mantenimiento.Cliente) {
            searchInput.value = mantenimiento.Cliente;
            // Disparar búsqueda
            const searchBtn = document.getElementById('buscarBtn');
            if (searchBtn) searchBtn.click();
        }
    }
}

async function handleDescargarPdf(id) {
    console.log('[mantenimientos-gestion] Descargar PDF:', id);
    
    // Buscar el mantenimiento
    const mantenimiento = state.mantenimientos.find(m => (m.ID_Unico || m.id) === id);
    if (!mantenimiento) {
        console.error('[mantenimientos-gestion] Mantenimiento no encontrado:', id);
        return;
    }

    // Si ya tiene PDF, obtener URL y abrir
    if (mantenimiento.pdf_path && deps.obtenerUrlPdfMantenimiento) {
        try {
            const url = await deps.obtenerUrlPdfMantenimiento(mantenimiento.pdf_path);
            if (url) {
                window.open(url, '_blank');
                return;
            }
        } catch (error) {
            console.error('[mantenimientos-gestion] Error obteniendo URL del PDF:', error);
        }
    }

    // Si no tiene PDF o falló, generar uno nuevo
    if (!deps.generarPdfMantenimiento) {
        alert('La función de generación de PDF no está disponible.');
        return;
    }

    // Marcar como generando
    state.pdfGenerating[id] = true;
    renderTable();

    try {
        console.log('[mantenimientos-gestion] Generando PDF para:', id);
        const result = await deps.generarPdfMantenimiento({ maintenanceId: id });
        
        if (result?.url) {
            // Actualizar el mantenimiento en el estado local
            mantenimiento.pdf_path = result.path;
            window.open(result.url, '_blank');
        } else if (result?.path && deps.obtenerUrlPdfMantenimiento) {
            // Si solo devuelve path, obtener URL
            mantenimiento.pdf_path = result.path;
            const url = await deps.obtenerUrlPdfMantenimiento(result.path);
            if (url) {
                window.open(url, '_blank');
            }
        } else {
            throw new Error('No se recibió URL del PDF generado');
        }
    } catch (error) {
        console.error('[mantenimientos-gestion] Error generando PDF:', error);
        alert('Error al generar el PDF: ' + (error.message || 'Error desconocido'));
    } finally {
        // Quitar marca de generando
        delete state.pdfGenerating[id];
        renderTable();
    }
}

// ============================================================================
// UTILIDADES
// ============================================================================

function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        return date.toLocaleDateString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch {
        return dateStr;
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function debounce(fn, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
}

export default createMantenimientosGestionModule;
