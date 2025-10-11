import { COMPONENT_STAGES } from '../mantenimiento/templates.js';

const MAX_REMITO_PHOTOS = 4;
const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const PHOTO_MIME_EXTENSION_MAP = Object.freeze({
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'image/heif': 'heif',
});

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function guessExtensionFromMimeType(mimeType) {
    const normalized = normalizeString(mimeType).toLowerCase();
    return PHOTO_MIME_EXTENSION_MAP[normalized] || 'jpg';
}

function sanitizePhotoFileName(name, fallbackBase, index, mimeType) {
    const base = normalizeString(name) || `${fallbackBase}-foto-${index + 1}`;
    const withoutSeparators = base.replace(/[\\/]/g, '-');
    const normalized = withoutSeparators.replace(/[^a-zA-Z0-9._-]+/g, '_');
    const extension = guessExtensionFromMimeType(mimeType);

    if (normalized.toLowerCase().endsWith(`.${extension}`)) {
        return normalized;
    }

    const withoutExtension = normalized.replace(/\.[^.]+$/, '');
    return `${withoutExtension}.${extension}`;
}

function createEmptyPhotoSlot(index = 0) {
    return {
        index,
        previewUrl: '',
        base64Data: '',
        mimeType: '',
        fileName: '',
        url: '',
        shouldRemove: false,
    };
}

function createEmptyPhotoSlots() {
    return Array.from({ length: MAX_REMITO_PHOTOS }, (_, index) => createEmptyPhotoSlot(index));
}

function getPhotoPreviewSource(slot) {
    if (!slot || typeof slot !== 'object') {
        return '';
    }

    const previewUrl = normalizeString(slot.previewUrl);
    if (previewUrl) {
        return previewUrl;
    }

    const url = normalizeString(slot.url);
    return url;
}

function formatPhotoFileLabel(slot) {
    if (!slot || typeof slot !== 'object') {
        return 'Sin archivo seleccionado';
    }

    const fileName = normalizeString(slot.fileName);
    if (fileName) {
        return fileName;
    }

    const url = normalizeString(slot.url);
    if (url) {
        try {
            const parsed = new URL(url);
            const segments = parsed.pathname.split('/');
            const lastSegment = segments[segments.length - 1];
            return lastSegment || 'Foto subida';
        } catch (error) {
            return 'Foto subida';
        }
    }

    return 'Sin archivo seleccionado';
}

function isFileReaderSupported() {
    return typeof window !== 'undefined' && typeof window.FileReader !== 'undefined';
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            resolve(reader.result);
        };
        reader.onerror = () => {
            reject(new Error('No se pudo leer el archivo seleccionado.'));
        };
        reader.readAsDataURL(file);
    });
}

function extractBase64FromDataUrl(dataUrl) {
    if (typeof dataUrl !== 'string') {
        throw new Error('No se pudo interpretar la imagen seleccionada.');
    }

    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
        throw new Error('El formato de la imagen no es compatible.');
    }

    return match[2];
}

function getElement(id) {
    return typeof document !== 'undefined' ? document.getElementById(id) : null;
}

function getSelectedOptionText(selectId) {
    const select = getElement(selectId);
    if (!(select instanceof HTMLSelectElement)) {
        return '';
    }

    const option = select.selectedOptions?.[0];
    return option ? option.textContent.trim() : '';
}

function getInputValue(id) {
    const element = getElement(id);
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
        return '';
    }
    return element.value.trim();
}

function cloneReportData(data) {
    if (!data || typeof data !== 'object') {
        return {};
    }

    try {
        return JSON.parse(JSON.stringify(data));
    } catch (error) {
        return { ...data };
    }
}

function normalizeString(value) {
    if (value === null || value === undefined) {
        return '';
    }

    const text = String(value).trim();
    return text;
}

function hasContent(value) {
    return Boolean(normalizeString(value));
}

function buildRepuestoDescripcion(item = {}) {
    const descripcion = [item.descripcion, item.detalle, item.detalles, item.title, item.nombre]
        .map(normalizeString)
        .filter(Boolean)
        .join(' - ');

    return descripcion;
}

