import { COMPONENT_STAGES } from '../mantenimiento/templates.js';
import { crearRemito } from '../../api.js';

const MAX_REMITO_PHOTOS = 4;
const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const DRIVE_DIRECT_URL_BASE = 'https://drive.google.com/uc?export=view&id=';

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

function buildDriveDirectUrl(fileId) {
    const id = normalizeString(fileId);
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
    const text = normalizeString(value);
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

function clonePhotoSlots(slots = []) {
    return Array.from({ length: MAX_REMITO_PHOTOS }, (_, index) => {
        const slot = Array.isArray(slots) ? slots[index] : undefined;
        if (!slot || typeof slot !== 'object') {
            return createEmptyPhotoSlot(index);
        }

        return {
            index: Number.isFinite(Number(slot.index)) ? Number(slot.index) : index,
            previewUrl: typeof slot.previewUrl === 'string' ? slot.previewUrl : '',
            base64Data: typeof slot.base64Data === 'string' ? slot.base64Data : '',
            mimeType: typeof slot.mimeType === 'string' ? slot.mimeType : '',
            fileName: typeof slot.fileName === 'string' ? slot.fileName : '',
            url: typeof slot.url === 'string' ? slot.url : '',
            driveId: typeof slot.driveId === 'string' ? slot.driveId : '',
            shouldRemove: Boolean(slot.shouldRemove),
        };
    });
}

function getPhotoPreviewSource(slot) {
    if (!slot || typeof slot !== 'object') {
        return '';
    }

    const previewUrl = normalizeString(slot.previewUrl);
    if (previewUrl) {
        return previewUrl;
    }

    const driveId = normalizeString(slot.driveId || slot.driveFileId || slot.id);
    if (driveId) {
        return buildDriveDirectUrl(driveId);
    }

    const url = normalizeString(slot.url);
    const derivedId = extractDriveFileId(url);
    if (derivedId) {
        return buildDriveDirectUrl(derivedId);
    }

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

    const driveId = normalizeString(slot.driveId || slot.driveFileId || slot.id);
    if (driveId) {
        return `Foto en Drive (${driveId.slice(0, 8)}...)`;
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

function getRemitoLogoUrl() {
    if (typeof window === 'undefined') {
        return '';
    }

    const candidates = [];
    const pushCandidate = value => {
        const normalized = normalizeString(value);
        if (normalized && !candidates.includes(normalized)) {
            candidates.push(normalized);
        }
    };

    try {
        const baseElementHref = window.document?.querySelector?.('base[href]')?.href;
        if (baseElementHref) {
            pushCandidate(new URL('OHM-agua.png', baseElementHref).href);
        }
    } catch (error) {
        console.warn('No se pudo determinar la URL del logo del remito desde la etiqueta <base>.', error);
    }

    try {
        const locationHref = window.location?.href;
        if (locationHref) {
            pushCandidate(new URL('OHM-agua.png', locationHref).href);
        }
    } catch (error) {
        console.warn('No se pudo determinar la URL del logo del remito desde la ubicación actual.', error);
    }

    try {
        const locationOrigin = window.location?.origin;
        if (locationOrigin) {
            pushCandidate(new URL('OHM-agua.png', locationOrigin).href);
        }
    } catch (error) {
        console.warn('No se pudo determinar la URL del logo del remito desde el origen actual.', error);
    }

    pushCandidate('/OHM-agua.png');

    return candidates.find(Boolean) || '';
}

function buildPrintableRepuestosList(repuestos, report) {
    if (Array.isArray(repuestos) && repuestos.length > 0) {
        return repuestos;
    }

    if (Array.isArray(report?.repuestos) && report.repuestos.length > 0) {
        return report.repuestos;
    }

    return buildComponentesFromReport(report);
}

function buildPrintablePhotos(photoSlots = []) {
    if (!Array.isArray(photoSlots) || photoSlots.length === 0) {
        return [];
    }

    return photoSlots
        .map((slot, index) => {
            if (!slot || typeof slot !== 'object') {
                return null;
            }

            const previewSource = normalizeString(getPhotoPreviewSource(slot));
            let photoSource = previewSource;

            if (!photoSource) {
                const base64Data = normalizeString(slot.base64Data);
                const mimeType = normalizeString(slot.mimeType) || 'image/jpeg';
                if (base64Data) {
                    photoSource = `data:${mimeType};base64,${base64Data}`;
                }
            }

            if (!photoSource) {
                return null;
            }

            const label = normalizeString(formatPhotoFileLabel(slot)) || `Foto ${index + 1}`;

            return {
                src: photoSource,
                label,
            };
        })
        .filter(Boolean);
}

function buildPrintableRemitoData(report, { observaciones = '', repuestos = [], photoSlots = [] } = {}) {
    if (!report || typeof report !== 'object') {
        return null;
    }

    const numero = resolveReportValue(report, ['NumeroRemito', 'numero_remito', 'remitoNumero', 'numero_reporte']);
    const fecha = formatDateValue(resolveReportValue(report, ['fecha_display', 'fecha']));

    const cliente = {
        nombre: resolveReportValue(report, ['clienteNombre', 'cliente_nombre', 'cliente']),
        direccion: resolveReportValue(report, ['direccion', 'cliente_direccion', 'ubicacion']),
        telefono: resolveReportValue(report, ['cliente_telefono', 'telefono_cliente', 'telefono']),
        email: resolveReportValue(report, ['cliente_email', 'email']),
        cuit: resolveReportValue(report, ['cliente_cuit', 'cuit']),
    };

    const equipo = {
        descripcion: resolveReportValue(report, ['equipo', 'modelo', 'descripcion_equipo']),
        modelo: resolveReportValue(report, ['modelo', 'modelo_equipo']),
        serie: resolveReportValue(report, ['n_serie', 'numero_serie']),
        interno: resolveReportValue(report, ['id_interna', 'codigo_interno']),
        ubicacion: resolveReportValue(report, ['ubicacion', 'direccion', 'cliente_direccion']),
        tecnico: resolveReportValue(report, ['tecnico', 'tecnico_asignado']),
    };

    const repuestosFuente = buildPrintableRepuestosList(repuestos, report);
    const repuestosNormalizados = Array.isArray(repuestosFuente)
        ? repuestosFuente
              .map(item => normalizeRepuestoItem(item))
              .map(item => ({
                  codigo: normalizeString(item.codigo),
                  descripcion: normalizeString(item.descripcion),
                  cantidad: normalizeString(item.cantidad),
              }))
              .filter(item => hasContent(item.codigo) || hasContent(item.descripcion) || hasContent(item.cantidad))
        : [];

    const observacionesTexto = normalizeString(observaciones || report.observaciones || report.resumen || '');
    const fotos = buildPrintablePhotos(photoSlots);

    return {
        numero: normalizeString(numero),
        fecha: normalizeString(fecha),
        cliente,
        equipo,
        repuestos: repuestosNormalizados,
        observaciones: observacionesTexto,
        fotos,
    };
}

function buildInfoTableRows(entries = []) {
    return entries
        .map(entry => {
            const label = escapeHtml(entry?.label || '');
            const value = escapeHtml(normalizeString(entry?.value || ''));
            return `
                <tr>
                    <th scope="row">${label}</th>
                    <td>${value || '<span class="placeholder">—</span>'}</td>
                </tr>
            `;
        })
        .join('');
}

function buildRepuestosTableRows(repuestos = []) {
    if (!Array.isArray(repuestos) || repuestos.length === 0) {
        return `
            <tr class="empty-row">
                <td colspan="4">Sin repuestos registrados.</td>
            </tr>
        `;
    }

    return repuestos
        .map((item, index) => {
            const posicion = escapeHtml(String(index + 1));
            const codigo = escapeHtml(item.codigo);
            const descripcion = escapeHtml(item.descripcion);
            const cantidad = escapeHtml(item.cantidad);

            return `
                <tr>
                    <td class="index">${posicion}</td>
                    <td>${codigo || '<span class="placeholder">—</span>'}</td>
                    <td>${descripcion || '<span class="placeholder">—</span>'}</td>
                    <td class="cantidad">${cantidad || '<span class="placeholder">—</span>'}</td>
                </tr>
            `;
        })
        .join('');
}

function buildPhotosSection(fotos = []) {
    if (!Array.isArray(fotos) || fotos.length === 0) {
        return '<p class="placeholder">Sin fotos adjuntas para este remito.</p>';
    }

    return `
        <div class="photo-grid">
            ${fotos
                .map((foto, index) => {
                    const labelValue = normalizeString(foto?.label) || `Foto ${index + 1}`;
                    const sanitizedLabel = escapeHtml(labelValue);
                    const sourceValue = normalizeString(foto?.src);
                    if (!sourceValue) {
                        return '';
                    }

                    const sanitizedSource = escapeHtml(sourceValue);
                    const altText = escapeHtml(`Registro fotográfico ${labelValue}`);
                    return `
                        <figure class="photo-item">
                            <div class="photo-item__frame">
                                <img src="${sanitizedSource}" alt="${altText}" loading="lazy">
                            </div>
                            <figcaption>${sanitizedLabel}</figcaption>
                        </figure>
                    `;
                })
                .join('')}
        </div>
    `;
}

function createRemitoPrintHtml(data) {
    if (!data) {
        return '';
    }

    const numero = escapeHtml(data.numero || '—');
    const fecha = escapeHtml(data.fecha || '—');
    const logoUrl = escapeHtml(getRemitoLogoUrl());
    const observaciones = data.observaciones
        ? escapeHtml(data.observaciones).replace(/\r?\n/g, '<br>')
        : '<span class="placeholder">Sin observaciones registradas.</span>';

    const clienteRows = buildInfoTableRows([
        { label: 'Razón social', value: data.cliente?.nombre },
        { label: 'Dirección', value: data.cliente?.direccion },
        { label: 'Teléfono', value: data.cliente?.telefono },
        { label: 'Email', value: data.cliente?.email },
        { label: 'CUIT', value: data.cliente?.cuit },
    ]);

    const equipoRows = buildInfoTableRows([
        { label: 'Descripción', value: data.equipo?.descripcion },
        { label: 'Modelo', value: data.equipo?.modelo },
        { label: 'N° de serie', value: data.equipo?.serie },
        { label: 'Activo / ID interno', value: data.equipo?.interno },
        { label: 'Ubicación', value: data.equipo?.ubicacion },
        { label: 'Técnico responsable', value: data.equipo?.tecnico },
    ]);

    const repuestosRows = buildRepuestosTableRows(data.repuestos);
    const fotosSection = buildPhotosSection(data.fotos);

    return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>Remito ${numero}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        :root {
            color-scheme: only light;
        }

        @page {
            size: A4;
            margin: 1.5cm;
        }

        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            font-size: 12px;
            line-height: 1.5;
            color: #111827;
            background: #f3f4f6;
        }

        .document {
            background: #ffffff;
            padding: 28px;
            border-radius: 12px;
            box-shadow: 0 10px 25px rgba(15, 23, 42, 0.08);
        }

        .document__header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 16px;
            border-bottom: 2px solid #2563eb;
            padding-bottom: 18px;
            margin-bottom: 24px;
        }

        .document__identity {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .document__title {
            font-size: 22px;
            font-weight: 700;
            color: #1f2937;
            margin: 0;
        }

        .document__meta {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            color: #374151;
            font-weight: 600;
        }

        .document__logo {
            flex: none;
            max-width: 140px;
        }

        .document__logo img {
            width: 100%;
            height: auto;
            display: block;
        }

        .section {
            margin-bottom: 24px;
        }

        .section__title {
            font-size: 15px;
            font-weight: 700;
            margin: 0 0 12px;
            color: #1f2937;
            text-transform: uppercase;
            letter-spacing: 0.04em;
        }

        .info-table,
        .repuestos-table {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid #d1d5db;
            border-radius: 8px;
            overflow: hidden;
        }

        .info-table th,
        .info-table td {
            text-align: left;
            padding: 8px 10px;
            border-bottom: 1px solid #e5e7eb;
            vertical-align: top;
        }

        .info-table th {
            width: 32%;
            font-weight: 600;
            background: #f9fafb;
            color: #1f2937;
        }

        .info-table tr:last-child th,
        .info-table tr:last-child td {
            border-bottom: none;
        }

        .repuestos-table thead {
            background: #2563eb;
            color: #ffffff;
        }

        .repuestos-table th,
        .repuestos-table td {
            padding: 10px;
            border-bottom: 1px solid #e5e7eb;
        }

        .repuestos-table th {
            text-transform: uppercase;
            font-size: 11px;
            letter-spacing: 0.05em;
        }

        .repuestos-table td.index {
            width: 48px;
            font-weight: 600;
            text-align: center;
        }

        .repuestos-table td.cantidad {
            text-align: right;
            width: 80px;
            font-weight: 600;
        }

        .repuestos-table tr:last-child td {
            border-bottom: none;
        }

        .placeholder {
            color: #9ca3af;
            font-style: italic;
        }

        .observaciones {
            padding: 16px;
            border: 1px solid #d1d5db;
            border-radius: 10px;
            background: #f9fafb;
            min-height: 90px;
            white-space: pre-line;
        }

        .photo-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
            gap: 16px;
        }

        .photo-item {
            margin: 0;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .photo-item__frame {
            position: relative;
            overflow: hidden;
            border-radius: 12px;
            border: 1px solid #e5e7eb;
            background: #111827;
            aspect-ratio: 3 / 2;
        }

        .photo-item__frame img {
            width: 100%;
            height: 100%;
            object-fit: contain;
            background: #111827;
        }

        .photo-item figcaption {
            font-size: 11px;
            color: #4b5563;
            text-align: center;
        }

        .document__footer {
            margin-top: 32px;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 24px;
        }

        .firma {
            border-top: 1px solid #9ca3af;
            padding-top: 12px;
            text-align: center;
            color: #6b7280;
        }

        @media print {
            body {
                background: #ffffff;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }

            .document {
                box-shadow: none;
            }

            .document__header {
                margin-bottom: 18px;
            }

            .section {
                page-break-inside: avoid;
            }

            .photo-item {
                page-break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    <div class="document">
        <header class="document__header">
            <div class="document__identity">
                <p class="document__title">Remito de servicio</p>
                <div class="document__meta">
                    <span>Número: <strong>${numero}</strong></span>
                    <span>Fecha: <strong>${fecha}</strong></span>
                </div>
            </div>
            <div class="document__logo">
                <img src="${logoUrl}" alt="Logo de OHM Agua">
            </div>
        </header>

        <section class="section">
            <h2 class="section__title">Datos del cliente</h2>
            <table class="info-table">
                <tbody>
                    ${clienteRows}
                </tbody>
            </table>
        </section>

        <section class="section">
            <h2 class="section__title">Datos del equipo</h2>
            <table class="info-table">
                <tbody>
                    ${equipoRows}
                </tbody>
            </table>
        </section>

        <section class="section">
            <h2 class="section__title">Repuestos y materiales</h2>
            <table class="repuestos-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Código</th>
                        <th>Descripción</th>
                        <th>Cantidad</th>
                    </tr>
                </thead>
                <tbody>
                    ${repuestosRows}
                </tbody>
            </table>
        </section>

        <section class="section">
            <h2 class="section__title">Observaciones</h2>
            <div class="observaciones">${observaciones}</div>
        </section>

        <section class="section">
            <h2 class="section__title">Registro fotográfico</h2>
            ${fotosSection}
        </section>

        <footer class="document__footer">
            <div class="firma">
                <p>Firma del responsable de OHM Agua</p>
            </div>
            <div class="firma">
                <p>Firma y aclaración del cliente</p>
            </div>
        </footer>
    </div>
    <script>
        window.addEventListener('load', () => {
            window.focus();
            setTimeout(() => {
                try {
                    window.print();
                } catch (error) {
                    console.error('No se pudo iniciar la impresión automática.', error);
                }
            }, 150);
        });

        window.addEventListener('afterprint', () => {
            setTimeout(() => {
                window.close();
            }, 250);
        });
    </script>
</body>
</html>`;
}

function openRemitoPrintPreview(report, options = {}) {
    if (typeof window === 'undefined') {
        return false;
    }

    const printableData = buildPrintableRemitoData(report, options);
    if (!printableData) {
        return false;
    }

    const html = createRemitoPrintHtml(printableData);
    if (!html) {
        return false;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        return false;
    }

    try {
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.opener = null;
        return true;
    } catch (error) {
        console.error('No se pudo abrir la vista de impresión del remito.', error);
        return false;
    }
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

function transformAblandadorToRemitoFormat(ablandadorData) {
    // Convertir estructura de ablandador a formato que el backend espera para remitos
    const transformed = {
        metadata: ablandadorData.metadata || {},
        numero_reporte: ablandadorData.metadata?.numero_reporte || '',
        NumeroRemito: '', // Se asignará al finalizar
        fecha_display: ablandadorData.seccion_A_cliente?.fecha_servicio || '',
        fecha: ablandadorData.seccion_A_cliente?.fecha_servicio || '',
        
        // Cliente
        clienteNombre: ablandadorData.seccion_A_cliente?.nombre || '',
        cliente_nombre: ablandadorData.seccion_A_cliente?.nombre || '',
        direccion: ablandadorData.seccion_A_cliente?.direccion || '',
        cliente_direccion: ablandadorData.seccion_A_cliente?.direccion || '',
        cliente_telefono: ablandadorData.seccion_A_cliente?.telefono || '',
        telefono: ablandadorData.seccion_A_cliente?.telefono || '',
        cliente_email: ablandadorData.seccion_A_cliente?.email || '',
        email: ablandadorData.seccion_A_cliente?.email || '',
        cliente_cuit: ablandadorData.seccion_A_cliente?.cuit || '',
        cuit: ablandadorData.seccion_A_cliente?.cuit || '',
        
        // Equipo
        equipo: ablandadorData.seccion_B_equipo?.tipo || 'Ablandador',
        modelo: ablandadorData.seccion_B_equipo?.modelo || '',
        modelo_equipo: ablandadorData.seccion_B_equipo?.modelo || '',
        n_serie: ablandadorData.seccion_B_equipo?.numero_serie || '',
        numero_serie: ablandadorData.seccion_B_equipo?.numero_serie || '',
        id_interna: 'N/A', // No aplica para ablandadores
        codigo_interno: 'N/A',
        ubicacion: ablandadorData.seccion_B_equipo?.ubicacion || '',
        tecnico: ablandadorData.seccion_A_cliente?.tecnico || '',
        tecnico_asignado: ablandadorData.seccion_A_cliente?.tecnico || '',
        
        // Observaciones
        observaciones: ablandadorData.seccion_E_resumen?.trabajo_realizado || '',
        resumen: ablandadorData.seccion_E_resumen?.trabajo_realizado || '',
        
        // Componentes/Repuestos - se construirán según cambio de filtro
        componentes: [],
        repuestos: []
    };
    
    // Construir repuestos según si se cambió el filtro
    if (ablandadorData.seccion_D_checklist?.cambio_filtro_realizado) {
        const tipoFiltro = ablandadorData.seccion_D_checklist?.filtro_tipo_instalado || 'Prefiltro';
        const loteFiltro = ablandadorData.seccion_D_checklist?.filtro_lote_serie || '';
        const repuesto = {
            codigo: '',
            descripcion: loteFiltro ? `${tipoFiltro} - Lote: ${loteFiltro}` : tipoFiltro,
            cantidad: 1
        };
        transformed.repuestos.push(repuesto);
    } else {
        // Sin cambios
        transformed.repuestos.push({
            codigo: '',
            descripcion: 'N/A - Consumibles',
            cantidad: 0
        });
    }
    
    // Conservar las secciones originales para que el flujo del remito pueda
    // reutilizar la misma lógica que con ósmosis (por ejemplo, para completar
    // el formulario en pantalla). Sin estas secciones, `populateRemitoForm`
    // no encuentra los datos y deja los campos vacíos.
    return {
        ...transformed,
        seccion_A_cliente: ablandadorData.seccion_A_cliente || null,
        seccion_B_equipo: ablandadorData.seccion_B_equipo || null,
        seccion_C_parametros: ablandadorData.seccion_C_parametros || null,
        seccion_D_checklist: ablandadorData.seccion_D_checklist || null,
        seccion_E_resumen: ablandadorData.seccion_E_resumen || null,
        seccion_F_condiciones: ablandadorData.seccion_F_condiciones || null,
        seccion_G_cierre: ablandadorData.seccion_G_cierre || null,
    };
}

function createReportSnapshot(rawData) {
    // Si es un reporte de ablandador, transformarlo primero
    if (rawData?.metadata?.formulario === 'mantenimiento_ablandador') {
        return transformAblandadorToRemitoFormat(rawData);
    }
    
    // Para ósmosis, usar lógica original
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

    // Detectar si es un reporte de ablandador
    const isAblandador = report.metadata?.formulario === 'mantenimiento_ablandador';

    let numeroRemito, fechaRemito, clienteNombre, direccion, telefono, email, cuit;
    let descripcionEquipo, modelo, numeroSerie, idInterna, ubicacion, tecnico;

    if (isAblandador) {
        // Mapear desde estructura de ablandador
        numeroRemito = report.metadata?.numero_reporte || '';
        fechaRemito = formatDateValue(report.seccion_A_cliente?.fecha_servicio);
        clienteNombre = report.seccion_A_cliente?.nombre || '';
        direccion = report.seccion_A_cliente?.direccion || '';
        telefono = report.seccion_A_cliente?.telefono || '';
        email = report.seccion_A_cliente?.email || '';
        cuit = report.seccion_A_cliente?.cuit || '';
        
        // Equipo
        const tipoEquipo = report.seccion_B_equipo?.tipo || 'Ablandador';
        modelo = report.seccion_B_equipo?.modelo || '';
        descripcionEquipo = modelo ? `${tipoEquipo} - ${modelo}` : tipoEquipo;
        numeroSerie = report.seccion_B_equipo?.numero_serie || '';
        idInterna = 'N/A'; // No aplica para ablandadores
        ubicacion = report.seccion_B_equipo?.ubicacion || '';
        tecnico = report.seccion_A_cliente?.tecnico || '';
    } else {
        // Mapear desde estructura de ósmosis inversa (original)
        numeroRemito = resolveReportValue(report, ['NumeroRemito', 'numero_remito', 'remitoNumero', 'numero_reporte']);
        fechaRemito = formatDateValue(resolveReportValue(report, ['fecha_display', 'fecha']));
        clienteNombre = resolveReportValue(report, ['clienteNombre', 'cliente_nombre', 'cliente']);
        direccion = resolveReportValue(report, ['direccion', 'cliente_direccion', 'ubicacion']);
        telefono = resolveReportValue(report, ['cliente_telefono', 'telefono_cliente', 'telefono']);
        email = resolveReportValue(report, ['cliente_email', 'email']);
        cuit = resolveReportValue(report, ['cliente_cuit', 'cuit']);
        descripcionEquipo = resolveReportValue(report, ['equipo', 'modelo', 'descripcion_equipo']);
        modelo = resolveReportValue(report, ['modelo', 'modelo_equipo']);
        numeroSerie = resolveReportValue(report, ['n_serie', 'numero_serie']);
        idInterna = resolveReportValue(report, ['id_interna', 'codigo_interno']);
        ubicacion = resolveReportValue(report, ['ubicacion', 'direccion', 'cliente_direccion']);
        tecnico = resolveReportValue(report, ['tecnico', 'tecnico_asignado']);
    }

    setReadonlyInputValue('remito-numero', numeroRemito);
    setReadonlyInputValue('remito-fecha', fechaRemito);
    setReadonlyInputValue('remito-cliente-nombre', clienteNombre);
    setReadonlyInputValue('remito-cliente-direccion', direccion);
    setReadonlyInputValue('remito-cliente-telefono', telefono);
    setReadonlyInputValue('remito-cliente-email', email);
    setReadonlyInputValue('remito-cliente-cuit', cuit);
    setReadonlyInputValue('remito-equipo-descripcion', descripcionEquipo);
    setReadonlyInputValue('remito-equipo-modelo', modelo);
    setReadonlyInputValue('remito-equipo-serie', numeroSerie);
    setReadonlyInputValue('remito-equipo-interno', idInterna);
    setReadonlyInputValue('remito-equipo-ubicacion', ubicacion);
    setReadonlyInputValue('remito-equipo-tecnico', tecnico);

    const observaciones = getElement('remito-observaciones');
    if (observaciones instanceof HTMLTextAreaElement) {
        let texto = '';
        if (isAblandador) {
            texto = normalizeString(report.seccion_E_resumen?.trabajo_realizado || '');
        } else {
            texto = normalizeString(report.observaciones || report.resumen || '');
        }
        observaciones.value = texto;
        observaciones.removeAttribute('readonly');
    }

    // Construir repuestos según el tipo de reporte
    let repuestos = [];
    
    if (isAblandador) {
        // Para ablandadores: solo prefiltro si se cambió
        if (report.seccion_D_checklist?.cambio_filtro_realizado) {
            const tipoFiltro = report.seccion_D_checklist?.filtro_tipo_instalado || 'Prefiltro';
            const loteFiltro = report.seccion_D_checklist?.filtro_lote_serie || '';
            repuestos.push({
                title: 'Prefiltro',
                detalles: loteFiltro ? `${tipoFiltro} - Lote: ${loteFiltro}` : tipoFiltro,
                accion: 'Cambio'
            });
        } else {
            // Si no se cambió filtro, agregar N/A
            repuestos.push({
                title: 'Consumibles',
                detalles: 'N/A',
                accion: 'Sin cambios'
            });
        }
    } else {
        // Para ósmosis: usar la lógica original
        const componentesDerivados = Array.isArray(report.componentes) && report.componentes.length > 0
            ? report.componentes
            : buildComponentesFromReport(report);

        repuestos = Array.isArray(report.repuestos) && report.repuestos.length > 0
            ? report.repuestos
            : componentesDerivados;
    }

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
    let lastPrintableSnapshot = null;

    function getPhotoContainer() {
        const container = getElement('remito-fotos-container');
        return container instanceof HTMLElement ? container : null;
    }

    function getPrintButton() {
        const button = getElement('imprimir-remito-btn');
        return button instanceof HTMLButtonElement ? button : null;
    }

    function setPrintButtonVisibility(visible) {
        const button = getPrintButton();
        if (!button) {
            return;
        }

        if (visible) {
            button.classList.remove('hidden');
            button.disabled = false;
        } else {
            button.classList.add('hidden');
            button.disabled = true;
        }
    }

    function buildPrintableSnapshot() {
        if (!lastSavedReport) {
            return null;
        }

        const reportClone = cloneReportData(lastSavedReport);
        const slotsClone = clonePhotoSlots(photoSlots);

        return {
            report: reportClone,
            photoSlots: slotsClone,
        };
    }

    function buildEmailStatusAlertMessage(status) {
        if (!status || typeof status !== 'object') {
            return '';
        }

        if (status.sent) {
            return '📧 Se envió el remito por correo electrónico correctamente.';
        }

        const errorMessage = typeof status.error === 'string' ? status.error.trim() : '';
        if (errorMessage) {
            return `⚠️ El remito se generó, pero no se pudo enviar el correo electrónico: ${errorMessage}`;
        }

        if (status.skipped) {
            const infoMessage = typeof status.message === 'string' ? status.message.trim() : '';
            return infoMessage
                ? `ℹ️ ${infoMessage}`
                : 'ℹ️ El envío de correo electrónico está deshabilitado.';
        }

        return '';
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
                    'group relative flex w-full items-center justify-center overflow-hidden rounded-xl border-2',
                    'min-h-[180px]',
                    hasPreview ? 'border-transparent bg-gray-900/5' : 'border-dashed border-gray-300 bg-gray-50',
                    'text-gray-400 transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
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
                    <div class="remito-photo-slot space-y-2" data-remito-photo-slot="${index}">
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
                driveId: '',
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
                driveFileId: normalizeString(slot.driveId),
            }))
            .filter(item => Boolean(item.base64Data) || Boolean(item.driveFileId));
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
        lastPrintableSnapshot = null;
        setPrintButtonVisibility(false);
    }

    function reset() {
        lastSavedReport = null;
        disableButton('generar-remito-btn');
        resetPhotoSlots();
        closeAllPhotoMenus();
        lastPrintableSnapshot = null;
        setPrintButtonVisibility(false);
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
        const observacionesTexto = observacionesElement instanceof HTMLTextAreaElement
            ? normalizeString(observacionesElement.value)
            : '';

        const repuestosEditados = collectRepuestosFromForm();
        lastSavedReport.repuestos = repuestosEditados;
        if (repuestosEditados.length > 0) {
            lastSavedReport.componentes = [];
        }
        lastSavedReport.observaciones = observacionesTexto;
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
            const requestBody = {
                reporteData: lastSavedReport,
                observaciones: observacionesTexto,
            };

            if (Array.isArray(fotosPayload) && fotosPayload.length > 0) {
                requestBody.fotos = fotosPayload;
            }

            const payload = await crearRemito(requestBody);

            if (!payload || typeof payload !== 'object') {
                throw new Error('Respuesta inválida del servidor.');
            }

            const remitoData = payload?.data || {};
            const emailStatus = remitoData?.emailStatus;
            const numeroRemito = normalizeString(remitoData?.NumeroRemito);
            if (numeroRemito) {
                lastSavedReport.NumeroRemito = numeroRemito;
                setReadonlyInputValue('remito-numero', numeroRemito);
            }

            lastPrintableSnapshot = buildPrintableSnapshot();
            setPrintButtonVisibility(Boolean(lastPrintableSnapshot));

            const printableReport = lastPrintableSnapshot?.report || lastSavedReport;
            const printablePhotoSlots = lastPrintableSnapshot?.photoSlots || clonePhotoSlots(photoSlots);
            const didOpenPrintPreview = openRemitoPrintPreview(printableReport, {
                observaciones: printableReport?.observaciones,
                repuestos: printableReport?.repuestos,
                photoSlots: printablePhotoSlots,
            });

            const alertMessages = [];
            if (didOpenPrintPreview) {
                alertMessages.push('✅ Remito generado correctamente. Se abrirá la vista de impresión para descargar o imprimir el PDF.');
            } else {
                alertMessages.push('✅ Remito generado correctamente. No pudimos abrir la vista de impresión automáticamente. Revisá el bloqueador de ventanas emergentes y utilizá el botón "Imprimir remito" para reintentarlo.');
            }

            const emailMessage = buildEmailStatusAlertMessage(emailStatus);
            if (emailMessage) {
                alertMessages.push(emailMessage);
            }

            if (alertMessages.length > 0) {
                window.alert?.(alertMessages.join('\n\n'));
            }
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
        setPrintButtonVisibility(Boolean(lastPrintableSnapshot));

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

        const imprimirBtn = getPrintButton();
        if (imprimirBtn) {
            imprimirBtn.addEventListener('click', event => {
                event.preventDefault();
                if (!lastPrintableSnapshot) {
                    window.alert?.('Generá y guardá un remito antes de intentar imprimirlo.');
                    return;
                }

                const printableReport = lastPrintableSnapshot.report;
                const printablePhotoSlots = lastPrintableSnapshot.photoSlots || [];
                const didOpen = openRemitoPrintPreview(printableReport, {
                    observaciones: printableReport?.observaciones,
                    repuestos: printableReport?.repuestos,
                    photoSlots: printablePhotoSlots,
                });

                if (!didOpen) {
                    window.alert?.('No pudimos abrir la vista de impresión. Revisá el bloqueador de ventanas emergentes e intentá nuevamente.');
                }
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
