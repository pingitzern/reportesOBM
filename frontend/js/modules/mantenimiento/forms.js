import * as config from '../../config.js';
const { LMIN_TO_GPD = (60 * 24) / 3.78541, LMIN_TO_LPH = 60 } = config;
import { COMPONENT_STAGES } from './templates.js';

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
	const select = getElement('cliente');
	if (!select) {
		clearClientDetails();
		return;
	}

	if (select.options.length > 0) {
		const placeholderOption = select.querySelector('option[value=""]');
		if (placeholderOption) {
			placeholderOption.selected = true;
			select.value = placeholderOption.value;
		} else {
			select.selectedIndex = 0;
		}
	} else {
		select.value = '';
	}

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
	statusSelects.forEach(setStatusColor);
}

function configureStatusSelects() {

	const statusSelects = document.querySelectorAll(STATUS_SELECT_SELECTOR);

	statusSelects.forEach(select => {
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
	const container = document.querySelector('.sanitizacion-options');
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

	if (!container.dataset.sanitizacionConfigured) {
		radios.forEach(radio => {
			radio.addEventListener('change', updateStatus);
		});
		container.dataset.sanitizacionConfigured = 'true';
	}

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

export function configureClientSelect(clientes = []) {
	const select = getElement('cliente');
	if (!select) {
		return;
	}

	const clientesArray = Array.isArray(clientes) ? clientes : [];
	const previousValue = select.value;
	const previousSelectedOption = select.selectedOptions && select.selectedOptions[0];
	const previousDataKey = previousSelectedOption
		? previousSelectedOption.getAttribute('data-cliente-key')
		: null;
	const placeholderOption = select.querySelector('option[value=""]');

	select.querySelectorAll(`option[${CLIENT_OPTION_ATTRIBUTE}="true"]`).forEach(option => option.remove());
	clienteDataMap.clear();

	const fragment = document.createDocumentFragment();

	clientesArray.forEach((cliente, index) => {
		if (!cliente || typeof cliente !== 'object') {
			return;
		}

		const optionValue = extractClientId(cliente) || extractClientName(cliente);
		if (!optionValue) {
			return;
		}

		const optionLabel = extractClientName(cliente) || optionValue;
		const option = document.createElement('option');
		option.value = optionValue;
		option.textContent = optionLabel;
		const clientKey = `cliente-${index}`;
		option.setAttribute('data-cliente-key', clientKey);
		option.setAttribute(CLIENT_OPTION_ATTRIBUTE, 'true');
		fragment.appendChild(option);

		clienteDataMap.set(clientKey, createClientDetails(cliente));
	});

	select.appendChild(fragment);

	if (clienteSelectChangeHandler) {
		select.removeEventListener('change', clienteSelectChangeHandler);
	}

	clienteSelectChangeHandler = () => {
		updateClientDetailsFromSelect(select);
	};

	select.addEventListener('change', clienteSelectChangeHandler);

	let selectionRestored = false;

	if (previousDataKey) {
		const matchingOption = select.querySelector(`option[data-cliente-key="${previousDataKey}"]`);
		if (matchingOption) {
			matchingOption.selected = true;
			select.value = matchingOption.value;
			selectionRestored = true;
		}
	}

	if (!selectionRestored && previousValue) {
		select.value = previousValue;
		selectionRestored = select.value === previousValue && select.selectedIndex !== -1;
	}

	if (selectionRestored) {
		updateClientDetailsFromSelect(select);
	} else {
		if (placeholderOption) {
			placeholderOption.selected = true;
			select.value = placeholderOption.value;
		} else if (select.options.length > 0) {
			select.selectedIndex = 0;
		} else {
			select.value = '';
		}
		clearClientDetails();
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
