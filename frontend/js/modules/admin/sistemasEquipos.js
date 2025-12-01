/**
 * Sistemas y Equipos Module
 * ABM para el catálogo de sistemas y equipos asignados a clientes
 */

import { supabase } from '../../supabaseClient.js';

// ============================================
// ESTADO
// ============================================
let sistemasCache = [];
let equiposCache = [];
let clientesCache = [];

let sistemaFilters = { search: '', categoria: '' };
let equipoFilters = { search: '', cliente: '', sistema: '' };

const CATEGORIAS = [
    { value: 'ablandador', label: 'Ablandador' },
    { value: 'osmosis', label: 'Ósmosis' },
    { value: 'hplc', label: 'HPLC' },
    { value: 'laboratorio', label: 'Laboratorio' },
    { value: 'servicio', label: 'Servicio' },
    { value: 'insumo', label: 'Insumo' },
    { value: 'otro', label: 'Otro' },
];

// ============================================
// SISTEMAS - CRUD
// ============================================

export async function loadSistemas() {
    const tbody = document.getElementById('admin-sistemas-tbody');
    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="6" class="px-6 py-8 text-center text-gray-500">
                <div class="flex items-center justify-center gap-2">
                    <svg class="animate-spin h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    Cargando sistemas...
                </div>
            </td>
        </tr>
    `;

    try {
        let query = supabase
            .from('sistemas')
            .select('*')
            .eq('activo', true)
            .order('categoria', { ascending: true })
            .order('nombre', { ascending: true });

        if (sistemaFilters.search) {
            const searchTerm = `%${sistemaFilters.search}%`;
            query = query.or(`nombre.ilike.${searchTerm},codigo.ilike.${searchTerm},descripcion.ilike.${searchTerm}`);
        }

        if (sistemaFilters.categoria) {
            query = query.eq('categoria', sistemaFilters.categoria);
        }

        const { data, error } = await query;

        if (error) throw error;

        sistemasCache = data || [];
        renderSistemasTable(sistemasCache);
        updateSistemasStats();
    } catch (error) {
        console.error('[SistemasEquipos] Error loading sistemas:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-8 text-center text-red-500">
                    Error al cargar los sistemas: ${escapeHtml(error.message)}
                </td>
            </tr>
        `;
    }
}

