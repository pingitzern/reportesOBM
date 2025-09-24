import { jest } from '@jest/globals';

const REPORT_NUMBER = 'REP-TEST-123456';
const DOM_TEMPLATE = `
<button id="guardarButton">Guardar</button>
<button id="generarRemitoButton" disabled>Generar Remito</button>
`.trim();

const REMITO_DOM_TEMPLATE = `
<div id="tab-nuevo" class="tab-content"></div>
<div id="remito-servicio" class="hidden">
    <p id="remito-numero"></p>
    <p id="remito-fecha"></p>
    <p id="remito-cliente"></p>
    <p id="remito-cliente-direccion"></p>
    <p id="remito-cliente-telefono"></p>
    <p id="remito-cliente-email"></p>
    <p id="remito-cliente-cuit"></p>
    <p id="remito-equipo"></p>
    <p id="remito-equipo-modelo"></p>
    <p id="remito-equipo-serie"></p>
    <p id="remito-equipo-interno"></p>
    <p id="remito-equipo-ubicacion"></p>
    <p id="remito-equipo-tecnico"></p>
    <textarea id="remito-observaciones"></textarea>
    <table><tbody id="remito-repuestos"></tbody></table>
</div>
<button id="generarRemitoButton">Generar Remito</button>
`.trim();

const MOCK_COMPONENT_STAGES = [
    { id: 'etapa1', title: '1ª Etapa' },
    { id: 'etapa2', title: '2ª Etapa' },
];

describe('handleGuardarClick', () => {
    let handleGuardarClick;
    let guardarMantenimientoMock;
    let setReportNumberMock;
    let resetFormMock;
    let generateReportNumberMock;
    let getFormDataMock;
    let originalAlert;
    let originalPrint;
    let formData;

    beforeEach(async () => {
        jest.resetModules();
        jest.useFakeTimers();

        formData = { cliente: 'Test' };
        guardarMantenimientoMock = jest.fn().mockResolvedValue(undefined);
        setReportNumberMock = jest.fn();
        resetFormMock = jest.fn();
        generateReportNumberMock = jest.fn().mockReturnValue(REPORT_NUMBER);
        getFormDataMock = jest.fn().mockReturnValue(formData);

        jest.unstable_mockModule('../config.js', () => ({
            API_URL: 'http://localhost/api',
        }));

        jest.unstable_mockModule('../forms.js', () => ({
            configureClientSelect: jest.fn(),
            generateReportNumber: generateReportNumberMock,
            getFormData: getFormDataMock,
            initializeForm: jest.fn(),
            resetForm: resetFormMock,
            setReportNumber: setReportNumberMock,
        }));

        jest.unstable_mockModule('../api.js', () => ({
            guardarMantenimiento: guardarMantenimientoMock,
            buscarMantenimientos: jest.fn(),
            actualizarMantenimiento: jest.fn(),
            eliminarMantenimiento: jest.fn(),
            obtenerDashboard: jest.fn(),
            obtenerClientes: jest.fn().mockResolvedValue([]),
        }));

        jest.unstable_mockModule('../auth.js', () => ({
            initializeAuth: jest.fn(),
        }));

        jest.unstable_mockModule('../templates.js', () => ({
            renderComponentStages: jest.fn(),
            COMPONENT_STAGES: MOCK_COMPONENT_STAGES,
        }));

        jest.unstable_mockModule('../search.js', () => ({
            clearSearchResults: jest.fn(),
            getEditFormValues: jest.fn(),
            openEditModal: jest.fn(),
            closeEditModal: jest.fn(),
            renderSearchResults: jest.fn(),
        }));

        jest.unstable_mockModule('../dashboard.js', () => ({
            renderDashboard: jest.fn(),
        }));

        const mainModule = await import('../main.js');
        handleGuardarClick = mainModule.__testables__.handleGuardarClick;

        document.body.innerHTML = DOM_TEMPLATE;

        originalAlert = window.alert;
        originalPrint = window.print;
        window.alert = jest.fn();
        window.print = jest.fn();

        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
        jest.clearAllMocks();
        window.alert = originalAlert;
        window.print = originalPrint;
        document.body.innerHTML = '';
    });

    test('usa el mismo número de reporte para guardar y mostrar', async () => {
        const generarRemitoButton = document.getElementById('generarRemitoButton');
        expect(generarRemitoButton).not.toBeNull();
        expect(generarRemitoButton.disabled).toBe(true);

        await handleGuardarClick();

        expect(generateReportNumberMock).toHaveBeenCalledTimes(1);
        expect(getFormDataMock).toHaveBeenCalledTimes(1);

        expect(formData.numero_reporte).toBe(REPORT_NUMBER);
        expect(guardarMantenimientoMock).toHaveBeenCalledWith(formData);
        expect(setReportNumberMock).toHaveBeenCalledWith(REPORT_NUMBER);

        expect(generarRemitoButton.disabled).toBe(false);

        const savedNumber = guardarMantenimientoMock.mock.calls[0][0].numero_reporte;
        const displayedNumber = setReportNumberMock.mock.calls[0][0];
        expect(savedNumber).toBe(displayedNumber);

        const generateCallOrder = generateReportNumberMock.mock.invocationCallOrder[0];
        const formDataCallOrder = getFormDataMock.mock.invocationCallOrder[0];
        expect(generateCallOrder).toBeLessThan(formDataCallOrder);

        expect(resetFormMock).not.toHaveBeenCalled();
        jest.runAllTimers();
        expect(window.print).toHaveBeenCalledTimes(1);
        expect(resetFormMock).toHaveBeenCalledTimes(1);
    });
});

