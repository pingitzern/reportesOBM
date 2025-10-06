const VIEW_BUTTON_MAP = new Map([
    ['tab-nuevo', 'tab-nuevo-btn'],
    ['tab-buscar', 'tab-buscar-btn'],
    ['tab-dashboard', 'tab-dashboard-btn'],
    ['remitos-gestion-view', 'nav-remitos-btn'],
]);

function normalizeId(value) {
    if (typeof value !== 'string') {
        return '';
    }
    return value.trim();
}

function sanitizeViewId(view) {
    if (!view) {
        return '';
    }

    if (typeof view === 'string') {
        return normalizeId(view);
    }

    if (view instanceof HTMLElement) {
        return view.id ? normalizeId(view.id) : normalizeId(view.dataset?.view);
    }

    return '';
}

function toggleViewVisibility(viewElement, shouldShow) {
    if (!viewElement) {
        return;
    }

    if (shouldShow) {
        viewElement.classList.remove('hidden');
    } else {
        viewElement.classList.add('hidden');
    }
}

function updateButtonState(viewId) {
    const normalizedViewId = normalizeId(viewId);

    VIEW_BUTTON_MAP.forEach((buttonId, mappedViewId) => {
        const button = document.getElementById(buttonId);
        if (!button) {
            return;
        }

        if (mappedViewId === normalizedViewId) {
            button.classList.add('active');
            button.setAttribute('aria-current', 'page');
        } else {
            button.classList.remove('active');
            button.removeAttribute('aria-current');
        }
    });
}

export function registerView(viewId, buttonId) {
    const normalizedViewId = normalizeId(viewId);

    if (!normalizedViewId) {
        return;
    }

    if (typeof buttonId === 'string' && buttonId.trim()) {
        VIEW_BUTTON_MAP.set(normalizedViewId, buttonId.trim());
    } else {
        VIEW_BUTTON_MAP.delete(normalizedViewId);
    }
}

export function showView(viewId) {
    const normalizedViewId = normalizeId(viewId);
    if (!normalizedViewId) {
        return false;
    }

    const managedViews = Array.from(document.querySelectorAll('[data-view]'));
    let viewFound = false;

    managedViews.forEach((viewElement) => {
        const currentViewId = sanitizeViewId(viewElement);
        const shouldShow = currentViewId === normalizedViewId;
        if (shouldShow) {
            viewFound = true;
        }
        toggleViewVisibility(viewElement, shouldShow);
    });

    if (!viewFound) {
        const fallback = document.getElementById(normalizedViewId);
        if (fallback) {
            toggleViewVisibility(fallback, true);
            viewFound = true;
        }
    }

    if (viewFound) {
        updateButtonState(normalizedViewId);
    }

    return viewFound;
}

export function getRegisteredViews() {
    return Array.from(VIEW_BUTTON_MAP.keys());
}

