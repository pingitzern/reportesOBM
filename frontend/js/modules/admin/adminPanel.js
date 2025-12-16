/**
 * Admin Panel Module
 * Módulo para la gestión de clientes (ABM) y administración del sistema
 */

import { supabase } from '../../supabaseClient.js';
import { getCurrentUserRole } from '../login/auth.js';
import { bindSistemasEquiposEventListeners, loadSistemas, loadEquipos } from './sistemasEquipos.js';

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
let placesAutocomplete = null;

// ============================================
// Google Places Autocomplete
// ============================================

function initGooglePlacesAutocomplete() {
    const direccionInput = document.getElementById('admin-cliente-direccion');

    if (!direccionInput) {
        console.warn('[AdminPanel] Direccion input not found');
        return;
    }

    // Si ya está inicializado, no hacer nada
    if (placesAutocomplete) {
        return;
    }

    // Verificar si Google Places está disponible
    if (!window.google?.maps?.places) {
        console.log('[AdminPanel] Google Places not loaded yet, waiting...');
        return;
    }

    try {
        // Crear el autocomplete
        // eslint-disable-next-line no-undef
        placesAutocomplete = new google.maps.places.Autocomplete(direccionInput, {
            types: ['address'],
            componentRestrictions: { country: 'ar' }, // Restringir a Argentina
            fields: ['formatted_address', 'address_components', 'geometry']
        });

        // Evitar que el formulario se envíe al presionar Enter en el autocomplete
        direccionInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
            }
        });

        // Manejar la selección de una dirección
        placesAutocomplete.addListener('place_changed', () => {
            const place = placesAutocomplete.getPlace();

            if (place.formatted_address) {
                direccionInput.value = place.formatted_address;
                console.log('[AdminPanel] Address selected:', place.formatted_address);
            }
        });

        console.log('[AdminPanel] Google Places Autocomplete initialized');
    } catch (error) {
        console.error('[AdminPanel] Error initializing Google Places:', error);
    }
}

// Intentar inicializar cuando el modal se abre
function tryInitPlacesOnModalOpen() {
    if (window.googlePlacesReady) {
        // Pequeño delay para asegurar que el input esté visible
        setTimeout(initGooglePlacesAutocomplete, 100);
    }
}

// Verificar si el usuario es admin
function isAdmin() {
    const role = getCurrentUserRole();
    console.log('[AdminPanel] Checking role:', role);
    // Aceptar variantes: Administrador, administrador, Admin, admin
    return role && (
        role.toLowerCase() === 'administrador' ||
        role.toLowerCase() === 'admin'
    );
}

// Mostrar/ocultar opción del menú según rol
function updateAdminMenuVisibility() {
    const adminMenuItem = document.getElementById('admin-panel-menu-item');
    const isAdminUser = isAdmin();
    console.log('[AdminPanel] updateAdminMenuVisibility - isAdmin:', isAdminUser);

    if (adminMenuItem) {
        if (isAdminUser) {
            adminMenuItem.classList.remove('hidden');
            console.log('[AdminPanel] Admin menu item shown');
        } else {
            adminMenuItem.classList.add('hidden');
            console.log('[AdminPanel] Admin menu item hidden');
        }
    } else {
        console.warn('[AdminPanel] Admin menu item not found in DOM');
    }
}

// Cargar estadísticas rápidas
async function loadStats() {
    try {
        // Total clientes
        const { count: total } = await supabase
            .from('clients')
            .select('*', { count: 'exact', head: true });

        // Con email
        const { count: conEmail } = await supabase
            .from('clients')
            .select('*', { count: 'exact', head: true })
            .not('email', 'is', null)
            .neq('email', '');

        // Con teléfono
        const { count: conTelefono } = await supabase
            .from('clients')
            .select('*', { count: 'exact', head: true })
            .not('telefono', 'is', null)
            .neq('telefono', '');

        // Con CUIT
        const { count: conCuit } = await supabase
            .from('clients')
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
            .from('clients')
            .select('division')
            .not('division', 'is', null)
            .neq('division', '');

        divisiones = [...new Set(divisionesData?.map(d => d.division).filter(Boolean))].sort();

        // Obtener canales únicos
        const { data: canalesData } = await supabase
            .from('clients')
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

        // También poblar los selects del formulario modal
        populateFormSelects();
    } catch (error) {
        console.error('[AdminPanel] Error loading filter options:', error);
    }
}

