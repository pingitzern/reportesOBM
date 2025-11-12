import {
    guardarMantenimientoAblandador as guardarMantenimientoAblandadorApi,
    obtenerClientes as obtenerClientesApi,
} from '../../api.js';

const SOFTENER_VIEW_ID = 'tab-ablandador';
const FORM_ID = 'softener-maintenance-form';
const SAVE_BUTTON_ID = 'softener-save-button';
const RESET_BUTTON_ID = 'softener-reset-button';
const AUTONOMIA_CALCULADA_ID = 'softener-autonomia-calculada';
const AUTONOMIA_RECOMENDADA_ID = 'softener-autonomia-recomendada';
const AUTONOMIA_SETEO_ACTUAL_ID = 'softener-autonomia-seteo-actual';
const AUTONOMIA_AJUSTADA_ID = 'softener-autonomia-ajustada';
const VOLUMEN_RESINA_ID = 'softener-volumen-resina';
const FACTOR_PROTECCION_ID = 'softener-factor-proteccion';
const DUREZA_AGUA_CRUDA_ID = 'softener-dureza-agua-cruda';
const CLIENT_SELECT_ID = 'softener-cliente-nombre';
const CLIENT_OPTION_ATTRIBUTE = 'data-softener-client-option';
const CLIENT_KEY_ATTRIBUTE = 'data-softener-client-key';
const CLIENT_DETAIL_FIELD_IDS = Object.freeze([
    'softener-cliente-direccion',
    'softener-cliente-telefono',
    'softener-cliente-email',
    'softener-cliente-cuit',
]);
const CLIENT_DETAIL_EMPTY_CLASS = 'client-detail-empty';
const CLIENT_DETAIL_LOCKED_CLASS = 'client-detail-locked';

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

const clienteDataMap = new Map();
const clientDetailInputsWithListener = new WeakSet();
let clienteSelectChangeHandler = null;
let clientesLoaded = false;
let clientesLoadingPromise = null;
let clientAutocompleteInitialized = false;

function getElement(id) {
    return typeof document !== 'undefined' ? document.getElementById(id) : null;
}

function schedulePostReset(callback) {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(callback);
        return;
    }
    setTimeout(callback, 0);
}

function parseNumber(value) {
    if (value === null || value === undefined) {
        return null;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    const normalized = String(value).replace(',', '.').trim();
    if (!normalized) {
        return null;
    }
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
}

function getInputValue(id) {
    const element = getElement(id);
    if (!element) {
        return '';
    }
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
        return element.value.trim();
    }
    return '';
}

function getNumberValue(id) {
    return parseNumber(getInputValue(id));
}

function getCheckboxValue(id) {
    const element = getElement(id);
    if (element instanceof HTMLInputElement) {
        return Boolean(element.checked);
    }
    return false;
}

function setNumericFieldValue(id, value) {
    const element = getElement(id);
    if (!(element instanceof HTMLInputElement)) {
        return;
    }
    if (value === null || value === undefined || Number.isNaN(value)) {
        element.value = '';
        return;
    }
    const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
    element.value = Number.isFinite(rounded) ? rounded.toString() : '';
}

function normalizeString(value) {
    if (value === null || value === undefined) {
        return '';
    }
    return String(value).trim();
}

