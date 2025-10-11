const DEFAULT_PAGE_SIZE = 20;
const MAX_REMITO_PHOTOS = 4;
const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const REMITO_FOTO_KEYS = Object.freeze([
    ['Foto1URL', 'Foto1Url', 'foto1URL', 'foto1Url', 'foto1', 'Foto1', 'foto_1', 'Foto_1'],
    ['Foto2URL', 'Foto2Url', 'foto2URL', 'foto2Url', 'foto2', 'Foto2', 'foto_2', 'Foto_2'],
    ['Foto3URL', 'Foto3Url', 'foto3URL', 'foto3Url', 'foto3', 'Foto3', 'foto_3', 'Foto_3'],
    ['Foto4URL', 'Foto4Url', 'foto4URL', 'foto4Url', 'foto4', 'Foto4', 'foto_4', 'Foto_4'],
]);

const PHOTO_MIME_EXTENSION_MAP = Object.freeze({
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'image/heif': 'heif',
});

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

function guessExtensionFromMimeType(mimeType) {
    const normalized = sanitizeString(mimeType).toLowerCase();
    return PHOTO_MIME_EXTENSION_MAP[normalized] || 'jpg';
}

function sanitizePhotoFileName(name, fallbackBase, index, mimeType) {
    const base = sanitizeString(name) || `${fallbackBase}-foto-${index + 1}`;
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

function normalizePhotoSlots(slots) {
    const baseSlots = createEmptyPhotoSlots();

    if (!Array.isArray(slots)) {
        return baseSlots;
    }

    return baseSlots.map((slot, index) => {
        const source = slots[index];
        if (!source || typeof source !== 'object') {
            return slot;
        }

        return {
            ...slot,
            previewUrl: sanitizeString(source.previewUrl),
            base64Data: sanitizeString(source.base64Data),
            mimeType: sanitizeString(source.mimeType),
            fileName: sanitizeString(source.fileName),
            url: sanitizeString(source.url),
            shouldRemove: Boolean(source.shouldRemove),
        };
    });
}

function buildPhotoSlotsFromUrls(urls = []) {
    const slots = createEmptyPhotoSlots();

    urls.forEach((value, index) => {
        if (index >= slots.length) {
            return;
        }

        slots[index].url = sanitizeString(value);
    });

    return slots;
}

function extractBase64FromDataUrl(dataUrl) {
    const text = sanitizeString(dataUrl);
    if (!text) {
        return '';
    }

    const commaIndex = text.indexOf(',');
    if (commaIndex !== -1) {
        return text.slice(commaIndex + 1);
    }

    return text;
}

function getPhotoPreviewSource(slot) {
    if (!slot || typeof slot !== 'object') {
        return '';
    }

    return sanitizeString(slot.previewUrl) || sanitizeString(slot.url);
}

function hasPhotoContent(slot) {
    if (!slot || typeof slot !== 'object') {
        return false;
    }

    return Boolean(
        sanitizeString(slot.previewUrl)
        || sanitizeString(slot.url)
        || sanitizeString(slot.base64Data),
    );
}

function formatPhotoFileLabel(slot) {
    if (!slot || typeof slot !== 'object') {
        return 'Sin foto seleccionada';
    }

    if (sanitizeString(slot.fileName)) {
        return slot.fileName;
    }

    if (sanitizeString(slot.url)) {
        return slot.url;
    }

    return 'Sin foto seleccionada';
}

function isFileReaderSupported() {
    return typeof FileReader !== 'undefined';
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        if (!file || typeof FileReader === 'undefined') {
            reject(new Error('La lectura de archivos no es compatible.'));
            return;
        }

        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('No se pudo leer el archivo seleccionado.'));
        reader.readAsDataURL(file);
    });
}

const CLIENT_NAME_KEYS = Object.freeze([
    'nombre',
    'Nombre',
    'cliente',
    'Cliente',
    'razon_social',
    'RazonSocial',
]);

const CLIENT_ID_KEYS = Object.freeze([
    'id',
    'ID',
    'id_cliente',
    'IdCliente',
    'codigo',
    'Codigo',
    'cuit',
    'CUIT',
]);

const CLIENT_ADDRESS_KEYS = Object.freeze([
    'direccion',
    'Direccion',
    'domicilio',
    'Domicilio',
]);

const CLIENT_PHONE_KEYS = Object.freeze([
    'telefono',
    'Telefono',
    'tel',
    'Tel',
    'celular',
    'Celular',
]);

