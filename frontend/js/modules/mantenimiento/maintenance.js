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
    let isReportSaved = false;

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

    function setButtonsToInitialState() {
        const guardarBtn = getElement('guardarButton');
        const resetBtn = getElement('resetButton');
        const autoFillBtn = getElement('autoFillButton');

        if (guardarBtn) {
            guardarBtn.disabled = false;
            guardarBtn.style.cursor = 'pointer';
            guardarBtn.textContent = 'Guardar';
        }

        if (resetBtn) {
            resetBtn.disabled = false;
            resetBtn.style.cursor = 'pointer';
        }

        if (autoFillBtn) {
            autoFillBtn.disabled = false;
            autoFillBtn.style.cursor = 'pointer';
        }

        isReportSaved = false;
        hideFormLockedOverlay();
    }

    function showFormLockedOverlay() {
        // Agregar overlay a cada form-card individualmente
        const form = getElement('maintenance-form');
        if (!form) return;
        
        const formCards = form.querySelectorAll('.form-card');
        formCards.forEach(card => {
            // Verificar si ya tiene overlay
            if (card.querySelector('.form-card-overlay')) return;
            
            card.style.position = 'relative';
            const overlay = document.createElement('div');
            overlay.className = 'form-card-overlay';
            card.appendChild(overlay);
        });
        
        // Mostrar mensaje flotante
        let message = getElement('form-locked-message');
        if (!message) {
            message = document.createElement('div');
            message.id = 'form-locked-message';
            message.className = 'form-locked-floating-message';
            message.innerHTML = `
                <svg class="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <span>Reporte guardado - Continuá con el remito o limpiá para uno nuevo</span>
            `;
            form.insertBefore(message, form.firstChild);
        }
        message.classList.remove('hidden');
    }

    function hideFormLockedOverlay() {
        // Remover overlays de cada form-card
        const form = getElement('maintenance-form');
        if (!form) return;
        
        const overlays = form.querySelectorAll('.form-card-overlay');
        overlays.forEach(overlay => overlay.remove());
        
        // Ocultar mensaje
        const message = getElement('form-locked-message');
        if (message) {
            message.classList.add('hidden');
        }
    }

    function setButtonsToSavedState() {
        const guardarBtn = getElement('guardarButton');
        const resetBtn = getElement('resetButton');
        const autoFillBtn = getElement('autoFillButton');

        if (guardarBtn) {
            guardarBtn.disabled = true;
            guardarBtn.style.cursor = 'not-allowed';
            guardarBtn.textContent = 'Guardado ✓';
        }

        if (resetBtn) {
            resetBtn.disabled = false;
            resetBtn.style.cursor = 'pointer';
        }

        if (autoFillBtn) {
            autoFillBtn.disabled = true;
            autoFillBtn.style.cursor = 'not-allowed';
        }

        isReportSaved = true;
        showFormLockedOverlay();
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
        setButtonsToInitialState();
        notifyReportReset();
        attachEvents();
    }

    function handleResetClick() {
        resetForm();
        setButtonsToInitialState();
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

        // Si ya está guardado, mostrar confirmación
        if (isReportSaved) {
            const confirmSave = confirm(
                '⚠️ Este reporte ya fue guardado.\n\n¿Deseas guardar una copia duplicada?'
            );
            if (!confirmSave) {
                return;
            }
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
            setButtonsToSavedState();
            notifyReportSaved(datos);

            // Mostrar mensaje de éxito - el usuario decide si generar remito o nuevo reporte
            alert('✅ Mantenimiento guardado correctamente.\n\nAhora podés:\n• Generar Remito (botón en la sección de remito)\n• Generar PDF\n• Crear nuevo reporte (botón Limpiar)');
        } catch (error) {
            console.error('Error al guardar mantenimiento:', error);
            const message = error?.message || 'Error desconocido al guardar los datos.';
            alert(`❌ Error al guardar los datos: ${message}`);
            
            // Solo restaurar botones en caso de error
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

