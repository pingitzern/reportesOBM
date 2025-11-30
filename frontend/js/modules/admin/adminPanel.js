/**
 * Admin Panel Module
 * Módulo para la gestión de clientes (ABM) y administración del sistema
 */

import { supabase } from '../../supabaseClient.js';
import { getCurrentUserRole } from '../login/auth.js';

const ITEMS_PER_PAGE = 15;

let currentPage = 1;
let totalClientes = 0;
let clientesCache = [];
let currentFilters = {
    search: '',
    division: '',
    canal: ''
};
let divisiones = [];
let canales = [];

// Verificar si el usuario es admin
function isAdmin() {
    const role = getCurrentUserRole();
    return role && role.toLowerCase() === 'administrador';
}

// Mostrar/ocultar opción del menú según rol
function updateAdminMenuVisibility() {
    const adminMenuItem = document.getElementById('admin-panel-menu-item');
    if (adminMenuItem) {
        if (isAdmin()) {
            adminMenuItem.classList.remove('hidden');
        } else {
            adminMenuItem.classList.add('hidden');
        }
    }
}

// Cargar estadísticas rápidas
async function loadStats() {
    try {
        // Total clientes
        const { count: total } = await supabase
            .from('clientes')
            .select('*', { count: 'exact', head: true });
        
        // Con email
        const { count: conEmail } = await supabase
            .from('clientes')
            .select('*', { count: 'exact', head: true })
            .not('email', 'is', null)
            .neq('email', '');
        
        // Con teléfono
        const { count: conTelefono } = await supabase
            .from('clientes')
            .select('*', { count: 'exact', head: true })
            .not('telefono', 'is', null)
            .neq('telefono', '');
        
        // Con CUIT
        const { count: conCuit } = await supabase
            .from('clientes')
            .select('*', { count: 'exact', head: true })
            .not('cuit', 'is', null)
            .neq('cuit', '');
        
        document.getElementById('admin-stat-total-clientes').textContent = total || 0;
        document.getElementById('admin-stat-con-email').textContent = conEmail || 0;
        document.getElementById('admin-stat-con-telefono').textContent = conTelefono || 0;
        document.getElementById('admin-stat-con-cuit').textContent = conCuit || 0;
        
        totalClientes = total || 0;
    } catch (error) {
        console.error('[AdminPanel] Error loading stats:', error);
    }
}

// Cargar filtros dinámicos (divisiones y canales)
async function loadFilterOptions() {
    try {
        // Obtener divisiones únicas
        const { data: divisionesData } = await supabase
            .from('clientes')
            .select('division')
            .not('division', 'is', null)
            .neq('division', '');
        
        divisiones = [...new Set(divisionesData?.map(d => d.division).filter(Boolean))].sort();
        
        // Obtener canales únicos
        const { data: canalesData } = await supabase
            .from('clientes')
            .select('canal')
            .not('canal', 'is', null)
            .neq('canal', '');
        
        canales = [...new Set(canalesData?.map(c => c.canal).filter(Boolean))].sort();
        
        // Poblar selects
        const divisionSelect = document.getElementById('admin-clientes-filter-division');
        const canalSelect = document.getElementById('admin-clientes-filter-canal');
        
        if (divisionSelect) {
            divisionSelect.innerHTML = '<option value="">Todas las divisiones</option>' +
                divisiones.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');
        }
        
        if (canalSelect) {
            canalSelect.innerHTML = '<option value="">Todos los canales</option>' +
                canales.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
        }
    } catch (error) {
        console.error('[AdminPanel] Error loading filter options:', error);
    }
}