function getFirstAvailableField(source, fieldNames) {
    if (!source || typeof source !== 'object') {
        return '';
    }

    for (const field of fieldNames) {
        if (Object.prototype.hasOwnProperty.call(source, field)) {
            const normalized = normalizeString(source[field]);
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

    const hasValue = normalizeString(element.value) !== '';

    if (lockWhenFilled && hasValue) {
        element.readOnly = true;
        element.disabled = false;
    } else if (!hasValue) {
        element.readOnly = false;
        element.disabled = false;
    }

    if (hasValue) {
        element.classList.remove(CLIENT_DETAIL_EMPTY_CLASS);
        if (lockWhenFilled) {
            element.classList.add(CLIENT_DETAIL_LOCKED_CLASS);
        }
    } else {
        element.classList.add(CLIENT_DETAIL_EMPTY_CLASS);
        element.classList.remove(CLIENT_DETAIL_LOCKED_CLASS);
    }
}

function setClientDetailValue(fieldId, value, options = {}) {
    const element = getElement(fieldId);
    if (!element) {
        return;
    }

    const normalizedValue = normalizeString(value);

    if ('value' in element) {
        element.value = normalizedValue;
    }

    if (element instanceof HTMLInputElement) {
        refreshClientDetailFieldState(element, { lockWhenFilled: Boolean(options.lockWhenFilled) });
    }
}

function applyClientDetails(details = {}) {
    setClientDetailValue('softener-cliente-direccion', details.direccion, { lockWhenFilled: true });
    setClientDetailValue('softener-cliente-telefono', details.telefono, { lockWhenFilled: true });
    setClientDetailValue('softener-cliente-email', details.email, { lockWhenFilled: true });
    setClientDetailValue('softener-cliente-cuit', details.cuit, { lockWhenFilled: true });
}

function clearClientDetails() {
    CLIENT_DETAIL_FIELD_IDS.forEach(fieldId => {
        setClientDetailValue(fieldId, '', { lockWhenFilled: false });
    });
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

function updateClientDetailsFromSelect(selectElement) {
    if (!(selectElement instanceof HTMLSelectElement)) {
        clearClientDetails();
        return;
    }

    let selectedDetails = null;

    const selectedOption = selectElement.selectedOptions && selectElement.selectedOptions[0];
    if (selectedOption) {
        const optionKey = selectedOption.getAttribute(CLIENT_KEY_ATTRIBUTE);
        if (optionKey) {
            selectedDetails = clienteDataMap.get(optionKey) || null;
        }
    }

    if (!selectedDetails && typeof selectElement.selectedIndex === 'number' && selectElement.selectedIndex >= 0) {
        const optionByIndex = selectElement.options[selectElement.selectedIndex];
        if (optionByIndex) {
            const keyByIndex = optionByIndex.getAttribute(CLIENT_KEY_ATTRIBUTE);
            if (keyByIndex) {
                selectedDetails = clienteDataMap.get(keyByIndex) || null;
            }
        }
    }

    if (!selectedDetails) {
        selectedDetails = clienteDataMap.get(selectElement.value) || null;
    }

    if (selectedDetails) {
        applyClientDetails(selectedDetails);
    } else {
        clearClientDetails();
    }
}

function resetClientSelection() {
    const select = getElement(CLIENT_SELECT_ID);
    if (!(select instanceof HTMLSelectElement)) {
        clearClientDetails();
        return;
    }

    const placeholderOption = select.querySelector('option[value=""]');
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

function populateClientSelect(clientes = []) {
    const select = getElement(CLIENT_SELECT_ID);
    if (!(select instanceof HTMLSelectElement)) {
        return;
    }

    const clientesArray = Array.isArray(clientes) ? clientes : [];
    const previousValue = select.value;
    const previousOption = select.selectedOptions && select.selectedOptions[0];
    const previousKey = previousOption ? previousOption.getAttribute(CLIENT_KEY_ATTRIBUTE) : null;
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
        const key = `softener-cliente-${index}`;
        option.setAttribute(CLIENT_OPTION_ATTRIBUTE, 'true');
        option.setAttribute(CLIENT_KEY_ATTRIBUTE, key);
        fragment.appendChild(option);

        clienteDataMap.set(key, createClientDetails(cliente));
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

    if (previousKey) {
        const matchingOption = select.querySelector(`option[${CLIENT_KEY_ATTRIBUTE}="${previousKey}"]`);
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

async function loadClientes(obtenerClientesFn) {
    if (clientesLoaded) {
        return;
    }

    if (clientesLoadingPromise) {
        await clientesLoadingPromise;
        return;
    }

    if (typeof obtenerClientesFn !== 'function') {
        return;
    }

    clientesLoadingPromise = (async () => {
        try {
            const clientes = await obtenerClientesFn({ forceRefresh: false });
            populateClientSelect(clientes);
            clientesLoaded = true;
        } catch (error) {
            console.error('Error al cargar clientes para ablandador:', error);
            alert('No se pudieron cargar los datos de clientes. Completá los campos manualmente.');
            populateClientSelect([]);
        } finally {
            clientesLoadingPromise = null;
        }
    })();

    await clientesLoadingPromise;
}

function initializeClientAutocomplete(obtenerClientesFn) {
    if (!clientAutocompleteInitialized) {
        configureClientDetailFieldInteractions();
        resetClientSelection();
        clientAutocompleteInitialized = true;
    }

    if (typeof obtenerClientesFn === 'function') {
        loadClientes(obtenerClientesFn);
    }
}

function setDefaultServiceDate() {
    const dateInput = getElement('softener-fecha-servicio');
    if (dateInput instanceof HTMLInputElement && !dateInput.value) {
        const today = new Date();
        const iso = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 10);
        dateInput.value = iso;
    }
}

function setDefaultResinVolume() {
    const volumenInput = getElement(VOLUMEN_RESINA_ID);
    if (volumenInput instanceof HTMLInputElement && !volumenInput.value) {
        volumenInput.value = '25';
    }
}

function normalizeDateValue(value) {
    if (!value) {
        return '';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }
    const iso = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 10);
    return iso;
}

function buildSection(entries) {
    const section = {};
    entries.forEach(([key, value, options]) => {
        const includeEmpty = Boolean(options && options.includeEmpty);
        if (value === undefined) {
            return;
        }
        if (value === '' && !includeEmpty) {
            return;
        }
        if (value === null && !includeEmpty) {
            return;
        }
        section[key] = value;
    });
    return section;
}

function collectFormData() {
    const metadata = {
        formulario: 'mantenimiento_ablandador',
        version: '3.1',
        generado_en: new Date().toISOString(),
    };

    const seccionA = buildSection([
        ['nombre', getInputValue('softener-cliente-nombre')],
        ['direccion', getInputValue('softener-cliente-direccion')],
        ['localidad', getInputValue('softener-cliente-localidad')],
        ['contacto', getInputValue('softener-cliente-contacto')],
        ['telefono', getInputValue('softener-cliente-telefono')],
        ['email', getInputValue('softener-cliente-email')],
        ['cuit', getInputValue('softener-cliente-cuit')],
        ['fecha_servicio', normalizeDateValue(getInputValue('softener-fecha-servicio'))],
        ['tecnico', getInputValue('softener-tecnico')],
    ]);

    const volumenResina = getNumberValue(VOLUMEN_RESINA_ID);
    const durezaAguaCruda = getNumberValue(DUREZA_AGUA_CRUDA_ID);
    const autonomiaCalculada = getNumberValue(AUTONOMIA_CALCULADA_ID);
    const autonomiaRecomendada = getNumberValue(AUTONOMIA_RECOMENDADA_ID);
    const seteoActualAutonomia = getNumberValue(AUTONOMIA_SETEO_ACTUAL_ID);
    const aplicarProteccion = getCheckboxValue(FACTOR_PROTECCION_ID);
    const autonomiaAjustada = getCheckboxValue(AUTONOMIA_AJUSTADA_ID);

    const presionEntradaAsFound = getNumberValue('softener-param-presion-entrada-found');
    const presionEntradaAsLeft = getNumberValue('softener-param-presion-entrada-left');
    const testCloroAsFound = getNumberValue('softener-param-test-cloro-found');
    const testCloroAsLeft = getNumberValue('softener-param-test-cloro-left');
    const durezaSalidaAsFound = getNumberValue('softener-param-dureza-salida-found');
    const durezaSalidaAsLeft = getNumberValue('softener-param-dureza-salida-left');

    const seccionB = buildSection([
        ['tipo', getInputValue('softener-equipo-tipo')],
        ['modelo', getInputValue('softener-equipo-modelo')],
        ['numero_serie', getInputValue('softener-equipo-numero-serie')],
        ['ubicacion', getInputValue('softener-equipo-ubicacion')],
        ['volumen_resina', volumenResina],
        ['notas_equipo', getInputValue('softener-equipo-notas')],
    ]);

    const seccionBParametrosOperacion = buildSection([
        ['presion_entrada_as_found', presionEntradaAsFound],
        ['presion_entrada_as_left', presionEntradaAsLeft],
        ['test_cloro_entrada_as_found', testCloroAsFound],
        ['test_cloro_entrada_as_left', testCloroAsLeft],
        ['dureza_salida_as_found', durezaSalidaAsFound],
        ['dureza_salida_as_left', durezaSalidaAsLeft],
    ]);

    const seccionC = buildSection([
        ['dureza_agua_cruda', durezaAguaCruda],
        ['seteo_actual_autonomia', seteoActualAutonomia],
        ['autonomia_calculada', autonomiaCalculada],
        ['aplicar_proteccion_20', aplicarProteccion],
        ['autonomia_recomendada', autonomiaRecomendada],
        ['autonomia_ajustada_valor_calculado', autonomiaAjustada],
    ]);

    const seccionD = buildSection([
        ['regeneracion_automatica', getCheckboxValue('softener-check-regeneracion')],
        ['limpieza_tanque_sal', getCheckboxValue('softener-check-limpieza-tanque')],
        ['valvulas_operativas', getCheckboxValue('softener-check-valvulas')],
        ['fugas', getCheckboxValue('softener-check-fugas')],
        ['cambio_resina', getCheckboxValue('softener-check-resina')],
        ['factor_proteccion_confirmado', getCheckboxValue('softener-check-factor-proteccion')],
        ['otros', getInputValue('softener-check-otros')],
        ['observaciones', getInputValue('softener-check-observaciones')],
    ]);

    const seccionE = buildSection([
        ['trabajo_realizado', getInputValue('softener-resumen-trabajo')],
        ['recomendaciones', getInputValue('softener-resumen-recomendaciones')],
        ['proximo_servicio', normalizeDateValue(getInputValue('softener-resumen-proximo-servicio'))],
        ['materiales', getInputValue('softener-resumen-materiales')],
        ['comentarios_cliente', getInputValue('softener-resumen-notas-cliente')],
    ]);

    const seccionF = buildSection([
        ['presion_entrada_as_found', getNumberValue('softener-presion-entrada-as-found')],
        ['presion_entrada_as_left', getNumberValue('softener-presion-entrada-as-left')],
        ['presion_salida_as_found', getNumberValue('softener-presion-salida-as-found')],
        ['presion_salida_as_left', getNumberValue('softener-presion-salida-as-left')],
        ['conductividad_as_found', getNumberValue('softener-conductividad-as-found')],
        ['conductividad_as_left', getNumberValue('softener-conductividad-as-left')],
        ['nivel_sal_as_found', getInputValue('softener-nivel-sal-as-found')],
        ['nivel_sal_as_left', getInputValue('softener-nivel-sal-as-left')],
        ['temperatura_ambiente', getInputValue('softener-temperatura-ambiente')],
        ['estado_gabinete', getInputValue('softener-estado-gabinete')],
        ['observaciones', getInputValue('softener-condiciones-observaciones')],
    ]);

    const seccionG = buildSection([
        ['conformidad_cliente', getInputValue('softener-conformidad-cliente')],
        ['representante_cliente', getInputValue('softener-representante-cliente')],
        ['medio_confirmacion', getInputValue('softener-medio-confirmacion')],
        ['requiere_seguimiento', getCheckboxValue('softener-requiere-seguimiento')],
        ['observaciones_finales', getInputValue('softener-observaciones-finales')],
    ]);

    const payload = {
        metadata,
        seccion_A_cliente: seccionA,
        seccion_B_equipo: seccionB,
        seccion_C_parametros: seccionC,
        seccion_D_checklist: seccionD,
        seccion_E_resumen: seccionE,
        seccion_F_condiciones: seccionF,
        seccion_G_cierre: seccionG,
    };

    if (Object.keys(seccionBParametrosOperacion).length > 0) {
        payload.seccion_B_parametros_operacion = seccionBParametrosOperacion;
    }

    return payload;
}

function updateAutonomia() {
    const volumenResina = getNumberValue(VOLUMEN_RESINA_ID);
    const durezaEntrada = getNumberValue(DUREZA_AGUA_CRUDA_ID);
    const aplicarFactor = getCheckboxValue(FACTOR_PROTECCION_ID);

    let autonomiaRecomendada = null;

    if (volumenResina !== null && durezaEntrada !== null && durezaEntrada > 0) {
        const durezaNormalizada = durezaEntrada / 10;
        if (durezaNormalizada > 0) {
            const resultado = (volumenResina * 6) / durezaNormalizada;
            if (Number.isFinite(resultado)) {
                autonomiaRecomendada = aplicarFactor ? resultado * 0.8 : resultado;
            }
        }
    }

    setNumericFieldValue(AUTONOMIA_RECOMENDADA_ID, autonomiaRecomendada);
}

export function createSoftenerModule(deps = {}) {
    const {
        showView,
        guardarMantenimientoAblandador: guardarAblandadorCustom,
        obtenerClientes: obtenerClientesCustom,
    } = deps;
    let initialized = false;
    const guardarMantenimientoFn = typeof guardarAblandadorCustom === 'function'
        ? guardarAblandadorCustom
        : guardarMantenimientoAblandadorApi;
    const obtenerClientesFn = typeof obtenerClientesCustom === 'function'
        ? obtenerClientesCustom
        : obtenerClientesApi;

    function attachAutonomiaListeners() {
        const triggerIds = [
            VOLUMEN_RESINA_ID,
            DUREZA_AGUA_CRUDA_ID,
        ];
        triggerIds.forEach(id => {
            const element = getElement(id);
            if (element instanceof HTMLInputElement) {
                element.addEventListener('input', updateAutonomia);
            }
        });

        const factorCheckbox = getElement(FACTOR_PROTECCION_ID);
        if (factorCheckbox instanceof HTMLInputElement) {
            factorCheckbox.addEventListener('change', updateAutonomia);
        }
    }

    function attachFormHandlers() {
        const form = getElement(FORM_ID);
        if (!(form instanceof HTMLFormElement)) {
            return;
        }

        form.addEventListener('reset', () => {
            schedulePostReset(() => {
                resetClientSelection();
                setDefaultServiceDate();
                setDefaultResinVolume();
                updateAutonomia();
            });
        });

        const saveButton = getElement(SAVE_BUTTON_ID);
        if (saveButton instanceof HTMLButtonElement) {
            saveButton.addEventListener('click', async event => {
                event.preventDefault();
                await handleSaveClick(saveButton);
            });
        }

        const resetButton = getElement(RESET_BUTTON_ID);
        if (resetButton instanceof HTMLButtonElement) {
            resetButton.addEventListener('click', () => {
                setTimeout(() => {
                    resetClientSelection();
                    setDefaultServiceDate();
                    setDefaultResinVolume();
                    updateAutonomia();
                }, 0);
            });
        }
    }

    async function handleSaveClick(saveButton) {
        const form = getElement(FORM_ID);
        if (!(form instanceof HTMLFormElement)) {
            alert('El formulario de mantenimiento de ablandador no está disponible.');
            return;
        }

        const originalText = saveButton.textContent;
        saveButton.disabled = true;
        saveButton.textContent = 'Guardando...';

        try {
            updateAutonomia();
            const payload = collectFormData();
            if (typeof guardarMantenimientoFn !== 'function') {
                throw new Error('Servicio de mantenimiento de ablandador no disponible.');
            }

            await guardarMantenimientoFn({ payload });
            alert('✅ Mantenimiento de ablandador guardado correctamente.');
            form.reset();
            setDefaultServiceDate();
            setDefaultResinVolume();
            updateAutonomia();
        } catch (error) {
            console.error('Error al guardar mantenimiento de ablandador:', error);
            const message = error?.message || 'No se pudieron guardar los datos del mantenimiento.';
            alert(`❌ Error al guardar los datos: ${message}`);
        } finally {
            saveButton.disabled = false;
            saveButton.textContent = originalText;
        }
    }

    function ensureInitialized() {
        if (initialized) {
            return;
        }
        const form = getElement(FORM_ID);
        if (!(form instanceof HTMLFormElement)) {
            return;
        }
        setDefaultServiceDate();
        setDefaultResinVolume();
        updateAutonomia();
        initializeClientAutocomplete(obtenerClientesFn);
        attachAutonomiaListeners();
        attachFormHandlers();
        initialized = true;
    }

    function initialize() {
        ensureInitialized();
    }

    function show() {
        ensureInitialized();
        if (typeof showView === 'function') {
            showView(SOFTENER_VIEW_ID);
        }
    }

    return {
        initialize,
        show,
    };
}

export default createSoftenerModule;
