import * as config from '../../config.js';
import { getCurrentUserName } from '../login/auth.js';
import { getEquiposByCliente } from '../admin/sistemasEquipos.js';
const { LMIN_TO_GPD = (60 * 24) / 3.78541, LMIN_TO_LPH = 60 } = config;
import { COMPONENT_STAGES, resetComponentStages } from './templates.js';

function getElement(id) {
	return document.getElementById(id);
}

const CLIENT_OPTION_ATTRIBUTE = 'data-cliente-option';
const CLIENT_NAME_FIELDS = Object.freeze([
	'nombre',
	'Nombre',
	'cliente',
	'Cliente',
	'razon_social',
	'RazonSocial',
]);
const CLIENT_ID_FIELDS = Object.freeze([
	'id',
	'ID',
	'id_cliente',
	'IdCliente',
	'codigo',
	'Codigo',
	'cuit',
	'CUIT',
]);
const CLIENT_FIELD_ALIASES = Object.freeze({
	direccion: ['direccion', 'Direccion', 'domicilio', 'Domicilio'],
	telefono: ['telefono', 'Telefono', 'tel', 'Tel'],
	email: ['email', 'Email', 'mail', 'Mail', 'correo', 'Correo'],
	cuit: ['cuit', 'CUIT'],
});

const CLIENT_DETAIL_FIELD_IDS = Object.freeze(['direccion', 'cliente_telefono', 'cliente_email', 'cliente_cuit']);
const CLIENT_DETAIL_EMPTY_CLASS = 'client-detail-empty';
const CLIENT_DETAIL_LOCKED_CLASS = 'client-detail-locked';

const AUTO_RESIZE_ATTRIBUTE = 'data-auto-resize';
const AUTO_RESIZE_DATASET_KEY = 'autoResizeBaseWidth';
const AUTO_RESIZE_CHAR_WIDTH = 8;
const AUTO_RESIZE_BUFFER_PX = 6;
const AUTO_RESIZE_DEFAULT_MIN_WIDTH = 48;
const autoResizeInputsWithListener = new WeakSet();
const clientDetailInputsWithListener = new WeakSet();

function isAutoResizeCandidate(element) {
	return element instanceof HTMLInputElement && element.hasAttribute(AUTO_RESIZE_ATTRIBUTE);
}

export function autoResizeInput(element) {
	if (!isAutoResizeCandidate(element)) {
		return;
	}

	if (!element.dataset[AUTO_RESIZE_DATASET_KEY]) {
		const initialWidth = Math.max(element.clientWidth || 0, element.offsetWidth || 0);
		element.dataset[AUTO_RESIZE_DATASET_KEY] = String(
			initialWidth > 0 ? initialWidth : AUTO_RESIZE_DEFAULT_MIN_WIDTH,
		);
	}

	const baseWidth = Number(element.dataset[AUTO_RESIZE_DATASET_KEY]) || AUTO_RESIZE_DEFAULT_MIN_WIDTH;
	const placeholderLength = typeof element.placeholder === 'string' ? element.placeholder.length : 0;
	const valueLength = typeof element.value === 'string' ? element.value.length : 0;
	const effectiveLength = Math.max(valueLength, placeholderLength, 1);

	element.style.width = 'auto';

	let measuredWidth = element.scrollWidth;

	if (!measuredWidth || Number.isNaN(measuredWidth)) {
		const approxCharWidth = Number(element.dataset.autoResizeCharWidth) || AUTO_RESIZE_CHAR_WIDTH;
		measuredWidth = approxCharWidth * effectiveLength;
	}

	const finalWidth = Math.max(baseWidth, measuredWidth + AUTO_RESIZE_BUFFER_PX);
	element.style.width = `${finalWidth}px`;
}

function getAutoResizeInputs() {
	if (typeof document === 'undefined') {
		return [];
	}
	return Array.from(document.querySelectorAll(`input[${AUTO_RESIZE_ATTRIBUTE}]`));
}

function configureAutoResizeInputs() {
	const inputs = getAutoResizeInputs();
	inputs.forEach(input => {
		autoResizeInput(input);
		if (!autoResizeInputsWithListener.has(input)) {
			input.addEventListener('input', () => autoResizeInput(input));
			autoResizeInputsWithListener.add(input);
		}
	});
}

function resizeAutoResizeInputs() {
	getAutoResizeInputs().forEach(autoResizeInput);
}

const clienteDataMap = new Map();
let clienteSelectChangeHandler = null;

// === Equipos por Cliente ===
let equiposPorCliente = [];
let equipoSeleccionado = null;
let categoriaReporteActual = 'osmosis'; // Por defecto ósmosis, puede ser 'osmosis' o 'ablandador'

// Función para establecer la categoría del reporte actual (llamada desde main.js al cambiar de tab)
export function setCategoriaReporte(categoria) {
	categoriaReporteActual = categoria;
}

async function cargarEquiposParaCliente(clientId) {
	const todosEquipos = await getEquiposByCliente(clientId);
	// Filtrar por la categoría del reporte actual
	equiposPorCliente = todosEquipos.filter(eq => {
		const cat = (eq.sistema_categoria || '').toLowerCase();
		if (categoriaReporteActual === 'osmosis') {
			return cat === 'osmosis' || cat === 'ósmosis';
		} else if (categoriaReporteActual === 'ablandador') {
			return cat === 'ablandador' || cat === 'softener';
		}
		return true; // Si no hay categoría definida, mostrar todos
	});
	equipoSeleccionado = null;
	renderEquiposSelector();
}