function normalizeRepuestoItem(item = {}) {
    if (!item || typeof item !== 'object') {
        return { codigo: '', descripcion: '', cantidad: '' };
    }

    const codigo = normalizeString(item.codigo || item.id || item.codigo_repuesto || item.cod || item.codigoArticulo);
    const descripcion = buildRepuestoDescripcion(item);
    const cantidadRaw = item.cantidad ?? item.cant ?? item.unidades ?? '';
    const cantidadText = normalizeString(cantidadRaw);

    if (cantidadText) {
        const parsed = Number(String(cantidadText).replace(',', '.'));
        if (Number.isFinite(parsed) && parsed >= 0) {
            return { codigo, descripcion, cantidad: String(parsed) };
        }
    }

    return { codigo, descripcion, cantidad: cantidadText };
}

function isReplacementAction(value) {
    const normalized = normalizeString(value).toLowerCase();
    if (!normalized) {
        return false;
    }

    const replacementKeywords = ['cambi', 'reempl', 'instal', 'nuevo'];
    return replacementKeywords.some(keyword => normalized.includes(keyword));
}

function buildComponentStageLookup(stages) {
    if (!Array.isArray(stages)) {
        return {};
    }

    return stages.reduce((map, stage) => {
        if (stage?.id) {
            map[stage.id] = normalizeString(stage.title) || stage.id;
        }
        return map;
    }, {});
}

function buildStageIdList(stages) {
    const defaultIds = Array.from({ length: 6 }, (_, index) => `etapa${index + 1}`);

    if (!Array.isArray(stages) || stages.length === 0) {
        return defaultIds;
    }

    const providedIds = stages
        .map(stage => normalizeString(stage?.id))
        .filter(Boolean);

    const uniqueIds = new Set([...providedIds, ...defaultIds]);
    return Array.from(uniqueIds);
}

function buildComponentesFromReport(report, stages = COMPONENT_STAGES) {
    if (!report || typeof report !== 'object') {
        return [];
    }

    const stageLookup = buildComponentStageLookup(stages);
    const stageIds = buildStageIdList(stages);

    return stageIds.reduce((acc, stageId) => {
        const accionKey = `${stageId}_accion`;
        const detallesKey = `${stageId}_detalles`;

        const accion = normalizeString(report[accionKey]);
        const detalles = normalizeString(report[detallesKey]);

        if (!isReplacementAction(accion)) {
            return acc;
        }

        acc.push({
            accion,
            detalles,
            title: stageLookup[stageId] || stageId,
        });

        return acc;
    }, []);
}

function formatDateValue(rawDate) {
    const value = normalizeString(rawDate);
    if (!value) {
        return '';
    }

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
        return value;
    }

    const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
        const [, year, month, day] = isoMatch;
        return `${day}/${month}/${year}`;
    }

    const timestamp = Date.parse(value);
    if (!Number.isNaN(timestamp)) {
        const date = new Date(timestamp);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = String(date.getFullYear());
        return `${day}/${month}/${year}`;
    }

    return value;
}

function resolveReportValue(report, keys, fallback = '') {
    if (!report || typeof report !== 'object') {
        return fallback;
    }

    const candidates = Array.isArray(keys) ? keys : [keys];
    for (const key of candidates) {
        const value = normalizeString(report[key]);
        if (value) {
            return value;
        }
    }

    return fallback;
}

function setReadonlyInputValue(id, value) {
    const element = getElement(id);
    if (!(element instanceof HTMLInputElement)) {
        return;
    }

    element.value = normalizeString(value);
    element.readOnly = true;
    element.setAttribute('readonly', 'readonly');
}

function clearReadonlyInputs(ids = []) {
    ids.forEach(id => {
        const element = getElement(id);
        if (element instanceof HTMLInputElement) {
            element.value = '';
            element.readOnly = true;
            element.setAttribute('readonly', 'readonly');
        }
    });
}

