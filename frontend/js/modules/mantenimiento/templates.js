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
function createComponentToggle(stageId) {
    const toggle = document.createElement('div');
    toggle.className = 'component-toggle';
    toggle.dataset.state = 'inspeccionado';

    const changedId = `${stageId}_accion_cambiado`;
    const inspectedId = `${stageId}_accion_inspeccionado`;

    const changedInput = document.createElement('input');
    changedInput.type = 'radio';
    changedInput.name = `${stageId}_accion`;
    changedInput.value = 'Cambiado';
    changedInput.id = changedId;
    changedInput.className = 'component-toggle__input';

    const inspectedInput = document.createElement('input');
    inspectedInput.type = 'radio';
    inspectedInput.name = `${stageId}_accion`;
    inspectedInput.value = 'Inspeccionado';
    inspectedInput.id = inspectedId;
    inspectedInput.className = 'component-toggle__input';
    inspectedInput.checked = true;
    inspectedInput.defaultChecked = true;

    const track = document.createElement('div');
    track.className = 'component-toggle__track';

    const thumb = document.createElement('div');
    thumb.className = 'component-toggle__thumb';
    track.appendChild(thumb);

    const changedLabel = document.createElement('label');
    changedLabel.setAttribute('for', changedId);
    changedLabel.className = 'component-toggle__option component-toggle__option--cambiado';
    changedLabel.textContent = 'Cambiado';

    const inspectedLabel = document.createElement('label');
    inspectedLabel.setAttribute('for', inspectedId);
    inspectedLabel.className = 'component-toggle__option component-toggle__option--inspeccionado';
    inspectedLabel.textContent = 'Inspeccionado';

    toggle.append(
        changedInput,
        inspectedInput,
        track,
        changedLabel,
        inspectedLabel,
    );

    return toggle;
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
        const toggle = createComponentToggle(stage.id);
        actionsContainer.innerHTML = '';
        actionsContainer.appendChild(toggle);

        const updateState = value => {
            toggle.dataset.state = String(value).toLowerCase();
        };

        const radios = toggle.querySelectorAll('.component-toggle__input');
        radios.forEach(radio => {
            radio.addEventListener('change', () => {
                if (radio.checked) {
                    updateState(radio.value);
                }
            });
        });

        const checkedRadio = toggle.querySelector('.component-toggle__input:checked');
        if (checkedRadio) {
            updateState(checkedRadio.value);
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

export function resetComponentStages() {
    COMPONENT_STAGES.forEach(stage => {
        // Reset el toggle a 'Inspeccionado' (estado por defecto)
        const inspectedRadio = document.getElementById(`${stage.id}_accion_inspeccionado`);
        const changedRadio = document.getElementById(`${stage.id}_accion_cambiado`);
        
        if (inspectedRadio) {
            inspectedRadio.checked = true;
        }
        if (changedRadio) {
            changedRadio.checked = false;
        }
        
        // Actualizar el data-state del toggle
        const toggle = inspectedRadio?.closest('.component-toggle');
        if (toggle) {
            toggle.dataset.state = 'inspeccionado';
        }
        
        // Limpiar el campo de detalles
        const detailsInput = document.getElementById(`${stage.id}_detalles`);
        if (detailsInput instanceof HTMLInputElement) {
            detailsInput.value = '';
        }
    });
}

export { COMPONENT_STAGES };
