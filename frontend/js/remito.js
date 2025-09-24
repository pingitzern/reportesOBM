import { normalizeDateToISO } from './forms.js';
import { COMPONENT_STAGES } from './templates.js';

const TEXT_PLACEHOLDER = '---';
const DATE_PLACEHOLDER = '--/--/----';
const NO_PARTS_MESSAGE = 'No se registraron repuestos cambiados en este mantenimiento.';
const TABLE_CODE_PLACEHOLDER = '—';

const DEFAULT_CONTEXT = Object.freeze({
    clienteNombre: '',
    clienteDireccion: '',
    clienteTelefono: '',
    clienteEmail: '',
    clienteCuit: '',
});

let storedReport = null;
let storedContext = { ...DEFAULT_CONTEXT };

function normalizeText(value) {
    if (value === null || value === undefined) {
        return '';
    }

    if (typeof value === 'string') {
        return value.trim();
    }

    return String(value).trim();
}

function sanitizeContext(context = {}) {
    const cleanContext = { ...DEFAULT_CONTEXT };

    if (!context || typeof context !== 'object') {
        return cleanContext;
    }

    Object.keys(cleanContext).forEach(key => {
        if (Object.prototype.hasOwnProperty.call(context, key)) {
            cleanContext[key] = normalizeText(context[key]);
        }
    });

    return cleanContext;
}

function formatDateForDisplay(value) {
    const isoDate = normalizeDateToISO(value);
    if (!isoDate) {
        return '';
    }

    const [year, month, day] = isoDate.split('-');
    if (!year || !month || !day) {
        return '';
    }

    const paddedDay = day.padStart(2, '0');
    const paddedMonth = month.padStart(2, '0');
    return `${paddedDay}/${paddedMonth}/${year}`;
}

function setTextContent(elementId, value, { placeholder = TEXT_PLACEHOLDER } = {}) {
    if (typeof document === 'undefined') {
        return;
    }

    const element = document.getElementById(elementId);
    if (!element) {
        return;
    }

    const normalized = normalizeText(value);
    element.textContent = normalized || placeholder;
}

function setObservacionesValue(report) {
    if (typeof document === 'undefined') {
        return;
    }

    const textarea = document.getElementById('remito-observaciones');
    if (!(textarea instanceof HTMLTextAreaElement)) {
        return;
    }

    const resumen = normalizeText(report?.resumen);
    textarea.value = resumen;

    if (resumen) {
        textarea.readOnly = true;
        textarea.setAttribute('readonly', 'readonly');
    } else {
        textarea.readOnly = false;
        textarea.removeAttribute('readonly');
    }
}

function extractCodeAndDescription(detail) {
    const normalized = normalizeText(detail);
    if (!normalized) {
        return {
            code: '',
            description: '',
        };
    }

    const separators = [' - ', '-', ':', '|'];
    for (const separator of separators) {
        const index = normalized.indexOf(separator);
        if (index > 0) {
            const code = normalizeText(normalized.slice(0, index));
            const description = normalizeText(normalized.slice(index + separator.length));
            if (code && description) {
                return { code, description };
            }
        }
    }

    return {
        code: '',
        description: normalized,
    };
}

function renderRepuestos(report) {
    if (typeof document === 'undefined') {
        return;
    }

    const tableBody = document.getElementById('remito-repuestos');
    if (!tableBody) {
        return;
    }

    tableBody.innerHTML = '';

    if (!report || typeof report !== 'object') {
        return;
    }

    let rowsRendered = 0;

    COMPONENT_STAGES.forEach(stage => {
        const actionKey = `${stage.id}_accion`;
        const detailsKey = `${stage.id}_detalles`;
        const action = normalizeText(report[actionKey]).toLowerCase();

        if (action !== 'cambiado') {
            return;
        }

        const { code, description } = extractCodeAndDescription(report[detailsKey]);

        const row = document.createElement('tr');

        const codeCell = document.createElement('td');
        codeCell.className = 'px-4 py-2 text-sm text-gray-700 whitespace-nowrap';
        codeCell.textContent = code || TABLE_CODE_PLACEHOLDER;

        const descriptionCell = document.createElement('td');
        descriptionCell.className = 'px-4 py-2 text-sm text-gray-700';
        descriptionCell.textContent = description || stage.title;

        const quantityCell = document.createElement('td');
        quantityCell.className = 'px-4 py-2 text-sm text-right text-gray-700';
        quantityCell.textContent = '1';

        row.append(codeCell, descriptionCell, quantityCell);
        tableBody.appendChild(row);
        rowsRendered += 1;
    });

    if (rowsRendered === 0) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 3;
        cell.className = 'px-4 py-3 text-sm text-gray-500 text-center';
        cell.textContent = NO_PARTS_MESSAGE;
        row.appendChild(cell);
        tableBody.appendChild(row);
    }
}

function populateRemito(report, context = DEFAULT_CONTEXT) {
    if (!report || typeof report !== 'object') {
        return;
    }

    const sanitizedContext = sanitizeContext(context);

    setTextContent('remito-numero', report.numero_reporte);

    const displayDate = formatDateForDisplay(report.fecha);
    setTextContent('remito-fecha', displayDate, { placeholder: DATE_PLACEHOLDER });

    const clienteNombre = sanitizedContext.clienteNombre || report.cliente;
    setTextContent('remito-cliente', clienteNombre);

    const clienteDireccion = sanitizedContext.clienteDireccion || report.direccion;
    setTextContent('remito-cliente-direccion', clienteDireccion);

    setTextContent('remito-cliente-telefono', sanitizedContext.clienteTelefono);
    setTextContent('remito-cliente-email', sanitizedContext.clienteEmail);
    setTextContent('remito-cliente-cuit', sanitizedContext.clienteCuit);

    const modelo = report.modelo;
    setTextContent('remito-equipo', modelo);
    setTextContent('remito-equipo-modelo', modelo);
    setTextContent('remito-equipo-serie', report.n_serie);
    setTextContent('remito-equipo-interno', report.id_interna);

    const ubicacion = sanitizedContext.clienteDireccion || report.direccion;
    setTextContent('remito-equipo-ubicacion', ubicacion);
    setTextContent('remito-equipo-tecnico', report.tecnico);

    setObservacionesValue(report);
    renderRepuestos(report);
}

export function storeLastSavedReport(report, context = {}) {
    if (!report || typeof report !== 'object') {
        storedReport = null;
        storedContext = { ...DEFAULT_CONTEXT };
        return;
    }

    try {
        storedReport = JSON.parse(JSON.stringify(report));
    } catch (error) {
        storedReport = { ...report };
    }

    storedContext = sanitizeContext(context);
}

export function renderRemitoFromStored() {
    if (typeof document === 'undefined') {
        return false;
    }

    if (!storedReport) {
        return false;
    }

    populateRemito(storedReport, storedContext);
    return true;
}

export const __testables__ = {
    formatDateForDisplay,
    extractCodeAndDescription,
    sanitizeContext,
    populateRemito,
    setObservacionesValue,
    getStoredReport: () => storedReport,
    getStoredContext: () => ({ ...storedContext }),
};