// Cargar clientes con paginación y filtros
async function loadClientes(page = 1) {
    currentPage = page;
    const tbody = document.getElementById('admin-clientes-tbody');
    
    if (!tbody) return;
    
    tbody.innerHTML = `
        <tr>
            <td colspan="5" class="px-6 py-8 text-center text-gray-500">
                <div class="flex items-center justify-center gap-2">
                    <svg class="animate-spin h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    Cargando clientes...
                </div>
            </td>
        </tr>
    `;
    
    try {
        let query = supabase
            .from('clientes')
            .select('*', { count: 'exact' });
        
        // Aplicar filtros
        if (currentFilters.search) {
            const searchTerm = `%${currentFilters.search}%`;
            query = query.or(`razon_social.ilike.${searchTerm},cuit.ilike.${searchTerm},direccion.ilike.${searchTerm},email.ilike.${searchTerm}`);
        }
        
        if (currentFilters.division) {
            query = query.eq('division', currentFilters.division);
        }
        
        if (currentFilters.canal) {
            query = query.eq('canal', currentFilters.canal);
        }
        
        // Ordenar y paginar
        const from = (page - 1) * ITEMS_PER_PAGE;
        const to = from + ITEMS_PER_PAGE - 1;
        
        query = query
            .order('razon_social', { ascending: true })
            .range(from, to);
        
        const { data: clientes, count, error } = await query;
        
        if (error) throw error;
        
        clientesCache = clientes || [];
        totalClientes = count || 0;
        
        renderClientes(clientes);
        updatePagination();
    } catch (error) {
        console.error('[AdminPanel] Error loading clientes:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="px-6 py-8 text-center text-red-500">
                    Error al cargar los clientes. Intentá de nuevo.
                </td>
            </tr>
        `;
    }
}

// Renderizar tabla de clientes
function renderClientes(clientes) {
    const tbody = document.getElementById('admin-clientes-tbody');
    
    if (!clientes || clientes.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="px-6 py-8 text-center text-gray-500">
                    No se encontraron clientes con los filtros aplicados.
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = clientes.map(cliente => `
        <tr class="hover:bg-gray-50 transition-colors cursor-pointer" data-cliente-id="${cliente.id}">
            <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                    <div class="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                        <span class="text-indigo-600 font-semibold text-sm">
                            ${getInitials(cliente.razon_social)}
                        </span>
                    </div>
                    <div class="min-w-0">
                        <p class="font-medium text-gray-900 truncate">${escapeHtml(cliente.razon_social)}</p>
                        <p class="text-sm text-gray-500 truncate">${escapeHtml(cliente.direccion || '-')}</p>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4">
                <div class="text-sm">
                    ${cliente.telefono ? `<p class="text-gray-900">${escapeHtml(cliente.telefono)}</p>` : ''}
                    ${cliente.email ? `<p class="text-gray-500 truncate">${escapeHtml(cliente.email)}</p>` : ''}
                    ${!cliente.telefono && !cliente.email ? '<p class="text-gray-400">Sin contacto</p>' : ''}
                </div>
            </td>
            <td class="px-6 py-4">
                <span class="text-sm text-gray-900">${escapeHtml(cliente.cuit || '-')}</span>
            </td>
            <td class="px-6 py-4">
                <div class="flex flex-wrap gap-1">
                    ${cliente.division ? `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">${escapeHtml(cliente.division)}</span>` : ''}
                    ${cliente.canal ? `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">${escapeHtml(cliente.canal)}</span>` : ''}
                </div>
            </td>
            <td class="px-6 py-4 text-right">
                <div class="flex items-center justify-end gap-2">
                    <button type="button" class="admin-cliente-view-btn p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Ver detalle" data-id="${cliente.id}">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                    </button>
                    <button type="button" class="admin-cliente-edit-btn p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Editar" data-id="${cliente.id}">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </button>
                    <button type="button" class="admin-cliente-delete-btn p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar" data-id="${cliente.id}">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
    
    // Event listeners para los botones de acción
    tbody.querySelectorAll('.admin-cliente-view-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            showClienteDetalle(btn.dataset.id);
        });
    });
    
    tbody.querySelectorAll('.admin-cliente-edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openEditModal(btn.dataset.id);
        });
    });
    
    tbody.querySelectorAll('.admin-cliente-delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            confirmDeleteCliente(btn.dataset.id);
        });
    });
    
    // Click en fila para ver detalle
    tbody.querySelectorAll('tr[data-cliente-id]').forEach(row => {
        row.addEventListener('click', () => {
            showClienteDetalle(row.dataset.clienteId);
        });
    });
}