const CLIENT_EMAIL_KEYS = Object.freeze([
    'email',
    'Email',
    'mail',
    'Mail',
    'correo',
    'Correo',
]);

const CLIENT_CUIT_KEYS = Object.freeze([
    'cuit',
    'CUIT',
]);

function getTodayInputDate() {
    const now = new Date();
    if (Number.isNaN(now.getTime())) {
        return '';
    }

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
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
            cuit: '',
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
    const cuitValue = pickValue(remito, ['cuit', 'CUIT', 'cliente_cuit']);
    const reporteIdValue = pickValue(remito, ['reporteId', 'ReporteID', 'IdUnico', 'IDInterna']);
    const fotos = REMITO_FOTO_KEYS.map(keys => sanitizeString(pickValue(remito, keys)) || '');

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
        cuit: sanitizeString(cuitValue),
        reporteId: sanitizeString(reporteIdValue),
        Foto1URL: fotos[0] || '',
        Foto2URL: fotos[1] || '',
        Foto3URL: fotos[2] || '',
        Foto4URL: fotos[3] || '',
        fotos,
    };
}

function getEmptyFormData() {
    return {
        numeroRemito: '',
        numeroReporte: '',
        cliente: '',
        fechaRemitoISO: getTodayInputDate(),
        fechaServicioISO: '',
        tecnico: '',
        observaciones: '',
        direccion: '',
        telefono: '',
        email: '',
        cuit: '',
        reporteId: '',
        fotos: createEmptyPhotoSlots(),
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
        cuit: sanitizeString(remito.cuit),
        reporteId: sanitizeString(remito.reporteId),
        fotos: buildPhotoSlotsFromUrls(Array.isArray(remito.fotos) ? remito.fotos : []),
    };
}

function createClientOptionKey(identifier, label, index = 0) {
    const candidate = sanitizeString(identifier) || sanitizeString(label);
    if (candidate) {
        const normalized = candidate
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');

        if (normalized) {
            return `cliente-${normalized}-${index}`;
        }
    }

    return `cliente-${index}`;
}

function normalizeClientRecord(cliente, index = 0) {
    if (!cliente || typeof cliente !== 'object') {
        return null;
    }

    const nombre = sanitizeString(pickValue(cliente, CLIENT_NAME_KEYS));
    const identificador = sanitizeString(pickValue(cliente, CLIENT_ID_KEYS));
    const direccion = sanitizeString(pickValue(cliente, CLIENT_ADDRESS_KEYS));
    const telefono = sanitizeString(pickValue(cliente, CLIENT_PHONE_KEYS));
    const email = sanitizeString(pickValue(cliente, CLIENT_EMAIL_KEYS));
    const cuit = sanitizeString(pickValue(cliente, CLIENT_CUIT_KEYS));

    const label = nombre || identificador;
    if (!label) {
        return null;
    }

    const key = createClientOptionKey(identificador, label, index);
    const matchValues = Array.from(
        new Set(
            [nombre, identificador, label]
                .map(value => sanitizeString(value).toLowerCase())
                .filter(value => !!value),
        ),
    );

    return {
        key,
        id: identificador,
        label,
        nombre: nombre || identificador || '',
        direccion,
        telefono,
        email,
        cuit,
        matchValues,
    };
}

function normalizeClientesList(clientes = []) {
    if (!Array.isArray(clientes)) {
        return [];
    }

    return clientes
        .map((cliente, index) => normalizeClientRecord(cliente, index))
        .filter(item => item !== null);
}

function findClienteByKey(key) {
    if (!key) {
        return null;
    }

    if (!Array.isArray(state.clienteOptions)) {
        return null;
    }

    return state.clienteOptions.find(option => option.key === key) || null;
}

function findClienteByMatch(value) {
    const target = sanitizeString(value).toLowerCase();
    if (!target || !Array.isArray(state.clienteOptions)) {
        return null;
    }

    return state.clienteOptions.find(option => option.matchValues.includes(target)) || null;
}

function syncSelectedClienteFromForm() {
    const currentKey = sanitizeString(state.selectedClienteKey);
    if (currentKey && findClienteByKey(currentKey)) {
        return;
    }

    const currentCliente = sanitizeString(state.formData?.cliente);
    if (!currentCliente) {
        state.selectedClienteKey = '';
        return;
    }

    const match = findClienteByMatch(currentCliente);
    state.selectedClienteKey = match ? match.key : '';
}