function renderEquiposSelector() {
	const container = document.getElementById('equipos-selector-container');
	if (!container) return;
	container.innerHTML = '';
	if (!equiposPorCliente || equiposPorCliente.length === 0) {
		container.innerHTML = '<div class="text-gray-500">No hay equipos asociados a este cliente.</div>';
		return;
	}
	if (equiposPorCliente.length === 1) {
		equipoSeleccionado = equiposPorCliente[0];
		autocompletarCamposEquipo(equipoSeleccionado);
		container.innerHTML = `<div class="text-green-600">Equipo: ${equiposPorCliente[0].modelo || ''} (${equiposPorCliente[0].serie || ''})</div>`;
		return;
	}
	// Si hay más de uno, mostrar selector
	const select = document.createElement('select');
	select.id = 'equipo-selector';
	select.className = 'form-select px-2 py-1 rounded border';
	select.innerHTML = equiposPorCliente.map((eq, idx) =>
		`<option value="${idx}">${eq.modelo || 'Equipo'} - ${eq.serie || ''} (${eq.sistema_nombre || ''})</option>`
	).join('');
	select.addEventListener('change', e => {
		equipoSeleccionado = equiposPorCliente[parseInt(e.target.value)];
		autocompletarCamposEquipo(equipoSeleccionado);
	});
	container.appendChild(select);
	// Autocompletar el primero por defecto
	equipoSeleccionado = equiposPorCliente[0];
	autocompletarCamposEquipo(equipoSeleccionado);
}

function autocompletarCamposEquipo(equipo) {
	if (!equipo) return;
	setInputValue('modelo', equipo.modelo || '');
	setInputValue('n_serie', equipo.serie || '');
	setInputValue('id_interna', equipo.tag_id || '');
	setInputValue('sistema', equipo.sistema_nombre || '');
	setInputValue('sistema_categoria', equipo.sistema_categoria || '');
	if (equipo.fecha_instalacion) setInputValue('fecha_instalacion', equipo.fecha_instalacion);
	if (equipo.notas) setInputValue('notas', equipo.notas);
	if (equipo.sistema_descripcion) {
		const descEl = document.getElementById('sistema_descripcion');
		if (descEl) descEl.textContent = equipo.sistema_descripcion;
	}
	if (equipo.vida_util_dias) setInputValue('vida_util_dias', equipo.vida_util_dias);
}

function normalizeStringValue(value) {
	if (value === null || value === undefined) {
		return '';
	}

	const stringValue = String(value);
	return stringValue.trim();
}

function getFirstAvailableField(source, fieldNames) {
	if (!source || typeof source !== 'object') {
		return '';
	}

	for (const key of fieldNames) {
		if (Object.prototype.hasOwnProperty.call(source, key)) {
			const normalized = normalizeStringValue(source[key]);
			if (normalized) {
				return normalized;
			}
		}
	}

	return '';
}

function extractClientName(cliente) {
	return getFirstAvailableField(cliente, CLIENT_NAME_FIELDS);
}

function extractClientId(cliente) {
	return getFirstAvailableField(cliente, CLIENT_ID_FIELDS);
}

function createClientDetails(cliente) {
	return {
		direccion: getFirstAvailableField(cliente, CLIENT_FIELD_ALIASES.direccion),
		telefono: getFirstAvailableField(cliente, CLIENT_FIELD_ALIASES.telefono),
		email: getFirstAvailableField(cliente, CLIENT_FIELD_ALIASES.email),
		cuit: getFirstAvailableField(cliente, CLIENT_FIELD_ALIASES.cuit),
	};
}

function refreshClientDetailFieldState(element, { lockWhenFilled = false } = {}) {
	if (!(element instanceof HTMLInputElement)) {
		return;
	}

	if (!CLIENT_DETAIL_FIELD_IDS.includes(element.id)) {
		return;
	}

	const hasValue = normalizeStringValue(element.value) !== '';

	if (lockWhenFilled) {
		element.readOnly = hasValue;
		element.disabled = hasValue;
	} else if (!hasValue) {
		element.readOnly = false;
		element.disabled = false;
	}

	const isLocked = hasValue && (element.disabled || element.readOnly);

	if (isLocked) {
		element.classList.add(CLIENT_DETAIL_LOCKED_CLASS);
	} else {
		element.classList.remove(CLIENT_DETAIL_LOCKED_CLASS);
	}

	if (hasValue) {
		element.classList.remove(CLIENT_DETAIL_EMPTY_CLASS);
	} else {
		element.classList.add(CLIENT_DETAIL_EMPTY_CLASS);
	}
}

function configureClientDetailFieldInteractions() {
	CLIENT_DETAIL_FIELD_IDS.forEach(fieldId => {
		const element = getElement(fieldId);
		if (!(element instanceof HTMLInputElement)) {
			return;
		}

		refreshClientDetailFieldState(element);

		if (!clientDetailInputsWithListener.has(element)) {
			element.addEventListener('input', () => {
				refreshClientDetailFieldState(element);
			});
			clientDetailInputsWithListener.add(element);
		}
	});
}

const VALIDATION_FIELD_SELECTOR =
	"input:not([type='hidden']):not([type='radio']):not([type='checkbox']), select, textarea";
const validationFieldsWithListener = new WeakSet();

function isValidatableField(element) {
	return (
		element instanceof HTMLInputElement ||
		element instanceof HTMLTextAreaElement ||
		element instanceof HTMLSelectElement
	);
}

function getValidatableFields() {
	const form = getElement('maintenance-form');
	if (!(form instanceof HTMLFormElement)) {
		return [];
	}

	return Array.from(form.querySelectorAll(VALIDATION_FIELD_SELECTOR)).filter(isValidatableField);
}

function shouldValidateField(field) {
	const value = normalizeStringValue(field.value);
	const hasValue = value !== '';
	const touched = field.dataset.validationTouched === 'true';
	const mode = field.dataset.validationMode || '';

	if (mode === 'immediate') {
		return true;
	}

	return touched || hasValue;
}

