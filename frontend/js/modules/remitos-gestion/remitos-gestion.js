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
            fechaRemitoIsoValue ?? fechaRemitoISO,
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

function getEmptyFormData() {
    return {
        numeroRemito: '',
        numeroReporte: '',
        cliente: '',
        fechaRemitoISO: '',
        fechaServicioISO: '',
        tecnico: '',
        observaciones: '',
        direccion: '',
        telefono: '',
        email: '',
        reporteId: '',
    };
}

function formatDateForInput(value) {
    const sanitized = sanitizeString(value);
    if (!sanitized) {
        return '';
    }

    if (/^\d{4}-\d{2}-\d{2}/.test(sanitized)) {
        return sanitized.slice(0, 10);
    }

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(sanitized)) {
        const [day, month, year] = sanitized.split('/');
        return `${year}-${month}-${day}`;
    }

    const parsed = new Date(sanitized);
    if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
    }

    return '';
}

function mapRemitoToFormData(remito = {}) {
    return {
        numeroRemito: sanitizeString(remito.numeroRemito),
        numeroReporte: sanitizeString(remito.numeroReporte),
        cliente: sanitizeString(remito.cliente),
        fechaRemitoISO: formatDateForInput(remito.fechaRemitoISO || remito.fechaRemito),
        fechaServicioISO: formatDateForInput(remito.fechaServicioISO || remito.fechaServicio),
        tecnico: sanitizeString(remito.tecnico),
        observaciones: sanitizeString(remito.observaciones),
        direccion: sanitizeString(remito.direccion),
        telefono: sanitizeString(remito.telefono),
        email: sanitizeString(remito.email),
        reporteId: sanitizeString(remito.reporteId),
    };
}

function buildPayloadFromForm(formData = {}) {
    const fechaRemitoISO = sanitizeString(formData.fechaRemitoISO);
    const fechaServicioISO = sanitizeString(formData.fechaServicioISO);

    return {
        numeroRemito: sanitizeString(formData.numeroRemito),
        numeroReporte: sanitizeString(formData.numeroReporte),
        cliente: sanitizeString(formData.cliente),
        fechaRemito: fechaRemitoISO,
        fechaRemitoISO,
        fechaServicio: fechaServicioISO,
        fechaServicioISO,
        tecnico: sanitizeString(formData.tecnico),
        observaciones: sanitizeString(formData.observaciones),
        direccion: sanitizeString(formData.direccion),
        telefono: sanitizeString(formData.telefono),
        email: sanitizeString(formData.email),
        reporteId: sanitizeString(formData.reporteId),
    };
}

function buildReporteDataFromPayload(payload = {}) {
    const numeroRemito = sanitizeString(payload.numeroRemito);
    const numeroReporte = sanitizeString(payload.numeroReporte);
    const cliente = sanitizeString(payload.cliente);
    const fechaRemitoISO = sanitizeString(payload.fechaRemitoISO);
    const fechaRemito = sanitizeString(payload.fechaRemito) || fechaRemitoISO;
    const fechaServicioISO = sanitizeString(payload.fechaServicioISO);
    const fechaServicio = sanitizeString(payload.fechaServicio) || fechaServicioISO;
    const tecnico = sanitizeString(payload.tecnico);
    const observaciones = sanitizeString(payload.observaciones);
    const direccion = sanitizeString(payload.direccion);
    const telefono = sanitizeString(payload.telefono);
    const email = sanitizeString(payload.email);
    const reporteId = sanitizeString(payload.reporteId);

    const reporteData = {
        NumeroRemito: numeroRemito || undefined,
        numero_remito: numeroRemito || undefined,
        remitoNumero: numeroRemito || undefined,
        NumeroReporte: numeroReporte || undefined,
        numero_reporte: numeroReporte || undefined,
        numeroReporte: numeroReporte || undefined,
        clienteNombre: cliente || undefined,
        Cliente: cliente || undefined,
        cliente: cliente || undefined,
        fecha_display: fechaRemito || undefined,
        FechaRemito: fechaRemito || undefined,
        FechaRemitoISO: fechaRemitoISO || undefined,
        fecha: fechaServicio || undefined,
        fecha_servicio: fechaServicio || undefined,
        Fecha_Servicio: fechaServicio || undefined,
        FechaServicio: fechaServicio || undefined,
        FechaServicioISO: fechaServicioISO || undefined,
        tecnico: tecnico || undefined,
        Tecnico: tecnico || undefined,
        observaciones: observaciones || undefined,
        Observaciones: observaciones || undefined,
        direccion: direccion || undefined,
        Direccion: direccion || undefined,
        cliente_direccion: direccion || undefined,
        cliente_telefono: telefono || undefined,
        telefono_cliente: telefono || undefined,
        Telefono: telefono || undefined,
        cliente_email: email || undefined,
        email: email || undefined,
        Email: email || undefined,
        reporteId: reporteId || undefined,
        ID: reporteId || undefined,
        Id: reporteId || undefined,
        ID_Unico: reporteId || undefined,
    };

    return Object.fromEntries(
        Object.entries(reporteData).filter(([, value]) => value !== undefined && value !== ''),
    );
}

