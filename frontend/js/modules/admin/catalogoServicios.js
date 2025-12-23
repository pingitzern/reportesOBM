/**
 * Catálogo de Servicios Module
 * ABM para gestionar servicios disponibles por categoría de equipos
 */

import { supabase } from '../../supabaseClient.js';

// ============================================
// ESTADO
// ============================================
let serviciosCache = [];
let servicioFilters = { search: '', categoria: '', tipoTarea: '' };

const CATEGORIAS = [
    { value: 'ablandador', label: 'Ablandador' },
    { value: 'osmosis', label: 'Ósmosis' },
    { value: 'hplc', label: 'HPLC' },
    { value: 'laboratorio', label: 'Laboratorio' },
    { value: 'servicio', label: 'Servicio' },
    { value: 'insumo', label: 'Insumo' },
    { value: 'otro', label: 'Otro' },
];

const TIPOS_TAREA = [
    { value: 'MP', label: 'Mantenimiento Preventivo' },
    { value: 'CAL', label: 'Calibración' },
    { value: 'VAL', label: 'Validación' },
    { value: 'INSTA', label: 'Instalación' },
    { value: 'REP', label: 'Reparación' },
];

// ============================================
// LOAD & RENDER
// ============================================

export async function loadCatalogoServicios() {
    const tbody = document.getElementById('admin-catalogo-servicios-tbody');
    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="6" class="px-6 py-8 text-center text-gray-500">
                <div class="flex items-center justify-center gap-2">
                    <svg class="animate-spin h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    Cargando servicios...
                </div>
            </td>
        </tr>
    `;

    try {
        let query = supabase
            .from('catalogo_servicios')
            .select('*')
            .eq('activo', true)
            .order('tipo_tarea', { ascending: true })
            .order('nombre', { ascending: true });

        if (servicioFilters.search) {
            const searchTerm = `%${servicioFilters.search}%`;
            query = query.or(`nombre.ilike.${searchTerm},descripcion.ilike.${searchTerm}`);
        }

        if (servicioFilters.tipoTarea) {
            query = query.eq('tipo_tarea', servicioFilters.tipoTarea);
        }

        if (servicioFilters.categoria) {
            query = query.contains('categorias', [servicioFilters.categoria]);
        }

        const { data, error } = await query.limit(50);

        if (error) throw error;

        serviciosCache = data || [];
        renderServiciosTable(serviciosCache);
        updateServiciosStats();
    } catch (error) {
        console.error('[CatalogoServicios] Error loading servicios:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-8 text-center text-red-500">
                    Error al cargar los servicios: ${escapeHtml(error.message)}
                </td>
            </tr>
        `;
    }
}

