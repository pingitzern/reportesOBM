import { serializeForm, normalizeDateToISO } from '../mantenimiento/forms.js';
import { state } from '../mantenimiento/state.js';
import { getCurrentUserRole } from '../login/auth.js';

function getElement(id) {
    return document.getElementById(id);
}

// Verificar si el usuario es administrador
function isAdmin() {
    const role = getCurrentUserRole();
    return role === 'Administrador' || role === 'admin';
}

function toDateInputValue(value) {
    return normalizeDateToISO(value) || '';
}

function createCell(text) {
    const cell = document.createElement('td');
    cell.className = 'px-6 py-4 whitespace-nowrap';
    cell.textContent = text;
    return cell;
}

function escapeAttributeValue(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

export function renderSearchResults(mantenimientos, { onEdit, onDelete }) {
    const tabla = getElement('tabla-resultados');
    const container = getElement('resultados-busqueda');
    if (!tabla || !container) {
        return;
    }

    state.mantenimientos = Array.isArray(mantenimientos) ? mantenimientos : [];

    tabla.innerHTML = '';

    if (!state.mantenimientos.length) {
        const emptyRow = document.createElement('tr');
        const emptyCell = document.createElement('td');
        emptyCell.colSpan = 5;
        emptyCell.className = 'px-6 py-4 text-center';
        emptyCell.textContent = 'No se encontraron resultados';
        emptyRow.appendChild(emptyCell);
        tabla.appendChild(emptyRow);
        container.classList.remove('hidden');
        return;
    }

    state.mantenimientos.forEach(mantenimiento => {
        const fila = document.createElement('tr');
        fila.appendChild(createCell(mantenimiento.Cliente || 'N/A'));
        fila.appendChild(createCell(mantenimiento.Fecha_Servicio || 'N/A'));
        fila.appendChild(createCell(mantenimiento.Tecnico_Asignado || 'N/A'));
        fila.appendChild(createCell(mantenimiento.Modelo_Equipo || 'N/A'));

        const acciones = document.createElement('td');
        acciones.className = 'px-6 py-4 whitespace-nowrap';

        // Solo administradores pueden editar y eliminar
        if (isAdmin()) {
            const editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.className = 'text-blue-600 hover:text-blue-900 mr-2';
            editBtn.textContent = 'Editar';
            editBtn.addEventListener('click', () => onEdit(mantenimiento));

            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'text-red-600 hover:text-red-900';
            deleteBtn.textContent = 'Eliminar';
            deleteBtn.addEventListener('click', () => onDelete(mantenimiento));

            acciones.appendChild(editBtn);
            acciones.appendChild(deleteBtn);
        } else {
            // Técnicos solo pueden ver
            const viewText = document.createElement('span');
            viewText.className = 'text-gray-500 text-sm';
            viewText.textContent = 'Solo lectura';
            acciones.appendChild(viewText);
        }

        fila.appendChild(acciones);

        tabla.appendChild(fila);
    });

    container.classList.remove('hidden');
}

export function clearSearchResults() {
    const tabla = getElement('tabla-resultados');
    if (tabla) {
        tabla.innerHTML = '';
    }
    const container = getElement('resultados-busqueda');
    if (container) {
        container.classList.add('hidden');
    }
    state.mantenimientos = [];
}

export function openEditModal(mantenimiento) {
    const modal = getElement('modal-edicion');
    const formulario = getElement('formulario-edicion');

    if (!modal || !formulario) {
        return;
    }

    state.mantenimientoEditando = mantenimiento;

    const fechaServicioISO = toDateInputValue(mantenimiento.Fecha_Servicio);
    const proximoMantenimientoISO = toDateInputValue(mantenimiento.Proximo_Mantenimiento);

    formulario.innerHTML = `
        <form id="edit-form">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
                    <input type="text" id="edit-cliente" name="cliente" value="${escapeAttributeValue(mantenimiento.Cliente || '')}" class="w-full border-gray-300 rounded-md p-2">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Fecha Servicio</label>
                    <input type="date" id="edit-fecha" name="fecha_servicio" value="${escapeAttributeValue(fechaServicioISO)}" class="w-full border-gray-300 rounded-md p-2">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Técnico</label>
                    <input type="text" id="edit-tecnico" name="tecnico_asignado" value="${escapeAttributeValue(mantenimiento.Tecnico_Asignado || '')}" class="w-full border-gray-300 rounded-md p-2">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Próximo Mantenimiento</label>
                    <input type="date" id="edit-proximo-mant" name="proximo_mantenimiento" value="${escapeAttributeValue(proximoMantenimientoISO)}" class="w-full border-gray-300 rounded-md p-2">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Conductividad Permeado</label>
                    <input type="number" id="edit-cond-perm" name="conductividad_permeado_left" value="${escapeAttributeValue(mantenimiento.Conductividad_Permeado_Left || 0)}" class="w-full border-gray-300 rounded-md p-2">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Resumen</label>
                    <textarea id="edit-resumen" name="resumen_recomendaciones" rows="3" class="w-full border-gray-300 rounded-md p-2">${escapeAttributeValue(mantenimiento.Resumen_Recomendaciones || '')}</textarea>
                </div>
            </div>
            <input type="hidden" id="edit-id" name="id" value="${escapeAttributeValue(mantenimiento.ID_Unico || '')}">
        </form>
    `;

    modal.classList.remove('hidden');
}

export function closeEditModal() {
    const modal = getElement('modal-edicion');
    if (modal) {
        modal.classList.add('hidden');
    }
    state.mantenimientoEditando = null;
}

export function getEditFormValues() {
    const form = document.getElementById('edit-form');
    if (!(form instanceof HTMLFormElement)) {
        return {};
    }

    const values = serializeForm(form);

    if (Object.prototype.hasOwnProperty.call(values, 'conductividad_permeado_left') && values.conductividad_permeado_left === '') {
        values.conductividad_permeado_left = 0;
    }

    if (Object.prototype.hasOwnProperty.call(values, 'fecha_servicio')) {
        values.fecha_servicio = normalizeDateToISO(values.fecha_servicio);
    }

    if (Object.prototype.hasOwnProperty.call(values, 'proximo_mantenimiento')) {
        values.proximo_mantenimiento = normalizeDateToISO(values.proximo_mantenimiento);
    }

    return values;
}