function buildCreateRemitoRequest(payload = {}) {
    const reporteData = buildReporteDataFromPayload(payload);

    if (!reporteData || Object.keys(reporteData).length === 0) {
        throw new Error('No se pudo generar la información del remito para enviarla al servidor.');
    }

    const request = { reporteData };
    const observaciones = sanitizeString(payload.observaciones);
    if (observaciones) {
        request.observaciones = observaciones;
    }

    return request;
}

function validateFormData(formData = {}) {
    const errors = [];

    if (!sanitizeString(formData.numeroRemito)) {
        errors.push('El número de remito es obligatorio.');
    }

    if (!sanitizeString(formData.cliente)) {
        errors.push('El nombre del cliente es obligatorio.');
    }

    return errors;
}

function getRemitoIdentifier(remito) {
    if (!remito || typeof remito !== 'object') {
        return '';
    }

    return sanitizeString(remito.reporteId) || sanitizeString(remito.numeroRemito);
}

const state = {
    remitos: [],
    currentPage: 1,
    totalPages: 0,
    totalItems: 0,
    pageSize: DEFAULT_PAGE_SIZE,
    isLoading: false,
    lastError: null,
    viewMode: 'list',
    formMode: 'create',
    formData: getEmptyFormData(),
    editingRemitoId: null,
    editingRemitoLabel: '',
    editingRemitoOriginal: null,
    isSaving: false,
    isDeleting: false,
    deletingIndex: null,
    feedback: null,
};

const defaultDependencies = {
    obtenerRemitos: async () => {
        throw new Error('La función obtenerRemitos no fue provista.');
    },
    crearRemito: async () => {
        throw new Error('La función crearRemito no fue provista.');
    },
    actualizarRemito: async () => {
        throw new Error('La función actualizarRemito no fue provista.');
    },
    eliminarRemito: async () => {
        throw new Error('La función eliminarRemito no fue provista.');
    },
};

let dependencies = { ...defaultDependencies };

function setDependencies(overrides = {}) {
    dependencies = { ...defaultDependencies, ...(overrides || {}) };
}

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

function setFeedback(type, message) {
    const messageText = sanitizeString(message);
    if (!type || !messageText) {
        state.feedback = null;
        return;
    }

    state.feedback = { type, message: messageText };
}

function resetFormState({ viewMode = 'list' } = {}) {
    state.formMode = 'create';
    state.formData = getEmptyFormData();
    state.editingRemitoId = null;
    state.editingRemitoLabel = '';
    state.editingRemitoOriginal = null;
    state.viewMode = viewMode;
}