// Actualizar paginación
function updatePagination() {
    const totalPages = Math.ceil(totalClientes / ITEMS_PER_PAGE);
    const info = document.getElementById('admin-clientes-info');
    const prevBtn = document.getElementById('admin-clientes-prev-btn');
    const nextBtn = document.getElementById('admin-clientes-next-btn');
    
    const from = totalClientes === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
    const to = Math.min(currentPage * ITEMS_PER_PAGE, totalClientes);
    
    if (info) {
        info.textContent = `Mostrando ${from}-${to} de ${totalClientes} clientes`;
    }
    
    if (prevBtn) {
        prevBtn.disabled = currentPage <= 1;
    }
    
    if (nextBtn) {
        nextBtn.disabled = currentPage >= totalPages;
    }
}

// Abrir modal para nuevo cliente
function openNewModal() {
    const modal = document.getElementById('admin-cliente-modal');
    const backdrop = document.getElementById('admin-cliente-modal-backdrop');
    const title = document.getElementById('admin-cliente-modal-title');
    const form = document.getElementById('admin-cliente-form');
    
    if (!modal || !form) return;
    
    title.textContent = 'Nuevo Cliente';
    form.reset();
    document.getElementById('admin-cliente-id').value = '';
    document.getElementById('admin-cliente-error').classList.add('hidden');
    
    modal.classList.remove('hidden');
    backdrop.classList.remove('hidden');
    
    document.getElementById('admin-cliente-razon-social').focus();
}

// Abrir modal para editar cliente
async function openEditModal(id) {
    const cliente = clientesCache.find(c => c.id == id);
    
    if (!cliente) {
        // Cargar desde BD
        const { data, error } = await supabase
            .from('clientes')
            .select('*')
            .eq('id', id)
            .single();
        
        if (error || !data) {
            alert('No se pudo cargar el cliente');
            return;
        }
        
        fillEditForm(data);
    } else {
        fillEditForm(cliente);
    }
}

function fillEditForm(cliente) {
    const modal = document.getElementById('admin-cliente-modal');
    const backdrop = document.getElementById('admin-cliente-modal-backdrop');
    const title = document.getElementById('admin-cliente-modal-title');
    
    title.textContent = 'Editar Cliente';
    document.getElementById('admin-cliente-id').value = cliente.id;
    document.getElementById('admin-cliente-razon-social').value = cliente.razon_social || '';
    document.getElementById('admin-cliente-direccion').value = cliente.direccion || '';
    document.getElementById('admin-cliente-telefono').value = cliente.telefono || '';
    document.getElementById('admin-cliente-email').value = cliente.email || '';
    document.getElementById('admin-cliente-cuit').value = cliente.cuit || '';
    document.getElementById('admin-cliente-division').value = cliente.division || '';
    document.getElementById('admin-cliente-canal').value = cliente.canal || '';
    document.getElementById('admin-cliente-error').classList.add('hidden');
    
    modal.classList.remove('hidden');
    backdrop.classList.remove('hidden');
}

// Cerrar modal de cliente
function closeModal() {
    const modal = document.getElementById('admin-cliente-modal');
    const backdrop = document.getElementById('admin-cliente-modal-backdrop');
    
    modal?.classList.add('hidden');
    backdrop?.classList.add('hidden');
}