function applyClienteSelection(key) {
    const option = findClienteByKey(key);
    state.selectedClienteKey = option ? option.key : '';

    if (!option) {
        return;
    }

    state.formData.cliente = option.nombre || option.label || '';
    state.formData.direccion = option.direccion || '';
    state.formData.telefono = option.telefono || '';
    state.formData.email = option.email || '';
    state.formData.cuit = option.cuit || '';
}

function buildClienteOptionsHtml() {
    if (!Array.isArray(state.clienteOptions) || state.clienteOptions.length === 0) {
        return '';
    }

    const selectedKey = sanitizeString(state.selectedClienteKey);

    return state.clienteOptions
        .map(option => {
            const selectedAttr = selectedKey && option.key === selectedKey ? ' selected' : '';
            const label = escapeHtml(option.label || option.nombre || option.id || '');
            return `<option value="${option.key}"${selectedAttr}>${label}</option>`;
        })
        .join('');
}

function buildPhotoSlotHtml(slot, index, disabledAttr) {
    const previewSource = getPhotoPreviewSource(slot);
    const hasPreview = Boolean(previewSource);
    const labelText = escapeHtml(formatPhotoFileLabel(slot));
    const buttonClasses = [
        'group relative flex w-full items-center justify-center overflow-hidden rounded-xl border-2',
        'min-h-[180px]',
        hasPreview ? 'border-transparent bg-gray-900/5' : 'border-dashed border-gray-300 bg-gray-50',
        'text-gray-400 transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
    ].join(' ');
    const triggerContent = hasPreview
        ? `
            <img src="${escapeHtml(previewSource)}" alt="Foto ${index + 1}" class="max-h-72 max-w-full object-contain mx-auto" loading="lazy">
        `
        : `
            <div class="flex flex-col items-center justify-center gap-2 text-gray-400">
                <span class="text-5xl font-light leading-none">+</span>
                <span class="text-xs font-medium">Agregar foto</span>
            </div>
        `;
    const removeButton = hasPreview
        ? `
            <button type="button" class="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-red-500 shadow-md transition hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60" data-remito-photo-action="remove" data-remito-photo-index="${index}" title="Eliminar foto" aria-label="Eliminar foto"${disabledAttr}>
                <span aria-hidden="true" class="text-lg leading-none">&times;</span>
            </button>
        `
        : '';

    const menuHtml = `
        <div class="absolute inset-0 z-10 hidden items-center justify-center rounded-xl bg-black/40 p-4" data-remito-photo-menu="${index}" aria-hidden="true">
            <button type="button" class="absolute inset-0 cursor-default" data-remito-photo-menu-dismiss></button>
            <div class="relative z-10 w-full max-w-[220px] space-y-2 rounded-lg bg-white p-4 text-center shadow-lg">
                <p class="text-sm font-semibold text-gray-700">Seleccioná una opción</p>
                <button type="button" class="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60" data-remito-photo-action="capture" data-remito-photo-index="${index}"${disabledAttr}>Tomar foto</button>
                <button type="button" class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60" data-remito-photo-action="upload" data-remito-photo-index="${index}"${disabledAttr}>Subir foto</button>
                <button type="button" class="w-full rounded-lg border border-transparent bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2" data-remito-photo-menu-dismiss>Cerrar</button>
            </div>
        </div>
    `;

    return `
        <div class="remito-photo-slot space-y-2" data-remito-photo-slot="${index}">
            <div class="flex items-center justify-between gap-2">
                <p class="text-sm font-medium text-gray-700">Foto ${index + 1}</p>
                <p class="max-w-[60%] truncate text-[11px] text-gray-500">${labelText}</p>
            </div>
            <div class="relative">
                <button type="button" class="${buttonClasses}" data-remito-photo-trigger data-remito-photo-index="${index}" aria-label="Agregar o reemplazar foto ${index + 1}"${disabledAttr}>
                    ${triggerContent}
                </button>
                ${removeButton}
                ${menuHtml}
            </div>
            <input type="file" accept="image/*" capture="environment" class="hidden" data-remito-photo-input="capture" data-remito-photo-index="${index}"${disabledAttr}>
            <input type="file" accept="image/*" class="hidden" data-remito-photo-input="upload" data-remito-photo-index="${index}"${disabledAttr}>
        </div>
    `;
}

