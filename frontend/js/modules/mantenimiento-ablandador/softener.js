const SOFTENER_VIEW_ID = 'tab-ablandador';
const SOFTENER_CONTAINER_ID = 'softener-form-container';

function getElement(id) {
    return document.getElementById(id);
}

function renderPlaceholder(container) {
    if (!container) {
        return;
    }

    container.innerHTML = `
        <div class="rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/60 p-6 text-center text-emerald-900">
            <h3 class="text-lg font-semibold">Formulario en preparación</h3>
            <p class="mt-2 text-sm">
                Estamos trabajando en el formulario de mantenimiento para ablandadores. Pronto vas a poder cargar los datos desde aquí.
            </p>
        </div>
    `;
}

export function createSoftenerModule(deps = {}) {
    const { showView } = deps;
    let initialized = false;

    function ensureInitialized() {
        if (initialized) {
            return;
        }

        const container = getElement(SOFTENER_CONTAINER_ID);
        renderPlaceholder(container);
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