// Guardar cliente
async function saveCliente(event) {
    event.preventDefault();
    
    const errorEl = document.getElementById('admin-cliente-error');
    const saveBtn = document.getElementById('admin-cliente-save-btn');
    
    const id = document.getElementById('admin-cliente-id').value;
    const razonSocial = document.getElementById('admin-cliente-razon-social').value.trim();
    
    if (!razonSocial) {
        errorEl.textContent = 'La razón social es obligatoria';
        errorEl.classList.remove('hidden');
        return;
    }
    
    const clienteData = {
        razon_social: razonSocial,
        direccion: document.getElementById('admin-cliente-direccion').value.trim() || null,
        telefono: document.getElementById('admin-cliente-telefono').value.trim() || null,
        email: document.getElementById('admin-cliente-email').value.trim() || null,
        cuit: document.getElementById('admin-cliente-cuit').value.trim() || null,
        division: document.getElementById('admin-cliente-division').value.trim() || null,
        canal: document.getElementById('admin-cliente-canal').value.trim() || null
    };
    
    saveBtn.disabled = true;
    saveBtn.textContent = 'Guardando...';
    
    try {
        let result;
        
        if (id) {
            // Actualizar
            result = await supabase
                .from('clientes')
                .update(clienteData)
                .eq('id', id);
        } else {
            // Crear
            result = await supabase
                .from('clientes')
                .insert(clienteData);
        }
        
        if (result.error) throw result.error;
        
        closeModal();
        await loadClientes(currentPage);
        await loadStats();
        await loadFilterOptions();
    } catch (error) {
        console.error('[AdminPanel] Error saving cliente:', error);
        errorEl.textContent = error.message || 'Error al guardar el cliente';
        errorEl.classList.remove('hidden');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Guardar';
    }
}

// Confirmar eliminación
async function confirmDeleteCliente(id) {
    const cliente = clientesCache.find(c => c.id == id);
    const nombre = cliente?.razon_social || 'este cliente';
    
    if (!confirm(`¿Estás seguro de eliminar "${nombre}"? Esta acción no se puede deshacer.`)) {
        return;
    }
    
    try {
        const { error } = await supabase
            .from('clientes')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        await loadClientes(currentPage);
        await loadStats();
    } catch (error) {
        console.error('[AdminPanel] Error deleting cliente:', error);
        alert('Error al eliminar el cliente: ' + error.message);
    }
}