function createRepuestoRow(data = {}, { forceDefaultCantidad = false } = {}) {
    if (typeof document === 'undefined') {
        return null;
    }

    const { codigo = '', descripcion = '', cantidad = '' } = data;
    const resolvedCantidad = forceDefaultCantidad && !hasContent(cantidad) ? '1' : cantidad;

    const row = document.createElement('tr');
    row.className = 'remito-repuesto-row transition-colors duration-150 hover:bg-gray-50';

    const codigoCell = document.createElement('td');
    codigoCell.className = 'px-4 py-3 align-top';
    const codigoInput = document.createElement('input');
    codigoInput.type = 'text';
    codigoInput.name = 'repuesto-codigo';
    codigoInput.placeholder = 'Código del repuesto';
    codigoInput.value = codigo;
    codigoInput.dataset.field = 'codigo';
    codigoInput.className = 'repuestos-table-input';
    codigoCell.appendChild(codigoInput);

    const descripcionCell = document.createElement('td');
    descripcionCell.className = 'px-4 py-3 align-top';
    const descripcionInput = document.createElement('input');
    descripcionInput.type = 'text';
    descripcionInput.name = 'repuesto-descripcion';
    descripcionInput.placeholder = 'Descripción del repuesto';
    descripcionInput.value = descripcion;
    descripcionInput.dataset.field = 'descripcion';
    descripcionInput.className = 'repuestos-table-input';
    descripcionCell.appendChild(descripcionInput);

    const cantidadCell = document.createElement('td');
    cantidadCell.className = 'px-4 py-3 align-top text-right';
    const cantidadInput = document.createElement('input');
    cantidadInput.type = 'number';
    cantidadInput.name = 'repuesto-cantidad';
    cantidadInput.placeholder = '0';
    cantidadInput.inputMode = 'numeric';
    cantidadInput.min = '0';
    cantidadInput.step = '1';
    cantidadInput.value = resolvedCantidad;
    cantidadInput.dataset.field = 'cantidad';
    cantidadInput.className = 'repuestos-table-input text-right';
    cantidadCell.appendChild(cantidadInput);

    row.append(codigoCell, descripcionCell, cantidadCell);
    return row;
}

function renderRepuestosList(repuestos = []) {
    const tbody = getElement('remito-repuestos-body');
    if (!(tbody instanceof HTMLElement)) {
        return;
    }

    tbody.innerHTML = '';

    if (!Array.isArray(repuestos) || repuestos.length === 0) {
        const emptyRow = createRepuestoRow();
        if (emptyRow) {
            tbody.appendChild(emptyRow);
        }
        return;
    }

    repuestos.forEach(item => {
        const normalized = normalizeRepuestoItem(item);
        const hasValues = hasContent(normalized.codigo) || hasContent(normalized.descripcion) || hasContent(normalized.cantidad);
        const row = createRepuestoRow(normalized, { forceDefaultCantidad: hasValues });
        if (row) {
            tbody.appendChild(row);
        }
    });
}

function normalizeCantidadValue(value) {
    const textValue = normalizeString(value);
    if (!textValue) {
        return '';
    }

    const numericValue = Number(textValue.replace(',', '.'));
    if (Number.isFinite(numericValue)) {
        return String(numericValue);
    }

    return textValue;
}

function collectRepuestosFromForm() {
    const tbody = getElement('remito-repuestos-body');
    if (!(tbody instanceof HTMLElement)) {
        return [];
    }

    const rows = Array.from(tbody.querySelectorAll('tr'));
    return rows.reduce((acc, row) => {
        const inputs = Array.from(row.querySelectorAll('input[data-field]'));
        if (inputs.length === 0) {
            return acc;
        }

        const item = { codigo: '', descripcion: '', cantidad: '' };

        inputs.forEach(input => {
            if (!(input instanceof HTMLInputElement)) {
                return;
            }

            const field = input.dataset.field;
            if (!field) {
                return;
            }

            if (field === 'cantidad') {
                item.cantidad = normalizeCantidadValue(input.value);
            } else {
                item[field] = normalizeString(input.value);
            }
        });

        const hasValues = hasContent(item.codigo) || hasContent(item.descripcion) || hasContent(item.cantidad);
        if (hasValues) {
            acc.push(item);
        }

        return acc;
    }, []);
}