function determineValidationState(field) {
	if (!isValidatableField(field) || field.disabled) {
		return 'neutral';
	}

	const value = normalizeStringValue(field.value);
	const hasValue = value !== '';
	const shouldEvaluate = shouldValidateField(field);

	if (!shouldEvaluate) {
		return 'neutral';
	}

	const isRequired = field.required || field.dataset.validationMode === 'required';
	if (!isRequired && !hasValue) {
		return 'neutral';
	}

	return field.checkValidity() ? 'valid' : 'error';
}

function applyValidationClasses(field, state) {
	if (!isValidatableField(field)) {
		return;
	}

	field.classList.remove('input-status', 'input-status--valid', 'input-status--error');
	field.removeAttribute('aria-invalid');

	if (state === 'neutral') {
		return;
	}

	field.classList.add('input-status');
	if (state === 'valid') {
		field.classList.add('input-status--valid');
		field.setAttribute('aria-invalid', 'false');
		return;
	}

	field.classList.add('input-status--error');
	field.setAttribute('aria-invalid', 'true');
}

function updateFieldValidation(field, { forceTouched = false } = {}) {
	if (!isValidatableField(field)) {
		return;
	}

	if (forceTouched) {
		field.dataset.validationTouched = 'true';
	}

	const state = determineValidationState(field);
	applyValidationClasses(field, state);
}

function handleValidationEvent(event) {
	const field = event.target;
	if (!isValidatableField(field)) {
		return;
	}

	field.dataset.validationTouched = 'true';
	updateFieldValidation(field);
}

function configureFieldValidation() {
	const fields = getValidatableFields();
	fields.forEach(field => {
		if (!validationFieldsWithListener.has(field)) {
			['input', 'change', 'blur'].forEach(eventType => {
				field.addEventListener(eventType, handleValidationEvent);
			});
			validationFieldsWithListener.add(field);
		}
		updateFieldValidation(field);
	});
}

function resetValidationStates() {
	getValidatableFields().forEach(field => {
		delete field.dataset.validationTouched;
		applyValidationClasses(field, 'neutral');
	});
}

const PERFORMANCE_GROUPS = Object.freeze({
	found: {
		fields: ['cond_red_found', 'cond_perm_found', 'caudal_perm_found', 'caudal_rech_found', 'rechazo_found'],
	},
	left: {
		fields: ['cond_red_left', 'cond_perm_left', 'caudal_perm_left', 'caudal_rech_left', 'rechazo_left'],
	},
});

const REJECTION_SUCCESS_THRESHOLD = 90;

function evaluateRejectionState(value) {
	if (typeof value !== 'number' || Number.isNaN(value)) {
		return 'neutral';
	}

	return value >= REJECTION_SUCCESS_THRESHOLD ? 'valid' : 'error';
}

function setMetricState(element, state) {
	if (!(element instanceof HTMLElement)) {
		return;
	}

	element.classList.remove('metric-status', 'metric-status--valid', 'metric-status--error');
	if (state === 'neutral') {
		return;
	}

	element.classList.add('metric-status');
	if (state === 'valid') {
		element.classList.add('metric-status--valid');
		return;
	}

	element.classList.add('metric-status--error');
}

function applyPerformanceFeedback(rejectionValues = {}) {
	Object.entries(PERFORMANCE_GROUPS).forEach(([key, group]) => {
		const state = evaluateRejectionState(rejectionValues[key]);
		group.fields.forEach(fieldId => {
			const field = getElement(fieldId);
			if (field) {
				setMetricState(field, state);
			}
		});
	});
}

function resetMetricStates() {
	Object.values(PERFORMANCE_GROUPS).forEach(group => {
		group.fields.forEach(fieldId => {
			const field = getElement(fieldId);
			if (field) {
				field.classList.remove('metric-status', 'metric-status--valid', 'metric-status--error');
			}
		});
	});
}

function setClientDetailValue(fieldId, value, options = {}) {
	const element = getElement(fieldId);
	if (!element) {
		return;
	}

	const normalizedValue = normalizeStringValue(value);

	if ('value' in element) {
		element.value = normalizedValue;
	}

	if (element instanceof HTMLInputElement) {
		autoResizeInput(element);
		refreshClientDetailFieldState(element, {
			lockWhenFilled: Boolean(options.lockWhenFilled),
		});
	}

	updateFieldValidation(element);
}

function applyClientDetails(details = {}) {
	const detailMap = {
		direccion: details.direccion,
		cliente_telefono: details.telefono,
		cliente_email: details.email,
		cliente_cuit: details.cuit,
	};

	Object.entries(detailMap).forEach(([fieldId, fieldValue]) => {
		setClientDetailValue(fieldId, fieldValue, { lockWhenFilled: true });
	});
}

function clearClientDetails() {
	applyClientDetails({});
}

function updateClientDetailsFromSelect(selectElement) {
	if (!selectElement) {
		clearClientDetails();
		return;
	}

	let selectedDetails = null;
	const optionFromCollection =
		selectElement.selectedOptions && selectElement.selectedOptions.length > 0
			? selectElement.selectedOptions[0]
			: null;
	const optionFromIndex =
		typeof selectElement.selectedIndex === 'number' && selectElement.selectedIndex >= 0
			? selectElement.options[selectElement.selectedIndex]
			: null;

	if (optionFromCollection) {
		const keyFromCollection = optionFromCollection.getAttribute('data-cliente-key');
		if (keyFromCollection) {
			selectedDetails = clienteDataMap.get(keyFromCollection) || null;
		}
	}

	const shouldCheckIndex =
		!selectedDetails || (optionFromIndex && optionFromCollection && optionFromCollection !== optionFromIndex);

	if (shouldCheckIndex && optionFromIndex) {
		const keyFromIndex = optionFromIndex.getAttribute('data-cliente-key');
		if (keyFromIndex) {
			const detailsFromIndex = clienteDataMap.get(keyFromIndex);
			if (detailsFromIndex) {
				selectedDetails = detailsFromIndex;
			}
		}
	}

	if (!selectedDetails) {
		selectedDetails = clienteDataMap.get(selectElement.value);
	}

	if (selectedDetails) {
		applyClientDetails(selectedDetails);
	} else {
		clearClientDetails();
	}
}