function buildPhotoSectionHtml(disableFormFields) {
    const disabledAttr = disableFormFields ? ' disabled' : '';
    const slots = normalizePhotoSlots(state.formData?.fotos);

    let highestSequentialFilled = -1;
    for (let i = 0; i < slots.length; i += 1) {
        if (hasPhotoContent(slots[i]) && i === highestSequentialFilled + 1) {
            highestSequentialFilled = i;
            continue;
        }

        if (i === highestSequentialFilled + 1 && !hasPhotoContent(slots[i])) {
            break;
        }
    }

    let lastExistingIndex = -1;
    for (let i = 0; i < slots.length; i += 1) {
        if (hasPhotoContent(slots[i])) {
            lastExistingIndex = i;
        }
    }

    const nextSequentialIndex = Math.min(highestSequentialFilled + 1, MAX_REMITO_PHOTOS - 1);
    const displayUntil = Math.max(nextSequentialIndex, lastExistingIndex);
    const totalSlotsToShow = Math.max(1, Math.min(slots.length, displayUntil + 1));

    const slotsHtml = slots
        .slice(0, totalSlotsToShow)
        .map((slot, index) => buildPhotoSlotHtml(slot, index, disabledAttr))
        .join('');

    return `
        <div class="space-y-3">
            <div class="flex flex-col gap-1">
                <span class="text-sm font-medium text-gray-700">Fotos del servicio</span>
                <span class="text-xs text-gray-500">Podés subir hasta cuatro imágenes. Cada archivo puede pesar hasta 5 MB.</span>
            </div>
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                ${slotsHtml}
            </div>
        </div>
    `;
}

function closeAllPhotoMenus() {
    if (typeof document === 'undefined') {
        return;
    }

    const menus = document.querySelectorAll('[data-remito-photo-menu]');
    menus.forEach((menu) => {
        menu.classList.add('hidden');
        menu.setAttribute('aria-hidden', 'true');
    });
}

