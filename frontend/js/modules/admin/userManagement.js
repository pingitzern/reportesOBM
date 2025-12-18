/**
 * User Management Module
 * CRUD de usuarios para el panel de administración
 * Utiliza Edge Function admin-users para operaciones de usuario
 */

import { getCurrentToken } from '../login/auth.js';

// Constantes
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://hcefrvbazosnnynnlsfc.supabase.co';
const VALID_ROLES = ['admin', 'jefe_servicio', 'tecnico'];
const ROLE_LABELS = {
    'admin': 'Administrador',
    'jefe_servicio': 'Jefe de Servicio',
    'tecnico': 'Técnico'
};

// Estado del módulo
let usuariosCache = [];
let currentFilters = {
    search: '',
    rol: ''
};

// ============================================
// API Functions
// ============================================

async function fetchWithAuth(url, options = {}) {
    const token = getCurrentToken();
    if (!token) {
        throw new Error('No hay sesión activa');
    }

    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...options.headers
        }
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || `Error ${response.status}`);
    }

    return data;
}

async function listUsers() {
    return fetchWithAuth(`${SUPABASE_URL}/functions/v1/admin-users`);
}

async function createUser(userData) {
    return fetchWithAuth(`${SUPABASE_URL}/functions/v1/admin-users`, {
        method: 'POST',
        body: JSON.stringify(userData)
    });
}

async function updateUser(userData) {
    return fetchWithAuth(`${SUPABASE_URL}/functions/v1/admin-users`, {
        method: 'PUT',
        body: JSON.stringify(userData)
    });
}

async function deleteUser(userId) {
    return fetchWithAuth(`${SUPABASE_URL}/functions/v1/admin-users?id=${userId}`, {
        method: 'DELETE'
    });
}

async function sendPasswordReset(email) {
    return fetchWithAuth(`${SUPABASE_URL}/functions/v1/admin-users`, {
        method: 'PATCH',
        body: JSON.stringify({ email })
    });
}

// ============================================
// Rendering Functions
// ============================================

function getRoleBadgeClass(rol) {
    const classes = {
        'admin': 'bg-purple-100 text-purple-800',
        'administrador': 'bg-purple-100 text-purple-800',
        'jefe_servicio': 'bg-blue-100 text-blue-800',
        'tecnico': 'bg-green-100 text-green-800'
    };
    return classes[rol?.toLowerCase()] || 'bg-gray-100 text-gray-800';
}

function getRoleLabel(rol) {
    const normalized = rol?.toLowerCase();
    return ROLE_LABELS[normalized] || rol || 'Sin rol';
}

function formatDate(dateStr) {
    if (!dateStr) return 'Nunca';
    try {
        return new Date(dateStr).toLocaleDateString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return 'Fecha inválida';
    }
}

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