function resetClientSelection() {
	// Limpiar el input de búsqueda del autocomplete
	const searchInput = getElement('cliente-search');
	if (searchInput) {
		searchInput.value = '';
		searchInput.classList.remove('has-selection');
	}

	// Limpiar el input hidden con el ID del cliente
	const hiddenInput = getElement('cliente');
	if (hiddenInput) {
		hiddenInput.value = '';
	}

	// Ocultar el botón de clear
	const clearBtn = getElement('cliente-clear-btn');
	if (clearBtn) {
		clearBtn.classList.add('hidden');
	}

	// Ocultar el dropdown si está visible
	hideDropdown();

	clearClientDetails();
}

function padWithZero(value) {
	return String(value).padStart(2, '0');
}

function isDateInstance(value) {
	return Object.prototype.toString.call(value) === '[object Date]';
}

function isValidDate(value) {
	return isDateInstance(value) && !Number.isNaN(value.getTime());
}

function toDateFromParts(year, monthIndex, day) {
	const date = new Date(year, monthIndex, day);
	if (Number.isNaN(date.getTime())) {
		return null;
	}

	if (date.getFullYear() !== year || date.getMonth() !== monthIndex || date.getDate() !== day) {
		return null;
	}

	return date;
}

function formatDateToISO(date) {
	if (!isValidDate(date)) {
		return '';
	}

	return `${date.getFullYear()}-${padWithZero(date.getMonth() + 1)}-${padWithZero(date.getDate())}`;
}

export function normalizeDateToISO(value) {
	if (value === null || value === undefined || value === '') {
		return '';
	}

	if (isValidDate(value)) {
		return formatDateToISO(value);
	}

	if (typeof value === 'number') {
		return formatDateToISO(new Date(value));
	}

	if (typeof value === 'string') {
		const trimmed = value.trim();
		if (!trimmed) {
			return '';
		}

		let match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
		if (match) {
			const year = Number(match[1]);
			const month = Number(match[2]);
			const day = Number(match[3]);
			const isoDate = toDateFromParts(year, month - 1, day);
			return isoDate ? formatDateToISO(isoDate) : '';
		}

		match = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
		if (match) {
			const year = Number(match[1]);
			const month = Number(match[2]);
			const day = Number(match[3]);
			const yearFirstDate = toDateFromParts(year, month - 1, day);
			return yearFirstDate ? formatDateToISO(yearFirstDate) : '';
		}

		match = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
		if (match) {
			const day = Number(match[1]);
			const month = Number(match[2]);
			const year = Number(match[3]);
			const dayFirstDate = toDateFromParts(year, month - 1, day);
			return dayFirstDate ? formatDateToISO(dayFirstDate) : '';
		}

		const parsedDate = new Date(trimmed);
		return formatDateToISO(parsedDate);
	}

	if (typeof value === 'object') {
		const candidate = new Date(value);
		return formatDateToISO(candidate);
	}

	return '';
}

function formatDateForDisplayFromISO(isoDate) {
	if (!isoDate) {
		return '';
	}

	const [yearStr, monthStr, dayStr] = isoDate.split('-');
	if (!yearStr || !monthStr || !dayStr) {
		return '';
	}

	const year = Number(yearStr);
	const month = Number(monthStr);
	const day = Number(dayStr);

	if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
		return '';
	}

	const displayDate = new Date(year, month - 1, day);
	if (Number.isNaN(displayDate.getTime())) {
		return '';
	}

	return displayDate.toLocaleDateString('es-AR', {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	});
}

function setServiceDateValue(value) {
	const isoDate = normalizeDateToISO(value);
	const fechaInput = getElement('fecha');
	if (fechaInput) {
		fechaInput.value = isoDate;
	}

	const fechaDisplayInput = getElement('fecha_display');
	if (fechaDisplayInput) {
		fechaDisplayInput.value = formatDateForDisplayFromISO(isoDate);
		autoResizeInput(fechaDisplayInput);
	}
}

export function serializeForm(formElement) {
	if (!(formElement instanceof HTMLFormElement)) {
		return {};
	}

	const formData = new FormData(formElement);
	const data = {};

	formData.forEach((value, key) => {
		if (Object.prototype.hasOwnProperty.call(data, key)) {
			if (!Array.isArray(data[key])) {
				data[key] = [data[key]];
			}
			data[key].push(value);
		} else {
			data[key] = value;
		}
	});

	const radioNames = new Set();
	formElement
		.querySelectorAll('input[type="radio"][name]')
		.forEach(radio => radioNames.add(radio.name));

	radioNames.forEach(name => {
		if (!Object.prototype.hasOwnProperty.call(data, name)) {
			data[name] = '';
		}
	});

	return data;
}

function setDefaultDate() {
	setServiceDateValue(new Date());
}