function addEmptyRepuestoRow({ focus = false } = {}) {
    const tbody = getElement('remito-repuestos-body');
    if (!(tbody instanceof HTMLElement)) {
        return;
    }

    const row = createRepuestoRow();
    if (!row) {
        return;
    }

    tbody.appendChild(row);

    if (focus) {
        const firstInput = row.querySelector('input');
        if (firstInput instanceof HTMLInputElement) {
            firstInput.focus();
        }
    }
}

function createReportSnapshot(rawData) {
    const snapshot = cloneReportData(rawData);

    if (!snapshot.clienteNombre) {
        snapshot.clienteNombre = getSelectedOptionText('cliente') || snapshot.cliente || snapshot.cliente_nombre;
    }

    snapshot.direccion = snapshot.direccion || getInputValue('direccion');
    snapshot.cliente_telefono = snapshot.cliente_telefono || getInputValue('cliente_telefono');
    snapshot.cliente_email = snapshot.cliente_email || getInputValue('cliente_email');
    snapshot.cliente_cuit = snapshot.cliente_cuit || getInputValue('cliente_cuit');
    snapshot.fecha_display = snapshot.fecha_display || getInputValue('fecha_display');

    const componentesDerivados = buildComponentesFromReport(snapshot);
    snapshot.componentes = componentesDerivados;

    if (!Array.isArray(snapshot.repuestos) || snapshot.repuestos.length === 0) {
        snapshot.repuestos = componentesDerivados.map(item => ({ ...item }));
    }

    return snapshot;
}

function populateRemitoForm(report) {
    if (!report || typeof report !== 'object') {
        return;
    }

    const numeroRemito = resolveReportValue(report, ['NumeroRemito', 'numero_remito', 'remitoNumero', 'numero_reporte']);
    const fechaRemito = formatDateValue(resolveReportValue(report, ['fecha_display', 'fecha']));

    setReadonlyInputValue('remito-numero', numeroRemito);
    setReadonlyInputValue('remito-fecha', fechaRemito);
    setReadonlyInputValue('remito-cliente-nombre', resolveReportValue(report, ['clienteNombre', 'cliente_nombre', 'cliente']));
    setReadonlyInputValue('remito-cliente-direccion', resolveReportValue(report, ['direccion', 'cliente_direccion', 'ubicacion']));
    setReadonlyInputValue('remito-cliente-telefono', resolveReportValue(report, ['cliente_telefono', 'telefono_cliente', 'telefono']));
    setReadonlyInputValue('remito-cliente-email', resolveReportValue(report, ['cliente_email', 'email']));
    setReadonlyInputValue('remito-cliente-cuit', resolveReportValue(report, ['cliente_cuit', 'cuit']));

    const descripcionEquipo = resolveReportValue(report, ['equipo', 'modelo', 'descripcion_equipo']);
    setReadonlyInputValue('remito-equipo-descripcion', descripcionEquipo);
    setReadonlyInputValue('remito-equipo-modelo', resolveReportValue(report, ['modelo', 'modelo_equipo']));
    setReadonlyInputValue('remito-equipo-serie', resolveReportValue(report, ['n_serie', 'numero_serie']));
    setReadonlyInputValue('remito-equipo-interno', resolveReportValue(report, ['id_interna', 'codigo_interno']));
    setReadonlyInputValue('remito-equipo-ubicacion', resolveReportValue(report, ['ubicacion', 'direccion', 'cliente_direccion']));
    setReadonlyInputValue('remito-equipo-tecnico', resolveReportValue(report, ['tecnico', 'tecnico_asignado']));

    const observaciones = getElement('remito-observaciones');
    if (observaciones instanceof HTMLTextAreaElement) {
        const texto = normalizeString(report.observaciones || report.resumen || '');
        observaciones.value = texto;
        observaciones.removeAttribute('readonly');
    }

    const componentesDerivados = Array.isArray(report.componentes) && report.componentes.length > 0
        ? report.componentes
        : buildComponentesFromReport(report);

    const repuestos = Array.isArray(report.repuestos) && report.repuestos.length > 0
        ? report.repuestos
        : componentesDerivados;

    renderRepuestosList(repuestos);
}

