import { getEquiposByCliente } from '../admin/sistemasEquipos.js';
import { getCurrentUserName } from '../login/auth.js';
import { buildPrintableRemitoData, createRemitoPrintHtml, generatePdfBlob } from '../remito/remito.js';

const DEFAULT_PAGE_SIZE = 20;
const MAX_REMITO_PHOTOS = 4;
const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const REMITO_FOTO_KEYS = Object.freeze([
    ['Foto1Id', 'Foto1ID', 'foto1Id', 'foto1ID', 'Foto1URL', 'Foto1Url', 'foto1URL', 'foto1Url', 'foto1', 'Foto1', 'foto_1', 'Foto_1'],
    ['Foto2Id', 'Foto2ID', 'foto2Id', 'foto2ID', 'Foto2URL', 'Foto2Url', 'foto2URL', 'foto2Url', 'foto2', 'Foto2', 'foto_2', 'Foto_2'],
    ['Foto3Id', 'Foto3ID', 'foto3Id', 'foto3ID', 'Foto3URL', 'Foto3Url', 'foto3URL', 'foto3Url', 'foto3', 'Foto3', 'foto_3', 'Foto_3'],
    ['Foto4Id', 'Foto4ID', 'foto4Id', 'foto4ID', 'Foto4URL', 'Foto4Url', 'foto4URL', 'foto4Url', 'foto4', 'Foto4', 'foto_4', 'Foto_4'],
]);
const DRIVE_DIRECT_URL_BASE = 'https://drive.google.com/uc?export=view&id=';

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

function buildDriveDirectUrl(fileId) {
    const id = sanitizeString(fileId);
    if (!id) {
        return '';
    }

    try {
        return `${DRIVE_DIRECT_URL_BASE}${encodeURIComponent(id)}`;
    } catch (error) {
        return `${DRIVE_DIRECT_URL_BASE}${id}`;
    }
}

function extractDriveFileId(value) {
    const text = sanitizeString(value);
    if (!text || text.startsWith('data:')) {
        return '';
    }

    const directMatch = text.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (directMatch && directMatch[1]) {
        return directMatch[1];
    }

    const pathMatch = text.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (pathMatch && pathMatch[1]) {
        return pathMatch[1];
    }

    if (/^[a-zA-Z0-9_-]{10,}$/.test(text)) {
        return text;
    }

    return '';
}

function createEmptyPhotoSlot(index = 0) {
    return {
        index,
        previewUrl: '',
        base64Data: '',
        mimeType: '',
        fileName: '',
        url: '',
        driveId: '',
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

        const normalizedUrl = sanitizeString(source.url);
        const driveId = sanitizeString(source.driveId || source.driveFileId)
            || extractDriveFileId(normalizedUrl);

        return {
            ...slot,
            previewUrl: sanitizeString(source.previewUrl),
            base64Data: sanitizeString(source.base64Data),
            mimeType: sanitizeString(source.mimeType),
            fileName: sanitizeString(source.fileName),
            url: driveId ? buildDriveDirectUrl(driveId) : normalizedUrl,
            driveId,
            shouldRemove: Boolean(source.shouldRemove),
        };
    });
}