function calculateAll() {
	const condRedFound = parseFloat(getElement('cond_red_found')?.value) || 0;
	const condPermFound = parseFloat(getElement('cond_perm_found')?.value) || 0;
	const condRedLeft = parseFloat(getElement('cond_red_left')?.value) || 0;
	const condPermLeft = parseFloat(getElement('cond_perm_left')?.value) || 0;

	const caudalPermFound = parseFloat(getElement('caudal_perm_found')?.value) || 0;
	const caudalRechFound = parseFloat(getElement('caudal_rech_found')?.value) || 0;
	const caudalPermLeft = parseFloat(getElement('caudal_perm_left')?.value) || 0;
	const caudalRechLeft = parseFloat(getElement('caudal_rech_left')?.value) || 0;



	const rechazoFound = condRedFound > 0 ? ((1 - (condPermFound / condRedFound)) * 100).toFixed(2) : '';
	const rechazoLeft = condRedLeft > 0 ? ((1 - (condPermLeft / condRedLeft)) * 100).toFixed(2) : '';

	const rechazoFoundValue = rechazoFound ? `${rechazoFound} %` : '';
	const rechazoLeftValue = rechazoLeft ? `${rechazoLeft} %` : '';

	const rechazoFoundInput = getElement('rechazo_found');
	const rechazoFoundHiddenInput = getElement('rechazo_found_hidden');
	const rechazoLeftInput = getElement('rechazo_left');
	const rechazoLeftHiddenInput = getElement('rechazo_left_hidden');
	if (rechazoFoundInput) {
		rechazoFoundInput.value = rechazoFoundValue;
	}
	if (rechazoFoundHiddenInput) {
		rechazoFoundHiddenInput.value = rechazoFoundValue;
	}
	if (rechazoLeftInput) {
		rechazoLeftInput.value = rechazoLeftValue;
	}
	if (rechazoLeftHiddenInput) {
		rechazoLeftHiddenInput.value = rechazoLeftValue;
	}
	const relacionFound = caudalPermFound > 0 ? (caudalRechFound / caudalPermFound).toFixed(1) : '';
	const relacionLeft = caudalPermLeft > 0 ? (caudalRechLeft / caudalPermLeft).toFixed(1) : '';

	const relacionFoundValue = relacionFound ? `${relacionFound}:1` : '';
	const relacionLeftValue = relacionLeft ? `${relacionLeft}:1` : '';
	const relacionFoundInput = getElement('relacion_found');
	const relacionFoundHiddenInput = getElement('relacion_found_hidden');
	const relacionLeftInput = getElement('relacion_left');
	const relacionLeftHiddenInput = getElement('relacion_left_hidden');
	if (relacionFoundInput) {
		relacionFoundInput.value = relacionFoundValue;
	}
	if (relacionFoundHiddenInput) {
		relacionFoundHiddenInput.value = relacionFoundValue;
	}
	if (relacionLeftInput) {
		relacionLeftInput.value = relacionLeftValue;
	}
	if (relacionLeftHiddenInput) {
		relacionLeftHiddenInput.value = relacionLeftValue;
	}

	const rejectionValues = {
		found: rechazoFound ? parseFloat(rechazoFound) : Number.NaN,
		left: rechazoLeft ? parseFloat(rechazoLeft) : Number.NaN,
	};
	applyPerformanceFeedback(rejectionValues);
}

function updateConversions(inputEl, outputEl) {
	const lmin = parseFloat(inputEl.value);
	if (!Number.isNaN(lmin) && lmin >= 0) {
		const lph = lmin * LMIN_TO_LPH;
		const gpd = lmin * LMIN_TO_GPD;
		outputEl.textContent = `(${lph.toFixed(1)} l/h | ${gpd.toFixed(0)} GPD)`;
	} else {
		outputEl.textContent = '';
	}
}

function configureConversionInputs() {
	const conversionPairs = [
		['caudal_perm_found', 'caudal_perm_found_conv'],
		['caudal_perm_left', 'caudal_perm_left_conv'],
		['caudal_rech_found', 'caudal_rech_found_conv'],
		['caudal_rech_left', 'caudal_rech_left_conv'],
	];

	conversionPairs.forEach(([inputId, outputId]) => {
		const input = getElement(inputId);
		const output = getElement(outputId);
		if (input && output) {
			input.addEventListener('input', () => updateConversions(input, output));
		}
	});
}
const STATUS_SELECT_SELECTOR = 'select[id$="_found"], select[id$="_left"]';

const STATUS_CLASS_BY_VALUE = {
	pasa: 'status-pass',
	no: 'status-pass',
	falla: 'status-fail',
	'no pasa': 'status-fail',
	sí: 'status-fail',
	si: 'status-fail',
	'n/a': 'status-na',
	'no aplica': 'status-na',
	na: 'status-na',
	'': 'status-na',
};

function setStatusColor(selectElement) {
	selectElement.classList.remove('status-pass', 'status-fail', 'status-na');
	const normalizedValue = String(selectElement.value ?? '').trim().toLowerCase();
	const statusClass = STATUS_CLASS_BY_VALUE[normalizedValue] || 'status-na';
	selectElement.classList.add(statusClass);
}

function applyStatusColorsToSelects() {
	const statusSelects = document.querySelectorAll(STATUS_SELECT_SELECTOR);
	statusSelects.forEach(select => {
		select.classList.add('status-select');
		setStatusColor(select);
	});
}

function configureStatusSelects() {

	const statusSelects = document.querySelectorAll(STATUS_SELECT_SELECTOR);

	statusSelects.forEach(select => {
		select.classList.add('status-select');
		setStatusColor(select);
		select.addEventListener('change', () => setStatusColor(select));
	});
}

const SANITIZACION_STATUS_MAP = {
	Realizada: 'success',
	'No Realizada': 'danger',
	'N/A': 'neutral',
};

function configureSanitizacionRadios() {
	const container = document.querySelector('.sanitizacion-card-group');
	if (!container) {
		return;
	}

	const radios = container.querySelectorAll('input[type="radio"][name="sanitizacion"]');
	if (!radios.length) {
		container.dataset.status = 'neutral';
		return;
	}

	const updateStatus = () => {
		const checked = container.querySelector('input[type="radio"][name="sanitizacion"]:checked');
		const statusKey = checked?.value || 'N/A';
		container.dataset.status = SANITIZACION_STATUS_MAP[statusKey] || 'neutral';
	};

	radios.forEach(radio => {
		if (!radio.dataset.sanitizacionConfigured) {
			radio.addEventListener('change', updateStatus);
			radio.dataset.sanitizacionConfigured = 'true';
		}
	});

	updateStatus();
}

