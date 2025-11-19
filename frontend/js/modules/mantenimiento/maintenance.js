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
        let retries = 3;
        let delay = 500;
        
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                clientes = await obtenerClientes();
                break; // Éxito, salir del loop
            } catch (error) {
                console.warn(`Intento ${attempt}/${retries} de cargar clientes falló:`, error);
                
                if (attempt < retries) {
                    // Esperar antes del próximo intento
                    await new Promise(resolve => setTimeout(resolve, delay));
                    delay *= 2; // Incrementar delay exponencialmente
                } else {
                    // Último intento falló
                    console.error('Error cargando clientes después de varios intentos:', error);
                    // No mostrar alert para mejor UX - los campos siguen siendo editables
                }
            }
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

            // Después de guardar, intentar imprimir el remito automáticamente
            // y luego resetear el formulario. Esto reproduce el comportamiento
            // esperado por los tests (se usan timers falsos en las pruebas).
            try {
                setTimeout(() => {
                    try {
                        if (typeof window !== 'undefined' && typeof window.print === 'function') {
                            window.print();
                        }
                    } catch (err) {
                        // Ignorar errores de impresión en entornos de test o sin navegador
                    }

                    // Resetear el formulario después del intento de impresión
                    try {
                        resetForm();
                    } catch (err) {
                        // ignore
                    }
                }, 150);
            } catch (err) {
                // ignore
            }
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

