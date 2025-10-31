import {
    autoFillForm,
    configureClientSelect,
    generateReportNumber,
    getFormData,
    initializeForm,
    resetForm,
    setReportNumber,
} from '../../forms.js';
import { renderComponentStages } from '../../templates.js';

function getElement(id) {
    return document.getElementById(id);
}

export function createMaintenanceModule(api, callbacks = {}) {
    const { guardarMantenimiento, obtenerClientes } = api;
    const { onReportSaved, onReportReset } = callbacks;

    let eventsInitialized = false;

    function notifyReportReset() {
        if (typeof onReportReset === 'function') {
            onReportReset();
        }
    }

    function notifyReportSaved(datos) {
        if (typeof onReportSaved === 'function') {
            onReportSaved(datos);
        }
    }

    function attachEvents() {
        if (eventsInitialized) {
            return;
        }

        const guardarBtn = getElement('guardarButton');
        if (guardarBtn) {
            guardarBtn.addEventListener('click', event => {
                event.preventDefault();
                handleGuardarClick();
            });
        }

        const resetBtn = getElement('resetButton');
        if (resetBtn) {
            resetBtn.addEventListener('click', event => {
                event.preventDefault();
                handleResetClick();
            });
        }

        const autoFillBtn = getElement('autoFillButton');
        if (autoFillBtn) {
            autoFillBtn.addEventListener('click', event => {
                event.preventDefault();
                handleAutoFillClick();
            });
        }

        eventsInitialized = true;
    }

    async function cargarClientes() {
        let clientes = [];
        try {
            clientes = await obtenerClientes();
        } catch (error) {
            console.error('Error cargando clientes:', error);
            const detalle = error?.message ? ` Detalle: ${error.message}` : '';
            alert(`No se pudieron cargar los datos de clientes. Podrás completar los campos manualmente.${detalle}`);
        }

        configureClientSelect(clientes);
    }

    async function initialize() {
        renderComponentStages();
        await cargarClientes();
        initializeForm();
        notifyReportReset();
        attachEvents();
    }

    function handleResetClick() {
        resetForm();
        notifyReportReset();
    }

    function handleAutoFillClick() {
        autoFillForm();
    }

    async function handleGuardarClick() {
        const guardarBtn = getElement('guardarButton');
        if (!guardarBtn) {
            return;
        }

        const originalText = guardarBtn.textContent;
        guardarBtn.textContent = 'Guardando...';
        guardarBtn.disabled = true;

        try {
            const reportNumber = generateReportNumber();
            const datos = getFormData();
            if (datos && typeof datos === 'object') {
                datos.numero_reporte = reportNumber;
            }

            await guardarMantenimiento(datos);
            setReportNumber(reportNumber);
            notifyReportSaved(datos);

            alert('✅ Mantenimiento guardado correctamente en el sistema');
        } catch (error) {
            console.error('Error al guardar mantenimiento:', error);
            const message = error?.message || 'Error desconocido al guardar los datos.';
            alert(`❌ Error al guardar los datos: ${message}`);
        } finally {
            guardarBtn.textContent = originalText;
            guardarBtn.disabled = false;
        }
    }

    return {
        initialize,
        handleGuardarClick,
        handleResetClick,
    };
}