function configureNumberInputs() {
	const inputs = document.querySelectorAll('input[type="number"]');
	inputs.forEach(input => {
		input.addEventListener('input', calculateAll);
	});
}

function clearDerivedFields() {
	[
		'rechazo_found',
		'rechazo_found_hidden',
		'rechazo_left',
		'rechazo_left_hidden',
		'relacion_found',
		'relacion_found_hidden',
		'relacion_left',
		'relacion_left_hidden',
	].forEach(id => {
		const element = getElement(id);
		if (element) {
			element.value = '';
		}
	});

	resetMetricStates();
}

function clearConversionOutputs() {
	['caudal_perm_found_conv', 'caudal_perm_left_conv', 'caudal_rech_found_conv', 'caudal_rech_left_conv'].forEach(id => {
		const element = getElement(id);
		if (element) {
			element.textContent = '';
		}
	});
}

function addDays(date, days) {
	const clone = new Date(date.getTime());
	clone.setDate(clone.getDate() + days);
	return clone;
}

function setInputValue(id, value) {
	const element = getElement(id);
	if (!(element instanceof HTMLInputElement) && !(element instanceof HTMLTextAreaElement)) {
		return;
	}

	element.value = value;
	const inputEvent = new Event('input', { bubbles: true });
	element.dispatchEvent(inputEvent);

	if (element instanceof HTMLInputElement) {
		autoResizeInput(element);
	}
}

function setSelectValue(id, value) {
	const element = getElement(id);
	if (!(element instanceof HTMLSelectElement)) {
		return;
	}

	element.value = value;
	const changeEvent = new Event('change', { bubbles: true });
	element.dispatchEvent(changeEvent);
}

export function autoFillForm() {
	const now = new Date();
	setServiceDateValue(now);

	setInputValue('tecnico', 'Equipo Técnico Pruebas');
	setInputValue('modelo', 'Sistema RO Residencial 6 etapas');
	setInputValue('id_interna', 'ACT-PRUEBA-042');
	setInputValue('n_serie', 'SN-PRB-998877');

	const nextMaintenance = addDays(now, 180);
	const proximoMantInput = getElement('proximo_mant');
	if (proximoMantInput instanceof HTMLInputElement) {
		proximoMantInput.value = normalizeDateToISO(nextMaintenance);
		proximoMantInput.dispatchEvent(new Event('input', { bubbles: true }));
	}

	const numericValues = {
		cond_red_found: 480,
		cond_red_left: 460,
		cond_perm_found: 28,
		cond_perm_left: 16,
		presion_found: 2.6,
		presion_left: 3.9,
		caudal_perm_found: 1.9,
		caudal_perm_left: 2.5,
		caudal_rech_found: 3.8,
		caudal_rech_left: 4.3,
		precarga_found: 1.1,
		precarga_left: 1.5,
	};

	Object.entries(numericValues).forEach(([id, value]) => {
		const element = getElement(id);
		if (element instanceof HTMLInputElement) {
			element.value = value;
			element.dispatchEvent(new Event('input', { bubbles: true }));
		}
	});

	setSelectValue('fugas_found', 'Sí');
	setSelectValue('fugas_left', 'No');
	setSelectValue('presostato_alta_found', 'Pasa');
	setSelectValue('presostato_alta_left', 'Pasa');
	setSelectValue('presostato_baja_found', 'Pasa');
	setSelectValue('presostato_baja_left', 'Pasa');

	const stageDetails = {
		etapa1: 'Filtro sedimentos 5µm (cambio)',
		etapa2: 'Cartucho CTO 10" reemplazado',
		etapa3: 'GAC + pulido final verificado',
		etapa4: 'Membrana 75 GPD instalada',
		etapa5: 'Postfiltro remineralizador nuevo',
		etapa6: 'UV operativa y sanitizada',
	};

	COMPONENT_STAGES.forEach(stage => {
		const detailId = `${stage.id}_detalles`;
		setInputValue(detailId, stageDetails[stage.id] || stage.title);

		const changedRadio = document.getElementById(`${stage.id}_accion_cambiado`);
		if (changedRadio instanceof HTMLInputElement) {
			changedRadio.checked = true;
			changedRadio.dispatchEvent(new Event('change', { bubbles: true }));
		}
	});

	const sanitizacionRadio = document.querySelector('input[name="sanitizacion"][value="Realizada"]');
	if (sanitizacionRadio instanceof HTMLInputElement) {
		sanitizacionRadio.checked = true;
		sanitizacionRadio.dispatchEvent(new Event('change', { bubbles: true }));
	}

	const comentarios = [
		'Se reemplazaron todos los filtros y se normalizaron los parámetros.',
		'Equipo calibrado tras cambio integral de cartuchos y sanitización completa.',
		'Mantenimiento preventivo completado sin novedades, parámetros dentro de lo esperado.',
		'Cambios realizados y pruebas finales exitosas, equipo queda operativo.',
	];
	const resumen = document.getElementById('resumen');
	if (resumen instanceof HTMLTextAreaElement) {
		const comentarioAleatorio = comentarios[Math.floor(Math.random() * comentarios.length)];
		resumen.value = comentarioAleatorio;
		resumen.dispatchEvent(new Event('input', { bubbles: true }));
	}

	calculateAll();

	['caudal_perm_found', 'caudal_perm_left', 'caudal_rech_found', 'caudal_rech_left'].forEach(id => {
		const element = getElement(id);
		if (element instanceof HTMLInputElement) {
			element.dispatchEvent(new Event('input', { bubbles: true }));
		}
	});

	configureSanitizacionRadios();
}

// ===== Cliente Autocomplete =====
let clientesListCache = [];
let autocompleteInitialized = false;
let selectedClientIndex = -1;

function normalizeForSearch(text) {
	if (!text) return '';
	return text
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '') // Remove accents
		.trim();
}

