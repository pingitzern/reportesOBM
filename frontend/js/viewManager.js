const MAIN_VIEW_IDS = [
    'tab-nuevo',
    'tab-ablandador',
    'tab-buscar',
    'tab-dashboard',
    'remito-view',
    'remitos-gestion-view',
];

function hideElement(element) {
    if (!element) {
        return;
    }
    element.classList.add('hidden');
}

function showElement(element) {
    if (!element) {
        return;
    }
    element.classList.remove('hidden');
}

export function showView(viewId) {
    if (typeof viewId !== 'string' || !viewId) {
        return;
    }

    let viewFound = false;
    let shownViewId = null;

    MAIN_VIEW_IDS.forEach(id => {
        const element = document.getElementById(id);
        if (!element) {
            return;
        }

        if (id === viewId) {
            showElement(element);
            viewFound = true;
            shownViewId = id;
            return;
        }

        hideElement(element);
    });

    if (!viewFound) {
        const targetElement = document.getElementById(viewId);
        if (targetElement) {
            showElement(targetElement);
            shownViewId = viewId;
        }
    }

    if (shownViewId) {
        document.dispatchEvent(new CustomEvent('view:changed', {
            detail: { viewId: shownViewId },
        }));
    }
}