describe('handleGenerarRemitoClick', () => {
    let handleGenerarRemitoClick;
    let setLastSavedReportData;
    let originalAlert;

    beforeEach(async () => {
        jest.resetModules();

        jest.unstable_mockModule('../config.js', () => ({
            API_URL: 'http://localhost/api',
        }));

        jest.unstable_mockModule('../forms.js', () => ({
            configureClientSelect: jest.fn(),
            generateReportNumber: jest.fn(),
            getFormData: jest.fn(),
            initializeForm: jest.fn(),
            resetForm: jest.fn(),
            setReportNumber: jest.fn(),
        }));

        jest.unstable_mockModule('../api.js', () => ({
            guardarMantenimiento: jest.fn(),
            buscarMantenimientos: jest.fn(),
            actualizarMantenimiento: jest.fn(),
            eliminarMantenimiento: jest.fn(),
            obtenerDashboard: jest.fn(),
            obtenerClientes: jest.fn().mockResolvedValue([]),
        }));

        jest.unstable_mockModule('../auth.js', () => ({
            initializeAuth: jest.fn(),
        }));

        jest.unstable_mockModule('../templates.js', () => ({
            renderComponentStages: jest.fn(),
            COMPONENT_STAGES: MOCK_COMPONENT_STAGES,
        }));

        jest.unstable_mockModule('../search.js', () => ({
            clearSearchResults: jest.fn(),
            getEditFormValues: jest.fn(),
            openEditModal: jest.fn(),
            closeEditModal: jest.fn(),
            renderSearchResults: jest.fn(),
        }));

        jest.unstable_mockModule('../dashboard.js', () => ({
            renderDashboard: jest.fn(),
        }));

        const mainModule = await import('../main.js');
        handleGenerarRemitoClick = mainModule.__testables__.handleGenerarRemitoClick;
        setLastSavedReportData = mainModule.__testables__.setLastSavedReportDataForTests;

        originalAlert = window.alert;
        window.alert = jest.fn();
    });

    afterEach(() => {
        window.alert = originalAlert;
        document.body.innerHTML = '';
        jest.clearAllMocks();
    });

    test('muestra un mensaje cuando no hay datos para generar el remito', () => {
        document.body.innerHTML = REMITO_DOM_TEMPLATE;

        handleGenerarRemitoClick();

        expect(window.alert).toHaveBeenCalledTimes(1);
        const formView = document.getElementById('tab-nuevo');
        const remitoView = document.getElementById('remito-servicio');
        expect(formView.classList.contains('hidden')).toBe(false);
        expect(remitoView.classList.contains('hidden')).toBe(true);
    });

    test('rellena la vista del remito con los datos guardados y bloquea los campos', () => {
        document.body.innerHTML = REMITO_DOM_TEMPLATE;

        const savedReport = {
            numero_reporte: 'REP-001',
            fecha: '2024-06-01',
            fecha_display: '01/06/2024',
            cliente_nombre: 'Cliente Demo',
            direccion: 'Av. Siempre Viva 742',
            cliente_telefono: '+54 11 5555-5555',
            cliente_email: 'cliente@demo.com',
            cliente_cuit: '20-12345678-9',
            modelo: 'Equipo RO-5000',
            n_serie: 'SN-123',
            id_interna: 'ACT-45',
            tecnico: 'Juan Pérez',
            resumen: 'Se realizó mantenimiento completo.',
            componentes: [
                { id: 'etapa1', title: '1ª Etapa', detalles: 'Filtro PP 5µ', accion: 'Cambiado', cantidad: 2 },
                { id: 'etapa2', title: '2ª Etapa', detalles: 'Filtro CTO', accion: 'Inspeccionado' },
            ],
        };

        setLastSavedReportData(savedReport);

        handleGenerarRemitoClick();

        expect(window.alert).not.toHaveBeenCalled();

        const formView = document.getElementById('tab-nuevo');
        const remitoView = document.getElementById('remito-servicio');
        expect(formView.classList.contains('hidden')).toBe(true);
        expect(remitoView.classList.contains('hidden')).toBe(false);

        expect(document.getElementById('remito-numero').textContent).toBe('REP-001');
        expect(document.getElementById('remito-fecha').textContent).toBe('01/06/2024');
        expect(document.getElementById('remito-cliente').textContent).toBe('Cliente Demo');
        expect(document.getElementById('remito-equipo-modelo').textContent).toBe('Equipo RO-5000');
        expect(document.getElementById('remito-equipo-interno').textContent).toBe('ACT-45');

        const observaciones = document.getElementById('remito-observaciones');
        expect(observaciones.value).toBe('Se realizó mantenimiento completo.');
        expect(observaciones.readOnly).toBe(true);
        expect(observaciones.hasAttribute('readonly')).toBe(true);

        const repuestosRows = document.querySelectorAll('#remito-repuestos tr');
        expect(repuestosRows).toHaveLength(1);
        const cells = repuestosRows[0].querySelectorAll('td');
        expect(cells[0].textContent).toBe('etapa1');
        expect(cells[1].textContent).toContain('1ª Etapa');
        expect(cells[1].textContent).toContain('Filtro PP 5µ');
        expect(cells[2].textContent).toBe('2');
    });
});