function highlightMatch(text, query) {
	if (!query || !text) return text;
	const normalizedText = normalizeForSearch(text);
	const normalizedQuery = normalizeForSearch(query);
	const index = normalizedText.indexOf(normalizedQuery);
	if (index === -1) return text;

	const before = text.slice(0, index);
	const match = text.slice(index, index + query.length);
	const after = text.slice(index + query.length);
	return `${before}<mark>${match}</mark>${after}`;
}

function filterClientes(query) {
	if (!query || query.length < 1) {
		return clientesListCache.slice(0, 10); // Show first 10 when empty
	}

	const normalizedQuery = normalizeForSearch(query);

	return clientesListCache
		.filter(cliente => {
			const name = normalizeForSearch(extractClientName(cliente));
			const direccion = normalizeForSearch(cliente.direccion || '');
			const cuit = normalizeForSearch(cliente.cuit || '');

			return name.includes(normalizedQuery) ||
				direccion.includes(normalizedQuery) ||
				cuit.includes(normalizedQuery);
		})
		.slice(0, 15); // Limit results
}

function renderDropdown(clientes, query) {
	const dropdown = getElement('cliente-dropdown');
	if (!dropdown) return;

	if (clientes.length === 0) {
		dropdown.innerHTML = `
			<div class="cliente-dropdown-empty">
				No se encontraron clientes con "${query}"
			</div>
		`;
		dropdown.classList.remove('hidden');
		return;
	}

	dropdown.innerHTML = clientes.map((cliente, index) => {
		const name = extractClientName(cliente);
		const direccion = cliente.direccion || '';
		const highlightedName = highlightMatch(name, query);
		const highlightedDireccion = highlightMatch(direccion, query);
		const clientKey = `cliente-${clientesListCache.indexOf(cliente)}`;

		return `
			<div class="cliente-dropdown-item ${index === selectedClientIndex ? 'selected' : ''}" 
			     data-cliente-key="${clientKey}"
			     data-cliente-index="${index}"
			     role="option"
			     tabindex="-1">
				<div class="cliente-dropdown-item-name">${highlightedName}</div>
				${direccion ? `<div class="cliente-dropdown-item-detail">${highlightedDireccion}</div>` : ''}
			</div>
		`;
	}).join('');

	dropdown.classList.remove('hidden');
}

function hideDropdown() {
	const dropdown = getElement('cliente-dropdown');
	if (dropdown) {
		dropdown.classList.add('hidden');
	}
	selectedClientIndex = -1;
}

function selectClient(clientKey) {
	const index = parseInt(clientKey.replace('cliente-', ''), 10);
	const cliente = clientesListCache[index];
	if (!cliente) return;

	const searchInput = getElement('cliente-search');
	const hiddenInput = getElement('cliente');
	const clearBtn = getElement('cliente-clear-btn');

	const clientId = extractClientId(cliente) || extractClientName(cliente);
	const clientName = extractClientName(cliente);

	if (hiddenInput) {
		hiddenInput.value = clientId;
	}

	if (searchInput) {
		searchInput.value = clientName;
		searchInput.classList.add('has-selection');
	}

	if (clearBtn) {
		clearBtn.classList.remove('hidden');
	}

	// Store client details and apply them
	clienteDataMap.set(clientKey, createClientDetails(cliente));
	applyClientDetails(createClientDetails(cliente));
	// Consultar equipos y mostrar selector
	const clientIdForEquipos = extractClientId(cliente);
	if (clientIdForEquipos) {
		cargarEquiposParaCliente(clientIdForEquipos);
	} else {
		equiposPorCliente = [];
		renderEquiposSelector();
	}
	hideDropdown();
}

function clearClientSelection() {
	const searchInput = getElement('cliente-search');
	const hiddenInput = getElement('cliente');
	const clearBtn = getElement('cliente-clear-btn');

	if (searchInput) {
		searchInput.value = '';
		searchInput.classList.remove('has-selection');
		searchInput.focus();
	}

	if (hiddenInput) {
		hiddenInput.value = '';
	}

	if (clearBtn) {
		clearBtn.classList.add('hidden');
	}

	clearClientDetails();
	hideDropdown();
}

function initializeClientAutocomplete() {
	if (autocompleteInitialized) return;

	const searchInput = getElement('cliente-search');
	const dropdown = getElement('cliente-dropdown');
	const clearBtn = getElement('cliente-clear-btn');

	if (!searchInput || !dropdown) return;

	// Input event - filter as user types
	searchInput.addEventListener('input', (e) => {
		const query = e.target.value;
		searchInput.classList.remove('has-selection');

		// Clear hidden input when user modifies search
		const hiddenInput = getElement('cliente');
		if (hiddenInput) {
			hiddenInput.value = '';
		}

		if (clearBtn) {
			clearBtn.classList.toggle('hidden', !query);
		}

		const filtered = filterClientes(query);
		selectedClientIndex = -1;
		renderDropdown(filtered, query);
	});

	// Focus event - show dropdown
	searchInput.addEventListener('focus', () => {
		const query = searchInput.value;
		if (!searchInput.classList.contains('has-selection')) {
			const filtered = filterClientes(query);
			renderDropdown(filtered, query);
		}
	});

	// Keyboard navigation
	searchInput.addEventListener('keydown', (e) => {
		const items = dropdown.querySelectorAll('.cliente-dropdown-item');

		if (e.key === 'ArrowDown') {
			e.preventDefault();
			selectedClientIndex = Math.min(selectedClientIndex + 1, items.length - 1);
			updateDropdownSelection(items);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			selectedClientIndex = Math.max(selectedClientIndex - 1, 0);
			updateDropdownSelection(items);
		} else if (e.key === 'Enter') {
			e.preventDefault();
			if (selectedClientIndex >= 0 && items[selectedClientIndex]) {
				const clientKey = items[selectedClientIndex].dataset.clienteKey;
				selectClient(clientKey);
			}
		} else if (e.key === 'Escape') {
			hideDropdown();
		}
	});

	// Click on dropdown item
	dropdown.addEventListener('click', (e) => {
		const item = e.target.closest('.cliente-dropdown-item');
		if (item) {
			const clientKey = item.dataset.clienteKey;
			selectClient(clientKey);
		}
	});

	// Clear button
	if (clearBtn) {
		clearBtn.addEventListener('click', (e) => {
			e.preventDefault();
			clearClientSelection();
		});
	}

	// Click outside to close
	document.addEventListener('click', (e) => {
		const container = getElement('cliente-autocomplete-container');
		if (container && !container.contains(e.target)) {
			hideDropdown();
		}
	});

	autocompleteInitialized = true;
}