function buildPhotoSlotsFromSources(ids = [], urls = []) {
    const slots = createEmptyPhotoSlots();

    slots.forEach((slot, index) => {
        if (index >= slots.length) {
            return;
        }

        const id = Array.isArray(ids) ? sanitizeString(ids[index]) : '';
        const rawUrl = Array.isArray(urls) ? sanitizeString(urls[index]) : '';
        const driveId = id || extractDriveFileId(rawUrl);
        const directUrl = driveId ? buildDriveDirectUrl(driveId) : rawUrl;

        slot.driveId = driveId;
        slot.url = directUrl;
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

    const previewUrl = sanitizeString(slot.previewUrl);
    if (previewUrl) {
        return previewUrl;
    }

    const driveId = sanitizeString(slot.driveId);
    if (driveId) {
        return buildDriveDirectUrl(driveId);
    }

    const url = sanitizeString(slot.url);
    const derivedId = extractDriveFileId(url);
    if (derivedId) {
        return buildDriveDirectUrl(derivedId);
    }

    return url;
}

function hasPhotoContent(slot) {
    if (!slot || typeof slot !== 'object') {
        return false;
    }

    return Boolean(
        sanitizeString(slot.previewUrl)
        || sanitizeString(slot.url)
        || sanitizeString(slot.driveId)
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

    const driveId = sanitizeString(slot.driveId);
    if (driveId) {
        return `Foto en Drive (${driveId.slice(0, 8)}...)`;
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

    const numeroRemitoValue = pickValue(remito, ['numeroRemito', 'NumeroRemito', 'numero_remito']);
    const numeroReporteValue = pickValue(remito, ['numeroReporte', 'NumeroReporte', 'numero_reporte']);
    const clienteValue = pickValue(remito, ['cliente', 'Cliente', 'NombreCliente', 'cliente_nombre']);
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
    const fotoValues = REMITO_FOTO_KEYS.map(keys => sanitizeString(pickValue(remito, keys)) || '');
    const fotoDriveIds = fotoValues.map(value => extractDriveFileId(value));
    const fotoUrls = fotoValues.map((value, index) => {
        const driveId = fotoDriveIds[index];
        if (driveId) {
            return buildDriveDirectUrl(driveId);
        }
        return value;
    });

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
        // Path del PDF guardado en Storage
        pdf_path: sanitizeString(remito.pdf_path) || '',
        // Datos del equipo
        equipo_descripcion: sanitizeString(remito.equipo_descripcion) || '',
        equipo_modelo: sanitizeString(remito.equipo_modelo) || '',
        equipo_serie: sanitizeString(remito.equipo_serie) || '',
        equipo_interno: sanitizeString(remito.equipo_interno) || '',
        equipo_ubicacion: sanitizeString(remito.equipo_ubicacion) || '',
        // Repuestos
        repuestos: remito.repuestos || [],
        // Fotos
        Foto1Id: fotoDriveIds[0] || '',
        Foto2Id: fotoDriveIds[1] || '',
        Foto3Id: fotoDriveIds[2] || '',
        Foto4Id: fotoDriveIds[3] || '',
        Foto1URL: fotoUrls[0] || '',
        Foto2URL: fotoUrls[1] || '',
        Foto3URL: fotoUrls[2] || '',
        Foto4URL: fotoUrls[3] || '',
        fotos: fotoUrls,
        fotosDriveIds: fotoDriveIds,
    };
}

function getEmptyFormData() {
    // Obtener el nombre del técnico logueado automáticamente
    const tecnicoLogueado = getCurrentUserName() || '';
    
    return {
        numeroRemito: '',
        numeroReporte: '',
        cliente: '',
        fechaRemitoISO: getTodayInputDate(),
        fechaServicioISO: '',
        tecnico: tecnicoLogueado,
        referencia: '', // Referencia / O.C / Presupuesto
        observaciones: '',
        direccion: '',
        telefono: '',
        email: '',
        cuit: '',
        reporteId: '',
        fotos: createEmptyPhotoSlots(),
        // Campos de equipo
        equipoId: '',
        sistemaNombre: '',
        modelo: '',
        serie: '',
        tagId: '',
        // Repuestos
        repuestos: [],
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
        fotos: buildPhotoSlotsFromSources(
            Array.isArray(remito.fotosDriveIds) ? remito.fotosDriveIds : [],
            Array.isArray(remito.fotos) ? remito.fotos : [],
        ),
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
    
    // Obtener el ID real del cliente (UUID de Supabase)
    const clientId = cliente.id || cliente.ID || identificador;

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
        id: clientId,
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

async function applyClienteSelection(key) {
    const option = findClienteByKey(key);
    state.selectedClienteKey = option ? option.key : '';
    
    // Limpiar equipos y datos de equipo previos
    state.equiposCliente = [];
    state.selectedEquipoId = '';
    state.formData.equipoId = '';
    state.formData.sistemaNombre = '';
    state.formData.modelo = '';
    state.formData.serie = '';
    state.formData.tagId = '';

    if (!option) {
        return;
    }

    state.formData.cliente = option.nombre || option.label || '';
    state.formData.direccion = option.direccion || '';
    state.formData.telefono = option.telefono || '';
    state.formData.email = option.email || '';
    state.formData.cuit = option.cuit || '';
    
    // Cargar equipos del cliente seleccionado
    if (option.id) {
        console.log('[RemitosGestion] Cargando equipos para cliente ID:', option.id, 'Nombre:', option.nombre);
        state.isLoadingEquipos = true;
        renderManagementView();
        
        try {
            const equipos = await getEquiposByCliente(option.id);
            console.log('[RemitosGestion] Equipos encontrados:', equipos?.length || 0, equipos);
            state.equiposCliente = equipos || [];
        } catch (error) {
            console.warn('[RemitosGestion] Error cargando equipos del cliente:', error);
            state.equiposCliente = [];
        } finally {
            state.isLoadingEquipos = false;
            renderManagementView();
        }
    }
}

function applyEquipoSelection(equipoId) {
    state.selectedEquipoId = equipoId || '';
    state.formData.equipoId = equipoId || '';
    
    if (!equipoId) {
        state.formData.sistemaNombre = '';
        state.formData.modelo = '';
        state.formData.serie = '';
        state.formData.tagId = '';
        return;
    }
    
    const equipo = state.equiposCliente.find(e => e.id === equipoId);
    if (equipo) {
        state.formData.sistemaNombre = equipo.sistema_nombre || '';
        state.formData.modelo = equipo.modelo || '';
        state.formData.serie = equipo.serie || '';
        state.formData.tagId = equipo.tag_id || '';
    }
}

function buildEquiposOptionsHtml() {
    if (state.isLoadingEquipos) {
        return '<option value="">Cargando equipos...</option>';
    }
    
    if (!Array.isArray(state.equiposCliente) || state.equiposCliente.length === 0) {
        return '<option value="">Sin equipos registrados</option>';
    }

    const selectedId = sanitizeString(state.selectedEquipoId);

    return '<option value="">Seleccionar equipo (opcional)...</option>' +
        state.equiposCliente
            .map(equipo => {
                const selectedAttr = selectedId && equipo.id === selectedId ? ' selected' : '';
                const label = buildEquipoLabel(equipo);
                return `<option value="${equipo.id}"${selectedAttr}>${escapeHtml(label)}</option>`;
            })
            .join('');
}

function buildEquipoLabel(equipo) {
    const parts = [];
    if (equipo.sistema_nombre) parts.push(equipo.sistema_nombre);
    if (equipo.modelo) parts.push(`Mod: ${equipo.modelo}`);
    if (equipo.serie) parts.push(`S/N: ${equipo.serie}`);
    if (equipo.tag_id) parts.push(`TAG: ${equipo.tag_id}`);
    return parts.length > 0 ? parts.join(' | ') : 'Equipo sin datos';
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
        <div class="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-black/40 p-4" data-remito-photo-menu="${index}" aria-hidden="true" style="display: none;">
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

function buildRepuestosSectionHtml(disableFormFields) {
    const disabledAttr = disableFormFields ? ' disabled' : '';
    const repuestos = Array.isArray(state.formData?.repuestos) ? state.formData.repuestos : [];
    
    const repuestosRowsHtml = repuestos.length > 0 
        ? repuestos.map((rep, index) => `
            <tr data-repuesto-index="${index}">
                <td class="px-4 py-3">
                    <input type="text" class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                        data-repuesto-field="codigo" value="${escapeHtml(rep.codigo || '')}" placeholder="Código" ${disabledAttr}>
                </td>
                <td class="px-4 py-3">
                    <input type="text" class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                        data-repuesto-field="descripcion" value="${escapeHtml(rep.descripcion || '')}" placeholder="Descripción del repuesto" ${disabledAttr}>
                </td>
                <td class="px-4 py-3">
                    <input type="number" min="1" class="w-24 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-right focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                        data-repuesto-field="cantidad" value="${escapeHtml(rep.cantidad || '1')}" ${disabledAttr}>
                </td>
                <td class="px-4 py-3 text-center">
                    <button type="button" class="text-red-500 hover:text-red-700 focus:outline-none" data-repuesto-remove="${index}" title="Eliminar repuesto" ${disabledAttr}>
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </td>
            </tr>
        `).join('')
        : `
            <tr id="repuestos-empty-row">
                <td colspan="4" class="px-4 py-6 text-center text-sm text-gray-500">
                    No hay repuestos agregados. Usá el botón "Agregar repuesto" para añadir uno.
                </td>
            </tr>
        `;
    
    return `
        <section class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h3 class="text-lg font-semibold text-gray-800">Repuestos y Materiales</h3>
                    <p class="text-sm text-gray-500">Detalle de los repuestos utilizados durante el servicio.</p>
                </div>
                <button type="button" id="remitos-gestion-agregar-repuesto" 
                    class="inline-flex items-center justify-center px-5 py-2.5 rounded-lg font-semibold text-sm bg-blue-600 text-white shadow-sm transition-colors duration-150 ease-out hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
                    ${disabledAttr}>
                    Agregar repuesto
                </button>
            </div>
            <div class="mt-4 overflow-x-auto rounded-xl border border-gray-200">
                <table class="min-w-full divide-y divide-gray-200" id="remito-repuestos-table">
                    <thead class="bg-gray-50">
                        <tr>
                            <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Código</th>
                            <th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Descripción</th>
                            <th scope="col" class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Cantidad</th>
                            <th scope="col" class="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 w-16"></th>
                        </tr>
                    </thead>
                    <tbody id="remitos-gestion-repuestos-body" class="bg-white divide-y divide-gray-200">
                        ${repuestosRowsHtml}
                    </tbody>
                </table>
            </div>
        </section>
    `;
}

function buildPhotoSectionHtml(disableFormFields) {
    const disabledAttr = disableFormFields ? ' disabled' : '';
    const slots = normalizePhotoSlots(state.formData?.fotos);

    // Siempre mostrar los 4 slots de fotos
    const slotsHtml = slots
        .slice(0, MAX_REMITO_PHOTOS)
        .map((slot, index) => buildPhotoSlotHtml(slot, index, disabledAttr))
        .join('');

    return `
        <section class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div class="flex flex-col gap-1">
                <h3 class="text-lg font-semibold text-gray-800">Fotos del servicio</h3>
                <p class="text-sm text-gray-500">Podés subir hasta cuatro imágenes. Cada archivo puede pesar hasta 5 MB.</p>
            </div>
            <div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                ${slotsHtml}
            </div>
        </section>
    `;
}

function closeAllPhotoMenus() {
    if (typeof document === 'undefined') {
        return;
    }

    const container = getContainerElement();
    if (!container) {
        return;
    }

    const menus = container.querySelectorAll('[data-remito-photo-menu]');
    menus.forEach((menu) => {
        menu.style.display = 'none';
        menu.setAttribute('aria-hidden', 'true');
    });
}

function togglePhotoMenu(index) {
    if (typeof document === 'undefined') {
        return;
    }

    const container = getContainerElement();
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

    const isHidden = menu.style.display === 'none' || menu.style.display === '';
    closeAllPhotoMenus();
    if (isHidden) {
        menu.style.display = 'flex';
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
        referencia: sanitizeString(formData.referencia),
        observaciones: sanitizeString(formData.observaciones),
        direccion: sanitizeString(formData.direccion),
        telefono: sanitizeString(formData.telefono),
        email: sanitizeString(formData.email),
        cuit: sanitizeString(formData.cuit),
        reporteId: sanitizeString(formData.reporteId),
        // Datos del equipo seleccionado
        equipo_id: sanitizeString(formData.equipo_id),
        equipo_numero_serie: sanitizeString(formData.equipo_numero_serie),
        equipo_modelo: sanitizeString(formData.equipo_modelo),
        equipo_ubicacion: sanitizeString(formData.equipo_ubicacion),
        // Repuestos utilizados
        repuestos: Array.isArray(formData.repuestos) 
            ? formData.repuestos.map(r => ({
                descripcion: sanitizeString(r.descripcion),
                cantidad: parseInt(r.cantidad, 10) || 1,
                codigo: sanitizeString(r.codigo)
            })).filter(r => r.descripcion) // Solo incluir si tiene descripción
            : [],
        fotos: fotoSlots.map((slot, index) => ({
            slot: index + 1,
            url: sanitizeString(slot.url),
            base64Data: sanitizeString(slot.base64Data),
            mimeType: sanitizeString(slot.mimeType),
            fileName: sanitizeString(slot.fileName),
            driveFileId: sanitizeString(slot.driveId),
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

    const fotoSlots = normalizePhotoSlots(payload.fotos);
    const fotoIds = fotoSlots
        .map(slot => sanitizeString(slot.driveId))
        .filter(id => !!id);

    if (fotoIds.length > 0) {
        reporteData.fotosDriveIds = fotoIds;
        reporteData.fotos_drive_ids = fotoIds;
        reporteData.fotoIds = fotoIds;
    }

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
                const driveFileId = sanitizeString(item.driveFileId || item.driveId);
                const shouldRemove = Boolean(item.shouldRemove);

                if (!base64Data && !url && !driveFileId && !shouldRemove) {
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
                if (driveFileId) {
                    normalized.driveFileId = driveFileId;
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
    // Equipos del cliente seleccionado
    equiposCliente: [],
    isLoadingEquipos: false,
    selectedEquipoId: '',
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
    obtenerUrlPdfRemito: async () => {
        return null; // Fallback: no hay URL, se regenerará el PDF
    },
    guardarPdfRemito: async () => {
        return null; // Fallback: no se guarda PDF si no está provista
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
    // Limpiar equipos
    state.equiposCliente = [];
    state.selectedEquipoId = '';
}

function renderManagementView() {
    const container = getContainerElement();
    if (!container) {
        return;
    }

    ensurePhotoSlotsInFormData();
    const disableFormFields = state.isSaving || state.isLoading;
    const disabledAttr = disableFormFields ? 'disabled' : '';
    
    // Equipos del cliente
    const hasClienteSelected = Boolean(state.selectedClienteKey);
    const equiposOptionsHtml = buildEquiposOptionsHtml();
    const equipoSelectDisabledAttr = (disableFormFields || state.isLoadingEquipos || !hasClienteSelected) ? 'disabled' : '';
    const hasEquipos = hasClienteSelected && state.equiposCliente.length > 0;
    const hasEquipoSelected = Boolean(state.selectedEquipoId);
    
    // Construir sección de equipo - ahora como campos individuales para el grid
    const equipoSectionHtml = hasClienteSelected ? `
        <div class="md:col-span-2">
            <label for="remito-form-equipo-select" class="block text-sm font-semibold text-gray-600">Equipo del cliente</label>
            <select id="remito-form-equipo-select" class="mt-2 w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" ${equipoSelectDisabledAttr}>
                ${equiposOptionsHtml}
            </select>
            <p class="mt-1 text-xs text-gray-500">${hasEquipos ? 'Seleccioná un equipo para completar los datos técnicos.' : 'Este cliente no tiene equipos registrados.'}</p>
        </div>
        <div>
            <label for="remito-form-sistema" class="block text-sm font-semibold text-gray-600">Sistema / Descripción</label>
            <input id="remito-form-sistema" type="text" readonly
                class="mt-2 w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-800 bg-gray-50" 
                value="${escapeHtml(state.formData.sistemaNombre || '')}" 
                placeholder="Se completa al seleccionar equipo">
        </div>
        <div>
            <label for="remito-form-modelo" class="block text-sm font-semibold text-gray-600">Modelo</label>
            <input id="remito-form-modelo" type="text" readonly
                class="mt-2 w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-800 bg-gray-50" 
                value="${escapeHtml(state.formData.modelo || '')}" 
                placeholder="Se completa al seleccionar equipo">
        </div>
        <div>
            <label for="remito-form-serie" class="block text-sm font-semibold text-gray-600">Número de Serie</label>
            <input id="remito-form-serie" type="text" readonly
                class="mt-2 w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-800 bg-gray-50" 
                value="${escapeHtml(state.formData.serie || '')}" 
                placeholder="Se completa al seleccionar equipo">
        </div>
        <div>
            <label for="remito-form-tag" class="block text-sm font-semibold text-gray-600">TAG / ID Interno</label>
            <input id="remito-form-tag" type="text" readonly
                class="mt-2 w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-800 bg-gray-50" 
                value="${escapeHtml(state.formData.tagId || '')}" 
                placeholder="Se completa al seleccionar equipo">
        </div>
    ` : `
        <div class="md:col-span-2">
            <div class="rounded-lg bg-gray-50 border border-gray-200 p-4 text-center text-sm text-gray-500">
                <p>Seleccioná un cliente para ver sus equipos disponibles.</p>
            </div>
        </div>
    `;
    
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
    
    // Construir sección de repuestos
    const repuestosHtml = buildRepuestosSectionHtml(disableFormFields);

    if (state.viewMode === 'form') {
        container.innerHTML = `
            <div class="max-w-5xl mx-auto space-y-6">
                ${feedbackHtml ? `<div>${feedbackHtml}</div>` : ''}
                
                <!-- Header -->
                <div class="bg-white shadow-lg rounded-3xl p-8 border border-gray-200">
                    <h2 class="text-2xl font-bold text-gray-800">${escapeHtml(formTitle)}</h2>
                    <p class="mt-2 text-sm text-gray-500">${formSubtitle}</p>
                </div>

                <form id="remito-abm-form" class="space-y-6">
                    <!-- Número, Fecha, Técnico y Referencia -->
                    <section class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                        <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-600">Número de Remito</label>
                                <div class="mt-2 w-full border border-gray-200 bg-gray-50 rounded-lg px-4 py-2 text-gray-500 italic text-sm">
                                    Automático
                                </div>
                            </div>
                            <div>
                                <label for="remito-form-fecha" class="block text-sm font-semibold text-gray-600">Fecha *</label>
                                <input id="remito-form-fecha" type="date" 
                                    class="mt-2 w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                                    data-remito-field="fechaRemitoISO" 
                                    value="${escapeHtml(state.formData.fechaRemitoISO)}" 
                                    ${disabledAttr}>
                            </div>
                            <div>
                                <label for="remito-form-tecnico" class="block text-sm font-semibold text-gray-600">Técnico Responsable</label>
                                <input id="remito-form-tecnico" type="text" 
                                    class="mt-2 w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-800 bg-gray-50" 
                                    data-remito-field="tecnico" 
                                    value="${escapeHtml(state.formData.tecnico)}" 
                                    placeholder="Nombre del técnico"
                                    readonly
                                    ${disabledAttr}>
                            </div>
                            <div>
                                <label for="remito-form-referencia" class="block text-sm font-semibold text-gray-600">Referencia / O.C / Presupuesto</label>
                                <input id="remito-form-referencia" type="text" 
                                    class="mt-2 w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                                    data-remito-field="referencia" 
                                    value="${escapeHtml(state.formData.referencia || '')}" 
                                    placeholder="Identificador asociado"
                                    ${disabledAttr}>
                            </div>
                        </div>
                    </section>

                    <!-- Datos del Cliente -->
                    <section class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                        <h3 class="text-lg font-semibold text-gray-800">Datos del Cliente</h3>
                        <div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div class="md:col-span-2">
                                <label for="remito-form-cliente" class="block text-sm font-semibold text-gray-600">Razón Social *</label>
                                <div class="relative mt-2">
                                    <div class="flex gap-2">
                                        <input id="remito-form-cliente" type="text" 
                                            class="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                                            data-remito-field="cliente" 
                                            value="${escapeHtml(state.formData.cliente)}" 
                                            placeholder="${state.isLoadingClientes ? 'Cargando clientes...' : 'Buscar cliente...'}" 
                                            autocomplete="off"
                                            ${disabledAttr}>
                                        ${hasClienteSelected ? `
                                        <button type="button" id="remito-form-cliente-clear" class="px-4 py-2 text-sm font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg border border-gray-300 transition-colors" title="Limpiar cliente" ${disabledAttr}>
                                            ✕
                                        </button>
                                        ` : ''}
                                    </div>
                                    <div id="remito-form-cliente-dropdown" class="hidden absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto"></div>
                                </div>
                                <p class="mt-1 text-xs text-gray-500">${hasClienteSelected ? 'Cliente seleccionado. Los datos se completaron automáticamente.' : 'Escribí para buscar un cliente o ingresá los datos manualmente.'}</p>
                            </div>
                            <div>
                                <label for="remito-form-direccion" class="block text-sm font-semibold text-gray-600">Dirección</label>
                                <input id="remito-form-direccion" type="text" 
                                    class="mt-2 w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                                    data-remito-field="direccion" 
                                    value="${escapeHtml(state.formData.direccion)}" 
                                    placeholder="Domicilio del servicio"
                                    ${disabledAttr}>
                            </div>
                            <div>
                                <label for="remito-form-telefono" class="block text-sm font-semibold text-gray-600">Teléfono</label>
                                <input id="remito-form-telefono" type="tel" 
                                    class="mt-2 w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                                    data-remito-field="telefono" 
                                    value="${escapeHtml(state.formData.telefono)}" 
                                    placeholder="Teléfono de contacto"
                                    ${disabledAttr}>
                            </div>
                            <div>
                                <label for="remito-form-email" class="block text-sm font-semibold text-gray-600">Email</label>
                                <input id="remito-form-email" type="email" 
                                    class="mt-2 w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                                    data-remito-field="email" 
                                    value="${escapeHtml(state.formData.email)}" 
                                    placeholder="Correo electrónico"
                                    ${disabledAttr}>
                            </div>
                            <div>
                                <label for="remito-form-cuit" class="block text-sm font-semibold text-gray-600">CUIT</label>
                                <input id="remito-form-cuit" type="text" 
                                    class="mt-2 w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                                    data-remito-field="cuit" 
                                    value="${escapeHtml(state.formData.cuit)}" 
                                    placeholder="CUIT del cliente"
                                    ${disabledAttr}>
                            </div>
                        </div>
                    </section>

                    <!-- Datos del Equipo -->
                    <section class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                        <h3 class="text-lg font-semibold text-gray-800">Datos del Equipo</h3>
                        <div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                            ${equipoSectionHtml}
                        </div>
                    </section>

                    <!-- Repuestos y Materiales -->
                    ${repuestosHtml}

                    <!-- Fotos del Servicio -->
                    ${photoSectionHtml}

                    <!-- Observaciones -->
                    <section class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                        <label for="remito-form-observaciones" class="block text-lg font-semibold text-gray-800">Observaciones</label>
                        <textarea id="remito-form-observaciones" 
                            class="mt-4 w-full border border-gray-300 rounded-lg p-4 text-gray-700 min-h-[120px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                            data-remito-field="observaciones"
                            placeholder="Agregá observaciones o comentarios relevantes"
                            ${disabledAttr}>${escapeHtml(state.formData.observaciones)}</textarea>
                    </section>

                    <!-- Botones de acción -->
                    <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <p class="text-sm text-gray-500">Al guardar, el número de remito se generará automáticamente.</p>
                        <div class="flex flex-col items-stretch gap-3 md:flex-row md:items-center md:justify-end md:gap-3">
                            ${secondaryButtonHtml}
                            <button type="submit" class="inline-flex justify-center rounded-lg border border-transparent bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60" ${disabledAttr}>
                                ${escapeHtml(submitLabel)}
                            </button>
                        </div>
                    </div>
                </form>
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
                                <button type="button" class="text-sm font-semibold text-emerald-600 hover:text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2" data-remito-pdf="${index}" title="Descargar PDF">
                                    📄 PDF
                                </button>
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

function showModal(title, contentHtml) {
    const modalId = 'remito-detail-modal';
    let modal = document.getElementById(modalId);
    
    if (modal) {
        modal.remove();
    }

    const modalHtml = `
        <div id="${modalId}" class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overflow-x-hidden bg-gray-900 bg-opacity-50 p-4 md:inset-0 h-modal md:h-full">
            <div class="relative w-full max-w-2xl h-full md:h-auto">
                <div class="relative bg-white rounded-lg shadow dark:bg-gray-700">
                    <div class="flex items-start justify-between p-4 border-b rounded-t dark:border-gray-600">
                        <h3 class="text-xl font-semibold text-gray-900 dark:text-white">
                            ${escapeHtml(title)}
                        </h3>
                        <button type="button" class="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm p-1.5 ml-auto inline-flex items-center dark:hover:bg-gray-600 dark:hover:text-white" onclick="document.getElementById('${modalId}').remove()">
                            <svg aria-hidden="true" class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>
                            <span class="sr-only">Cerrar</span>
                        </button>
                    </div>
                    <div class="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                        ${contentHtml}
                    </div>
                    <div class="flex items-center p-6 space-x-2 border-t border-gray-200 rounded-b dark:border-gray-600">
                        <button type="button" class="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800" onclick="document.getElementById('${modalId}').remove()">Cerrar</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
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

    const fields = [
        { label: 'Número de Remito', value: remito.numeroRemito },
        { label: 'Fecha del Remito', value: remito.fechaRemito },
        { label: 'Cliente', value: remito.cliente },
        { label: 'Número de Reporte', value: remito.numeroReporte },
        { label: 'Referencia / O.C', value: remito.reporteId },
        { label: 'Fecha del Servicio', value: remito.fechaServicio },
        { label: 'Técnico', value: remito.tecnico },
        { label: 'Dirección', value: remito.direccion },
        { label: 'Teléfono', value: remito.telefono },
        { label: 'Email', value: remito.email },
        { label: 'Observaciones', value: remito.observaciones },
    ];

    // Agregar datos del equipo si existen
    if (remito.equipo_descripcion || remito.equipo_modelo) {
        fields.push({ label: 'Equipo', value: `${remito.equipo_descripcion} ${remito.equipo_modelo}` });
        if (remito.equipo_serie) fields.push({ label: 'Serie', value: remito.equipo_serie });
        if (remito.equipo_ubicacion) fields.push({ label: 'Ubicación', value: remito.equipo_ubicacion });
    }

    const contentHtml = `
        <dl class="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
            ${fields.map(field => {
                const val = getDisplayValue(field.value);
                if (val === '-') return ''; // Omitir campos vacíos
                return `
                    <div class="sm:col-span-1">
                        <dt class="text-sm font-medium text-gray-500">${escapeHtml(field.label)}</dt>
                        <dd class="mt-1 text-sm text-gray-900">${escapeHtml(val)}</dd>
                    </div>
                `;
            }).join('')}
        </dl>
        ${remito.repuestos && remito.repuestos.length > 0 ? `
            <div class="mt-6">
                <h4 class="text-sm font-medium text-gray-900">Repuestos</h4>
                <ul class="mt-2 border border-gray-200 rounded-md divide-y divide-gray-200">
                    ${remito.repuestos.map(r => `
                        <li class="pl-3 pr-4 py-3 flex items-center justify-between text-sm">
                            <div class="w-0 flex-1 flex items-center">
                                <span class="ml-2 flex-1 w-0 truncate">${escapeHtml(r.descripcion || r.Descripcion)} (${escapeHtml(r.codigo || r.Codigo || '-')})</span>
                            </div>
                            <div class="ml-4 flex-shrink-0">
                                <span class="font-medium text-gray-900">Cant: ${r.cantidad || r.Cantidad}</span>
                            </div>
                        </li>
                    `).join('')}
                </ul>
            </div>
        ` : ''}
    `;

    showModal(`Detalle del Remito ${getDisplayValue(remito.numeroRemito)}`, contentHtml);
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

/**
 * Agrega un nuevo repuesto vacío a la lista
 */
function handleAgregarRepuesto() {
    if (!Array.isArray(state.formData.repuestos)) {
        state.formData.repuestos = [];
    }
    
    // Recolectar valores actuales del formulario antes de agregar
    collectRepuestosFromForm();
    
    state.formData.repuestos.push({
        codigo: '',
        descripcion: '',
        cantidad: '1'
    });
    
    renderManagementView();
    
    // Focus en el campo código del nuevo repuesto
    setTimeout(() => {
        const lastIndex = state.formData.repuestos.length - 1;
        const codigoInput = document.querySelector(`tr[data-repuesto-index="${lastIndex}"] input[data-repuesto-field="codigo"]`);
        if (codigoInput) {
            codigoInput.focus();
        }
    }, 50);
}

/**
 * Elimina un repuesto de la lista
 */
function handleRemoveRepuesto(index) {
    if (!Array.isArray(state.formData.repuestos)) {
        return;
    }
    
    // Recolectar valores actuales antes de eliminar
    collectRepuestosFromForm();
    
    if (index >= 0 && index < state.formData.repuestos.length) {
        state.formData.repuestos.splice(index, 1);
        renderManagementView();
    }
}

/**
 * Recolecta los valores de repuestos desde el formulario DOM
 */
function collectRepuestosFromForm() {
    const container = getContainerElement();
    if (!container) return [];
    
    const rows = container.querySelectorAll('#remitos-gestion-repuestos-body tr[data-repuesto-index]');
    const repuestos = [];
    
    rows.forEach((row) => {
        const codigo = row.querySelector('input[data-repuesto-field="codigo"]')?.value || '';
        const descripcion = row.querySelector('input[data-repuesto-field="descripcion"]')?.value || '';
        const cantidad = row.querySelector('input[data-repuesto-field="cantidad"]')?.value || '1';
        
        repuestos.push({ codigo, descripcion, cantidad });
    });
    
    state.formData.repuestos = repuestos;
    return repuestos;
}

/**
 * Descarga el PDF guardado del remito.
 * Si no hay PDF guardado (remitos antiguos), muestra un mensaje informativo.
 */
async function handleDescargarPdfRemito(index) {
    if (!Array.isArray(state.remitos) || index < 0 || index >= state.remitos.length) {
        return;
    }

    const remito = state.remitos[index];
    if (!remito) {
        return;
    }

    // Solo intentar descargar si hay PDF guardado (Snapshot Inmutable)
    if (remito.pdf_path) {
        try {
            const obtenerUrlPdfRemito = dependencies.obtenerUrlPdfRemito;
            if (typeof obtenerUrlPdfRemito === 'function') {
                const url = await obtenerUrlPdfRemito(remito.pdf_path);
                if (url) {
                    // Abrir el PDF guardado directamente
                    window.open(url, '_blank');
                    return;
                }
            }
        } catch (error) {
            console.warn('Error obteniendo URL del PDF guardado:', error);
            setFeedback('error', 'No se pudo obtener el PDF. Intentá nuevamente.');
            renderManagementView();
            return;
        }
    }

    // Si no hay PDF guardado, mostrar mensaje informativo
    // Los remitos nuevos siempre tendrán PDF guardado
    setFeedback('warning', `El remito ${remito.numeroRemito || ''} no tiene PDF guardado. Solo los remitos generados a partir de ahora tendrán PDF disponible.`);
    renderManagementView();
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
            driveId: '',
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

    const container = getContainerElement();
    if (!container) {
        return;
    }

    closeAllPhotoMenus();
    const selector = `[data-remito-photo-input="${action}"][data-remito-photo-index="${normalizedIndex}"]`;
    const input = container.querySelector(selector);
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
    const target = event?.target;
    
    // Búsqueda inteligente de cliente
    if (target && target.id === 'remito-form-cliente') {
        const searchText = (target.value || '').toLowerCase().trim();
        const dropdown = document.getElementById('remito-form-cliente-dropdown');
        
        if (!dropdown) {
            handleFormInput(event);
            return;
        }
        
        // Si el texto está vacío o muy corto, ocultar dropdown
        if (searchText.length < 2) {
            dropdown.classList.add('hidden');
            dropdown.innerHTML = '';
            // Si se borró el texto, limpiar selección
            if (searchText.length === 0 && state.selectedClienteKey) {
                state.selectedClienteKey = '';
                state.equiposCliente = [];
                state.selectedEquipoId = '';
            }
            handleFormInput(event);
            return;
        }
        
        // Filtrar clientes
        const filtered = (state.clienteOptions || [])
            .filter(option => {
                const label = (option.label || option.nombre || '').toLowerCase();
                return label.includes(searchText);
            })
            .slice(0, 5); // Limitar a 5 resultados
        
        if (filtered.length === 0) {
            dropdown.innerHTML = '<div class="px-4 py-3 text-sm text-gray-500">No se encontraron clientes</div>';
            dropdown.classList.remove('hidden');
        } else {
            dropdown.innerHTML = filtered.map(option => `
                <div class="remito-cliente-option px-4 py-2.5 cursor-pointer hover:bg-blue-50 transition-colors text-sm border-b border-gray-100 last:border-b-0" 
                     data-cliente-key="${option.key}">
                    <div class="font-medium text-gray-800">${escapeHtml(option.label || option.nombre)}</div>
                    ${option.direccion ? `<div class="text-xs text-gray-500 mt-0.5">${escapeHtml(option.direccion)}</div>` : ''}
                </div>
            `).join('');
            dropdown.classList.remove('hidden');
        }
        
        handleFormInput(event);
        return;
    }
    
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
    
    if (target.id === 'remito-form-equipo-select') {
        const value = typeof target.value === 'string' ? target.value : '';
        applyEquipoSelection(value);
        renderManagementView();
        return;
    }

    handleFormInput(event);
}

async function handleFormSubmit() {
    if (state.isSaving || state.isLoading) {
        return;
    }

    // Recolectar repuestos del formulario antes de validar
    collectRepuestosFromForm();

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
            const nuevoNumero = sanitizeString(response?.NumeroRemito || response?.numeroRemito || response?.data?.NumeroRemito || response?.data?.numeroRemito);
            setFeedback(
                'success',
                nuevoNumero
                    ? `El remito ${nuevoNumero} se creó correctamente.`
                    : 'El remito se creó correctamente.',
            );

            // Generar y guardar PDF para remitos creados manualmente
            try {
                const remitoId = sanitizeString(response?.data?.id || response?.id);
                if (remitoId) {
                    const reporteData = requestPayload?.reporteData || {};
                    const printableReport = { ...reporteData, NumeroRemito: nuevoNumero };
                    const photoSlots = normalizePhotoSlots(state.formData?.fotos || []);

                    const printableData = buildPrintableRemitoData(printableReport, {
                        observaciones: sanitizeString(payload?.observaciones || state.formData?.observaciones || ''),
                        repuestos: Array.isArray(state.formData?.repuestos) ? state.formData.repuestos : [],
                        photoSlots,
                    });

                    const html = createRemitoPrintHtml(printableData);
                    if (html) {
                        const blob = await generatePdfBlob(html);
                        if (blob) {
                            await dependencies.guardarPdfRemito(remitoId, blob, nuevoNumero);
                        }
                    }
                }
            } catch (pdfErr) {
                console.warn('No se pudo generar/guardar el PDF del remito manual:', pdfErr);
            }
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
    // Verificar si el click es en un trigger de foto PRIMERO
    const photoTrigger = event.target.closest('[data-remito-photo-trigger]');
    if (photoTrigger) {
        event.preventDefault();
        event.stopPropagation();
        togglePhotoMenu(photoTrigger.dataset.remitoPhotoIndex);
        return;
    }

    // Si el click no está dentro del menú ni en el trigger, cerrar menús
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
    
    // Selección de cliente desde dropdown
    const clienteOption = event.target.closest('.remito-cliente-option');
    if (clienteOption) {
        event.preventDefault();
        const key = clienteOption.dataset.clienteKey;
        if (key) {
            void applyClienteSelection(key);
            // Ocultar dropdown
            const dropdown = document.getElementById('remito-form-cliente-dropdown');
            if (dropdown) {
                dropdown.classList.add('hidden');
                dropdown.innerHTML = '';
            }
        }
        return;
    }
    
    // Botón limpiar cliente
    if (event.target.id === 'remito-form-cliente-clear' || event.target.closest('#remito-form-cliente-clear')) {
        event.preventDefault();
        void applyClienteSelection('');
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
        return;
    }

    const pdfButton = event.target.closest('[data-remito-pdf]');
    if (pdfButton) {
        event.preventDefault();
        const index = Number.parseInt(pdfButton.dataset.remitoPdf, 10);
        if (Number.isFinite(index)) {
            handleDescargarPdfRemito(index);
        }
        return;
    }
    
    // Agregar repuesto
    if (event.target.id === 'remitos-gestion-agregar-repuesto' || event.target.closest('#remitos-gestion-agregar-repuesto')) {
        event.preventDefault();
        handleAgregarRepuesto();
        return;
    }
    
    // Eliminar repuesto
    const removeRepuestoBtn = event.target.closest('[data-repuesto-remove]');
    if (removeRepuestoBtn) {
        event.preventDefault();
        const index = Number.parseInt(removeRepuestoBtn.dataset.repuestoRemove, 10);
        if (Number.isFinite(index)) {
            handleRemoveRepuesto(index);
        }
        return;
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