function renderServiciosTable(servicios) {
    const tbody = document.getElementById('admin-catalogo-servicios-tbody');
    if (!tbody) return;

    if (servicios.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-8 text-center text-gray-500">
                    No se encontraron servicios con los filtros aplicados.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = servicios.map(servicio => {
        const tipoLabel = TIPOS_TAREA.find(t => t.value === servicio.tipo_tarea)?.label || servicio.tipo_tarea;
        const tipoBadge = getTipoTareaBadge(servicio.tipo_tarea);
        const categoriasBadges = (servicio.categorias || []).map(cat => {
            const catLabel = CATEGORIAS.find(c => c.value === cat)?.label || cat;
            return `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">${escapeHtml(catLabel)}</span>`;
        }).join(' ');

        return `
            <tr class="hover:bg-gray-50 transition-colors">
                <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                        <div class="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                            </svg>
                        </div>
                        <div class="min-w-0">
                            <p class="font-medium text-gray-900 truncate">${escapeHtml(servicio.nombre || servicio.descripcion || '-')}</p>
                            <p class="text-sm text-gray-500 truncate">${escapeHtml(servicio.descripcion?.substring(0, 50) || '')}</p>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4">
                    ${tipoBadge}
                </td>
                <td class="px-6 py-4 text-center">
                    <span class="text-sm font-medium text-gray-900">${servicio.duracion_estimada_min || 0}</span>
                    <span class="text-xs text-gray-500">min</span>
                </td>
                <td class="px-6 py-4">
                    <div class="flex flex-wrap gap-1">
                        ${categoriasBadges || '<span class="text-gray-400 text-sm">Sin categorías</span>'}
                    </div>
                </td>
                <td class="px-6 py-4 text-right">
                    <div class="flex items-center justify-end gap-1">
                        <button onclick="window.adminEditServicio('${servicio.id}')" 
                                class="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" 
                                title="Editar">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </button>
                        <button onclick="window.adminDeleteServicio('${servicio.id}', '${escapeHtml(servicio.nombre || servicio.descripcion || 'este servicio')}')" 
                                class="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" 
                                title="Eliminar">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function updateServiciosStats() {
    const total = serviciosCache.length;
    const mp = serviciosCache.filter(s => s.tipo_tarea === 'MP').length;
    const rep = serviciosCache.filter(s => s.tipo_tarea === 'REP').length;
    const otros = serviciosCache.filter(s => !['MP', 'REP'].includes(s.tipo_tarea)).length;

    setElementText('admin-catalogo-total', total);
    setElementText('admin-catalogo-mp', mp);
    setElementText('admin-catalogo-rep', rep);
    setElementText('admin-catalogo-otros', otros);
}

// ============================================
// MODAL CRUD
// ============================================

export function openServicioNewModal() {
    const modal = document.getElementById('admin-servicio-modal');
    const backdrop = document.getElementById('admin-servicio-modal-backdrop');
    const title = document.getElementById('admin-servicio-modal-title');
    const form = document.getElementById('admin-servicio-form');

    if (!modal || !form) return;

    title.textContent = 'Nuevo Servicio';
    form.reset();
    document.getElementById('admin-servicio-id').value = '';
    document.getElementById('admin-servicio-error').classList.add('hidden');

    // Reset checkboxes de categorías
    document.querySelectorAll('.admin-servicio-categoria-checkbox').forEach(cb => {
        cb.checked = false;
    });

    modal.classList.remove('hidden');
    backdrop.classList.remove('hidden');
    document.getElementById('admin-servicio-nombre').focus();
}

export function openServicioEditModal(id) {
    const servicio = serviciosCache.find(s => s.id === id);
    if (!servicio) {
        alert('Servicio no encontrado');
        return;
    }

    const modal = document.getElementById('admin-servicio-modal');
    const backdrop = document.getElementById('admin-servicio-modal-backdrop');
    const title = document.getElementById('admin-servicio-modal-title');

    title.textContent = 'Editar Servicio';
    document.getElementById('admin-servicio-id').value = servicio.id;
    document.getElementById('admin-servicio-nombre').value = servicio.nombre || '';
    document.getElementById('admin-servicio-tipo-tarea').value = servicio.tipo_tarea || '';
    document.getElementById('admin-servicio-duracion').value = servicio.duracion_estimada_min || 60;
    document.getElementById('admin-servicio-descripcion').value = servicio.descripcion || '';
    document.getElementById('admin-servicio-error').classList.add('hidden');

    // Set checkboxes de categorías
    document.querySelectorAll('.admin-servicio-categoria-checkbox').forEach(cb => {
        cb.checked = (servicio.categorias || []).includes(cb.value);
    });

    modal.classList.remove('hidden');
    backdrop.classList.remove('hidden');
}

export function closeServicioModal() {
    const modal = document.getElementById('admin-servicio-modal');
    const backdrop = document.getElementById('admin-servicio-modal-backdrop');
    modal?.classList.add('hidden');
    backdrop?.classList.add('hidden');
}

export async function saveServicio(event) {
    event.preventDefault();

    const errorEl = document.getElementById('admin-servicio-error');
    const saveBtn = document.getElementById('admin-servicio-save-btn');
    const id = document.getElementById('admin-servicio-id').value;

    const nombre = document.getElementById('admin-servicio-nombre').value.trim();
    const tipoTarea = document.getElementById('admin-servicio-tipo-tarea').value;
    const duracion = parseInt(document.getElementById('admin-servicio-duracion').value) || 60;

    if (!nombre) {
        errorEl.textContent = 'El nombre es obligatorio';
        errorEl.classList.remove('hidden');
        return;
    }

    if (!tipoTarea) {
        errorEl.textContent = 'Selecciona un tipo de tarea';
        errorEl.classList.remove('hidden');
        return;
    }

    // Obtener categorías seleccionadas
    const categoriasSeleccionadas = [];
    document.querySelectorAll('.admin-servicio-categoria-checkbox:checked').forEach(cb => {
        categoriasSeleccionadas.push(cb.value);
    });

    const servicioData = {
        nombre,
        tipo_tarea: tipoTarea,
        duracion_estimada_min: duracion,
        descripcion: document.getElementById('admin-servicio-descripcion').value.trim() || nombre,
        categorias: categoriasSeleccionadas,
    };

    saveBtn.disabled = true;
    saveBtn.textContent = 'Guardando...';

    try {
        let result;
        if (id) {
            result = await supabase.from('catalogo_servicios').update(servicioData).eq('id', id);
        } else {
            servicioData.activo = true;
            result = await supabase.from('catalogo_servicios').insert(servicioData);
        }

        if (result.error) throw result.error;

        closeServicioModal();
        await loadCatalogoServicios();
    } catch (error) {
        console.error('[CatalogoServicios] Error saving servicio:', error);
        errorEl.textContent = error.message || 'Error al guardar el servicio';
        errorEl.classList.remove('hidden');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Guardar';
    }
}

export async function deleteServicio(id, nombre) {
    if (!confirm(`¿Estás seguro de eliminar "${nombre}"? Esta acción no se puede deshacer.`)) {
        return;
    }

    try {
        // Soft delete
        const { error } = await supabase
            .from('catalogo_servicios')
            .update({ activo: false })
            .eq('id', id);

        if (error) throw error;

        await loadCatalogoServicios();
    } catch (error) {
        console.error('[CatalogoServicios] Error deleting servicio:', error);
        alert('Error al eliminar el servicio: ' + error.message);
    }
}

// ============================================
// EVENT LISTENERS
// ============================================

export function bindCatalogoServiciosEventListeners() {
    // Botón nuevo servicio
    const nuevoBtn = document.getElementById('admin-servicio-nuevo-btn');
    nuevoBtn?.addEventListener('click', openServicioNewModal);

    // Formulario
    const form = document.getElementById('admin-servicio-form');
    form?.addEventListener('submit', saveServicio);

    // Botón cancelar
    const cancelBtn = document.getElementById('admin-servicio-cancel-btn');
    cancelBtn?.addEventListener('click', closeServicioModal);

    // Backdrop
    const backdrop = document.getElementById('admin-servicio-modal-backdrop');
    backdrop?.addEventListener('click', closeServicioModal);

    // Filtros
    const searchInput = document.getElementById('admin-catalogo-servicios-search');
    searchInput?.addEventListener('input', debounce((e) => {
        servicioFilters.search = e.target.value;
        loadCatalogoServicios();
    }, 300));

    const tipoFilter = document.getElementById('admin-catalogo-filter-tipo');
    tipoFilter?.addEventListener('change', (e) => {
        servicioFilters.tipoTarea = e.target.value;
        loadCatalogoServicios();
    });

    const categoriaFilter = document.getElementById('admin-catalogo-filter-categoria');
    categoriaFilter?.addEventListener('change', (e) => {
        servicioFilters.categoria = e.target.value;
        loadCatalogoServicios();
    });

    // Exponer funciones globalmente para onclick
    window.adminEditServicio = openServicioEditModal;
    window.adminDeleteServicio = deleteServicio;
}

// ============================================
// HELPERS
// ============================================

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function setElementText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function debounce(fn, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
}

function getTipoTareaBadge(tipo) {
    const colors = {
        'MP': 'bg-green-100 text-green-700',
        'CAL': 'bg-blue-100 text-blue-700',
        'VAL': 'bg-purple-100 text-purple-700',
        'INSTA': 'bg-amber-100 text-amber-700',
        'REP': 'bg-red-100 text-red-700',
    };
    const colorClass = colors[tipo] || 'bg-gray-100 text-gray-700';
    const label = TIPOS_TAREA.find(t => t.value === tipo)?.label || tipo;
    return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}">${escapeHtml(label)}</span>`;
}

export { CATEGORIAS, TIPOS_TAREA };