function renderSistemasTable(sistemas) {
    const tbody = document.getElementById('admin-sistemas-tbody');
    if (!tbody) return;

    if (sistemas.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-8 text-center text-gray-500">
                    No se encontraron sistemas con los filtros aplicados.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = sistemas.map(sistema => {
        const categoriaBadge = getCategoriaBadge(sistema.categoria);
        
        return `
            <tr class="hover:bg-gray-50 transition-colors">
                <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                        <div class="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                            </svg>
                        </div>
                        <div class="min-w-0">
                            <p class="font-medium text-gray-900 truncate">${escapeHtml(sistema.nombre)}</p>
                            <p class="text-sm text-gray-500 font-mono">${escapeHtml(sistema.codigo || '-')}</p>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4">
                    ${categoriaBadge}
                </td>
                <td class="px-6 py-4 max-w-xs">
                    <p class="text-sm text-gray-600 truncate" title="${escapeHtml(sistema.descripcion || '')}">${escapeHtml(truncateText(sistema.descripcion, 60))}</p>
                </td>
                <td class="px-6 py-4 text-sm text-gray-500">
                    ${sistema.vida_util_dias ? `${sistema.vida_util_dias} días` : '-'}
                </td>
                <td class="px-6 py-4 text-right">
                    <div class="flex items-center justify-end gap-1">
                        <button onclick="window.adminEditSistema('${sistema.id}')" 
                                class="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" 
                                title="Editar">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </button>
                        <button onclick="window.adminDeleteSistema('${sistema.id}', '${escapeHtml(sistema.nombre)}')" 
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

function updateSistemasStats() {
    const total = sistemasCache.length;
    const ablandadores = sistemasCache.filter(s => s.categoria === 'ablandador').length;
    const osmosis = sistemasCache.filter(s => s.categoria === 'osmosis').length;
    const otros = total - ablandadores - osmosis;

    setElementText('admin-stat-total-sistemas', total);
    setElementText('admin-stat-ablandadores', ablandadores);
    setElementText('admin-stat-osmosis', osmosis);
    setElementText('admin-stat-otros-sistemas', otros);
}

// Modal Sistema
export function openSistemaNewModal() {
    const modal = document.getElementById('admin-sistema-modal');
    const backdrop = document.getElementById('admin-sistema-modal-backdrop');
    const title = document.getElementById('admin-sistema-modal-title');
    const form = document.getElementById('admin-sistema-form');

    if (!modal || !form) return;

    title.textContent = 'Nuevo Sistema';
    form.reset();
    document.getElementById('admin-sistema-id').value = '';
    document.getElementById('admin-sistema-error').classList.add('hidden');

    populateCategoriaSelect('admin-sistema-categoria');

    modal.classList.remove('hidden');
    backdrop.classList.remove('hidden');
    document.getElementById('admin-sistema-nombre').focus();
}

export function openSistemaEditModal(id) {
    const sistema = sistemasCache.find(s => s.id === id);
    if (!sistema) {
        alert('Sistema no encontrado');
        return;
    }

    const modal = document.getElementById('admin-sistema-modal');
    const backdrop = document.getElementById('admin-sistema-modal-backdrop');
    const title = document.getElementById('admin-sistema-modal-title');

    title.textContent = 'Editar Sistema';
    document.getElementById('admin-sistema-id').value = sistema.id;
    document.getElementById('admin-sistema-nombre').value = sistema.nombre || '';
    document.getElementById('admin-sistema-codigo').value = sistema.codigo || '';
    document.getElementById('admin-sistema-descripcion').value = sistema.descripcion || '';
    document.getElementById('admin-sistema-vida-util').value = sistema.vida_util_dias || '';
    
    populateCategoriaSelect('admin-sistema-categoria');
    document.getElementById('admin-sistema-categoria').value = sistema.categoria || '';
    
    document.getElementById('admin-sistema-error').classList.add('hidden');

    modal.classList.remove('hidden');
    backdrop.classList.remove('hidden');
}

export function closeSistemaModal() {
    const modal = document.getElementById('admin-sistema-modal');
    const backdrop = document.getElementById('admin-sistema-modal-backdrop');
    modal?.classList.add('hidden');
    backdrop?.classList.add('hidden');
}

export async function saveSistema(event) {
    event.preventDefault();

    const errorEl = document.getElementById('admin-sistema-error');
    const saveBtn = document.getElementById('admin-sistema-save-btn');
    const id = document.getElementById('admin-sistema-id').value;

    const nombre = document.getElementById('admin-sistema-nombre').value.trim();
    if (!nombre) {
        errorEl.textContent = 'El nombre es obligatorio';
        errorEl.classList.remove('hidden');
        return;
    }

    const sistemaData = {
        nombre,
        codigo: document.getElementById('admin-sistema-codigo').value.trim() || null,
        descripcion: document.getElementById('admin-sistema-descripcion').value.trim() || null,
        categoria: document.getElementById('admin-sistema-categoria').value || null,
        vida_util_dias: parseInt(document.getElementById('admin-sistema-vida-util').value) || null,
    };

    saveBtn.disabled = true;
    saveBtn.textContent = 'Guardando...';

    try {
        let result;
        if (id) {
            result = await supabase.from('sistemas').update(sistemaData).eq('id', id);
        } else {
            result = await supabase.from('sistemas').insert(sistemaData);
        }

        if (result.error) throw result.error;

        closeSistemaModal();
        await loadSistemas();
    } catch (error) {
        console.error('[SistemasEquipos] Error saving sistema:', error);
        errorEl.textContent = error.message || 'Error al guardar el sistema';
        errorEl.classList.remove('hidden');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Guardar';
    }
}

export async function deleteSistema(id, nombre) {
    if (!confirm(`¿Estás seguro de eliminar "${nombre}"? Esta acción no se puede deshacer.`)) {
        return;
    }

    try {
        // Soft delete
        const { error } = await supabase
            .from('sistemas')
            .update({ activo: false })
            .eq('id', id);

        if (error) throw error;

        await loadSistemas();
    } catch (error) {
        console.error('[SistemasEquipos] Error deleting sistema:', error);
        alert('Error al eliminar el sistema: ' + error.message);
    }
}

// ============================================
// EQUIPOS - CRUD
// ============================================

export async function loadEquipos() {
    const tbody = document.getElementById('admin-equipos-tbody');
    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="7" class="px-6 py-8 text-center text-gray-500">
                <div class="flex items-center justify-center gap-2">
                    <svg class="animate-spin h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    Cargando equipos...
                </div>
            </td>
        </tr>
    `;

    try {
        // Cargar sistemas para el select si no están cargados
        if (sistemasCache.length === 0) {
            const { data: sistemasData } = await supabase
                .from('sistemas')
                .select('id, nombre, codigo, categoria')
                .eq('activo', true)
                .order('nombre');
            sistemasCache = sistemasData || [];
        }

        // Cargar clientes si no están cargados
        if (clientesCache.length === 0) {
            const { data: clientesData } = await supabase
                .from('clients')
                .select('id, razon_social')
                .order('razon_social');
            clientesCache = clientesData || [];
        }

        let query = supabase
            .from('equipments')
            .select(`
                *,
                clients:client_id (id, razon_social),
                sistemas:sistema_id (id, nombre, codigo, categoria)
            `)
            .eq('activo', true)
            .order('created_at', { ascending: false });

        if (equipoFilters.search) {
            const searchTerm = `%${equipoFilters.search}%`;
            query = query.or(`serial_number.ilike.${searchTerm},modelo.ilike.${searchTerm},tag_id.ilike.${searchTerm}`);
        }

        if (equipoFilters.cliente) {
            query = query.eq('client_id', equipoFilters.cliente);
        }

        if (equipoFilters.sistema) {
            query = query.eq('sistema_id', equipoFilters.sistema);
        }

        const { data, error } = await query.limit(100);

        if (error) throw error;

        equiposCache = data || [];
        renderEquiposTable(equiposCache);
        updateEquiposStats();
        populateEquipoFilters();
    } catch (error) {
        console.error('[SistemasEquipos] Error loading equipos:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="px-6 py-8 text-center text-red-500">
                    Error al cargar los equipos: ${escapeHtml(error.message)}
                </td>
            </tr>
        `;
    }
}

function renderEquiposTable(equipos) {
    const tbody = document.getElementById('admin-equipos-tbody');
    if (!tbody) return;

    if (equipos.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="px-6 py-8 text-center text-gray-500">
                    No se encontraron equipos con los filtros aplicados.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = equipos.map(equipo => {
        const clienteNombre = equipo.clients?.razon_social || '-';
        const sistemaNombre = equipo.sistemas?.nombre || '-';
        const sistemaCat = equipo.sistemas?.categoria;
        const categoriaBadge = sistemaCat ? getCategoriaBadge(sistemaCat) : '';

        return `
            <tr class="hover:bg-gray-50 transition-colors">
                <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                        <div class="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0">
                            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                            </svg>
                        </div>
                        <div class="min-w-0">
                            <p class="font-medium text-gray-900 truncate">${escapeHtml(clienteNombre)}</p>
                            <p class="text-sm text-gray-500 font-mono">${escapeHtml(equipo.serial_number || '-')}</p>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4">
                    <div class="space-y-1">
                        <p class="text-sm font-medium text-gray-900">${escapeHtml(sistemaNombre)}</p>
                        ${categoriaBadge}
                    </div>
                </td>
                <td class="px-6 py-4">
                    <span class="text-sm text-gray-600">${escapeHtml(equipo.modelo || '-')}</span>
                </td>
                <td class="px-6 py-4">
                    <span class="text-sm text-gray-600 font-mono">${escapeHtml(equipo.tag_id || 'N/A')}</span>
                </td>
                <td class="px-6 py-4 text-sm text-gray-500">
                    ${equipo.fecha_instalacion ? formatDate(equipo.fecha_instalacion) : '-'}
                </td>
                <td class="px-6 py-4 text-right">
                    <div class="flex items-center justify-end gap-1">
                        <button onclick="window.adminEditEquipo('${equipo.id}')" 
                                class="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" 
                                title="Editar">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </button>
                        <button onclick="window.adminDeleteEquipo('${equipo.id}', '${escapeHtml(equipo.serial_number || equipo.id)}')" 
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

function updateEquiposStats() {
    const total = equiposCache.length;
    const clientesUnicos = new Set(equiposCache.map(e => e.client_id).filter(Boolean)).size;
    const conSerie = equiposCache.filter(e => e.serial_number && e.serial_number.trim()).length;
    const conTag = equiposCache.filter(e => e.tag_id && e.tag_id.trim() && e.tag_id !== 'N/A').length;

    setElementText('admin-stat-total-equipos', total);
    setElementText('admin-stat-clientes-equipos', clientesUnicos);
    setElementText('admin-stat-con-serie', conSerie);
    setElementText('admin-stat-con-tag', conTag);
}

function populateEquipoFilters() {
    // Poblar filtro de clientes
    const clienteSelect = document.getElementById('admin-equipos-filter-cliente');
    if (clienteSelect) {
        const currentValue = clienteSelect.value;
        clienteSelect.innerHTML = '<option value="">Todos los clientes</option>' +
            clientesCache.map(c => `<option value="${c.id}">${escapeHtml(c.razon_social)}</option>`).join('');
        clienteSelect.value = currentValue;
    }

    // Poblar filtro de sistemas
    const sistemaSelect = document.getElementById('admin-equipos-filter-sistema');
    if (sistemaSelect) {
        const currentValue = sistemaSelect.value;
        sistemaSelect.innerHTML = '<option value="">Todos los sistemas</option>' +
            sistemasCache.map(s => `<option value="${s.id}">${escapeHtml(s.nombre)}</option>`).join('');
        sistemaSelect.value = currentValue;
    }
}

// Modal Equipo
export function openEquipoNewModal() {
    const modal = document.getElementById('admin-equipo-modal');
    const backdrop = document.getElementById('admin-equipo-modal-backdrop');
    const title = document.getElementById('admin-equipo-modal-title');
    const form = document.getElementById('admin-equipo-form');

    if (!modal || !form) return;

    title.textContent = 'Nuevo Equipo';
    form.reset();
    document.getElementById('admin-equipo-id').value = '';
    document.getElementById('admin-equipo-error').classList.add('hidden');

    populateEquipoFormSelects();

    modal.classList.remove('hidden');
    backdrop.classList.remove('hidden');
    document.getElementById('admin-equipo-cliente').focus();
}

export function openEquipoEditModal(id) {
    const equipo = equiposCache.find(e => e.id === id);
    if (!equipo) {
        alert('Equipo no encontrado');
        return;
    }

    const modal = document.getElementById('admin-equipo-modal');
    const backdrop = document.getElementById('admin-equipo-modal-backdrop');
    const title = document.getElementById('admin-equipo-modal-title');

    title.textContent = 'Editar Equipo';
    
    populateEquipoFormSelects();

    document.getElementById('admin-equipo-id').value = equipo.id;
    document.getElementById('admin-equipo-cliente').value = equipo.client_id || '';
    document.getElementById('admin-equipo-sistema').value = equipo.sistema_id || '';
    document.getElementById('admin-equipo-serie').value = equipo.serial_number || '';
    document.getElementById('admin-equipo-modelo').value = equipo.modelo || '';
    document.getElementById('admin-equipo-tag').value = equipo.tag_id || '';
    document.getElementById('admin-equipo-fecha-instalacion').value = equipo.fecha_instalacion || '';
    document.getElementById('admin-equipo-notas').value = equipo.notas || '';
    document.getElementById('admin-equipo-error').classList.add('hidden');

    modal.classList.remove('hidden');
    backdrop.classList.remove('hidden');
}

function populateEquipoFormSelects() {
    // Poblar select de clientes
    const clienteSelect = document.getElementById('admin-equipo-cliente');
    if (clienteSelect) {
        clienteSelect.innerHTML = '<option value="">Seleccionar cliente...</option>' +
            clientesCache.map(c => `<option value="${c.id}">${escapeHtml(c.razon_social)}</option>`).join('');
    }

    // Poblar select de sistemas
    const sistemaSelect = document.getElementById('admin-equipo-sistema');
    if (sistemaSelect) {
        sistemaSelect.innerHTML = '<option value="">Seleccionar sistema...</option>' +
            sistemasCache.map(s => `<option value="${s.id}">${escapeHtml(s.nombre)} ${s.codigo ? `(${s.codigo})` : ''}</option>`).join('');
    }
}

export function closeEquipoModal() {
    const modal = document.getElementById('admin-equipo-modal');
    const backdrop = document.getElementById('admin-equipo-modal-backdrop');
    modal?.classList.add('hidden');
    backdrop?.classList.add('hidden');
}

export async function saveEquipo(event) {
    event.preventDefault();

    const errorEl = document.getElementById('admin-equipo-error');
    const saveBtn = document.getElementById('admin-equipo-save-btn');
    const id = document.getElementById('admin-equipo-id').value;

    const clientId = document.getElementById('admin-equipo-cliente').value;
    const sistemaId = document.getElementById('admin-equipo-sistema').value;

    if (!clientId) {
        errorEl.textContent = 'Debe seleccionar un cliente';
        errorEl.classList.remove('hidden');
        return;
    }

    const equipoData = {
        client_id: clientId,
        sistema_id: sistemaId || null,
        serial_number: document.getElementById('admin-equipo-serie').value.trim() || null,
        modelo: document.getElementById('admin-equipo-modelo').value.trim() || null,
        tag_id: document.getElementById('admin-equipo-tag').value.trim() || null,
        fecha_instalacion: document.getElementById('admin-equipo-fecha-instalacion').value || null,
        notas: document.getElementById('admin-equipo-notas').value.trim() || null,
    };

    saveBtn.disabled = true;
    saveBtn.textContent = 'Guardando...';

    try {
        let result;
        if (id) {
            result = await supabase.from('equipments').update(equipoData).eq('id', id);
        } else {
            result = await supabase.from('equipments').insert(equipoData);
        }

        if (result.error) throw result.error;

        closeEquipoModal();
        await loadEquipos();
    } catch (error) {
        console.error('[SistemasEquipos] Error saving equipo:', error);
        errorEl.textContent = error.message || 'Error al guardar el equipo';
        errorEl.classList.remove('hidden');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Guardar';
    }
}

export async function deleteEquipo(id, identificador) {
    if (!confirm(`¿Estás seguro de eliminar el equipo "${identificador}"? Esta acción no se puede deshacer.`)) {
        return;
    }

    try {
        const { error } = await supabase
            .from('equipments')
            .update({ activo: false })
            .eq('id', id);

        if (error) throw error;

        await loadEquipos();
    } catch (error) {
        console.error('[SistemasEquipos] Error deleting equipo:', error);
        alert('Error al eliminar el equipo: ' + error.message);
    }
}

// ============================================
// FUNCIONES AUXILIARES PARA REPORTES
// ============================================

/**
 * Obtiene los equipos de un cliente específico para usar en formularios de reportes
 */
export async function getEquiposByCliente(clientId) {
    if (!clientId) return [];

    try {
        const { data, error } = await supabase
            .from('equipments')
            .select(`
                id,
                serial_number,
                modelo,
                tag_id,
                sistemas:sistema_id (id, nombre, codigo, categoria)
            `)
            .eq('client_id', clientId)
            .eq('activo', true)
            .order('serial_number');

        if (error) throw error;

        return (data || []).map(e => ({
            id: e.id,
            serie: e.serial_number,
            modelo: e.modelo,
            tag_id: e.tag_id,
            sistema_id: e.sistemas?.id,
            sistema_nombre: e.sistemas?.nombre,
            sistema_codigo: e.sistemas?.codigo,
            sistema_categoria: e.sistemas?.categoria,
        }));
    } catch (error) {
        console.error('[SistemasEquipos] Error getting equipos by cliente:', error);
        return [];
    }
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

function truncateText(text, maxLength) {
    if (!text) return '-';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

function setElementText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
        return new Date(dateStr).toLocaleDateString('es-AR');
    } catch {
        return '-';
    }
}

function getCategoriaBadge(categoria) {
    const colors = {
        ablandador: 'bg-blue-100 text-blue-700',
        osmosis: 'bg-cyan-100 text-cyan-700',
        hplc: 'bg-purple-100 text-purple-700',
        laboratorio: 'bg-amber-100 text-amber-700',
        servicio: 'bg-green-100 text-green-700',
        insumo: 'bg-gray-100 text-gray-700',
        otro: 'bg-gray-100 text-gray-600',
    };

    const labels = {
        ablandador: 'Ablandador',
        osmosis: 'Ósmosis',
        hplc: 'HPLC',
        laboratorio: 'Laboratorio',
        servicio: 'Servicio',
        insumo: 'Insumo',
        otro: 'Otro',
    };

    const colorClass = colors[categoria] || colors.otro;
    const label = labels[categoria] || categoria || 'Sin categoría';

    return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}">${label}</span>`;
}

function populateCategoriaSelect(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;

    select.innerHTML = '<option value="">Seleccionar categoría...</option>' +
        CATEGORIAS.map(c => `<option value="${c.value}">${c.label}</option>`).join('');
}

function debounce(fn, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
}

// ============================================
// EVENT LISTENERS
// ============================================

export function bindSistemasEquiposEventListeners() {
    // Tab Sistemas
    const sistemasTab = document.querySelector('[data-admin-tab="sistemas"]');
    sistemasTab?.addEventListener('click', () => {
        loadSistemas();
    });

    // Tab Equipos
    const equiposTab = document.querySelector('[data-admin-tab="equipos"]');
    equiposTab?.addEventListener('click', () => {
        loadEquipos();
    });

    // === SISTEMAS ===
    // Nuevo sistema
    document.getElementById('admin-sistema-new-btn')?.addEventListener('click', openSistemaNewModal);
    
    // Form sistema
    document.getElementById('admin-sistema-form')?.addEventListener('submit', saveSistema);
    
    // Cancelar modal sistema
    document.getElementById('admin-sistema-cancel-btn')?.addEventListener('click', closeSistemaModal);
    document.getElementById('admin-sistema-modal-backdrop')?.addEventListener('click', closeSistemaModal);

    // Búsqueda sistemas
    document.getElementById('admin-sistemas-search')?.addEventListener('input', debounce((e) => {
        sistemaFilters.search = e.target.value;
        loadSistemas();
    }, 300));

    // Filtro categoría
    document.getElementById('admin-sistemas-filter-categoria')?.addEventListener('change', (e) => {
        sistemaFilters.categoria = e.target.value;
        loadSistemas();
    });

    // === EQUIPOS ===
    // Nuevo equipo
    document.getElementById('admin-equipo-new-btn')?.addEventListener('click', openEquipoNewModal);
    
    // Form equipo
    document.getElementById('admin-equipo-form')?.addEventListener('submit', saveEquipo);
    
    // Cancelar modal equipo
    document.getElementById('admin-equipo-cancel-btn')?.addEventListener('click', closeEquipoModal);
    document.getElementById('admin-equipo-modal-backdrop')?.addEventListener('click', closeEquipoModal);

    // Búsqueda equipos
    document.getElementById('admin-equipos-search')?.addEventListener('input', debounce((e) => {
        equipoFilters.search = e.target.value;
        loadEquipos();
    }, 300));

    // Filtro cliente
    document.getElementById('admin-equipos-filter-cliente')?.addEventListener('change', (e) => {
        equipoFilters.cliente = e.target.value;
        loadEquipos();
    });

    // Filtro sistema
    document.getElementById('admin-equipos-filter-sistema')?.addEventListener('change', (e) => {
        equipoFilters.sistema = e.target.value;
        loadEquipos();
    });
}

// Exponer funciones globalmente para onclick
window.adminEditSistema = openSistemaEditModal;
window.adminDeleteSistema = deleteSistema;
window.adminEditEquipo = openEquipoEditModal;
window.adminDeleteEquipo = deleteEquipo;

export default {
    loadSistemas,
    loadEquipos,
    getEquiposByCliente,
    bindSistemasEquiposEventListeners,
};