function updateDropdownSelection(items) {
	items.forEach((item, index) => {
		item.classList.toggle('selected', index === selectedClientIndex);
		if (index === selectedClientIndex) {
			item.scrollIntoView({ block: 'nearest' });
		}
	});
}

export function configureClientSelect(clientes = []) {
	// Store clients for autocomplete
	clientesListCache = Array.isArray(clientes) ? clientes : [];

	// Clear and rebuild the data map
	clienteDataMap.clear();
	clientesListCache.forEach((cliente, index) => {
		if (!cliente || typeof cliente !== 'object') return;
		const clientKey = `cliente-${index}`;
		clienteDataMap.set(clientKey, createClientDetails(cliente));
	});

	// Initialize autocomplete if not already done
	initializeClientAutocomplete();

	// If there was a previous selection, try to restore it
	const hiddenInput = getElement('cliente');
	const searchInput = getElement('cliente-search');

	if (hiddenInput && hiddenInput.value && searchInput) {
		// Find the client by ID
		const existingClient = clientesListCache.find(c => {
			const id = extractClientId(c) || extractClientName(c);
			return id === hiddenInput.value;
		});

		if (existingClient) {
			searchInput.value = extractClientName(existingClient);
			searchInput.classList.add('has-selection');
			const clearBtn = getElement('cliente-clear-btn');
			if (clearBtn) clearBtn.classList.remove('hidden');
		}
	}
}

export function initializeForm() {
	setDefaultDate();
	configureNumberInputs();
	configureConversionInputs();
	configureStatusSelects();

	configureAutoResizeInputs();
	configureClientDetailFieldInteractions();

	configureSanitizacionRadios();
	configureFieldValidation();

	// Autocompletar técnico con el nombre del usuario logueado
	const userName = getCurrentUserName();
	if (userName) {
		setInputValue('tecnico', userName);
	}

	// Autocompletar fecha próximo mantenimiento con fecha actual + 365 días
	const proximoMant = addDays(new Date(), 365);
	const proximoMantInput = getElement('proximo_mant');
	if (proximoMantInput instanceof HTMLInputElement) {
		proximoMantInput.value = normalizeDateToISO(proximoMant);
	}

	calculateAll();
}

export function resetForm() {
	const form = getElement('maintenance-form');
	if (form) {
		form.reset();
	}
	resetClientSelection();
	setDefaultDate();
	clearDerivedFields();
	clearConversionOutputs();
	resetValidationStates();
	resetComponentStages();

	applyStatusColorsToSelects();
	resizeAutoResizeInputs();

	configureSanitizacionRadios();

}

export function getFormData() {
	const form = getElement('maintenance-form');
	if (!(form instanceof HTMLFormElement)) {
		return {};
	}

	const data = serializeForm(form);

	const sanitizacionOption = form.querySelector('input[name="sanitizacion"]:checked');
	data.sanitizacion = sanitizacionOption ? sanitizacionOption.value : '';

	if (Object.prototype.hasOwnProperty.call(data, 'fecha')) {
		const isoFecha = normalizeDateToISO(data.fecha);
		data.fecha = isoFecha || normalizeDateToISO(new Date());
	}

	if (Object.prototype.hasOwnProperty.call(data, 'proximo_mant')) {
		data.proximo_mant = normalizeDateToISO(data.proximo_mant);
	}
	const numericFields = [
		'cond_red_found',
		'cond_red_left',
		'cond_perm_found',
		'cond_perm_left',
		'presion_found',
		'presion_left',
		'caudal_perm_found',
		'caudal_perm_left',
		'caudal_rech_found',
		'caudal_rech_left',
		'precarga_found',
		'precarga_left',
	];

	numericFields.forEach(field => {
		if (Object.prototype.hasOwnProperty.call(data, field) && data[field] === '') {
			data[field] = 0;
		}
	});

	// Agregar el nombre del cliente si hay un cliente seleccionado
	if (data.cliente) {
		// Intentar obtener el nombre del cliente desde el input de búsqueda (que tiene el nombre visible)
		const searchInput = getElement('cliente-search');
		if (searchInput && searchInput.value && searchInput.classList.contains('has-selection')) {
			data.cliente_nombre = searchInput.value;
		} else {
			// Si no está en el input de búsqueda, buscarlo en el cache
			const selectedCliente = clientesListCache.find(c => {
				const id = extractClientId(c) || extractClientName(c);
				return id === data.cliente;
			});
			if (selectedCliente) {
				data.cliente_nombre = extractClientName(selectedCliente);
			}
		}
	}

	return data;
}

export function setReportNumber(reportNumber) {
	const display = getElement('report-number-display');
	if (display) {
		display.textContent = reportNumber;
	}
}

export function generateReportNumber() {
	const now = new Date();
	const padZero = (num) => String(num).padStart(2, '0');
	const timestamp = `${now.getFullYear()}${padZero(now.getMonth() + 1)}${padZero(now.getDate())}-${padZero(now.getHours())}${padZero(now.getMinutes())}${padZero(now.getSeconds())}`;
	return `REP-${timestamp}`;
}

export const __testables__ = {
	calculateAll,
	updateConversions,
};
