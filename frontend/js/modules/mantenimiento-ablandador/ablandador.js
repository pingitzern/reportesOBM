import { guardarMantenimientoAblandador as guardarMantenimientoAblandadorApi } from '../../api.js';

const SOFTENER_VIEW_ID = 'tab-ablandador';
const FORM_ID = 'softener-maintenance-form';
const SAVE_BUTTON_ID = 'softener-save-button';
const RESET_BUTTON_ID = 'softener-reset-button';
const AUTONOMIA_CALCULADA_ID = 'softener-autonomia-calculada-as-left';
const AUTONOMIA_RECOMENDADA_ID = 'softener-autonomia-recomendada-as-left';
const FACTOR_PROTECCION_ID = 'softener-factor-proteccion';

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
        version: '2.0',
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

    const volumenResinaAsLeft = getNumberValue('softener-volumen-resina-as-left');
    const capacidadIntercambioAsLeft = getNumberValue('softener-capacidad-intercambio-as-left');
    const durezaEntradaAsLeft = getNumberValue('softener-dureza-entrada-as-left');
    const autonomiaCalculada = getNumberValue(AUTONOMIA_CALCULADA_ID);
    const autonomiaRecomendada = getNumberValue(AUTONOMIA_RECOMENDADA_ID);

    const seccionB = buildSection([
        ['tipo', getInputValue('softener-equipo-tipo')],
        ['modelo', getInputValue('softener-equipo-modelo')],
        ['numero_serie', getInputValue('softener-equipo-numero-serie')],
        ['ubicacion', getInputValue('softener-equipo-ubicacion')],
        ['caudal', getNumberValue('softener-equipo-caudal')],
        ['capacidad', getNumberValue('softener-equipo-capacidad')],
        ['volumen_resina_as_found', getNumberValue('softener-volumen-resina-as-found')],
        ['volumen_resina_as_left', volumenResinaAsLeft],
        ['capacidad_intercambio_as_found', getNumberValue('softener-capacidad-intercambio-as-found')],
        ['capacidad_intercambio_as_left', capacidadIntercambioAsLeft],
        ['nivel_sal_as_found', getInputValue('softener-nivel-sal-as-found')],
        ['nivel_sal_as_left', getInputValue('softener-nivel-sal-as-left')],
        ['notas_equipo', getInputValue('softener-equipo-notas')],
    ]);

    const seccionC = buildSection([
        ['dureza_entrada_as_found', getNumberValue('softener-dureza-entrada-as-found')],
        ['dureza_entrada_as_left', durezaEntradaAsLeft],
        ['dureza_salida_as_found', getNumberValue('softener-dureza-salida-as-found')],
        ['dureza_salida_as_left', getNumberValue('softener-dureza-salida-as-left')],
        ['ph_as_found', getNumberValue('softener-ph-as-found')],
        ['ph_as_left', getNumberValue('softener-ph-as-left')],
        ['cloro_as_found', getNumberValue('softener-cloro-as-found')],
        ['cloro_as_left', getNumberValue('softener-cloro-as-left')],
        ['test_cloro_as_found', getInputValue('softener-test-cloro-as-found')],
        ['test_cloro_as_left', getInputValue('softener-test-cloro-as-left')],
        ['dureza_entrada', durezaEntradaAsLeft],
        ['dureza_salida', getNumberValue('softener-dureza-salida-as-left')],
        ['ph', getNumberValue('softener-ph-as-left')],
        ['cloro', getNumberValue('softener-cloro-as-left')],
        ['autonomia_calculada_as_left', autonomiaCalculada],
        ['autonomia_recomendada_as_left', autonomiaRecomendada],
        ['aplicar_factor_proteccion_as_left', getCheckboxValue(FACTOR_PROTECCION_ID)],
        ['observaciones', getInputValue('softener-parametros-observaciones')],
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

    return {
        metadata,
        seccion_A_cliente: seccionA,
        seccion_B_equipo: seccionB,
        seccion_C_parametros: seccionC,
        seccion_D_checklist: seccionD,
        seccion_E_resumen: seccionE,
        seccion_F_condiciones: seccionF,
        seccion_G_cierre: seccionG,
    };
}

function updateAutonomia() {
    const volumenResina = getNumberValue('softener-volumen-resina-as-left');
    const capacidadIntercambio = getNumberValue('softener-capacidad-intercambio-as-left');
    const durezaEntrada = getNumberValue('softener-dureza-entrada-as-left');
    const aplicarFactor = getCheckboxValue(FACTOR_PROTECCION_ID);

    let autonomiaCalculada = null;
    let autonomiaRecomendada = null;

    if (
        volumenResina !== null
        && capacidadIntercambio !== null
        && durezaEntrada !== null
        && durezaEntrada > 0
    ) {
        const divisor = durezaEntrada / 10;
        if (divisor > 0) {
            autonomiaCalculada = (volumenResina * capacidadIntercambio) / divisor;
            if (Number.isFinite(autonomiaCalculada)) {
                autonomiaRecomendada = aplicarFactor ? autonomiaCalculada * 0.8 : autonomiaCalculada;
            }
        }
    }

    setNumericFieldValue(AUTONOMIA_CALCULADA_ID, autonomiaCalculada);
    setNumericFieldValue(AUTONOMIA_RECOMENDADA_ID, autonomiaRecomendada);
}

export function createSoftenerModule(deps = {}) {
    const { showView, guardarMantenimientoAblandador: guardarAblandadorCustom } = deps;
    let initialized = false;
    const guardarMantenimientoFn = typeof guardarAblandadorCustom === 'function'
        ? guardarAblandadorCustom
        : guardarMantenimientoAblandadorApi;

    function attachAutonomiaListeners() {
        const triggerIds = [
            'softener-volumen-resina-as-left',
            'softener-capacidad-intercambio-as-left',
            'softener-dureza-entrada-as-left',
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
                setDefaultServiceDate();
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
                    setDefaultServiceDate();
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
        updateAutonomia();
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