function renderUsuarios(usuarios) {
    const tbody = document.getElementById('admin-usuarios-tbody');
    if (!tbody) return;

    if (!usuarios || usuarios.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-8 text-center text-gray-500">
                    No se encontraron usuarios.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = usuarios.map(user => `
        <tr class="hover:bg-gray-50 transition-colors">
            <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                    <div class="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                        <span class="text-indigo-600 font-semibold text-sm">
                            ${getInitials(user.nombre || user.email)}
                        </span>
                    </div>
                    <div>
                        <p class="font-medium text-gray-900">${escapeHtml(user.nombre || 'Sin nombre')}</p>
                        <p class="text-sm text-gray-500">${escapeHtml(user.cargo || '')}</p>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4">
                <p class="text-gray-900">${escapeHtml(user.email)}</p>
            </td>
            <td class="px-6 py-4">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeClass(user.rol)}">
                    ${getRoleLabel(user.rol)}
                </span>
            </td>
            <td class="px-6 py-4 text-sm text-gray-500">
                ${formatDate(user.last_sign_in_at)}
            </td>
            <td class="px-6 py-4">
                ${user.banned_until
            ? '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Bloqueado</span>'
            : '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Activo</span>'
        }
            </td>
            <td class="px-6 py-4 text-right">
                <div class="flex items-center justify-end gap-2">
                    <button type="button" class="user-edit-btn p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" 
                            title="Editar" data-id="${user.id}">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </button>
                    <button type="button" class="user-reset-btn p-2 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" 
                            title="Enviar reset de contraseña" data-email="${user.email}">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                    </button>
                    <button type="button" class="user-delete-btn p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" 
                            title="Eliminar" data-id="${user.id}" data-nombre="${escapeHtml(user.nombre || user.email)}">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');

    // Bind event listeners
    tbody.querySelectorAll('.user-edit-btn').forEach(btn => {
        btn.addEventListener('click', () => openEditModal(btn.dataset.id));
    });

    tbody.querySelectorAll('.user-reset-btn').forEach(btn => {
        btn.addEventListener('click', () => handleResetPassword(btn.dataset.email));
    });

    tbody.querySelectorAll('.user-delete-btn').forEach(btn => {
        btn.addEventListener('click', () => handleDeleteUser(btn.dataset.id, btn.dataset.nombre));
    });
}

function updateStats(usuarios) {
    const total = usuarios.length;
    const admins = usuarios.filter(u => (u.rol || '').toLowerCase() === 'admin' || (u.rol || '').toLowerCase() === 'administrador').length;
    const tecnicos = usuarios.filter(u => (u.rol || '').toLowerCase() === 'tecnico').length;
    const today = new Date().toDateString();
    const activosHoy = usuarios.filter(u => {
        if (!u.last_sign_in_at) return false;
        return new Date(u.last_sign_in_at).toDateString() === today;
    }).length;

    const setElement = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };

    setElement('admin-stat-total-usuarios', total);
    setElement('admin-stat-admins', admins);
    setElement('admin-stat-tecnicos', tecnicos);
    setElement('admin-stat-activos-hoy', activosHoy);
}

// ============================================
// Modal Functions
// ============================================

function createUserModal() {
    // Check if modal already exists
    if (document.getElementById('admin-usuario-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'admin-usuario-modal';
    modal.className = 'fixed inset-0 z-50 hidden';
    modal.innerHTML = `
        <div id="admin-usuario-modal-backdrop" class="fixed inset-0 bg-black/50 backdrop-blur-sm"></div>
        <div class="fixed inset-0 flex items-center justify-center p-4">
            <div class="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-auto">
                <div class="p-6 border-b border-gray-200">
                    <h3 id="admin-usuario-modal-title" class="text-xl font-bold text-gray-900">Nuevo Usuario</h3>
                </div>
                <form id="admin-usuario-form" class="p-6 space-y-4">
                    <input type="hidden" id="admin-usuario-id">
                    
                    <div id="admin-usuario-error" class="hidden bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm"></div>
                    
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label for="admin-usuario-nombre" class="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                            <input type="text" id="admin-usuario-nombre" required
                                class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                placeholder="Nombre completo">
                        </div>
                        <div>
                            <label for="admin-usuario-cargo" class="block text-sm font-medium text-gray-700 mb-1">Cargo</label>
                            <input type="text" id="admin-usuario-cargo"
                                class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                placeholder="Cargo o posición">
                        </div>
                    </div>
                    
                    <div>
                        <label for="admin-usuario-email" class="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                        <input type="email" id="admin-usuario-email" required
                            class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="email@ejemplo.com">
                    </div>
                    
                    <div id="admin-usuario-password-section">
                        <label for="admin-usuario-password" class="block text-sm font-medium text-gray-700 mb-1">
                            Contraseña <span id="admin-usuario-password-required">*</span>
                        </label>
                        <input type="password" id="admin-usuario-password"
                            class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="Mínimo 6 caracteres">
                        <p id="admin-usuario-password-hint" class="mt-1 text-xs text-gray-500 hidden">Dejá vacío para mantener la contraseña actual</p>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label for="admin-usuario-rol" class="block text-sm font-medium text-gray-700 mb-1">Rol *</label>
                            <select id="admin-usuario-rol" required
                                class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                                <option value="">Seleccionar rol...</option>
                                <option value="admin">Administrador</option>
                                <option value="jefe_servicio">Jefe de Servicio</option>
                                <option value="tecnico">Técnico</option>
                            </select>
                        </div>
                        <div>
                            <label for="admin-usuario-telefono" class="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                            <input type="tel" id="admin-usuario-telefono"
                                class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                placeholder="+54 11 1234-5678">
                        </div>
                    </div>
                    
                    <div class="flex justify-end gap-3 pt-4 border-t border-gray-200">
                        <button type="button" id="admin-usuario-cancel-btn"
                            class="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors">
                            Cancelar
                        </button>
                        <button type="submit" id="admin-usuario-save-btn"
                            class="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors">
                            Guardar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Bind modal events
    document.getElementById('admin-usuario-modal-backdrop')?.addEventListener('click', closeModal);
    document.getElementById('admin-usuario-cancel-btn')?.addEventListener('click', closeModal);
    document.getElementById('admin-usuario-form')?.addEventListener('submit', handleSaveUser);
}

function openNewModal() {
    createUserModal();
    const modal = document.getElementById('admin-usuario-modal');
    const title = document.getElementById('admin-usuario-modal-title');
    const form = document.getElementById('admin-usuario-form');
    const passwordHint = document.getElementById('admin-usuario-password-hint');
    const passwordRequired = document.getElementById('admin-usuario-password-required');
    const passwordInput = document.getElementById('admin-usuario-password');
    const emailInput = document.getElementById('admin-usuario-email');

    if (!modal || !form) return;

    title.textContent = 'Nuevo Usuario';
    form.reset();
    document.getElementById('admin-usuario-id').value = '';
    document.getElementById('admin-usuario-error').classList.add('hidden');
    passwordHint?.classList.add('hidden');
    if (passwordRequired) passwordRequired.textContent = '*';
    if (passwordInput) passwordInput.required = true;
    if (emailInput) emailInput.disabled = false;

    modal.classList.remove('hidden');
    document.getElementById('admin-usuario-nombre')?.focus();
}

async function openEditModal(userId) {
    createUserModal();
    const user = usuariosCache.find(u => u.id === userId);
    if (!user) {
        alert('Usuario no encontrado');
        return;
    }

    const modal = document.getElementById('admin-usuario-modal');
    const title = document.getElementById('admin-usuario-modal-title');
    const passwordHint = document.getElementById('admin-usuario-password-hint');
    const passwordRequired = document.getElementById('admin-usuario-password-required');
    const passwordInput = document.getElementById('admin-usuario-password');
    const emailInput = document.getElementById('admin-usuario-email');

    title.textContent = 'Editar Usuario';
    document.getElementById('admin-usuario-id').value = user.id;
    document.getElementById('admin-usuario-nombre').value = user.nombre || '';
    document.getElementById('admin-usuario-cargo').value = user.cargo || '';
    document.getElementById('admin-usuario-email').value = user.email || '';
    document.getElementById('admin-usuario-password').value = '';
    document.getElementById('admin-usuario-rol').value = user.rol?.toLowerCase() || 'tecnico';
    document.getElementById('admin-usuario-telefono').value = user.telefono || '';
    document.getElementById('admin-usuario-error').classList.add('hidden');

    passwordHint?.classList.remove('hidden');
    if (passwordRequired) passwordRequired.textContent = '';
    if (passwordInput) passwordInput.required = false;
    if (emailInput) emailInput.disabled = true;

    modal.classList.remove('hidden');
}

function closeModal() {
    const modal = document.getElementById('admin-usuario-modal');
    modal?.classList.add('hidden');
}

// ============================================
// Event Handlers
// ============================================

async function handleSaveUser(event) {
    event.preventDefault();

    const errorEl = document.getElementById('admin-usuario-error');
    const saveBtn = document.getElementById('admin-usuario-save-btn');

    const id = document.getElementById('admin-usuario-id').value;
    const nombre = document.getElementById('admin-usuario-nombre').value.trim();
    const email = document.getElementById('admin-usuario-email').value.trim();
    const password = document.getElementById('admin-usuario-password').value;
    const cargo = document.getElementById('admin-usuario-cargo').value.trim();
    const rol = document.getElementById('admin-usuario-rol').value;
    const telefono = document.getElementById('admin-usuario-telefono').value.trim();

    // Validation
    if (!nombre) {
        errorEl.textContent = 'El nombre es obligatorio';
        errorEl.classList.remove('hidden');
        return;
    }

    if (!email) {
        errorEl.textContent = 'El email es obligatorio';
        errorEl.classList.remove('hidden');
        return;
    }

    if (!id && (!password || password.length < 6)) {
        errorEl.textContent = 'La contraseña debe tener al menos 6 caracteres';
        errorEl.classList.remove('hidden');
        return;
    }

    if (id && password && password.length > 0 && password.length < 6) {
        errorEl.textContent = 'La contraseña debe tener al menos 6 caracteres';
        errorEl.classList.remove('hidden');
        return;
    }

    if (!rol) {
        errorEl.textContent = 'Seleccioná un rol';
        errorEl.classList.remove('hidden');
        return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Guardando...';

    try {
        const userData = { nombre, cargo, rol, telefono };

        if (id) {
            userData.id = id;
            if (password) userData.password = password;
            await updateUser(userData);
        } else {
            userData.email = email;
            userData.password = password;
            await createUser(userData);
        }

        closeModal();
        await loadUsuarios();
    } catch (error) {
        console.error('[UserManagement] Error saving user:', error);
        errorEl.textContent = error.message || 'Error al guardar el usuario';
        errorEl.classList.remove('hidden');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Guardar';
    }
}

async function handleDeleteUser(userId, nombre) {
    if (!confirm(`¿Estás seguro de eliminar al usuario "${nombre}"? Esta acción no se puede deshacer.`)) {
        return;
    }

    try {
        await deleteUser(userId);
        await loadUsuarios();
    } catch (error) {
        console.error('[UserManagement] Error deleting user:', error);
        alert('Error al eliminar el usuario: ' + error.message);
    }
}

async function handleResetPassword(email) {
    if (!confirm(`¿Enviar email de recuperación de contraseña a ${email}?`)) {
        return;
    }

    try {
        const result = await sendPasswordReset(email);

        if (result.emailSent) {
            alert(`✅ Email de recuperación enviado a ${email}`);
        } else if (result.recoveryLink) {
            // Fallback: mostrar el link
            const copyLink = confirm(`No se pudo enviar el email automáticamente.\n\n¿Copiar el link de recuperación al portapapeles?`);
            if (copyLink) {
                await navigator.clipboard.writeText(result.recoveryLink);
                alert('Link copiado al portapapeles');
            }
        }
    } catch (error) {
        console.error('[UserManagement] Error sending reset:', error);
        alert('Error al enviar email de recuperación: ' + error.message);
    }
}

// ============================================
// Main Functions
// ============================================

export async function loadUsuarios() {
    const tbody = document.getElementById('admin-usuarios-tbody');

    if (tbody) {
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
    }

    try {
        const { users } = await listUsers();
        usuariosCache = users || [];

        // Apply filters
        let filtered = [...usuariosCache];

        if (currentFilters.search) {
            const term = currentFilters.search.toLowerCase();
            filtered = filtered.filter(u =>
                (u.nombre || '').toLowerCase().includes(term) ||
                (u.email || '').toLowerCase().includes(term) ||
                (u.cargo || '').toLowerCase().includes(term)
            );
        }

        if (currentFilters.rol) {
            filtered = filtered.filter(u => (u.rol || '').toLowerCase() === currentFilters.rol.toLowerCase());
        }

        renderUsuarios(filtered);
        updateStats(usuariosCache);

    } catch (error) {
        console.error('[UserManagement] Error loading users:', error);
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="px-6 py-8 text-center text-red-500">
                        Error al cargar usuarios: ${escapeHtml(error.message)}
                    </td>
                </tr>
            `;
        }
    }
}

function debounce(fn, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
}

export function bindEventListeners() {
    // Nuevo usuario
    const nuevoBtn = document.getElementById('admin-usuario-nuevo-btn');
    nuevoBtn?.addEventListener('click', openNewModal);

    // Búsqueda
    const searchInput = document.getElementById('admin-usuarios-search');
    searchInput?.addEventListener('input', debounce((e) => {
        currentFilters.search = e.target.value;
        loadUsuarios();
    }, 300));

    // Filtro por rol
    const rolFilter = document.getElementById('admin-usuarios-filter-rol');
    rolFilter?.addEventListener('change', (e) => {
        currentFilters.rol = e.target.value;
        loadUsuarios();
    });
}

export function initialize() {
    console.log('[UserManagement] Initializing...');
    bindEventListeners();
}