// Mostrar detalle del cliente
async function showClienteDetalle(id) {
    let cliente = clientesCache.find(c => c.id == id);
    
    if (!cliente) {
        const { data, error } = await supabase
            .from('clientes')
            .select('*')
            .eq('id', id)
            .single();
        
        if (error || !data) {
            alert('No se pudo cargar el cliente');
            return;
        }
        cliente = data;
    }
    
    const modal = document.getElementById('admin-cliente-detalle-modal');
    const backdrop = document.getElementById('admin-cliente-detalle-backdrop');
    const title = document.getElementById('admin-cliente-detalle-title');
    const subtitle = document.getElementById('admin-cliente-detalle-subtitle');
    const content = document.getElementById('admin-cliente-detalle-content');
    
    title.textContent = cliente.razon_social;
    subtitle.textContent = cliente.cuit || '';
    
    content.innerHTML = `
        <div class="space-y-6">
            <!-- Información principal -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="space-y-4">
                    <h4 class="text-sm font-semibold text-gray-500 uppercase tracking-wider">Información General</h4>
                    
                    <div>
                        <p class="text-sm text-gray-500">Razón Social</p>
                        <p class="text-gray-900 font-medium">${escapeHtml(cliente.razon_social)}</p>
                    </div>
                    
                    <div>
                        <p class="text-sm text-gray-500">Dirección</p>
                        <p class="text-gray-900">${escapeHtml(cliente.direccion || '-')}</p>
                    </div>
                    
                    <div>
                        <p class="text-sm text-gray-500">CUIT</p>
                        <p class="text-gray-900">${escapeHtml(cliente.cuit || '-')}</p>
                    </div>
                </div>
                
                <div class="space-y-4">
                    <h4 class="text-sm font-semibold text-gray-500 uppercase tracking-wider">Contacto</h4>
                    
                    <div>
                        <p class="text-sm text-gray-500">Teléfono</p>
                        <p class="text-gray-900">
                            ${cliente.telefono 
                                ? `<a href="tel:${cliente.telefono}" class="text-indigo-600 hover:underline">${escapeHtml(cliente.telefono)}</a>` 
                                : '-'}
                        </p>
                    </div>
                    
                    <div>
                        <p class="text-sm text-gray-500">Email</p>
                        <p class="text-gray-900">
                            ${cliente.email 
                                ? `<a href="mailto:${cliente.email}" class="text-indigo-600 hover:underline">${escapeHtml(cliente.email)}</a>` 
                                : '-'}
                        </p>
                    </div>
                </div>
            </div>
            
            <!-- Clasificación -->
            <div class="border-t border-gray-200 pt-6">
                <h4 class="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Clasificación</h4>
                <div class="flex flex-wrap gap-3">
                    ${cliente.division 
                        ? `<div class="flex items-center gap-2 px-4 py-2 bg-indigo-50 rounded-xl">
                            <span class="text-sm text-gray-600">División:</span>
                            <span class="font-medium text-indigo-700">${escapeHtml(cliente.division)}</span>
                           </div>` 
                        : ''}
                    ${cliente.canal 
                        ? `<div class="flex items-center gap-2 px-4 py-2 bg-purple-50 rounded-xl">
                            <span class="text-sm text-gray-600">Canal:</span>
                            <span class="font-medium text-purple-700">${escapeHtml(cliente.canal)}</span>
                           </div>` 
                        : ''}
                    ${!cliente.division && !cliente.canal 
                        ? '<p class="text-gray-500 text-sm">Sin clasificación asignada</p>' 
                        : ''}
                </div>
            </div>
            
            <!-- Metadata -->
            <div class="border-t border-gray-200 pt-6">
                <h4 class="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Información del Registro</h4>
                <div class="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <p class="text-gray-500">Fecha de creación</p>
                        <p class="text-gray-900">${formatDate(cliente.created_at)}</p>
                    </div>
                    <div>
                        <p class="text-gray-500">Última actualización</p>
                        <p class="text-gray-900">${formatDate(cliente.updated_at)}</p>
                    </div>
                    <div>
                        <p class="text-gray-500">ID del Cliente</p>
                        <p class="text-gray-900 font-mono text-xs">${cliente.id}</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Guardar ID para el botón de editar
    modal.dataset.clienteId = cliente.id;
    
    modal.classList.remove('hidden');
    backdrop.classList.remove('hidden');
}

// Cerrar modal de detalle
function closeDetalleModal() {
    const modal = document.getElementById('admin-cliente-detalle-modal');
    const backdrop = document.getElementById('admin-cliente-detalle-backdrop');
    
    modal?.classList.add('hidden');
    backdrop?.classList.add('hidden');
}

// Helpers
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function getInitials(name) {
    if (!name) return '?';
    return name
        .split(' ')
        .slice(0, 2)
        .map(word => word.charAt(0).toUpperCase())
        .join('');
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
        return new Date(dateStr).toLocaleDateString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return '-';
    }
}

// Debounce para búsqueda
function debounce(fn, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
}

// Inicializar event listeners
function bindEventListeners() {
    // Botón de nuevo cliente
    const nuevoBtn = document.getElementById('admin-cliente-nuevo-btn');
    nuevoBtn?.addEventListener('click', openNewModal);
    
    // Formulario de cliente
    const form = document.getElementById('admin-cliente-form');
    form?.addEventListener('submit', saveCliente);
    
    // Botón cancelar del modal
    const cancelBtn = document.getElementById('admin-cliente-cancel-btn');
    cancelBtn?.addEventListener('click', closeModal);
    
    // Cerrar modal con backdrop
    const backdrop = document.getElementById('admin-cliente-modal-backdrop');
    backdrop?.addEventListener('click', closeModal);
    
    // Búsqueda con debounce
    const searchInput = document.getElementById('admin-clientes-search');
    searchInput?.addEventListener('input', debounce((e) => {
        currentFilters.search = e.target.value;
        loadClientes(1);
    }, 300));
    
    // Filtros
    const divisionFilter = document.getElementById('admin-clientes-filter-division');
    divisionFilter?.addEventListener('change', (e) => {
        currentFilters.division = e.target.value;
        loadClientes(1);
    });
    
    const canalFilter = document.getElementById('admin-clientes-filter-canal');
    canalFilter?.addEventListener('change', (e) => {
        currentFilters.canal = e.target.value;
        loadClientes(1);
    });
    
    // Paginación
    const prevBtn = document.getElementById('admin-clientes-prev-btn');
    prevBtn?.addEventListener('click', () => {
        if (currentPage > 1) {
            loadClientes(currentPage - 1);
        }
    });
    
    const nextBtn = document.getElementById('admin-clientes-next-btn');
    nextBtn?.addEventListener('click', () => {
        const totalPages = Math.ceil(totalClientes / ITEMS_PER_PAGE);
        if (currentPage < totalPages) {
            loadClientes(currentPage + 1);
        }
    });
    
    // Modal de detalle
    const detalleCloseBtn = document.getElementById('admin-cliente-detalle-close-btn');
    detalleCloseBtn?.addEventListener('click', closeDetalleModal);
    
    const detalleBackdrop = document.getElementById('admin-cliente-detalle-backdrop');
    detalleBackdrop?.addEventListener('click', closeDetalleModal);
    
    const detalleEditBtn = document.getElementById('admin-cliente-detalle-edit-btn');
    detalleEditBtn?.addEventListener('click', () => {
        const modal = document.getElementById('admin-cliente-detalle-modal');
        const id = modal?.dataset.clienteId;
        if (id) {
            closeDetalleModal();
            openEditModal(id);
        }
    });
    
    // Opción de menú Panel de Administración
    const adminMenuItem = document.getElementById('admin-panel-menu-item');
    adminMenuItem?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Cerrar menú de usuario
        const userMenu = document.getElementById('user-menu');
        userMenu?.classList.add('hidden');
        
        // Disparar evento de navegación
        document.dispatchEvent(new CustomEvent('auth:navigate', { 
            detail: { action: 'admin' } 
        }));
    });
}

// Navegar al panel de admin
function navigateToAdmin() {
    if (!isAdmin()) {
        console.warn('[AdminPanel] User is not admin');
        return;
    }
    
    // Ocultar otras vistas
    document.querySelectorAll('.tab-content').forEach(el => {
        el.classList.add('hidden');
    });
    
    // Quitar active de los tabs de navegación principal
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Mostrar panel admin
    const adminView = document.getElementById('admin-panel-view');
    if (adminView) {
        adminView.classList.remove('hidden');
    }
    
    // Actualizar título de sección
    const sectionTitle = document.getElementById('current-section-title');
    if (sectionTitle) {
        sectionTitle.textContent = 'Panel de Administración';
    }
    
    // Cargar datos
    loadStats();
    loadFilterOptions();
    loadClientes(1);
}

// Inicialización del módulo
export function createAdminPanelModule() {
    let initialized = false;
    
    return {
        init() {
            if (initialized) return;
            
            updateAdminMenuVisibility();
            bindEventListeners();
            
            // Escuchar navegación desde el menú
            document.addEventListener('auth:navigate', (e) => {
                if (e.detail?.action === 'admin') {
                    navigateToAdmin();
                }
            });
            
            initialized = true;
            console.log('[AdminPanel] Module initialized');
        },
        
        isAdmin,
        navigateToAdmin,
        updateAdminMenuVisibility,
        loadClientes,
        loadStats
    };
}

export default createAdminPanelModule;