function renderManagementView() {
    const container = getContainerElement();
    if (!container) {
        return;
    }

    const disableFormFields = state.isSaving || state.isLoading;
    const disabledAttr = disableFormFields ? 'disabled' : '';
    const submitLabel = state.formMode === 'edit'
        ? (state.isSaving ? 'Guardando cambios...' : 'Actualizar remito')
        : (state.isSaving ? 'Guardando remito...' : 'Crear remito');

    const feedbackHtml = state.feedback
        ? `<div class="rounded-lg border ${state.feedback.type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'} px-4 py-3 text-sm font-medium">${escapeHtml(state.feedback.message)}</div>`
        : '';

    const formTitle = state.formMode === 'edit' ? 'Editar remito' : 'Registrar nuevo remito';
    const editingLabel = escapeHtml(state.editingRemitoLabel || state.formData.numeroRemito || '');
    const formSubtitle = state.formMode === 'edit'
        ? `Estás editando el remito ${editingLabel}.`
        : 'Completá los datos para registrar un remito manualmente.';

    const secondaryButtons = [
        `<button type="button" class="inline-flex justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60" data-remitos-action="back-to-list" ${disabledAttr}>Volver al listado</button>`,
    ];

    if (state.formMode === 'edit') {
        secondaryButtons.unshift(`<button type="button" class="inline-flex justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60" data-remitos-action="cancel-edit" ${disabledAttr}>Cancelar edición</button>`);
    }

    const secondaryButtonHtml = secondaryButtons.join('');

    if (state.viewMode === 'form') {
        container.innerHTML = `
            <div class="space-y-6">
                ${feedbackHtml ? `<div>${feedbackHtml}</div>` : ''}
                <div class="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                    <div class="border-b border-gray-100 px-6 py-5">
                        <h3 class="text-lg font-semibold text-gray-800">${escapeHtml(formTitle)}</h3>
                        <p class="mt-1 text-sm text-gray-500">${formSubtitle}</p>
                    </div>
                    <form id="remito-abm-form" class="space-y-5 px-6 py-6">
                        <div class="space-y-4">
                            <div class="flex flex-col gap-1">
                                <label for="remito-form-numero" class="text-sm font-medium text-gray-700">Número de remito *</label>
                                <input id="remito-form-numero" type="text" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500" data-remito-field="numeroRemito" value="${escapeHtml(state.formData.numeroRemito)}" placeholder="Ej. REM-2024-001" ${disabledAttr}>
                            </div>
                            <div class="flex flex-col gap-1">
                                <label for="remito-form-reporte" class="text-sm font-medium text-gray-700">Número de reporte</label>
                                <input id="remito-form-reporte" type="text" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500" data-remito-field="numeroReporte" value="${escapeHtml(state.formData.numeroReporte)}" placeholder="Ej. REP-2024-015" ${disabledAttr}>
                            </div>
                            <div class="flex flex-col gap-1">
                                <label for="remito-form-cliente" class="text-sm font-medium text-gray-700">Cliente *</label>
                                <input id="remito-form-cliente" type="text" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500" data-remito-field="cliente" value="${escapeHtml(state.formData.cliente)}" placeholder="Nombre del cliente" ${disabledAttr}>
                            </div>
                            <div class="flex flex-col gap-1">
                                <label for="remito-form-fecha" class="text-sm font-medium text-gray-700">Fecha del remito</label>
                                <input id="remito-form-fecha" type="date" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500" data-remito-field="fechaRemitoISO" value="${escapeHtml(state.formData.fechaRemitoISO)}" ${disabledAttr}>
                            </div>
                            <div class="flex flex-col gap-1">
                                <label for="remito-form-fecha-servicio" class="text-sm font-medium text-gray-700">Fecha del servicio</label>
                                <input id="remito-form-fecha-servicio" type="date" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500" data-remito-field="fechaServicioISO" value="${escapeHtml(state.formData.fechaServicioISO)}" ${disabledAttr}>
                            </div>
                            <div class="flex flex-col gap-1">
                                <label for="remito-form-tecnico" class="text-sm font-medium text-gray-700">Técnico</label>
                                <input id="remito-form-tecnico" type="text" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500" data-remito-field="tecnico" value="${escapeHtml(state.formData.tecnico)}" placeholder="Nombre del técnico" ${disabledAttr}>
                            </div>
                            <div class="flex flex-col gap-1">
                                <label for="remito-form-direccion" class="text-sm font-medium text-gray-700">Dirección</label>
                                <input id="remito-form-direccion" type="text" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500" data-remito-field="direccion" value="${escapeHtml(state.formData.direccion)}" placeholder="Domicilio del servicio" ${disabledAttr}>
                            </div>
                            <div class="flex flex-col gap-1">
                                <label for="remito-form-telefono" class="text-sm font-medium text-gray-700">Teléfono</label>
                                <input id="remito-form-telefono" type="tel" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500" data-remito-field="telefono" value="${escapeHtml(state.formData.telefono)}" placeholder="Teléfono de contacto" ${disabledAttr}>
                            </div>
                            <div class="flex flex-col gap-1">
                                <label for="remito-form-email" class="text-sm font-medium text-gray-700">Email</label>
                                <input id="remito-form-email" type="email" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500" data-remito-field="email" value="${escapeHtml(state.formData.email)}" placeholder="Correo electrónico del cliente" ${disabledAttr}>
                            </div>
                            <div class="flex flex-col gap-1">
                                <label for="remito-form-reporte-id" class="text-sm font-medium text-gray-700">ID del reporte</label>
                                <input id="remito-form-reporte-id" type="text" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500" data-remito-field="reporteId" value="${escapeHtml(state.formData.reporteId)}" placeholder="Identificador del reporte asociado" ${disabledAttr}>
                            </div>
                            <div class="flex flex-col gap-1">
                                <label for="remito-form-observaciones" class="text-sm font-medium text-gray-700">Observaciones</label>
                                <textarea id="remito-form-observaciones" rows="3" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500" data-remito-field="observaciones" placeholder="Notas adicionales" ${disabledAttr}>${escapeHtml(state.formData.observaciones)}</textarea>
                            </div>
                        </div>
                        <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                            ${secondaryButtonHtml}
                            <button type="submit" class="inline-flex justify-center rounded-lg border border-transparent bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60" ${disabledAttr}>
                                ${escapeHtml(submitLabel)}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        return;
    }

    const rowsHtml = state.remitos.length
        ? state.remitos
            .map((remito, index) => {
                const numeroRemito = escapeHtml(getDisplayValue(remito.numeroRemito));
                const fecha = escapeHtml(getDisplayValue(remito.fechaRemito));
                const cliente = escapeHtml(getDisplayValue(remito.cliente));
                const numeroReporte = escapeHtml(getDisplayValue(remito.numeroReporte));
                const isDeletingRow = state.isDeleting && state.deletingIndex === index;

                return `
                    <tr class="hover:bg-gray-50">
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-700">${numeroRemito}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${fecha}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${cliente}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${numeroReporte}</td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            <div class="flex items-center justify-end gap-3">
                                <button type="button" class="text-sm font-semibold text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2" data-remito-detalle="${index}">
                                    Ver detalle
                                </button>
                                <button type="button" class="text-sm font-semibold text-gray-600 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2" data-remito-edit="${index}">
                                    Editar
                                </button>
                                <button type="button" class="text-sm font-semibold text-red-600 hover:text-red-800 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60" data-remito-delete="${index}" ${isDeletingRow ? 'disabled' : ''}>
                                    ${isDeletingRow ? 'Eliminando...' : 'Eliminar'}
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            })
            .join('')
        : `
            <tr>
                <td colspan="5" class="px-6 py-10 text-center text-sm text-gray-500">
                    No hay remitos registrados todavía. Usá el botón "Crear nuevo remito" para cargar uno.
                </td>
            </tr>
        `;

    const paginationInfo = state.totalPages > 0
        ? `Página ${state.currentPage} de ${state.totalPages}`
        : 'Página 1 de 1';

    const firstItemIndex = (state.currentPage - 1) * state.pageSize + 1;
    const lastItemIndex = firstItemIndex + state.remitos.length - 1;
    const summaryInfo = state.totalItems > 0
        ? `Mostrando ${firstItemIndex} - ${lastItemIndex} de ${state.totalItems} remitos`
        : 'No hay remitos registrados.';

    const createDisabledAttr = (state.isLoading || state.isSaving) ? 'disabled' : '';

    container.innerHTML = `
        <div class="space-y-6">
            ${feedbackHtml ? `<div>${feedbackHtml}</div>` : ''}
            <div class="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div class="flex flex-col gap-3 border-b border-gray-100 px-6 py-4 md:flex-row md:items-center md:justify-between">
                    <div class="flex flex-col">
                        <h3 class="text-lg font-semibold text-gray-800">Listado de Remitos</h3>
                        <span class="text-sm text-gray-500">${escapeHtml(paginationInfo)}</span>
                    </div>
                    <button type="button" class="inline-flex items-center justify-center rounded-lg border border-transparent bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60" data-remitos-action="open-create" ${createDisabledAttr}>
                        Crear nuevo remito
                    </button>
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
                        <button type="button" class="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60" data-remitos-action="prev" ${state.currentPage <= 1 ? 'disabled' : ''}>
                            Anterior
                        </button>
                        <button type="button" class="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60" data-remitos-action="next" ${(state.totalPages === 0 || state.currentPage >= state.totalPages) ? 'disabled' : ''}>
                            Siguiente
                        </button>
                        <button type="button" class="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2" data-remitos-action="reload">
                            Actualizar
                        </button>
                    </div>
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

function handleEditRemito(index) {
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

    state.formMode = 'edit';
    state.formData = mapRemitoToFormData(remito);
    state.editingRemitoId = getRemitoIdentifier(remito);
    state.editingRemitoLabel = sanitizeString(remito.numeroRemito) || sanitizeString(remito.reporteId);
    state.editingRemitoOriginal = remito;
    state.viewMode = 'form';

    renderManagementView();
}

async function handleDeleteRemito(index) {
    if (state.isDeleting || state.isSaving) {
        return;
    }

    if (!Array.isArray(state.remitos) || index < 0 || index >= state.remitos.length) {
        return;
    }

    const remito = state.remitos[index];
    if (!remito) {
        return;
    }

    const identifier = getRemitoIdentifier(remito);
    if (!identifier) {
        setFeedback('error', 'No se pudo determinar el remito a eliminar.');
        renderManagementView();
        return;
    }

    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
        const confirmed = window.confirm(`¿Seguro que querés eliminar el remito ${remito.numeroRemito || identifier}?`);
        if (!confirmed) {
            return;
        }
    }

    state.isDeleting = true;
    state.deletingIndex = index;
    renderManagementView();

    try {
        await dependencies.eliminarRemito({
            remitoId: identifier,
            numeroRemito: remito.numeroRemito,
            reporteId: remito.reporteId,
        });

        setFeedback('success', 'El remito se eliminó correctamente.');

        const wasEditingDeleted = state.formMode === 'edit'
            && identifier === state.editingRemitoId;
        if (wasEditingDeleted) {
            resetFormState();
        }

        state.isDeleting = false;
        state.deletingIndex = null;

        const remainingItems = state.remitos.length - 1;
        const targetPage = remainingItems === 0 && state.currentPage > 1
            ? state.currentPage - 1
            : state.currentPage;

        await renderListado({ page: targetPage });
    } catch (error) {
        state.isDeleting = false;
        state.deletingIndex = null;
        setFeedback('error', error?.message || 'No se pudo eliminar el remito.');
        renderManagementView();
    }
}

function handleFormInput(event) {
    const field = event?.target?.dataset?.remitoField;
    if (!field || !(field in state.formData)) {
        return;
    }

    state.formData[field] = event.target.value;
}

function handleContainerInput(event) {
    handleFormInput(event);
}

async function handleFormSubmit() {
    if (state.isSaving || state.isLoading) {
        return;
    }

    const errors = validateFormData(state.formData);
    if (errors.length > 0) {
        setFeedback('error', errors.join(' '));
        renderManagementView();
        return;
    }

    const payload = buildPayloadFromForm(state.formData);
    const targetPage = state.currentPage || 1;
    const wasEditMode = state.formMode === 'edit';

    state.isSaving = true;
    renderManagementView();

    try {
        if (wasEditMode) {
            const remitoId = state.editingRemitoId
                || getRemitoIdentifier(state.editingRemitoOriginal)
                || sanitizeString(state.formData.reporteId)
                || sanitizeString(state.formData.numeroRemito);

            if (!remitoId) {
                throw new Error('No se pudo determinar el remito a actualizar.');
            }

            await dependencies.actualizarRemito({
                ...payload,
                remitoId,
            });
            setFeedback('success', 'El remito se actualizó correctamente.');
        } else {
            const requestPayload = buildCreateRemitoRequest(payload);
            await dependencies.crearRemito(requestPayload);
            setFeedback('success', 'El remito se creó correctamente.');
        }

        resetFormState();
        state.isSaving = false;
        await renderListado({ page: targetPage });
    } catch (error) {
        state.isSaving = false;
        setFeedback('error', error?.message || 'No se pudo guardar el remito.');
        renderManagementView();
    }
}

function handleContainerSubmit(event) {
    if (event.target && event.target.id === 'remito-abm-form') {
        event.preventDefault();
        void handleFormSubmit();
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
        return;
    }

    if (action === 'open-create') {
        resetFormState({ viewMode: 'form' });
        renderManagementView();
        return;
    }

    if (action === 'back-to-list') {
        resetFormState({ viewMode: 'list' });
        renderManagementView();
        return;
    }

    if (action === 'cancel-edit') {
        resetFormState({ viewMode: 'form' });
        renderManagementView();
        return;
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
        return;
    }

    const editButton = event.target.closest('[data-remito-edit]');
    if (editButton) {
        event.preventDefault();
        const index = Number.parseInt(editButton.dataset.remitoEdit, 10);
        if (Number.isFinite(index)) {
            handleEditRemito(index);
        }
        return;
    }

    const deleteButton = event.target.closest('[data-remito-delete]');
    if (deleteButton) {
        event.preventDefault();
        const index = Number.parseInt(deleteButton.dataset.remitoDelete, 10);
        if (Number.isFinite(index)) {
            void handleDeleteRemito(index);
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
        const data = await dependencies.obtenerRemitos({ page: requestedPage, pageSize: state.pageSize });

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
        state.currentPage = currentPage || requestedPage;

        state.isLoading = false;
        renderManagementView();
    } catch (error) {
        state.lastError = error;
        const message = error?.message || 'No se pudieron obtener los remitos.';
        state.isLoading = false;
        showErrorState(message);
    } finally {
        state.isLoading = false;
    }
}

export function createRemitosGestionModule(overrides = {}) {
    setDependencies(overrides);
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
        container.addEventListener('input', handleContainerInput);
        container.addEventListener('submit', handleContainerSubmit);
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
    mapRemitoToFormData,
    buildPayloadFromForm,
    buildReporteDataFromPayload,
    buildCreateRemitoRequest,
    handleFormSubmit,
    state,
};