function togglePhotoMenu(index) {
    if (typeof document === 'undefined') {
        return;
    }

    const normalizedIndex = Number(index);
    if (!Number.isFinite(normalizedIndex) || normalizedIndex < 0 || normalizedIndex >= MAX_REMITO_PHOTOS) {
        return;
    }

    const selector = `[data-remito-photo-menu="${normalizedIndex}"]`;
    const menu = document.querySelector(selector);
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

function buildPayloadFromForm(formData = {}) {
    const fechaRemitoISO = sanitizeString(formData.fechaRemitoISO);
    const fechaServicioISO = sanitizeString(formData.fechaServicioISO);
    const fotoSlots = normalizePhotoSlots(formData.fotos);

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
        cuit: sanitizeString(formData.cuit),
        reporteId: sanitizeString(formData.reporteId),
        fotos: fotoSlots.map((slot, index) => ({
            slot: index + 1,
            url: sanitizeString(slot.url),
            base64Data: sanitizeString(slot.base64Data),
            mimeType: sanitizeString(slot.mimeType),
            fileName: sanitizeString(slot.fileName),
            shouldRemove: Boolean(slot.shouldRemove),
        })),
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
    const cuit = sanitizeString(payload.cuit);
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
        cliente_cuit: cuit || undefined,
        cuit: cuit || undefined,
        CUIT: cuit || undefined,
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

    if (Array.isArray(payload.fotos)) {
        const fotos = payload.fotos
            .map((item) => {
                if (!item || typeof item !== 'object') {
                    return null;
                }

                const slot = Number(item.slot);
                const base64Data = sanitizeString(item.base64Data);
                const mimeType = sanitizeString(item.mimeType);
                const fileName = sanitizeString(item.fileName);
                const url = sanitizeString(item.url);
                const shouldRemove = Boolean(item.shouldRemove);

                if (!base64Data && !url && !shouldRemove) {
                    return null;
                }

                const normalized = {};
                if (Number.isFinite(slot) && slot > 0) {
                    normalized.slot = slot;
                }
                if (base64Data) {
                    normalized.base64Data = base64Data;
                }
                if (mimeType) {
                    normalized.mimeType = mimeType;
                }
                if (fileName) {
                    normalized.fileName = fileName;
                }
                if (url) {
                    normalized.url = url;
                }
                if (shouldRemove) {
                    normalized.shouldRemove = true;
                }

                return normalized;
            })
            .filter(Boolean);

        if (fotos.length > 0) {
            request.fotos = fotos;
        }
    }

    return request;
}

function validateFormData(formData = {}) {
    const errors = [];

    const requireNumeroRemito = state.formMode === 'edit';
    if (requireNumeroRemito && !sanitizeString(formData.numeroRemito)) {
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
    clienteOptions: [],
    clientesLoaded: false,
    isLoadingClientes: false,
    clientesError: null,
    selectedClienteKey: '',
};

function ensurePhotoSlotsInFormData() {
    if (!state.formData || typeof state.formData !== 'object') {
        state.formData = getEmptyFormData();
    }

    state.formData.fotos = normalizePhotoSlots(state.formData.fotos);
}

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
    obtenerClientes: async () => {
        throw new Error('La función obtenerClientes no fue provista.');
    },
};

let dependencies = { ...defaultDependencies };

function setDependencies(overrides = {}) {
    dependencies = { ...defaultDependencies, ...(overrides || {}) };
}

async function ensureClientesLoaded({ force = false, reRender = false } = {}) {
    const obtenerClientes = dependencies.obtenerClientes;
    if (typeof obtenerClientes !== 'function') {
        state.clienteOptions = [];
        state.clientesLoaded = false;
        state.clientesError = 'No se configuró la función para obtener clientes.';
        if (reRender) {
            renderManagementView();
        }
        return;
    }

    if (state.isLoadingClientes) {
        return;
    }

    if (!force && state.clientesLoaded && Array.isArray(state.clienteOptions) && state.clienteOptions.length > 0) {
        syncSelectedClienteFromForm();
        return;
    }

    state.isLoadingClientes = true;
    if (reRender) {
        renderManagementView();
    }

    try {
        const clientes = await obtenerClientes({ forceRefresh: Boolean(force) });
        state.clienteOptions = normalizeClientesList(clientes);
        state.clientesLoaded = true;
        state.clientesError = null;
        syncSelectedClienteFromForm();
    } catch (error) {
        state.clienteOptions = [];
        state.clientesLoaded = false;
        state.clientesError = error?.message || 'No se pudieron cargar los clientes.';
    } finally {
        state.isLoadingClientes = false;
        if (reRender) {
            renderManagementView();
        }
    }
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
    ensurePhotoSlotsInFormData();
    state.editingRemitoId = null;
    state.editingRemitoLabel = '';
    state.editingRemitoOriginal = null;
    state.viewMode = viewMode;
    state.selectedClienteKey = '';
}

function renderManagementView() {
    const container = getContainerElement();
    if (!container) {
        return;
    }

    ensurePhotoSlotsInFormData();
    const disableFormFields = state.isSaving || state.isLoading;
    const disabledAttr = disableFormFields ? 'disabled' : '';
    const clienteOptionsHtml = buildClienteOptionsHtml();
    const clientePlaceholder = state.isLoadingClientes
        ? 'Cargando clientes...'
        : 'Seleccioná un cliente';
    const clienteHelperHtml = state.clientesError
        ? `<p class="mt-1 text-xs text-red-600">${escapeHtml(state.clientesError)}</p>`
        : '<p class="mt-1 text-xs text-gray-500">Seleccioná un cliente para completar los datos automáticamente.</p>';
    const clienteSelectDisabledAttr = (disableFormFields || state.isLoadingClientes) ? 'disabled' : '';
    const shouldShowNumeroRemitoPlaceholder = state.formMode === 'create'
        && !sanitizeString(state.formData.numeroRemito);
    const numeroRemitoPlaceholderAttr = shouldShowNumeroRemitoPlaceholder
        ? ' placeholder="Se asignará automáticamente"'
        : '';
    const numeroRemitoHelpHtml = shouldShowNumeroRemitoPlaceholder
        ? '<p class="mt-1 text-xs text-gray-500">Se asignará automáticamente al guardar.</p>'
        : '';
    const numeroReporteFieldHtml = state.formMode === 'edit' && sanitizeString(state.formData.numeroReporte)
        ? `
            <div class="flex flex-col gap-1">
                <label for="remito-form-reporte" class="text-sm font-medium text-gray-700">Número de reporte</label>
                <input id="remito-form-reporte" type="text" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.formData.numeroReporte)}" readonly ${disabledAttr}>
            </div>
        `
        : '';
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
    const photoSectionHtml = buildPhotoSectionHtml(disableFormFields);

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
                                <label for="remito-form-numero" class="text-sm font-medium text-gray-700">Número de remito</label>
                                <input id="remito-form-numero" type="text" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500" data-remito-field="numeroRemito" value="${escapeHtml(state.formData.numeroRemito)}"${numeroRemitoPlaceholderAttr} readonly ${disabledAttr}>
                                ${numeroRemitoHelpHtml}
                            </div>
                            ${numeroReporteFieldHtml}
                            <div class="flex flex-col gap-1">
                                <label for="remito-form-cliente-select" class="text-sm font-medium text-gray-700">Cliente *</label>
                                <select id="remito-form-cliente-select" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500" ${clienteSelectDisabledAttr}>
                                    <option value="">${escapeHtml(clientePlaceholder)}</option>
                                    ${clienteOptionsHtml}
                                </select>
                                ${clienteHelperHtml}
                            </div>
                            <div class="flex flex-col gap-1">
                                <label for="remito-form-cliente" class="text-sm font-medium text-gray-700">Razón social / Cliente *</label>
                                <input id="remito-form-cliente" type="text" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500" data-remito-field="cliente" value="${escapeHtml(state.formData.cliente)}" placeholder="Nombre del cliente" ${disabledAttr}>
                            </div>
                            <div class="flex flex-col gap-1">
                                <label for="remito-form-fecha" class="text-sm font-medium text-gray-700">Fecha del remito</label>
                                <input id="remito-form-fecha" type="date" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500" data-remito-field="fechaRemitoISO" value="${escapeHtml(state.formData.fechaRemitoISO)}" ${disabledAttr}>
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
                                <label for="remito-form-cuit" class="text-sm font-medium text-gray-700">CUIT</label>
                                <input id="remito-form-cuit" type="text" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500" data-remito-field="cuit" value="${escapeHtml(state.formData.cuit)}" placeholder="CUIT del cliente" ${disabledAttr}>
                            </div>
                            <div class="flex flex-col gap-1">
                                <label for="remito-form-reporte-id" class="text-sm font-medium text-gray-700">Número de referencia, O.C, Presupuesto</label>
                                <input id="remito-form-reporte-id" type="text" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500" data-remito-field="reporteId" value="${escapeHtml(state.formData.reporteId)}" placeholder="Identificador asociado" ${disabledAttr}>
                            </div>
                            <div class="flex flex-col gap-1">
                                <label for="remito-form-observaciones" class="text-sm font-medium text-gray-700">Observaciones</label>
                                <textarea id="remito-form-observaciones" rows="3" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500" data-remito-field="observaciones" placeholder="Notas adicionales" ${disabledAttr}>${escapeHtml(state.formData.observaciones)}</textarea>
                            </div>
                        </div>
                        ${photoSectionHtml}
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
        ['Número de referencia, O.C, Presupuesto', remito.reporteId],
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
    ensurePhotoSlotsInFormData();
    state.editingRemitoId = getRemitoIdentifier(remito);
    state.editingRemitoLabel = sanitizeString(remito.numeroRemito) || sanitizeString(remito.reporteId);
    state.editingRemitoOriginal = remito;
    syncSelectedClienteFromForm();
    state.viewMode = 'form';

    renderManagementView();
    void ensureClientesLoaded({ reRender: true });
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

async function handlePhotoFileSelection(index, file) {
    if (state.isSaving || state.isLoading) {
        return;
    }

    const normalizedIndex = Number(index);
    if (!Number.isFinite(normalizedIndex) || normalizedIndex < 0 || normalizedIndex >= MAX_REMITO_PHOTOS) {
        return;
    }

    if (!file) {
        return;
    }

    if (!file.type || !file.type.startsWith('image/')) {
        setFeedback('error', 'Solo se pueden cargar archivos de imagen.');
        renderManagementView();
        return;
    }

    if (file.size && file.size > MAX_PHOTO_SIZE_BYTES) {
        setFeedback('error', 'La foto supera el límite de 5 MB permitido.');
        renderManagementView();
        return;
    }

    if (!isFileReaderSupported()) {
        setFeedback('error', 'El navegador no permite procesar imágenes desde este formulario.');
        renderManagementView();
        return;
    }

    try {
        const dataUrl = await readFileAsDataUrl(file);
        const base64Data = extractBase64FromDataUrl(dataUrl);
        const mimeType = sanitizeString(file.type) || 'image/jpeg';
        const numeroRemito = sanitizeString(state.formData?.numeroRemito) || 'remito';
        const fileName = sanitizePhotoFileName(file.name, numeroRemito, normalizedIndex, mimeType);

        ensurePhotoSlotsInFormData();
        const slots = normalizePhotoSlots(state.formData.fotos);
        slots[normalizedIndex] = {
            index: normalizedIndex,
            previewUrl: typeof dataUrl === 'string' ? dataUrl : '',
            base64Data,
            mimeType,
            fileName,
            url: '',
            shouldRemove: false,
        };
        state.formData.fotos = slots;
        setFeedback(null);
        renderManagementView();
    } catch (error) {
        setFeedback('error', error?.message || 'No se pudo procesar la foto seleccionada.');
        renderManagementView();
    }
}

function removePhotoSlot(index) {
    const normalizedIndex = Number(index);
    if (!Number.isFinite(normalizedIndex) || normalizedIndex < 0 || normalizedIndex >= MAX_REMITO_PHOTOS) {
        return;
    }

    closeAllPhotoMenus();
    ensurePhotoSlotsInFormData();
    const slots = normalizePhotoSlots(state.formData.fotos);
    const previous = slots[normalizedIndex];
    const hadExistingUrl = Boolean(previous?.url);
    slots[normalizedIndex] = {
        ...createEmptyPhotoSlot(normalizedIndex),
        shouldRemove: hadExistingUrl,
    };
    state.formData.fotos = slots;
    renderManagementView();
}

function handlePhotoAction(action, index) {
    if (!action) {
        return;
    }

    const normalizedIndex = Number(index);
    if (!Number.isFinite(normalizedIndex) || normalizedIndex < 0 || normalizedIndex >= MAX_REMITO_PHOTOS) {
        return;
    }

    if (action === 'remove') {
        removePhotoSlot(normalizedIndex);
        return;
    }

    if (state.isSaving || state.isLoading) {
        return;
    }

    if (typeof document === 'undefined') {
        return;
    }

    closeAllPhotoMenus();
    const selector = `[data-remito-photo-input="${action}"][data-remito-photo-index="${normalizedIndex}"]`;
    const input = document.querySelector(selector);
    if (input) {
        input.value = '';
        input.click();
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

function handleContainerChange(event) {
    const target = event?.target;
    if (!target) {
        return;
    }

    const photoInputMode = target.dataset?.remitoPhotoInput;
    if (photoInputMode) {
        const index = Number.parseInt(target.dataset.remitoPhotoIndex ?? '', 10);
        const file = target.files && target.files[0];
        if (Number.isFinite(index) && index >= 0 && index < MAX_REMITO_PHOTOS && file) {
            void handlePhotoFileSelection(index, file);
        }

        target.value = '';
        return;
    }

    if (target.id === 'remito-form-cliente-select') {
        const value = typeof target.value === 'string' ? target.value : '';
        applyClienteSelection(value);
        renderManagementView();
        return;
    }

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
            const response = await dependencies.crearRemito(requestPayload);
            const nuevoNumero = sanitizeString(response?.NumeroRemito || response?.numeroRemito);
            setFeedback(
                'success',
                nuevoNumero
                    ? `El remito ${nuevoNumero} se creó correctamente.`
                    : 'El remito se creó correctamente.',
            );
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
        void ensureClientesLoaded({ reRender: true });
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
    const clickedInsidePhotoMenu = Boolean(event.target.closest('[data-remito-photo-menu]'));
    if (!clickedInsidePhotoMenu) {
        closeAllPhotoMenus();
    }

    const photoMenuDismiss = event.target.closest('[data-remito-photo-menu-dismiss]');
    if (photoMenuDismiss) {
        event.preventDefault();
        closeAllPhotoMenus();
        return;
    }

    const photoTrigger = event.target.closest('[data-remito-photo-trigger]');
    if (photoTrigger) {
        event.preventDefault();
        togglePhotoMenu(photoTrigger.dataset.remitoPhotoIndex);
        return;
    }

    const actionButton = event.target.closest('[data-remitos-action]');
    if (actionButton) {
        event.preventDefault();
        handleAction(actionButton.dataset.remitosAction);
        return;
    }

    const photoButton = event.target.closest('[data-remito-photo-action]');
    if (photoButton) {
        event.preventDefault();
        handlePhotoAction(photoButton.dataset.remitoPhotoAction, photoButton.dataset.remitoPhotoIndex);
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
        container.addEventListener('change', handleContainerChange);
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
