import { jest } from '@jest/globals';

const REPORT_NUMBER = 'REP-TEST-123456';
const DOM_TEMPLATE = `
<form id="maintenance-form">
    <select id="cliente" name="cliente">
        <option value="">Selecciona un cliente</option>
        <option value="CLI-001" selected>Cliente Demo</option>
    </select>
    <input type="text" id="direccion" name="direccion" value="Av. Siempre Viva 742">
    <input type="text" id="cliente_telefono" name="cliente_telefono" value="+54 11 5555-5555">
    <input type="text" id="cliente_email" name="cliente_email" value="cliente@demo.com">
    <input type="text" id="cliente_cuit" name="cliente_cuit" value="20-12345678-9">
    <input type="text" id="tecnico" name="tecnico" value="Juan Pérez">
    <input type="text" id="modelo" name="modelo" value="Equipo RO-5000">
    <input type="text" id="id_interna" name="id_interna" value="ACT-45">
    <input type="text" id="n_serie" name="n_serie" value="SN-123">
    <input type="text" id="fecha_display" value="01/06/2024">
    <input type="hidden" id="fecha" name="fecha" value="2024-06-01">
</form>
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
    <button id="finalizarRemitoButton">Finalizar y Generar Remito</button>
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
    let getLastSavedReportData;
    let setLastSavedReportData;
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

        jest.unstable_mockModule('../modules/mantenimiento/forms.js', () => ({
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
            crearRemito: jest.fn(),
        }));

        jest.unstable_mockModule('../modules/login/auth.js', () => ({
            initializeAuth: jest.fn(),
        }));

        jest.unstable_mockModule('../modules/mantenimiento/templates.js', () => ({
            renderComponentStages: jest.fn(),
            COMPONENT_STAGES: MOCK_COMPONENT_STAGES,
        }));

        jest.unstable_mockModule('../modules/busqueda/search.js', () => ({
            clearSearchResults: jest.fn(),
            getEditFormValues: jest.fn(),
            openEditModal: jest.fn(),
            closeEditModal: jest.fn(),
            renderSearchResults: jest.fn(),
        }));

        jest.unstable_mockModule('../modules/dashboard/dashboard.js', () => ({
            renderDashboard: jest.fn(),
        }));

        const mainModule = await import('../main.js');
        handleGuardarClick = mainModule.__testables__.handleGuardarClick;
        getLastSavedReportData = mainModule.__testables__.getLastSavedReportDataForTests;
        setLastSavedReportData = mainModule.__testables__.setLastSavedReportDataForTests;
        setLastSavedReportData(null);

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
        expect(generarRemitoButton.hasAttribute('disabled')).toBe(true);

        await handleGuardarClick();

        expect(generateReportNumberMock).toHaveBeenCalledTimes(1);
        expect(getFormDataMock).toHaveBeenCalledTimes(1);

        expect(formData.numero_reporte).toBe(REPORT_NUMBER);
        expect(guardarMantenimientoMock).toHaveBeenCalledWith(formData);
        expect(setReportNumberMock).toHaveBeenCalledWith(REPORT_NUMBER);

        expect(generarRemitoButton.disabled).toBe(false);
        expect(generarRemitoButton.hasAttribute('disabled')).toBe(false);

        const savedNumber = guardarMantenimientoMock.mock.calls[0][0].numero_reporte;
        const displayedNumber = setReportNumberMock.mock.calls[0][0];
        expect(savedNumber).toBe(displayedNumber);

        const generateCallOrder = generateReportNumberMock.mock.invocationCallOrder[0];
        const formDataCallOrder = getFormDataMock.mock.invocationCallOrder[0];
        expect(generateCallOrder).toBeLessThan(formDataCallOrder);

        expect(window.print).not.toHaveBeenCalled();
        expect(resetFormMock).not.toHaveBeenCalled();
    });

    test('almacena los datos visibles del cliente para el remito', async () => {
        const customFormData = {
            cliente: 'CLI-001',
            direccion: 'Av. Siempre Viva 742',
            tecnico: 'Juan Pérez',
            modelo: 'Equipo RO-5000',
            id_interna: 'ACT-45',
            n_serie: 'SN-123',
            fecha: '2024-06-01',
        };
        getFormDataMock.mockReturnValue(customFormData);

        await handleGuardarClick();

        const snapshot = getLastSavedReportData();

        expect(snapshot).toMatchObject({
            cliente: 'CLI-001',
            cliente_nombre: 'Cliente Demo',
            direccion: 'Av. Siempre Viva 742',
            cliente_telefono: '+54 11 5555-5555',
            cliente_email: 'cliente@demo.com',
            cliente_cuit: '20-12345678-9',
            tecnico: 'Juan Pérez',
            modelo: 'Equipo RO-5000',
            id_interna: 'ACT-45',
            n_serie: 'SN-123',
        });
        expect(snapshot.fecha_display).toBe('01/06/2024');
        expect(Array.isArray(snapshot.componentes)).toBe(true);
        expect(snapshot.componentes).toHaveLength(MOCK_COMPONENT_STAGES.length);
    });
});

describe('manejo de la vista de remito', () => {
    let handleGenerarRemitoClick;
    let handleFinalizarRemitoClick;
    let setLastSavedReportData;
    let showView;
    let originalAlert;
    let crearRemitoMock;

    beforeEach(async () => {
        jest.resetModules();

        jest.unstable_mockModule('../config.js', () => ({
            API_URL: 'http://localhost/api',
        }));

        jest.unstable_mockModule('../modules/mantenimiento/forms.js', () => ({
            configureClientSelect: jest.fn(),
            generateReportNumber: jest.fn(),
            getFormData: jest.fn(),
            initializeForm: jest.fn(),
            resetForm: jest.fn(),
            setReportNumber: jest.fn(),
        }));

        crearRemitoMock = jest.fn().mockResolvedValue({ numero_remito: 'REM-0099' });

        jest.unstable_mockModule('../api.js', () => ({
            guardarMantenimiento: jest.fn(),
            buscarMantenimientos: jest.fn(),
            actualizarMantenimiento: jest.fn(),
            eliminarMantenimiento: jest.fn(),
            obtenerDashboard: jest.fn(),
            obtenerClientes: jest.fn().mockResolvedValue([]),
            crearRemito: crearRemitoMock,
        }));

        jest.unstable_mockModule('../modules/login/auth.js', () => ({
            initializeAuth: jest.fn(),
        }));

        jest.unstable_mockModule('../modules/mantenimiento/templates.js', () => ({
            renderComponentStages: jest.fn(),
            COMPONENT_STAGES: MOCK_COMPONENT_STAGES,
        }));

        jest.unstable_mockModule('../modules/busqueda/search.js', () => ({
            clearSearchResults: jest.fn(),
            getEditFormValues: jest.fn(),
            openEditModal: jest.fn(),
            closeEditModal: jest.fn(),
            renderSearchResults: jest.fn(),
        }));

        jest.unstable_mockModule('../modules/dashboard/dashboard.js', () => ({
            renderDashboard: jest.fn(),
        }));

        const mainModule = await import('../main.js');
        handleGenerarRemitoClick = mainModule.__testables__.handleGenerarRemitoClick;
        handleFinalizarRemitoClick = mainModule.__testables__.handleFinalizarRemitoClick;
        setLastSavedReportData = mainModule.__testables__.setLastSavedReportDataForTests;
        showView = mainModule.__testables__.showView;

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

        const shouldShowRemito = handleGenerarRemitoClick();

        expect(shouldShowRemito).toBe(false);

        expect(window.alert).toHaveBeenCalledTimes(1);
        const generarRemitoButton = document.getElementById('generarRemitoButton');
        expect(generarRemitoButton.disabled).toBe(true);
        expect(generarRemitoButton.hasAttribute('disabled')).toBe(true);
        const formView = document.getElementById('tab-nuevo');
        const remitoView = document.getElementById('remito-servicio');
        expect(formView.classList.contains('hidden')).toBe(false);
        expect(remitoView.classList.contains('hidden')).toBe(true);
    });

    test('rellena la vista del remito con los datos guardados y permite editar observaciones', () => {
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

        const shouldShowRemito = handleGenerarRemitoClick();

        expect(window.alert).not.toHaveBeenCalled();

        expect(shouldShowRemito).toBe(true);

        const formView = document.getElementById('tab-nuevo');
        const remitoView = document.getElementById('remito-servicio');
        expect(formView.classList.contains('hidden')).toBe(false);
        expect(remitoView.classList.contains('hidden')).toBe(true);

        showView('remito-servicio');

        expect(formView.classList.contains('hidden')).toBe(true);
        expect(remitoView.classList.contains('hidden')).toBe(false);

        expect(document.getElementById('remito-numero').textContent).toBe('REP-001');
        expect(document.getElementById('remito-fecha').textContent).toBe('01/06/2024');
        expect(document.getElementById('remito-cliente').textContent).toBe('Cliente Demo');
        expect(document.getElementById('remito-equipo-modelo').textContent).toBe('Equipo RO-5000');
        expect(document.getElementById('remito-equipo-interno').textContent).toBe('ACT-45');

        const observaciones = document.getElementById('remito-observaciones');
        expect(observaciones.value).toBe('Se realizó mantenimiento completo.');
        expect(observaciones.readOnly).toBe(false);
        expect(observaciones.hasAttribute('readonly')).toBe(false);

        const repuestosRows = document.querySelectorAll('#remito-repuestos tr');
        expect(repuestosRows).toHaveLength(1);
        const cells = repuestosRows[0].querySelectorAll('td');
        expect(cells[0].textContent).toBe('etapa1');
        expect(cells[1].textContent).toContain('1ª Etapa');
        expect(cells[1].textContent).toContain('Filtro PP 5µ');
        expect(cells[2].textContent).toBe('2');
    });

    test('muestra un mensaje cuando no hay datos para finalizar el remito', async () => {
        document.body.innerHTML = REMITO_DOM_TEMPLATE;

        await handleFinalizarRemitoClick();

        expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('No hay datos disponibles'));
        expect(crearRemitoMock).not.toHaveBeenCalled();
    });

    test('envía el reporte y observaciones y muestra el número de remito devuelto', async () => {
        document.body.innerHTML = REMITO_DOM_TEMPLATE;

        const savedReport = {
            numero_reporte: 'REP-002',
            cliente_nombre: 'Cliente 2',
        };

        setLastSavedReportData(savedReport);

        const observacionesTextarea = document.getElementById('remito-observaciones');
        observacionesTextarea.value = 'Observaciones finales';

        const numeroElement = document.getElementById('remito-numero');
        numeroElement.textContent = 'REP-002';

        const finalizarButton = document.getElementById('finalizarRemitoButton');

        const promise = handleFinalizarRemitoClick();

        expect(finalizarButton.disabled).toBe(true);
        expect(finalizarButton.textContent).toContain('Generando');

        await promise;

        expect(crearRemitoMock).toHaveBeenCalledWith({
            reporte: savedReport,
            observaciones: 'Observaciones finales',
        });

        expect(numeroElement.textContent).toBe('REM-0099');
        expect(finalizarButton.disabled).toBe(false);
        expect(finalizarButton.textContent).toBe('Finalizar y Generar Remito');
        expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Remito generado correctamente'));
    });
});
