import { jest } from '@jest/globals';

const REPORT_NUMBER = 'REP-TEST-123456';
const DOM_TEMPLATE = `
<button id="guardarButton">Guardar</button>
<button id="generarRemitoButton" disabled>Generar Remito</button>
`.trim();

describe('event handlers en main.js', () => {
    let handleGuardarClick;
    let handleGenerarRemitoClick;
    let guardarMantenimientoMock;
    let setReportNumberMock;
    let resetFormMock;
    let generateReportNumberMock;
    let getFormDataMock;
    let originalAlert;
    let originalPrint;
    let formData;
    let storeLastSavedReportMock;
    let renderRemitoFromStoredMock;

    beforeEach(async () => {
        jest.resetModules();
        jest.useFakeTimers();

        formData = {
            cliente: 'ACME',
            direccion: 'Av Siempre Viva 123',
        };
        guardarMantenimientoMock = jest.fn().mockResolvedValue(undefined);
        setReportNumberMock = jest.fn();
        resetFormMock = jest.fn();
        generateReportNumberMock = jest.fn().mockReturnValue(REPORT_NUMBER);
        getFormDataMock = jest.fn().mockReturnValue(formData);
        storeLastSavedReportMock = jest.fn();
        renderRemitoFromStoredMock = jest.fn();

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

        jest.unstable_mockModule('../remito.js', () => ({
            storeLastSavedReport: storeLastSavedReportMock,
            renderRemitoFromStored: renderRemitoFromStoredMock,
        }));

        const mainModule = await import('../main.js');
 codex/implementar-logica-para-boton-generar-remito
        ({ handleGuardarClick, handleGenerarRemitoClick } = mainModule.__testables__);


        document.body.innerHTML = DOM_TEMPLATE;

        originalAlert = window.alert;
        originalPrint = window.print;
develop
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
        document.body.innerHTML = `
            <select id="cliente">
                <option value="ACME" selected>ACME S.A.</option>
            </select>
            <input id="direccion" value="Av Siempre Viva 123" />
            <input id="cliente_telefono" value="123456789" />
            <input id="cliente_email" value="soporte@example.com" />
            <input id="cliente_cuit" value="20-12345678-9" />
            <button id="guardarButton">Guardar</button>
            <button id="generarRemitoButton" disabled>Generar Remito</button>
        `;

        const generarRemitoButton = document.getElementById('generarRemitoButton');
        expect(generarRemitoButton).not.toBeNull();
        expect(generarRemitoButton.disabled).toBe(true);

        await handleGuardarClick();

        expect(generateReportNumberMock).toHaveBeenCalledTimes(1);
        expect(getFormDataMock).toHaveBeenCalledTimes(1);

        expect(formData.numero_reporte).toBe(REPORT_NUMBER);
        expect(guardarMantenimientoMock).toHaveBeenCalledWith(formData);
        expect(setReportNumberMock).toHaveBeenCalledWith(REPORT_NUMBER);
        expect(storeLastSavedReportMock).toHaveBeenCalledTimes(1);
        expect(storeLastSavedReportMock).toHaveBeenCalledWith(formData, {
            clienteNombre: 'ACME S.A.',
            clienteDireccion: 'Av Siempre Viva 123',
            clienteTelefono: '123456789',
            clienteEmail: 'soporte@example.com',
            clienteCuit: '20-12345678-9',
        });

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
    let renderRemitoFromStoredMock;

    beforeEach(async () => {
        jest.resetModules();
        renderRemitoFromStoredMock = jest.fn();

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

        jest.unstable_mockModule('../remito.js', () => ({
            storeLastSavedReport: jest.fn(),
            renderRemitoFromStored: renderRemitoFromStoredMock,
        }));

        const mainModule = await import('../main.js');
        ({ handleGenerarRemitoClick } = mainModule.__testables__);

        window.alert = jest.fn();
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('muestra el remito y oculta el formulario cuando hay datos disponibles', () => {
        renderRemitoFromStoredMock.mockReturnValue(true);

        document.body.innerHTML = `
            <div id="tab-nuevo">Formulario</div>
            <div id="remito-servicio" class="hidden">Remito</div>
        `;

        handleGenerarRemitoClick();

        expect(renderRemitoFromStoredMock).toHaveBeenCalledTimes(1);
        expect(document.getElementById('tab-nuevo').classList.contains('hidden')).toBe(true);
        expect(document.getElementById('remito-servicio').classList.contains('hidden')).toBe(false);
        expect(window.alert).not.toHaveBeenCalled();
    });

    test('muestra una alerta si no hay datos para generar el remito', () => {
        renderRemitoFromStoredMock.mockReturnValue(false);

        document.body.innerHTML = `
            <div id="tab-nuevo">Formulario</div>
            <div id="remito-servicio" class="hidden">Remito</div>
        `;

        handleGenerarRemitoClick();

        expect(renderRemitoFromStoredMock).toHaveBeenCalledTimes(1);
        expect(window.alert).toHaveBeenCalledWith('Primero guarda el mantenimiento para generar el remito.');
        expect(document.getElementById('tab-nuevo').classList.contains('hidden')).toBe(false);
        expect(document.getElementById('remito-servicio').classList.contains('hidden')).toBe(true);
    });
});
