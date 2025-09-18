const COMPONENT_STAGE_ACTIONS = [
    { value: 'Cambiado', label: 'Cambiado' },
    { value: 'Inspeccionado', label: 'Inspeccionado', default: true },
];

const COMPONENT_STAGES = [
    {
        id: 'etapa1',
        title: '1ª Sedimentos (PP)',
        placeholder: 'Micronaje: __ µm',
    },
    {
        id: 'etapa2',
        title: '2ª Carbón Bloque (CTO)',
        placeholder: 'Modelo/Tipo',
    },
    {
        id: 'etapa3',
        title: '3ª Carbón GAC / PP',
        placeholder: 'Micronaje/Tipo',
    },
    {
        id: 'etapa4',
        title: '4ª Membrana RO',
        placeholder: 'Caudal GPD | S/N',
        emphasize: true,
    },
    {
        id: 'etapa5',
        title: '5ª Post-Filtro',
        placeholder: 'Tipo: Carbón, Remineralizador...',
    },
    {
        id: 'etapa6',
        title: '6ª Adicional',
        placeholder: 'Tipo: UV, Alcalino...',
    },
];

function createActionLabel(stageId, actions) {
    if (!Array.isArray(actions) || actions.length === 0) {
        return null;
    }

    const validActions = actions.filter(action => action && typeof action === 'object');
    if (validActions.length === 0) {
        return null;
    }

    const defaultAction =
        validActions.find(action => action.default) || validActions[0];
    const alternateAction =
        validActions.find(action => action !== defaultAction) || defaultAction;

    const fragment = document.createDocumentFragment();

    const hiddenInput = document.createElement('input');
    hiddenInput.type = 'hidden';
    hiddenInput.name = `${stageId}_accion`;
    hiddenInput.value = typeof defaultAction.value === 'string'
        ? defaultAction.value
        : String(defaultAction.value ?? '');
    hiddenInput.defaultValue = hiddenInput.value;
    fragment.appendChild(hiddenInput);

    const toggleLabel = document.createElement('label');
    toggleLabel.className = 'toggle-switch';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'toggle-switch-input';
    checkbox.setAttribute('role', 'switch');
    checkbox.setAttribute('aria-label', 'Alternar acción de la etapa');

    const slider = document.createElement('span');
    slider.className = 'toggle-switch-slider';
    slider.setAttribute('aria-hidden', 'true');

    toggleLabel.appendChild(checkbox);
    toggleLabel.appendChild(slider);
    fragment.appendChild(toggleLabel);

    const statusText = document.createElement('span');
    statusText.className = 'stage-action-status';
    statusText.id = `${stageId}_accion_estado`;
    fragment.appendChild(statusText);
    checkbox.setAttribute('aria-labelledby', statusText.id);

    const hasAlternateAction = alternateAction !== defaultAction;
    const defaultChecked = hasAlternateAction ? false : true;
    checkbox.checked = defaultChecked;
    checkbox.defaultChecked = defaultChecked;

    const updateState = (isChecked) => {
        const action = isChecked ? alternateAction : defaultAction;
        const value = typeof action.value === 'string' ? action.value : String(action.value ?? '');
        const label = typeof action.label === 'string' ? action.label : String(action.label ?? '');
        hiddenInput.value = value;
        statusText.textContent = label;
        checkbox.setAttribute('aria-checked', String(Boolean(isChecked)));
    };

    updateState(checkbox.checked);

    checkbox.addEventListener('change', () => {
        updateState(checkbox.checked);
    });

    const formElement = document.getElementById('maintenance-form');
    if (formElement instanceof HTMLFormElement) {
        formElement.addEventListener('reset', () => {
            const scheduler =
                typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
                    ? window.requestAnimationFrame.bind(window)
                    : (callback) => setTimeout(callback, 0);
            scheduler(() => {
                checkbox.checked = checkbox.defaultChecked;
                updateState(checkbox.checked);
            });
        });
    }

    return fragment;
}

function populateStage(fragment, stage) {
    const titleElement = fragment.querySelector('.stage-title');
    if (titleElement) {
        titleElement.textContent = stage.title;
        if (stage.emphasize) {
            titleElement.classList.add('font-bold');
        }
    }

    const detailsInput = fragment.querySelector('.stage-details');
    if (detailsInput) {
        detailsInput.id = `${stage.id}_detalles`;
        detailsInput.name = `${stage.id}_detalles`;
        detailsInput.placeholder = stage.placeholder;
    }

    const actionsContainer = fragment.querySelector('.stage-actions');
    if (actionsContainer) {
        actionsContainer.innerHTML = '';
        const actionControl = createActionLabel(stage.id, COMPONENT_STAGE_ACTIONS);
        if (actionControl) {
            actionsContainer.appendChild(actionControl);
        }
    }
}

export function renderComponentStages({
    containerId = 'component-stage-container',
    templateId = 'component-stage-template',
} = {}) {
    const container = document.getElementById(containerId);
    const template = document.getElementById(templateId);

    if (!container || !(template instanceof HTMLTemplateElement)) {
        return;
    }

    container.innerHTML = '';
    const fragment = document.createDocumentFragment();

    COMPONENT_STAGES.forEach(stage => {
        const stageFragment = template.content.cloneNode(true);
        populateStage(stageFragment, stage);
        fragment.appendChild(stageFragment);
    });

    container.appendChild(fragment);
}

export { COMPONENT_STAGES };
