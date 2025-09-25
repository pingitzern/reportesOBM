import {
    clearSearchResults,
    getEditFormValues,
    openEditModal,
    closeEditModal,
    renderSearchResults,
} from './search.js';

function getElement(id) {
    return document.getElementById(id);
}

export function createSearchModule(api, dependencies = {}) {
    const { buscarMantenimientos, actualizarMantenimiento, eliminarMantenimiento } = api;
    const { showView: showViewFn } = dependencies;

    let eventsInitialized = false;

    async function handleBuscarClick() {
        const filtros = {
            cliente: getElement('buscar-cliente')?.value || '',
            tecnico: getElement('buscar-tecnico')?.value || '',
            fecha: getElement('buscar-fecha')?.value || '',
        };

        try {
            const resultados = await buscarMantenimientos(filtros);
            renderSearchResults(resultados, {
                onEdit: handleEditarMantenimiento,
                onDelete: handleEliminarMantenimiento,
            });
        } catch (error) {
            console.error('Error buscando mantenimientos:', error);
            const message = error?.message || 'Error desconocido al buscar mantenimientos.';
            alert(`❌ Error al buscar mantenimientos: ${message}`);
        }
    }

    function handleLimpiarBusqueda() {
        ['buscar-cliente', 'buscar-tecnico', 'buscar-fecha'].forEach(id => {
            const element = getElement(id);
            if (element) {
                element.value = '';
            }
        });

        clearSearchResults();
    }

    function handleEditarMantenimiento(mantenimiento) {
        if (!mantenimiento) {
            return;
        }
        openEditModal(mantenimiento);
    }

    async function handleEliminarMantenimiento(mantenimiento) {
        if (!mantenimiento?.ID_Unico) {
            return;
        }

        const confirmacion = window.confirm('¿Estás seguro de que quieres eliminar este mantenimiento?');
        if (!confirmacion) {
            return;
        }

        try {
            await eliminarMantenimiento(mantenimiento.ID_Unico);
            alert('✅ Mantenimiento eliminado correctamente');
            await handleBuscarClick();
        } catch (error) {
            console.error('Error eliminando mantenimiento:', error);
            alert('Error al eliminar mantenimiento');
        }
    }

    async function handleGuardarEdicion() {
        try {
            const datos = getEditFormValues();
            await actualizarMantenimiento(datos);
            alert('✅ Cambios guardados correctamente');
            closeEditModal();
            await handleBuscarClick();
        } catch (error) {
            console.error('Error guardando cambios:', error);
            alert('Error al guardar cambios');
        }
    }

    function initialize() {
        if (eventsInitialized) {
            return;
        }

        const buscarBtn = getElement('buscar-btn');
        if (buscarBtn) {
            buscarBtn.addEventListener('click', event => {
                event.preventDefault();
                handleBuscarClick();
            });
        }

        const limpiarBtn = getElement('limpiar-btn');
        if (limpiarBtn) {
            limpiarBtn.addEventListener('click', event => {
                event.preventDefault();
                handleLimpiarBusqueda();
            });
        }

        const cancelarEdicionBtn = getElement('cancelar-edicion-btn');
        if (cancelarEdicionBtn) {
            cancelarEdicionBtn.addEventListener('click', event => {
                event.preventDefault();
                closeEditModal();
            });
        }

        const guardarEdicionBtn = getElement('guardar-edicion-btn');
        if (guardarEdicionBtn) {
            guardarEdicionBtn.addEventListener('click', event => {
                event.preventDefault();
                handleGuardarEdicion();
            });
        }

        eventsInitialized = true;
    }

    function show() {
        if (typeof showViewFn === 'function') {
            showViewFn('tab-buscar');
        }
    }

    return {
        initialize,
        show,
        handleBuscarClick,
        handleLimpiarBusqueda,
        handleEditarMantenimiento,
        handleEliminarMantenimiento,
        handleGuardarEdicion,
    };
}