// Poblar los selects del formulario de cliente con las opciones disponibles
function populateFormSelects() {
    const divisionSelect = document.getElementById('admin-cliente-division');
    const canalSelect = document.getElementById('admin-cliente-canal');

    if (divisionSelect) {
        const currentValue = divisionSelect.value;
        divisionSelect.innerHTML = '<option value="">Seleccionar división...</option>' +
            divisiones.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');
        if (currentValue) divisionSelect.value = currentValue;
    }

    if (canalSelect) {
        const currentValue = canalSelect.value;
        canalSelect.innerHTML = '<option value="">Seleccionar canal...</option>' +
            canales.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
        if (currentValue) canalSelect.value = currentValue;
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
            .from('clients')
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

    // Asegurar que los selects estén poblados
    populateFormSelects();

    title.textContent = 'Nuevo Cliente';
    form.reset();
    document.getElementById('admin-cliente-id').value = '';
    document.getElementById('admin-cliente-error').classList.add('hidden');

    modal.classList.remove('hidden');
    backdrop.classList.remove('hidden');

    // Inicializar Google Places para el campo de dirección
    tryInitPlacesOnModalOpen();

    document.getElementById('admin-cliente-razon-social').focus();
}

// Abrir modal para editar cliente
async function openEditModal(id) {
    const cliente = clientesCache.find(c => c.id == id);

    if (!cliente) {
        // Cargar desde BD
        const { data, error } = await supabase
            .from('clients')
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

    // Asegurar que los selects estén poblados antes de setear valores
    populateFormSelects();

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

    // Inicializar Google Places para el campo de dirección
    tryInitPlacesOnModalOpen();
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
                .from('clients')
                .update(clienteData)
                .eq('id', id);
        } else {
            // Crear
            result = await supabase
                .from('clients')
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
            .from('clients')
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
            .from('clients')
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

    // Event listeners para usuarios
    bindUsuarioEventListeners();

    // Event listeners para sistemas y equipos
    bindSistemasEquiposEventListeners();
}

// ============================================
// GESTIÓN DE USUARIOS
// ============================================

let usuariosCache = [];
let usuarioFilters = {
    search: '',
    rol: ''
};

// URL de la Edge Function (se configura según el entorno)
function getAdminUsersUrl() {
    // Obtener la URL base de Supabase y construir la URL de la función
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    return `${supabaseUrl}/functions/v1/admin-users`;
}

// Obtener token de autorización
async function getAuthToken() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || '';
}

// Hacer petición a la Edge Function
async function fetchAdminUsers(method, endpoint = '', body = null) {
    const token = await getAuthToken();
    const url = getAdminUsersUrl() + endpoint;

    const options = {
        method,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'Error en la operación');
    }

    return data;
}

// Cargar lista de usuarios
async function loadUsuarios() {
    const tbody = document.getElementById('admin-usuarios-tbody');

    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="6" class="px-6 py-8 text-center text-gray-500">
                <div class="flex items-center justify-center gap-2">
                    <svg class="animate-spin h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    Cargando usuarios...
                </div>
            </td>
        </tr>
    `;

    try {
        const data = await fetchAdminUsers('GET');
        usuariosCache = data.users || [];

        // Aplicar filtros
        let filteredUsers = usuariosCache;

        if (usuarioFilters.search) {
            const searchLower = usuarioFilters.search.toLowerCase();
            filteredUsers = filteredUsers.filter(u =>
                u.email?.toLowerCase().includes(searchLower) ||
                u.nombre?.toLowerCase().includes(searchLower)
            );
        }

        if (usuarioFilters.rol) {
            filteredUsers = filteredUsers.filter(u => u.rol === usuarioFilters.rol);
        }

        renderUsuariosTable(filteredUsers);
        updateUsuariosStats();

    } catch (error) {
        console.error('[AdminPanel] Error loading users:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-8 text-center text-red-500">
                    Error al cargar usuarios: ${escapeHtml(error.message)}
                </td>
            </tr>
        `;
    }
}