function disableButton(buttonId) {
    const button = getElement(buttonId);
    if (button instanceof HTMLButtonElement) {
        button.disabled = true;
        button.setAttribute('disabled', 'disabled');
    }
}

function enableButton(buttonId) {
    const button = getElement(buttonId);
    if (button instanceof HTMLButtonElement) {
        button.disabled = false;
        button.removeAttribute('disabled');
    }
}

export function createRemitoModule({ showView, apiUrl, getToken } = {}) {
    let lastSavedReport = null;
    let eventsInitialized = false;
    let photoSlots = createEmptyPhotoSlots();
    let photoEventsInitialized = false;

    function getPhotoContainer() {
        const container = getElement('remito-fotos-container');
        return container instanceof HTMLElement ? container : null;
    }

    function renderPhotoSlots() {
        const container = getPhotoContainer();
        if (!container) {
            return;
        }

        const slotsHtml = photoSlots
            .map((slot, index) => {
                const previewSource = getPhotoPreviewSource(slot);
                const hasPreview = Boolean(previewSource);
                const labelText = escapeHtml(formatPhotoFileLabel(slot));
                const buttonClasses = [
                    'group relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border-2',
                    hasPreview ? 'border-transparent bg-gray-900/5' : 'border-dashed border-gray-300 bg-gray-50',
                    'text-gray-400 transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                ].join(' ');
                const triggerContent = hasPreview
                    ? `<img src="${escapeHtml(previewSource)}" alt="Foto ${index + 1}" class="h-full w-full object-cover">`
                    : `
                        <div class="flex flex-col items-center justify-center gap-2 text-gray-400">
                            <span class="text-5xl font-light leading-none">+</span>
                            <span class="text-xs font-medium">Agregar foto</span>
                        </div>
                    `;
                const removeButton = hasPreview
                    ? `
                        <button type="button" class="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-red-500 shadow-md transition hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2" data-remito-photo-action="remove" data-remito-photo-index="${index}" title="Eliminar foto" aria-label="Eliminar foto">
                            <span aria-hidden="true" class="text-lg leading-none">&times;</span>
                        </button>
                    `
                    : '';

                const menuHtml = `
                    <div class="absolute inset-0 z-10 hidden items-center justify-center rounded-xl bg-black/40 p-4" data-remito-photo-menu="${index}" aria-hidden="true">
                        <button type="button" class="absolute inset-0 cursor-default" data-remito-photo-menu-dismiss></button>
                        <div class="relative z-10 w-full max-w-[220px] space-y-2 rounded-lg bg-white p-4 text-center shadow-lg">
                            <p class="text-sm font-semibold text-gray-700">Seleccioná una opción</p>
                            <button type="button" class="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2" data-remito-photo-action="capture" data-remito-photo-index="${index}">Tomar foto</button>
                            <button type="button" class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2" data-remito-photo-action="upload" data-remito-photo-index="${index}">Subir foto</button>
                            <button type="button" class="w-full rounded-lg border border-transparent bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2" data-remito-photo-menu-dismiss>Cerrar</button>
                        </div>
                    </div>
                `;

                return `
                    <div class="space-y-2" data-remito-photo-slot="${index}">
                        <div class="flex items-center justify-between gap-2">
                            <p class="text-sm font-medium text-gray-700">Foto ${index + 1}</p>
                            <p class="max-w-[60%] truncate text-[11px] text-gray-500">${labelText}</p>
                        </div>
                        <div class="relative">
                            <button type="button" class="${buttonClasses}" data-remito-photo-trigger data-remito-photo-index="${index}" aria-label="Agregar o reemplazar foto ${index + 1}">
                                ${triggerContent}
                            </button>
                            ${removeButton}
                            ${menuHtml}
                        </div>
                        <input type="file" accept="image/*" capture="environment" class="hidden" data-remito-photo-input="capture" data-remito-photo-index="${index}">
                        <input type="file" accept="image/*" class="hidden" data-remito-photo-input="upload" data-remito-photo-index="${index}">
                    </div>
                `;
            })
            .join('');

        container.innerHTML = slotsHtml;
    }

    function resetPhotoSlots() {
        photoSlots = createEmptyPhotoSlots();
        renderPhotoSlots();
    }

    function closeAllPhotoMenus() {
        const container = getPhotoContainer();
        if (!container) {
            return;
        }

        const menus = container.querySelectorAll('[data-remito-photo-menu]');
        menus.forEach(menu => {
            menu.classList.add('hidden');
            menu.setAttribute('aria-hidden', 'true');
        });
    }

    function togglePhotoMenu(index) {
        const container = getPhotoContainer();
        if (!container) {
            return;
        }

        const normalizedIndex = Number(index);
        if (!Number.isFinite(normalizedIndex) || normalizedIndex < 0 || normalizedIndex >= MAX_REMITO_PHOTOS) {
            return;
        }

        const selector = `[data-remito-photo-menu="${normalizedIndex}"]`;
        const menu = container.querySelector(selector);
        if (!menu) {
            return;
        }

        const isHidden = menu.classList.contains('hidden');
        closeAllPhotoMenus();
        if (isHidden) {
            menu.classList.remove('hidden');
            menu.setAttribute('aria-hidden', 'false');
        }
    }

    function openPhotoFileDialog(mode, index) {
        const container = getPhotoContainer();
        if (!container) {
            return;
        }

        const selector = `[data-remito-photo-input="${mode}"][data-remito-photo-index="${index}"]`;
        const input = container.querySelector(selector);
        if (input instanceof HTMLInputElement) {
            input.value = '';
            input.click();
        }
    }

    function removePhotoSlot(index) {
        const normalizedIndex = Number(index);
        if (!Number.isFinite(normalizedIndex) || normalizedIndex < 0 || normalizedIndex >= photoSlots.length) {
            return;
        }

        closeAllPhotoMenus();
        photoSlots[normalizedIndex] = createEmptyPhotoSlot(normalizedIndex);
        renderPhotoSlots();
    }

    async function handlePhotoFileSelection(index, file) {
        const normalizedIndex = Number(index);
        if (!Number.isFinite(normalizedIndex) || normalizedIndex < 0 || normalizedIndex >= photoSlots.length) {
            return;
        }

        if (!file) {
            return;
        }

        if (!file.type || !file.type.startsWith('image/')) {
            window.alert?.('Solo se pueden cargar archivos de imagen.');
            return;
        }

        if (file.size && file.size > MAX_PHOTO_SIZE_BYTES) {
            window.alert?.('La foto supera el límite de 5 MB permitido.');
            return;
        }

        if (!isFileReaderSupported()) {
            window.alert?.('El navegador no permite procesar imágenes desde este formulario.');
            return;
        }

        try {
            const dataUrl = await readFileAsDataUrl(file);
            const base64Data = extractBase64FromDataUrl(dataUrl);
            const mimeType = normalizeString(file.type) || 'image/jpeg';
            const numeroRemitoInput = getElement('remito-numero');
            const numeroRemito = numeroRemitoInput instanceof HTMLInputElement
                ? normalizeString(numeroRemitoInput.value)
                : '';
            const fallbackBase = numeroRemito || 'remito';
            const fileName = sanitizePhotoFileName(file.name, fallbackBase, normalizedIndex, mimeType);

            photoSlots[normalizedIndex] = {
                index: normalizedIndex,
                previewUrl: typeof dataUrl === 'string' ? dataUrl : '',
                base64Data,
                mimeType,
                fileName,
                url: '',
                shouldRemove: false,
            };
            closeAllPhotoMenus();
            renderPhotoSlots();
        } catch (error) {
            const message = error instanceof Error
                ? error.message
                : 'No se pudo procesar la foto seleccionada.';
            window.alert?.(message);
        }
    }

    function handlePhotoAction(action, index) {
        if (!action) {
            return;
        }

        const normalizedIndex = Number(index);
        if (!Number.isFinite(normalizedIndex) || normalizedIndex < 0 || normalizedIndex >= photoSlots.length) {
            return;
        }

        if (action === 'remove') {
            removePhotoSlot(normalizedIndex);
            return;
        }

        if (action === 'capture' || action === 'upload') {
            closeAllPhotoMenus();
            openPhotoFileDialog(action, normalizedIndex);
        }
    }

    function handlePhotoContainerClick(event) {
        const dismiss = event.target.closest?.('[data-remito-photo-menu-dismiss]');
        if (dismiss) {
            event.preventDefault();
            closeAllPhotoMenus();
            return;
        }

        const actionButton = event.target.closest?.('[data-remito-photo-action]');
        if (actionButton) {
            event.preventDefault();
            const action = actionButton.dataset.remitoPhotoAction;
            const index = actionButton.dataset.remitoPhotoIndex;
            handlePhotoAction(action, index);
            return;
        }

        const trigger = event.target.closest?.('[data-remito-photo-trigger]');
        if (trigger) {
            event.preventDefault();
            togglePhotoMenu(trigger.dataset.remitoPhotoIndex);
            return;
        }

        const clickedInsideMenu = Boolean(event.target.closest?.('[data-remito-photo-menu]'));
        if (!clickedInsideMenu) {
            closeAllPhotoMenus();
        }
    }

    function handlePhotoContainerChange(event) {
        const input = event.target;
        if (!(input instanceof HTMLInputElement)) {
            return;
        }

        const mode = input.dataset.remitoPhotoInput;
        if (!mode) {
            return;
        }

        const index = Number.parseInt(input.dataset.remitoPhotoIndex ?? '', 10);
        const file = input.files && input.files[0];
        if (Number.isFinite(index) && file) {
            void handlePhotoFileSelection(index, file);
        }

        input.value = '';
    }

    function ensurePhotoEvents() {
        if (photoEventsInitialized) {
            return;
        }

        const container = getPhotoContainer();
        if (!container) {
            return;
        }

        container.addEventListener('click', handlePhotoContainerClick);
        container.addEventListener('change', handlePhotoContainerChange);
        photoEventsInitialized = true;
    }

    function buildPhotosPayload() {
        return photoSlots
            .map((slot, index) => ({
                slot: index + 1,
                base64Data: normalizeString(slot.base64Data),
                mimeType: normalizeString(slot.mimeType) || 'image/jpeg',
                fileName: normalizeString(slot.fileName) || `remito-foto-${index + 1}.jpg`,
            }))
            .filter(item => Boolean(item.base64Data));
    }

    function ensureReportAvailable() {
        if (!lastSavedReport) {
            disableButton('generar-remito-btn');
            window.alert?.('Primero debés guardar el mantenimiento para generar el remito.');
            return false;
        }
        return true;
    }

    function handleMaintenanceSaved(reportData) {
        lastSavedReport = createReportSnapshot(reportData);
        enableButton('generar-remito-btn');
    }

    function reset() {
        lastSavedReport = null;
        disableButton('generar-remito-btn');
        resetPhotoSlots();
        closeAllPhotoMenus();
        clearReadonlyInputs([
            'remito-numero',
            'remito-fecha',
            'remito-cliente-nombre',
            'remito-cliente-direccion',
            'remito-cliente-telefono',
            'remito-cliente-email',
            'remito-cliente-cuit',
            'remito-equipo-descripcion',
            'remito-equipo-modelo',
            'remito-equipo-serie',
            'remito-equipo-interno',
            'remito-equipo-ubicacion',
            'remito-equipo-tecnico',
        ]);
        renderRepuestosList([]);
        const observaciones = getElement('remito-observaciones');
        if (observaciones instanceof HTMLTextAreaElement) {
            observaciones.value = '';
        }
    }

    function handleGenerarRemitoClick() {
        if (!ensureReportAvailable()) {
            return false;
        }

        resetPhotoSlots();
        closeAllPhotoMenus();
        populateRemitoForm(lastSavedReport);
        if (typeof showView === 'function') {
            showView('remito-view');
        }
        return true;
    }

    async function handleFinalizarRemitoClick() {
        if (!lastSavedReport) {
            window.alert?.('No hay datos disponibles para generar el remito. Guardá el mantenimiento primero.');
            return;
        }

        const observacionesElement = getElement('remito-observaciones');
        const observaciones = observacionesElement instanceof HTMLTextAreaElement ? observacionesElement.value.trim() : '';

        const repuestosEditados = collectRepuestosFromForm();
        lastSavedReport.repuestos = repuestosEditados;
        if (repuestosEditados.length > 0) {
            lastSavedReport.componentes = [];
        }
        renderRepuestosList(repuestosEditados);

        const fotosPayload = buildPhotosPayload();
        const finalizarBtn = getElement('finalizar-remito-btn');
        let originalText = '';
        if (finalizarBtn instanceof HTMLButtonElement) {
            originalText = finalizarBtn.textContent || '';
            finalizarBtn.textContent = 'Generando remito...';
            finalizarBtn.disabled = true;
        }

        try {
            if (!apiUrl) {
                throw new Error('La URL del servicio no está configurada.');
            }

            const token = typeof getToken === 'function' ? normalizeString(getToken()) : '';
            if (!token) {
                throw new Error('No hay una sesión activa. Ingresá nuevamente.');
            }

            const requestBody = {
                action: 'crear_remito',
                token,
                reporteData: lastSavedReport,
                observaciones,
            };

            if (Array.isArray(fotosPayload) && fotosPayload.length > 0) {
                requestBody.fotos = fotosPayload;
            }

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain; charset=utf-8',
                },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            let payload;
            try {
                payload = await response.json();
            } catch (error) {
                throw new Error('No se pudo interpretar la respuesta del servidor.');
            }

            if (payload?.result !== 'success') {
                const message = normalizeString(payload?.error || payload?.message) || 'No fue posible generar el remito.';
                throw new Error(message);
            }

            const numeroRemito = normalizeString(payload?.data?.NumeroRemito);
            if (numeroRemito) {
                lastSavedReport.NumeroRemito = numeroRemito;
                setReadonlyInputValue('remito-numero', numeroRemito);
            }

            if (observaciones) {
                lastSavedReport.observaciones = observaciones;
            }

            window.alert?.('✅ Remito generado correctamente.');
        } catch (error) {
            console.error('Error al generar el remito:', error);
            const message = error instanceof Error ? error.message : 'Error desconocido al generar el remito.';
            window.alert?.(`❌ ${message}`);
        } finally {
            if (finalizarBtn instanceof HTMLButtonElement) {
                finalizarBtn.textContent = originalText || 'Finalizar y Guardar Remito';
                finalizarBtn.disabled = false;
            }
        }
    }

    function initialize() {
        if (eventsInitialized) {
            return;
        }

        disableButton('generar-remito-btn');
        renderRepuestosList([]);
        renderPhotoSlots();
        ensurePhotoEvents();

        const generarBtn = getElement('generar-remito-btn');
        if (generarBtn instanceof HTMLButtonElement) {
            generarBtn.addEventListener('click', event => {
                event.preventDefault();
                handleGenerarRemitoClick();
            });
        }

        const finalizarBtn = getElement('finalizar-remito-btn');
        if (finalizarBtn instanceof HTMLButtonElement) {
            finalizarBtn.addEventListener('click', event => {
                event.preventDefault();
                void handleFinalizarRemitoClick();
            });
        }

        const agregarRepuestoBtn = getElement('remito-agregar-repuesto');
        if (agregarRepuestoBtn instanceof HTMLButtonElement) {
            agregarRepuestoBtn.addEventListener('click', event => {
                event.preventDefault();
                addEmptyRepuestoRow({ focus: true });
            });
        }

        eventsInitialized = true;
    }

    function setLastSavedReportForTests(data) {
        lastSavedReport = data ? cloneReportData(data) : null;
    }

    function getLastSavedReportForTests() {
        return lastSavedReport;
    }

    return {
        initialize,
        handleMaintenanceSaved,
        reset,
        handleGenerarRemitoClick,
        handleFinalizarRemitoClick,
        setLastSavedReportForTests,
        getLastSavedReportForTests,
    };
}
