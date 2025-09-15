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

function createActionLabel(stageId, action) {
    const label = document.createElement('label');
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = `${stageId}_accion`;
    radio.value = action.value;
    if (action.default) {
        radio.checked = true;
        radio.defaultChecked = true;
    }
    label.appendChild(radio);
    label.appendChild(document.createTextNode(action.label));
    return label;
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
        COMPONENT_STAGE_ACTIONS.forEach(action => {
            const label = createActionLabel(stage.id, action);
            actionsContainer.appendChild(label);
        });
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