// Renderizar tabla de usuarios
function renderUsuariosTable(usuarios) {
    const tbody = document.getElementById('admin-usuarios-tbody');

    if (!tbody) return;

    if (usuarios.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-8 text-center text-gray-500">
                    No se encontraron usuarios
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = usuarios.map(usuario => {
        const rolBadge = getRolBadge(usuario.rol);
        const estadoBadge = getEstadoBadge(usuario);
        const lastAccess = formatLastAccess(usuario.last_sign_in_at);
        const isBanned = !!usuario.banned_until;
        const blockButton = getBlockButton(usuario);

        return `
            <tr class="hover:bg-gray-50 transition-colors ${isBanned ? 'bg-red-50/50' : ''}">
                <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full ${isBanned ? 'bg-gradient-to-br from-gray-400 to-gray-500' : 'bg-gradient-to-br from-indigo-500 to-purple-600'} flex items-center justify-center text-white font-semibold">
                            ${getInitials(usuario.nombre || usuario.email)}
                        </div>
                        <div>
                            <p class="font-medium text-gray-900 ${isBanned ? 'line-through text-gray-500' : ''}">${escapeHtml(usuario.nombre || 'Sin nombre')}</p>
                            <p class="text-sm text-gray-500">${escapeHtml(usuario.cargo || '')}</p>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 text-sm text-gray-600">${escapeHtml(usuario.email)}</td>
                <td class="px-6 py-4">${rolBadge}</td>
                <td class="px-6 py-4 text-sm text-gray-500">${lastAccess}</td>
                <td class="px-6 py-4">${estadoBadge}</td>
                <td class="px-6 py-4 text-right">
                    <div class="flex items-center justify-end gap-1">
                        ${blockButton}
                        <button onclick="window.adminResetPassword('${escapeHtml(usuario.email)}', '${escapeHtml(usuario.nombre || usuario.email)}')" 
                                class="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" 
                                title="Enviar email de reset de contraseña">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                            </svg>
                        </button>
                        <button onclick="window.adminEditUsuario('${usuario.id}')" 
                                class="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" 
                                title="Editar">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </button>
                        <button onclick="window.adminDeleteUsuario('${usuario.id}', '${escapeHtml(usuario.nombre || usuario.email)}')" 
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

// Obtener badge de rol
function getRolBadge(rol) {
    const roles = {
        'Administrador': 'bg-purple-100 text-purple-700',
        'admin': 'bg-purple-100 text-purple-700',
        'supervisor': 'bg-blue-100 text-blue-700',
        'tecnico': 'bg-gray-100 text-gray-700'
    };

    const colorClass = roles[rol] || 'bg-gray-100 text-gray-700';
    const displayRol = rol === 'tecnico' ? 'Técnico' : (rol === 'supervisor' ? 'Supervisor' : rol);

    return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}">${escapeHtml(displayRol)}</span>`;
}

// Obtener botón de bloquear/desbloquear
function getBlockButton(usuario) {
    const isBanned = !!usuario.banned_until;

    if (isBanned) {
        // Botón para desbloquear
        return `
            <button onclick="window.adminToggleBlockUsuario('${usuario.id}', false, '${escapeHtml(usuario.nombre || usuario.email)}')" 
                    class="p-2 text-green-500 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors" 
                    title="Desbloquear usuario">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                </svg>
            </button>
        `;
    } else {
        // Botón para bloquear
        return `
            <button onclick="window.adminToggleBlockUsuario('${usuario.id}', true, '${escapeHtml(usuario.nombre || usuario.email)}')" 
                    class="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors" 
                    title="Bloquear usuario">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
            </button>
        `;
    }
}

// Obtener badge de estado
function getEstadoBadge(usuario) {
    if (usuario.banned_until) {
        return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Bloqueado</span>`;
    }
    if (!usuario.email_confirmed_at) {
        return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">Pendiente</span>`;
    }
    return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Activo</span>`;
}

// Formatear último acceso
function formatLastAccess(date) {
    if (!date) return 'Nunca';

    const d = new Date(date);
    const now = new Date();
    const diffMs = now - d;
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffHours < 1) {
        return 'Hace menos de 1 hora';
    } else if (diffHours < 24) {
        return `Hace ${Math.floor(diffHours)} horas`;
    } else if (diffDays < 7) {
        return `Hace ${Math.floor(diffDays)} días`;
    } else {
        return d.toLocaleDateString('es-AR');
    }
}

// Actualizar estadísticas de usuarios
function updateUsuariosStats() {
    const total = usuariosCache.length;
    const admins = usuariosCache.filter(u => u.rol === 'Administrador' || u.rol === 'admin').length;
    const tecnicos = usuariosCache.filter(u => u.rol === 'tecnico').length;

    // Activos hoy = usuarios que accedieron en las últimas 24 horas
    const now = new Date();
    const activosHoy = usuariosCache.filter(u => {
        if (!u.last_sign_in_at) return false;
        const lastAccess = new Date(u.last_sign_in_at);
        return (now - lastAccess) < (24 * 60 * 60 * 1000);
    }).length;

    document.getElementById('admin-stat-total-usuarios')?.textContent !== undefined &&
        (document.getElementById('admin-stat-total-usuarios').textContent = total);
    document.getElementById('admin-stat-admins')?.textContent !== undefined &&
        (document.getElementById('admin-stat-admins').textContent = admins);
    document.getElementById('admin-stat-tecnicos')?.textContent !== undefined &&
        (document.getElementById('admin-stat-tecnicos').textContent = tecnicos);
    document.getElementById('admin-stat-activos-hoy')?.textContent !== undefined &&
        (document.getElementById('admin-stat-activos-hoy').textContent = activosHoy);
}

// Abrir modal para nuevo usuario
function openUsuarioNewModal() {
    const modal = document.getElementById('admin-usuario-modal');
    const backdrop = document.getElementById('admin-usuario-modal-backdrop');
    const title = document.getElementById('admin-usuario-modal-title');
    const form = document.getElementById('admin-usuario-form');
    const passwordHint = document.getElementById('admin-usuario-password-hint');
    const passwordInfo = document.getElementById('admin-usuario-password-info');
    const passwordConfirmHint = document.getElementById('admin-usuario-password-confirm-hint');
    const passwordConfirmGroup = document.getElementById('admin-usuario-password-confirm-group');
    const emailInput = document.getElementById('admin-usuario-email');

    if (!modal || !form) return;

    title.textContent = 'Nuevo Usuario';
    form.reset();
    document.getElementById('admin-usuario-id').value = '';
    document.getElementById('admin-usuario-error').classList.add('hidden');

    // Para nuevo usuario, contraseña es requerida
    passwordHint.textContent = '*';
    passwordConfirmHint.textContent = '*';
    passwordInfo.classList.add('hidden');
    passwordConfirmGroup?.classList.remove('hidden');
    emailInput.removeAttribute('disabled');

    // Resetear indicadores de fortaleza
    resetPasswordIndicators();

    // Mostrar sección de técnico (ya que rol por defecto es 'tecnico')
    updateTecnicoSectionVisibility('tecnico');

    // Resetear campos de técnico a valores por defecto
    loadTecnicoFields({
        score_ponderado: 0,
        hora_entrada: '08:00',
        hora_salida: '18:00',
        max_horas_dia: 10,
        dias_laborables: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'],
        direccion_base: '',
        lat: null,
        lng: null,
        activo: true
    });

    modal.classList.remove('hidden');
    backdrop.classList.remove('hidden');

    emailInput.focus();
}

// Abrir modal para editar usuario
function openUsuarioEditModal(id) {
    const usuario = usuariosCache.find(u => u.id === id);

    if (!usuario) {
        alert('Usuario no encontrado');
        return;
    }

    const modal = document.getElementById('admin-usuario-modal');
    const backdrop = document.getElementById('admin-usuario-modal-backdrop');
    const title = document.getElementById('admin-usuario-modal-title');
    const passwordHint = document.getElementById('admin-usuario-password-hint');
    const passwordInfo = document.getElementById('admin-usuario-password-info');
    const passwordConfirmHint = document.getElementById('admin-usuario-password-confirm-hint');
    const passwordConfirmGroup = document.getElementById('admin-usuario-password-confirm-group');
    const emailInput = document.getElementById('admin-usuario-email');

    title.textContent = 'Editar Usuario';
    document.getElementById('admin-usuario-id').value = usuario.id;
    emailInput.value = usuario.email || '';
    emailInput.setAttribute('disabled', 'disabled'); // No permitir cambiar email
    document.getElementById('admin-usuario-password').value = '';
    document.getElementById('admin-usuario-password-confirm').value = '';
    document.getElementById('admin-usuario-nombre').value = usuario.nombre || '';
    document.getElementById('admin-usuario-cargo').value = usuario.cargo || '';
    document.getElementById('admin-usuario-rol').value = usuario.rol || 'tecnico';
    document.getElementById('admin-usuario-telefono').value = usuario.telefono || '';
    document.getElementById('admin-usuario-error').classList.add('hidden');

    // Cargar campos de técnico
    loadTecnicoFields(usuario);

    // Mostrar/ocultar sección de técnico según rol
    updateTecnicoSectionVisibility(usuario.rol || 'tecnico');

    // Para edición, contraseña es opcional
    passwordHint.textContent = '(opcional)';
    passwordConfirmHint.textContent = '(opcional)';
    passwordInfo.classList.remove('hidden');
    passwordConfirmGroup?.classList.remove('hidden');

    // Resetear indicadores de fortaleza
    resetPasswordIndicators();

    modal.classList.remove('hidden');
    backdrop.classList.remove('hidden');
}

// Resetear indicadores de contraseña
function resetPasswordIndicators() {
    // Ocultar indicadores de fortaleza
    document.getElementById('admin-usuario-password-strength')?.classList.add('hidden');
    document.getElementById('admin-usuario-password-requirements')?.classList.add('hidden');
    document.getElementById('admin-usuario-password-match')?.classList.add('hidden');

    // Resetear barras de fortaleza
    ['strength-bar-1', 'strength-bar-2', 'strength-bar-3', 'strength-bar-4'].forEach(id => {
        const bar = document.getElementById(id);
        if (bar) {
            bar.className = 'h-1 flex-1 rounded-full bg-gray-200';
        }
    });

    // Resetear requisitos
    ['req-length', 'req-uppercase', 'req-lowercase', 'req-number', 'req-special'].forEach(reqId => {
        const reqEl = document.getElementById(reqId);
        if (reqEl) {
            const svg = reqEl.querySelector('svg');
            const span = reqEl.querySelector('span');
            svg?.classList.remove('text-green-500');
            svg?.classList.add('text-gray-300');
            span?.classList.remove('text-green-600');
            span?.classList.add('text-gray-500');
        }
    });

    // Resetear tipo de input a password
    const passwordInput = document.getElementById('admin-usuario-password');
    const passwordConfirmInput = document.getElementById('admin-usuario-password-confirm');
    if (passwordInput) passwordInput.type = 'password';
    if (passwordConfirmInput) passwordConfirmInput.type = 'password';

    // Resetear iconos de ojo
    document.getElementById('admin-usuario-password-eye')?.classList.remove('hidden');
    document.getElementById('admin-usuario-password-eye-off')?.classList.add('hidden');
    document.getElementById('admin-usuario-password-confirm-eye')?.classList.remove('hidden');
    document.getElementById('admin-usuario-password-confirm-eye-off')?.classList.add('hidden');
}

// Mostrar/ocultar sección de técnico según rol
function updateTecnicoSectionVisibility(rol) {
    const tecnicoSection = document.getElementById('admin-usuario-tecnico-section');
    if (!tecnicoSection) return;

    if (rol === 'tecnico') {
        tecnicoSection.classList.remove('hidden');
    } else {
        tecnicoSection.classList.add('hidden');
    }
}

// Cargar campos de técnico en el formulario
function loadTecnicoFields(usuario) {
    // Score
    const scoreInput = document.getElementById('admin-usuario-score');
    const scoreDisplay = document.getElementById('admin-usuario-score-display');
    if (scoreInput) {
        scoreInput.value = usuario.score_ponderado || 0;
        if (scoreDisplay) scoreDisplay.textContent = usuario.score_ponderado || 0;
    }

    // Horarios
    const horaEntradaInput = document.getElementById('admin-usuario-hora-entrada');
    if (horaEntradaInput) horaEntradaInput.value = usuario.hora_entrada || '08:00';

    const horaSalidaInput = document.getElementById('admin-usuario-hora-salida');
    if (horaSalidaInput) horaSalidaInput.value = usuario.hora_salida || '18:00';

    const maxHorasInput = document.getElementById('admin-usuario-max-horas');
    if (maxHorasInput) maxHorasInput.value = usuario.max_horas_dia || 10;

    // Días laborables - desmarcar todos primero, luego marcar los que corresponden
    const diasCheckboxes = document.querySelectorAll('input[name="dias_laborables"]');
    const diasLaborables = usuario.dias_laborables || ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];
    diasCheckboxes.forEach(cb => {
        cb.checked = diasLaborables.includes(cb.value);
    });

    // Dirección base
    const direccionInput = document.getElementById('admin-usuario-direccion');
    if (direccionInput) direccionInput.value = usuario.direccion_base || '';

    const latInput = document.getElementById('admin-usuario-lat');
    if (latInput) latInput.value = usuario.lat || '';

    const lngInput = document.getElementById('admin-usuario-lng');
    if (lngInput) lngInput.value = usuario.lng || '';

    // Activo
    const activoInput = document.getElementById('admin-usuario-activo');
    if (activoInput) activoInput.checked = usuario.activo !== false;
}

// Cerrar modal de usuario
function closeUsuarioModal() {
    const modal = document.getElementById('admin-usuario-modal');
    const backdrop = document.getElementById('admin-usuario-modal-backdrop');

    modal?.classList.add('hidden');
    backdrop?.classList.add('hidden');
}

// Guardar usuario (crear o editar)
async function saveUsuario(event) {
    event.preventDefault();

    const errorEl = document.getElementById('admin-usuario-error');
    const saveBtn = document.getElementById('admin-usuario-save-btn');
    const id = document.getElementById('admin-usuario-id').value;

    const userData = {
        email: document.getElementById('admin-usuario-email').value.trim(),
        password: document.getElementById('admin-usuario-password').value,
        nombre: document.getElementById('admin-usuario-nombre').value.trim(),
        cargo: document.getElementById('admin-usuario-cargo').value.trim(),
        rol: document.getElementById('admin-usuario-rol').value,
        telefono: document.getElementById('admin-usuario-telefono').value.trim(),
    };

    // Agregar campos de técnico si el rol es 'tecnico'
    if (userData.rol === 'tecnico') {
        userData.score_ponderado = parseFloat(document.getElementById('admin-usuario-score')?.value || '0');
        userData.hora_entrada = document.getElementById('admin-usuario-hora-entrada')?.value || '08:00';
        userData.hora_salida = document.getElementById('admin-usuario-hora-salida')?.value || '18:00';
        userData.max_horas_dia = parseInt(document.getElementById('admin-usuario-max-horas')?.value || '10');
        userData.direccion_base = document.getElementById('admin-usuario-direccion')?.value?.trim() || '';
        userData.lat = parseFloat(document.getElementById('admin-usuario-lat')?.value) || null;
        userData.lng = parseFloat(document.getElementById('admin-usuario-lng')?.value) || null;
        userData.activo = document.getElementById('admin-usuario-activo')?.checked ?? true;

        // Obtener días laborables de checkboxes
        const diasCheckboxes = document.querySelectorAll('input[name="dias_laborables"]:checked');
        userData.dias_laborables = Array.from(diasCheckboxes).map(cb => cb.value);
    }

    const passwordConfirm = document.getElementById('admin-usuario-password-confirm')?.value || '';

    // Validaciones
    if (!userData.email) {
        errorEl.textContent = 'El email es requerido';
        errorEl.classList.remove('hidden');
        return;
    }

    if (!id && (!userData.password || userData.password.length < 6)) {
        errorEl.textContent = 'La contraseña debe tener al menos 6 caracteres';
        errorEl.classList.remove('hidden');
        return;
    }

    if (id && userData.password && userData.password.length > 0 && userData.password.length < 6) {
        errorEl.textContent = 'La contraseña debe tener al menos 6 caracteres';
        errorEl.classList.remove('hidden');
        return;
    }

    // Validar que las contraseñas coincidan (si hay contraseña)
    if (userData.password && userData.password !== passwordConfirm) {
        errorEl.textContent = 'Las contraseñas no coinciden';
        errorEl.classList.remove('hidden');
        return;
    }

    // Si estamos editando y no hay contraseña, no la enviamos
    if (id && !userData.password) {
        delete userData.password;
    }

    saveBtn.disabled = true;
    saveBtn.innerHTML = `
        <svg class="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
        </svg>
        Guardando...
    `;

    try {
        if (id) {
            // Actualizar
            userData.id = id;
            await fetchAdminUsers('PUT', '', userData);
        } else {
            // Crear
            await fetchAdminUsers('POST', '', userData);
        }

        closeUsuarioModal();
        await loadUsuarios();

    } catch (error) {
        console.error('[AdminPanel] Error saving user:', error);
        errorEl.textContent = error.message;
        errorEl.classList.remove('hidden');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Guardar';
    }
}

// Abrir modal de confirmación de eliminación
function openUsuarioDeleteModal(id, nombre) {
    const modal = document.getElementById('admin-usuario-delete-modal');
    const backdrop = document.getElementById('admin-usuario-delete-backdrop');

    document.getElementById('admin-usuario-delete-id').value = id;
    document.getElementById('admin-usuario-delete-name').textContent = nombre;

    modal?.classList.remove('hidden');
    backdrop?.classList.remove('hidden');
}

// Cerrar modal de eliminación
function closeUsuarioDeleteModal() {
    const modal = document.getElementById('admin-usuario-delete-modal');
    const backdrop = document.getElementById('admin-usuario-delete-backdrop');

    modal?.classList.add('hidden');
    backdrop?.classList.add('hidden');
}

// Confirmar eliminación de usuario
async function confirmDeleteUsuario() {
    const id = document.getElementById('admin-usuario-delete-id').value;
    const confirmBtn = document.getElementById('admin-usuario-delete-confirm-btn');

    if (!id) return;

    confirmBtn.disabled = true;
    confirmBtn.innerHTML = `
        <svg class="animate-spin h-4 w-4 mr-2 inline" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
        </svg>
        Eliminando...
    `;

    try {
        await fetchAdminUsers('DELETE', `?id=${id}`);
        closeUsuarioDeleteModal();
        await loadUsuarios();
    } catch (error) {
        console.error('[AdminPanel] Error deleting user:', error);
        alert('Error al eliminar usuario: ' + error.message);
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Eliminar';
    }
}

// Bloquear/Desbloquear usuario
async function toggleBlockUsuario(id, shouldBlock, nombre) {
    const action = shouldBlock ? 'bloquear' : 'desbloquear';

    if (!confirm(`¿Estás seguro de que deseas ${action} al usuario "${nombre}"?`)) {
        return;
    }

    try {
        const result = await fetchAdminUsers('PUT', '', {
            id: id,
            banned: shouldBlock
        });

        // El Edge Function retorna { message, user } en éxito, o { error } en fallo
        if (result.error) {
            alert('Error al ' + action + ' usuario: ' + result.error);
        } else {
            alert(shouldBlock ? 'Usuario bloqueado correctamente' : 'Usuario desbloqueado correctamente');
            await loadUsuarios();
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error al ' + action + ' usuario');
    }
}

// Enviar email de reset de contraseña
async function sendPasswordReset(email, nombre) {
    if (!confirm(`¿Enviar email de recuperación de contraseña a "${nombre}" (${email})?`)) {
        return;
    }

    try {
        const result = await fetchAdminUsers('PATCH', '', { email: email });

        if (result.error) {
            alert('Error: ' + result.error);
        } else if (result.emailSent) {
            // Email enviado exitosamente con Resend
            alert(`✅ Email de recuperación enviado exitosamente a ${email}`);
        } else if (result.recoveryLink) {
            // Fallback: mostrar modal con el link (si Resend falló)
            showRecoveryLinkModal(email, nombre, result.recoveryLink);
        } else {
            alert('Operación completada: ' + (result.message || 'OK'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error al enviar email de recuperación');
    }
}

// Modal para mostrar el link de recuperación
function showRecoveryLinkModal(email, nombre, link) {
    // Crear modal dinámicamente
    const modalHtml = `
        <div id="recovery-link-modal" class="fixed inset-0 z-50 flex items-center justify-center">
            <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" onclick="closeRecoveryModal()"></div>
            <div class="relative bg-white rounded-2xl shadow-2xl max-w-xl w-full mx-4 p-6">
                <div class="flex items-center gap-3 mb-4">
                    <div class="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                        <svg class="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                    </div>
                    <div>
                        <h3 class="text-lg font-semibold text-gray-900">Link de Recuperación</h3>
                        <p class="text-sm text-gray-500">Para: ${nombre} (${email})</p>
                    </div>
                </div>
                
                <div class="bg-gray-50 rounded-lg p-4 mb-4">
                    <p class="text-xs text-gray-500 mb-2">Copiá este link y envialo al usuario:</p>
                    <div class="flex gap-2">
                        <input type="text" id="recovery-link-input" readonly 
                               value="${link}" 
                               class="flex-1 text-sm font-mono bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-700">
                        <button onclick="copyRecoveryLink()" 
                                class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Copiar
                        </button>
                    </div>
                </div>
                
                <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                    <p class="text-sm text-yellow-800">
                        <strong>⚠️ Importante:</strong> Este link expira en 24 horas. El usuario debe usarlo para establecer una nueva contraseña.
                    </p>
                </div>
                
                <div class="flex justify-end">
                    <button onclick="closeRecoveryModal()" 
                            class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function closeRecoveryModal() {
    const modal = document.getElementById('recovery-link-modal');
    if (modal) modal.remove();
}

function copyRecoveryLink() {
    const input = document.getElementById('recovery-link-input');
    if (input) {
        input.select();
        navigator.clipboard.writeText(input.value).then(() => {
            alert('Link copiado al portapapeles!');
        }).catch(() => {
            // Fallback para navegadores que no soportan clipboard API
            document.execCommand('copy');
            alert('Link copiado!');
        });
    }
}

// Exponer funciones del modal de recovery
window.closeRecoveryModal = closeRecoveryModal;
window.copyRecoveryLink = copyRecoveryLink;

// Exponer funciones globalmente para los onclick
window.adminEditUsuario = openUsuarioEditModal;
window.adminDeleteUsuario = openUsuarioDeleteModal;
window.adminToggleBlockUsuario = toggleBlockUsuario;
window.adminResetPassword = sendPasswordReset;

// Event listeners específicos de usuarios
function bindUsuarioEventListeners() {
    // Tabs del admin panel
    document.querySelectorAll('.admin-tab-button').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.adminTab;

            // Actualizar botones
            document.querySelectorAll('.admin-tab-button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Mostrar/ocultar contenido
            document.querySelectorAll('.admin-tab-content').forEach(content => {
                content.classList.add('hidden');
            });

            const targetContent = document.getElementById(`admin-tab-${tabId}`);
            targetContent?.classList.remove('hidden');

            // Cargar datos según la pestaña
            if (tabId === 'usuarios') {
                loadUsuarios();
            } else if (tabId === 'sistemas') {
                loadSistemas();
            } else if (tabId === 'equipos') {
                loadEquipos();
            }
        });
    });

    // Botón nuevo usuario
    const nuevoUsuarioBtn = document.getElementById('admin-usuario-nuevo-btn');
    nuevoUsuarioBtn?.addEventListener('click', openUsuarioNewModal);

    // Formulario de usuario
    const usuarioForm = document.getElementById('admin-usuario-form');
    usuarioForm?.addEventListener('submit', saveUsuario);

    // Cancelar modal usuario
    const usuarioCancelBtn = document.getElementById('admin-usuario-cancel-btn');
    usuarioCancelBtn?.addEventListener('click', closeUsuarioModal);

    // Backdrop modal usuario
    const usuarioBackdrop = document.getElementById('admin-usuario-modal-backdrop');
    usuarioBackdrop?.addEventListener('click', closeUsuarioModal);

    // Modal eliminar usuario
    const deleteCancelBtn = document.getElementById('admin-usuario-delete-cancel-btn');
    deleteCancelBtn?.addEventListener('click', closeUsuarioDeleteModal);

    const deleteConfirmBtn = document.getElementById('admin-usuario-delete-confirm-btn');
    deleteConfirmBtn?.addEventListener('click', confirmDeleteUsuario);

    const deleteBackdrop = document.getElementById('admin-usuario-delete-backdrop');
    deleteBackdrop?.addEventListener('click', closeUsuarioDeleteModal);

    // Búsqueda de usuarios
    const usuariosSearch = document.getElementById('admin-usuarios-search');
    let searchTimeout;
    usuariosSearch?.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            usuarioFilters.search = e.target.value;
            loadUsuarios();
        }, 300);
    });

    // Filtro por rol
    const usuariosFilterRol = document.getElementById('admin-usuarios-filter-rol');
    usuariosFilterRol?.addEventListener('change', (e) => {
        usuarioFilters.rol = e.target.value;
        loadUsuarios();
    });

    // Cambio de rol en el formulario de usuario - mostrar/ocultar sección técnico
    const usuarioRolSelect = document.getElementById('admin-usuario-rol');
    usuarioRolSelect?.addEventListener('change', (e) => {
        updateTecnicoSectionVisibility(e.target.value);
    });

    // Slider de puntuación - actualizar display en tiempo real
    const scoreSlider = document.getElementById('admin-usuario-score');
    const scoreDisplay = document.getElementById('admin-usuario-score-display');
    scoreSlider?.addEventListener('input', (e) => {
        if (scoreDisplay) scoreDisplay.textContent = e.target.value;
    });

    // ============================================
    // Validación de contraseña en tiempo real
    // ============================================

    const passwordInput = document.getElementById('admin-usuario-password');
    const passwordConfirmInput = document.getElementById('admin-usuario-password-confirm');

    // Toggle mostrar/ocultar contraseña
    const passwordToggle = document.getElementById('admin-usuario-password-toggle');
    passwordToggle?.addEventListener('click', () => {
        togglePasswordVisibility('admin-usuario-password', 'admin-usuario-password-eye', 'admin-usuario-password-eye-off');
    });

    const passwordConfirmToggle = document.getElementById('admin-usuario-password-confirm-toggle');
    passwordConfirmToggle?.addEventListener('click', () => {
        togglePasswordVisibility('admin-usuario-password-confirm', 'admin-usuario-password-confirm-eye', 'admin-usuario-password-confirm-eye-off');
    });

    // Validar contraseña mientras escribe
    passwordInput?.addEventListener('input', (e) => {
        validatePasswordStrength(e.target.value);
        validatePasswordMatch();
    });

    // Validar confirmación mientras escribe
    passwordConfirmInput?.addEventListener('input', () => {
        validatePasswordMatch();
    });

    // Mostrar requisitos al enfocar
    passwordInput?.addEventListener('focus', () => {
        const strengthDiv = document.getElementById('admin-usuario-password-strength');
        const reqsDiv = document.getElementById('admin-usuario-password-requirements');
        const isEditing = document.getElementById('admin-usuario-id')?.value;

        // Solo mostrar si hay algo escrito o es usuario nuevo
        if (passwordInput.value || !isEditing) {
            strengthDiv?.classList.remove('hidden');
            reqsDiv?.classList.remove('hidden');
        }
    });
}

// Toggle visibilidad de contraseña
function togglePasswordVisibility(inputId, eyeId, eyeOffId) {
    const input = document.getElementById(inputId);
    const eye = document.getElementById(eyeId);
    const eyeOff = document.getElementById(eyeOffId);

    if (input.type === 'password') {
        input.type = 'text';
        eye.classList.add('hidden');
        eyeOff.classList.remove('hidden');
    } else {
        input.type = 'password';
        eye.classList.remove('hidden');
        eyeOff.classList.add('hidden');
    }
}

// Validar fortaleza de contraseña
function validatePasswordStrength(password) {
    const strengthDiv = document.getElementById('admin-usuario-password-strength');
    const reqsDiv = document.getElementById('admin-usuario-password-requirements');
    const strengthText = document.getElementById('admin-usuario-password-strength-text');

    if (!password) {
        strengthDiv?.classList.add('hidden');
        reqsDiv?.classList.add('hidden');
        return;
    }

    strengthDiv?.classList.remove('hidden');
    reqsDiv?.classList.remove('hidden');

    // Verificar requisitos
    const requirements = {
        length: password.length >= 6,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        number: /[0-9]/.test(password),
        special: /[!@#$%^&*(),.?":{}|<>_\-+=[\]\\/`~]/.test(password)
    };

    // Actualizar indicadores de requisitos
    updateRequirement('req-length', requirements.length);
    updateRequirement('req-uppercase', requirements.uppercase);
    updateRequirement('req-lowercase', requirements.lowercase);
    updateRequirement('req-number', requirements.number);
    updateRequirement('req-special', requirements.special);

    // Calcular puntaje
    const score = Object.values(requirements).filter(Boolean).length;

    // Actualizar barras de fortaleza
    const bars = ['strength-bar-1', 'strength-bar-2', 'strength-bar-3', 'strength-bar-4'];
    const colors = {
        1: 'bg-red-500',
        2: 'bg-orange-500',
        3: 'bg-yellow-500',
        4: 'bg-green-400',
        5: 'bg-green-500'
    };

    bars.forEach((barId, index) => {
        const bar = document.getElementById(barId);
        if (!bar) return;

        // Resetear clases
        bar.className = 'h-1 flex-1 rounded-full';

        if (index < score) {
            bar.classList.add(colors[score] || 'bg-gray-200');
        } else {
            bar.classList.add('bg-gray-200');
        }
    });

    // Actualizar texto de fortaleza
    const strengthLabels = {
        0: { text: 'Muy débil', color: 'text-red-600' },
        1: { text: 'Débil', color: 'text-red-500' },
        2: { text: 'Regular', color: 'text-orange-500' },
        3: { text: 'Buena', color: 'text-yellow-600' },
        4: { text: 'Fuerte', color: 'text-green-500' },
        5: { text: 'Muy fuerte', color: 'text-green-600' }
    };

    const label = strengthLabels[score];
    if (strengthText) {
        strengthText.textContent = `Fortaleza: ${label.text}`;
        strengthText.className = `text-xs ${label.color}`;
    }

    return score;
}

// Actualizar indicador de requisito individual
function updateRequirement(reqId, isMet) {
    const reqEl = document.getElementById(reqId);
    if (!reqEl) return;

    const svg = reqEl.querySelector('svg');
    const span = reqEl.querySelector('span');

    if (isMet) {
        svg.classList.remove('text-gray-300');
        svg.classList.add('text-green-500');
        span.classList.remove('text-gray-500');
        span.classList.add('text-green-600');
    } else {
        svg.classList.remove('text-green-500');
        svg.classList.add('text-gray-300');
        span.classList.remove('text-green-600');
        span.classList.add('text-gray-500');
    }
}

// Validar que las contraseñas coincidan
function validatePasswordMatch() {
    const password = document.getElementById('admin-usuario-password')?.value || '';
    const confirm = document.getElementById('admin-usuario-password-confirm')?.value || '';
    const matchDiv = document.getElementById('admin-usuario-password-match');
    const matchText = document.getElementById('admin-usuario-password-match-text');

    if (!confirm) {
        matchDiv?.classList.add('hidden');
        return true;
    }

    matchDiv?.classList.remove('hidden');

    if (password === confirm) {
        matchText.innerHTML = `
            <svg class="w-3 h-3 flex-shrink-0 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
            <span class="text-green-600">Las contraseñas coinciden</span>
        `;
        return true;
    } else {
        matchText.innerHTML = `
            <svg class="w-3 h-3 flex-shrink-0 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
            </svg>
            <span class="text-red-600">Las contraseñas no coinciden</span>
        `;
        return false;
    }
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

            bindEventListeners();

            // Escuchar navegación desde el menú
            document.addEventListener('auth:navigate', (e) => {
                if (e.detail?.action === 'admin') {
                    navigateToAdmin();
                }
            });

            // Suscribirse a cambios de autenticación para actualizar visibilidad
            supabase.auth.onAuthStateChange((event) => {
                console.log('[AdminPanel] Auth state change:', event);
                // Pequeño delay para asegurar que el storage se haya actualizado
                setTimeout(() => {
                    updateAdminMenuVisibility();
                }, 100);
            });

            // Actualizar visibilidad inicial
            updateAdminMenuVisibility();

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
